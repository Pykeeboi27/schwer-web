import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateClientCodeUniqueness } from "@/lib/sales/clients";
import { validateClientForm } from "@/lib/utils/form-validation";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: mockSelect,
    }),
  }),
}));

describe("clients utilities", () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();

    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });
  });

  it("returns true when generated client code does not exist", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(validateClientCodeUniqueness("C123456")).resolves.toBe(true);
  });

  it("returns false when generated client code already exists", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "client-1" },
      error: null,
    });

    await expect(validateClientCodeUniqueness("C123456")).resolves.toBe(false);
  });

  it("validates client form values", () => {
    expect(
      validateClientForm({
        name: "ACME Corp",
        email: "sales@acme.com",
        phone: "0917 555 1234",
      }).valid,
    ).toBe(true);

    const invalid = validateClientForm({
      name: "",
      email: "not-an-email",
      phone: "123",
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.errors.name).toBeTruthy();
    expect(invalid.errors.email).toBeTruthy();
    expect(invalid.errors.phone).toBeTruthy();
  });
});
