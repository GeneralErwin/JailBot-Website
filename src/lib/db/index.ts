import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "@/lib/db/schema";

declare global {
  var jailbotPool: Pool | undefined;
}

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  globalThis.jailbotPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined });
  return globalThis.jailbotPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  return drizzle(getPool(), { schema });
}

export async function checkDatabase() {
  await getPool().query("select 1");
}
