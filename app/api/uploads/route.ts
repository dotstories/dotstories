import { auth } from "@/auth";
import { pausedResponse } from "@/lib/budget";
import { spendingStopped, uploadTarget } from "@/lib/storage";
import { checkUpload, fileUrl, newKey } from "@/lib/uploads";

/** Step 1 of an upload: logged-in users get a place to put one file. */
export async function POST(req: Request) {
  if (await spendingStopped()) return pausedResponse();
  const session = await auth();
  if (!session) return Response.json({ error: "Log in to upload." }, { status: 401 });

  const { type, size } = (await req.json().catch(() => ({}))) as { type?: string; size?: number };
  const check = checkUpload(String(type), Number(size));
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  const key = newKey(session.user.id, String(type));
  return Response.json({ key, url: fileUrl(key), upload: await uploadTarget(key, String(type)) });
}
