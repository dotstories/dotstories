import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AwsClient } from "aws4fetch";
import { budgetStopped } from "./budget";
import { checkUpload, FILE_CACHE } from "./uploads";

/**
 * Files live in R2 (binding FILES). Any S3-compatible storage works for uploads:
 * S3_ENDPOINT (R2: https://<account>.r2.cloudflarestorage.com), S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
 * Without those keys (local, CI), files are uploaded through the Worker instead.
 */
const files = () => getCloudflareContext().env.FILES;

/** No uploads or file reads: R2 isn't turned on yet, or the kill switch is on (R2 costs). */
export const spendingStopped = async () => {
  const env = getCloudflareContext().env as Partial<CloudflareEnv>;
  return !env.FILES || !env.DB || (await budgetStopped(env.DB));
};

function s3() {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    client: new AwsClient({ accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, service: "s3", region: "auto" }),
    base: `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}`,
  };
}

export type UploadTarget = { url: string; headers: Record<string, string> };

/** Where the browser should PUT the file. Signed for 10 minutes, for this exact file type. */
export async function uploadTarget(key: string, type: string): Promise<UploadTarget> {
  const remote = s3();
  if (!remote) return { url: `/api/uploads/${key}`, headers: { "Content-Type": type } };
  // Cache-Control is signed too: the file is stored with it, so the CDN caches it for a year.
  const headers = { "Content-Type": type, "Cache-Control": FILE_CACHE };
  const signed = await remote.client.sign(`${remote.base}/${key}?X-Amz-Expires=600`, {
    method: "PUT",
    headers,
    aws: { signQuery: true, allHeaders: true },
  });
  return { url: signed.url, headers };
}

/** Uploaded? Right type and size? Otherwise it's deleted. */
export async function verifyUpload(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const head = await files().head(key);
  if (!head) return { ok: false, error: "The upload didn't arrive. Try again." };
  const check = checkUpload(head.httpMetadata?.contentType ?? "", head.size);
  if (!check.ok) {
    await files().delete(key);
    return check;
  }
  return { ok: true };
}

export const putFile = (key: string, body: ArrayBuffer, type: string) =>
  files().put(key, body, { httpMetadata: { contentType: type, cacheControl: FILE_CACHE } });

export const getFile = (key: string) => files().get(key);
export const deleteFile = (key: string) => files().delete(key);

/** Delete every file under a prefix (e.g. a user's folder). R2 lists and deletes up to 1000 at a time. */
export async function deleteFolder(prefix: string) {
  const bucket = (getCloudflareContext().env as Partial<CloudflareEnv>).FILES;
  if (!bucket) return; // R2 not on: nothing was ever uploaded
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    if (page.objects.length) await bucket.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
