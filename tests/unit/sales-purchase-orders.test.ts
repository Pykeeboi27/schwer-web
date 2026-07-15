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
  });

  it("throws when the query fails", async () => {
    mockClient = createSupabaseMock({
      tables: { purchase_orders: { data: null, error: { message: "po fail" } } },
    });

    await expect(listPurchaseOrders()).rejects.toThrow("po fail");
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
