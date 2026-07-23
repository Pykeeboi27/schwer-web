import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import {
  computeLandedUnitCost,
  parseRawCost,
  setQuotationItemCosts,
} from "@/lib/engineering/costing-quotations";

const user = { id: "u1" };
const profileRow = {
  data: {
    id: "u1",
    email: "u1@example.com",
    department: "engineering",
    is_active: true,
    role: "engineer",
    is_executive_viewer: false,
  },
  error: null,
};

describe("computeLandedUnitCost", () => {
  it("applies the fixed +3% OPEX then +1.5% delivery-fee markup, matching the Excel costing template", () => {
    // Worked example from the reference workbook (G16 PC tab, row 22):
    // Q = 2121.42 * 1.03 = 2185.0626; R = Q * 1.015 = 2217.838539 -> 2217.84.
    expect(computeLandedUnitCost(2121.42)).toBe(2217.84);
  });

  it("returns 0 for a raw cost of 0", () => {
    expect(computeLandedUnitCost(0)).toBe(0);
  });
});

describe("parseRawCost", () => {
  it("accepts 0 or greater and rejects everything else", () => {
    expect(parseRawCost("2121.42")).toBe(2121.42);
    expect(parseRawCost(0)).toBe(0);
    expect(() => parseRawCost(-1)).toThrow(/must be 0 or greater/);
    expect(() => parseRawCost("abc")).toThrow(/must be 0 or greater/);
  });
});

describe("setQuotationItemCosts", () => {
  const baseInput = {
    quotationId: "q1",
    clientId: "c1",
    subject: "Roof upgrade",
    googleDriveLink: "https://drive.example/q1",
  };

  function interceptItemUpdates(): Array<Record<string, unknown>> {
    const updates: Array<Record<string, unknown>> = [];
    const originalFrom = mockClient.from;
    mockClient.from = vi.fn((table: string) => {
      const builder = originalFrom(table);
      if (table === "quotation_items") {
        const originalUpdate = builder.update;
        builder.update = vi.fn((row: Record<string, unknown>) => {
          updates.push(row);
          return originalUpdate(row);
        });
      }
      return builder;
    });
    return updates;
  }

  it("writes both raw_cost and the computed landed unit_cost, and notifies on change", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        clients: { data: { sector: "commercial" }, error: null },
        quotations: { data: { id: "q1" }, error: null },
        quotation_items: [
          { data: [{ id: "i1", raw_cost: null }], error: null }, // existing-items prefetch
          { data: null, error: null }, // the update itself
        ],
      },
    });
    const updates = interceptItemUpdates();

    await setQuotationItemCosts({
      ...baseInput,
      items: [{ id: "i1", rawCost: 2121.42 }],
    });

    expect(updates).toEqual([{ raw_cost: 2121.42, unit_cost: 2217.84 }]);
    expect(mockClient.rpc).toHaveBeenCalledWith("fn_notify_costing_cost_updated", {
      target_quotation_id: "q1",
    });
  });

  it("leaves both raw_cost and unit_cost null when rawCost is null", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        profiles: profileRow,
        clients: { data: { sector: "commercial" }, error: null },
        quotations: { data: { id: "q1" }, error: null },
        quotation_items: [
          { data: [{ id: "i1", raw_cost: null }], error: null },
          { data: null, error: null },
        ],
      },
    });
    const updates = interceptItemUpdates();

    await setQuotationItemCosts({
      ...baseInput,
      items: [{ id: "i1", rawCost: null }],
    });

    expect(updates).toEqual([{ raw_cost: null, unit_cost: null }]);
    // raw_cost went from null to null -- nothing actually changed, so the
    // sales person shouldn't be notified.
    expect(mockClient.rpc).not.toHaveBeenCalled();
  });
});
