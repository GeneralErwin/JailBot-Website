import { z } from "zod";

export const snowflakeSchema = z.string().regex(/^\d{17,20}$/, "Expected a Discord snowflake");
export const QUARANTINE_MODULES = [
  "dangerous_role_add",
  "dangerous_role_remove",
  "role_permission_escalation",
  "channel_permission_escalation",
  "jailed_role_changes",
  "channel_deletion",
  "webhook_raid"
] as const;

export const guildConfigSchema = z.object({
  prisonerRoleId: snowflakeSchema.nullable(),
  moderatorRoleId: snowflakeSchema.nullable(),
  jailChannelId: snowflakeSchema.nullable(),
  logsChannelId: snowflakeSchema.nullable(),
  autoReleaseEnabled: z.boolean(),
  quarantineEnabled: z.boolean(),
  quarantineModules: z.object({
    dangerous_role_add: z.boolean(),
    dangerous_role_remove: z.boolean(),
    role_permission_escalation: z.boolean(),
    channel_permission_escalation: z.boolean(),
    jailed_role_changes: z.boolean(),
    channel_deletion: z.boolean(),
    webhook_raid: z.boolean()
  }).strict()
}).strict();

export type GuildConfig = z.infer<typeof guildConfigSchema>;

export const emptyGuildConfig: GuildConfig = {
  prisonerRoleId: null,
  moderatorRoleId: null,
  jailChannelId: null,
  logsChannelId: null,
  autoReleaseEnabled: true,
  quarantineEnabled: false,
  quarantineModules: {
    dangerous_role_add: true,
    dangerous_role_remove: true,
    role_permission_escalation: true,
    channel_permission_escalation: true,
    jailed_role_changes: true,
    channel_deletion: true,
    webhook_raid: true
  }
};

export const botInventorySchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().uuid(),
  botVersion: z.string().max(80),
  fullSnapshot: z.boolean(),
  removedGuildIds: z.array(snowflakeSchema).max(2500).default([]),
  guilds: z.array(z.object({
    id: snowflakeSchema,
    name: z.string().min(1).max(100),
    icon: z.string().nullable().optional(),
    roles: z.array(z.object({ id: snowflakeSchema, name: z.string().min(1).max(100), position: z.number().int().nonnegative(), managed: z.boolean().default(false) })).max(500),
    channels: z.array(z.object({ id: snowflakeSchema, name: z.string().min(1).max(100), type: z.number().int(), parentId: snowflakeSchema.nullable().optional() })).max(500),
    config: guildConfigSchema,
    setupComplete: z.boolean().default(false),
    configRevision: z.number().int().nonnegative().default(0)
  })).max(2500)
}).strict();

export function validateConfigAgainstInventory(config: GuildConfig, inventory: { roles: { id: string }[]; channels: { id: string; type: number }[]; setupComplete?: boolean }) {
  const roleIds = new Set(inventory.roles.map((role) => role.id));
  const textChannelIds = new Set(inventory.channels.filter((channel) => channel.type === 0).map((channel) => channel.id));
  for (const [label, id] of [["Prisoner role", config.prisonerRoleId], ["Moderator role", config.moderatorRoleId]] as const) {
    if (id && !roleIds.has(id)) throw new Error(`${label} does not belong to this server`);
  }
  for (const [label, id] of [["Jail channel", config.jailChannelId], ["Log channel", config.logsChannelId]] as const) {
    if (id && !textChannelIds.has(id)) throw new Error(`${label} must be a text channel in this server`);
  }
  if (inventory.setupComplete && (!config.prisonerRoleId || !config.jailChannelId)) {
    throw new Error("A configured jail cannot be cleared from the website; use the bot's existing setup commands to manage jail roles and permissions safely");
  }
}
