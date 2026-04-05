# Data Model: Sales Module Dashboard

**Feature**: 003-sales-dashboard  
**Date**: 2026-04-05

## Authoritative Source

- Database schema is defined in `schema.sql`.
- This feature uses the Sales module tables and supporting enums.

## Core Enums (from `schema.sql`)

- `sector_enum`: `commercial`, `industrial`, `solar`
- `approval_status_enum`: `pending`, `approved`, `rejected`, `cancelled`
- `payment_status_enum`: `unpaid`, `partial`, `paid`, `overdue`
- `user_role_enum`: includes `sales_manager`, `sales_staff`, `owner`, `executive`, etc.

## Entities

### 1) `public.clients`
- **Purpose**: Customer master record for quotations and purchase orders.
- **Primary key**: `id UUID`
- **Key fields**:
  - `client_code TEXT UNIQUE NOT NULL`
  - `company_name TEXT NOT NULL`
  - `sector sector_enum NOT NULL` (client classification)
  - `payment_terms_days INTEGER NOT NULL DEFAULT 30`
  - `is_active BOOLEAN NOT NULL DEFAULT TRUE`
  - `notes TEXT`

### 2) `public.client_contacts`
- **Purpose**: Contact info per client.
- **Primary key**: `id UUID`
- **Foreign key**: `client_id → public.clients(id)`
- **Key fields**:
  - `full_name TEXT NOT NULL`
  - `email`, `phone`, `mobile`
  - `is_primary BOOLEAN NOT NULL DEFAULT FALSE`

### 3) `public.quotations`
- **Purpose**: Quotation record submitted for approval.
- **Primary key**: `id UUID`
- **Foreign keys**:
  - `client_id → public.clients(id)`
  - `prepared_by → public.profiles(id)`
- **Key fields**:
  - `quotation_number TEXT UNIQUE NOT NULL`
  - `sector sector_enum NOT NULL` (stored for reporting; derived from client)
  - `amount NUMERIC(15,2) NOT NULL`
  - `cost NUMERIC(15,2)`
  - `margin_amount` and `margin_percent` are generated columns
  - `requires_executive_approval` is a generated column (`amount >= 3000000`)
  - `status approval_status_enum NOT NULL DEFAULT 'pending'`

### 4) `public.quotation_approvals`
- **Purpose**: Tracks approval decisions per approver.
- **Primary key**: `id UUID`
- **Foreign keys**:
  - `quotation_id → public.quotations(id)`
  - `approver_id → public.profiles(id)`
- **Key fields**:
  - `approver_role user_role_enum NOT NULL`
  - `status approval_status_enum NOT NULL DEFAULT 'pending'`
  - `approved_at TIMESTAMPTZ`, `rejection_reason TEXT`, `notes TEXT`
  - Unique constraint: `(quotation_id, approver_id)`

### 5) `public.purchase_orders`
- **Purpose**: PO record (closed sale value and recognized sale tracking).
- **Primary key**: `id UUID`
- **Foreign keys**:
  - `client_id → public.clients(id)`
  - `quotation_id → public.quotations(id)` (optional)
  - `created_by → public.profiles(id)`
- **Key fields**:
  - `po_number TEXT UNIQUE NOT NULL`
  - `sector sector_enum NOT NULL` (stored for reporting; derived from client)
  - `po_amount NUMERIC(15,2) NOT NULL` (Closed Sale value)
  - `recognized_amount NUMERIC(15,2) NOT NULL DEFAULT 0` (Recognized Sale value)
  - `cost NUMERIC(15,2)`
  - `margin_amount` and `margin_percent` are generated columns
  - `payment_terms_days INTEGER NOT NULL DEFAULT 30`
  - `payment_status payment_status_enum NOT NULL DEFAULT 'unpaid'`
  - `notes TEXT`

### 6) `public.po_payments`
- **Purpose**: Collection events for a PO.
- **Primary key**: `id UUID`
- **Foreign key**: `po_id → public.purchase_orders(id)`
- **Key fields**:
  - `amount_collected NUMERIC(15,2) NOT NULL`
  - `payment_date DATE NOT NULL`
  - optional `payment_method`, `reference_number`, `notes`

## Derived/Reporting Views

- `public.vw_po_summary`: joins clients + purchase_orders and exposes closed/recognized sale values plus margin.

## Key Rules & Transitions (Feature-relevant)

### Client lifecycle
- Active: `clients.is_active = true`
- Removed/inactive: `clients.is_active = false`
- Historical quotations/POs remain linked via `client_id`.

### Quotation approval routing
- If `quotations.amount < 3,000,000` → require sales_manager role approvals.
- If `quotations.amount >= 3,000,000` → require sales_manager + owner + executive.

### Sales totals
- Closed Sale total = SUM(`purchase_orders.po_amount`)
- Recognized Sale total = SUM(`purchase_orders.recognized_amount`)

### Payment terms mapping
- Spec’s `netDays` maps to `payment_terms_days`.
- Optional fields (`downpaymentPercent`, free-form notes) can be stored in `notes` as structured JSON text.
