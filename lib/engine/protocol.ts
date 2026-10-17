/** Messages between the page and the engine worker (lib/engine/worker.ts). */

export type ModelFiles = { transformer: File; textEncoder: File; vae: File; lora?: File };

export type ImageRequest = {
  files: ModelFiles;
  prompt: string; // what the text encoder gets (encoderPrompt())
  width: number;
  height: number;
  seed: number;
  loraStrength?: number;
};

export type Progress = { stage: "text" | "steps" | "decode"; message: string; fraction: number };
export type ImageResult = { rgba: Uint8ClampedArray<ArrayBuffer>; width: number; height: number; times: Record<string, number> };

export type ToWorker = { type: "run"; request: ImageRequest } | { type: "cancel" };
export type FromWorker =
  | { type: "progress"; progress: Progress }
  | { type: "done"; result: ImageResult }
  | { type: "error"; message: string; cancelled: boolean };
