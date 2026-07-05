import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ClientsTable } from "@/components/tables/clients-table";
import type { SalesClient } from "@/lib/sales/clients";

function buildClients(count: number): SalesClient[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `client-${index + 1}`,
    clientCode: `C${String(index + 1).padStart(6, "0")}`,
    companyName: `Performance Client ${index + 1}`,
    sector: "commercial",
    paymentTermsDays: 30,
    contactPerson: `Contact ${index + 1}`,
    email: `client${index + 1}@example.com`,
    phone: "0917 555 1234",
    address: "Makati City",
    tin: null,
    birRegistrationLink: null,
    notes: null,
    isActive: true,
    createdAt: new Date(2026, 3, 5, 10, 0, 0).toISOString(),
  }));
}

describe("sales table performance", () => {
  let clients: SalesClient[];

  beforeEach(() => {
    clients = buildClients(500);
  });

  it("renders 500-client table within acceptable interaction threshold", async () => {
    const renderStart = performance.now();
    render(<ClientsTable clients={clients} />);
    const renderEnd = performance.now();

    const searchInput = screen.getByLabelText("Search clients");

    const interactiveStart = performance.now();
    searchInput.focus();
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    const interactiveEnd = performance.now();

    const renderDuration = renderEnd - renderStart;
    const interactionDuration = interactiveEnd - interactiveStart;

    // Generous budgets: absolute wall-clock timing is inflated by v8 coverage
    // instrumentation (~1.6x locally) and by slower CI runners. These thresholds
    // still catch pathological (e.g. O(n^2)) rendering regressions for 500 rows
    // without flaking under `--coverage`.
    expect(renderDuration).toBeLessThan(5000);
    expect(interactionDuration).toBeLessThan(500);
  });
});
