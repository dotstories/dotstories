// Local secrets, created once and never overwritten (both files are gitignored):
// - .env.local → `pnpm dev` (Next.js on http://localhost:3000)
// - .dev.vars  → `pnpm preview` and e2e (Cloudflare runtime on http://localhost:8787)
// Missing keys are added, existing values kept. Emails are logged, not sent (MAIL_LOG=1).
// Files go through the app at /files (FILES_ORIGIN empty), stored in the local R2 bucket.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const read = (file) =>
  existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, "utf8")
          .split(/\r?\n/)
          .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
          .filter(Boolean)
          .map((m) => [m[1], m[2]]),
      )
    : {};

const env = read(".env.local");
const vars = read(".dev.vars");
const secret = env.AUTH_SECRET || vars.AUTH_SECRET || randomBytes(32).toString("base64");

const shared = { AUTH_SECRET: secret, MAIL_LOG: "1", FILES_ORIGIN: "" };
const files = {
  ".env.local": { ...shared, SITE_URL: "http://localhost:3000" },
  ".dev.vars": {
    ...shared,
    SITE_URL: "http://localhost:8787",
    // Leftover X keys must not bring "Continue with X" back (X login was removed: paid API).
    AUTH_TWITTER_ID: "e2e-fake",
    AUTH_TWITTER_SECRET: "e2e-fake",
  },
};

for (const [file, wanted] of Object.entries(files)) {
  const have = read(file);
  const missing = Object.entries(wanted).filter(([k]) => !(k in have));
  if (!missing.length) continue;
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  const sep = before && !before.endsWith("\n") ? "\n" : "";
  writeFileSync(file, before + sep + missing.map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  console.log(`${file}: added ${missing.map(([k]) => k).join(", ")}`);
}
