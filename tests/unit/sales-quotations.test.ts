import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import {
  aggregateQuotationStatus,
  determineApprovalLevel,
  listPendingApprovalsForCurrentUser,
  listSalesQuotations,
  parseLeadTimeDays,
  parsePercentInput,
  parseQuotationAmount,
  parseSalesMarginPercent,
  requiresExecutiveApproval,
} from "@/lib/sales/quotations";

describe("quotation input parsers", () => {
  it("parseQuotationAmount accepts positive numbers and rejects the rest", () => {
    expect(parseQuotationAmount("1500")).toBe(1500);
    expect(() => parseQuotationAmount("0")).toThrow(/greater than 0/);
    expect(() => parseQuotationAmount("-5")).toThrow(/greater than 0/);
    expect(() => parseQuotationAmount("abc")).toThrow(/greater than 0/);
  });

  it("parseSalesMarginPercent enforces a 0–100 range", () => {
    expect(parseSalesMarginPercent("0")).toBe(0);
    expect(parseSalesMarginPercent("100")).toBe(100);
    expect(() => parseSalesMarginPercent("-1")).toThrow(/between 0 and 100/);
    expect(() => parseSalesMarginPercent("101")).toThrow(/between 0 and 100/);
  });

  it("parsePercentInput requires a non-negative number and labels errors", () => {
    expect(parsePercentInput("12.5", "Bank")).toBe(12.5);
    expect(() => parsePercentInput("-1", "Bank")).toThrow("Bank must be 0 or greater.");
    expect(() => parsePercentInput("x", "SOP")).toThrow("SOP must be 0 or greater.");
  });

  it("parseLeadTimeDays requires a whole non-negative number", () => {
    expect(parseLeadTimeDays("14")).toBe(14);
    expect(parseLeadTimeDays("0")).toBe(0);
    expect(() => parseLeadTimeDays("1.5")).toThrow(/whole number/);
    expect(() => parseLeadTimeDays("-3")).toThrow(/whole number/);
  });
});

describe("quotation approval routing", () => {
  it("requiresExecutiveApproval trips at the 3M threshold", () => {
    expect(requiresExecutiveApproval(2_999_999.99)).toBe(false);
    expect(requiresExecutiveApproval(3_000_000)).toBe(true);
  });

  it("determineApprovalLevel maps amount to the approval chain", () => {
    expect(determineApprovalLevel(1_000_000)).toBe("sales_manager_only");
    expect(determineApprovalLevel(3_000_000)).toBe("sales_manager_owner_executive");
  });

  it("aggregateQuotationStatus treats cancelled like approved for completion", () => {
    expect(aggregateQuotationStatus(["approved", "cancelled"])).toBe("approved");
    expect(aggregateQuotationStatus(["cancelled", "cancelled"])).toBe("approved");
    expect(aggregateQuotationStatus(["approved", "cancelled", "pending"])).toBe(
      "pending",
    );
    expect(aggregateQuotationStatus(["cancelled", "rejected"])).toBe("rejected");
  });
});

describe("listSalesQuotations", () => {
  const baseRow = {
    id: "q1",
    quotation_number: "Q-1",
    client_id: "c1",
    subject: "Roof upgrade",
    amount: "1500000",
    cost: "1000000",
    google_drive_link: null,
    notes: null,
    status: "pending",
    prepared_by: "u1",
    sales_person_id: "u1",
    created_at: "2026-01-01",
    costing_approved_at: null,
    sales_margin_percent: "10",
    margin_percentage: "10",
    margin_amount: "100000",
    bank_percentage: null,
    bank_amount: null,
    sop_percentage: null,
    sop_amount: null,
    selling_amount: "1500000",
    payment_terms: "net30",
    payment_terms_custom: null,
    lead_time_days: "14",
    client_po_number: null,
    client_confirmed_at: null,
    converted_po_id: null,
    po_converted_at: null,
    clients: { company_name: "Alpha Corp" },
    converted_po: null,
    quotation_approvals: [],
  };

  it("maps rows and de-duplicates only the pending approver roles", async () => {
    mockClient = createSupabaseMock({
      tables: {
        quotations: {
          data: [
            {
              ...baseRow,
              preparer: { full_name: "Jane Author", email: "jane@example.com" },
              quotation_approvals: [
                { approver_role: "sales_manager", status: "pending" },
                { approver_role: "sales_manager", status: "pending" },
                { approver_role: "owner", status: "approved" },
                { approver_role: "not-a-role", status: "pending" },
              ],
            },
          ],
          error: null,
        },
      },
    });

    const [quotation] = await listSalesQuotations();

    expect(quotation.id).toBe("q1");
    expect(quotation.clientName).toBe("Alpha Corp");
    expect(quotation.amount).toBe(1500000);
    expect(quotation.cost).toBe(1000000);
    expect(quotation.salesMarginPercent).toBe(10);
    expect(quotation.marginAmount).toBe(100000);
    expect(quotation.leadTimeDays).toBe(14);
    expect(quotation.pendingApprovalRoles).toEqual(["sales_manager"]);
    expect(quotation.convertedPoStatus).toBeNull();
    expect(quotation.preparedByName).toBe("Jane Author");
  });

  it("falls back to the email username when the preparer has no full name", async () => {
    mockClient = createSupabaseMock({
      tables: {
        quotations: {
          data: [{ ...baseRow, preparer: { full_name: null, email: "jane@example.com" } }],
          error: null,
        },
      },
    });

    const [quotation] = await listSalesQuotations();

    expect(quotation.preparedByName).toBe("jane");
  });

  it("reads converted PO status from an array relation and falls back on unknown clients", async () => {
    mockClient = createSupabaseMock({
      tables: {
        quotations: {
          data: [
            {
              ...baseRow,
              clients: null,
              converted_po: [{ status: "approved" }],
            },
          ],
          error: null,
        },
      },
    });

    const [quotation] = await listSalesQuotations();

    expect(quotation.clientName).toBe("Unknown client");
    expect(quotation.convertedPoStatus).toBe("approved");
    expect(quotation.preparedByName).toBe("Unknown");
  });

  it("throws when the query fails", async () => {
    mockClient = createSupabaseMock({
      tables: { quotations: { data: null, error: { message: "db down" } } },
    });

    await expect(listSalesQuotations()).rejects.toThrow("db down");
  });
});

describe("listPendingApprovalsForCurrentUser", () => {
  it("returns an empty list when no user is signed in", async () => {
    mockClient = createSupabaseMock({ user: null });

    await expect(listPendingApprovalsForCurrentUser()).resolves.toEqual([]);
  });

  it("maps approval rows including the joined quotation fields", async () => {
    mockClient = createSupabaseMock({
      user: { id: "u1" },
      tables: {
        quotation_approvals: {
          data: [
            {
              id: "a1",
              quotation_id: "q1",
              approver_role: "owner",
              status: "pending",
              quotations: {
                quotation_number: "Q-1",
                subject: "Roof upgrade",
                amount: "1500000",
                cost: "900000",
                margin_amount: "150000",
                sector: "residential",
                google_drive_link: "https://drive.example/q1",
                notes: "Rush order",
                created_at: "2026-01-05T00:00:00.000Z",
                clients: { company_name: "Acme Corp" },
                preparer: { full_name: "Jane Author", email: "jane@example.com" },
              },
            },
          ],
          error: null,
        },
      },
    });

    const [item] = await listPendingApprovalsForCurrentUser();

    expect(item).toEqual({
      approvalId: "a1",
      quotationId: "q1",
      quotationNumber: "Q-1",
      subject: "Roof upgrade",
      amount: 1500000,
      approverRole: "owner",
      status: "pending",
      clientName: "Acme Corp",
      cost: 900000,
      marginAmount: 150000,
      sector: "residential",
      googleDriveLink: "https://drive.example/q1",
      notes: "Rush order",
      createdAt: "2026-01-05T00:00:00.000Z",
      preparedByName: "Jane Author",
    });
  });
});
