import type { MetadataRoute } from "next";
import { latest } from "@/lib/dot";
import { dots } from "@/lib/dots";
import { BLOG, dotPath, SITE } from "@/lib/share";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/dots`, changeFrequency: "daily", priority: 0.9 },
    ...dots.map((d) => ({ url: `${SITE}${dotPath(d)}`, lastModified: latest(d).date, changeFrequency: "weekly" as const })),
    { url: `${BLOG}/`, changeFrequency: "weekly" },
    ...["/terms", "/privacy", "/cookies"].map((path) => ({ url: `${SITE}${path}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
