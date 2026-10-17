import type { FromWorker, ImageRequest, ImageResult, Progress, ToWorker } from "./protocol";

/** What the handler needs from the engine (injected, so it is tested without a GPU). */
export type Engine = {
  generate(request: ImageRequest, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<ImageResult>;
};

/** The worker's logic: one run at a time, cancel stops it, every outcome becomes one message. */
export function createHandler(engine: Engine, post: (message: FromWorker, transfer?: Transferable[]) => void) {
  let controller: AbortController | null = null;
  return async (message: ToWorker) => {
    if (message.type === "cancel") {
      controller?.abort();
      return;
    }
    if (controller) {
      post({ type: "error", message: "An image is already being made.", cancelled: false });
      return;
    }
    const current = (controller = new AbortController());
    try {
      const result = await engine.generate(message.request, (progress) => post({ type: "progress", progress }), current.signal);
      post({ type: "done", result }, [result.rgba.buffer]);
    } catch (e) {
      const cancelled = current.signal.aborted;
      post({ type: "error", message: cancelled ? "Cancelled." : e instanceof Error ? e.message : String(e), cancelled });
    } finally {
      controller = null;
    }
  };
}
