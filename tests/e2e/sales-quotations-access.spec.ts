import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected from quotations page", async ({ page }) => {
  await page.goto("/protected/sales/quotations");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("owner/executive approver can open quotations page", async ({ page }) => {
  const email = process.env.E2E_OWNER_LOGIN_EMAIL;
  const password = process.env.E2E_OWNER_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_OWNER_LOGIN_EMAIL and E2E_OWNER_LOGIN_PASSWORD to validate approver quotations access.",
  );

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await page.goto("/protected/sales/quotations");
  await expect(page.getByRole("heading", { name: /quotation approval/i })).toBeVisible();
});
