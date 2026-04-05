import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchClients } from "@/lib/sales/clients";

const mockOrder = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: mockSelect,
    }),
  }),
}));

describe("fetchClients integration", () => {
  beforeEach(() => {
    mockOrder.mockReset();
    mockSelect.mockReset();

    mockSelect.mockReturnValue({
      order: mockOrder,
    });
  });

  it("returns mapped client rows from RLS-filtered query", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "client-sales-1",
          client_code: "C123456",
          company_name: "Sales Client",
          sector: "commercial",
          payment_terms_days: 30,
          address: "Makati",
          notes: JSON.stringify({ email: "sales@client.com", contactPerson: "Jane" }),
          is_active: true,
          created_at: "2026-04-05T09:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await fetchClients("sales-department-id");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "client-sales-1",
      clientCode: "C123456",
      companyName: "Sales Client",
      contactPerson: "Jane",
      email: "sales@client.com",
    });
  });
});
