import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Images are already sized; no image service needed on Cloudflare.
  images: { unoptimized: true },
  // Carbon's Sass prints many deprecation warnings: hide warnings from node_modules only.
  sassOptions: { quietDeps: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
