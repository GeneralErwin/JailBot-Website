import { NextResponse } from "next/server";
import { readSession, getManagedGuilds } from "@/lib/discord";
import { apiError, requireUser } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = requireUser(await readSession());
    const guilds = await getManagedGuilds(user.id);
    return NextResponse.json({ guilds: guilds.map(({ id, name, icon, botInstalled, botSeenAt }) => ({ id, name, icon, botInstalled, botSeenAt })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, request);
  }
}
