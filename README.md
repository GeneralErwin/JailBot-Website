# Jailbot Control

A standalone Next.js control plane for the existing Rust Discord Jailbot. The public site, Discord sign-in, guild selection, configuration editor, PostgreSQL store, audit trail, and signed bot API live here. The bot remains a separate Rust process with its existing SQLite database and Discord gateway.

The code only exposes settings found in the Rust source: Prisoner and moderator roles; jail and log channels; automatic sentence expiry; quarantine service state; and the seven existing quarantine modules. `setup_complete` remains bot-managed. The website never connects to the bot's SQLite file.

## Local development

Requirements: Node.js 22.23+ (22.x), 24.22+ (24.x), or 26.12+ (26.x), npm, and Docker for the local PostgreSQL service. Wrangler requires these supported Node release lines.

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
npm run cf:types     Regenerate Cloudflare Worker types (cloudflare-env.d.ts)
npm run build        Build the Cloudflare Worker bundle in .open-next/
npm run preview      Build and run the Worker locally in workerd
npm run deploy       Build and deploy the Worker to Cloudflare
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

The full dashboard runs on Cloudflare Workers with [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Cloudflare Pages cannot host it: the app needs server rendering, OAuth callbacks, API routes, and PostgreSQL.

`npm run build` runs `next build` and then the OpenNext bundler, producing `.open-next/worker.js` and `.open-next/assets`. `wrangler.jsonc` points at that output, so the standard `npx wrangler deploy` works from a workstation and from Cloudflare Workers Builds connected to this repository. No custom build or deploy commands are required.

Use Cloudflare Hyperdrive to connect the Worker to managed PostgreSQL. Create the Hyperdrive configuration and add its ID to `wrangler.jsonc`:

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<your-hyperdrive-id>" }]
```

The ID is configuration, not a secret. The runtime prefers the `HYPERDRIVE` binding and falls back to a `DATABASE_URL` Worker secret. Set `APP_URL`, `DISCORD_CLIENT_ID`, `BOT_API_KEY_ID`, `DISCORD_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `BOT_API_SECRET` in the Worker environment; keep secrets encrypted and server-side.

Register `https://your-domain.example/api/auth/callback` as the Discord OAuth redirect URI. Apply the PostgreSQL migration from a controlled release environment before using the dashboard. CI checks the Next.js build and the OpenNext Worker build.

### Continuous deployment

`.github/workflows/deploy.yml` builds the Worker with `npx opennextjs-cloudflare build` and validates it with `npx wrangler deploy --dry-run` on every pull request, then deploys on pushes to `main`. Configure these repository secrets:

- `CLOUDFLARE_API_TOKEN` — API token with Cloudflare Workers Scripts: Edit and the permissions the Worker bindings need.
- `CLOUDFLARE_ACCOUNT_ID` — selects the account when the token can access more than one.

The workflow now checks both secrets before installing or building, so a missing secret fails immediately with the exact name that is absent. For a manual deploy from a workstation, run `npx wrangler login` once, then `npm run deploy`.

### Connecting the repository in the Cloudflare dashboard

Cloudflare Workers Builds runs a build command and then a deploy command, and the defaults already match this project:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --keep-vars` |
| Root directory | *(empty)* |

`--keep-vars` preserves variables and secrets set in the dashboard instead of replacing them on each deploy. Workers Builds supplies its own API token, so no `CLOUDFLARE_API_TOKEN` build variable is needed there. If `wrangler` reports that several accounts are available, add `CLOUDFLARE_ACCOUNT_ID` as a build variable. Runtime values such as `APP_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `BOT_API_KEY_ID`, `BOT_API_SECRET` and the optional `DATABASE_URL` belong in **Settings → Variables and Secrets**, not in build variables. Apply the PostgreSQL migration before the first request that touches the dashboard.

Configure `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` when those services are available. `/api/health` checks PostgreSQL and recent bot heartbeat state. Docker Compose remains available for local development and the Dockerfile for explicit self-hosting.

Before release, follow [the security review checklist](docs/security-review.md), configure managed database backups, and test the restore procedure.
