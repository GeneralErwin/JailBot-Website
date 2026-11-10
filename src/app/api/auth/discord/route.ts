import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/security";
import { rateLimit, requestAddress } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId || !process.env.DISCORD_CLIENT_SECRET || !process.env.DATABASE_URL || !process.env.TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL("/login?reason=setup", getPublicOrigin()));
  }
  const rate = await rateLimit(`oauth:${requestAddress(request)}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many sign-in attempts. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt.getTime() - Date.now()) / 1000))) } });

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = new URL("/api/auth/callback", getPublicOrigin()).toString();
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify guilds");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorize, 303);
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("jailbot_oauth_state", state, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  response.cookies.set("jailbot_oauth_verifier", verifier, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
