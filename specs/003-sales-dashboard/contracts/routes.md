# Contracts: Routes & Navigation (Sales Module)

**Feature**: 003-sales-dashboard  
**Date**: 2026-04-05

This document defines the user-facing route contract for the Sales module.

## Protected (Authenticated)

### Entry

- `GET /protected/sales`
  - Sales dashboard summary (default Sales landing page).
  - Shows sidebar tabs: Client Details, Quotation Approval, Purchase Orders.
  - Access rules:
    - Must be authenticated.
    - Sales users (`profiles.department = 'sales'`) may access the full Sales dashboard.
    - Owner/Executive approvers may access the Quotation Approval view (see below) for items assigned to them.

### Tabs

- `GET /protected/sales/clients`
  - Client list + client create/edit + contact management.

- `GET /protected/sales/quotations`
  - Quotation list + create quotation + approval queue.
  - Shows per-quotation status: pending/approved/rejected.
  - Access rules:
    - Sales users can create and submit quotations.
    - Owner/Executive users can view and act on approvals assigned to them.

- `GET /protected/sales/purchase-orders`
  - PO list + create PO + record collections.
  - Shows closed sale value (PO amount) and recognized sale value (collected-to-date).

## Authorization Contract

- Sales users (department = `sales`) can access all Sales routes.
- Approvers can approve/reject only if they are assigned as an approver in `quotation_approvals`.
- Owner/executive users may access `/protected/sales/quotations` for the purpose of reviewing and acting on approvals assigned to them.

## Errors / Redirects

- Unauthenticated access to any `/protected/sales/*` route redirects to `/auth/login`.
- Authenticated users without a department redirect to `/auth/choose-department`.
- Authenticated non-sales users are redirected away from `/protected/sales/*`.
