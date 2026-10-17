// Copies the web engine's tokenizer files to public/engine/ so the engine worker can load them.
// Runs in dev and build (package.json) (the files come from the @dotstories/web-engine package, not from git).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const resolve = createRequire(import.meta.url).resolve;
const to = join(import.meta.dirname, "..", "public", "engine", "tokenizers", "qwen2");
mkdirSync(to, { recursive: true });
for (const name of ["vocab.json", "merges.txt"]) copyFileSync(resolve(`@dotstories/web-engine/tokenizers/qwen2/${name}`), join(to, name));
console.log("Engine tokenizer copied to public/engine/tokenizers/qwen2");
