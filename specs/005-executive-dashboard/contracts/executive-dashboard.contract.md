# Contract: Executive Dashboard Data

**Feature**: [../spec.md](../spec.md)
**Date**: 2026-04-05

## Purpose

Define the minimum data contract between the Executive Dashboard UI and the server-side data access layer.

## Inputs

### Period Filter

- `periodFilter`: one of:
  - `monthly`
  - `quarterly`
  - `ytd`

**Semantics**:
- YTD KPI cards (Revenue YTD vs Target, Average Overall Margin YTD) always represent YTD.
- `periodFilter` applies to:
  - revenue breakdown
  - sales performance overview
  - PO totals & margin summary

## Outputs

### KPI Summary (always YTD)

- `revenueYtdBooked`: number
- `annualTarget`: number | null
- `revenueVsTargetDelta`: number | null (only if `annualTarget` exists)
- `marginYtdWeightedPercent`: number | null (null if YTD booked revenue is 0)

### Revenue Breakdown (depends on periodFilter)

- If `periodFilter=monthly`
  - `monthlyRevenue`: array of `{ month: 1..12, bookedRevenue: number }`
- If `periodFilter=quarterly`
  - `quarterlyRevenue`: array of `{ quarter: 1..4, bookedRevenue: number }`
- If `periodFilter=ytd`
  - `ytdRevenueByMonth`: array of `{ month: 1..12, bookedRevenue: number }` (may be same as monthly but UI may choose different labeling)

### Sales Performance Overview

- `salesPerformance`: array of (ranked desc by booked revenue)
  - `{ ownerId: string, ownerName: string, bookedRevenue: number, marginAmount: number }`

### PO Totals & Margin Summary

- `poSummary`: `{ poCount: number, totalPoValue: number, totalMarginAmount: number }`

## Errors / Empty States

- If no data exists for the selected period, return empty arrays and zero totals, and allow UI to show a clear empty state.
- Authorization failures must not leak sensitive details; the UI should redirect to a safe fallback.
