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
