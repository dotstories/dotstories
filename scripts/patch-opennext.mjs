// Temporary fix: Next 16.4 loads `.next/server/preview-props.json`, but
// @opennextjs/cloudflare 1.20.11 only bundles *-manifest.json files, so the
// worker crashes with "Unexpected loadManifest(...preview-props.json) call!".
// This adds the file to the adapter's list. Remove once upstream fixes it.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "node_modules/@opennextjs/cloudflare/dist";
const FROM = "required-server-files,prefetch-hints}";
const TO = "required-server-files,prefetch-hints,preview-props}";

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".js") ? [path] : [];
  });

let patched = 0;
let already = 0;
for (const file of files(DIST)) {
  const code = readFileSync(file, "utf8");
  if (code.includes(TO)) already++;
  else if (code.includes(FROM)) {
    writeFileSync(file, code.replaceAll(FROM, TO));
    patched++;
  }
}

if (!patched && !already) {
  console.error("patch-opennext: pattern not found. @opennextjs/cloudflare changed — check if the fix is upstream and remove this script.");
  process.exit(1);
}
console.log(`patch-opennext: ${patched ? "patched" : "already patched"}`);
