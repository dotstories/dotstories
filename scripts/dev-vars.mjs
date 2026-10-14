// Local preview + e2e: secrets the Worker expects (FILES_ORIGIN empty: files through the Worker at /files), in .dev.vars (gitignored). Created once.
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!existsSync(".dev.vars")) {
  writeFileSync(
    ".dev.vars",
    [
      `AUTH_SECRET=${randomBytes(32).toString("base64")}`,
      "MAIL_LOG=1",
      "SITE_URL=http://localhost:8787",
      "FILES_ORIGIN=",
      // Leftover X keys must not bring "Continue with X" back (X login was removed: paid API).
      "AUTH_TWITTER_ID=e2e-fake",
      "AUTH_TWITTER_SECRET=e2e-fake",
    ].join("\n") + "\n",
  );
  console.log("Created .dev.vars (local secrets, emails are logged instead of sent)");
}
