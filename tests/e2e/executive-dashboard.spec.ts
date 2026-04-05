import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected away from executive dashboard", async ({ page }) => {
  await page.goto("/protected/executive");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("period-filter URLs also require Executive Dashboard Viewer access", async ({ page }) => {
  await page.goto("/protected/executive?period=quarterly");
  await expect(page).toHaveURL(/\/auth\/login/);
});
