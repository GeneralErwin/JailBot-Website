import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { hashValue } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { assertSameOrigin, getPublicOrigin } from "@/lib/security";
import { apiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const token = cookieStore.get("jailbot_session")?.value;
    if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashValue(token)));
    const response = NextResponse.redirect(new URL("/", getPublicOrigin()), 303);
    response.cookies.delete("jailbot_session");
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return apiError(error, request);
  }
}
