import { expect, test } from "@playwright/test";

// Runs on the real local D1 database (wrangler), migrated before the server starts.
const DOT = "/dots/dark-fantasy-orchestral";
const views = async (page: import("@playwright/test").Page) =>
  Number((await page.getByText(/\d[\d,]* Views/).textContent())!.replace(/\D/g, ""));

test("a visit counts once per day per browser", async ({ page }) => {
  await page.goto(DOT);
  const before = await views(page);

  // The first visit today sends one view.
  await page.reload({ waitUntil: "networkidle" });
  await page.reload();
  const after = await views(page);
  expect(after).toBeGreaterThanOrEqual(before);

  // Visiting again the same day doesn't count again.
  await page.reload({ waitUntil: "networkidle" });
  await page.reload();
  expect(await views(page)).toBe(after);
});

test("a new browser counts as a new view", async ({ browser }) => {
  const a = await browser.newPage();
  await a.goto(DOT, { waitUntil: "networkidle" });
  await a.reload();
  const before = await views(a);

  const b = await browser.newPage(); // fresh storage
  const sent = b.waitForRequest((r) => r.url().endsWith(`/api${DOT}/view`) && r.method() === "POST");
  await b.goto(DOT);
  await sent;
  await expect.poll(async () => (await a.reload(), views(a))).toBe(before + 1);
});

test("unknown dots don't count", async ({ request }) => {
  const res = await request.post("/api/dots/nope/view");
  expect(res.status()).toBe(404);
});
