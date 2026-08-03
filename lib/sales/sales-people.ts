import { createClient } from "@/lib/supabase/server";

export type SalesPersonOption = {
  id: string;
  email: string;
};

/** Active Sales-department profiles, for attributing a PO to the sales person it belongs to. */
export async function listSalesDepartmentProfiles(): Promise<SalesPersonOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("department", "sales")
    .eq("is_active", true)
    .order("email", { ascending: true });

  if (error) {
    throw new Error("Failed to load sales department profiles.");
  }

  return (data ?? []).map((row) => ({ id: row.id, email: row.email }));
}
