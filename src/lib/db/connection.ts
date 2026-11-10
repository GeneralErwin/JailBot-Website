import type { PoolConfig } from "pg";

export function getDatabaseConnection(): Pick<PoolConfig, "connectionString" | "ssl"> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  return {
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined
  };
}
