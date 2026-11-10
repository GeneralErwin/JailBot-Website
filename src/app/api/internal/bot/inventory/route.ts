import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authenticateBotRequest } from "@/lib/bot-auth";
import { botInventorySchema } from "@/lib/config";
import { getDb } from "@/lib/db";
import { auditLogs, botEvents, botGuilds, botStatus, configurationRevisions, guildConfigurations, guilds } from "@/lib/db/schema";
import { apiError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    await authenticateBotRequest(request, raw);
    const allowance = await rateLimit("bot:inventory", 30, 60_000);
    if (!allowance.allowed) return NextResponse.json({ error: "Inventory request rate limit exceeded" }, { status: 429 });
    const parsed = botInventorySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: "Inventory payload is invalid", issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }, { status: 422 });
    const now = new Date();
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [event] = await tx.insert(botEvents).values({ eventId: parsed.data.eventId, eventType: "inventory", processedAt: now }).onConflictDoNothing().returning({ eventId: botEvents.eventId });
      if (!event) return { duplicate: true, count: 0 };
      if (parsed.data.fullSnapshot) await tx.update(botGuilds).set({ installed: false, lastSeenAt: now });
      if (parsed.data.removedGuildIds.length) await tx.update(botGuilds).set({ installed: false, lastSeenAt: now }).where(inArray(botGuilds.guildId, parsed.data.removedGuildIds));
      for (const guild of parsed.data.guilds) {
        await tx.insert(guilds).values({ id: guild.id, name: guild.name, icon: guild.icon ?? null, updatedAt: now }).onConflictDoUpdate({ target: guilds.id, set: { name: guild.name, icon: guild.icon ?? null, updatedAt: now } });
        await tx.insert(botGuilds).values({ guildId: guild.id, installed: true, botVersion: parsed.data.botVersion, roles: guild.roles, channels: guild.channels.map((channel) => ({ ...channel, parentId: channel.parentId ?? null })), setupComplete: guild.setupComplete, lastSeenAt: now }).onConflictDoUpdate({ target: botGuilds.guildId, set: { installed: true, botVersion: parsed.data.botVersion, roles: guild.roles, channels: guild.channels.map((channel) => ({ ...channel, parentId: channel.parentId ?? null })), setupComplete: guild.setupComplete, lastSeenAt: now } });
        const [inserted] = await tx.insert(guildConfigurations).values({ guildId: guild.id, schemaVersion: 1, revision: guild.configRevision, config: guild.config, updatedAt: now }).onConflictDoNothing().returning({ revision: guildConfigurations.revision });
        if (inserted) {
          await tx.insert(configurationRevisions).values({ id: crypto.randomUUID(), guildId: guild.id, schemaVersion: 1, revision: guild.configRevision, source: "bot", actorUserId: null, config: guild.config, createdAt: now });
          await tx.insert(auditLogs).values({ id: crypto.randomUUID(), guildId: guild.id, actorUserId: null, action: "configuration.imported_from_bot", revision: guild.configRevision, beforeConfig: null, afterConfig: guild.config, createdAt: now });
        }
      }
      await tx.insert(botStatus).values({ id: 1, botVersion: parsed.data.botVersion, status: "online", lastHeartbeatAt: now, lastInventoryAt: parsed.data.fullSnapshot ? now : null }).onConflictDoUpdate({ target: botStatus.id, set: { botVersion: parsed.data.botVersion, status: "online", lastHeartbeatAt: now, ...(parsed.data.fullSnapshot ? { lastInventoryAt: now } : {}) } });
      return { duplicate: false, count: parsed.data.guilds.length };
    });
    return NextResponse.json({ accepted: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, request);
  }
}
