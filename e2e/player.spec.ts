import { expect, test } from "@playwright/test";

test("music dot: the player plays the sample", async ({ page }) => {
  await page.goto("/dots/dark-fantasy-orchestral");
  await expect(page.getByRole("heading", { level: 1, name: "Dark Fantasy Orchestral" })).toBeVisible();

  const player = page.getByRole("group", { name: /audio player/i });
  await player.getByRole("button", { name: "Play" }).click();
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();

  // Time moves: the sample really plays (30 s FLAC).
  const seek = player.getByRole("slider", { name: "Seek" });
  await expect(seek).toHaveAttribute("aria-valuemax", "30");
  await expect.poll(async () => Number(await seek.getAttribute("aria-valuenow")), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(player.getByText(/^0:0\d \/ 0:30$/)).toBeVisible();

  await player.getByRole("button", { name: "Pause" }).click();
  await expect(player.getByRole("button", { name: "Play" })).toBeVisible();
});

test("catalog shows image and music dots", async ({ page }) => {
  await page.goto("/dots");
  await expect(page.getByRole("link", { name: "Dark Fantasy Thumbnail" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dark Fantasy Orchestral" })).toBeVisible();
});
