import { describe, expect, it, vi } from "vitest";

import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

let mockClient: SupabaseMock = createSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockClient,
}));

import {
  addClientContact,
  createSalesClient,
  inactivateSalesClient,
  listClientContacts,
  listClients,
  parseOptionalDownpaymentPercent,
  parseSector,
  setClientPrimaryContact,
  updateSalesClient,
  validateClientCodeUniqueness,
} from "@/lib/sales/clients";

const ok = { data: null, error: null };
const fail = { data: null, error: { message: "db error" } };

describe("client pure-function edge branches", () => {
  it("parseSector rejects unknown sectors", () => {
    expect(parseSector("commercial")).toBe("commercial");
    expect(() => parseSector("aerospace")).toThrow(/commercial, industrial, solar/);
  });

  it("parseOptionalDownpaymentPercent returns null for empty input and parses valid values", () => {
    expect(parseOptionalDownpaymentPercent("")).toBeNull();
    expect(parseOptionalDownpaymentPercent(null)).toBeNull();
    expect(parseOptionalDownpaymentPercent("25")).toBe(25);
    expect(() => parseOptionalDownpaymentPercent("-1")).toThrow(/between 0 and 100/);
  });
});

describe("validateClientCodeUniqueness", () => {
  it("requires a non-empty code", async () => {
    await expect(validateClientCodeUniqueness("   ")).rejects.toThrow(
      /Client code is required/,
    );
  });

  it("throws when the lookup errors", async () => {
    mockClient = createSupabaseMock({ tables: { clients: fail } });
    await expect(validateClientCodeUniqueness("C123456")).rejects.toThrow(
      /validate client code uniqueness/,
    );
  });
});

describe("listClients", () => {
  const baseRow = {
    id: "c1",
    client_code: "C1",
    company_name: "Alpha",
    sector: "commercial",
    payment_terms_days: 30,
    address: "Manila",
    tin: "123",
    bir_registration_link: "http://x",
    notes: null,
    is_active: true,
    created_at: "2026-01-01",
  };

  it("extracts contact fields from JSON notes", async () => {
    mockClient = createSupabaseMock({
      tables: {
        clients: {
          data: [
            {
              ...baseRow,
              notes: '{"contactPerson":"Juan","email":"a@b.com","phone":"0917"}',
            },
          ],
          error: null,
        },
      },
    });

    const [client] = await listClients();

    expect(client.contactPerson).toBe("Juan");
    expect(client.email).toBe("a@b.com");
    expect(client.phone).toBe("0917");
    expect(client.isActive).toBe(true);
  });

  it("keeps non-JSON notes without throwing", async () => {
    mockClient = createSupabaseMock({
      tables: {
        clients: { data: [{ ...baseRow, notes: "plain legacy note" }], error: null },
      },
    });

    const [client] = await listClients();

    expect(client.contactPerson).toBeNull();
    expect(client.notes).toBe("plain legacy note");
  });

  it("throws when the query fails", async () => {
    mockClient = createSupabaseMock({ tables: { clients: fail } });
    await expect(listClients()).rejects.toThrow(/Failed to load clients/);
  });
});

describe("client mutations", () => {
  it("createSalesClient surfaces insert errors", async () => {
    mockClient = createSupabaseMock({ tables: { clients: ok } });
    await expect(
      createSalesClient({
        clientCode: "C1",
        companyName: "Alpha",
        sector: "commercial",
        paymentTermsDays: 30,
        notes: null,
      }),
    ).resolves.toBeUndefined();

    mockClient = createSupabaseMock({ tables: { clients: fail } });
    await expect(
      createSalesClient({
        clientCode: "C1",
        companyName: "Alpha",
        sector: "commercial",
        paymentTermsDays: 30,
        notes: null,
      }),
    ).rejects.toThrow("db error");
  });

  it("updateSalesClient resolves on success and throws on error", async () => {
    mockClient = createSupabaseMock({ tables: { clients: ok } });
    await expect(
      updateSalesClient({
        id: "c1",
        companyName: "Alpha",
        sector: "solar",
        paymentTermsDays: 15,
        notes: null,
      }),
    ).resolves.toBeUndefined();

    mockClient = createSupabaseMock({ tables: { clients: fail } });
    await expect(
      updateSalesClient({
        id: "c1",
        companyName: "Alpha",
        sector: "solar",
        paymentTermsDays: 15,
        notes: null,
      }),
    ).rejects.toThrow("db error");
  });

  it("inactivateSalesClient resolves on success and throws on error", async () => {
    mockClient = createSupabaseMock({ tables: { clients: ok } });
    await expect(inactivateSalesClient("c1")).resolves.toBeUndefined();

    mockClient = createSupabaseMock({ tables: { clients: fail } });
    await expect(inactivateSalesClient("c1")).rejects.toThrow("db error");
  });
});

describe("client contacts", () => {
  it("listClientContacts maps rows and supports the client filter", async () => {
    const contactRow = {
      id: "ct1",
      client_id: "c1",
      full_name: "Juan Dela Cruz",
      email: "juan@x.com",
      phone: "111",
      mobile: "222",
      position: "Owner",
      is_primary: true,
    };
    mockClient = createSupabaseMock({
      tables: { client_contacts: { data: [contactRow], error: null } },
    });

    const contacts = await listClientContacts("c1");

    expect(contacts[0]).toEqual({
      id: "ct1",
      clientId: "c1",
      fullName: "Juan Dela Cruz",
      email: "juan@x.com",
      phone: "111",
      mobile: "222",
      position: "Owner",
      isPrimary: true,
    });
  });

  it("listClientContacts throws when the query fails", async () => {
    mockClient = createSupabaseMock({ tables: { client_contacts: fail } });
    await expect(listClientContacts()).rejects.toThrow(/Failed to load client contacts/);
  });

  it("addClientContact clears the existing primary before inserting a primary contact", async () => {
    mockClient = createSupabaseMock({ tables: { client_contacts: [ok, ok] } });
    await expect(
      addClientContact({ clientId: "c1", fullName: "Ana", isPrimary: true }),
    ).resolves.toBeUndefined();
  });

  it("addClientContact inserts a non-primary contact directly", async () => {
    mockClient = createSupabaseMock({ tables: { client_contacts: ok } });
    await expect(
      addClientContact({ clientId: "c1", fullName: "Ben" }),
    ).resolves.toBeUndefined();
  });

  it("addClientContact throws when the primary reset fails", async () => {
    mockClient = createSupabaseMock({ tables: { client_contacts: fail } });
    await expect(
      addClientContact({ clientId: "c1", fullName: "Ana", isPrimary: true }),
    ).rejects.toThrow("db error");
  });

  it("setClientPrimaryContact resets then sets the chosen contact", async () => {
    mockClient = createSupabaseMock({ tables: { client_contacts: [ok, ok] } });
    await expect(
      setClientPrimaryContact({ clientId: "c1", contactId: "ct2" }),
    ).resolves.toBeUndefined();
  });

  it("setClientPrimaryContact throws when the reset step fails", async () => {
    mockClient = createSupabaseMock({ tables: { client_contacts: fail } });
    await expect(
      setClientPrimaryContact({ clientId: "c1", contactId: "ct2" }),
    ).rejects.toThrow("db error");
  });
});
