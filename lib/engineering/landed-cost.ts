import { round2 } from "@/lib/sales/pricing";

// Matches the source Excel costing template's fixed markups, applied
// automatically on top of Engineering's raw material+labor cost: Q = P*1.03
// (OPEX), R = Q*1.015 (delivery fee). Excel carries R at full precision into
// the line total and only rounds for display -- computeLandedUnitCost mirrors
// that rounded display value; the exact, unrounded total itself is computed
// by the DB (quotation_items.line_total's GENERATED expression), not here.
//
// Pulled out of lib/engineering/costing-quotations.ts (which imports the
// server-only Supabase client) so the "Set Direct Costs" dialog -- a client
// component that needs this same formula for its live total preview -- can
// import it without pulling next/headers into the browser bundle.
const OPEX_RATE = 0.03;
const DELIVERY_FEE_RATE = 0.015;

export function computeLandedUnitCost(rawCost: number): number {
  return round2(rawCost * (1 + OPEX_RATE) * (1 + DELIVERY_FEE_RATE));
}
