import { createClient } from "@/lib/supabase/server";
import { PROOF_OF_PAYMENT_BUCKET } from "@/lib/sales/proof-of-payment";

/** How long a minted "view proof" link stays valid, in seconds. */
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Mints a short-lived signed URL for viewing a proof-of-payment object.
 * Server-only (uses the cookie-authenticated server client) so the caller's
 * department membership is checked by storage RLS. Keep out of any module
 * imported by client components -- see proof-of-payment.ts for the
 * client-safe constants/helpers.
 */
export async function createProofOfPaymentSignedUrl(path: string): Promise<string> {
  const normalizedPath = String(path ?? "").trim();
  if (!normalizedPath) {
    throw new Error("Proof of payment path is required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PROOF_OF_PAYMENT_BUCKET)
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message || "Failed to create a link for the proof of payment.",
    );
  }

  return data.signedUrl;
}
