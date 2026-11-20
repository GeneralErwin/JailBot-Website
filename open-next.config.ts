import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Authenticated dashboard routes are dynamic, so no incremental cache is
// configured. Add an R2 incremental cache here if ISR/SSG pages are introduced.
//
// `buildCommand` is explicit so `opennextjs-cloudflare build` runs `next build`
// directly. The package's `build` script is itself an OpenNext build, so the
// default (`npm run build`) would recurse forever.
const config = {
  ...defineCloudflareConfig({}),
  buildCommand: "next build"
};

export default config;
