import { expect, test } from "@playwright/test";

test("login redirects confirmed user to protected dashboard", async ({ page }) => {
  const email = process.env.E2E_LOGIN_EMAIL;
  const password = process.env.E2E_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run login redirect flow.",
  );

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await page.waitForURL(/\/protected(\/.*)?$/);
  await expect(page).toHaveURL(/\/protected(\/.*)?$/);
});
