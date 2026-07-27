/**
 * Manually-encoded POs are attributed to this generic role label instead of
 * the individual who entered them -- these are backfilled company records,
 * not an individual's authored work. Kept in its own module with no
 * server-only imports so "use client" components can reference it directly
 * without pulling lib/sales/purchase-orders.ts's server-only dependencies
 * (lib/supabase/server.ts, which uses next/headers) into the browser bundle.
 */
export const ENCODED_PO_AUTHOR_LABEL = "Coordinator";
