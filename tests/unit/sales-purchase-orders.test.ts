import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import {
  listPendingPoApprovalsForCurrentUser,
  listPoPayments,
  listPurchaseOrders,
} from "@/lib/sales/purchase-orders";

describe("listPurchaseOrders", () => {
  const baseRow = {
    id: "p1",
    quotation_id: "q1",
    po_number: "PO-2026-0001",
    client_po_number: "CPO-1",
    quotation_reference: "Q-1",
    client_id: "c1",
    subject: "Roof upgrade",
    po_amount: "1500000",
    cost: "1000000",
    margin_percentage: "10",
    margin_amount: "100000",
    bank_percentage: null,
    bank_amount: null,
    sop_percentage: null,
    sop_amount: null,
    selling_amount: "1500000",
    recognized_amount: "500000",
    payment_status: "partial",
    payment_terms: "net30",
    payment_terms_custom: null,
    lead_time_days: "14",
    status: "approved",
    approved_at: "2026-02-01",
    created_at: "2026-01-01",
    created_by: "u1",
    clients: { company_name: "Alpha Corp" },
    po_approvals: [],
  };

  it("maps rows, totals, and de-duplicates pending approver roles", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: [
            {
              ...baseRow,
              creator: { full_name: "Jane Author", email: "jane@example.com" },
              po_approvals: [
                { approver_role: "owner", status: "pending" },
                { approver_role: "owner", status: "pending" },
                { approver_role: "executive", status: "approved" },
              ],
            },
          ],
          error: null,
        },
      },
    });

    const [po] = await listPurchaseOrders();

    expect(po.id).toBe("p1");
    expect(po.clientName).toBe("Alpha Corp");
    expect(po.poAmount).toBe(1500000);
    expect(po.recognizedAmount).toBe(500000);
    expect(po.paymentStatus).toBe("partial");
    expect(po.status).toBe("approved");
    expect(po.pendingApprovalRoles).toEqual(["owner"]);
    expect(po.createdByName).toBe("Jane Author");
  });

  it("attributes a manually-encoded PO to its assigned sales person (created_by), same as any other PO", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: [
            {
              ...baseRow,
              is_manually_encoded: true,
              creator: { full_name: "Jane Author", email: "jane@example.com" },
            },
          ],
          error: null,
        },
      },
    });

    const [po] = await listPurchaseOrders();

    expect(po.isManuallyEncoded).toBe(true);
    expect(po.createdByName).toBe("Jane Author");
  });

  it("falls back to the email username when the creator has no full name", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: [{ ...baseRow, creator: { full_name: null, email: "jane@example.com" } }],
          error: null,
        },
      },
    });

    const [po] = await listPurchaseOrders();

    expect(po.createdByName).toBe("jane");
  });

  it("applies defaults for missing client, status, and recognized amount", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: [
            {
              ...baseRow,
              clients: null,
              status: null,
              recognized_amount: null,
              payment_status: null,
            },
          ],
          error: null,
        },
      },
    });

    const [po] = await listPurchaseOrders();

    expect(po.clientName).toBe("Unknown client");
    expect(po.status).toBe("pending");
    expect(po.recognizedAmount).toBe(0);
    expect(po.paymentStatus).toBe("unpaid");
    expect(po.createdByName).toBe("Unknown");
  });

  it("throws when the query fails", async () => {
    mockClient = createSupabaseMock({
      tables: { purchase_orders: { data: null, error: { message: "po fail" } } },
    });

    await expect(listPurchaseOrders()).rejects.toThrow("po fail");
  });

  it("surfaces the most recent rejection's reason and rejector name", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: [
            {
              ...baseRow,
              po_approvals: [
                {
                  approver_role: "owner",
                  status: "rejected",
                  rejection_reason: "Pricing needs revision",
                  updated_at: "2026-01-01T00:00:00.000Z",
                  approver: { full_name: "Olive Owner", email: "olive@example.com" },
                },
                {
                  approver_role: "sales_manager",
                  status: "rejected",
                  rejection_reason: "Stale reason",
                  updated_at: "2025-12-01T00:00:00.000Z",
                  approver: { full_name: "Old Manager", email: "old@example.com" },
                },
              ],
            },
          ],
          error: null,
        },
      },
    });

    const [po] = await listPurchaseOrders();

    expect(po.rejectionReason).toBe("Pricing needs revision");
    expect(po.rejectedByName).toBe("Olive Owner");
  });

  it("has no rejection info when nothing was rejected", async () => {
    mockClient = createSupabaseMock({
      tables: { purchase_orders: { data: [{ ...baseRow }], error: null } },
    });

    const [po] = await listPurchaseOrders();

    expect(po.rejectionReason).toBeNull();
    expect(po.rejectedByName).toBeNull();
  });

  it("recomputes item and record amounts from stored cost/percentages instead of trusting stale stored amounts", async () => {
    // Same stale-formula scenario as the quotations test: this row's
    // margin/bank/sop_amount were persisted under the pre-1119d85 flat
    // formula. listPurchaseOrders must recompute, not echo, sop_amount.
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: [
            {
              ...baseRow,
              margin_amount: "85500",
              bank_amount: "14250",
              sop_amount: "14250",
              selling_amount: "399000",
              purchase_order_items: [
                {
                  id: "i1",
                  description: "Panel",
                  quantity: "1",
                  unit_cost: "285000",
                  line_total: "285000",
                  sort_order: 1,
                  margin_percentage: "30",
                  margin_amount: "85500",
                  bank_percentage: "5",
                  bank_amount: "14250",
                  sop_percentage: "5",
                  sop_amount: "14250",
                  selling_amount: "399000",
                },
              ],
            },
          ],
          error: null,
        },
      },
    });

    const [po] = await listPurchaseOrders();

    expect(po.items[0].sopAmount).toBeCloseTo(21375, 2);
    expect(po.sopAmount).toBeCloseTo(21375, 2);
    expect(po.poAmount).toBeCloseTo(po.items[0].sellingAmount!, 2);
  });

  it("falls back to stored record amounts when no item is priced", async () => {
    mockClient = createSupabaseMock({
      tables: {
        purchase_orders: {
          data: [
            {
              ...baseRow,
              purchase_order_items: [
                {
                  id: "i1",
                  description: "Unpriced legacy item",
                  quantity: "1",
                  unit_cost: "285000",
                  line_total: "285000",
                  sort_order: 1,
                  margin_percentage: null,
                  margin_amount: null,
                  bank_percentage: null,
                  bank_amount: null,
                  sop_percentage: null,
                  sop_amount: null,
                  selling_amount: null,
                },
              ],
            },
          ],
          error: null,
        },
      },
    });

    const [po] = await listPurchaseOrders();

    expect(po.items[0].sopAmount).toBeNull();
    expect(po.marginAmount).toBe(100000);
    expect(po.poAmount).toBe(1500000);
  });
});

describe("listPendingPoApprovalsForCurrentUser", () => {
  it("returns an empty list when no user is signed in", async () => {
    mockClient = createSupabaseMock({ user: null });

    await expect(listPendingPoApprovalsForCurrentUser()).resolves.toEqual([]);
  });

  it("maps pending PO approval rows with joined purchase order fields", async () => {
    mockClient = createSupabaseMock({
      user: { id: "u1" },
      tables: {
        // listPendingPoApprovalsForCurrentUser resolves the actor via
        // getCurrentProfile(), which does its own `.from("profiles")` lookup.
        profiles: {
          data: {
            id: "u1",
            email: "u1@example.com",
            department: "executive",
            is_active: true,
            role: "executive",
            is_executive_viewer: false,
          },
          error: null,
        },
        po_approvals: {
          data: [
            {
              id: "a1",
              po_id: "p1",
              approver_role: "executive",
              status: "pending",
              purchase_orders: {
                po_number: "PO-2026-0001",
                subject: "Roof upgrade",
                po_amount: "1500000",
                cost: "1000000",
                margin_amount: "100000",
                sector: "residential",
                po_date: "2026-01-05",
                clients: { company_name: "Acme Corp" },
                creator: { full_name: "Jane Author", email: "jane@example.com" },
              },
            },
          ],
          error: null,
        },
      },
    });

    const [item] = await listPendingPoApprovalsForCurrentUser();

    expect(item).toEqual({
      approvalId: "a1",
      poId: "p1",
      poNumber: "PO-2026-0001",
      subject: "Roof upgrade",
      amount: 1500000,
      approverRole: "executive",
      status: "pending",
      clientName: "Acme Corp",
      cost: 1000000,
      marginAmount: 100000,
      sector: "residential",
      poDate: "2026-01-05",
      createdByName: "Jane Author",
    });
  });
});

describe("listPoPayments", () => {
  const paymentRow = {
    id: "pay1",
    po_id: "q1",
    purchase_order_id: "p1",
    amount_collected: "500000",
    payment_date: "2026-02-01",
    payment_method: "bank",
    reference_number: "R1",
  };

  it("maps payment rows for all purchase orders", async () => {
    mockClient = createSupabaseMock({
      tables: { po_payments: { data: [paymentRow], error: null } },
    });

    const [payment] = await listPoPayments();

    expect(payment).toEqual({
      id: "pay1",
      poId: "q1",
      purchaseOrderId: "p1",
      amountCollected: 500000,
      paymentDate: "2026-02-01",
      paymentMethod: "bank",
      referenceNumber: "R1",
      proofPath: null,
    });
  });

  it("supports filtering by a specific purchase order id", async () => {
    mockClient = createSupabaseMock({
      tables: { po_payments: { data: [paymentRow], error: null } },
    });

    const payments = await listPoPayments("p1");

    expect(payments).toHaveLength(1);
    expect(payments[0].purchaseOrderId).toBe("p1");
  });

  it("throws when the query fails", async () => {
    mockClient = createSupabaseMock({
      tables: { po_payments: { data: null, error: { message: "nope" } } },
    });

    await expect(listPoPayments()).rejects.toThrow(/Failed to load PO payments/);
  });
});
