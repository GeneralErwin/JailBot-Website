// Source of truth for cf deploys:
//   build:  npx cf build
//   deploy: npx cf deploy --prebuilt --mode production
// `npm run build` also runs `cf build` so that Workers Builds' default
// `npx wrangler deploy` can upload the vinext output through wrangler.jsonc.
// Keep wrangler.jsonc in sync with this file; prefer cf when using Hyperdrive.
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
