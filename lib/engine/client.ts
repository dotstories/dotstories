import type { FromWorker, ImageRequest, ImageResult, Progress, ToWorker } from "./protocol";

export type WorkerLike = Pick<Worker, "postMessage" | "terminate"> & {
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
};

/**
 * Makes one image in a fresh engine worker (`worker`: spawnEngine in the app, a fake in tests).
 * The worker ends afterwards, which also frees the GPU memory. Cancel with the signal: the run stops
 * within about one transformer block.
 */
export function makeImage(
  request: ImageRequest,
  { worker, onProgress, signal }: { worker: () => WorkerLike; onProgress?: (p: Progress) => void; signal?: AbortSignal },
): Promise<ImageResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Cancelled.", "AbortError"));
    const w = worker();
    const send = (message: ToWorker) => w.postMessage(message);
    const cancel = () => send({ type: "cancel" });
    const end = () => {
      signal?.removeEventListener("abort", cancel);
      w.terminate();
    };
    signal?.addEventListener("abort", cancel);
    w.onmessage = ({ data }) => {
      if (data.type === "progress") return onProgress?.(data.progress);
      end();
      if (data.type === "done") resolve(data.result);
      else reject(data.cancelled ? new DOMException(data.message, "AbortError") : new Error(data.message));
    };
    w.onerror = (e) => {
      end();
      reject(new Error(e.message || "The image engine could not start."));
    };
    send({ type: "run", request });
  });
}
