import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig(),
  buildCommand: "next build --turbopack",
};

export default config;
