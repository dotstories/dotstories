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

export const fileUrl = (key: string) => `/files/${key}`;
