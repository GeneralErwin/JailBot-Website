export const DISCORD_ADMINISTRATOR = 1n << 3n;
export const DISCORD_MANAGE_GUILD = 1n << 5n;
const GUILD_MANAGEMENT = DISCORD_ADMINISTRATOR | DISCORD_MANAGE_GUILD;

export function canManageGuild(owner: boolean, permissions: string | bigint): boolean {
  if (owner) return true;
  try {
    const bits = typeof permissions === "bigint" ? permissions : BigInt(permissions);
    return (bits & GUILD_MANAGEMENT) !== 0n;
  } catch {
    return false;
  }
}

// Verified from the existing Rust bot's permission checks and README setup:
// Manage Channels, Manage Roles, View Audit Log, Manage Nicknames, Manage Webhooks,
// View Channel, Send Messages and Embed Links. No Administrator grant is requested.
export const BOT_PERMISSION_BITS =
  (1n << 4n) | (1n << 28n) | (1n << 7n) | (1n << 27n) | (1n << 29n) |
  (1n << 10n) | (1n << 11n) | (1n << 14n);

export function getBotPermissionString(): string {
  return BOT_PERMISSION_BITS.toString(10);
}
