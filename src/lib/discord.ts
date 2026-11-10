import { cookies } from "next/headers";
import { and, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { decryptSecret, encryptSecret, hashValue } from "@/lib/crypto";
import { canManageGuild } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { accounts, botGuilds, botStatus, sessions, users } from "@/lib/db/schema";

const DISCORD_API = "https://discord.com/api/v10";
const discordUserSchema = z.object({ id: z.string().regex(/^\d{17,20}$/), username: z.string().min(1).max(100), global_name: z.string().max(100).nullable().optional(), avatar: z.string().nullable().optional() });
const tokenResponseSchema = z.object({ access_token: z.string(), refresh_token: z.string(), expires_in: z.number().positive(), scope: z.string() });
const discordGuildSchema = z.object({ id: z.string().regex(/^\d{17,20}$/), name: z.string().min(1).max(100), icon: z.string().nullable().optional(), owner: z.boolean().default(false), permissions: z.string().regex(/^\d+$/) });

export type DiscordGuild = z.infer<typeof discordGuildSchema>;
export type ManagedDiscordGuild = DiscordGuild & { canManage: true; botInstalled: boolean; botStatusKnown: boolean; botOnline: boolean; botDegraded: boolean; botSeenAt: Date | null };

export class DiscordApiError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); }
}

async function discordJson<T>(url: string, accessToken: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new DiscordApiError(response.status === 401 ? "Discord authorization expired" : "Could not retrieve Discord account data", response.status === 401 ? 401 : 502);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new DiscordApiError("Discord returned an unexpected response");
  return parsed.data;
}

export async function readSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("jailbot_session")?.value;
  if (!token) return null;
  const db = getDb();
  const now = new Date();
  const [row] = await db.select({ user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.tokenHash, hashValue(token)), gt(sessions.expiresAt, now))).limit(1);
  return row?.user ?? null;
}

export async function sessionUserFromRequest() {
  return await readSession();
}

async function getDiscordAccessToken(userId: string) {
  const db = getDb();
  const [account] = await db.select().from(accounts).where(eq(accounts.userId, userId)).limit(1);
  if (!account) throw new DiscordApiError("Discord account connection is missing", 401);
  if (account.expiresAt.getTime() > Date.now() + 60_000) return decryptSecret(account.accessTokenEncrypted);

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Discord OAuth is not configured");
  const refreshToken = decryptSecret(account.refreshTokenEncrypted);
  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new DiscordApiError("Discord session expired; sign in again", 401);
  const tokenData = tokenResponseSchema.safeParse(await response.json());
  if (!tokenData.success) throw new DiscordApiError("Discord returned an unexpected token response");
  await db.update(accounts).set({
    accessTokenEncrypted: encryptSecret(tokenData.data.access_token),
    refreshTokenEncrypted: encryptSecret(tokenData.data.refresh_token),
    expiresAt: new Date(Date.now() + tokenData.data.expires_in * 1000),
    scope: tokenData.data.scope,
    updatedAt: new Date()
  }).where(eq(accounts.id, account.id));
  return tokenData.data.access_token;
}

export async function getManagedGuilds(userId: string): Promise<ManagedDiscordGuild[]> {
  const token = await getDiscordAccessToken(userId);
  const response = await fetch(`${DISCORD_API}/users/@me/guilds?with_counts=false`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new DiscordApiError(response.status === 401 ? "Discord session expired; sign in again" : "Could not retrieve Discord servers", response.status === 401 ? 401 : 502);
  const parsed = z.array(discordGuildSchema).safeParse(await response.json());
  if (!parsed.success) throw new DiscordApiError("Discord returned an unexpected server list");
  const allowed = parsed.data.filter((guild) => canManageGuild(guild.owner, guild.permissions));
  if (allowed.length === 0) return [];
  const db = getDb();
  const [rows, statuses] = await Promise.all([
    db.select().from(botGuilds).where(inArray(botGuilds.guildId, allowed.map((guild) => guild.id))),
    db.select().from(botStatus).limit(1)
  ]);
  const status = new Map(rows.map((row) => [row.guildId, row]));
  const bot = statuses[0];
  const heartbeatFresh = Boolean(bot && (bot.status === "online" || bot.status === "degraded") && Date.now() - bot.lastHeartbeatAt.getTime() < 180_000);
  const inventoryFresh = Boolean(bot?.lastInventoryAt && Date.now() - bot.lastInventoryAt.getTime() < 600_000);
  return allowed.map((guild) => {
    const observed = status.get(guild.id);
    const installed = observed?.installed ?? false;
    return {
      ...guild,
      canManage: true as const,
      botInstalled: installed,
      botStatusKnown: installed || inventoryFresh,
      botOnline: installed && heartbeatFresh && bot?.status === "online",
      botDegraded: installed && heartbeatFresh && bot?.status === "degraded",
      botSeenAt: observed?.lastSeenAt ?? null
    };
  });
}

export async function requireManagedGuild(userId: string, guildId: string) {
  const guilds = await getManagedGuilds(userId);
  const guild = guilds.find((item) => item.id === guildId);
  if (!guild) throw new DiscordApiError("You do not have permission to manage this server", 403);
  if (!guild.botInstalled) throw new DiscordApiError("Jailbot is not installed in this server", 409);
  return guild;
}

export async function getUserFromSession() {
  const user = await readSession();
  if (!user) return null;
  return user;
}

export async function exchangeOAuthCode(code: string, verifier: string) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !appUrl) throw new Error("Discord OAuth is not configured");
  const redirectUri = new URL("/api/auth/callback", appUrl).toString();
  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new DiscordApiError("Discord sign-in could not be completed", 401);
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new DiscordApiError("Discord returned an unexpected token response");
  return parsed.data;
}

export async function fetchDiscordUser(accessToken: string) {
  return discordJson(`${DISCORD_API}/users/@me`, accessToken, discordUserSchema);
}

export async function saveLogin(user: z.infer<typeof discordUserSchema>, token: z.infer<typeof tokenResponseSchema>, sessionToken: string) {
  const db = getDb();
  const accountId = `discord:${user.id}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + token.expires_in * 1000);
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: user.id, username: user.username, globalName: user.global_name ?? null, avatar: user.avatar ?? null, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: users.id, set: { username: user.username, globalName: user.global_name ?? null, avatar: user.avatar ?? null, updatedAt: now } });
    await tx.insert(accounts).values({ id: accountId, userId: user.id, provider: "discord", providerAccountId: user.id, accessTokenEncrypted: encryptSecret(token.access_token), refreshTokenEncrypted: encryptSecret(token.refresh_token), expiresAt, scope: token.scope, updatedAt: now }).onConflictDoUpdate({ target: accounts.id, set: { accessTokenEncrypted: encryptSecret(token.access_token), refreshTokenEncrypted: encryptSecret(token.refresh_token), expiresAt, scope: token.scope, updatedAt: now } });
    await tx.insert(sessions).values({ tokenHash: hashValue(sessionToken), userId: user.id, expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), createdAt: now });
  });
}
