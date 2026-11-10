import { NextResponse } from "next/server";
import { checkDatabase, databaseConfigured } from "@/lib/db";
import { getDb } from "@/lib/db";
import { botStatus } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const body: Record<string, string> = { status: "ok", database: "unconfigured", bot: "unknown" };
  if (databaseConfigured()) {
    try {
      await checkDatabase(); body.database = "ok";
      const [bot] = await getDb().select().from(botStatus).limit(1);
      body.bot = bot && Date.now() - bot.lastHeartbeatAt.getTime() < 180_000 ? bot.status : "offline";
      if (body.bot !== "online") body.status = "degraded";
    }
    catch { body.database = "unavailable"; body.status = "degraded"; }
  } else {
    body.status = "degraded";
  }
  return NextResponse.json(body, { status: body.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
