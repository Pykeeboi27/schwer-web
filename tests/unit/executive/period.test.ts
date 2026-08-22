import { describe, expect, it } from "vitest";

import {
  buildMonthBuckets,
  buildQuarterBuckets,
  buildQuarterMonthBuckets,
  buildWeekBuckets,
  getCurrentYear,
  getMonthLabel,
  getPeriodDateRange,
  getQuarterFromMonth,
  getQuarterLabel,
  getWeekOfMonth,
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

  it("scopes monthly and quarterly ranges to an explicit selection", () => {
    const referenceDate = new Date("2026-08-22T12:00:00.000Z");

    expect(getPeriodDateRange("monthly", referenceDate, { month: 4 })).toEqual({
      year: 2026,
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });

    expect(getPeriodDateRange("quarterly", referenceDate, { quarter: 1 })).toEqual({
      year: 2026,
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });

    // February in a non-leap year -- month end is derived, not hardcoded.
    expect(getPeriodDateRange("monthly", new Date(2026, 7, 22), { month: 2 })).toEqual({
      year: 2026,
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  it("falls back to the reference date period for missing or invalid selections", () => {
    const referenceDate = new Date("2026-08-22T12:00:00.000Z");

    expect(getPeriodDateRange("monthly", referenceDate, { month: 13 })).toEqual(
      getPeriodDateRange("monthly", referenceDate),
    );
    expect(getPeriodDateRange("quarterly", referenceDate, { quarter: 0 })).toEqual(
      getPeriodDateRange("quarterly", referenceDate),
    );
    // A monthly selection must not leak into the quarterly range, and vice versa.
    expect(getPeriodDateRange("quarterly", referenceDate, { month: 4 })).toEqual({
      year: 2026,
      startDate: "2026-07-01",
      endDate: "2026-09-30",
    });
    expect(getPeriodDateRange("ytd", referenceDate, { month: 4, quarter: 1 })).toEqual({
      year: 2026,
      startDate: "2026-01-01",
      endDate: "2026-08-22",
    });
  });

  it("builds the three months of a quarter", () => {
    expect(buildQuarterMonthBuckets(2, 2026)).toEqual([
      { month: 4, label: "Apr", year: 2026 },
      { month: 5, label: "May", year: 2026 },
      { month: 6, label: "Jun", year: 2026 },
    ]);
    expect(buildQuarterMonthBuckets(4, 2026).map((b) => b.label)).toEqual([
      "Oct",
      "Nov",
      "Dec",
    ]);
    expect(() => buildQuarterMonthBuckets(5, 2026)).toThrow(RangeError);
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

  it("returns month labels and rejects out-of-range months", () => {
    expect(getMonthLabel(1)).toBe("Jan");
    expect(getMonthLabel(12)).toBe("Dec");
    expect(() => getMonthLabel(0)).toThrow(RangeError);
    expect(() => getMonthLabel(13)).toThrow(RangeError);
    expect(() => getMonthLabel(1.5)).toThrow(RangeError);
  });

  it("returns quarter labels and rejects out-of-range quarters", () => {
    expect(getQuarterLabel(1)).toBe("Q1");
    expect(getQuarterLabel(4)).toBe("Q4");
    expect(() => getQuarterLabel(0)).toThrow(RangeError);
    expect(() => getQuarterLabel(5)).toThrow(RangeError);
  });

  it("maps a day of the month to its week bucket", () => {
    expect(getWeekOfMonth(1)).toBe(1);
    expect(getWeekOfMonth(7)).toBe(1);
    expect(getWeekOfMonth(8)).toBe(2);
    expect(getWeekOfMonth(14)).toBe(2);
    expect(getWeekOfMonth(15)).toBe(3);
    expect(getWeekOfMonth(21)).toBe(3);
    expect(getWeekOfMonth(22)).toBe(4);
    expect(getWeekOfMonth(31)).toBe(4);
  });

  it("builds four labelled week buckets", () => {
    expect(buildWeekBuckets()).toEqual([
      { week: 1, label: "Wk 1" },
      { week: 2, label: "Wk 2" },
      { week: 3, label: "Wk 3" },
      { week: 4, label: "Wk 4" },
    ]);
  });

  it("reads the year from a reference date and defaults to today", () => {
    expect(getCurrentYear(new Date(2030, 5, 15))).toBe(2030);
    expect(getCurrentYear()).toBe(new Date().getFullYear());
  });
});
