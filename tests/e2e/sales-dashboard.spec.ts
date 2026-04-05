import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected away from sales dashboard", async ({ page }) => {
  await page.goto("/protected/sales");
  await expect(page).toHaveURL(/\/auth\/login/);
});
