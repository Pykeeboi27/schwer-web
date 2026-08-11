import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * A deliberately session-less Supabase client used only to check a password
 * against GoTrue (e.g. re-verifying a user's current password before letting
 * them set a new one). `persistSession: false` keeps the resulting session in
 * memory for the lifetime of this call alone, so it can never read or write
 * the signed-in user's `sb-*` cookies.
 *
 * Never use this client for anything the signed-in user's real session
 * should own -- for that, use `@/lib/supabase/server` or `@/lib/supabase/client`.
 */
export function createVerificationClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();

  return createSupabaseClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
