import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "../helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import {
  getAnnualTarget,
  getQuarterlyTargets,
  upsertAnnualTarget,
  upsertQuarterlyTarget,
} from "@/lib/executive/targets";

const ok = { data: null, error: null };
const noQuarters = { data: [], error: null };
const user = { id: "u1" };

describe("getAnnualTarget", () => {
  it("returns the mapped record when a target exists", async () => {
    mockClient = createSupabaseMock({
      tables: {
        revenue_targets: {
          data: { year: 2026, target_amount: "5000000" },
          error: null,
        },
      },
    });

    await expect(getAnnualTarget(2026)).resolves.toEqual({
      year: 2026,
      targetAmount: 5000000,
    });
  });

  it("returns null when no target row is found", async () => {
    mockClient = createSupabaseMock({
      tables: { revenue_targets: { data: null, error: null } },
    });

    await expect(getAnnualTarget(2026)).resolves.toBeNull();
  });

  it("throws when the query errors", async () => {
    mockClient = createSupabaseMock({
      tables: { revenue_targets: { data: null, error: { message: "x" } } },
    });

    await expect(getAnnualTarget(2026)).rejects.toThrow(/Failed to load yearly target/);
  });
});

describe("getQuarterlyTargets", () => {
  it("maps end-of-quarter months to q1–q4 with nulls for missing quarters", async () => {
    mockClient = createSupabaseMock({
      tables: {
        revenue_targets: {
          data: [
            { month: 3, target_amount: "1000000" },
            { month: 6, target_amount: "1500000" },
          ],
          error: null,
        },
      },
    });

    await expect(getQuarterlyTargets(2026)).resolves.toEqual({
      q1: 1000000,
      q2: 1500000,
      q3: null,
      q4: null,
    });
  });

  it("returns all-null quarters when the query errors", async () => {
    mockClient = createSupabaseMock({
      tables: { revenue_targets: { data: null, error: { message: "x" } } },
    });

    await expect(getQuarterlyTargets(2026)).resolves.toEqual({
      q1: null,
      q2: null,
      q3: null,
      q4: null,
    });
  });
});

describe("upsertAnnualTarget", () => {
  it("rejects non-numeric input before any DB access", async () => {
    await expect(upsertAnnualTarget(2026, Number.NaN)).rejects.toThrow(/non-negative/);
  });

  it("blocks lowering the annual target below the sum of existing quarters", async () => {
    // getQuarterlyTargets returns q1+q2 = 3,000,000; new target 2,000,000 is lower.
    mockClient = createSupabaseMock({
      user,
      tables: {
        revenue_targets: {
          data: [
            { month: 3, target_amount: "1000000" },
            { month: 6, target_amount: "2000000" },
          ],
          error: null,
        },
      },
    });

    await expect(upsertAnnualTarget(2026, 2_000_000)).rejects.toThrow(
      /can't be below the total of existing quarterly targets/,
    );
  });

  it("requires an authenticated user", async () => {
    mockClient = createSupabaseMock({
      user: null,
      tables: { revenue_targets: noQuarters },
    });

    await expect(upsertAnnualTarget(2026, 5_000_000)).rejects.toThrow(
      /must be signed in/,
    );
  });

  it("persists and returns the new annual target", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        revenue_targets: [
          noQuarters, // getQuarterlyTargets
          { data: { year: 2026, target_amount: "5000000" }, error: null }, // upsert
        ],
      },
    });

    await expect(upsertAnnualTarget(2026, 5_000_000)).resolves.toEqual({
      year: 2026,
      targetAmount: 5000000,
    });
  });

  it("throws when the upsert fails", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        revenue_targets: [noQuarters, { data: null, error: { message: "x" } }],
      },
    });

    await expect(upsertAnnualTarget(2026, 5_000_000)).rejects.toThrow(
      /Failed to update yearly target/,
    );
  });
});

describe("upsertQuarterlyTarget", () => {
  it("requires an annual target to exist first", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: { revenue_targets: { data: null, error: null } }, // getAnnualTarget -> null
    });

    await expect(upsertQuarterlyTarget(2026, 1, 500_000)).rejects.toThrow(
      /Set the annual target before/,
    );
  });

  it("rejects quarter totals that exceed the annual target", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        revenue_targets: [
          { data: { year: 2026, target_amount: "1000000" }, error: null }, // getAnnualTarget
          { data: [{ month: 6, target_amount: "600000" }], error: null }, // getQuarterlyTargets
        ],
      },
    });

    // existing q2=600k, adding q1=500k -> 1.1M > 1M annual.
    await expect(upsertQuarterlyTarget(2026, 1, 500_000)).rejects.toThrow(
      /exceeds the annual target/,
    );
  });

  it("persists a valid quarterly target", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        revenue_targets: [
          { data: { year: 2026, target_amount: "1000000" }, error: null }, // getAnnualTarget
          { data: [{ month: 6, target_amount: "300000" }], error: null }, // getQuarterlyTargets
          ok, // upsert
        ],
      },
    });

    await expect(upsertQuarterlyTarget(2026, 1, 500_000)).resolves.toBeUndefined();
  });

  it("throws when the quarterly upsert fails", async () => {
    mockClient = createSupabaseMock({
      user,
      tables: {
        revenue_targets: [
          { data: { year: 2026, target_amount: "1000000" }, error: null },
          { data: [{ month: 6, target_amount: "300000" }], error: null },
          { data: null, error: { message: "x" } },
        ],
      },
    });

    await expect(upsertQuarterlyTarget(2026, 1, 500_000)).rejects.toThrow(
      /Failed to update quarterly target/,
    );
  });
});
