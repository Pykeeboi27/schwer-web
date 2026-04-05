import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected from clients page", async ({ page }) => {
  await page.goto("/protected/sales/clients");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("clients page exposes create and search interactions", async ({ page }) => {
  const email = process.env.E2E_SALES_LOGIN_EMAIL;
  const password = process.env.E2E_SALES_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_SALES_LOGIN_EMAIL and E2E_SALES_LOGIN_PASSWORD to validate clients create/search flow.",
  );

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await page.goto("/protected/sales/clients");
  await expect(page.getByRole("button", { name: /create client/i })).toBeVisible();
  await expect(page.getByLabel("Search clients")).toBeVisible();

  await page.getByRole("button", { name: /create client/i }).click();
  await expect(page.getByRole("dialog", { name: /create client/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /generate code/i })).toBeVisible();
});
