// Deploy step: make sure the Cloudflare resources exist, then point wrangler.jsonc at them.
// Creates the D1 database the first time and applies new migrations. Needs "D1 Edit" on the API token.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const wrangler = (...args) => execFileSync("pnpm", ["exec", "wrangler", ...args], { encoding: "utf8" });
const fail = (msg, e) => {
  console.error(`::error::${msg}${e ? ` (${String(e.stderr || e.message).split("\n")[0]})` : ""}`);
  process.exit(1);
};

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const d1 = config.d1_databases[0];

let databases;
try {
  databases = JSON.parse(wrangler("d1", "list", "--json"));
} catch (e) {
  fail("Can't list D1 databases: add 'D1 Edit' to the CLOUDFLARE_API_TOKEN permissions.", e);
}

let db = databases.find((x) => x.name === d1.database_name);
if (!db) {
  console.log(`Creating D1 database "${d1.database_name}"…`);
  wrangler("d1", "create", d1.database_name);
  db = JSON.parse(wrangler("d1", "list", "--json")).find((x) => x.name === d1.database_name);
}
d1.database_id = db.uuid;
writeFileSync("wrangler.jsonc", JSON.stringify(config, null, 2));
console.log(`D1 ${d1.database_name} → ${db.uuid}`);

console.log(wrangler("d1", "migrations", "apply", d1.binding, "--remote"));

// Budget guard Worker: same D1 database (the stop flag), this account.
const GUARD = "workers/budget-guard/wrangler.jsonc";
const guard = JSON.parse(readFileSync(GUARD, "utf8"));
guard.d1_databases[0].database_id = db.uuid;
guard.vars.ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
writeFileSync(GUARD, JSON.stringify(guard, null, 2));

// R2 bucket for uploads (needs "R2 Edit" on the token) + CORS so browsers can upload to it directly.
const bucket = config.r2_buckets[0].bucket_name;
try {
  const list = wrangler("r2", "bucket", "list");
  if (!list.includes(bucket)) {
    console.log(`Creating R2 bucket "${bucket}"…`);
    wrangler("r2", "bucket", "create", bucket);
  }
} catch (e) {
  fail(
    "Can't use R2: turn R2 on once (Cloudflare dashboard → R2 Object Storage) and add 'Workers R2 Storage Edit' to the CLOUDFLARE_API_TOKEN permissions.",
    e,
  );
}
writeFileSync(
  ".cors.json",
  JSON.stringify({
    rules: [
      {
        allowed: { origins: ["https://dotstories.com", "https://www.dotstories.com"], methods: ["PUT"], headers: ["content-type"] },
        maxAgeSeconds: 3600,
      },
    ],
  }),
);
try {
  wrangler("r2", "bucket", "cors", "set", bucket, "--file", ".cors.json", "--force");
} catch (e) {
  console.log(`::warning::Could not set R2 CORS (direct uploads may fail, the Worker fallback still works): ${e.message}`);
}

// Secrets. AUTH_SECRET is created once if the Worker doesn't have one.
// The rest are copied from GitHub secrets when set (Settings → Secrets and variables → Actions).
const COPIED = [
  "RESEND_API_KEY",
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
  existing = JSON.parse(wrangler("secret", "list", "--format", "json")).map((s) => s.name);
} catch {
  // first deploy: the Worker doesn't exist yet
}
const secrets = Object.fromEntries(COPIED.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
if (secrets.S3_ACCESS_KEY_ID) {
  secrets.S3_ENDPOINT = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
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
