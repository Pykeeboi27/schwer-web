import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAnnualTarget, upsertAnnualTarget } from "@/lib/executive/targets";

const {
  mockGetUser,
  mockTargetsMaybeSingle,
  mockTargetsSingle,
  mockSelect,
  mockEq,
  mockIs,
  mockUpsert,
  mockOrder,
  mockLimit,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockTargetsMaybeSingle: vi.fn(),
  mockTargetsSingle: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockIs: vi.fn(),
  mockUpsert: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: mockSelect,
      upsert: mockUpsert,
    }),
  }),
}));

describe("executive targets integration", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockTargetsMaybeSingle.mockReset();
    mockTargetsSingle.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockIs.mockReset();
    mockUpsert.mockReset();
    mockOrder.mockReset();
    mockLimit.mockReset();

    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ is: mockIs });
    mockIs.mockReturnValue({
      is: mockIs,
      maybeSingle: mockTargetsMaybeSingle,
      order: mockOrder,
    });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ maybeSingle: mockTargetsMaybeSingle });

    mockUpsert.mockReturnValue({
      select: () => ({
        single: mockTargetsSingle,
      }),
    });
  });

  it("reads annual target row", async () => {
    mockTargetsMaybeSingle.mockResolvedValue({
      data: {
        year: 2026,
        target_amount: 1200000,
      },
      error: null,
    });

    await expect(getAnnualTarget(2026)).resolves.toEqual({
      year: 2026,
      targetAmount: 1200000,
    });
  });

  it("writes annual target row and returns updated value", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "target-editor-1",
        },
      },
      error: null,
    });

    mockTargetsSingle.mockResolvedValue({
      data: {
        year: 2026,
        target_amount: 1800000,
      },
      error: null,
    });

    const result = await upsertAnnualTarget(2026, 1800000);

    expect(result).toEqual({
      year: 2026,
      targetAmount: 1800000,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        year: 2026,
        month: null,
        sector: null,
        target_amount: 1800000,
        set_by: "target-editor-1",
      },
      {
        onConflict: "year,month,sector",
      },
    );
  });
});
