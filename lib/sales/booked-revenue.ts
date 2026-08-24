import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Canonical definition of "booked revenue" shared by every summary card that
 * claims to show it: Revenue YTD (Booked), Total PO Value, Booked this year,
 * Company/My Closed Sales, and the Purchase Orders tab's Closed Sales.
 *
 * Booked revenue = SUM(purchase_orders.po_amount) where status = 'approved'
 * and po_date falls within the requested period, company-wide. See
 * lib/executive/period.ts for building the date bounds.
 */
export const BOOKED_PO_STATUS = "approved" as const;

/** Bucket key for a PO with no resolvable salesperson, so it's never silently dropped. */
export const UNATTRIBUTED_OWNER_ID = "unattributed";

// PostgREST caps a single response at db-max-rows (1000 on Supabase-hosted
// projects). A plain unpaginated select would silently truncate the sum once
// the table grows past that -- paginate past it instead.
const PO_ROW_PAGE_SIZE = 1000;

export type BookedPoRow = {
  po_amount: number | string | null;
  po_date: string | null;
  created_by: string | null;
  quotation_id: string | null;
  margin_amount?: number | string | null;
  margin_percentage?: number | string | null;
  recognized_amount?: number | string | null;
  quotations?:
    { sales_person_id: string | null } | { sales_person_id: string | null }[] | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

const BOOKED_PO_SELECT =
  "po_amount, po_date, created_by, quotation_id, margin_amount, margin_percentage, recognized_amount, quotations:quotation_id(sales_person_id)";

async function fetchBookedPoRowsUncached(
  startDate: string,
  endDate: string,
): Promise<BookedPoRow[]> {
  const supabase = await createClient();
  const rows: BookedPoRow[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(BOOKED_PO_SELECT)
      .eq("status", BOOKED_PO_STATUS)
      // Plain DATE bounds against po_date (a DATE column) -- no time
      // component, so no UTC/local timezone skew at the day boundary.
      .gte("po_date", startDate)
      .lte("po_date", endDate)
      .order("id")
      .range(offset, offset + PO_ROW_PAGE_SIZE - 1);

    if (error) {
      throw new Error("Failed to load booked purchase orders.");
    }

    const page = (data ?? []) as BookedPoRow[];
    rows.push(...page);

    if (page.length < PO_ROW_PAGE_SIZE) {
      break;
    }

    offset += PO_ROW_PAGE_SIZE;
  }

  return rows;
}

/**
 * Request-scoped memoization keyed on the primitive date bounds. Several
 * cards on the same page (KPI, PO summary, sales performance, quotas) often
 * request the same period -- keying on strings, rather than a fresh range
 * object per caller, lets `cache()` dedupe them into one `purchase_orders`
 * scan per distinct range per request.
 */
export const fetchBookedPoRows = cache(fetchBookedPoRowsUncached);

export function sumBookedRevenue(rows: BookedPoRow[]): number {
  return rows.reduce((sum, row) => sum + toNumber(row.po_amount), 0);
}

/**
 * Attributes a PO to a salesperson: the linked quotation's `sales_person_id`
 * when one exists, falling back to the PO's own `created_by` for manually
 * created/encoded POs, falling back to `UNATTRIBUTED_OWNER_ID` when neither
 * is set.
 */
export function resolveBookedOwnerId(row: BookedPoRow): string {
  const quotation = Array.isArray(row.quotations) ? row.quotations[0] : row.quotations;
  const quotationOwner = quotation?.sales_person_id ?? null;
  return quotationOwner ?? row.created_by ?? UNATTRIBUTED_OWNER_ID;
}

/**
 * Booked revenue per attributed owner. Every row is counted -- a row with no
 * resolvable owner lands in the UNATTRIBUTED_OWNER_ID bucket rather than
 * being dropped, so `Array.from(result.values()).reduce((a, b) => a + b, 0)`
 * always equals `sumBookedRevenue(rows)`.
 */
export function attributeBookedRevenue(rows: BookedPoRow[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const ownerId = resolveBookedOwnerId(row);
    totals.set(ownerId, (totals.get(ownerId) ?? 0) + toNumber(row.po_amount));
  }

  return totals;
}
