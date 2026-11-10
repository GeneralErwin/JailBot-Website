import { createHash, createHmac } from "node:crypto";
import { lt } from "drizzle-orm";
import { botRequests } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { safeEqualText } from "@/lib/crypto";
import { SecurityError } from "@/lib/security";

const MAX_CLOCK_SKEW_SECONDS = 300;

export async function authenticateBotRequest(request: Request, rawBody: string) {
  const keyId = request.headers.get("x-bot-key-id") ?? "";
  const timestamp = request.headers.get("x-bot-timestamp") ?? "";
  const nonce = request.headers.get("x-bot-nonce") ?? "";
  const signature = request.headers.get("x-bot-signature") ?? "";
  const configuredId = process.env.BOT_API_KEY_ID;
  const encodedSecret = process.env.BOT_API_SECRET;
  if (!configuredId || !encodedSecret || keyId !== configuredId) throw new SecurityError("Bot authentication failed", 401);
  if (!/^\d{10,13}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,100}$/.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) throw new SecurityError("Bot authentication failed", 401);
  const epoch = Number(timestamp);
  const timestampSeconds = epoch > 10_000_000_000 ? Math.floor(epoch / 1000) : epoch;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) throw new SecurityError("Bot request timestamp expired", 401);
  const secret = Buffer.from(encodedSecret, "base64");
  if (secret.length < 32) throw new Error("BOT_API_SECRET must decode to at least 32 bytes");
  const url = new URL(request.url);
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const canonical = [request.method.toUpperCase(), `${url.pathname}${url.search}`, timestamp, nonce, bodyHash].join("\n");
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");
  if (!safeEqualText(signature.toLowerCase(), expected)) throw new SecurityError("Bot authentication failed", 401);

  const db = getDb();
  try {
    await db.insert(botRequests).values({ keyId, nonce, createdAt: new Date() });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") throw new SecurityError("Bot request was already used", 409);
    throw error;
  }
  void db.delete(botRequests).where(lt(botRequests.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))).catch(() => undefined);
}
