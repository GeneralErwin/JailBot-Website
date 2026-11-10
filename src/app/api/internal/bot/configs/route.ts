import { asc, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authenticateBotRequest } from "@/lib/bot-auth";
import { getDb } from "@/lib/db";
import { configurationRevisions } from "@/lib/db/schema";
import { apiError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authenticateBotRequest(request, "");
    const allowance = await rateLimit("bot:config-poll", 240, 60_000);
    if (!allowance.allowed) return NextResponse.json({ error: "Configuration poll rate limit exceeded" }, { status: 429 });
    const url = new URL(request.url);
    const after = Number(url.searchParams.get("after") ?? "0");
    const requestedLimit = Number(url.searchParams.get("limit") ?? "100");
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200) return NextResponse.json({ error: "Invalid sync cursor or limit" }, { status: 400 });
    const rows = await getDb().select({ sequence: configurationRevisions.syncSequence, guildId: configurationRevisions.guildId, schemaVersion: configurationRevisions.schemaVersion, revision: configurationRevisions.revision, config: configurationRevisions.config, source: configurationRevisions.source, createdAt: configurationRevisions.createdAt }).from(configurationRevisions).where(gt(configurationRevisions.syncSequence, after)).orderBy(asc(configurationRevisions.syncSequence)).limit(requestedLimit);
    const nextSequence = rows.at(-1)?.sequence ?? after;
    return NextResponse.json({ events: rows, nextSequence, hasMore: rows.length === requestedLimit }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, request);
  }
}
