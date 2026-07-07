import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createClientAction,
  fetchClientsAction,
  updateClientAction,
} from "@/app/protected/sales/clients/actions";

const ok = { data: null, error: null };
const codeAvailable = { data: null, error: null }; // maybeSingle -> not found -> unique

// A fully valid client form (validateClientForm requires all of these).
const validFields = {
  name: "ACME",
  contactPerson: "Juan Dela Cruz",
  email: "sales@acme.com",
  phone: "0917 555 1234",
  address: "123 Main St, Manila",
  tin: "123-456-789-00000",
};

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("createClientAction", () => {
  it("requires a client code", async () => {
    mockClient = createSupabaseMock();
    const result = await createClientAction(formData({ name: "ACME" }));
    expect(result).toEqual({ success: false, error: "Client code is required." });
  });

  it("requires a client name", async () => {
    mockClient = createSupabaseMock();
    const result = await createClientAction(formData({ code: "C123456" }));
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.name).toBeTruthy();
  });

  it("returns field errors for an invalid form", async () => {
    mockClient = createSupabaseMock();
    const result = await createClientAction(
      formData({ code: "C123456", name: "ACME", email: "not-an-email" }),
    );
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.email).toBeTruthy();
  });

  it("rejects a duplicate client code", async () => {
    mockClient = createSupabaseMock({
      tables: { clients: { data: { id: "existing" }, error: null } },
    });
    const result = await createClientAction(
      formData({ code: "C123456", ...validFields }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/);
  });

  it("creates a client and returns its code", async () => {
    mockClient = createSupabaseMock({
      tables: { clients: [codeAvailable, ok] },
    });
    const result = await createClientAction(
      formData({ code: "C123456", ...validFields }),
    );
    expect(result).toEqual({ success: true, data: { clientCode: "C123456" } });
  });

  it("catches errors thrown during creation", async () => {
    mockClient = createSupabaseMock({
      tables: {
        clients: [codeAvailable, { data: null, error: { message: "insert boom" } }],
      },
    });
    const result = await createClientAction(
      formData({ code: "C123456", ...validFields }),
    );
    expect(result).toEqual({ success: false, error: "insert boom" });
  });
});

describe("updateClientAction", () => {
  it("requires a client id", async () => {
    mockClient = createSupabaseMock();
    const result = await updateClientAction(formData({ name: "ACME" }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Client id is required/);
  });

  it("requires a client name", async () => {
    mockClient = createSupabaseMock();
    const result = await updateClientAction(formData({ id: "c1" }));
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.name).toBeTruthy();
  });

  it("surfaces field errors from the shared client-form validator", async () => {
    // updateClientAction validates {name,email,phone,address} but the validator
    // also requires contactPerson and tin, so those always surface here.
    mockClient = createSupabaseMock();
    const result = await updateClientAction(
      formData({
        id: "c1",
        name: "ACME",
        email: "sales@acme.com",
        phone: "0917 555 1234",
        address: "123 Main St, Manila",
      }),
    );
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.contactPerson).toBeTruthy();
    expect(result.fieldErrors?.tin).toBeTruthy();
  });
});

describe("fetchClientsAction", () => {
  it("returns clients on success", async () => {
    mockClient = createSupabaseMock({
      tables: {
        clients: {
          data: [
            {
              id: "c1",
              client_code: "C1",
              company_name: "Alpha",
              sector: "commercial",
              payment_terms_days: 30,
              address: null,
              tin: null,
              bir_registration_link: null,
              notes: null,
              is_active: true,
              created_at: "2026-01-01",
            },
          ],
          error: null,
        },
      },
    });
    const result = await fetchClientsAction();
    expect(result.success).toBe(true);
    expect(result.data?.[0].companyName).toBe("Alpha");
  });

  it("returns an error response when loading fails", async () => {
    mockClient = createSupabaseMock({
      tables: { clients: { data: null, error: { message: "load fail" } } },
    });
    const result = await fetchClientsAction();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to load clients/);
  });
});
