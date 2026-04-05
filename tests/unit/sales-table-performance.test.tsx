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

    expect(renderDuration).toBeLessThan(1500);
    expect(interactionDuration).toBeLessThan(100);
  });
});
