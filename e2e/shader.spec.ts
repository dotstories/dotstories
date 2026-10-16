import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { acceptedTerms, fakeRunner, loopback } from "./fakes";

// Real Pyodide (numpy + Pillow from the CDN) running the dot's shader.py in the browser.
test("the shader post-step runs in the browser and matches the reference card", async ({ page }) => {
  test.setTimeout(240_000);
  await loopback(page, "granted");
  await acceptedTerms(page);
  await fakeRunner(page, "e2e/fixtures/raw-weeping-gate.png");
  await page.goto("/");
  await page.getByRole("button", { name: "Run" }).click();

  await expect(page.getByText(/adding title and effects in your browser/i)).toBeVisible();
  const result = page.getByRole("img", { name: /your result/i });
  await expect(result).toBeVisible({ timeout: 200_000 });
  await expect(result).toHaveAttribute("src", /^blob:/);

  // Compare with the card made by the same shader.py in regular Python (CPython).
  const reference = `data:image/png;base64,${readFileSync("e2e/fixtures/card-reference.png").toString("base64")}`;
  const diff = await result.evaluate(async (el: HTMLImageElement, ref: string) => {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((ok, fail) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = fail;
        i.src = src;
      });
    const pixels = (img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      [c.width, c.height] = [img.naturalWidth, img.naturalHeight];
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    };
    const [a, b] = [pixels(el), pixels(await load(ref))];
    if (a.length !== b.length) return { size: false, mean: 255, exact: 0 };
    let sum = 0;
    let exact = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(a[i] - b[i]);
      sum += d;
      if (d === 0) exact++;
    }
    return { size: true, mean: sum / a.length, exact: exact / a.length };
  }, reference);

  // Shows up as a note on the PR checks.
  console.log(`::notice title=Shader match::mean diff ${diff.mean.toFixed(3)}/255, identical values ${(diff.exact * 100).toFixed(2)}%`);
  expect(diff.size).toBe(true);
  expect(diff.mean).toBeLessThan(1); // out of 255: visually identical
});
