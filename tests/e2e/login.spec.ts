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

  await page.waitForURL(/\/(auth\/choose-department|protected(\/.*)?)$/);
  await expect(page).not.toHaveURL(/\/auth\/login/);
});

test("deep-link login preserves intended destination through auth", async ({ page }) => {
  const email = process.env.E2E_LOGIN_EMAIL;
  const password = process.env.E2E_LOGIN_PASSWORD;
  const intendedPath = "/protected/engineering?tab=overview";

  test.skip(
    !email || !password,
    "Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run deep-link login flow.",
  );

  await page.goto(intendedPath);
  await expect(page).toHaveURL(/\/auth\/login\?redirectTo=/);

  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await page.waitForURL(/\/(auth\/choose-department|protected(\/.*)?)$/);

  const currentUrl = page.url();
  expect(currentUrl).not.toContain("/auth/login");

  if (currentUrl.includes("/auth/choose-department")) {
    expect(currentUrl).toContain("redirectTo=%2Fprotected%2Fengineering%3Ftab%3Doverview");
  }
});
