// Fails when the gzipped client JS is over the budget (default 1 MB).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIR = ".next/static";
const LIMIT = Number(process.env.BUNDLE_LIMIT_KB ?? 1024) * 1024;

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".js") ? [path] : [];
  });

const total = files(DIR).reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

console.log(`Client JS (gzip): ${kb(total)} / ${kb(LIMIT)}`);
if (total > LIMIT) {
  console.error("Bundle over budget. Split it or move code to a separate worker.");
  process.exit(1);
}
