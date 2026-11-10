import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "@/lib/db/schema";
import { getDatabaseConnection } from "@/lib/db/connection";

declare global {
  var jailbotPool: Pool | undefined;
}

export function databaseConfigured() {
  try {
    return Boolean(getDatabaseConnection().connectionString);
  } catch {
    return false;
  }
}

export function getPool() {
  const connection = getDatabaseConnection();
  globalThis.jailbotPool ??= new Pool({ ...connection, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  return globalThis.jailbotPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  return drizzle(getPool(), { schema });
}

export async function checkDatabase() {
  await getPool().query("select 1");
}
