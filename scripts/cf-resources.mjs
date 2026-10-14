// Deploy step: make sure the Cloudflare resources exist, then point wrangler.jsonc at them.
// Creates the D1 database the first time and applies new migrations. Needs "D1 Edit" on the API token.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// wrangler straight from node_modules: `pnpm exec` may print its own lines ("Already up to date") into the output.
const wrangler = (...args) => execFileSync("node_modules/.bin/wrangler", args, { encoding: "utf8" });
/** JSON from wrangler output, ignoring any lines printed before it. */
const json = (out) => JSON.parse(out.slice(out.search(/^[[{]/m)));
const fail = (msg, e) => {
  console.error(`::error::${msg}${e ? ` (${String(e.stderr || e.message).split("\n")[0]})` : ""}`);
  process.exit(1);
};

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const d1 = config.d1_databases[0];

let databases;
try {
  databases = json(wrangler("d1", "list", "--json"));
} catch (e) {
  const denied = /auth|permission|10000|403/i.test(String(e.stderr || e.message));
  fail(denied ? "Can't list D1 databases: add 'D1 Edit' to the CLOUDFLARE_API_TOKEN permissions." : "Can't list D1 databases.", e);
}

// EU jurisdiction: the data never leaves the EU (GDPR). It can only be set when a database is created.
const D1_JURISDICTION = "eu";
// The first database ("dotstories") was created without one. Moving = copying it once into the EU database.
const OLD_D1 = "dotstories";

let db = databases.find((x) => x.name === d1.database_name);
if (!db) {
  console.log(`Creating D1 database "${d1.database_name}" (${D1_JURISDICTION} jurisdiction)…`);
  wrangler("d1", "create", d1.database_name, "--jurisdiction", D1_JURISDICTION);
  db = json(wrangler("d1", "list", "--json")).find((x) => x.name === d1.database_name);
}
d1.database_id = db.uuid;
writeFileSync("wrangler.jsonc", JSON.stringify(config, null, 2));
console.log(`D1 ${d1.database_name} → ${db.uuid}`);

/** No migrations table yet = nothing copied or migrated into it yet. */
function isEmpty() {
  try {
    const out = wrangler("d1", "execute", d1.binding, "--remote", "--json", "--command", "SELECT name FROM sqlite_master WHERE name = 'd1_migrations'");
    return json(out)[0].results.length === 0;
  } catch {
    return true;
  }
}

if (databases.some((x) => x.name === OLD_D1) && isEmpty()) {
  // Schema + data + the migrations table, so `migrations apply` below only runs what is new.
  // The old database is kept (rollback); delete it in the dashboard once the site works.
  console.log(`Copying "${OLD_D1}" into "${d1.database_name}"…`);
  try {
    wrangler("d1", "export", OLD_D1, "--remote", "--output", ".d1-copy.sql");
    wrangler("d1", "execute", d1.binding, "--remote", "--file", ".d1-copy.sql", "--yes");
  } catch (e) {
    fail(`Couldn't copy "${OLD_D1}" into "${d1.database_name}". Nothing was deleted; run the deploy again.`, e);
  } finally {
    writeFileSync(".d1-copy.sql", ""); // personal data: don't leave it on the runner
  }
  console.log(`::notice title=Database moved to the EU::Copied ${OLD_D1} → ${d1.database_name}. Delete "${OLD_D1}" in Cloudflare → D1 once everything works.`);
}

console.log(wrangler("d1", "migrations", "apply", d1.binding, "--remote"));

// Budget guard Worker: same D1 database (the stop flag), this account.
const GUARD = "workers/budget-guard/wrangler.jsonc";
const guard = JSON.parse(readFileSync(GUARD, "utf8"));
guard.d1_databases[0].database_id = db.uuid;
guard.vars.ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
writeFileSync(GUARD, JSON.stringify(guard, null, 2));

// R2 bucket for uploads (needs "R2 Edit" on the token) + CORS so browsers can upload to it directly.
// EU jurisdiction: files never leave the EU (GDPR). R2 not turned on yet → deploy without it:
// the site works, uploads answer 503 until R2 is on.
const bucket = config.r2_buckets[0].bucket_name;
const jurisdiction = config.r2_buckets[0].jurisdiction; // "eu"
const inJurisdiction = jurisdiction ? ["--jurisdiction", jurisdiction] : [];
let r2 = true;
try {
  const list = wrangler("r2", "bucket", "list", ...inJurisdiction);
  if (!list.includes(bucket)) {
    console.log(`Creating R2 bucket "${bucket}" (${jurisdiction ?? "default"} jurisdiction)…`);
    wrangler("r2", "bucket", "create", bucket, ...inJurisdiction);
  }
} catch (e) {
  r2 = false;
  console.log(
    `::warning title=R2 is off::Uploads are paused. Turn R2 on once (Cloudflare dashboard → R2 Object Storage) and give CLOUDFLARE_API_TOKEN 'Workers R2 Storage Edit'. (${String(e.stderr || e.message).split("\n")[0]})`,
  );
  delete config.r2_buckets;
  if (config.vars) config.vars.FILES_ORIGIN = "";
  writeFileSync("wrangler.jsonc", JSON.stringify(config, null, 2));
}
if (r2) {
  // files.dotstories.com: R2 behind Cloudflare's cache (no Worker per file). Attached by hand once
  // (bucket → Settings → Custom Domains). Until then the site serves files through the Worker at /files.
  const filesHost = new URL(config.vars?.FILES_ORIGIN || "https://none").host;
  let attached = false;
  try {
    attached = wrangler("r2", "bucket", "domain", "list", bucket, ...inJurisdiction).includes(filesHost);
  } catch {
    // listing failed: treat as not attached
  }
  if (!attached && config.vars?.FILES_ORIGIN) {
    console.log(`::warning title=Files CDN::${filesHost} isn't attached to ${bucket} yet: files go through the Worker (/files) for now.`);
    config.vars.FILES_ORIGIN = "";
    writeFileSync("wrangler.jsonc", JSON.stringify(config, null, 2));
  }
  // A known file for the cache test (scripts/cache-test.mjs). Same bytes every deploy.
  try {
    wrangler(
      "r2", "object", "put", `${bucket}/cache-test/weeping-gate.jpg`, "--file", "public/demo/weeping-gate.jpg",
      "--content-type", "image/jpeg", "--cache-control", "public, max-age=31536000, immutable", ...inJurisdiction, "--remote",
    );
  } catch (e) {
    console.log(`::warning::Could not upload the cache test file: ${String(e.stderr || e.message).split("\n")[0]}`);
  }

  // Never public on r2.dev: files are served through dotstories.com, behind the kill switch's firewall.
  try {
    wrangler("r2", "bucket", "dev-url", "disable", bucket, ...inJurisdiction, "--force");
  } catch (e) {
    console.log(`::warning::Could not check that r2.dev is off for ${bucket}: ${String(e.stderr || e.message).split("\n")[0]}`);
  }
  writeFileSync(
    ".cors.json",
    JSON.stringify({
      rules: [
        {
          allowed: { origins: ["https://dotstories.com", "https://www.dotstories.com"], methods: ["PUT"], headers: ["content-type", "cache-control"] },
          maxAgeSeconds: 3600,
        },
      ],
    }),
  );
  try {
    wrangler("r2", "bucket", "cors", "set", bucket, ...inJurisdiction, "--file", ".cors.json", "--force");
  } catch (e) {
    console.log(`::warning::Could not set R2 CORS (direct uploads may fail, the Worker fallback still works): ${e.message}`);
  }
}

// Secrets. AUTH_SECRET is created once if the Worker doesn't have one.
// The rest are copied from GitHub secrets when set (Settings → Secrets and variables → Actions).
const COPIED = [
  "ZEPTOMAIL_TOKEN", // email (ZeptoMail)
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "AUTH_TWITTER_ID",
  "AUTH_TWITTER_SECRET",
  "S3_ACCESS_KEY_ID", // R2 API token: direct uploads (up to 500 MB)
  "S3_SECRET_ACCESS_KEY",
];
let existing = [];
try {
  existing = json(wrangler("secret", "list", "--format", "json")).map((s) => s.name);
} catch {
  // first deploy: the Worker doesn't exist yet
}
const secrets = Object.fromEntries(COPIED.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
if (secrets.S3_ACCESS_KEY_ID && r2) {
  // EU buckets have their own S3 endpoint.
  secrets.S3_ENDPOINT = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}${jurisdiction ? `.${jurisdiction}` : ""}.r2.cloudflarestorage.com`;
  secrets.S3_BUCKET = bucket;
}
if (!existing.includes("AUTH_SECRET")) {
  const { randomBytes } = await import("node:crypto");
  secrets.AUTH_SECRET = randomBytes(32).toString("base64");
}
if (Object.keys(secrets).length) {
  writeFileSync(".secrets.json", JSON.stringify(secrets));
  try {
    wrangler("secret", "bulk", ".secrets.json");
  } finally {
    writeFileSync(".secrets.json", "{}");
  }
  console.log(`Secrets set: ${Object.keys(secrets).join(", ")}`);
}
