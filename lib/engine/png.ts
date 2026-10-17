import type { ImageResult } from "./protocol";

/** The engine's RGBA pixels as a PNG file (for the post-steps, the result image and its download). */
export async function toPng({ rgba, width, height }: ImageResult): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d")!.putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}
