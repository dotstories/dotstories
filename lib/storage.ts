import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AwsClient } from "aws4fetch";
import { budgetStopped } from "./budget";
import { checkUpload } from "./uploads";

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
  const signed = await remote.client.sign(`${remote.base}/${key}?X-Amz-Expires=600`, {
    method: "PUT",
    headers: { "Content-Type": type },
    aws: { signQuery: true, allHeaders: true },
  });
  return { url: signed.url, headers: { "Content-Type": type } };
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
  files().put(key, body, { httpMetadata: { contentType: type } });

export const getFile = (key: string) => files().get(key);
export const deleteFile = (key: string) => files().delete(key);
