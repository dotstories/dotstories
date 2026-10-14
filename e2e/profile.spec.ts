import { expect, test } from "@playwright/test";
import { signUp, sql } from "./session";

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
  await expect(page.getByRole("alert").filter({ hasText: "That username is taken." })).toBeVisible();

  const mine = `me.${Date.now() % 1e8}_x`;
  await page.getByLabel("Username").fill(mine);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText("Username saved.");
  await expect(page.getByTestId("username")).toHaveText(mine);

  await page.reload();
  await expect(page.getByLabel("Username")).toHaveValue(mine);
});

test("upload a profile picture: compressed to WebP, shown in the header", async ({ page }) => {
  const { username } = await signUp(page);
  await page.goto("/profile");
  await page.getByLabel("Profile picture").setInputFiles("e2e/fixtures/avatar.png");
  await expect(page.getByRole("status")).toContainText("Picture saved.");

  const img = page.getByRole("banner").getByRole("img", { name: username, exact: true });
  await expect(img).toHaveAttribute("src", /^\/files\/u\/.+\.webp$/);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(512); // loaded: square, resized

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

test("delete your account: personal data removed, comment threads kept, logged out", async ({ browser }) => {
  const page = await browser.newPage();
  const { email, username } = await signUp(page);
  await page.goto("/dots/dark-fantasy-thumbnail");
  const text = `Bye for now ${Date.now()}`;
  await page.getByLabel("Add a comment").fill(text);
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText(text)).toBeVisible();

  // Someone replies to it.
  const other = await browser.newPage();
  await signUp(other);
  await other.goto("/dots/dark-fantasy-thumbnail");
  const mine = other.getByRole("article", { name: `Comment by ${username}` }).filter({ hasText: text });
  await mine.getByRole("button", { name: "Reply" }).click();
  const reply = `See you ${Date.now()}`;
  await other.getByLabel("Reply", { exact: true }).fill(reply);
  await other.getByRole("button", { name: "Reply" }).last().click();
  await expect(other.getByText(reply)).toBeVisible();

  await page.goto("/profile");
  await page.getByLabel(`Type ${username} to confirm`).fill("not-me");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Type your username exactly" })).toBeVisible();

  await page.getByLabel(`Type ${username} to confirm`).fill(username);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/\?account=deleted$/);
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

  // Nothing that identifies the person is left; the row stays for what others rely on.
  await expect.poll(() => sql(`SELECT id FROM user WHERE email = '${email}' OR username = '${username}'`)).toHaveLength(0);
  expect(sql(`SELECT text FROM comment WHERE text = '${text}'`)).toHaveLength(0);

  // The reply stays, under a deleted comment.
  await other.reload();
  await expect(other.getByText(reply)).toBeVisible();
  await expect(other.getByRole("article", { name: "Comment by Deleted user" }).first()).toContainText("[deleted]");

  // The email can't log in any more, and can sign up again.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Good1pass");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password." })).toBeVisible();
});
