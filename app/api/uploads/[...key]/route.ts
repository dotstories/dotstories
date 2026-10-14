import { auth } from "@/auth";
import { putFile } from "@/lib/storage";
import { checkUpload, ownsKey } from "@/lib/uploads";

/** Upload through the Worker, when no S3 keys are set (local, CI). Only into your own folder. */
export async function PUT(req: Request, { params }: RouteContext<"/api/uploads/[...key]">) {
  const session = await auth();
  const key = (await params).key.join("/");
  if (!session || !ownsKey(session.user.id, key)) return new Response(null, { status: 403 });

  const type = req.headers.get("content-type") ?? "";
  const body = await req.arrayBuffer();
  const check = checkUpload(type, body.byteLength);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  await putFile(key, body, type);
  return new Response(null, { status: 200 });
}
