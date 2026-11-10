import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeOAuthCode, fetchDiscordUser, saveLogin } from "@/lib/discord";
import { safeEqualText } from "@/lib/crypto";
import { getPublicOrigin } from "@/lib/security";
import { logEvent, requestIdFor } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state") ?? "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("jailbot_oauth_state")?.value ?? "";
  const verifier = cookieStore.get("jailbot_oauth_verifier")?.value ?? "";
  const response = NextResponse.redirect(new URL("/login?reason=oauth", getPublicOrigin()), 303);
  response.cookies.delete("jailbot_oauth_state");
  response.cookies.delete("jailbot_oauth_verifier");
  response.headers.set("Cache-Control", "no-store");

  if (!code || !returnedState || !expectedState || !verifier || !safeEqualText(returnedState, expectedState)) return response;
  try {
    const token = await exchangeOAuthCode(code, verifier);
    const user = await fetchDiscordUser(token.access_token);
    const sessionToken = randomBytes(32).toString("base64url");
    await saveLogin(user, token, sessionToken);
    const success = NextResponse.redirect(new URL("/dashboard", getPublicOrigin()), 303);
    success.cookies.delete("jailbot_oauth_state");
    success.cookies.delete("jailbot_oauth_verifier");
    success.cookies.set("jailbot_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60
    });
    success.headers.set("Cache-Control", "no-store");
    return success;
  } catch (error) {
    logEvent("warn", "auth.callback_failed", { requestId: requestIdFor(request), errorType: error instanceof Error ? error.name : "UnknownError" });
    return response;
  }
}
