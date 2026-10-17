// Runs Krea 2 Turbo on this computer's GPU, off the page's main thread. Messages: lib/engine/protocol.ts.
import { generate, Qwen2Tokenizer } from "@dotstories/web-engine";
import { createHandler } from "./handler";
import type { FromWorker, ToWorker } from "./protocol";

// The worker's global scope, as far as we use it (the app's TypeScript setup has the DOM types, not the worker ones).
const scope = self as unknown as {
  location: Location;
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

const TOKENIZER = "/engine/tokenizers/qwen2/";
let tokenizer: Promise<Qwen2Tokenizer> | null = null;
const loadTokenizer = () =>
  (tokenizer ??= Qwen2Tokenizer.load(new URL(`${TOKENIZER}vocab.json`, scope.location.href), new URL(`${TOKENIZER}merges.txt`, scope.location.href)));

const handle = createHandler(
  {
    async generate({ files, ...request }, onProgress, signal) {
      const { rgba, width, height, times } = await generate(files, await loadTokenizer(), request, onProgress, { signal });
      return { rgba, width, height, times };
    },
  },
  (message, transfer = []) => scope.postMessage(message, transfer),
);

scope.onmessage = (e) => void handle(e.data);
