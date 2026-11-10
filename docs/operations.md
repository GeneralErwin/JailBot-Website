# Operations and deployment

## Vercel and Cloudflare

Use a Vercel project rooted at this repository with Node.js 24. Configure every server variable from `.env.example` in the Vercel project settings. Keep `DISCORD_CLIENT_SECRET`, `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, and `BOT_API_SECRET` server-only; do not prefix them with `NEXT_PUBLIC_`. Use a managed PostgreSQL service with TLS and connection pooling suited to serverless workloads.

Point the Cloudflare DNS record at Vercel and use Full (strict) TLS. Enable managed WAF rules and DDoS protection. Do not cache `/api/*`, `/dashboard/*`, `/login`, or responses carrying `Set-Cookie`. Configure an edge rate limit for `/api/auth/discord` and `/api/internal/bot/*` in addition to the database-backed application limits. The app's CSP and security headers are defined in `next.config.ts`.

Set the OAuth callback URL to `https://your-domain.example/api/auth/callback`. Run `npm run db:migrate` from a controlled release job before shifting traffic to code that expects the migration. CI builds the project but does not deploy or apply production migrations.

## Local Docker

`docker compose up -d db` starts local PostgreSQL. For the containerized app, create a local `.env` with all required settings and run `docker compose up --build`. The Compose database password is local development only. Do not reuse it outside a developer machine.

## Environment variables

| Variable | Purpose | Secret |
| --- | --- | --- |
| `APP_URL` | Canonical public origin and OAuth callback base | No |
| `DISCORD_CLIENT_ID` | OAuth and bot invitation application ID | No |
| `DISCORD_CLIENT_SECRET` | Discord OAuth code exchange | Yes |
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for OAuth token fields | Yes |
| `BOT_API_KEY_ID` | HMAC key identifier | No |
| `BOT_API_SECRET` | HMAC secret shared with Rust adapter | Yes |
| `SENTRY_DSN` | Optional server error reporting | Treat as configuration |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Optional OTLP trace receiver | Usually internal |

The Rust process uses `CONTROL_PLANE_URL` (the web origin), `CONTROL_PLANE_KEY_ID` (the matching `BOT_API_KEY_ID`), and `CONTROL_PLANE_SECRET` (the matching `BOT_API_SECRET`) in addition to its existing `DISCORD_TOKEN`. The adapter is disabled when `CONTROL_PLANE_URL` is absent. See [the Rust adapter setup](rust-adapter.md).

## Backups and recovery

Use the managed provider's encrypted, point-in-time PostgreSQL backups. Back up the token encryption key separately in a secrets manager; without it, stored Discord tokens cannot be refreshed after restore. Keep the Rust bot's own SQLite backup and restore process independent from the website database.

For a manual logical backup, run `pg_dump --format=custom --no-owner "$DATABASE_URL" --file jailbot-control.dump` in a secured operator environment. Restore into a new database first with `pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" jailbot-control.dump`, then verify the `users`, `guild_configurations`, `configuration_revisions`, and `audit_logs` counts before switching application traffic. Do not paste credentials into command history or CI logs.

`GET /api/health` returns database connectivity and recent heartbeat status without exposing credentials. A degraded bot status does not stop the public landing page; dashboards show whether installation or synchronization state is unknown.
