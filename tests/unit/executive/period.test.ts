import { describe, expect, it } from "vitest";

import {
  buildMonthBuckets,
  buildQuarterBuckets,
  getPeriodDateRange,
  getQuarterFromMonth,
} from "@/lib/executive/period";

describe("executive period helpers", () => {
  it("maps month numbers to quarters", () => {
    expect(getQuarterFromMonth(1)).toBe(1);
    expect(getQuarterFromMonth(4)).toBe(2);
    expect(getQuarterFromMonth(7)).toBe(3);
    expect(getQuarterFromMonth(10)).toBe(4);
  });

  it("throws for invalid month values", () => {
    expect(() => getQuarterFromMonth(0)).toThrow();
    expect(() => getQuarterFromMonth(13)).toThrow();
  });

  it("returns expected date ranges by filter", () => {
    const referenceDate = new Date("2026-05-16T12:00:00.000Z");

    expect(getPeriodDateRange("monthly", referenceDate)).toEqual({
      year: 2026,
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });

    expect(getPeriodDateRange("quarterly", referenceDate)).toEqual({
      year: 2026,
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });

    expect(getPeriodDateRange("ytd", referenceDate)).toEqual({
      year: 2026,
      startDate: "2026-01-01",
      endDate: "2026-05-16",
    });
  });

  it("builds month and quarter buckets", () => {
    const monthBuckets = buildMonthBuckets(2026);
    const quarterBuckets = buildQuarterBuckets(2026);

    expect(monthBuckets).toHaveLength(12);
    expect(monthBuckets[0]).toEqual({ month: 1, label: "Jan", year: 2026 });
    expect(monthBuckets[11]).toEqual({ month: 12, label: "Dec", year: 2026 });

    expect(quarterBuckets).toEqual([
      { quarter: 1, label: "Q1", year: 2026 },
      { quarter: 2, label: "Q2", year: 2026 },
      { quarter: 3, label: "Q3", year: 2026 },
      { quarter: 4, label: "Q4", year: 2026 },
    ]);
  });
});
