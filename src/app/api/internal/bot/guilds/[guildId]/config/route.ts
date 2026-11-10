import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { authenticateBotRequest } from "@/lib/bot-auth";
import { guildConfigSchema, snowflakeSchema, validateConfigAgainstInventory } from "@/lib/config";
import { getDb } from "@/lib/db";
import { auditLogs, botGuilds, configurationRevisions, guildConfigurations } from "@/lib/db/schema";
import { apiError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const botUpdateSchema = z.object({ schemaVersion: z.literal(1), expectedRevision: z.number().int().nonnegative(), config: guildConfigSchema }).strict();

export async function GET(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    await authenticateBotRequest(request, "");
    const allowance = await rateLimit("bot:config-read", 600, 60_000);
    if (!allowance.allowed) return NextResponse.json({ error: "Configuration read rate limit exceeded" }, { status: 429 });
    const { guildId } = await context.params;
    if (!snowflakeSchema.safeParse(guildId).success) return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
    const db = getDb();
    const [inventory] = await db.select({ installed: botGuilds.installed }).from(botGuilds).where(eq(botGuilds.guildId, guildId)).limit(1);
    if (!inventory?.installed) return NextResponse.json({ error: "Server is not in the bot inventory" }, { status: 404 });
    const [current] = await db.select().from(guildConfigurations).where(eq(guildConfigurations.guildId, guildId)).limit(1);
    if (!current) return NextResponse.json({ error: "Configuration is not initialized" }, { status: 404 });
    const afterValue = new URL(request.url).searchParams.get("after");
    const after = afterValue === null ? -1 : Number(afterValue);
    if (!Number.isSafeInteger(after) || after < -1) return NextResponse.json({ error: "Invalid revision cursor" }, { status: 400 });
    if (after > current.revision) return NextResponse.json({ error: "Bot revision is ahead of the control plane" }, { status: 409 });
    if (after === current.revision) return NextResponse.json({ unchanged: true, revision: current.revision }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ guildId, schemaVersion: current.schemaVersion, revision: current.revision, config: current.config, updatedAt: current.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function POST(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const raw = await request.text();
    await authenticateBotRequest(request, raw);
    const { guildId } = await context.params;
    if (!snowflakeSchema.safeParse(guildId).success) return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
    const parsed = botUpdateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: "Configuration payload is invalid" }, { status: 422 });
    const db = getDb();
    const [inventory] = await db.select().from(botGuilds).where(and(eq(botGuilds.guildId, guildId), eq(botGuilds.installed, true))).limit(1);
    if (!inventory) return NextResponse.json({ error: "Server is not in the bot inventory" }, { status: 404 });
    try { validateConfigAgainstInventory(parsed.data.config, inventory); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Configuration is invalid" }, { status: 422 }); }
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(guildConfigurations).where(eq(guildConfigurations.guildId, guildId)).for("update").limit(1);
      if (!current) return { kind: "missing" as const };
      if (current.revision !== parsed.data.expectedRevision) return { kind: "conflict" as const, revision: current.revision, config: current.config };
      if (isDeepStrictEqual(current.config, parsed.data.config)) return { kind: "unchanged" as const, revision: current.revision, config: current.config, updatedAt: current.updatedAt };
      const nextRevision = current.revision + 1;
      const [saved] = await tx.update(guildConfigurations).set({ revision: nextRevision, config: parsed.data.config, updatedAt: now }).where(and(eq(guildConfigurations.guildId, guildId), eq(guildConfigurations.revision, current.revision))).returning();
      if (!saved) return { kind: "conflict" as const, revision: current.revision, config: current.config };
      await tx.insert(configurationRevisions).values({ id: crypto.randomUUID(), guildId, schemaVersion: 1, revision: nextRevision, source: "bot", actorUserId: null, config: parsed.data.config, createdAt: now });
      await tx.insert(auditLogs).values({ id: crypto.randomUUID(), guildId, actorUserId: null, action: "configuration.updated_by_bot", revision: nextRevision, beforeConfig: current.config, afterConfig: parsed.data.config, createdAt: now });
      return { kind: "saved" as const, revision: nextRevision, config: saved.config, updatedAt: saved.updatedAt };
    });
    if (result.kind === "missing") return NextResponse.json({ error: "Configuration is not initialized" }, { status: 404 });
    if (result.kind === "conflict") return NextResponse.json({ error: "Revision conflict; apply the returned control-plane revision before retrying", revision: result.revision, config: result.config }, { status: 409 });
    if (result.kind === "unchanged") return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, request);
  }
}
