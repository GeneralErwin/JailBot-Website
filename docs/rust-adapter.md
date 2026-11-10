# Rust bot adapter setup

The companion adapter lives in `G:\Projects\Rust Dev Files`. It is an optional worker inside the existing Rust process; it does not replace the bot's command, jail, quarantine, or SQLite implementation. Without valid control-plane variables, the bot starts and runs as before.

## Configure the Rust process

Set these server-side environment variables alongside the existing `DISCORD_TOKEN`:

```text
CONTROL_PLANE_URL=https://your-domain.example
CONTROL_PLANE_KEY_ID=production-2026
CONTROL_PLANE_SECRET=<base64 secret shared with the website>
```

Use the web app's `BOT_API_KEY_ID` as `CONTROL_PLANE_KEY_ID`, and its `BOT_API_SECRET` as `CONTROL_PLANE_SECRET`. `CONTROL_PLANE_URL` must be an HTTPS origin outside local development. For local testing, `http://localhost:3000` is accepted. Generate one base64 secret with at least 32 random bytes and configure it in both secret stores. Do not use `DISCORD_TOKEN` as the HMAC secret.

The website's `.env` needs the matching values:

```text
BOT_API_KEY_ID=production-2026
BOT_API_SECRET=<same base64 secret>
```

## Runtime behavior

- On Gateway Ready, the bot replaces its local installed-guild inventory from the Ready payload and publishes a full snapshot after Discord role/channel lookups succeed.
- Guild join, leave, metadata, role, and channel events request a coalesced inventory refresh. A complete snapshot is also sent every 15 minutes.
- A signed heartbeat runs every 60 seconds. Persistent sync errors are reported as `degraded`; the bot keeps using its SQLite configuration during website outages.
- Website config revisions are polled every five seconds in global sequence order. Role and channel changes are validated against Discord before they are applied. Jail permissions use the existing prisoner overwrite rules and reconciliation service.
- SQLite triggers queue existing command-side config updates. A one-row-per-guild outbox preserves changes through restarts and uses revision compare-and-set. Conflicting edits are merged by field, logged locally, and reported to the moderation log channel when available.
- Migration `0004_control_plane_sync.sql` is applied automatically by the bot's existing SQLx migration runner on startup. Back up the bot's SQLite database before upgrading a production instance.

## Deploy sequence

1. Apply the web PostgreSQL migrations and deploy the web app with `BOT_API_KEY_ID` and `BOT_API_SECRET`.
2. Back up the Rust bot's SQLite database, deploy the companion Rust source with the three `CONTROL_PLANE_*` variables, and let its startup migration run.
3. Confirm a fresh bot heartbeat, a recent full inventory, and a manageable guild showing `BOT ONLINE` in the dashboard.
4. Change one non-destructive setting and confirm the bot's acknowledged revision. Test a bot-command setting change and confirm it appears in the web audit trail.
5. Keep bot and website backups independent. Restore the website database and bot SQLite backup independently; the outbox and revision cursor allow the bot to catch up after recovery.

The source check verifies compilation only. Live OAuth, Discord API calls, PostgreSQL writes, HMAC credentials, role/channel changes, and moderation-log delivery require configured external credentials and a running Discord bot.
