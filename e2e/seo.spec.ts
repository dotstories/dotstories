import { expect, test } from "@playwright/test";

test("sitemap.xml and robots.txt are served", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://dotstories.com/dots/dark-fantasy-thumbnail</loc>");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://dotstories.com/sitemap.xml");
  expect(robots).toContain("Disallow: /api/");
});
