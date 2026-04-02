import { createClient } from "@/lib/supabase/server";

import type { Department } from "@/lib/profile/departments";

export type CurrentProfile = {
  id: string;
  email: string;
  department: Department | null;
  isActive: boolean;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, department, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    department: data.department,
    isActive: data.is_active,
  };
}
