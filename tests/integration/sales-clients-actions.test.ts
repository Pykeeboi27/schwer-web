import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addClientContactAction,
  createClientAction,
  inactivateClientAction,
  setPrimaryContactAction,
  updateClientAction,
} from "@/app/protected/sales/actions";

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: mockFrom,
  }),
}));

describe("sales client actions", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockEq.mockReset();
    mockFrom.mockReset();

    mockUpdate.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });

    mockFrom.mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      select: vi.fn(),
      order: vi.fn(),
      eq: mockEq,
    });
  });

  it("creates a client through server action", async () => {
    const formData = new FormData();
    formData.set("clientCode", "C-100");
    formData.set("companyName", "ACME Corp");
    formData.set("sector", "commercial");
    formData.set("paymentTermsDays", "30");

    const result = await createClientAction(formData);

    expect(result).toEqual({ ok: true, error: null });
    expect(mockFrom).toHaveBeenCalledWith("clients");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("updates and inactivates clients", async () => {
    const updateData = new FormData();
    updateData.set("id", "client-1");
    updateData.set("companyName", "Updated Name");
    updateData.set("sector", "solar");
    updateData.set("paymentTermsDays", "45");

    await expect(updateClientAction(updateData)).resolves.toEqual({ ok: true, error: null });

    const inactivateData = new FormData();
    inactivateData.set("id", "client-1");

    await expect(inactivateClientAction(inactivateData)).resolves.toEqual({ ok: true, error: null });
  });

  it("adds and sets primary contacts", async () => {
    const addData = new FormData();
    addData.set("clientId", "client-1");
    addData.set("fullName", "Jane Doe");
    addData.set("email", "jane@example.com");
    addData.set("isPrimary", "on");

    await expect(addClientContactAction(addData)).resolves.toEqual({ ok: true, error: null });

    const primaryData = new FormData();
    primaryData.set("clientId", "client-1");
    primaryData.set("contactId", "contact-1");

    await expect(setPrimaryContactAction(primaryData)).resolves.toEqual({ ok: true, error: null });
  });
});
