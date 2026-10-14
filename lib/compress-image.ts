/**
 * Compress an image in the browser before uploading: resize + WebP.
 * square: crop the center (profile pictures).
 */
export async function compressImage(file: Blob, { max = 2048, quality = 0.85, square = false } = {}): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const [sx, sy, sw, sh] = square
    ? [(bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side]
    : [0, 0, bitmap.width, bitmap.height];
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = new OffscreenCanvas(Math.round(sw * scale), Math.round(sh * scale));
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = await canvas.convertToBlob({ type: "image/webp", quality });
  return webp.size < file.size || file.type !== "image/webp" ? webp : file;
}
