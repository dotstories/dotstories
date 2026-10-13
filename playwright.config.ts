import { defineConfig, devices } from "@playwright/test";

// BASE_URL set = test a deployed site.
// Otherwise run the built worker locally on the real Cloudflare runtime
// (needs `pnpm build:worker` first).
const baseURL = process.env.BASE_URL ?? "http://localhost:8787";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm preview:worker --port 8787",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe", // worker errors show up in the test output
        timeout: 120_000,
      },
});
