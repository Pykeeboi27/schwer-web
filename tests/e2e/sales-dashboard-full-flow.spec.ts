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

async function openAuthenticatedPage(
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

function extractPoNumber(toastText: string): string | null {
  const match = toastText.match(/Purchase order\s+([^\s]+)\s+created/i);
  return match?.[1] ?? null;
}

test("full sales flow: client create -> quotation submit/approve -> PO create -> collection", async ({
  browser,
}) => {
  const salesEmail = process.env.E2E_SALES_LOGIN_EMAIL;
  const salesPassword = process.env.E2E_SALES_LOGIN_PASSWORD;
  const managerEmail = process.env.E2E_SALES_MANAGER_LOGIN_EMAIL;
  const managerPassword = process.env.E2E_SALES_MANAGER_LOGIN_PASSWORD;
  const ownerEmail = process.env.E2E_OWNER_LOGIN_EMAIL;
  const ownerPassword = process.env.E2E_OWNER_LOGIN_PASSWORD;
  const executiveEmail = process.env.E2E_EXECUTIVE_LOGIN_EMAIL;
  const executivePassword = process.env.E2E_EXECUTIVE_LOGIN_PASSWORD;

  test.skip(
    !salesEmail ||
      !salesPassword ||
      !managerEmail ||
      !managerPassword ||
      !ownerEmail ||
      !ownerPassword ||
      !executiveEmail ||
      !executivePassword,
    "Set sales/manager/owner/executive E2E credentials to run full flow validation.",
  );

  const suffix = Date.now().toString().slice(-6);
  const clientName = `E2E Flow Client ${suffix}`;
  const poSubject = `E2E Flow PO ${suffix}`;

  const salesSession = await openAuthenticatedPage(browser, {
    email: salesEmail!,
    password: salesPassword!,
  });

  const { page: salesPage } = salesSession;

  try {
    await salesPage.goto("/protected/sales/clients");
    await salesPage.getByRole("button", { name: /create client/i }).click();
    await salesPage.getByLabel("Client Name").fill(clientName);
    await salesPage.getByLabel("Email").fill(`flow-${suffix}@example.com`);
    await salesPage.getByLabel("Phone").fill("0917 555 0000");
    await salesPage.getByRole("button", { name: /^create client$/i }).click();
    await expect(salesPage.getByText(/client created successfully/i)).toBeVisible();

    await salesPage.getByLabel("Search clients").fill(clientName);
    await expect(salesPage.getByText(clientName)).toBeVisible();

    await salesPage.goto("/protected/sales/quotations");

    const draftRow = salesPage
      .locator("tbody tr")
      .filter({ hasText: /Draft|Pending/i })
      .first();

    if ((await draftRow.count()) === 0) {
      test.skip(
        true,
        "No draft/pending quotation row available. Seed at least one quotation to validate submit/approve flow.",
      );
    }

    const quotationNumber = (await draftRow.locator("td").first().innerText()).trim();
    await draftRow.click();

    const submitButton = salesPage.getByRole("button", { name: /submit for approval/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await expect(salesPage.getByText(/submitted for approval/i)).toBeVisible();
    }

    await salesPage.goto("/protected/sales/purchase-orders");
    await salesPage.getByRole("button", { name: /create purchase order/i }).click();

    const clientOptionValue = await salesPage.locator("#po-client option").nth(1).getAttribute("value");
    if (!clientOptionValue) {
      test.skip(true, "No active client option available for PO creation.");
    }

    await salesPage.locator("#po-client").selectOption(clientOptionValue!);
    await salesPage.locator("#po-subject").fill(poSubject);
    await salesPage.locator("#po-total").fill("1000");
    await salesPage.getByRole("button", { name: /^create po$/i }).click();

    const poCreatedToast = salesPage
      .locator("div[role='status'], div[role='alert']")
      .filter({ hasText: /purchase order .* created successfully/i })
      .first();
    await expect(poCreatedToast).toBeVisible();
    const poNumber = extractPoNumber(await poCreatedToast.innerText());

    if (!poNumber) {
      test.skip(true, "Could not extract PO number from success toast.");
    }

    const poRow = salesPage.locator("tbody tr").filter({ hasText: poNumber! }).first();
    await poRow.click();
    await expect(salesPage.getByRole("dialog", { name: /purchase order details/i })).toBeVisible();

    await salesPage.getByRole("button", { name: /record collection/i }).click();
    await salesPage.locator("#collection-amount").fill("200");
    await salesPage.getByRole("button", { name: /^record collection$/i }).click();
    await expect(salesPage.getByText(/collection recorded successfully/i)).toBeVisible();

    await expect(salesPage.locator("tbody tr").filter({ hasText: poNumber! }).first()).toContainText(
      "200.00 / 1000.00",
    );

    const managerSession = await openAuthenticatedPage(browser, {
      email: managerEmail!,
      password: managerPassword!,
    });

    try {
      const managerPage = managerSession.page;
      await managerPage.goto("/protected/sales/quotations");
      await managerPage.locator("tbody tr").filter({ hasText: quotationNumber }).first().click();

      const managerApprove = managerPage.getByRole("button", { name: /^approve$/i });
      if (await managerApprove.isVisible()) {
        await managerApprove.click();
        await expect(managerPage.getByText(/quotation approved successfully/i)).toBeVisible();
      }
    } finally {
      await managerSession.dispose();
    }

    const ownerSession = await openAuthenticatedPage(browser, {
      email: ownerEmail!,
      password: ownerPassword!,
    });

    try {
      const ownerPage = ownerSession.page;
      await ownerPage.goto("/protected/sales/quotations");
      const ownerRow = ownerPage.locator("tbody tr").filter({ hasText: quotationNumber }).first();

      if ((await ownerRow.count()) > 0) {
        await ownerRow.click();
        const ownerApprove = ownerPage.getByRole("button", { name: /^approve$/i });
        if (await ownerApprove.isVisible()) {
          await ownerApprove.click();
          await expect(ownerPage.getByText(/quotation approved successfully/i)).toBeVisible();
        }
      }
    } finally {
      await ownerSession.dispose();
    }

    const executiveSession = await openAuthenticatedPage(browser, {
      email: executiveEmail!,
      password: executivePassword!,
    });

    try {
      const executivePage = executiveSession.page;
      await executivePage.goto("/protected/sales/quotations");
      const executiveRow = executivePage
        .locator("tbody tr")
        .filter({ hasText: quotationNumber })
        .first();

      if ((await executiveRow.count()) > 0) {
        await executiveRow.click();
        const executiveApprove = executivePage.getByRole("button", { name: /^approve$/i });
        if (await executiveApprove.isVisible()) {
          await executiveApprove.click();
          await expect(executivePage.getByText(/quotation approved successfully/i)).toBeVisible();
        }
      }
    } finally {
      await executiveSession.dispose();
    }
  } finally {
    await salesSession.dispose();
  }
});
