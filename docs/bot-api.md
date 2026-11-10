# Bot API contract — schema version 1

The web control plane and Rust bot are separate processes. The website owns PostgreSQL; the bot owns its SQLite database and Discord gateway. Neither service connects to the other's database, and the Discord bot token is never sent to the website.

The website reads `BOT_API_KEY_ID` and base64 `BOT_API_SECRET`. The Rust adapter reads the same values as `CONTROL_PLANE_KEY_ID` and `CONTROL_PLANE_SECRET`, plus `CONTROL_PLANE_URL`. Use HTTPS outside local development. Generate a fresh, shared secret of at least 32 bytes and do not reuse OAuth or Discord bot credentials.

## HMAC authentication

Sign every request, including GET requests, with a fresh timestamp in Unix seconds, UUID nonce, and the SHA-256 hash of the exact UTF-8 request body (the empty string for GET). Preserve the exact path and query string in this canonical text:

```text
METHOD\nPATH_AND_QUERY\nTIMESTAMP\nNONCE\nSHA256_BODY_HEX
```

Compute HMAC-SHA256 with the base64-decoded secret and send the lowercase hex signature with `X-Bot-Key-Id`, `X-Bot-Timestamp`, `X-Bot-Nonce`, and `X-Bot-Signature`. The website rejects requests older than five minutes and stores each nonce to prevent replay. The Rust client uses a 25-second request timeout and retries transport failures, HTTP 429, and 5xx responses with exponential backoff and jitter. Retries use a new timestamp and nonce; event IDs in request bodies remain stable for idempotency.

## Installed guild inventory

`POST /api/internal/bot/inventory` publishes a complete snapshot after Gateway Ready and guild, role, or channel changes. The bot refreshes it every 15 minutes as a repair path. It publishes only after all Discord lookups succeed; an incomplete snapshot must never mark omitted servers as removed.

```json
{
  "schemaVersion": 1,
  "eventId": "d9fd1ae9-07b0-41dd-9bc0-58d30d7f920e",
  "botVersion": "0.1.0",
  "fullSnapshot": true,
  "removedGuildIds": [],
  "guilds": [{
    "id": "123456789012345678",
    "name": "Example",
    "icon": null,
    "roles": [{ "id": "223456789012345678", "name": "Prisoner", "position": 2, "managed": false }],
    "channels": [{ "id": "323456789012345678", "name": "jail", "type": 0, "parentId": null }],
    "setupComplete": false,
    "configRevision": 0,
    "config": {
      "prisonerRoleId": null,
      "moderatorRoleId": null,
      "jailChannelId": null,
      "logsChannelId": null,
      "autoReleaseEnabled": true,
      "quarantineEnabled": false,
      "quarantineModules": {
        "dangerous_role_add": true,
        "dangerous_role_remove": true,
        "role_permission_escalation": true,
        "channel_permission_escalation": true,
        "jailed_role_changes": true,
        "channel_deletion": true,
        "webhook_raid": true
      }
    }
  }]
}
```

`fullSnapshot: true` means the server marks previously installed guilds omitted from `guilds` as removed. `removedGuildIds` is available for incremental inventory events; the current Rust adapter sends complete snapshots. An `eventId` is idempotent. Role/channel IDs are decimal snowflake strings. Discord channel type `0` is a standard guild text channel. Do not include member data or bot tokens.

The inventory initializes a website config only if no website config exists yet; it does not overwrite website-managed revisions. Heartbeat and inventory freshness are tracked separately.

## Heartbeat

`POST /api/internal/bot/heartbeat` runs once per minute. The site considers the bot live after a heartbeat in the last three minutes. Persistent synchronization errors set status to `degraded`.

```json
{ "eventId": "d9fd1ae9-07b0-41dd-9bc0-58d30d7f920e", "version": "0.1.0", "status": "online" }
```

## Read website changes

`GET /api/internal/bot/configs?after={sequence}&limit=100` returns control-plane changes after the bot's durable global sequence cursor:

```json
{
  "events": [{
    "sequence": 12,
    "guildId": "123456789012345678",
    "schemaVersion": 1,
    "revision": 4,
    "config": { "...": "complete schema-v1 config" },
    "source": "website",
    "createdAt": "2026-11-10T12:00:00.000Z"
  }],
  "nextSequence": 12,
  "hasMore": false
}
```

Poll at a modest interval (the Rust adapter polls every five seconds). Process events in sequence order. Validate the schema and live Discord role/channel references, apply the SQLite snapshot and required Discord side effects, then commit the applied revision and sequence cursor. On a failure, leave the cursor before that event so it can be retried. Configuration remains cached in SQLite if the website is temporarily unavailable.

`GET /api/internal/bot/guilds/{guildId}/config?after={revision}` is also available for operational inspection or a single-guild resync. An unchanged revision returns `{ "unchanged": true, "revision": N }`. A changed revision returns `schemaVersion`, `guildId`, `revision`, `config`, and `updatedAt`. A `404` means the guild is not installed or has no initial configuration; `409` means the supplied revision is ahead of the website.

## Publish bot-side changes

`POST /api/internal/bot/guilds/{guildId}/config` publishes slash-command changes from the durable SQLite outbox:

```json
{ "schemaVersion": 1, "expectedRevision": 4, "config": { "...": "the complete schema-v1 config" } }
```

The response returns the accepted `revision` and `config`. A `409` returns the winning `revision` and `config`. The bot merges changes field-by-field using the outbox's base snapshot: disjoint edits survive, while a true same-field collision resolves to the website value and is recorded in SQLite audit data and the configured moderation log. Never silently discard a local edit or apply an older revision.

SQLite triggers keep one coalesced outbox row per guild for changes made through existing bot commands. They preserve the last acknowledged base revision and survive restarts. A failed website request does not disable the bot's local command or moderation behavior.

## Responses and validation

Errors use stable HTTP status codes: `400` malformed cursor or JSON, `401` invalid signature or timestamp, `409` replay or revision conflict, `404` unknown/uninstalled guild, `422` invalid data, `429` rate limit, and `5xx` temporary server/database failure. Retry 429 after `Retry-After`; retry 5xx with backoff. The website validates every config with Zod, checks selected IDs against the latest bot inventory, and rechecks user guild authorization on every protected request.
