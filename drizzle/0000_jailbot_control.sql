CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "global_name" text,
  "avatar" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text DEFAULT 'discord' NOT NULL,
  "provider_account_id" text NOT NULL,
  "access_token_encrypted" text NOT NULL,
  "refresh_token_encrypted" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "scope" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounts_provider_account_unique" UNIQUE("provider", "provider_account_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expiry_idx" ON "sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "guilds" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "icon" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bot_guilds" (
  "guild_id" text PRIMARY KEY NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "installed" boolean DEFAULT true NOT NULL,
  "bot_version" text NOT NULL,
  "roles" jsonb NOT NULL,
  "channels" jsonb NOT NULL,
  "setup_complete" boolean DEFAULT false NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bot_guilds_installed_idx" ON "bot_guilds" ("installed");

CREATE TABLE IF NOT EXISTS "guild_configurations" (
  "guild_id" text PRIMARY KEY NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "schema_version" integer DEFAULT 1 NOT NULL CHECK ("schema_version" = 1),
  "revision" integer DEFAULT 0 NOT NULL CHECK ("revision" >= 0),
  "config" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "configuration_revisions" (
  "sync_sequence" bigserial NOT NULL UNIQUE,
  "id" text PRIMARY KEY NOT NULL,
  "guild_id" text NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "schema_version" integer DEFAULT 1 NOT NULL CHECK ("schema_version" = 1),
  "revision" integer NOT NULL CHECK ("revision" >= 0),
  "source" text NOT NULL CHECK ("source" IN ('web', 'bot')),
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "configuration_revisions_guild_revision_unique" UNIQUE("guild_id", "revision")
);
CREATE INDEX IF NOT EXISTS "configuration_revisions_guild_created_idx" ON "configuration_revisions" ("guild_id", "created_at");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "guild_id" text NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "revision" integer NOT NULL,
  "before_config" jsonb,
  "after_config" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_logs_guild_created_idx" ON "audit_logs" ("guild_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("actor_user_id");

CREATE TABLE IF NOT EXISTS "bot_requests" (
  "key_id" text NOT NULL,
  "nonce" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bot_requests_pk" PRIMARY KEY("key_id", "nonce")
);
CREATE INDEX IF NOT EXISTS "bot_requests_created_idx" ON "bot_requests" ("created_at");

CREATE TABLE IF NOT EXISTS "bot_events" (
  "event_id" text PRIMARY KEY NOT NULL,
  "event_type" text NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bot_status" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL CHECK ("id" = 1),
  "bot_version" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('online', 'degraded')),
  "last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_inventory_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key_hash" text PRIMARY KEY NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "rate_limits_updated_idx" ON "rate_limits" ("updated_at");
