import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/api-errors";
import { readSession, requireManagedGuild } from "@/lib/discord";
import { snowflakeSchema } from "@/lib/config";
import { getDb } from "@/lib/db";
import { auditLogs, botGuilds, guildConfigurations } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await context.params;
    if (!snowflakeSchema.safeParse(guildId).success) return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
    const user = requireUser(await readSession());
    const discordGuild = await requireManagedGuild(user.id, guildId);
    const db = getDb();
    const [inventory] = await db.select().from(botGuilds).where(and(eq(botGuilds.guildId, guildId), eq(botGuilds.installed, true))).limit(1);
    const [configuration] = await db.select().from(guildConfigurations).where(eq(guildConfigurations.guildId, guildId)).limit(1);
    if (!inventory || !configuration) return NextResponse.json({ error: "Jailbot has not synchronized this server yet" }, { status: 503 });
    const audit = await db.select({ id: auditLogs.id, action: auditLogs.action, revision: auditLogs.revision, createdAt: auditLogs.createdAt }).from(auditLogs).where(eq(auditLogs.guildId, guildId)).orderBy(auditLogs.createdAt).limit(12);
    return NextResponse.json({
      guild: { id: discordGuild.id, name: discordGuild.name, icon: discordGuild.icon ?? null, owner: discordGuild.owner },
      bot: { version: inventory.botVersion, setupComplete: inventory.setupComplete, lastSeenAt: inventory.lastSeenAt },
      roles: inventory.roles,
      channels: inventory.channels,
      revision: configuration.revision,
      config: configuration.config,
      activity: audit
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, _request);
  }
}
