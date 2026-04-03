import { expect, test } from "@playwright/test";

test("landing and login show Schwer branding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Schwer Online Management").first()).toBeVisible();

  await page.goto("/auth/login");
  await expect(page).toHaveTitle(/Schwer Online Management/);
});