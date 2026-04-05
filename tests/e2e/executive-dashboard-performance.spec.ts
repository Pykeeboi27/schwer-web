import { expect, test } from "@playwright/test";

test("sales performance view on executive dashboard requires authentication", async ({ page }) => {
  await page.goto("/protected/executive?period=monthly");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("quarterly performance filter route also requires authentication", async ({ page }) => {
  await page.goto("/protected/executive?period=quarterly");
  await expect(page).toHaveURL(/\/auth\/login/);
});
