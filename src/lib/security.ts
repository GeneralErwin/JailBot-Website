import { NextResponse } from "next/server";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.APP_URL;
  if (!origin || !configured) throw new SecurityError("Invalid request origin", 403);
  try {
    if (new URL(origin).origin !== new URL(configured).origin) throw new SecurityError("Invalid request origin", 403);
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    throw new SecurityError("Invalid request origin", 403);
  }
}

export class SecurityError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export function errorResponse(error: unknown) {
  if (error instanceof SecurityError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "Request could not be completed" }, { status: 500 });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function getPublicOrigin() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not configured");
  const url = new URL(appUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("APP_URL must use HTTPS in production");
  return url;
}
