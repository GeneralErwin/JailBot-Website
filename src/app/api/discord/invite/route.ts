import { NextResponse } from "next/server";
import { getManagedGuilds, readSession } from "@/lib/discord";
import { getBotPermissionString } from "@/lib/permissions";
import { getPublicOrigin } from "@/lib/security";
import { snowflakeSchema } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/login?reason=invite-setup", getPublicOrigin()), 303);
  const target = new URL(request.url).searchParams.get("guild_id");
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("scope", "bot applications.commands");
  authorize.searchParams.set("permissions", getBotPermissionString());
  if (target && snowflakeSchema.safeParse(target).success) {
    try {
      const user = await readSession();
      if (user) {
        const guilds = await getManagedGuilds(user.id);
        if (guilds.some((guild) => guild.id === target)) {
          authorize.searchParams.set("guild_id", target);
          authorize.searchParams.set("disable_guild_select", "true");
        }
      }
    } catch {
      // An invalid/expired session falls back to Discord's regular server picker.
    }
  }
  return NextResponse.redirect(authorize, 303);
}
