import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { apiError, logEvent, requestIdFor, requireUser } from "@/lib/api-errors";
import { readSession, requireManagedGuild } from "@/lib/discord";
import { guildConfigSchema, snowflakeSchema, validateConfigAgainstInventory } from "@/lib/config";
import { getDb } from "@/lib/db";
import { auditLogs, botGuilds, configurationRevisions, guildConfigurations } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({ schemaVersion: z.literal(1), expectedRevision: z.number().int().nonnegative(), config: guildConfigSchema }).strict();

export async function GET(_request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    if (!snowflakeSchema.safeParse(guildId).success) return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
    const user = requireUser(await readSession());
    await requireManagedGuild(user.id, guildId);
    const [current] = await getDb().select({ revision: guildConfigurations.revision, config: guildConfigurations.config, updatedAt: guildConfigurations.updatedAt }).from(guildConfigurations).where(eq(guildConfigurations.guildId, guildId)).limit(1);
    if (!current) return NextResponse.json({ error: "Configuration has not synchronized yet" }, { status: 503 });
    return NextResponse.json({ ...current, schemaVersion: 1 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, _request);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    assertSameOrigin(request);
    const { guildId } = await context.params;
    if (!snowflakeSchema.safeParse(guildId).success) return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
    const user = requireUser(await readSession());
    await requireManagedGuild(user.id, guildId);
    const allowance = await rateLimit(`configuration:${user.id}:${guildId}`, 30, 60_000);
    if (!allowance.allowed) return NextResponse.json({ error: "Too many configuration changes. Wait briefly before saving again." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((allowance.resetAt.getTime() - Date.now()) / 1000))) } });
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Configuration is invalid", issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }, { status: 422 });
    const db = getDb();
    const [inventory] = await db.select().from(botGuilds).where(and(eq(botGuilds.guildId, guildId), eq(botGuilds.installed, true))).limit(1);
    if (!inventory) return NextResponse.json({ error: "Bot inventory is unavailable" }, { status: 503 });
    try { validateConfigAgainstInventory(parsed.data.config, inventory); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Configuration references an unavailable server resource" }, { status: 422 }); }

    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(guildConfigurations).where(eq(guildConfigurations.guildId, guildId)).for("update").limit(1);
      if (!current) return { kind: "missing" as const };
      if (current.revision !== parsed.data.expectedRevision) return { kind: "conflict" as const, revision: current.revision, config: current.config };
      if (isDeepStrictEqual(current.config, parsed.data.config)) return { kind: "unchanged" as const, revision: current.revision, config: current.config, updatedAt: current.updatedAt };
      const nextRevision = current.revision + 1;
      const [saved] = await tx.update(guildConfigurations).set({ revision: nextRevision, config: parsed.data.config, updatedAt: now }).where(and(eq(guildConfigurations.guildId, guildId), eq(guildConfigurations.revision, current.revision))).returning();
      if (!saved) return { kind: "conflict" as const, revision: current.revision, config: current.config };
      const revisionId = crypto.randomUUID();
      await tx.insert(configurationRevisions).values({ id: revisionId, guildId, schemaVersion: 1, revision: nextRevision, source: "web", actorUserId: user.id, config: parsed.data.config, createdAt: now });
      await tx.insert(auditLogs).values({ id: crypto.randomUUID(), guildId, actorUserId: user.id, action: "configuration.updated", revision: nextRevision, beforeConfig: current.config, afterConfig: parsed.data.config, createdAt: now });
      return { kind: "saved" as const, revision: nextRevision, config: saved.config, updatedAt: saved.updatedAt };
    });
    if (updated.kind === "missing") return NextResponse.json({ error: "Configuration is not initialized by the bot" }, { status: 503 });
    if (updated.kind === "conflict") return NextResponse.json({ error: "Configuration changed since you opened it", revision: updated.revision, config: updated.config }, { status: 409 });
    if (updated.kind === "unchanged") return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
    logEvent("info", "configuration.saved", { requestId: requestIdFor(request), guildId, revision: updated.revision, source: "web" });
    return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, request);
  }
}
