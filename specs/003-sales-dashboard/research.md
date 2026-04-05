# Research: Sales Module Dashboard

**Feature**: 003-sales-dashboard  
**Date**: 2026-04-05

## Decision 1: Use existing Sales schema in `schema.sql`

**Decision**: Use the Sales tables already defined in `schema.sql` as the authoritative data model:
- `public.clients`, `public.client_contacts`
- `public.quotations`, `public.quotation_approvals`
- `public.purchase_orders`, `public.po_payments`
- helper view: `public.vw_po_summary`

**Rationale**: The constitution requires schema-first development. The schema already matches the requested workflows (client classification, approvals threshold logic, margin columns, PO collection tracking).

**Alternatives considered**:
- Create separate “v1 tables” for Sales → rejected because it duplicates schema and increases drift risk.

## Decision 2: Routing and layout in Next.js App Router

**Decision**: Implement a dedicated Sales route group under `/protected/sales` with a shared layout containing the Sales sidebar.

**Rationale**: The app already uses `/protected/*` for authenticated areas. A static route (`/protected/sales`) cleanly overrides the generic `/protected/[department]` route and allows Sales-specific UX without affecting other departments.

**Alternatives considered**:
- Extend `/protected/[department]` with conditional Sales UI → rejected because it complicates the generic dashboard and mixes concerns.

## Decision 3: Quotation approval routing and “role quorum”

**Decision**: On quotation submission, create `quotation_approvals` rows for each required role:
- Always require `sales_manager`
- If `amount >= 3,000,000`, also require `owner` and `executive`

Approval semantics:
- One approval per required role is sufficient (“role quorum = 1”).
- When a role is satisfied, remaining pending approvals for that role are set to `cancelled`.
- Any rejection by a required role rejects the quotation.

**Rationale**: `quotation_approvals` requires an `approver_id`, and there may be multiple eligible approvers in each role. Creating rows for all eligible approvers lets the team operate with a shared approval queue while maintaining auditability.

**Alternatives considered**:
- Assign to a single approver per role deterministically → rejected because it risks blocking if that user is unavailable.
- Model approvals as role-only without a specific `approver_id` → rejected because it does not fit the current schema.

## Decision 4: Payment terms representation vs existing schema

**Decision**: Treat `netDays` as the authoritative stored field using existing columns:
- Clients: `clients.payment_terms_days`
- POs: `purchase_orders.payment_terms_days`

Additional payment-term fields from the spec (optional `downpaymentPercent`, optional `notes`) are persisted in the existing `notes` column as structured JSON text when provided.

**Rationale**: `schema.sql` already contains net-days fields. Storing optional extras in `notes` preserves the UX without introducing schema changes.

**Alternatives considered**:
- Add separate columns for each payment term field → rejected for v1 to avoid broad schema churn.

## Decision 5: Sector tagging

**Decision**: Use `sector_enum` as the canonical sector classification (Commercial/Industrial/Solar) and store it on clients/quotations/POs per schema.

For the spec’s free-form “sector tag” field, store an optional free-form value in `purchase_orders.notes` (and/or `clients.notes`) as needed, while continuing to use `sector_enum` for reporting.

**Rationale**: The schema requires `sector sector_enum NOT NULL` across Sales tables. This supports consistent reporting and indexing.

**Alternatives considered**:
- Change sector columns to free-form text → rejected because it conflicts with the existing schema design and reporting views.

## Decision 6: Recognized Sale calculation source of truth

**Decision**: Use `po_payments` as the source of truth and maintain `purchase_orders.recognized_amount` via a DB trigger/function.

**Rationale**: `vw_po_summary` and summary queries use `recognized_amount`. A trigger keeps totals correct even if payments are edited.

**Alternatives considered**:
- Compute SUM(payments) on every query and ignore `recognized_amount` → rejected for simplicity/performance and to keep schema columns meaningful.
