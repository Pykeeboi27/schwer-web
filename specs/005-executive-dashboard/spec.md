# Feature Specification: Executive Dashboard

**Feature Branch**: `005-executive-dashboard`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: Executive dashboard metrics and filters: Revenue Year-to-Date (YTD) vs Target (editable yearly target), Average Overall Margin (YTD), Revenue breakdown by Quarter and Month, Sales performance overview, PO totals and margin summary; filters: Monthly, Quarterly, Year-to-Date.

## Clarifications

### Session 2026-04-05

- Q: For “Revenue YTD vs Target”, what should Revenue YTD be based on? → A: Booked revenue: sum of PO amount (purchase_orders.po_amount).
- Q: For “Average Overall Margin (YTD)”, how should the margin % be calculated? → A: Weighted margin % = (SUM(margin_amount) / SUM(po_amount)) * 100.
- Q: When editing the yearly revenue target, what scope should the target apply to? → A: Overall only (one annual target for the whole business).
- Q: For Sales performance overview, what should “sales owner” mean for the ranking? → A: PO owner (group by `purchase_orders.created_by`).

Scope & Authorization (v1)
Scope (v1): The Executive Dashboard is company-wide (not per-department). All dashboard reads are restricted by RLS to active Executive Dashboard Viewers.

Executive Dashboard Viewer (read-only): A user is a Viewer if profiles.is_executive_viewer = TRUE and profiles.is_active = TRUE. Viewers can load /protected/executive and read dashboard data (including purchase_orders aggregates and revenue_targets).

Target Editor (can edit yearly target): A user is a Target Editor if profiles.role IN ('owner', 'executive') and profiles.is_active = TRUE. Target Editors can create/update the single overall annual target in public.revenue_targets (row where month IS NULL and sector IS NULL). Non-editors may view targets but cannot change them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Executive KPI Snapshot (Priority: P1)

As an executive user, I want a single dashboard view that summarizes year-to-date revenue performance and margin, plus a clear revenue breakdown and PO summary, so I can quickly understand business health for the selected time period.

**Why this priority**: This is the core value of an executive dashboard: fast, trustworthy visibility into top-line performance and profitability.

**Independent Test**: Can be fully tested by loading the dashboard with representative data and verifying all required metrics/sections render correctly and respond to period filters.

**Acceptance Scenarios**:

1. **Given** I have access to the Executive Dashboard, **When** I open it, **Then** I see Revenue YTD vs Target and Average Overall Margin (YTD) displayed.
2. **Given** the dashboard shows Revenue YTD, **When** I view the metric details, **Then** Revenue YTD reflects booked revenue (sum of PO amount) rather than collected revenue.
3. **Given** the dashboard is open, **When** I select each filter (Monthly, Quarterly, Year-to-Date), **Then** the revenue breakdown, sales performance overview, and PO totals/margin summary update to match the selected period.
4. **Given** I select the Monthly filter, **When** the dashboard updates, **Then** the revenue breakdown is presented by month for the relevant year and scope.
5. **Given** I select the Quarterly filter, **When** the dashboard updates, **Then** the revenue breakdown is presented by quarter for the relevant year and scope.
6. **Given** there is no data for the selected period, **When** the dashboard loads, **Then** it shows a clear “no data” state for affected sections without displaying misleading totals.

---

### User Story 2 - Edit Yearly Revenue Target (Priority: P2)

As a Target Editor, I want to edit the yearly revenue target used in the “Revenue YTD vs Target” metric, so that performance tracking reflects current business goals.

**Why this priority**: The dashboard’s primary KPI is only useful if the target is correct and up to date.

**Independent Test**: Can be tested by changing the yearly target and confirming the YTD vs Target metric updates and the new target persists for subsequent visits.

**Acceptance Scenarios**:

1. **Given** I am a Target Editor, **When** I update the yearly revenue target and confirm, **Then** the dashboard uses the new target immediately and the change persists.
2. **Given** I am not a Target Editor, **When** I view the dashboard, **Then** I can see the target but cannot change it.
3. **Given** I enter an invalid target (e.g., negative or non-numeric), **When** I try to save, **Then** the system rejects it with a clear validation message and keeps the existing target unchanged.

---

### User Story 3 - Review Sales Performance Overview (Priority: P3)

As an executive user, I want an overview of sales performance for the selected period, so I can identify trends and outliers that need attention.

**Why this priority**: Once the overall numbers are understood, leadership typically needs to drill into who/what is driving performance.

**Independent Test**: Can be tested by comparing the displayed sales performance summary against known sample data for multiple periods.

**Acceptance Scenarios**:

1. **Given** sales performance data exists for the selected period, **When** I view the sales performance overview, **Then** I can see a ranked summary by PO owner (who created the PO) that includes each sales owner’s revenue and margin for that period.
2. **Given** I change the period filter, **When** the dashboard refreshes, **Then** the sales performance overview updates to match the selected period.

---

### Edge Cases

- Selected period spans partial data (e.g., current month in progress) — totals must reflect available data and avoid implying completeness.
- Revenue or margin values are zero or negative — display must remain clear and not break summaries.
- No yearly target exists yet for the relevant scope/year — dashboard must prompt a Target Editor to set one and otherwise show a clear “target not set” state.
- A user attempts to edit the target without authorization — the system prevents the change; successful target changes are captured in public.audit_logs.
- Data corrections occur after initial viewing — subsequent loads should reflect updated numbers (no requirement for real-time updates unless already supported).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an Executive Dashboard view accessible only to Executive Dashboard Viewers.
- **FR-002**: System MUST display “Revenue Year-to-Date (YTD) vs Target”, including both the current YTD booked revenue (sum of PO amount) and the configured yearly target.
- **FR-003**: System MUST allow Target Editors to edit the yearly revenue target used by the dashboard.
- **FR-004**: System MUST validate target edits (must be a non-negative numeric value) before accepting changes.
- **FR-005**: System MUST display “Average Overall Margin (YTD)” and define it as a weighted margin percentage for YTD booked revenue: (SUM(YTD margin amount) / SUM(YTD PO amount)) * 100.
- **FR-006**: System MUST provide a revenue breakdown (booked revenue (PO amount)) by quarter for the selected time period.
- **FR-007**: System MUST provide a revenue breakdown (booked revenue (PO amount)) by month for the selected time period.
- **FR-008**: System MUST provide period filters: Monthly, Quarterly, and Year-to-Date.
- **FR-009**: Revenue YTD vs Target and Average Overall Margin (YTD) MUST always represent YTD metrics; period filters MUST apply to the breakdown and overview sections only.
- **FR-010**: When a period filter is selected, the dashboard MUST update all period-dependent sections (revenue breakdown, sales performance overview, PO totals and margin summary) to match the selected period.
- **FR-011**: System MUST display a sales performance overview for the selected period that includes, at minimum, a ranked list of PO owners (who created the PO) with their booked revenue (PO amount) and margin for the period.
- **FR-012**: System MUST display a PO totals and margin summary for the selected period that includes, at minimum, PO count, total PO value, and total margin for the period.
- **FR-013**: System MUST display a clear empty-state message for any section that has no data for the selected period.
- **FR-014**: System MUST handle data-loading and error states with user-friendly messaging that does not expose sensitive internal details.
- **FR-015**: System MUST scope all Executive Dashboard metrics and targets to the viewer’s permitted scope as enforced by RLS. For v1, the permitted scope is company-wide and restricted to users with profiles.is_executive_viewer = TRUE (and is_active = TRUE); users without this permission MUST NOT be able to read dashboard data (including purchase_orders aggregates and revenue_targets).
- **FR-016**: The yearly revenue target MUST be a single overall annual target (not per sector) for v1.

### Constitution-Driven Constraints *(mandatory)*

- **C-001 (Stack)**: Features MUST use the project's approved technology stack and UI primitives (per the project constitution).
- **C-002 (Auth/Z)**: Features involving data access MUST enforce authentication and least-privilege authorization according to the project constitution.
- **C-003 (Schema)**: Any data-model change MUST be reflected in the project's canonical schema definitions (per the project constitution).
- **C-004 (Design)**: UI MUST follow the project's brand tokens and consistent styling.
- **C-005 (Testing)**: Every story MUST define unit + integration + E2E coverage appropriate to its scope.

### Key Entities *(include if feature involves data)*

- **Yearly Revenue Target**: A configured overall target revenue amount for a specific year; used to compute “YTD vs Target”.
- **Revenue Summary**: Aggregated booked revenue totals for a time range (YTD, quarter, month) and organizational scope.
- **Margin Summary**: Aggregated margin values for a time range and scope; used to compute “Average Overall Margin (YTD)”.
- **Purchase Order (PO) Summary**: Aggregated PO totals and margin totals for a selected period and scope.
- **Sales Performance Summary**: Aggregated performance metrics per PO owner (who created the PO) for the selected period and scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Executive Dashboard Viewers can open the Executive Dashboard and identify Revenue YTD vs Target and Average Overall Margin (YTD) within 10 seconds.
- **SC-002**: Target Editors can change the yearly revenue target and see the updated “YTD vs Target” calculation reflected within 30 seconds end-to-end.
- **SC-003**: For 95% of dashboard loads, users see all metrics and sections populated (or correctly empty-stated) within 3 seconds on a typical business network.
- **SC-004**: 0 unauthorized target changes are accepted (verifiable via negative testing; successful revenue_targets changes are recorded in public.audit_logs).
- **SC-005**: At least 90% of test participants can correctly answer “Are we ahead or behind target?” using the dashboard without additional guidance.

## Assumptions

- The dashboard is intended for executive/leadership users who already have access to business performance data.
- “Year-to-Date (YTD)” refers to the current calendar year unless the organization has an established alternate year definition.
- Revenue, margin, and PO summaries are computed from existing, authoritative business records already captured by the system.
- Currency formatting and rounding follow the organization’s established conventions; the dashboard does not introduce new currency configuration.
- For v1, Executive Dashboard reporting is company-wide (not per-department), and access is controlled via profiles.is_executive_viewer + active status.