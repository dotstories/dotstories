import type { WorkerLike } from "./client";

/** Starts the engine worker. Kept apart so tests (CommonJS, no import.meta) never load it. */
export const spawnEngine = (): WorkerLike => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
