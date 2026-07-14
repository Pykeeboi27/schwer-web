import { createClient } from "@/lib/supabase/server";

export type SalesPersonOption = {
  id: string;
  name: string;
};

/** Active Sales-department users, for assigning a costing to a sales person. */
export async function listSalesPeople(): Promise<SalesPersonOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("department", "sales")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error("Failed to load sales people.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name || row.email || "Unnamed user",
  }));
}
