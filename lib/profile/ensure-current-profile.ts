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

  // Use getClaims() (local JWT verification) instead of getUser() (network
  // round-trip to the auth server). The proxy middleware has already validated
  // the session before the page renders, so the local claims are trustworthy.
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claimsError || !claims?.sub) {
    return null;
  }

  const userId = claims.sub as string;
  const userEmail = typeof claims.email === "string" ? claims.email : null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, department, is_active, role, is_executive_viewer")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new EnsureCurrentProfileError();
  }

  if (profile) {
    return toCurrentProfile(profile);
  }

  if (!userEmail) {
    throw new EnsureCurrentProfileError();
  }

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: userEmail,
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
    .eq("id", userId)
    .single();

  if (repairedProfileError || !repairedProfile) {
    throw new EnsureCurrentProfileError();
  }

  return toCurrentProfile(repairedProfile);
}
