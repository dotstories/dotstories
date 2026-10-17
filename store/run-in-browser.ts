import { downloadModels } from "@dotstories/web-engine";
import { makeImage } from "@/lib/engine/client";
import { allowed, indexedDbStore, pickModelsFolder, scanModelsFolder } from "@/lib/engine/models-folder";
import { toPng } from "@/lib/engine/png";
import { checkSupport } from "@/lib/engine/support";
import { runPostStep } from "@/lib/shader";
import { createBrowserRun } from "./browser-run";

/** The Run button's store, wired to the real engine, models folder and Pyodide post-steps. */
export const useBrowserRun = createBrowserRun({
  checkSupport: () => checkSupport(),
  folders: indexedDbStore,
  pick: (store) => pickModelsFolder(store),
  allowed,
  scan: scanModelsFolder,
  download: (folder, missing, onProgress, options) => downloadModels(folder, missing, onProgress, options),
  // The worker starts only on Run (and Jest never loads it: spawn.ts uses import.meta).
  makeImage: async (request, options) => {
    const { spawnEngine } = await import("@/lib/engine/spawn");
    return makeImage(request, { ...options, worker: spawnEngine });
  },
  toPng,
  postStep: runPostStep,
});
