import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

/** Query the local D1 database (emails are logged locally, so codes are read from here). */
export const sql = (query: string): Record<string, string>[] =>
  JSON.parse(
    execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--local", "--json", "--command", query], {
      encoding: "utf8",
    }),
  )[0].results;

export const PASSWORD = "Good1pass";
export const newEmail = () => `user${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

/** A fresh, verified, logged-in account. */
export async function signUp(page: Page) {
  const email = newEmail();
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  const code = sql(`SELECT code FROM email_code WHERE email = '${email}'`)[0].code;
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByTestId("username")).toBeVisible();
  return { email, username: (await page.getByTestId("username").textContent())! };
}
