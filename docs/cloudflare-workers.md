# Cloudflare Workers deployment

The management app is full-stack: it needs server-rendered dashboard routes, OAuth callbacks, API handlers, and PostgreSQL. Deploy it as one Cloudflare Worker with vinext. Cloudflare Pages is for static Next.js exports; do not use Pages for this app's authenticated dashboard or API.

## Prerequisites

- A Cloudflare account and a domain on Cloudflare if using a custom domain.
- Node.js `22.23+` or `24.22+` for the current Cloudflare CLI dependency.
- A managed PostgreSQL database reachable from Cloudflare Hyperdrive.
- A Discord application with its bot already configured.

## Create the database binding

Create a Hyperdrive configuration for the PostgreSQL database. The database connection string is entered in Cloudflare, not committed to this repository. Copy the resulting Hyperdrive ID. Set `HYPERDRIVE_ID` in the shell that runs the build/deploy command or add it to `cloudflare.config.ts`; the ID is configuration, not a secret.

`cloudflare.config.ts` binds this resource as `HYPERDRIVE`. In the Worker, the Drizzle connection uses Hyperdrive's runtime connection string. A `DATABASE_URL` Worker secret can be used as a direct connection fallback, but Hyperdrive is preferred for Worker-to-PostgreSQL pooling.

For local Worker runtime testing, copy `.dev.vars.example` to `.dev.vars` and set its values. `.dev.vars` is ignored by Git. The existing `npm run dev` still starts the regular Next.js development server using `.env`.

## Configure Worker variables and secrets

Set Worker variables in Cloudflare under **Workers & Pages → jailbot-website → Settings → Variables and Secrets**:

| Name | Value |
| --- | --- |
| `APP_URL` | Public HTTPS origin, with no trailing slash |
| `DISCORD_CLIENT_ID` | Discord application ID |
| `BOT_API_KEY_ID` | Public machine key identifier, also used by the bot |
| `DATABASE_URL` | Optional direct database fallback; omit when using Hyperdrive |
| `SENTRY_DSN` | Optional |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Optional |

Add these as encrypted Worker secrets:

- `DISCORD_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY` — base64-encoded, exactly 32 random bytes
- `BOT_API_SECRET` — separate base64-encoded random secret of at least 32 bytes; share this exact value with the Rust bot as `CONTROL_PLANE_SECRET`

Register the exact Discord OAuth redirect URI `https://your-domain.example/api/auth/callback`. Keep OAuth secrets and database credentials out of source control and browser-visible variables.

## Deploy

1. Apply the PostgreSQL schema from a secure release environment where `DATABASE_URL` is set:

   ```text
   npm ci
   npm run db:migrate
   ```

2. Authenticate the local Cloudflare CLI with `npx cf auth login`, then generate Worker types and deploy:

   ```text
   npm run cf:types
   npm run typecheck
   npm run deploy:vinext
   ```

   The deployment command builds the Worker and uploads it to Cloudflare. The generated assets/build output stays ignored by Git.

3. Add your custom domain in the Worker settings. Set `APP_URL` to that HTTPS origin and ensure the Discord redirect URI matches it exactly. Redeploy after changing Worker variables or secrets.

4. Check `https://your-domain.example/api/health`. PostgreSQL should report `ok`; bot status will remain offline/degraded until the Rust adapter sends a heartbeat.

The project uses no shared response cache for authenticated routes. The static assets are served by the Worker asset binding. If later adding caching, keep `/api/*`, `/dashboard/*`, `/login`, and all `Set-Cookie` responses private.

## Connect the bot

On the Rust bot host, keep `DISCORD_TOKEN` there and set:

```text
CONTROL_PLANE_URL=https://your-domain.example
CONTROL_PLANE_KEY_ID=<same as BOT_API_KEY_ID>
CONTROL_PLANE_SECRET=<same as BOT_API_SECRET>
```

Back up the bot SQLite file before deploying the Rust adapter. Restart the bot and wait for its heartbeat and full guild inventory. Then log in to the website with Discord, select a server you own or can manage, and save a non-destructive setting to confirm it is acknowledged by the bot.

See [the API contract](bot-api.md) and [the Rust adapter guide](rust-adapter.md) for sync behavior and recovery steps.
