import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PoolConfig } from "pg";

type CloudflareEnv = {
  HYPERDRIVE?: { connectionString: string };
};

/**
 * Works in three places: `next dev`, a self-hosted Node server, and the
 * Cloudflare Worker. On Cloudflare the Hyperdrive binding wins; everywhere
 * else the DATABASE_URL environment variable is used.
 */
function hyperdriveConnectionString(): string | undefined {
  try {
    const env = getCloudflareContext().env as CloudflareEnv;
    return env?.HYPERDRIVE?.connectionString;
  } catch {
    // Not running inside a Cloudflare request (node dev/server, or bindings absent).
    return undefined;
  }
}

export function getDatabaseConnection(): Pick<PoolConfig, "connectionString" | "ssl"> {
  const hyperdrive = hyperdriveConnectionString();
  const connectionString = hyperdrive ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Configure a HYPERDRIVE binding or DATABASE_URL secret");

  return {
    connectionString,
    // Hyperdrive supplies its own runtime connection URL and TLS handling.
    ssl: hyperdrive ? undefined : process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined
  };
}
