import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig(),
  buildCommand: "node scripts/copy-engine-assets.mjs && next build --turbopack", // + the web engine's tokenizer files
};

export default config;
