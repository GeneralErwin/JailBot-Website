import { NextResponse } from "next/server";
import { DiscordApiError } from "@/lib/discord";
import { SecurityError } from "@/lib/security";

export function requestIdFor(request: Request) {
  const provided = request.headers.get("x-request-id");
  return provided && /^[A-Za-z0-9_-]{1,80}$/.test(provided) ? provided : crypto.randomUUID();
}

export function logEvent(level: "info" | "warn" | "error", event: string, fields: Record<string, string | number | boolean | null> = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function apiError(error: unknown, request?: Request) {
  const requestId = request ? requestIdFor(request) : crypto.randomUUID();
  let status = 500;
  let message = "Request could not be completed";
  if (error instanceof SecurityError || error instanceof DiscordApiError) { status = error.status; message = error.message; }
  else if (error instanceof SyntaxError) { status = 400; message = "Request body must be valid JSON"; }
  const path = request ? new URL(request.url).pathname : undefined;
  const guildId = path?.match(/(?:guilds|guild)\/(\d{17,20})/)?.[1] ?? null;
  logEvent(status >= 500 ? "error" : "warn", "api.request_failed", { requestId, method: request?.method ?? "unknown", path: path ?? "unknown", guildId, status, errorType: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ error: message, requestId }, { status, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } });
}

export function requireUser(user: { id: string } | null) {
  if (!user) throw new DiscordApiError("Sign in with Discord to continue", 401);
  return user;
}
