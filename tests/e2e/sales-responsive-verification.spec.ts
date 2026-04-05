import { expect, test, type Browser, type Page } from "@playwright/test";

type Credentials = {
  email: string;
  password: string;
};

async function login(page: Page, credentials: Credentials): Promise<void> {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Login" }).click();
}

async function createAuthenticatedPage(
  browser: Browser,
  credentials: Credentials,
): Promise<{ page: Page; dispose: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);

  return {
    page,
    dispose: async () => {
      await context.close();
    },
  };
}

test("unauthenticated users are redirected from sales routes on key breakpoints", async ({ page }) => {
  const salesRoutes = [
    "/protected/sales",
    "/protected/sales/clients",
    "/protected/sales/quotations",
    "/protected/sales/purchase-orders",
  ];

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 768, height: 900 },
    { width: 1024, height: 900 },
  ]) {
    await page.setViewportSize(viewport);

    for (const route of salesRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  }
});

test("sidebar switches correctly at 320, 640, 768, and 1024 widths", async ({ browser }) => {
  const email = process.env.E2E_SALES_LOGIN_EMAIL;
  const password = process.env.E2E_SALES_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_SALES_LOGIN_EMAIL and E2E_SALES_LOGIN_PASSWORD to validate responsive sidebar behavior.",
  );

  const session = await createAuthenticatedPage(browser, {
    email: email!,
    password: password!,
  });

  const { page } = session;

  try {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 640, height: 900 },
      { width: 768, height: 900 },
      { width: 1024, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/protected/sales/clients");

      const sidebar = page.locator("aside").first();
      const toggle = page.getByLabel("Toggle sales navigation");

      if (viewport.width < 768) {
        await expect(toggle).toBeVisible();
        await expect(sidebar).toHaveClass(/-translate-x-full/);

        await toggle.click();
        await expect(sidebar).toHaveClass(/translate-x-0/);

        await page.getByRole("link", { name: "Quotations" }).click();
        await expect(page).toHaveURL(/\/protected\/sales\/quotations/);
        await expect(sidebar).toHaveClass(/-translate-x-full/);
      } else {
        await expect(toggle).toHaveCount(0);
        await expect(sidebar).toHaveClass(/translate-x-0/);
      }
    }
  } finally {
    await session.dispose();
  }
});

test("tables remain usable on mobile widths with horizontal overflow support", async ({ browser }) => {
  const email = process.env.E2E_SALES_LOGIN_EMAIL;
  const password = process.env.E2E_SALES_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_SALES_LOGIN_EMAIL and E2E_SALES_LOGIN_PASSWORD to validate mobile table responsiveness.",
  );

  const session = await createAuthenticatedPage(browser, {
    email: email!,
    password: password!,
  });
  const { page } = session;

  try {
    for (const route of [
      "/protected/sales/clients",
      "/protected/sales/quotations",
      "/protected/sales/purchase-orders",
    ]) {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(route);

      const tableContainer = page.locator(".overflow-x-auto").first();
      await expect(tableContainer).toBeVisible();

      const hasHorizontalOverflow = await tableContainer.evaluate((element) => {
        return element.scrollWidth > element.clientWidth;
      });

      expect(hasHorizontalOverflow).toBe(true);

      const hasNoHorizontalPageOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth;
      });
      expect(hasNoHorizontalPageOverflow).toBe(true);
    }
  } finally {
    await session.dispose();
  }
});

test("mobile form inputs remain touch-friendly, focusable, and within viewport", async ({ browser }) => {
  const email = process.env.E2E_SALES_LOGIN_EMAIL;
  const password = process.env.E2E_SALES_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_SALES_LOGIN_EMAIL and E2E_SALES_LOGIN_PASSWORD to validate mobile form behavior.",
  );

  const session = await createAuthenticatedPage(browser, {
    email: email!,
    password: password!,
  });
  const { page } = session;

  try {
    await page.setViewportSize({ width: 320, height: 740 });

    await page.goto("/protected/sales/clients");
    await page.getByRole("button", { name: /create client/i }).click();

    const clientDialog = page.getByRole("dialog", { name: /create client/i });
    await expect(clientDialog).toBeVisible();

    for (const inputId of ["#name", "#email", "#phone"]) {
      const input = page.locator(inputId);
      const height = await input.evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(36);
    }

    await page.keyboard.press("Tab");
    const focusInsideDialog = await clientDialog.evaluate((dialog) => {
      const active = document.activeElement;
      return active instanceof HTMLElement ? dialog.contains(active) : false;
    });
    expect(focusInsideDialog).toBe(true);

    const clientDialogBounds = await clientDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
    });

    expect(clientDialogBounds.left).toBeGreaterThanOrEqual(0);
    expect(clientDialogBounds.right).toBeLessThanOrEqual(321);
    expect(clientDialogBounds.width).toBeLessThanOrEqual(320);

    const noHorizontalPageOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(noHorizontalPageOverflow).toBe(true);

    await page.keyboard.press("Escape");
    await expect(clientDialog).toHaveCount(0);

    await page.goto("/protected/sales/purchase-orders");
    await page.getByRole("button", { name: /create purchase order/i }).click();

    const poDialog = page.getByRole("dialog", { name: /create purchase order/i });
    await expect(poDialog).toBeVisible();

    for (const inputId of ["#po-subject", "#po-total", "#po-payment-terms"]) {
      const input = page.locator(inputId);
      const height = await input.evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(36);
    }

    await page.keyboard.press("Tab");
    const focusInsidePoDialog = await poDialog.evaluate((dialog) => {
      const active = document.activeElement;
      return active instanceof HTMLElement ? dialog.contains(active) : false;
    });
    expect(focusInsidePoDialog).toBe(true);

    const noPoDialogHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(noPoDialogHorizontalOverflow).toBe(true);

    await page.keyboard.press("Escape");
    await expect(poDialog).toHaveCount(0);
  } finally {
    await session.dispose();
  }
});

test("dialogs open and close via Escape across 320, 768, and 1024 viewport widths", async ({
  browser,
}) => {
  const email = process.env.E2E_SALES_LOGIN_EMAIL;
  const password = process.env.E2E_SALES_LOGIN_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_SALES_LOGIN_EMAIL and E2E_SALES_LOGIN_PASSWORD to validate dialog behavior.",
  );

  const session = await createAuthenticatedPage(browser, {
    email: email!,
    password: password!,
  });
  const { page } = session;

  try {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 768, height: 900 },
      { width: 1024, height: 900 },
    ]) {
      await page.setViewportSize(viewport);

      await page.goto("/protected/sales/clients");
      await page.getByRole("button", { name: /create client/i }).click();
      const createClientDialog = page.getByRole("dialog", { name: /create client/i });
      await expect(createClientDialog).toBeVisible();

      const createClientDialogHeight = await createClientDialog.evaluate((element) => {
        return element.getBoundingClientRect().height;
      });
      expect(createClientDialogHeight).toBeLessThanOrEqual(viewport.height);

      await page.keyboard.press("Escape");
      await expect(createClientDialog).toHaveCount(0);

      await page.goto("/protected/sales/purchase-orders");
      await page.getByRole("button", { name: /create purchase order/i }).click();
      const createPoDialog = page.getByRole("dialog", { name: /create purchase order/i });
      await expect(createPoDialog).toBeVisible();

      const createPoDialogHeight = await createPoDialog.evaluate((element) => {
        return element.getBoundingClientRect().height;
      });
      expect(createPoDialogHeight).toBeLessThanOrEqual(viewport.height);

      const amountInput = page.locator("#po-total");
      const amountInputHeight = await amountInput.evaluate((element) => {
        return element.getBoundingClientRect().height;
      });
      expect(amountInputHeight).toBeGreaterThanOrEqual(36);

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: /create purchase order/i })).toHaveCount(0);

      const rowCount = await page.locator("tbody tr").count();
      if (rowCount > 0) {
        await page.locator("tbody tr").first().click();
        const detailsDialog = page.getByRole("dialog", { name: /purchase order details/i });
        await expect(detailsDialog).toBeVisible();

        const scrollableHistory = detailsDialog.locator(".max-h-64.overflow-auto").first();
        await expect(scrollableHistory).toBeVisible();

        const maxDialogHeight = await detailsDialog.evaluate((element) => {
          return element.getBoundingClientRect().height;
        });
        expect(maxDialogHeight).toBeLessThanOrEqual(viewport.height);

        await page.keyboard.press("Escape");
        await expect(detailsDialog).toHaveCount(0);
      }
    }
  } finally {
    await session.dispose();
  }
});
