import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateBotRequest } from "@/lib/bot-auth";
import { getDb } from "@/lib/db";
import { botEvents, botStatus } from "@/lib/db/schema";
import { apiError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const heartbeatSchema = z.object({ eventId: z.string().uuid(), version: z.string().min(1).max(80), status: z.enum(["online", "degraded"]) }).strict();

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    await authenticateBotRequest(request, raw);
    const allowance = await rateLimit("bot:heartbeat", 120, 60_000);
    if (!allowance.allowed) return NextResponse.json({ error: "Heartbeat rate limit exceeded" }, { status: 429 });
    const parsed = heartbeatSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: "Heartbeat payload is invalid" }, { status: 422 });
    const db = getDb();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(botEvents).values({ eventId: parsed.data.eventId, eventType: "heartbeat", processedAt: now }).onConflictDoNothing();
      await tx.insert(botStatus).values({ id: 1, botVersion: parsed.data.version, status: parsed.data.status, lastHeartbeatAt: now }).onConflictDoUpdate({ target: botStatus.id, set: { botVersion: parsed.data.version, status: parsed.data.status, lastHeartbeatAt: now } });
    });
    return NextResponse.json({ accepted: true, receivedAt: now.toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, request);
  }
}
