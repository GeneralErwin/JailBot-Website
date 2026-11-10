import { env } from "cloudflare:workers";
import type { PoolConfig } from "pg";

type HyperdriveEnvironment = typeof env & {
  HYPERDRIVE?: { connectionString: string };
};

export function getDatabaseConnection(): Pick<PoolConfig, "connectionString" | "ssl"> {
  const hyperdrive = (env as HyperdriveEnvironment).HYPERDRIVE;
  const connectionString = hyperdrive?.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Configure a HYPERDRIVE binding or DATABASE_URL secret");

  return {
    connectionString,
    // Hyperdrive supplies its own runtime connection URL and TLS handling.
    ssl: hyperdrive ? undefined : process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined
  };
}
