import { bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { GuildConfig } from "@/lib/config";

const now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  globalName: text("global_name"),
  avatar: text("avatar"),
  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("discord"),
  providerAccountId: text("provider_account_id").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex("accounts_provider_account_unique").on(table.provider, table.providerAccountId)]);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: now()
}, (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)]);

export const guilds = pgTable("guilds", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const botGuilds = pgTable("bot_guilds", {
  guildId: text("guild_id").primaryKey().references(() => guilds.id, { onDelete: "cascade" }),
  installed: boolean("installed").notNull().default(true),
  botVersion: text("bot_version").notNull(),
  roles: jsonb("roles").notNull().$type<{ id: string; name: string; position: number; managed: boolean }[]>(),
  channels: jsonb("channels").notNull().$type<{ id: string; name: string; type: number; parentId: string | null }[]>(),
  setupComplete: boolean("setup_complete").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("bot_guilds_installed_idx").on(table.installed)]);

export const guildConfigurations = pgTable("guild_configurations", {
  guildId: text("guild_id").primaryKey().references(() => guilds.id, { onDelete: "cascade" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  revision: integer("revision").notNull().default(0),
  config: jsonb("config").notNull().$type<GuildConfig>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const configurationRevisions = pgTable("configuration_revisions", {
  syncSequence: bigserial("sync_sequence", { mode: "number" }).notNull().unique(),
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  schemaVersion: integer("schema_version").notNull().default(1),
  revision: integer("revision").notNull(),
  source: text("source").notNull(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  config: jsonb("config").notNull().$type<GuildConfig>(),
  createdAt: now()
}, (table) => [uniqueIndex("configuration_revisions_guild_revision_unique").on(table.guildId, table.revision), index("configuration_revisions_guild_created_idx").on(table.guildId, table.createdAt)]);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  revision: integer("revision").notNull(),
  beforeConfig: jsonb("before_config").$type<GuildConfig | null>(),
  afterConfig: jsonb("after_config").$type<GuildConfig>(),
  createdAt: now()
}, (table) => [index("audit_logs_guild_created_idx").on(table.guildId, table.createdAt), index("audit_logs_actor_idx").on(table.actorUserId)]);

export const botRequests = pgTable("bot_requests", {
  keyId: text("key_id").notNull(),
  nonce: text("nonce").notNull(),
  createdAt: now()
}, (table) => [primaryKey({ columns: [table.keyId, table.nonce], name: "bot_requests_pk" }), index("bot_requests_created_idx").on(table.createdAt)]);

export const botEvents = pgTable("bot_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: now()
});

export const botStatus = pgTable("bot_status", {
  id: integer("id").primaryKey().default(1),
  botVersion: text("bot_version").notNull(),
  status: text("status").notNull(),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
  lastInventoryAt: timestamp("last_inventory_at", { withTimezone: true })
});

export const rateLimits = pgTable("rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("rate_limits_updated_idx").on(table.updatedAt)]);

export const schema = { users, accounts, sessions, guilds, botGuilds, guildConfigurations, configurationRevisions, auditLogs, botRequests, botEvents, botStatus, rateLimits };
