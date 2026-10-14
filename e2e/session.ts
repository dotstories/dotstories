import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Query the local D1 database (emails are logged locally, so codes are read from here). */
export function sql(query: string): Record<string, string>[] {
  for (let attempt = 1; ; attempt++) {
    try {
      const out = execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--local", "--json", "--command", query], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return JSON.parse(out)[0].results;
    } catch (e) {
      // The running Worker may hold the SQLite lock for a moment.
      if (attempt >= 5 || !String((e as { stderr?: string }).stderr ?? e).includes("SQLITE_BUSY")) throw e;
      pause(200 * attempt);
    }
  }
}

export const PASSWORD = "Good1pass";
export const newEmail = () => `u${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}@example.com`; // short: usernames come from it

/** A fresh, verified, logged-in account. */
export async function signUp(page: Page) {
  const email = newEmail();
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  const code = sql(`SELECT code FROM email_code WHERE email = '${email}'`)[0].code;
  await page.getByLabel("Code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByTestId("username")).toBeVisible();
  return { email, username: (await page.getByTestId("username").textContent())! };
}
