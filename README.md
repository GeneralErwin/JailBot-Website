# Jailbot Control

A standalone Next.js control plane for the existing Rust Discord Jailbot. The public site, Discord sign-in, guild selection, configuration editor, PostgreSQL store, audit trail, and signed bot API live here. The bot remains a separate Rust process with its existing SQLite database and Discord gateway.

The code only exposes settings found in the Rust source: Prisoner and moderator roles; jail and log channels; automatic sentence expiry; quarantine service state; and the seven existing quarantine modules. `setup_complete` remains bot-managed. The website never connects to the bot's SQLite file.

## Local development

Requirements: Node.js 22.23+ (22.x), 24.22+ (24.x), or 26.12+ (26.x), npm, and Docker for the local PostgreSQL service. The Cloudflare CLI requires these supported Node release lines.

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm install
npm run cf:types
npm run db:migrate
npm run dev
```

Set `DATABASE_URL` in `.env` to `postgresql://jailbot:jailbot-local-only@localhost:5432/jailbot`. Local OAuth also requires a Discord application with `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`; set its redirect URI to `http://localhost:3000/api/auth/callback`. Without credentials, public pages still render and sign-in shows a setup message. OAuth credentials and Discord tokens are never sent to browser JavaScript.

Generate independent secrets (PowerShell with OpenSSL installed):

```powershell
openssl rand -base64 32
```

Use one output for `TOKEN_ENCRYPTION_KEY` and a different output for `BOT_API_SECRET`. The encryption key must decode to exactly 32 bytes. `BOT_API_KEY_ID` is a public identifier; the secret is shared only by the website and Rust service.

## Useful commands

```text
npm run dev          Start Next.js development server
npm run lint         Run ESLint
npm run typecheck    Run strict TypeScript check
npm test             Run Vitest unit tests
npm run test:e2e     Run Playwright in Chromium, Firefox and WebKit
npm run db:generate  Generate a Drizzle migration from schema changes
npm run db:migrate   Apply committed Drizzle migrations
npm run cf:types     Regenerate Cloudflare Worker types in .cloudflare/types
npm run build        Build the standalone production app
```

The checked-in migration is the initial PostgreSQL schema. Use `db:generate` for later schema changes and commit both the SQL and Drizzle metadata. Do not use `drizzle-kit push` against production.

## Discord integration

Configure the Discord OAuth app with scopes `identify guilds`. The bot invitation requests `bot applications.commands` and these verified permissions: Manage Roles, Manage Channels, Manage Nicknames, View Audit Log, Manage Webhooks, View Channel, Send Messages and Embed Links. It does not request Administrator. The permission list is derived from the current Rust command setup, moderation writes, log message creation, and quarantine service.

The web app:

- Uses OAuth state and PKCE, a random opaque session cookie, seven-day expiration, and encrypted OAuth tokens in PostgreSQL.
- Checks owner, Administrator, or Manage Server using `BigInt` permission parsing on every protected guild request.
- Stores configuration and revision history by Discord snowflake string. Saves use compare-and-set revisions and commit the new config plus audit log in one transaction.
- Checks selected role/channel IDs against the latest bot-reported guild inventory. Only standard text channels are accepted for the jail and log channels.
- Signs bot API requests with HMAC-SHA256, a timestamp, a one-use nonce, and the SHA-256 hash of the raw body. The API rejects stale timestamps and replayed nonces.

See [docs/bot-api.md](docs/bot-api.md) for the request contract and [docs/operations.md](docs/operations.md) for deployment and recovery.

## Bot adapter status

The matching Rust adapter is implemented in the sibling `Rust Dev Files` project at `G:\Projects\Rust Dev Files`. It keeps the bot's SQLite database authoritative for runtime behavior, publishes signed inventory and heartbeats, polls website revisions, and sends existing bot-command changes through a durable SQLite outbox. The website never accesses the bot database. The adapter stays disabled until its three `CONTROL_PLANE_*` variables are set; the dashboard reports saves as pending until the bot acknowledges them.

Configure and deploy both sides using [docs/rust-adapter.md](docs/rust-adapter.md), then follow [docs/bot-api.md](docs/bot-api.md) for the signed API contract. Cargo compilation has been checked; live synchronization still requires the production URL, HMAC secret, PostgreSQL database, and Discord credentials.

## Production deployment

The full dashboard runs on Cloudflare Workers using vinext. Cloudflare Pages supports static Next.js exports; this app needs server rendering, OAuth, API routes, and PostgreSQL, so Pages alone cannot host it. vinext is currently in beta, so complete the staging checks in [docs/cloudflare-workers.md](docs/cloudflare-workers.md) before sending production traffic.

Use Cloudflare Hyperdrive to connect the Worker to managed PostgreSQL. `cloudflare.config.ts` reads the non-secret `HYPERDRIVE_ID` at build/deploy time. At runtime the app prefers the `HYPERDRIVE` binding and accepts a `DATABASE_URL` Worker secret as a direct-connection fallback. Set `APP_URL`, `DISCORD_CLIENT_ID`, `BOT_API_KEY_ID`, `DISCORD_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `BOT_API_SECRET` in the Worker environment; keep secrets encrypted and server-side.

Register `https://your-domain.example/api/auth/callback` as the Discord OAuth redirect URI. Apply the PostgreSQL migration from a controlled release environment before using the dashboard. CI checks the standard Next build and the Cloudflare Worker build.

### Continuous deployment

`.github/workflows/deploy.yml` builds the Worker once with `cf build` and validates it with `cf deploy --prebuilt --dry-run` on every pull request, then deploys the same build on pushes to `main`. Configure these repository secrets so the deploy step can authenticate without a browser login:

- `CLOUDFLARE_API_TOKEN` — API token with Cloudflare Workers Scripts: Edit and the permissions the Worker bindings need.
- `CLOUDFLARE_ACCOUNT_ID` — selects the account when the token can access more than one.

Add the non-secret `HYPERDRIVE_ID` repository variable so the build includes the Hyperdrive binding. For a manual deploy from a workstation, run `npx cf auth login` first and repeat it when the browser session expires, then `npm run deploy:vinext`.

### Connecting the repository in the Cloudflare dashboard

Workers Builds runs a build command and then a deploy command. This project deploys with the Cloudflare CLI (`cf`), so the deploy command must be changed: the default `npx wrangler deploy` refuses to deploy a `cf` project with the error *"It looks like you've run `wrangler deploy` in a project that builds for the Cloudflare CLI (`cf`)... Please run `cf deploy` instead."* Wrangler would otherwise treat the repository as a new Next.js project and try to deploy an OpenNext build that ignores `cloudflare.config.ts`, the Hyperdrive binding and vinext.

Open the Worker's **Settings → Build** and use one of these:

| Build command | Deploy command | Notes |
| --- | --- | --- |
| `npm run build` | `npx cf deploy --prebuilt --mode production` | Recommended with the default build command. `npm run build` runs `cf:types`, `next build` and `cf build`, so the Worker bundle is ready to upload. |
| `npx cf build` | `npx cf deploy --prebuilt --mode production` | Worker-only build; skips the standalone Next.js build. |
| `npm run build` (or empty) | `npx cf deploy` | `cf deploy` rebuilds the vinext Worker and uploads it in one step. |

`cf build` writes the Worker and its assets to `.cloudflare/output`; `cf deploy --prebuilt` uploads exactly that build, so it must follow a build that ran `cf build`. The existing `npm run deploy:vinext` script also works as the deploy command: it builds the vinext Worker and uploads it with `cf`. `cf` is a pinned devDependency, so `npx cf` uses the version in `package-lock.json`. The optional preview command is `npx cf previews deploy`; leave the root directory empty.

`cloudflare.config.ts` is the source of truth for every cf deploy. Workers Builds injects `CI=true`, `WORKERS_CI=1` and an API token, so no `CLOUDFLARE_API_TOKEN` secret is needed there. If `cf` reports that more than one account is available, add `CLOUDFLARE_ACCOUNT_ID` as a build variable. Add `HYPERDRIVE_ID` as a non-secret build variable under **Settings → Build → Variables and secrets** so the Hyperdrive binding is included at build time. Runtime values such as `APP_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `BOT_API_KEY_ID`, `BOT_API_SECRET` and the optional `DATABASE_URL` belong in **Settings → Variables and Secrets**, not in build variables. Apply the PostgreSQL migration before the first request that touches the dashboard.

Configure `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` when those services are available. `/api/health` checks PostgreSQL and recent bot heartbeat state. Docker Compose remains available for local development and the Dockerfile for explicit self-hosting.

Before release, follow [the security review checklist](docs/security-review.md), configure managed database backups, and test the restore procedure.
