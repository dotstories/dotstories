/** What can be uploaded, and how big. Checked in the browser and again on the server. */
export const MB = 1024 * 1024;
export const LIMITS = { image: 5 * MB, music: 100 * MB, video: 500 * MB } as const;
export type Kind = keyof typeof LIMITS;

const TYPES: Record<string, { kind: Kind; ext: string }> = {
  "image/webp": { kind: "image", ext: "webp" },
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/avif": { kind: "image", ext: "avif" },
  "audio/webm": { kind: "music", ext: "webm" },
  "audio/ogg": { kind: "music", ext: "ogg" },
  "audio/mpeg": { kind: "music", ext: "mp3" },
  "audio/flac": { kind: "music", ext: "flac" },
  "audio/wav": { kind: "music", ext: "wav" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
};

const NAMES: Record<Kind, string> = { image: "images", music: "music", video: "videos" };

export const kindOf = (type: string): Kind | null => TYPES[type]?.kind ?? null;
export const extensionFor = (type: string) => TYPES[type]?.ext ?? "bin";

export function checkUpload(type: string, size: number): { ok: true; kind: Kind } | { ok: false; error: string } {
  const kind = kindOf(type);
  if (!kind) return { ok: false, error: "This file type isn't supported." };
  if (!(size > 0)) return { ok: false, error: "The file is empty." };
  if (size > LIMITS[kind]) return { ok: false, error: `Too big: ${NAMES[kind]} can be up to ${LIMITS[kind] / MB} MB.` };
  return { ok: true, kind };
}

/** u/<user id>/<random>.<ext>: never guessable, always tied to its owner. */
export const newKey = (userId: string, type: string) => `u/${userId}/${crypto.randomUUID()}.${extensionFor(type)}`;

export const ownsKey = (userId: string, key: string) =>
  key.startsWith(`u/${userId}/`) && !key.includes("..") && /^[\w./-]+$/.test(key);

/** Uploaded files are immutable (random names): cache them everywhere for a year. */
export const FILE_CACHE = "public, max-age=31536000, immutable";

const trim = (origin: string) => origin.replace(/\/$/, "");

/**
 * Public address of an uploaded file. With FILES_ORIGIN (https://files.dotstories.com) the file is served
 * by R2 behind Cloudflare's cache: no Worker per request. Without it (local, CI): through the Worker at /files.
 */
export const fileUrl = (key: string, origin = process.env.FILES_ORIGIN) => (origin ? `${trim(origin)}/${key}` : `/files/${key}`);

/** The key back from a stored address (either form), or null if it isn't one of our files. */
export function keyFromUrl(url: string | null | undefined, origin = process.env.FILES_ORIGIN): string | null {
  if (!url) return null;
  if (url.startsWith("/files/")) return url.slice("/files/".length);
  if (origin && url.startsWith(`${trim(origin)}/`)) return url.slice(trim(origin).length + 1);
  return null;
}
