import { expect, test } from "@playwright/test";

test("unauthenticated users are redirected from sales layout route", async ({ page }) => {
  await page.goto("/protected/sales/clients");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("sales layout renders responsive navigation shell", async ({ page }) => {
  const email = process.env.E2E_SALES_LOGIN_EMAIL;
  const password = process.env.E2E_SALES_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_SALES_LOGIN_EMAIL and E2E_SALES_LOGIN_PASSWORD to validate sales layout responsiveness.",
  );

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/protected/sales/clients");
  await expect(page.getByText("Clients")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByLabel("Toggle sales navigation")).toBeVisible();
});
