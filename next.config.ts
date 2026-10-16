import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { join } from "node:path";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Images are already sized; no image service needed on Cloudflare.
  images: { unoptimized: true },
  experimental: { turbopackUseBuiltinSass: false }, // our Sass rule below instead
  turbopack: {
    rules: {
      /**
       * Sass: Next.js's own rule, with one change, so it also works on Windows.
       *
       * sass-loader's "webpack importer" resolves through Turbopack, which on Windows turns Carbon's
       * relative imports into requests like `./theme\_theme.scss` that it can't find
       * (https://github.com/vercel/next.js/issues/86431). With `webpackImporter: false`, Sass finds
       * files itself: relative imports next to the file, packages in `loadPaths`.
       * Same loaders and options as the built-in rule otherwise. Remove when Next.js fixes it.
       */
      "*.scss": {
        loaders: [
          { loader: "next/dist/build/webpack/loaders/resolve-url-loader/index", options: { sourceMap: true } },
          {
            loader: "next/dist/compiled/sass-loader",
            options: {
              sourceMap: true,
              webpackImporter: false,
              sassOptions: {
                // Our packages, then pnpm's folder of all packages (Carbon's own dependencies, e.g. @carbon/styles).
                loadPaths: [join(process.cwd(), "node_modules"), join(process.cwd(), "node_modules/.pnpm/node_modules")],
                // Carbon's Sass prints many deprecation warnings: hide warnings from node_modules only.
                quietDeps: true,
              },
            },
          },
        ],
        as: "*.css",
      },
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
