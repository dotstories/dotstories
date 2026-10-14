import { expect, test } from "@playwright/test";
import { signUp } from "./session";

test.skip(!!process.env.BASE_URL, "needs the local database");

test("the profile needs a login", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
});

test("change your username; taken names (any case) are refused", async ({ browser }) => {
  const first = await browser.newPage();
  const taken = (await signUp(first)).username;

  const page = await browser.newPage();
  await signUp(page);
  await page.goto("/profile");

  await page.getByLabel("Username").fill(taken.toUpperCase());
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toContainText("That username is taken.");

  const mine = `me.${Date.now() % 1e8}_x`;
  await page.getByLabel("Username").fill(mine);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText("Username saved.");
  await expect(page.getByTestId("username")).toHaveText(mine);

  await page.reload();
  await expect(page.getByLabel("Username")).toHaveValue(mine);
});

test("upload a profile picture: compressed to WebP, shown in the header", async ({ page }) => {
  await signUp(page);
  await page.goto("/profile");
  await page.getByLabel("Profile picture").setInputFiles("e2e/fixtures/avatar.png");
  await expect(page.getByRole("status")).toContainText("Picture saved.");

  const img = page.getByRole("banner").getByRole("img", { name: /picture/ });
  await expect(img).toHaveAttribute("src", /^\/files\/u\/.+\.webp$/);
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(512); // square, resized

  const res = await page.request.get((await img.getAttribute("src"))!);
  expect(res.headers()["content-type"]).toBe("image/webp");
  expect(res.headers()["cache-control"]).toContain("immutable");
});

test("uploads: login required, size limits, only your own folder", async ({ page }) => {
  expect((await page.request.post("/api/uploads", { data: { type: "image/webp", size: 1000 } })).status()).toBe(401);

  await signUp(page);
  const big = await page.request.post("/api/uploads", { data: { type: "image/webp", size: 6 * 1024 * 1024 } });
  expect(big.status()).toBe(400);
  expect((await big.json()).error).toBe("Too big: images can be up to 5 MB.");

  const html = await page.request.post("/api/uploads", { data: { type: "text/html", size: 10 } });
  expect((await html.json()).error).toBe("This file type isn't supported.");

  const other = await page.request.put("/api/uploads/u/someone-else/x.webp", {
    headers: { "content-type": "image/webp" },
    data: Buffer.from("x"),
  });
  expect(other.status()).toBe(403);
});
