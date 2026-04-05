import { createClient } from "@/lib/supabase/server";

import type { Department } from "@/lib/profile/departments";

export type CurrentProfile = {
  id: string;
  email: string;
  department: Department | null;
  isActive: boolean;
  role?: string | null;
  isExecutiveViewer?: boolean;
};

export class EnsureCurrentProfileError extends Error {
  constructor(message = "We couldn't load your profile. Please try again.") {
    super(message);
    this.name = "EnsureCurrentProfileError";
  }
}

export function isEnsureCurrentProfileError(error: unknown): boolean {
  return (
    error instanceof EnsureCurrentProfileError ||
    (error instanceof Error && error.name === "EnsureCurrentProfileError")
  );
}

function toCurrentProfile(data: {
  id: string;
  email: string;
  department: Department | null;
  is_active: boolean;
  role: string | null;
  is_executive_viewer: boolean;
}): CurrentProfile {
  return {
    id: data.id,
    email: data.email,
    department: data.department,
    isActive: data.is_active,
    role: data.role,
    isExecutiveViewer: data.is_executive_viewer,
  };
}

export async function ensureCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, department, is_active, role, is_executive_viewer")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new EnsureCurrentProfileError();
  }

  if (profile) {
    return toCurrentProfile(profile);
  }

  if (!user.email) {
    throw new EnsureCurrentProfileError();
  }

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
      },
      {
        onConflict: "id",
      },
    );

  if (upsertError) {
    throw new EnsureCurrentProfileError();
  }

  const { data: repairedProfile, error: repairedProfileError } = await supabase
    .from("profiles")
    .select("id, email, department, is_active, role, is_executive_viewer")
    .eq("id", user.id)
    .single();

  if (repairedProfileError || !repairedProfile) {
    throw new EnsureCurrentProfileError();
  }

  return toCurrentProfile(repairedProfile);
}