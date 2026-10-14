import { expect, test } from "@playwright/test";
import { BLOG_URL } from "../playwright.config";

// The blog is its own static site (blog/), served like in production by wrangler.
test.skip(!!process.env.BASE_URL && !process.env.BLOG_URL, "the live smoke test covers the main site");
test.use({ baseURL: BLOG_URL });

test("the blog lists posts; a post opens with its SEO tags", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "DotStories Blog" })).toBeVisible();
  await page.getByRole("link", { name: /What is a dot\?/ }).click();

  await expect(page).toHaveURL(`${BLOG_URL}/what-is-a-dot`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/What is a dot\?/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://blog.dotstories.com/what-is-a-dot");
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ "@type": "BlogPosting", datePublished: "2026-10-14" });
});

test("sitemap, robots and feed are served", async ({ request }) => {
  expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>https://blog.dotstories.com/what-is-a-dot</loc>");
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://blog.dotstories.com/sitemap.xml");
  expect((await request.get("/feed.xml")).ok()).toBe(true);
});

test("unknown pages are a 404 page", async ({ page }) => {
  const res = await page.goto("/nope");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});
