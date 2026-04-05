import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected from quotations workflow page", async ({ page }) => {
  await page.goto("/protected/sales/quotations");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("sales manager can open quotation details and view approval controls", async ({ page }) => {
  const email = process.env.E2E_SALES_MANAGER_LOGIN_EMAIL;
  const password = process.env.E2E_SALES_MANAGER_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_SALES_MANAGER_LOGIN_EMAIL and E2E_SALES_MANAGER_LOGIN_PASSWORD to validate approval workflow UI.",
  );

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await page.goto("/protected/sales/quotations");
  await expect(page.getByRole("heading", { name: /quotations/i })).toBeVisible();

  const firstRow = page.locator("tbody tr").first();
  await firstRow.click();

  await expect(page.getByRole("dialog", { name: /quotation details/i })).toBeVisible();
  await expect(page.getByText(/approval chain/i)).toBeVisible();
});