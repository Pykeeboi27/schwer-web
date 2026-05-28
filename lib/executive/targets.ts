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

export async function upsertAnnualTarget(
  year: number,
  targetAmountInput: number,
): Promise<AnnualTargetRecord> {
  const targetAmount = validateAnnualTargetInput(targetAmountInput);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be signed in to update yearly targets.");
  }

  const { data, error } = await supabase
    .from("revenue_targets")
    .upsert(
      {
        year,
        month: null,
        sector: null,
        target_amount: targetAmount,
        set_by: user.id,
      },
      {
        onConflict: "year,month,sector",
      },
    )
    .select("year, target_amount")
    .single();

  if (error || !data) {
    throw new Error("Failed to update yearly target.");
  }

  return {
    year: Number(data.year),
    targetAmount: toNumber(data.target_amount),
  };
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

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be signed in to update quarterly targets.");
  }

  const { error } = await supabase.from("revenue_targets").upsert(
    { year, month, sector: null, target_amount: targetAmount, set_by: user.id },
    { onConflict: "year,month,sector" },
  );

  if (error) {
    throw new Error("Failed to update quarterly target.");
  }
}

export async function getQuarterlyTargets(
  year: number,
): Promise<{ q1: number | null; q2: number | null; q3: number | null; q4: number | null }> {
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
