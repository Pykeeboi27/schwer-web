# Research: Executive Dashboard

**Feature**: [spec.md](./spec.md)
**Date**: 2026-04-05

## Decisions

### Decision 1: Revenue metric basis (YTD + breakdown)

- **Decision**: Use **booked revenue (sum of purchase_orders.po_amount)** as the revenue basis.
- **Rationale**: Matches the executive KPI intent of “sales booked” and avoids timing noise from collections.
- **Alternatives considered**:
  - Recognized/collected revenue: useful but depends on payment timing and can misrepresent current sales performance.
  - Showing both: richer but adds scope/UX complexity for v1.

### Decision 2: “Average Overall Margin (YTD)” calculation

- **Decision**: Use **weighted margin %**.
- **Definition**: $\text{margin\_pct} = \frac{\sum \text{margin\_amount}}{\sum \text{po\_amount}} \times 100$ (for YTD).
- **Rationale**: Produces a single, intuitive margin that reflects business mix (large POs count more).
- **Alternatives considered**:
  - Simple average of per-PO margin %: over-weights small POs.

### Decision 3: Yearly target scope

- **Decision**: A single **overall annual target** (not per sector) for v1.
- **Rationale**: Minimal surface area, matches existing “overall target” concept.
- **Alternatives considered**:
  - Per-sector targets: useful but increases configuration and reporting complexity.

### Decision 4: Sales performance “owner” dimension

- **Decision**: Rank performance by **PO owner** (the user who created the PO).
- **Rationale**: Uses an existing, consistently populated dimension with minimal schema changes.
- **Alternatives considered**:
  - Quotation owner: may differ from PO owner.
  - Dedicated account manager field: requires new schema/maintenance.

### Decision 5: Data sources for v1 calculations

- **Decision**: Compute dashboard metrics directly from existing **purchase orders** and **revenue targets**.
- **Rationale**: Purchase orders already drive the Sales module and contain revenue + margin fields.
- **Alternatives considered**:
  - `revenue_records` / `vw_ytd_revenue`: available, but may not be the authoritative source for booked PO revenue in current app flows.

## Best Practices / Patterns to Follow

- **Access control**: Follow existing route gating patterns (server-side redirect based on `CurrentProfile`).
- **Data access**: Keep Supabase queries in `lib/` (server client), not in UI components.
- **RLS-first**: Ensure editing revenue targets is allowed only for Target Editors (owner/executive role + active status) via RLS policies.
- **Performance**: Prefer aggregated queries and limit returned rows (top-N for sales performance).
