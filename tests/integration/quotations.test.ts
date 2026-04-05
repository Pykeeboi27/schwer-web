import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchQuotationsAction } from "@/app/protected/sales/quotations/actions";

const { mockFetchQuotations } = vi.hoisted(() => ({
  mockFetchQuotations: vi.fn(),
}));

vi.mock("@/lib/sales/quotations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sales/quotations")>(
    "@/lib/sales/quotations",
  );

  return {
    ...actual,
    fetchQuotations: mockFetchQuotations,
  };
});

describe("fetchQuotationsAction", () => {
  beforeEach(() => {
    mockFetchQuotations.mockReset();
  });

  it("returns all department quotations for sales roles", async () => {
    mockFetchQuotations.mockResolvedValue([
      {
        id: "quote-1",
        quotationNumber: "QT-1001",
        clientId: "client-1",
        clientName: "ACME Industrial",
        subject: "Power cabinet package",
        amount: 1_200_000,
        status: "pending",
        preparedBy: "user-sales",
        pendingApprovalRoles: ["sales_manager"],
        createdAt: "2026-04-05T10:00:00.000Z",
      },
      {
        id: "quote-2",
        quotationNumber: "QT-1002",
        clientId: "client-2",
        clientName: "Sunline Trading",
        subject: "Grid tie inverter",
        amount: 4_500_000,
        status: "pending",
        preparedBy: "user-sales",
        pendingApprovalRoles: ["owner", "executive"],
        createdAt: "2026-04-05T11:00:00.000Z",
      },
    ]);

    const response = await fetchQuotationsAction("sales-dept", "sales_manager");

    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(2);
    expect(mockFetchQuotations).toHaveBeenCalledWith("sales-dept");
  });

  it("restricts executive viewers to high-value quotations", async () => {
    mockFetchQuotations.mockResolvedValue([
      {
        id: "quote-1",
        quotationNumber: "QT-1001",
        clientId: "client-1",
        clientName: "ACME Industrial",
        subject: "Power cabinet package",
        amount: 1_200_000,
        status: "pending",
        preparedBy: "user-sales",
        pendingApprovalRoles: ["sales_manager"],
        createdAt: "2026-04-05T10:00:00.000Z",
      },
      {
        id: "quote-2",
        quotationNumber: "QT-1002",
        clientId: "client-2",
        clientName: "Sunline Trading",
        subject: "Grid tie inverter",
        amount: 4_500_000,
        status: "pending",
        preparedBy: "user-sales",
        pendingApprovalRoles: ["owner", "executive"],
        createdAt: "2026-04-05T11:00:00.000Z",
      },
    ]);

    const response = await fetchQuotationsAction("executive-dept", "executive");

    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(response.data?.[0].quotationNumber).toBe("QT-1002");
  });
});