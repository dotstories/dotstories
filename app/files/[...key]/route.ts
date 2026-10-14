import { pausedResponse } from "@/lib/budget";
import { getFile, spendingStopped } from "@/lib/storage";

/** Uploaded files, served from R2. Names are random and never reused: cache forever. */
export async function GET(req: Request, { params }: RouteContext<"/files/[...key]">) {
  if (await spendingStopped()) return pausedResponse();
  const key = (await params).key.join("/");
  const object = await getFile(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body as unknown as ReadableStream, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
