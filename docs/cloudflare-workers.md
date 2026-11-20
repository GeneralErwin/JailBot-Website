# Cloudflare Workers deployment

The management app is full-stack: it needs server-rendered dashboard routes, OAuth callbacks, API handlers, and PostgreSQL. Deploy it as one Cloudflare Worker with [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Cloudflare Pages is for static Next.js exports; do not use Pages for this app's authenticated dashboard or API.

## Prerequisites

- A Cloudflare account and a domain on Cloudflare if using a custom domain.
- Node.js `22.23+` (22.x), `24.22+` (24.x), or `26.12+` (26.x).
- A managed PostgreSQL database reachable from Cloudflare Hyperdrive.
- A Discord application with its bot already configured.

## Create the database binding

Create a Hyperdrive configuration for the PostgreSQL database. The database connection string is entered in Cloudflare, not committed to this repository. Copy the resulting Hyperdrive ID and add it to `wrangler.jsonc`:

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<your-hyperdrive-id>" }]
```

The ID is configuration, not a secret. At runtime the Worker prefers the `HYPERDRIVE` binding and falls back to a `DATABASE_URL` secret, so the Hyperdrive entry can be added before or after the first deploy.

For local Worker runtime testing, copy `.dev.vars.example` to `.dev.vars` and set its values. `.dev.vars` is ignored by Git. `npm run dev` still starts the regular Next.js development server using `.env`.

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

2. Authenticate wrangler locally with `npx wrangler login`, then build and deploy:

   ```text
   npm run cf:types
   npm run typecheck
   npm run deploy
   ```

   `npm run deploy` runs `opennextjs-cloudflare build` and then `opennextjs-cloudflare deploy` (a wrapper around `npx wrangler deploy`). `open-next.config.ts` pins the inner build command to `next build`, and `npm run build` is the OpenNext build, so the two cannot recurse. The build output lands in `.open-next/`, which is ignored by Git.

   For unattended deployments, `.github/workflows/deploy.yml` builds once with `npx opennextjs-cloudflare build`, validates the bundle with `npx wrangler deploy --dry-run` on pull requests, and uploads on pushes to `main`. It authenticates with the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets, so no browser session is involved. The workflow checks both secrets before building and reports any missing name immediately.

3. Add your custom domain in the Worker settings. Set `APP_URL` to that HTTPS origin and ensure the Discord redirect URI matches it exactly. Redeploy after changing Worker variables or secrets.

4. Check `https://your-domain.example/api/health`. PostgreSQL should report `ok`; bot status will remain offline/degraded until the Rust adapter sends a heartbeat.

The project uses no shared response cache for authenticated routes. The static assets are served by the Worker asset binding. If later adding caching, keep `/api/*`, `/dashboard/*`, `/login`, and all `Set-Cookie` responses private.

## Workers Builds (Git integration)

If the repository is connected in the Cloudflare dashboard instead of deployed by GitHub Actions, the default commands already work because `wrangler.jsonc` points at the OpenNext output:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --keep-vars` |
| Root directory | *(empty)* |

`npm run build` regenerates Worker types and builds both the Next.js app and the OpenNext Worker, so the deploy command finds `.open-next/worker.js` on the first run. `--keep-vars` preserves dashboard variables and secrets across deploys. Workers Builds injects `CI=true`, `WORKERS_CI=1` and an API token automatically, so no `CLOUDFLARE_API_TOKEN` build variable is required. If wrangler reports that more than one account is available, add `CLOUDFLARE_ACCOUNT_ID` as a build variable.

Keep runtime values (`APP_URL`, Discord credentials, `TOKEN_ENCRYPTION_KEY`, `BOT_API_SECRET`, `BOT_API_KEY_ID`, optional `DATABASE_URL`) in **Settings → Variables and Secrets**; build variables are not available at runtime.

## Database connections

Workers cannot reuse an I/O object across requests, so `src/lib/db/index.ts` builds the `pg` pool per request with React `cache()` and `maxUses: 1`. Hyperdrive does the real connection pooling in front of PostgreSQL. Do not reintroduce a module-level or global pool.

## Connect the bot

On the Rust bot host, keep `DISCORD_TOKEN` there and set:

```text
CONTROL_PLANE_URL=https://your-domain.example
CONTROL_PLANE_KEY_ID=<same as BOT_API_KEY_ID>
CONTROL_PLANE_SECRET=<same as BOT_API_SECRET>
```

Back up the bot SQLite file before deploying the Rust adapter. Restart the bot and wait for its heartbeat and full guild inventory. Then log in to the website with Discord, select a server you own or can manage, and save a non-destructive setting to confirm it is acknowledged by the bot.

See [the API contract](bot-api.md) and [the Rust adapter guide](rust-adapter.md) for sync behavior and recovery steps.
