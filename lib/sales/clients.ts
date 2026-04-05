import { createClient } from "@/lib/supabase/server";

type PaymentTermsInput = {
  downpaymentPercent?: number | null;
  notes?: string | null;
};

export type SalesClient = {
  id: string;
  clientCode: string;
  companyName: string;
  sector: "commercial" | "industrial" | "solar";
  paymentTermsDays: number;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

export type SalesClientContact = {
  id: string;
  clientId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  position: string | null;
  isPrimary: boolean;
};

export async function fetchClients(_departmentId?: string): Promise<SalesClient[]> {
  void _departmentId;
  // Department filtering is enforced through RLS for the current session.
  return listClients();
}

export async function validateClientCodeUniqueness(code: string): Promise<boolean> {
  const normalizedCode = String(code ?? "").trim();

  if (!normalizedCode) {
    throw new Error("Client code is required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("client_code", normalizedCode)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to validate client code uniqueness.");
  }

  return !data;
}

export function parseSector(raw: unknown): "commercial" | "industrial" | "solar" {
  const value = String(raw ?? "").trim().toLowerCase();

  if (value !== "commercial" && value !== "industrial" && value !== "solar") {
    throw new Error("Sector must be one of: commercial, industrial, solar.");
  }

  return value;
}

export function parsePaymentNetDays(raw: unknown): number {
  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Payment terms net days must be a non-negative integer.");
  }

  return value;
}

export function parseOptionalDownpaymentPercent(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Downpayment percent must be between 0 and 100.");
  }

  return value;
}

export function buildPaymentTermsNotes(input: PaymentTermsInput): string | null {
  const payload: Record<string, string | number> = {};

  if (input.downpaymentPercent !== null && input.downpaymentPercent !== undefined) {
    payload.downpaymentPercent = input.downpaymentPercent;
  }

  const trimmedNotes = String(input.notes ?? "").trim();
  if (trimmedNotes) {
    payload.notes = trimmedNotes;
  }

  if (Object.keys(payload).length === 0) {
    return null;
  }

  return JSON.stringify(payload);
}

export async function listClients(): Promise<SalesClient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_code, company_name, sector, payment_terms_days, address, notes, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load clients.");
  }

  return (data ?? []).map((row) => {
    let contactPerson: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;

    if (row.notes) {
      try {
        const payload = JSON.parse(row.notes) as {
          contactPerson?: string;
          email?: string;
          phone?: string;
        };

        contactPerson = payload.contactPerson ?? null;
        email = payload.email ?? null;
        phone = payload.phone ?? null;
      } catch {
        // Keep backward compatibility for non-JSON notes.
      }
    }

    return {
      id: row.id,
      clientCode: row.client_code,
      companyName: row.company_name,
      sector: row.sector,
      paymentTermsDays: row.payment_terms_days,
      contactPerson,
      email,
      phone,
      address: row.address,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  });
}

export async function createSalesClient(input: {
  clientCode: string;
  companyName: string;
  sector: "commercial" | "industrial" | "solar";
  paymentTermsDays: number;
  address?: string | null;
  notes: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({
    client_code: input.clientCode,
    company_name: input.companyName,
    sector: input.sector,
    payment_terms_days: input.paymentTermsDays,
    address: input.address ?? null,
    notes: input.notes,
  });

  if (error) {
    throw new Error(error.message || "Failed to create client.");
  }
}

export async function updateSalesClient(input: {
  id: string;
  companyName: string;
  sector: "commercial" | "industrial" | "solar";
  paymentTermsDays: number;
  address?: string | null;
  notes: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      company_name: input.companyName,
      sector: input.sector,
      payment_terms_days: input.paymentTermsDays,
      address: input.address ?? null,
      notes: input.notes,
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message || "Failed to update client.");
  }
}

export async function inactivateSalesClient(clientId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ is_active: false })
    .eq("id", clientId);

  if (error) {
    throw new Error(error.message || "Failed to inactivate client.");
  }
}

export async function listClientContacts(clientId?: string): Promise<SalesClientContact[]> {
  const supabase = await createClient();
  let query = supabase
    .from("client_contacts")
    .select("id, client_id, full_name, email, phone, mobile, position, is_primary")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Failed to load client contacts.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    position: row.position,
    isPrimary: row.is_primary,
  }));
}

export async function addClientContact(input: {
  clientId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  position?: string | null;
  isPrimary?: boolean;
}): Promise<void> {
  const supabase = await createClient();

  if (input.isPrimary) {
    const { error: resetError } = await supabase
      .from("client_contacts")
      .update({ is_primary: false })
      .eq("client_id", input.clientId);

    if (resetError) {
      throw new Error(resetError.message || "Failed to update client contacts.");
    }
  }

  const { error } = await supabase.from("client_contacts").insert({
    client_id: input.clientId,
    full_name: input.fullName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    mobile: input.mobile ?? null,
    position: input.position ?? null,
    is_primary: input.isPrimary ?? false,
  });

  if (error) {
    throw new Error(error.message || "Failed to create client contact.");
  }
}

export async function setClientPrimaryContact(input: {
  clientId: string;
  contactId: string;
}): Promise<void> {
  const supabase = await createClient();

  const { error: resetError } = await supabase
    .from("client_contacts")
    .update({ is_primary: false })
    .eq("client_id", input.clientId);

  if (resetError) {
    throw new Error(resetError.message || "Failed to clear existing primary contact.");
  }

  const { error } = await supabase
    .from("client_contacts")
    .update({ is_primary: true })
    .eq("id", input.contactId);

  if (error) {
    throw new Error(error.message || "Failed to set primary contact.");
  }
}
