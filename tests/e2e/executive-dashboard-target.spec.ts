import { expect, test } from "@playwright/test";

test("target editor route requires authentication", async ({ page }) => {
  await page.goto("/protected/executive?period=ytd");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("non-authenticated users cannot submit target updates", async ({ page }) => {
  await page.goto("/protected/executive");
  await expect(page).toHaveURL(/\/auth\/login/);
});
