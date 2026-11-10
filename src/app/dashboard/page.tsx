import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { readSession, getManagedGuilds } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function GuildIcon({ icon, id, name }: { icon?: string | null; id: string; name: string }) {
  return icon ? <Image className="guild-avatar" src={`https://cdn.discordapp.com/icons/${id}/${icon}.webp?size=128`} alt="" width={43} height={43} unoptimized /> : <span className="guild-avatar guild-avatar--fallback" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}

function DashboardHeader({ name }: { name: string }) {
  return <header className="dash-topbar"><Link className="wordmark" href="/"><BrandMark /><span>JAILBOT<span className="wordmark-dot">.</span></span></Link><div className="dash-topbar-right"><span className="dash-avatar-fallback">{name.slice(0, 1).toUpperCase()}</span><span className="dash-user-name">{name}</span><form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">Sign out <span>↗</span></button></form></div></header>;
}

export default async function DashboardHome() {
  const user = await readSession();
  if (!user) redirect("/login");
  let guilds: Awaited<ReturnType<typeof getManagedGuilds>> = [];
  let loadError = "";
  try { guilds = await getManagedGuilds(user.id); }
  catch (error) { loadError = error instanceof Error && error.message.includes("Discord") ? error.message : "Server access could not be loaded. Retry after checking the Discord connection."; }
  const installedCount = guilds.filter((guild) => guild.botInstalled).length;

  return (
    <div className="dashboard-layout">
      <DashboardHeader name={user.globalName ?? user.username} />
      <main className="guild-page page-frame">
        <div className="dash-kicker"><span className="eyebrow-dot"></span> CONTROL PANEL <span>/</span> SELECT SERVER</div>
        <div className="guild-heading-row"><div><h1>Your servers,<br /><em>your control.</em></h1><p>Choose a community you own or manage. Configuration stays scoped to that server.</p></div><div className="guild-count"><b>{String(installedCount).padStart(2, "0")}</b><span>BOT-INSTALLED<br />SERVERS</span></div></div>
        {loadError && <div className="dash-alert" role="alert">{loadError}</div>}
        {!loadError && guilds.length === 0 && <div className="guild-empty"><span className="empty-mark">⌖</span><h2>No manageable servers found.</h2><p>Discord returned no servers where you have Administrator or Manage Server access.</p><Link className="button button--outline" href="/api/auth/discord">Refresh Discord access <span>↗</span></Link></div>}
        {guilds.length > 0 && <div className="guild-list" aria-label="Servers you can manage">{guilds.map((guild) => <article className="guild-row" key={guild.id}><GuildIcon icon={guild.icon} id={guild.id} name={guild.name} /><div className="guild-identity"><h2>{guild.name}</h2><span>SERVER ID / {guild.id}</span></div><span className={`bot-status${guild.botInstalled ? " bot-status--installed" : ""}${!guild.botStatusKnown ? " bot-status--unknown" : ""}`}><i></i>{guild.botInstalled ? (guild.botOnline ? "BOT ONLINE" : guild.botDegraded ? "SYNC DEGRADED" : "BOT INSTALLED · OFFLINE") : guild.botStatusKnown ? "BOT NOT INSTALLED" : "STATUS UNKNOWN"}</span>{guild.botInstalled ? <Link className="guild-action" href={`/dashboard/${guild.id}`}>Configure <span>↗</span></Link> : guild.botStatusKnown ? <Link className="guild-action guild-action--add" href={`/api/discord/invite?guild_id=${guild.id}`}>Add bot <span>↗</span></Link> : <Link className="guild-action" href="/docs">Check setup <span>↗</span></Link>}</article>)}</div>}
        <div className="guild-footnote"><span>ACCESS CHECKED AGAIN ON EVERY SERVER REQUEST.</span><Link href="/docs">Read the integration guide <span>↗</span></Link></div>
      </main>
    </div>
  );
}
