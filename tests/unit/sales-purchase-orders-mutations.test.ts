import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import {
  addPoPayment,
  approvePoApproval,
  convertQuotationToPurchaseOrder,
  findPendingPoApprovalForRole,
  markClientPoReceived,
  rejectPoApproval,
  resubmitPurchaseOrderForApproval,
  updatePurchaseOrderDetails,
} from "@/lib/sales/purchase-orders";

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

describe("markClientPoReceived", () => {
  const input = { quotationId: "q1", clientPoNumber: "CPO-1" };

  it("requires an authenticated user", async () => {
    mockClient = createSupabaseMock({ user: null });
    await expect(markClientPoReceived(input)).rejects.toThrow(/must be signed in/);
  });

  it("throws when the update query errors", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, quotations: fail },
    });
    await expect(markClientPoReceived(input)).rejects.toThrow("boom");
  });

  it("blocks quotations that aren't approved, wrong phase, or already converted", async () => {
    // The guard (phase='sales', status='approved', not yet converted) is
    // enforced by the UPDATE's own WHERE clause; a non-matching row simply
    // returns no data, same as "not found".
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, quotations: { data: null, error: null } },
    });
    await expect(markClientPoReceived(input)).rejects.toThrow(
      /haven't been converted yet can be re-opened/,
    );
  });

  it("records the client PO on a valid quotation", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: { data: { id: "q1" }, error: null },
      },
    });
    await expect(markClientPoReceived(input)).resolves.toBeUndefined();
  });
});

describe("convertQuotationToPurchaseOrder", () => {
  const baseQuotation = {
    id: "q1",
    status: "approved",
    phase: "sales",
    client_id: "c1",
    sector: "commercial",
    subject: "Roof upgrade",
    amount: "1000000",
    cost: "700000",
    margin_percentage: "10",
    margin_amount: "100000",
    bank_percentage: null,
    bank_amount: null,
    sop_percentage: null,
    sop_amount: null,
    selling_amount: "1000000",
    payment_terms: "net30",
    payment_terms_custom: null,
    lead_time_days: 14,
    client_po_number: "CPO-1",
    client_confirmed_at: "2026-01-01",
    converted_po_id: null,
  };

  it("requires an authenticated user", async () => {
    mockClient = createSupabaseMock({ user: null });
    await expect(convertQuotationToPurchaseOrder("q1")).rejects.toThrow(
      /must be signed in/,
    );
  });

  it("throws when the quotation is missing", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, quotations: fail },
    });
    await expect(convertQuotationToPurchaseOrder("q1")).rejects.toThrow(/was not found/);
  });

  it("only converts approved sales-phase quotations", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: { data: { ...baseQuotation, status: "draft" }, error: null },
      },
    });
    await expect(convertQuotationToPurchaseOrder("q1")).rejects.toThrow(
      /Only approved quotations/,
    );
  });

  it("requires the client PO to be recorded first", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: {
          data: { ...baseQuotation, client_confirmed_at: null },
          error: null,
        },
      },
    });
    await expect(convertQuotationToPurchaseOrder("q1")).rejects.toThrow(
      /Record the client's PO/,
    );
  });

  it("blocks a quotation that was already converted", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: {
          data: { ...baseQuotation, converted_po_id: "existing-po" },
          error: null,
        },
      },
    });
    await expect(convertQuotationToPurchaseOrder("q1")).rejects.toThrow(
      /already been converted/,
    );
  });

  it("converts a low-value quotation, routing approval to sales_manager only", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        quotations: [{ data: baseQuotation, error: null }, ok], // select, then link update
        purchase_orders: [
          { data: null, error: null, count: 3 }, // po_number count
          { data: { id: "po1" }, error: null }, // insert
        ],
        profiles: { data: [{ id: "mgr1" }], error: null },
        po_approvals: ok,
      },
    });

    await expect(convertQuotationToPurchaseOrder("q1")).resolves.toEqual({
      purchaseOrderId: "po1",
    });
  });

  it("snapshots per-item pricing into purchase_order_items on conversion", async () => {
    let insertedItems: Array<Record<string, unknown>> | undefined;
    mockClient = createSupabaseMock({
      user,
      tables: {
        quotations: [
          {
            data: {
              ...baseQuotation,
              quotation_items: [
                {
                  description: "Pump",
                  quantity: 2,
                  raw_cost: "325000",
                  unit_cost: "350000",
                  sort_order: 0,
                  margin_percentage: "10",
                  margin_amount: "70000",
                  bank_percentage: null,
                  bank_amount: null,
                  sop_percentage: null,
                  sop_amount: null,
                  selling_amount: "770000",
                },
              ],
            },
            error: null,
          },
          ok, // link update
        ],
        purchase_orders: [
          { data: null, error: null, count: 3 },
          { data: { id: "po1" }, error: null },
        ],
        purchase_order_items: ok,
        profiles: { data: [{ id: "mgr1" }], error: null },
        po_approvals: ok,
      },
    });

    const originalFrom = mockClient.from;
    mockClient.from = vi.fn((table: string) => {
      const builder = originalFrom(table);
      if (table === "purchase_order_items") {
        const originalInsert = builder.insert;
        builder.insert = vi.fn((rows: Array<Record<string, unknown>>) => {
          insertedItems = rows;
          return originalInsert(rows);
        });
      }
      return builder;
    });

    await expect(convertQuotationToPurchaseOrder("q1")).resolves.toEqual({
      purchaseOrderId: "po1",
    });

    expect(insertedItems).toEqual([
      expect.objectContaining({
        description: "Pump",
        raw_cost: "325000",
        unit_cost: "350000",
        margin_percentage: "10",
        margin_amount: "70000",
        bank_percentage: null,
        sop_percentage: null,
        selling_amount: "770000",
      }),
    ]);
  });

  it("still only seeds the sales_manager stage for a high-value quotation (chain is sequential)", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        quotations: [{ data: { ...baseQuotation, amount: "3000000" }, error: null }, ok],
        purchase_orders: [
          { data: null, error: null, count: 0 },
          { data: { id: "po2" }, error: null },
        ],
        profiles: { data: [{ id: "approver1" }], error: null },
        po_approvals: ok,
      },
    });

    await expect(convertQuotationToPurchaseOrder("q1")).resolves.toEqual({
      purchaseOrderId: "po2",
    });
  });

  it("retries with the next sequence number on a po_number unique violation", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        quotations: [{ data: baseQuotation, error: null }, ok],
        purchase_orders: [
          { data: null, error: null, count: 3 },
          { data: null, error: { code: "23505", message: "duplicate" } }, // first insert
          { data: { id: "po3" }, error: null }, // retry insert
        ],
        profiles: { data: [{ id: "mgr1" }], error: null },
        po_approvals: ok,
      },
    });

    await expect(convertQuotationToPurchaseOrder("q1")).resolves.toEqual({
      purchaseOrderId: "po3",
    });
  });

  it("throws when the purchase order insert fails for a non-collision reason", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        quotations: { data: baseQuotation, error: null },
        purchase_orders: [
          { data: null, error: null, count: 3 },
          { data: null, error: { message: "insert boom" } },
        ],
      },
    });

    await expect(convertQuotationToPurchaseOrder("q1")).rejects.toThrow("insert boom");
  });

  it("throws when creating PO approval assignments fails", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        quotations: { data: baseQuotation, error: null },
        purchase_orders: [
          { data: null, error: null, count: 3 },
          { data: { id: "po1" }, error: null },
        ],
        profiles: { data: [{ id: "mgr1" }], error: null },
        po_approvals: { data: null, error: { message: "approval insert boom" } },
      },
    });

    await expect(convertQuotationToPurchaseOrder("q1")).rejects.toThrow(
      "approval insert boom",
    );
  });

  it("throws when linking the PO back to the quotation fails", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        quotations: [
          { data: baseQuotation, error: null },
          { data: null, error: { message: "link boom" } },
        ],
        purchase_orders: [
          { data: null, error: null, count: 3 },
          { data: { id: "po1" }, error: null },
        ],
        profiles: { data: [{ id: "mgr1" }], error: null },
        po_approvals: ok,
      },
    });

    await expect(convertQuotationToPurchaseOrder("q1")).rejects.toThrow("link boom");
  });
});

describe("findPendingPoApprovalForRole", () => {
  it("requires an authenticated user", async () => {
    mockClient = createSupabaseMock({ user: null });
    await expect(
      findPendingPoApprovalForRole({ poId: "p1", role: "owner" }),
    ).rejects.toThrow(/must be signed in/);
  });

  it("returns the approval id when present, otherwise null", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        po_approvals: { data: { id: "pa1" }, error: null },
      },
    });
    await expect(
      findPendingPoApprovalForRole({ poId: "p1", role: "owner" }),
    ).resolves.toEqual({ approvalId: "pa1" });

    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, po_approvals: { data: null, error: null } },
    });
    await expect(
      findPendingPoApprovalForRole({ poId: "p1", role: "owner" }),
    ).resolves.toBeNull();
  });

  it("throws when the lookup errors", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, po_approvals: fail },
    });
    await expect(
      findPendingPoApprovalForRole({ poId: "p1", role: "owner" }),
    ).rejects.toThrow(/verify PO approval assignment/);
  });
});

describe("approvePoApproval", () => {
  it("marks the approval row approved", async () => {
    // Status rollup and next-stage row creation now happen in the
    // fn_sync_po_status_from_approvals Postgres trigger, not here -- this
    // only needs to update the one po_approvals row.
    mockClient = createSupabaseMock({ tables: { po_approvals: ok } });
    await expect(
      approvePoApproval({ poId: "p1", approvalId: "pa1" }),
    ).resolves.toBeUndefined();
  });

  it("throws when the approval update fails", async () => {
    mockClient = createSupabaseMock({ tables: { po_approvals: fail } });
    await expect(approvePoApproval({ poId: "p1", approvalId: "pa1" })).rejects.toThrow(
      "boom",
    );
  });
});

describe("rejectPoApproval", () => {
  it("rejects the approval and returns the PO to rejected", async () => {
    mockClient = createSupabaseMock({
      tables: { po_approvals: ok, purchase_orders: ok },
    });
    await expect(
      rejectPoApproval({ poId: "p1", approvalId: "pa1", reason: "no" }),
    ).resolves.toBeUndefined();
  });

  it("throws when the approval rejection fails", async () => {
    mockClient = createSupabaseMock({ tables: { po_approvals: fail } });
    await expect(
      rejectPoApproval({ poId: "p1", approvalId: "pa1", reason: "no" }),
    ).rejects.toThrow("boom");
  });
});

describe("resubmitPurchaseOrderForApproval", () => {
  it("throws when the PO is missing", async () => {
    mockClient = createSupabaseMock({ tables: { purchase_orders: fail } });
    await expect(resubmitPurchaseOrderForApproval("p1")).rejects.toThrow(/was not found/);
  });

  it("only resubmits rejected purchase orders", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: { id: "p1", status: "approved", po_amount: "1000000" },
          error: null,
        },
      },
    });
    await expect(resubmitPurchaseOrderForApproval("p1")).rejects.toThrow(
      /Only rejected purchase orders/,
    );
  });

  it("resubmits a rejected PO and recreates approval assignments", async () => {
    mockClient = createSupabaseMock({
      tables: {
        // 1) select PO, 2) update PO to pending
        purchase_orders: [
          { data: { id: "p1", status: "rejected", po_amount: "1000000" }, error: null },
          ok,
        ],
        // 1) delete old approvals, 2) insert new approvals
        po_approvals: [ok, ok],
        profiles: { data: [{ id: "mgr1" }], error: null },
      },
    });
    await expect(resubmitPurchaseOrderForApproval("p1")).resolves.toBeUndefined();
  });
});

describe("updatePurchaseOrderDetails", () => {
  const input = {
    purchaseOrderId: "p1",
    hasUnequalMargins: false,
    items: [
      { id: "i1", marginPercentage: 10, bankPercentage: null, sopPercentage: null },
    ],
    paymentTerms: "30 Days",
    paymentTermsCustom: null,
    leadTimeDays: 14,
    clientPoNumber: "cpo-1",
    quotationReference: "q-1",
  };
  const onePoItem = [{ id: "i1", line_total: "700000", quantity: "1" }];

  it("throws when the purchase order is missing", async () => {
    mockClient = createSupabaseMock({ tables: { purchase_orders: fail } });
    await expect(updatePurchaseOrderDetails(input)).rejects.toThrow(/was not found/);
  });

  it("only allows editing a rejected purchase order", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: { id: "p1", status: "pending", purchase_order_items: onePoItem },
          error: null,
        },
      },
    });
    await expect(updatePurchaseOrderDetails(input)).rejects.toThrow(
      /Only rejected purchase orders/,
    );
  });

  it("rejects when the priced items don't match the PO's items", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: { id: "p1", status: "rejected", purchase_order_items: [] },
          error: null,
        },
      },
    });
    await expect(updatePurchaseOrderDetails(input)).rejects.toThrow(
      /Every line item on this purchase order needs pricing/,
    );
  });

  it("recomputes pricing from each item's direct cost and saves it, uppercasing references", async () => {
    let updatePayload: Record<string, unknown> | undefined;
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: [
          {
            data: { id: "p1", status: "rejected", purchase_order_items: onePoItem },
            error: null,
          },
          ok,
        ],
        purchase_order_items: ok,
      },
    });
    const originalUpdate = mockClient.from;
    mockClient.from = vi.fn((table: string) => {
      const builder = originalUpdate(table);
      const originalUpdateFn = builder.update;
      builder.update = vi.fn((payload: Record<string, unknown>) => {
        if (table === "purchase_orders") {
          updatePayload = payload;
        }
        return originalUpdateFn(payload);
      });
      return builder;
    });

    await expect(updatePurchaseOrderDetails(input)).resolves.toBeUndefined();

    expect(updatePayload).toMatchObject({
      // Margin is gross margin ON the selling price: Selling = 700000 / (1 - 0.10)
      // = 777777.78, so margin_amount is 77777.78, not 70000, and the blended
      // margin_percentage (77777.78 / 700000) comes back as 11.11.
      margin_percentage: 11.11,
      margin_amount: 77777.78,
      // The exact total, not rounded up to the nearest 100.
      selling_amount: 777777.78,
      // VAT is already resolved within cost/margin (see computeSalesPricing) --
      // po_amount is just selling_amount, nothing added on top.
      po_amount: 777777.78,
      client_po_number: "CPO-1",
      quotation_reference: "Q-1",
    });
  });

  it("throws when the update fails", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: [
          {
            data: { id: "p1", status: "rejected", purchase_order_items: onePoItem },
            error: null,
          },
          fail,
        ],
        purchase_order_items: ok,
      },
    });
    await expect(updatePurchaseOrderDetails(input)).rejects.toThrow("boom");
  });
});

describe("addPoPayment", () => {
  const input = {
    purchaseOrderId: "p1",
    amountCollected: 200000,
    proofPath: "user1/p1/proof.webp",
  };

  it("throws when the purchase order is missing", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { profiles: profileRow, purchase_orders: fail },
    });
    await expect(addPoPayment(input)).rejects.toThrow(/was not found/);
  });

  it("only records payments against approved purchase orders", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        purchase_orders: {
          data: {
            id: "p1",
            status: "pending",
            po_amount: "1000000",
            created_by: user.id,
          },
          error: null,
        },
      },
    });
    await expect(addPoPayment(input)).rejects.toThrow(
      /only be recorded against approved/,
    );
  });

  it("rejects collections that exceed the PO amount", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        purchase_orders: {
          data: {
            id: "p1",
            status: "approved",
            po_amount: "100000",
            recognized_amount: "0",
            created_by: user.id,
          },
          error: null,
        },
      },
    });
    await expect(
      addPoPayment({
        purchaseOrderId: "p1",
        amountCollected: 200000,
        proofPath: "user1/p1/proof.webp",
      }),
    ).rejects.toThrow(/cannot exceed/);
  });

  it("records a collection and refreshes recognized totals", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        // 1) select PO, 2) update PO totals
        purchase_orders: [
          {
            data: {
              id: "p1",
              quotation_id: "q1",
              status: "approved",
              po_amount: "1000000",
              recognized_amount: "300000",
              created_by: user.id,
            },
            error: null,
          },
          ok,
        ],
        // 1) insert payment, 2) select all payments for the PO
        po_payments: [
          ok,
          {
            data: [{ amount_collected: "300000" }, { amount_collected: "200000" }],
            error: null,
          },
        ],
      },
    });
    await expect(
      addPoPayment({
        purchaseOrderId: "p1",
        amountCollected: 200000,
        proofPath: "user1/p1/proof.webp",
      }),
    ).resolves.toBeUndefined();
  });
});
