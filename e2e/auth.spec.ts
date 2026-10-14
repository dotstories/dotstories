import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";

// Real flows on the local D1. Emails are logged, so codes and links are read from the database.
test.skip(!!process.env.BASE_URL, "needs the local database");

const sql = (query: string): Record<string, string>[] =>
  JSON.parse(
    execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--local", "--json", "--command", query], {
      encoding: "utf8",
    }),
  )[0].results;

const newEmail = () => `user${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;
const PASSWORD = "Good1pass";

async function register(page: Page, email: string, password = PASSWORD) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
}

const codeFor = (email: string) => sql(`SELECT code FROM email_code WHERE email = '${email}'`)[0]?.code;

async function verify(page: Page, code: string) {
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
}

async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("sign up with email: code, verified, logged in with a username", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await verify(page, codeFor(email));
  await expect(page.getByTestId("username")).toHaveText(email.split("@")[0]);
  expect(sql(`SELECT emailVerified FROM user WHERE email = '${email}'`)[0].emailVerified).toBeTruthy();
});

test("log out and log in again; wrong password is refused", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await verify(page, codeFor(email));
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

  await logIn(page, email, "Wrong1pass");
  await expect(page.getByRole("alert")).toContainText("Wrong email or password.");

  await logIn(page, email);
  await expect(page.getByTestId("username")).toBeVisible();
});

test("a wrong code 5 times needs a new code", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  const wrong = codeFor(email) === "000000" ? "111111" : "000000";
  for (let i = 0; i < 4; i++) {
    await verify(page, wrong);
    await expect(page.getByRole("alert")).toContainText("Wrong code.");
  }
  await verify(page, wrong);
  await expect(page.getByRole("alert")).toContainText("Too many tries");
  expect(codeFor(email)).toBeUndefined();
});

test("not verified yet: logging in asks for the code", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await logIn(page, email);
  await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
});

test("reset the password by email", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await verify(page, codeFor(email));
  await page.getByRole("button", { name: "Log out" }).click();

  await page.goto("/reset-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");

  const token = sql(`SELECT token FROM password_reset WHERE email = '${email}'`)[0].token;
  await page.goto(`/new-password?token=${token}`);
  await page.getByLabel("New password").fill("Newer1pass");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("status")).toContainText("Password changed.");

  await logIn(page, email, "Newer1pass");
  await expect(page.getByTestId("username")).toBeVisible();
});

test("reset never reveals if an email has an account", async ({ page }) => {
  await page.goto("/reset-password");
  await page.getByLabel("Email").fill(newEmail());
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
});

test("after logging in you go back where you were, never to another site", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await verify(page, codeFor(email));
  await page.getByRole("button", { name: "Log out" }).click();

  await page.goto("/login?next=%2F%2Fevil.example");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByTestId("username")).toBeVisible();
  expect(new URL(page.url()).host).toBe("localhost:8787");

  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/login?next=%2Fdots");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dots$/);
});
