import { expect, test } from "@playwright/test";
import { PASSWORD, signUp, sql } from "./session";

test.skip(!!process.env.BASE_URL, "needs the local database");

const DOT = "/dots/dark-fantasy-thumbnail";

test("logged in: your setup follows you to another device", async ({ browser }) => {
  const laptop = await browser.newPage();
  const { email } = await signUp(laptop);
  await laptop.goto(DOT);
  await laptop.getByLabel(/prompt/i).fill("Saved in my account");
  await expect(laptop).toHaveURL(/prompt=Saved\+in\+my\+account/);
  await expect
    .poll(() => sql(`SELECT state FROM dot_state JOIN user ON user.id = dot_state.userId WHERE email = '${email}'`)[0]?.state)
    .toContain("Saved in my account");

  // Another browser (no localStorage from the first one), same account.
  const phone = await browser.newPage();
  await phone.goto("/login");
  await phone.getByLabel("Email").fill(email);
  await phone.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await phone.getByRole("button", { name: "Log in" }).click();
  await expect(phone.getByTestId("username")).toBeVisible();

  await phone.goto(DOT); // no link
  await expect(phone).toHaveURL(/prompt=Saved\+in\+my\+account/);
  await expect(phone.getByLabel(/prompt/i)).toHaveValue("Saved in my account");

  // A link still wins over what the account saved.
  await phone.goto(`${DOT}?prompt=From+a+link`);
  await expect(phone.getByLabel(/prompt/i)).toHaveValue("From a link");
});
