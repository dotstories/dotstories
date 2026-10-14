import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

// Bindings from wrangler.jsonc, available via getCloudflareContext().env
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    FILES: R2Bucket;
  }
}

export {};
