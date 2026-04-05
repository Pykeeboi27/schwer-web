import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected from purchase orders page", async ({ page }) => {
  await page.goto("/protected/sales/purchase-orders");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("purchase orders page exposes PO and collection forms", async ({ page }) => {
  const email = process.env.E2E_SALES_LOGIN_EMAIL;
  const password = process.env.E2E_SALES_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_SALES_LOGIN_EMAIL and E2E_SALES_LOGIN_PASSWORD to validate purchase-order UI.",
  );

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await page.goto("/protected/sales/purchase-orders");
  await expect(page.getByRole("heading", { name: /purchase orders/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /create po/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /add payment/i })).toBeVisible();
});
