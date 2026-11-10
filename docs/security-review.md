# Security review checklist

Use this checklist before a production release and after changes to authentication, guild authorization, bot sync, or configuration storage. The design references OWASP ASVS; deployment-specific verification still needs to be run against the chosen host and domain.

- [ ] Force HTTPS at Cloudflare and Vercel; production `APP_URL` uses `https://`.
- [ ] Discord OAuth redirect URI exactly matches `APP_URL/api/auth/callback`; scopes remain `identify guilds`.
- [ ] State and PKCE verifier cookies are HTTP-only, SameSite Lax, short-lived and cleared after callback.
- [ ] Session cookie is HTTP-only, secure in production, SameSite Lax, random, opaque, and expires after seven days; database stores only its SHA-256 hash.
- [ ] OAuth access/refresh tokens are AES-256-GCM encrypted at rest; encryption key is unique, backed up securely, and not in application logs.
- [ ] Every dashboard and API guild operation checks current Discord guild access and owner/Admin/Manage Server permissions server-side with `BigInt`.
- [ ] Snowflakes remain decimal strings; no permission or ID is converted to JavaScript `Number`.
- [ ] Configuration schema rejects unknown keys and validates role/channel IDs against the signed, guild-scoped bot inventory.
- [ ] PostgreSQL queries use Drizzle parameter binding; guild IDs are included in every config/audit lookup and update.
- [ ] Revision compare-and-set and audit insertion occur in one database transaction.
- [ ] Bot API secrets differ from Discord bot tokens; HMAC covers method, exact path/query, timestamp, nonce and raw-body hash.
- [ ] Bot timestamps are checked; nonces are unique and replayed requests are rejected; transport uses TLS.
- [ ] Bot integration validates remote configs, caches the last known-good revision, uses bounded retries, and does not log secrets.
- [ ] CSP, frame, referrer, content-type and permissions headers are present; no wildcard CORS is enabled.
- [ ] OAuth initiation and configuration writes are rate limited; edge WAF limits are enabled for production.
- [ ] Sentry `sendDefaultPii` stays disabled; telemetry exporter receives only the approved trace data.
- [ ] `npm audit`, lint, TypeScript, unit, and Playwright jobs pass; dependency updates are reviewed.
- [ ] PostgreSQL backups are encrypted, retention is defined, and a restore has been tested.
- [ ] Error and audit logs contain request IDs, guild IDs where useful, actor attribution in the database, and no OAuth/bot credentials.
