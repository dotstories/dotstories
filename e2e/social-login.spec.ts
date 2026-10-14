import { expect, test } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local fake X keys");

// "Continue with X" must leave both cookies the callback checks (state + PKCE), or X logins fail with
// "state value could not be parsed". X itself is never called: the redirect to x.com is stopped here.
test("Continue with X: state + PKCE cookies are set, state fits X's 500-character limit", async ({ page, context }) => {
  let authorize: URL | undefined;
  await context.route(/^https:\/\/(x|twitter)\.com\//, (route) => {
    authorize = new URL(route.request().url());
    return route.fulfill({ status: 200, body: "stopped before X" });
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with X" }).click();
  await expect.poll(() => authorize?.hostname).toMatch(/x\.com|twitter\.com/);

  const state = authorize!.searchParams.get("state");
  expect(state).toBeTruthy();
  expect(state!.length).toBeLessThanOrEqual(500);
  expect(authorize!.searchParams.get("redirect_uri")).toBe("http://localhost:8787/api/auth/callback/twitter");

  const names = (await context.cookies("http://localhost:8787")).map((c) => c.name);
  expect(names.some((n) => n.endsWith("authjs.state"))).toBe(true);
  expect(names.some((n) => n.endsWith("authjs.pkce.code_verifier"))).toBe(true);
});
