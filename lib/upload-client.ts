import { checkUpload } from "./uploads";

export type Uploaded = { key: string; url: string };

/** Ask for a place, then PUT the file there (straight to R2 when keys are set). */
export async function uploadFile(file: Blob): Promise<Uploaded> {
  const check = checkUpload(file.type, file.size);
  if (!check.ok) throw new Error(check.error);

  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: file.type, size: file.size }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed.");

  const put = await fetch(data.upload.url, { method: "PUT", headers: data.upload.headers, body: file });
  if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
  return { key: data.key, url: data.url };
}
