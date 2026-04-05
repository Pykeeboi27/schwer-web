import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected from executive approvals", async ({ page }) => {
  await page.goto("/protected/executive/approvals");
  await expect(page).toHaveURL(/\/auth\/login/);
});
