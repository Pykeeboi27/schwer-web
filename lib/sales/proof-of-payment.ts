/**
 * Client-safe constants/helpers for proof-of-payment (collection) images.
 * Kept free of any server-only imports (no next/headers) so it can be
 * imported from both the browser upload flow (record-collection-dialog.tsx)
 * and server code. The signed-url minting helper, which needs the
 * cookie-authenticated server Supabase client, lives in
 * proof-of-payment-server.ts instead.
 *
 * See migrations/0023_po_payments_proof_of_payment.sql for the bucket + RLS.
 */
export const PROOF_OF_PAYMENT_BUCKET = "payment-proofs";

/**
 * Builds the storage path for a new proof-of-payment upload. The leading
 * `userId` segment is what the storage RLS owner-folder check keys on, so
 * callers must pass the *current* user's id.
 */
export function buildProofOfPaymentPath(userId: string, purchaseOrderId: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${userId}/${purchaseOrderId}/${uuid}.webp`;
}
