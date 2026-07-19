import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export type AnnualTargetRecord = {
  year: number;
  targetAmount: number;
};

export function validateAnnualTargetInput(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Yearly target must be a non-negative number.");
  }

  return Number(value);
}

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

export async function getAnnualTarget(year: number): Promise<AnnualTargetRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("revenue_targets")
    .select("year, target_amount")
    .eq("year", year)
    .is("month", null)
    .is("sector", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load yearly target.");
  }

  if (!data) {
    return null;
  }

  return {
    year: Number(data.year),
    targetAmount: toNumber(data.target_amount),
  };
}

/**
 * `(year, month, sector)` is unique in Postgres only when all three are
 * non-NULL — NULL is never equal to NULL, so `onConflict` upserts on rows with
 * NULL `month`/`sector` (annual targets, and quarterly targets before sectors
 * are used) always insert a new row instead of updating. This reads the
 * matching row(s) first, updates the newest, and deletes any historical
 * duplicates so the table self-heals on the next save.
 */
async function upsertRevenueTargetRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    year: number;
    month: number | null;
    targetAmount: number;
    userId: string;
    errorMessage: string;
  },
): Promise<AnnualTargetRecord> {
  let existingQuery = supabase
    .from("revenue_targets")
    .select("id")
    .eq("year", params.year)
    .is("sector", null)
    .order("updated_at", { ascending: false });

  existingQuery =
    params.month === null
      ? existingQuery.is("month", null)
      : existingQuery.eq("month", params.month);

  const { data: existingRows, error: selectError } = await existingQuery;

  if (selectError) {
    throw new Error(params.errorMessage);
  }

  const [newest, ...duplicates] = (existingRows ?? []) as Array<{ id: string }>;

  if (duplicates.length > 0) {
    await supabase
      .from("revenue_targets")
      .delete()
      .in(
        "id",
        duplicates.map((row) => row.id),
      );
  }

  if (newest) {
    const { data, error } = await supabase
      .from("revenue_targets")
      .update({ target_amount: params.targetAmount, set_by: params.userId })
      .eq("id", newest.id)
      .select("year, target_amount")
      .single();

    if (error || !data) {
      throw new Error(params.errorMessage);
    }

    return { year: Number(data.year), targetAmount: toNumber(data.target_amount) };
  }

  const { data, error } = await supabase
    .from("revenue_targets")
    .insert({
      year: params.year,
      month: params.month,
      sector: null,
      target_amount: params.targetAmount,
      set_by: params.userId,
    })
    .select("year, target_amount")
    .single();

  if (error || !data) {
    throw new Error(params.errorMessage);
  }

  return { year: Number(data.year), targetAmount: toNumber(data.target_amount) };
}

function fmt(n: number): string {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function upsertAnnualTarget(
  year: number,
  targetAmountInput: number,
): Promise<AnnualTargetRecord> {
  const targetAmount = validateAnnualTargetInput(targetAmountInput);

  // Block lowering the annual target below the sum of existing quarterly targets.
  const existingQuarters = await getQuarterlyTargets(year);
  const quarterSum =
    (existingQuarters.q1 ?? 0) +
    (existingQuarters.q2 ?? 0) +
    (existingQuarters.q3 ?? 0) +
    (existingQuarters.q4 ?? 0);

  if (quarterSum > 0 && targetAmount < quarterSum) {
    throw new Error(
      `Annual target can't be below the total of existing quarterly targets (₱${fmt(
        quarterSum,
      )}). ` + `Lower the quarterly targets first.`,
    );
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in to update yearly targets.");
  }

  const supabase = await createClient();

  return upsertRevenueTargetRow(supabase, {
    year,
    month: null,
    targetAmount,
    userId: profile.id,
    errorMessage: "Failed to update yearly target.",
  });
}

// Months 3, 6, 9, 12 represent end-of-quarter targets (Q1–Q4).
const QUARTER_MONTHS: Record<1 | 2 | 3 | 4, number> = { 1: 3, 2: 6, 3: 9, 4: 12 };

export async function upsertQuarterlyTarget(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  targetAmountInput: number,
): Promise<void> {
  const targetAmount = validateAnnualTargetInput(targetAmountInput);
  const month = QUARTER_MONTHS[quarter];

  // Annual target must exist before setting any quarterly target.
  const annual = await getAnnualTarget(year);
  if (!annual) {
    throw new Error("Set the annual target before adding quarterly targets.");
  }

  // Sum of all four quarters (replacing the current one) must not exceed the annual target.
  const existing = await getQuarterlyTargets(year);
  const qKey = `q${quarter}` as "q1" | "q2" | "q3" | "q4";
  const otherSum =
    (existing.q1 ?? 0) +
    (existing.q2 ?? 0) +
    (existing.q3 ?? 0) +
    (existing.q4 ?? 0) -
    (existing[qKey] ?? 0);
  const newTotal = otherSum + targetAmount;

  if (newTotal > annual.targetAmount) {
    throw new Error(
      `Quarterly targets would total ₱${fmt(
        newTotal,
      )}, which exceeds the annual target of ₱${fmt(annual.targetAmount)}.`,
    );
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("You must be signed in to update quarterly targets.");
  }

  const supabase = await createClient();

  await upsertRevenueTargetRow(supabase, {
    year,
    month,
    targetAmount,
    userId: profile.id,
    errorMessage: "Failed to update quarterly target.",
  });
}

export async function getQuarterlyTargets(year: number): Promise<{
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("revenue_targets")
    .select("month, target_amount")
    .eq("year", year)
    .in("month", [3, 6, 9, 12])
    .is("sector", null);

  if (error) {
    return { q1: null, q2: null, q3: null, q4: null };
  }

  const map: Record<number, number> = {};
  for (const row of data ?? []) {
    if (row.month) map[row.month] = toNumber(row.target_amount);
  }

  return {
    q1: map[3] ?? null,
    q2: map[6] ?? null,
    q3: map[9] ?? null,
    q4: map[12] ?? null,
  };
}
