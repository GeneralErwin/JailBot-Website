// Deploy with the cf CLI, never `wrangler deploy`:
//   build:  npx cf build
//   deploy: npx cf deploy --prebuilt --mode production
// Workers Builds defaults to `wrangler deploy`, which migrates this project to
// OpenNext and ignores this file. Set both commands in Settings > Build.
import { bindings, defineConfig, defineWorker } from "cf/config";

const hyperdriveId = process.env.HYPERDRIVE_ID;
const hyperdriveBinding = hyperdriveId
  ? {
      HYPERDRIVE: bindings.hyperdrive({
        id: hyperdriveId,
        ...(process.env.DATABASE_URL ? { dev: { connectionString: process.env.DATABASE_URL } } : {})
      })
    }
  : {};

export default defineConfig({
  worker: defineWorker({
    name: "jailbot-website",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-10",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      ...hyperdriveBinding
    },
  }),
});
