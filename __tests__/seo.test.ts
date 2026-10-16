/** @jest-environment node */
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { dots } from "../lib/dots";

it("the sitemap lists the home page, the catalog, every dot and the blog", () => {
  const urls = sitemap().map((e) => e.url);
  expect(urls).toEqual(
    expect.arrayContaining([
      "https://dotstories.com/",
      "https://dotstories.com/dots",
      ...dots.map((d) => `https://dotstories.com/dots/${d.slug}`),
      "https://blog.dotstories.com/",
    ]),
  );
});

it("the sitemap lists the legal pages and the Code of Conduct", () => {
  const urls = sitemap().map((e) => e.url);
  for (const path of ["/terms", "/privacy", "/cookies", "/code-of-conduct"]) expect(urls).toContain(`https://dotstories.com${path}`);
});

it("robots: crawl the site, not the API or private pages; point to both sitemaps", () => {
  const r = robots();
  expect(r.rules).toMatchObject({ userAgent: "*", allow: "/", disallow: expect.arrayContaining(["/api/", "/profile"]) });
  expect(r.sitemap).toEqual(["https://dotstories.com/sitemap.xml", "https://blog.dotstories.com/sitemap.xml"]);
});
