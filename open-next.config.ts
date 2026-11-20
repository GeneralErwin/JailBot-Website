import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Authenticated dashboard routes are dynamic, so no incremental cache is
// configured. Add an R2 incremental cache here if ISR/SSG pages are introduced.
export default defineCloudflareConfig({});
