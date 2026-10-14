import { expect, test } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local .dev.vars");

// X login was removed (X's API is paid per call). Even with X keys set (.dev.vars has fake ones), it stays gone.
test("no 'Continue with X', even when X keys are set", async ({ page, request }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with X" })).toHaveCount(0);

  const providers = await (await request.get("/api/auth/providers")).json();
  expect(Object.keys(providers)).not.toContain("twitter");
});
