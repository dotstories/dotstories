import type { D1Database } from "@cloudflare/workers-types";

// Bindings from wrangler.jsonc, available via getCloudflareContext().env
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
