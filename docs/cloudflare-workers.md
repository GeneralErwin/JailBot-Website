# Cloudflare Workers deployment

The management app is full-stack: it needs server-rendered dashboard routes, OAuth callbacks, API handlers, and PostgreSQL. Deploy it as one Cloudflare Worker with vinext. Cloudflare Pages is for static Next.js exports; do not use Pages for this app's authenticated dashboard or API. Cloudflare currently lists vinext as beta, so validate authentication, private routes, and database operations in a staging Worker before using production data.

## Prerequisites

- A Cloudflare account and a domain on Cloudflare if using a custom domain.
- Node.js `22.23+` (22.x), `24.22+` (24.x), or `26.12+` (26.x) for the current Cloudflare CLI dependency.
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

   The deployment command builds the Worker and uploads it to Cloudflare. The generated assets/build output stays ignored by Git. The browser login is short-lived: if a deploy fails with an authentication error, run `npx cf auth login` again before retrying.

   For unattended deployments, `.github/workflows/deploy.yml` builds once with `cf build`, validates with `cf deploy --prebuilt --dry-run` on pull requests, and uploads on pushes to `main`. It authenticates with the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets, so no browser session is involved. Set the non-secret `HYPERDRIVE_ID` repository variable as well to include the binding at build time. See the README for the token permissions.

3. Add your custom domain in the Worker settings. Set `APP_URL` to that HTTPS origin and ensure the Discord redirect URI matches it exactly. Redeploy after changing Worker variables or secrets.

4. Check `https://your-domain.example/api/health`. PostgreSQL should report `ok`; bot status will remain offline/degraded until the Rust adapter sends a heartbeat.

The project uses no shared response cache for authenticated routes. The static assets are served by the Worker asset binding. If later adding caching, keep `/api/*`, `/dashboard/*`, `/login`, and all `Set-Cookie` responses private.

## Workers Builds (Git integration)

If the repository is connected in the Cloudflare dashboard instead of deployed by GitHub Actions, set the Worker's **Settings → Build** commands explicitly. The default deploy command `npx wrangler deploy` cannot be used: Wrangler detects the cf Build Output in `.cloudflare/output` and stops with *"It looks like you've run `wrangler deploy` in a project that builds for the Cloudflare CLI (`cf`)... Please run `cf deploy` instead."* Without that guard it would classify the repository as a new Next.js app, run `@opennextjs/cloudflare migrate`, and deploy an OpenNext build that ignores `cloudflare.config.ts`, the Hyperdrive binding and vinext.

Use one of these:

| Build command | Deploy command | Notes |
| --- | --- | --- |
| `npm run build` | `npx cf deploy --prebuilt --mode production` | Recommended with the default build command. `npm run build` runs `cf:types`, `next build` and `cf build`, so the Worker bundle is ready to upload. |
| `npx cf build` | `npx cf deploy --prebuilt --mode production` | Worker-only build; skips the standalone Next.js build. |
| `npm run build` (or empty) | `npx cf deploy` | `cf deploy` rebuilds the vinext Worker and uploads it in one step. |

`cf build` writes the Worker and assets to `.cloudflare/output`; `cf deploy --prebuilt` uploads exactly that build, so it must follow a build that ran `cf build`. The existing `npm run deploy:vinext` script also works as the deploy command: it builds the vinext Worker and uploads it with `cf`. `cf` is a pinned devDependency, so `npx cf` runs the version in `package-lock.json`. The optional preview command is `npx cf previews deploy`; leave the root directory empty.

`cloudflare.config.ts` is the source of truth for every cf deploy. Workers Builds injects `CI=true`, `WORKERS_CI=1` and an API token automatically, so no `CLOUDFLARE_API_TOKEN` secret is required. If `cf` reports that more than one account is available, add `CLOUDFLARE_ACCOUNT_ID` as a build variable. Add `HYPERDRIVE_ID` as a non-secret build variable under **Settings → Build → Variables and secrets**. Keep runtime values (`APP_URL`, Discord credentials, `TOKEN_ENCRYPTION_KEY`, `BOT_API_SECRET`, `BOT_API_KEY_ID`, optional `DATABASE_URL`) in **Settings → Variables and Secrets**; build variables are not available at runtime.

## Connect the bot

On the Rust bot host, keep `DISCORD_TOKEN` there and set:

```text
CONTROL_PLANE_URL=https://your-domain.example
CONTROL_PLANE_KEY_ID=<same as BOT_API_KEY_ID>
CONTROL_PLANE_SECRET=<same as BOT_API_SECRET>
```

Back up the bot SQLite file before deploying the Rust adapter. Restart the bot and wait for its heartbeat and full guild inventory. Then log in to the website with Discord, select a server you own or can manage, and save a non-destructive setting to confirm it is acknowledged by the bot.

See [the API contract](bot-api.md) and [the Rust adapter guide](rust-adapter.md) for sync behavior and recovery steps.
