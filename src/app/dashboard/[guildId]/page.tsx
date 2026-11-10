import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { ConfigurationEditor } from "@/components/configuration-editor";
import { readSession, getManagedGuilds } from "@/lib/discord";
import { getDb } from "@/lib/db";
import { auditLogs, botGuilds, guildConfigurations, users } from "@/lib/db/schema";
import { snowflakeSchema } from "@/lib/config";
import type { GuildConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function GuildDashboard({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  if (!snowflakeSchema.safeParse(guildId).success) notFound();
  const user = await readSession();
  if (!user) redirect("/login");
  let managedGuild;
  try { managedGuild = (await getManagedGuilds(user.id)).find((guild) => guild.id === guildId); }
  catch { return <Unavailable title="Discord could not verify this session" body="Reconnect your Discord account, then return to this server." />; }
  if (!managedGuild) notFound();
  if (!managedGuild.botInstalled && managedGuild.botStatusKnown) return <Unavailable title="Jailbot is not installed here" body="Add the bot to this server to unlock its server-specific configuration." guildId={guildId} />;
  if (!managedGuild.botInstalled) return <Unavailable title="Waiting for the bot handshake" body="The bot installation status is unknown until the Rust service publishes its signed guild inventory." />;

  const db = getDb();
  const [inventory] = await db.select().from(botGuilds).where(eq(botGuilds.guildId, guildId)).limit(1);
  const [configuration] = await db.select().from(guildConfigurations).where(eq(guildConfigurations.guildId, guildId)).limit(1);
  const activity = await db.select({ id: auditLogs.id, action: auditLogs.action, revision: auditLogs.revision, actorUserId: auditLogs.actorUserId, actorName: users.username, beforeConfig: auditLogs.beforeConfig, afterConfig: auditLogs.afterConfig, createdAt: auditLogs.createdAt }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).where(eq(auditLogs.guildId, guildId)).orderBy(desc(auditLogs.createdAt)).limit(10);
  if (!inventory || !configuration) return <Unavailable title="Waiting for the bot handshake" body="The bot has not reported its current roles, channels and configuration to the control plane yet." guildId={guildId} />;

  return (
    <div className="dashboard-layout">
      <header className="dash-topbar"><Link className="wordmark" href="/"><BrandMark /><span>JAILBOT<span className="wordmark-dot">.</span></span></Link><div className="dash-topbar-right"><Link className="back-servers" href="/dashboard">← All servers</Link><span className="dash-user-name">{user.globalName ?? user.username}</span><form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">Sign out <span>↗</span></button></form></div></header>
      <div className="server-layout">
        <aside className="server-sidebar">
          <Link className="server-switcher" href="/dashboard"><span className="server-switcher-avatar">{managedGuild.name.slice(0, 1).toUpperCase()}</span><span><small>ACTIVE SERVER</small><b>{managedGuild.name}</b></span><span className="server-switcher-arrow">⌄</span></Link>
          <div className="sidebar-group-label">WORKSPACE</div>
          <a className="sidebar-link sidebar-link--active" href="#overview"><span>◫</span> Overview</a>
          <a className="sidebar-link" href="#jail-setup"><span>⌖</span> Jail setup</a>
          <a className="sidebar-link" href="#quarantine"><span>◈</span> Quarantine</a>
          <a className="sidebar-link" href="#activity"><span>≡</span> Activity</a>
          <div className="sidebar-bottom"><span className="sidebar-live-dot"></span><span>BOT VERSION<br /><b>{inventory.botVersion}</b></span><span className="sidebar-time">SEEN<br />{new Date(inventory.lastSeenAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</span></div>
        </aside>
        <main className="server-main" id="overview">
          <div className="server-breadcrumb"><Link href="/dashboard">SERVERS</Link><span>/</span><span>{managedGuild.name.toUpperCase()}</span><span>/</span><span>OVERVIEW</span></div>
          <div className="server-titlebar"><div><p className="dash-kicker"><span className="eyebrow-dot"></span> GUILD CONTROL</p><h1>{managedGuild.name}</h1><p className="server-subtitle">Configuration for this server is isolated from every other guild.</p></div><div className="server-revision"><small>CONFIG REVISION</small><b>#{String(configuration.revision).padStart(4, "0")}</b><span><i></i> VERSIONED</span></div></div>
          <div className="server-stat-row"><div className="server-stat"><span>BOT STATUS</span><b>{managedGuild.botOnline ? <><i></i> Online</> : managedGuild.botDegraded ? "Sync degraded" : "Installed · offline"}</b></div><div className="server-stat"><span>JAIL SETUP</span><b>{inventory.setupComplete ? "Ready" : "Needs setup"}</b></div><div className="server-stat"><span>SERVER ID</span><b className="stat-snowflake">{managedGuild.id}</b></div></div>
          <ConfigurationEditor guildId={guildId} initialConfig={configuration.config} initialRevision={configuration.revision} roles={inventory.roles} channels={inventory.channels} />
          <section className="activity-section" id="activity"><div className="activity-heading"><div><p className="dash-kicker"><span className="eyebrow-dot"></span> CHANGE HISTORY</p><h2>Recent activity</h2></div><span>LAST {activity.length} EVENTS</span></div>{activity.length === 0 ? <p className="activity-empty">No configuration changes have been recorded.</p> : <div className="activity-list">{activity.map((event) => <div className="activity-row" key={event.id}><span className="activity-marker"></span><div className="activity-summary"><span className="activity-action">{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</span><span className="activity-detail">{event.actorName ?? (event.actorUserId ? `Discord user ${event.actorUserId}` : "Rust bot")} · {changedFields(event.beforeConfig, event.afterConfig).join(", ")}</span></div><span className="activity-revision">REV / {event.revision}</span><time dateTime={event.createdAt.toISOString()}>{event.createdAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time></div>)}</div>}</section>
          <div className="server-bottom-note"><span>EVERY CHANGE IS RECORDED WITH A REVISION AND ACTOR.</span><Link href="/docs">BOT INTEGRATION STATUS <span>↗</span></Link></div>
        </main>
      </div>
    </div>
  );
}

function changedFields(before: GuildConfig | null, after: GuildConfig | null): string[] {
  if (!before || !after) return ["Initial configuration"];
  const fields: [keyof GuildConfig, string][] = [
    ["prisonerRoleId", "Prisoner role"],
    ["moderatorRoleId", "Moderator role"],
    ["jailChannelId", "Jail channel"],
    ["logsChannelId", "Log channel"],
    ["autoReleaseEnabled", "Automatic release"],
    ["quarantineEnabled", "Quarantine service"]
  ];
  const changed = fields.filter(([key]) => before[key] !== after[key]).map(([, label]) => label);
  const moduleLabels: Record<keyof GuildConfig["quarantineModules"], string> = {
    dangerous_role_add: "Dangerous role added",
    dangerous_role_remove: "Dangerous role removed",
    role_permission_escalation: "Role permission escalation",
    channel_permission_escalation: "Channel permission escalation",
    jailed_role_changes: "Jailed member changes",
    channel_deletion: "Channel deletion",
    webhook_raid: "Webhook raid"
  };
  for (const key of Object.keys(moduleLabels) as (keyof GuildConfig["quarantineModules"])[]) {
    if (before.quarantineModules[key] !== after.quarantineModules[key]) changed.push(moduleLabels[key]);
  }
  return changed.length ? changed : ["Configuration"];
}

function Unavailable({ title, body, guildId }: { title: string; body: string; guildId?: string }) {
  return <div className="dashboard-layout"><header className="dash-topbar"><Link className="wordmark" href="/"><BrandMark /><span>JAILBOT<span className="wordmark-dot">.</span></span></Link><Link className="back-servers" href="/dashboard">← All servers</Link></header><main className="unavailable-card"><span className="unavailable-symbol">!</span><p className="dash-kicker">BOT / CONNECTION STATE</p><h1>{title}</h1><p>{body}</p>{guildId && <Link className="button button--lime" href={`/api/discord/invite?guild_id=${guildId}`}>Add or reconnect bot <span>↗</span></Link>}<Link className="unavailable-docs" href="/docs">Read bot integration guide <span>↗</span></Link></main></div>;
}
