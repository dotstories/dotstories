import type { MetadataRoute } from "next";
import { BLOG, SITE } from "@/lib/share";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/profile", "/new-password"] },
    sitemap: [`${SITE}/sitemap.xml`, `${BLOG}/sitemap.xml`],
  };
}
