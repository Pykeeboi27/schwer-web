import { expect, test } from "@playwright/test";

test("department completion gate redirects incomplete profiles to choose-department", async ({ page }) => {
  const email = process.env.E2E_NODEPT_LOGIN_EMAIL;
  const password = process.env.E2E_NODEPT_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_NODEPT_LOGIN_EMAIL and E2E_NODEPT_LOGIN_PASSWORD to run choose-department flow.",
  );

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await page.waitForURL("**/auth/choose-department");
  await expect(page.getByRole("heading", { name: /choose your department/i })).toBeVisible();

  await page.getByLabel("Department").selectOption("engineering");
  await page.getByRole("button", { name: /continue/i }).click();

  await page.waitForURL("**/protected/engineering");
  await expect(page).toHaveURL(/\/protected\/engineering$/);
});
