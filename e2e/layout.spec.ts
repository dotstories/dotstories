import { expect, test } from "@playwright/test";

test("header and footer on the homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "DotStories" })).toBeVisible();
  await expect(page.getByRole("link", { name: /source code on github/i })).toBeVisible();
});

test("Carbon dark theme is applied", async ({ page }) => {
  await page.goto("/");
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--cds-background").trim(),
  );
  expect(bg).toBe("#161616"); // Carbon g100
});

test("Tailwind layout classes win over Carbon's reset; Carbon components keep their styles", async ({ page }) => {
  await page.goto("/");
  const styles = await page.evaluate(() => {
    const header = document.querySelector("header")!;
    const nav = header.querySelector("nav")!;
    const link = header.querySelector("a.cds--link")!;
    return {
      header: getComputedStyle(header).display,
      nav: getComputedStyle(nav).display,
      navJustify: getComputedStyle(nav).justifyContent,
      linkColor: getComputedStyle(link).color,
      // Tailwind's reset (`* { padding: 0 }`) must not flatten Carbon buttons.
      buttonPadding: parseFloat(getComputedStyle(document.querySelector(".cds--btn")!).paddingRight),
    };
  });
  expect(styles).toMatchObject({ header: "flex", nav: "flex", navJustify: "space-between" });
  expect(styles.linkColor).toBe("rgb(120, 169, 255)"); // Carbon g100 link color, not the reset's inherit
  expect(styles.buttonPadding).toBeGreaterThan(20);
});
