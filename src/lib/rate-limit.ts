import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { hashValue } from "@/lib/crypto";

export async function rateLimit(key: string, maximum: number, windowMs: number) {
  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const keyHash = hashValue(key);
  const [row] = await db.insert(rateLimits).values({ keyHash, windowStartedAt: now, requestCount: 1, updatedAt: now }).onConflictDoUpdate({
    target: rateLimits.keyHash,
    set: {
      windowStartedAt: sql`case when ${rateLimits.windowStartedAt} <= ${cutoff} then ${now} else ${rateLimits.windowStartedAt} end`,
      requestCount: sql`case when ${rateLimits.windowStartedAt} <= ${cutoff} then 1 else ${rateLimits.requestCount} + 1 end`,
      updatedAt: now
    }
  }).returning({ requestCount: rateLimits.requestCount, windowStartedAt: rateLimits.windowStartedAt });
  return { allowed: row.requestCount <= maximum, resetAt: new Date(row.windowStartedAt.getTime() + windowMs) };
}

export function requestAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return candidate.slice(0, 100);
}
