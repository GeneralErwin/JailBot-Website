import { cache } from "react";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "@/lib/db/schema";
import { getDatabaseConnection } from "@/lib/db/connection";

export function databaseConfigured() {
  try {
    return Boolean(getDatabaseConnection().connectionString);
  } catch {
    return false;
  }
}

/**
 * Cloudflare Workers forbid reusing an I/O object across requests, so the pool
 * is created per request (and memoized for that request only). Hyperdrive does
 * the real pooling in front of the database.
 */
export const getPool = cache(() => {
  const connection = getDatabaseConnection();
  return new Pool({
    ...connection,
    max: 5,
    maxUses: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
});

export const getDb = cache((): NodePgDatabase<typeof schema> => {
  return drizzle(getPool(), { schema });
});

export async function checkDatabase() {
  await getPool().query("select 1");
}
