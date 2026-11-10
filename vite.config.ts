import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

process.env.CLOUDFLARE_WORKERS_BUILD = "true";

export default defineConfig({
  resolve: {
    alias: {
      "@/lib/db/connection": fileURLToPath(new URL("./src/lib/db/connection.cloudflare.ts", import.meta.url))
    }
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
