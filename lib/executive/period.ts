import type { PeriodFilter } from "@/lib/executive/types";

export type PeriodDateRange = {
  year: number;
  startDate: string;
  endDate: string;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthEndDate(year: number, month: number): Date {
  return new Date(year, month, 0);
}

export function getCurrentYear(referenceDate = new Date()): number {
  return referenceDate.getFullYear();
}

export function getQuarterFromMonth(month: number): 1 | 2 | 3 | 4 {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Month must be an integer between 1 and 12.");
  }

  return Math.ceil(month / 3) as 1 | 2 | 3 | 4;
}

export function getMonthLabel(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Month must be an integer between 1 and 12.");
  }

  return MONTH_LABELS[month - 1];
}

export function getQuarterLabel(quarter: number): string {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new RangeError("Quarter must be an integer between 1 and 4.");
  }

  return `Q${quarter}`;
}

export function getPeriodDateRange(
  periodFilter: PeriodFilter,
  referenceDate = new Date(),
): PeriodDateRange {
  const year = referenceDate.getFullYear();

  if (periodFilter === "monthly") {
    const month = referenceDate.getMonth() + 1;
    const startDate = toIsoDate(new Date(year, month - 1, 1));
    const endDate = toIsoDate(getMonthEndDate(year, month));
    return { year, startDate, endDate };
  }

  if (periodFilter === "quarterly") {
    const quarter = getQuarterFromMonth(referenceDate.getMonth() + 1);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const startDate = toIsoDate(new Date(year, startMonth - 1, 1));
    const endDate = toIsoDate(getMonthEndDate(year, endMonth));
    return { year, startDate, endDate };
  }

  return {
    year,
    startDate: toIsoDate(new Date(year, 0, 1)),
    endDate: toIsoDate(referenceDate),
  };
}

export function buildMonthBuckets(year: number): Array<{ month: number; label: string; year: number }> {
  return Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    label: getMonthLabel(index + 1),
    year,
  }));
}

export function buildQuarterBuckets(year: number): Array<{ quarter: number; label: string; year: number }> {
  return [1, 2, 3, 4].map((quarter) => ({
    quarter,
    label: getQuarterLabel(quarter),
    year,
  }));
}
