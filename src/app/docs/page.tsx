import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export const metadata = {
  title: "Integration guide",
  description: "Set up the signed API connection between the Jailbot website and Rust bot."
};

const endpoints = [
  ["POST", "/api/internal/bot/inventory", "Publish the installed guilds, roles, channels and current config."],
  ["POST", "/api/internal/bot/heartbeat", "Report bot version and online or degraded status."],
  ["GET", "/api/internal/bot/configs?after={sequence}&limit=100", "Poll versioned website changes with a durable cursor."],
  ["POST", "/api/internal/bot/guilds/{guildId}/config", "Publish bot command changes through the local outbox."]
];

export default function DocsPage() {
  return (
    <div className="docs-layout">
      <header className="dash-topbar">
        <Link className="wordmark" href="/"><BrandMark /><span>JAILBOT<span className="wordmark-dot">.</span></span></Link>
        <Link className="back-servers" href="/">Back to home <span aria-hidden="true">↗</span></Link>
      </header>
      <main className="docs-main page-frame">
        <p className="dash-kicker"><span className="eyebrow-dot"></span> IMPLEMENTATION NOTES / 01</p>
        <h1>Connect the Rust bot<br /><em>to the control plane.</em></h1>
        <p className="docs-intro">The website and bot remain separate processes. PostgreSQL stores website-managed settings; the Rust bot keeps its SQLite database and applies changes through its existing Discord services.</p>

        <div className="docs-callout">
          <b>STATUS / ADAPTER INCLUDED · RUNTIME KEYS REQUIRED</b>
          <p>The companion Rust project includes the matching adapter. Live synchronization starts after the website database, bot token and shared HMAC credentials are configured on both services.</p>
        </div>

        <section className="docs-section">
          <h2>API surface</h2>
          <div className="docs-endpoints">
            {endpoints.map(([method, path, description]) => (
              <article key={path}>
                <span className={`http-method http-method--${method.toLowerCase()}`}>{method}</span>
                <code>{path}</code>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <h2>Request authentication</h2>
          <p>Every bot request uses HMAC-SHA256 with a fresh Unix timestamp and UUID nonce. The signature covers the exact request path and query, timestamp, nonce and SHA-256 hash of the raw request body.</p>
          <pre>{`METHOD\nPATH_AND_QUERY\nTIMESTAMP\nNONCE\nSHA256_BODY_HEX`}</pre>
          <p>Send <code>X-Bot-Key-Id</code>, <code>X-Bot-Timestamp</code>, <code>X-Bot-Nonce</code> and <code>X-Bot-Signature</code>. Requests older than five minutes and reused nonces are rejected. Keep <code>DISCORD_TOKEN</code> separate from the HMAC secret.</p>
        </section>

        <section className="docs-section">
          <h2>Revision and conflict rules</h2>
          <ol>
            <li>After Gateway Ready, the bot publishes a complete installed-guild inventory. Role, channel and guild changes request a coalesced refresh.</li>
            <li>The website validates role and channel IDs against the latest inventory, then saves each guild config with an optimistic revision and an audit entry.</li>
            <li>The bot polls changes in global sequence order every five seconds. It validates the live Discord references and applies jail permissions before acknowledging the revision.</li>
            <li>Existing bot commands stay available. SQLite triggers maintain a durable per-guild outbox; revision conflicts merge independent fields and record true collisions.</li>
            <li>During a website outage, the bot continues with its local SQLite configuration and retries synchronization with backoff.</li>
          </ol>
        </section>

        <section className="docs-section">
          <h2>Local setup</h2>
          <ol>
            <li>Copy <code>.env.example</code> to <code>.env</code> and set Discord OAuth credentials and <code>APP_URL</code>.</li>
            <li>Start PostgreSQL and apply the checked-in migration with <code>npm run db:migrate</code>.</li>
            <li>Set the Discord OAuth redirect URI to <code>{"{APP_URL}"}/api/auth/callback</code>.</li>
            <li>Generate <code>TOKEN_ENCRYPTION_KEY</code> and a distinct random <code>BOT_API_SECRET</code>. Configure matching <code>CONTROL_PLANE_*</code> variables on the Rust service.</li>
            <li>Start the bot and confirm a recent signed inventory and heartbeat before saving a guild setting.</li>
          </ol>
          <p>Full request and recovery details are in the source repository&apos;s <code>docs/bot-api.md</code> and <code>docs/operations.md</code>.</p>
        </section>

        <section className="docs-section">
          <h2>Observed Rust configuration</h2>
          <div className="docs-config-grid">
            <span>Prisoner role</span><code>prisoner_role_id</code>
            <span>Moderator role</span><code>moderator_role_id</code>
            <span>Jail channel</span><code>jail_channel_id</code>
            <span>Log channel</span><code>logs_channel_id</code>
            <span>Automatic expiry release</span><code>auto_release_enabled</code>
            <span>Quarantine service</span><code>quarantine_enabled</code>
          </div>
          <p>The seven quarantine module keys match the current Rust service. <code>setup_complete</code> remains bot-managed.</p>
        </section>

        <div className="docs-footer">
          <Link className="button button--lime" href="/api/auth/discord">Open dashboard <span aria-hidden="true">↗</span></Link>
          <span>BOT PERMISSIONS / NO ADMINISTRATOR REQUESTED</span>
        </div>
      </main>
    </div>
  );
}
