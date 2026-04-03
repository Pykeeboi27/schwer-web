import { expect, test } from "@playwright/test";

test("sign-up completes and redirects to protected dashboard", async ({ page }) => {
  const email = process.env.E2E_SIGNUP_EMAIL;
  const password = process.env.E2E_SIGNUP_PASSWORD;
  const department = process.env.E2E_SIGNUP_DEPARTMENT ?? "engineering";

  test.skip(
    !email || !password,
    "Set E2E_SIGNUP_EMAIL and E2E_SIGNUP_PASSWORD to run sign-up flow.",
  );

  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByLabel("Repeat Password").fill(password!);
  await page.getByLabel("Department").selectOption(department);
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.waitForURL(/\/(auth\/choose-department|protected(\/.*)?)$/);

  const currentUrl = page.url();

  if (currentUrl.includes("/auth/choose-department")) {
    await expect(page.getByRole("heading", { name: /choose your department/i })).toBeVisible();
  } else {
    await expect(page).toHaveURL(/\/protected(\/.*)?$/);
  }
});
