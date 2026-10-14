import { expect, type Page, test } from "@playwright/test";
import { signUp, sql } from "./session";

test.skip(!!process.env.BASE_URL, "needs the local database");

const DOT = "/dots/dark-fantasy-thumbnail";
const likes = async (page: Page) => Number(await page.getByTestId("likes").textContent());
/** Click, then wait for the server action: the button changes right away (optimistic), the database a moment later. */
async function clickAndSave(page: Page, name: string) {
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === DOT);
  await page.getByRole("button", { name }).click();
  await saved;
}

test("liking needs a login", async ({ page }) => {
  await page.goto(DOT);
  await page.getByRole("button", { name: "Like" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fdots%2Fdark-fantasy-thumbnail$/);
});

test("like and unlike; it's saved", async ({ page }) => {
  await signUp(page);
  await page.goto(DOT);
  const before = await likes(page);

  await clickAndSave(page, "Like");
  await expect(page.getByRole("button", { name: "Unlike" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => likes(page)).toBe(before + 1);

  await page.reload();
  await expect(page.getByRole("button", { name: "Unlike" })).toBeVisible();
  expect(await likes(page)).toBe(before + 1);

  await clickAndSave(page, "Unlike");
  await expect(page.getByRole("button", { name: "Like" })).toBeVisible();
  await page.reload();
  expect(await likes(page)).toBe(before);
});

test("logged out: 'Log in to comment'", async ({ page }) => {
  await page.goto(DOT);
  await expect(page.getByRole("link", { name: "Log in to comment" })).toBeVisible();
});

test("comment, reply, delete your own; others can't delete it", async ({ browser }) => {
  const page = await browser.newPage();
  const { username } = await signUp(page);
  await page.goto(DOT);

  const text = `What seed did you use? ${Date.now()}`;
  await page.getByLabel("Add a comment").fill(text);
  await page.getByRole("button", { name: "Post" }).click();
  const mine = page.getByRole("article", { name: `Comment by ${username}` }).filter({ hasText: text });
  await expect(mine).toBeVisible();

  await mine.getByRole("button", { name: "Reply" }).click();
  await page.getByLabel("Reply", { exact: true }).fill("Answering myself");
  await mine.getByRole("button", { name: "Reply" }).last().click(); // the form's button, under this comment
  await expect(page.getByText("Answering myself")).toBeVisible();

  // Someone else sees it but has no Delete on it.
  const other = await browser.newPage();
  await signUp(other);
  await other.goto(DOT);
  await expect(other.getByText(text)).toBeVisible();
  await expect(
    other.getByRole("article", { name: `Comment by ${username}` }).filter({ hasText: text }).getByRole("button", { name: "Delete" }),
  ).toHaveCount(0);

  // Deleting it keeps the reply: the comment shows as [deleted], without its author.
  await mine.getByRole("button", { name: "Delete" }).first().click();
  await expect(page.getByText(text)).toHaveCount(0);
  await expect(page.getByText("Answering myself")).toBeVisible();
  const gone = page.getByRole("article", { name: "Comment by [deleted]" }).filter({ hasText: "Answering myself" });
  await expect(gone).toContainText("[deleted]");
  await expect(gone.getByRole("button", { name: "Reply" })).toHaveCount(0); // no replying to a deleted comment
  expect(sql(`SELECT text FROM comment WHERE text = '${text}'`)).toHaveLength(0); // the text is really gone

  // Last reply deleted → the empty [deleted] placeholder goes too.
  await page.getByRole("article", { name: `Comment by ${username}` }).filter({ hasText: "Answering myself" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Answering myself")).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Comment by [deleted]" }).filter({ hasText: "Answering myself" })).toHaveCount(0);
});

test("a comment nobody replied to is removed completely", async ({ page }) => {
  await signUp(page);
  await page.goto(DOT);
  const text = `Short-lived ${Date.now()}`;
  await page.getByLabel("Add a comment").fill(text);
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText(text)).toBeVisible();

  const before = Number(sql(`SELECT comments FROM dot_stats WHERE slug = '${DOT.split("/").pop()}'`)[0].comments);
  await page.getByRole("article").filter({ hasText: text }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(text)).toHaveCount(0);
  await expect.poll(() => sql(`SELECT id FROM comment WHERE text = '${text}'`)).toHaveLength(0); // no row left behind
  expect(Number(sql(`SELECT comments FROM dot_stats WHERE slug = '${DOT.split("/").pop()}'`)[0].comments)).toBe(before - 1);
});

test("empty comments are refused", async ({ page }) => {
  await signUp(page);
  await page.goto(DOT);
  await page.getByLabel("Add a comment").fill("   ");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Write something first." })).toBeVisible();
});
