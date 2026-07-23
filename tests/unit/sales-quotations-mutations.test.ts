import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import {
  approveQuotationApproval,
  findApproversForRole,
  findPendingApprovalForRole,
  rejectQuotationApproval,
  resubmitQuotationForApproval,
  submitQuotationForApproval,
  updateSalesQuotationDetails,
} from "@/lib/sales/quotations";

const ok = { data: null, error: null };
const fail = { data: null, error: { message: "boom" } };
const user = { id: "u1" };
// These functions resolve the actor via getCurrentProfile(), which does its
// own `.from("profiles")` lookup (separate from any other table's queue)
// after auth.getClaims().
const profileRow = {
  data: {
    id: "u1",
    email: "u1@example.com",
    department: "sales",
    is_active: true,
    role: "sales_manager",
    is_executive_viewer: false,
  },
  error: null,
};

const detailsInput = {
  quotationId: "q1",
  hasUnequalMargins: false,
  items: [{ id: "i1", marginPercentage: 10, bankPercentage: 5, sopPercentage: 2 }],
  googleDriveLink: null,
  paymentTerms: "net30",
  paymentTermsCustom: null,
  leadTimeDays: 14,
  notes: null,
};

const oneQuotationItem = [{ id: "i1", line_total: "1000000", quantity: "1" }];

describe("updateSalesQuotationDetails", () => {
  it("requires an authenticated user", async () => {
    mockClient = createSupabaseMock({ user: null });
    await expect(updateSalesQuotationDetails(detailsInput)).rejects.toThrow(
      /must be signed in/,
    );
  });

  it("throws when the quotation is missing", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, quotations: fail },
    });
    await expect(updateSalesQuotationDetails(detailsInput)).rejects.toThrow(
      /Quotation was not found/,
    );
  });

  it("rejects quotations outside the sales phase", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: { data: { id: "q1", phase: "engineering" }, error: null },
      },
    });
    await expect(updateSalesQuotationDetails(detailsInput)).rejects.toThrow(
      /not yet in the sales phase/,
    );
  });

  it("blocks edits when not a draft and not re-opened for a PO", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: {
          data: {
            id: "q1",
            phase: "sales",
            status: "approved",
            client_confirmed_at: null,
            converted_po_id: null,
            quotation_items: oneQuotationItem,
          },
          error: null,
        },
      },
    });
    await expect(updateSalesQuotationDetails(detailsInput)).rejects.toThrow(
      /can only be edited/,
    );
  });

  it("rejects when the priced items don't match the quotation's items", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: {
          data: {
            id: "q1",
            phase: "sales",
            status: "draft",
            client_confirmed_at: null,
            converted_po_id: null,
            quotation_items: [],
          },
          error: null,
        },
      },
    });
    await expect(updateSalesQuotationDetails(detailsInput)).rejects.toThrow(
      /Every line item on this quotation needs pricing/,
    );
  });

  it("updates a draft quotation", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: [
          {
            data: {
              id: "q1",
              phase: "sales",
              status: "draft",
              client_confirmed_at: null,
              converted_po_id: null,
              quotation_items: oneQuotationItem,
            },
            error: null,
          },
          ok,
        ],
        quotation_items: ok,
      },
    });
    await expect(updateSalesQuotationDetails(detailsInput)).resolves.toBeUndefined();
  });

  it("allows edits on a quotation re-opened for a client PO", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: [
          {
            data: {
              id: "q1",
              phase: "sales",
              status: "approved",
              client_confirmed_at: "2026-01-01",
              converted_po_id: null,
              quotation_items: oneQuotationItem,
            },
            error: null,
          },
          ok,
        ],
        quotation_items: ok,
      },
    });
    await expect(updateSalesQuotationDetails(detailsInput)).resolves.toBeUndefined();
  });

  it("allows edits on a rejected quotation", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: [
          {
            data: {
              id: "q1",
              phase: "sales",
              status: "rejected",
              client_confirmed_at: null,
              converted_po_id: null,
              quotation_items: oneQuotationItem,
            },
            error: null,
          },
          ok,
        ],
        quotation_items: ok,
      },
    });
    await expect(updateSalesQuotationDetails(detailsInput)).resolves.toBeUndefined();
  });
});

describe("findApproversForRole", () => {
  it("returns approver ids", async () => {
    mockClient = createSupabaseMock({
      tables: { profiles: { data: [{ id: "a1" }, { id: "a2" }], error: null } },
    });
    await expect(findApproversForRole("owner")).resolves.toEqual([
      { id: "a1" },
      { id: "a2" },
    ]);
  });

  it("throws when no active approver exists", async () => {
    mockClient = createSupabaseMock({ tables: { profiles: { data: [], error: null } } });
    await expect(findApproversForRole("sales_manager")).rejects.toThrow(
      /No active approver/,
    );
  });
});

describe("findPendingApprovalForRole", () => {
  it("requires an authenticated user", async () => {
    mockClient = createSupabaseMock({ user: null });
    await expect(
      findPendingApprovalForRole({ quotationId: "q1", role: "owner" }),
    ).rejects.toThrow(/must be signed in/);
  });

  it("returns the approval id when a pending assignment exists", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotation_approvals: { data: { id: "ap1" }, error: null },
      },
    });
    await expect(
      findPendingApprovalForRole({ quotationId: "q1", role: "owner" }),
    ).resolves.toEqual({ approvalId: "ap1" });
  });

  it("returns null when there is no pending assignment", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, quotation_approvals: { data: null, error: null } },
    });
    await expect(
      findPendingApprovalForRole({ quotationId: "q1", role: "owner" }),
    ).resolves.toBeNull();
  });

  it("throws when the lookup errors", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, quotation_approvals: fail },
    });
    await expect(
      findPendingApprovalForRole({ quotationId: "q1", role: "owner" }),
    ).rejects.toThrow(/verify approval assignment/);
  });
});

describe("submitQuotationForApproval", () => {
  const draftRow = {
    id: "q1",
    amount: "1000000",
    status: "draft",
    phase: "sales",
    sales_margin_percent: "10",
    payment_terms: "net30",
    lead_time_days: 14,
  };

  it("rejects incomplete quotations", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: {
          data: { ...draftRow, sales_margin_percent: null },
          error: null,
        },
      },
    });
    await expect(submitQuotationForApproval("q1")).rejects.toThrow(
      /Margin, payment terms, and lead time are required/,
    );
  });

  it("rejects non-draft quotations", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: { data: { ...draftRow, status: "pending" }, error: null },
      },
    });
    await expect(submitQuotationForApproval("q1")).rejects.toThrow(
      /Only draft quotations/,
    );
  });

  it("creates approvals and marks the quotation pending", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        quotations: [{ data: draftRow, error: null }, ok],
        profiles: { data: [{ id: "mgr1" }], error: null },
        quotation_approvals: ok,
      },
    });
    await expect(submitQuotationForApproval("q1")).resolves.toBeUndefined();
  });
});

describe("approve / reject quotation approval", () => {
  it("approveQuotationApproval resolves and surfaces errors", async () => {
    mockClient = createSupabaseMock({ tables: { quotation_approvals: ok } });
    await expect(
      approveQuotationApproval({ approvalId: "ap1" }),
    ).resolves.toBeUndefined();

    mockClient = createSupabaseMock({ tables: { quotation_approvals: fail } });
    await expect(approveQuotationApproval({ approvalId: "ap1" })).rejects.toThrow("boom");
  });

  it("rejectQuotationApproval resolves and surfaces errors", async () => {
    mockClient = createSupabaseMock({ tables: { quotation_approvals: ok } });
    await expect(
      rejectQuotationApproval({ approvalId: "ap1", reason: "too low" }),
    ).resolves.toBeUndefined();

    mockClient = createSupabaseMock({ tables: { quotation_approvals: fail } });
    await expect(
      rejectQuotationApproval({ approvalId: "ap1", reason: "too low" }),
    ).rejects.toThrow("boom");
  });
});

describe("resubmitQuotationForApproval", () => {
  const rejectedRow = {
    id: "q1",
    status: "rejected",
    amount: "1000000",
    sales_margin_percent: "10",
    payment_terms: "30 Days",
    lead_time_days: 14,
  };

  it("throws when the quotation is missing", async () => {
    mockClient = createSupabaseMock({ tables: { quotations: fail } });
    await expect(resubmitQuotationForApproval("q1")).rejects.toThrow(/not found/);
  });

  it("only allows resubmitting rejected quotations", async () => {
    mockClient = createSupabaseMock({
      tables: { quotations: { data: { id: "q1", status: "draft" }, error: null } },
    });
    await expect(resubmitQuotationForApproval("q1")).rejects.toThrow(
      /Only rejected quotations/,
    );
  });

  it("rejects incomplete quotations", async () => {
    mockClient = createSupabaseMock({
      tables: {
        quotations: {
          data: { ...rejectedRow, sales_margin_percent: null },
          error: null,
        },
      },
    });
    await expect(resubmitQuotationForApproval("q1")).rejects.toThrow(
      /Margin, payment terms, and lead time are required/,
    );
  });

  it("resubmits a rejected quotation and recreates approval assignments", async () => {
    mockClient = createSupabaseMock({
      tables: {
        // 1) select quotation, 2) update quotation to pending
        quotations: [{ data: rejectedRow, error: null }, ok],
        // 1) delete old approvals, 2) insert new approvals
        quotation_approvals: [ok, ok],
        profiles: { data: [{ id: "mgr1" }], error: null },
      },
    });
    await expect(resubmitQuotationForApproval("q1")).resolves.toBeUndefined();
  });
});
