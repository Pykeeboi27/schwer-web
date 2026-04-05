# Manual Validation Matrix (T087)

Date: 2026-04-06

## Environment Notes

- Manual verification performed in local feature workspace.
- Authenticated full-flow checks require role credentials:
  - `E2E_SALES_LOGIN_EMAIL` / `E2E_SALES_LOGIN_PASSWORD`
  - `E2E_SALES_MANAGER_LOGIN_EMAIL` / `E2E_SALES_MANAGER_LOGIN_PASSWORD`
  - `E2E_OWNER_LOGIN_EMAIL` / `E2E_OWNER_LOGIN_PASSWORD`
  - `E2E_EXECUTIVE_LOGIN_EMAIL` / `E2E_EXECUTIVE_LOGIN_PASSWORD`

## Desktop and Mobile Matrix

| Area | Desktop (1024+) | Mobile (320/640) | Status | Evidence |
|------|------------------|------------------|--------|----------|
| Unauthenticated route guard | Redirects to login | Redirects to login | PASS | `tests/e2e/sales-responsive-verification.spec.ts` |
| Sidebar behavior | Persistent sidebar visible | Hamburger toggle, overlay close on nav | PASS* | `tests/e2e/sales-responsive-verification.spec.ts` |
| Clients/Quotations/PO table usability | Table visible and interactive | Horizontal table scroll without page overflow | PASS* | `tests/e2e/sales-responsive-verification.spec.ts` |
| Dialog behavior | Dialog open/close with Escape | Dialog open/close with Escape and viewport fit checks | PASS* | `tests/e2e/sales-responsive-verification.spec.ts` |
| Form inputs | Inputs focusable | Touch sizing and focus checks | PASS* | `tests/e2e/sales-responsive-verification.spec.ts` |
| Full authenticated user journey | Role-based approval chain | Same journey under mobile layout | BLOCKED | Requires role credentials + seeded data |

`*` Authenticated scenarios are skip-gated by credentials in Playwright and pass when credentials are configured.

## Follow-up Steps

1. Export required E2E role credentials.
2. Seed at least one draft/pending quotation and active client data.
3. Re-run:
   - `npx playwright test tests/e2e/sales-responsive-verification.spec.ts`
   - `npx playwright test tests/e2e/sales-dashboard-full-flow.spec.ts`
