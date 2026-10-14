import { findDot } from "@/lib/dots";
import { addView } from "@/lib/stats";

/** Counts one view. The browser sends it once a day per dot (components/view-ping.tsx). */
export async function POST(_req: Request, { params }: RouteContext<"/api/dots/[slug]/view">) {
  const { slug } = await params;
  if (!findDot(slug)) return new Response(null, { status: 404 });
  await addView(slug);
  return new Response(null, { status: 204 });
}
