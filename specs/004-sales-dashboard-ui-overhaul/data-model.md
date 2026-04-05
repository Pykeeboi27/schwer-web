# Data Model: Sales Dashboard UI Overhaul

**Feature**: 004-sales-dashboard-ui-overhaul  
**Date**: April 5, 2026  
**Purpose**: Define entities, relationships, validation rules, and state transitions for the sales dashboard

---

## Entity Definitions

### Client

Represents a business client managed by the sales team. Each client is scoped to a department and has an auto-generated unique code.

#### Table: `public.clients`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | Auto-generated |
| `department_id` | `uuid` | FK(`departments.id`), NOT NULL | Department ownership; enforced via RLS |
| `code` | `varchar(50)` | UNIQUE, NOT NULL | Format: C[6 random digits] (e.g., C123456) |
| `name` | `varchar(255)` | NOT NULL | Client business name |
| `contact_person` | `varchar(255)` | Nullable | Primary contact name |
| `email` | `varchar(255)` | Nullable | Contact email |
| `phone` | `varchar(20)` | Nullable | Contact phone number |
| `address` | `text` | Nullable | Full business address |
| `created_by` | `uuid` | FK(`auth.users.id`), NOT NULL | User who created the record |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Last update timestamp |

#### Validation Rules
- `code`: Must be unique across all clients; enforced by UNIQUE constraint
- `name`: Required; validates against `^\S.*$` (non-empty)
- `email`: Optional; if present, must be valid email format
- `phone`: Optional; if present, 10-20 characters

#### Relationships
- **Quotations** (1:∞): One client can have many quotations
- **Purchase Orders** (1:∞): One client can have many purchase orders
- **Department** (∞:1): Belongs to exactly one department (implicit via RLS)

#### RLS Policies
- Users can SELECT clients in their department only
- Users with `sales_staff` role can INSERT clients in their department
- Policies defined in `schema.sql`

---

## Scope Clarification: Line Items (MVP Release)

The MVP release (Phase 3-5) treats Quotations and Purchase Orders as **single-amount records** (no line item support). Each quotation/PO has a single `amount` field representing the total value.

**Future release** (out of scope for 004): If detailed line item tracking is needed, add:
- `quotation_items` table (quotation_id, description, qty, unit_price, line_total)
- `po_items` table (po_id, description, qty, unit_price, line_total)

For this release (004), the approval workflow, collection tracking, and UI all work with aggregate amounts only.

---

### Quotation

Represents a sales quotation. Quotations go through an approval workflow: Draft → Pending[role] → Approved/Rejected. Approval chain is amount-based.

#### Table: `public.quotations`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | Auto-generated |
| `department_id` | `uuid` | FK(`departments.id`), NOT NULL | Department ownership |
| `client_id` | `uuid` | FK(`clients.id`), NOT NULL | Associated client |
| `amount` | `numeric(15,2)` | NOT NULL | Total quotation amount; determines approval routing |
| `status` | `text` | CHECK (status IN ('DRAFT', 'PENDING_SALES_MANAGER', 'PENDING_OWNER', 'PENDING_EXECUTIVE', 'APPROVED', 'REJECTED')), DEFAULT 'DRAFT' | Current approval state; see State Transitions for valid transitions |
| `approval_chain` | `jsonb` | NOT NULL, DEFAULT '{}' | Tracks approval status by role (see schema below) |
| `rejection_reason` | `text` | Nullable | If rejected, the reason why |
| `created_by` | `uuid` | FK(`auth.users.id`), NOT NULL | Sales staff who created quotation |
| `submitted_at` | `timestamp` | Nullable | When submitted for approval (transitions from Draft) |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Last update timestamp |

#### Approval Chain Structure (JSON)

```json
{
  "sales_manager": {
    "status": "approved | rejected | pending",
    "approved_by": "user_id",
    "approved_at": "2026-04-05T10:00:00Z",
    "reason": "optional reason for rejection"
  },
  "owner": {
    "status": "approved | rejected | pending",
    ...
  },
  "executive": {
    "status": "approved | rejected | pending",
    ...
  }
}
```

#### Validation Rules
- `amount`: Must be > 0; used to determine approval level (< 3,000,000 vs >= 3,000,000)
- `status`: Transitions follow state machine rules (see State Transitions)
- `approval_chain`: Must be valid JSON; keys are role names
- `created_by`: Must be a valid user in the same department

#### Relationships
- **Client** (∞:1): Each quotation belongs to one client
- **Quotation Items** (1:∞): One quotation has many line items
- **Quotation Approvals** (1:∞): One quotation has many approval audit entries (see QuotationApproval table)

#### State Transitions

```
[DRAFT]
  ├─ [Submit for Approval] → PENDING_SALES_MANAGER
  ├─ [Cancel] → REJECTED

[PENDING_SALES_MANAGER]
  ├─ [Approve] (if amount < 3,000,000) → APPROVED
  ├─ [Approve] (if amount >= 3,000,000) → PENDING_OWNER
  ├─ [Reject] → REJECTED

[PENDING_OWNER]
  ├─ [Approve] → PENDING_EXECUTIVE
  ├─ [Reject] → REJECTED

[PENDING_EXECUTIVE]
  ├─ [Approve] → APPROVED
  ├─ [Reject] → REJECTED

[APPROVED] - Terminal state
[REJECTED] - Terminal state
```
## Status Representation

- **Database (`quotations.status`)**: Uses uppercase underscore-separated enum values (DRAFT, PENDING_SALES_MANAGER, etc.)
- **Approval Chain JSON (`quotations.approval_chain`)**: Tracks role-specific states separately (see below)
- **Frontend Display**: Convert database status to user-friendly text for UI display ("Draft", "Pending Sales Manager Approval", "Approved", "Rejected")

#### RLS Policies
- Sales staff can view/create quotations in their department
- Sales manager can view and approve quotations in their department
- Owner and executive (from executive department) can view and approve high-value quotations (>= 3,000,000)
- Only quotation creator can submit for approval (or sales manager can force-submit)

---

### QuotationApproval

Audit trail table tracking each approval action on a quotation.

#### Table: `public.quotation_approvals`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | Auto-generated |
| `quotation_id` | `uuid` | FK(`quotations.id`), NOT NULL | Which quotation |
| `approved_by` | `uuid` | FK(`auth.users.id`), NOT NULL | User who approved/rejected |
| `role` | `text` | NOT NULL, CHECK (role IN ('sales_manager', 'owner', 'executive')) | Role of approver |
| `action` | `text` | NOT NULL, CHECK (action IN ('approved', 'rejected')) | Action taken |
| `reason` | `text` | Nullable | Optional reason (especially for rejections) |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Timestamp of action |

#### Validation Rules
- `role`: Must match the role of the `approved_by` user
- `quotation_id`: Must point to a valid quotation
- `action`: Only 'approved' or 'rejected'

#### Relationships
- **Quotation** (∞:1): Multiple approvals can exist for one quotation

#### Index Strategy
- Composite index on (`quotation_id`, `created_at`) for audit trail queries
- Single index on `approved_by` for user-specific approval history

---

### PurchaseOrder

Represents a purchase order. Tracks total amount and accumulated collected amount.

#### Table: `public.purchase_orders`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | Auto-generated |
| `department_id` | `uuid` | FK(`departments.id`), NOT NULL | Department ownership |
| `client_id` | `uuid` | FK(`clients.id`), NOT NULL | Associate client |
| `po_number` | `varchar(50)` | UNIQUE, NOT NULL | Auto-generated PO identifier; format: `PO-{DEPT_CODE}-{YEAR}-{SEQUENCE}` (e.g., PO-SALES-2026-001 for Sales department). Generated server-side to ensure uniqueness.  |
| `total_amount` | `numeric(15,2)` | NOT NULL | Total PO value |
| `collected_amount` | `numeric(15,2)` | NOT NULL, DEFAULT 0.00 | Total amount collected (aggregate of Collections) |
| `status` | `text` | CHECK (status IN ('Draft', 'Active', 'Closed')), DEFAULT 'Draft' | PO lifecycle state |
| `created_by` | `uuid` | FK(`auth.users.id`), NOT NULL | User who created PO |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Last update timestamp |

#### Validation Rules
- `total_amount`: Must be > 0
- `collected_amount`: Must be >= 0 and <= `total_amount`; enforced by trigger/check constraint
- `po_number`: Unique; auto-generated format (e.g., PO-DEPT-2026-001)
- `status`: Transitions are Draft → Active → Closed (no reverse transitions)

#### PO Number Generation
- Format: `PO-{DEPT_CODE}-{YEAR}-{SEQUENCE}`
  - `DEPT_CODE`: 3-5 letter department abbreviation (e.g., SALES, EXEC, OPS)
  - `YEAR`: Current 4-digit year (e.g., 2026)
  - `SEQUENCE`: Zero-padded 4-digit counter (starts at 0001 per department per year)
- Example: `PO-SALES-2026-0001`, `PO-SALES-2026-0002`, etc.
- Generation: Server-side only (server action); never client-side generated
- Uniqueness: Database UNIQUE constraint enforces across all departments/years

#### Relationships
- **Client** (∞:1): Each PO belongs to one client
- **PO Items** (1:∞): One PO has many line items
- **Collections** (1:∞): One PO has many collections (see Collection table)

#### State Transitions

```
[Draft]
  ├─ [Submit] → Active
  ├─ [Cancel] → Closed

[Active]
  ├─ [Record Collection] → (stays Active until collected_amount == total_amount)
  ├─ [Close] → Closed

[Closed] - Terminal state
```

#### Computed Fields
- `remaining_amount`: `total_amount - collected_amount` (computed on query; not stored)

#### RLS Policies
- Users can view POs in their department
- Sales staff can create and record collections for their department
- Read access to collection history requires department membership

---

### Collection

Represents a single payment collection recorded against a purchase order. Multiple collections accumulate toward the PO's total.

#### Table: `public.collections`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | Auto-generated |
| `purchase_order_id` | `uuid` | FK(`purchase_orders.id`), NOT NULL | PO being paid |
| `amount` | `numeric(15,2)` | NOT NULL | Collection amount; must be > 0 |
| `recorded_by` | `uuid` | FK(`auth.users.id`), NOT NULL | User who recorded collection |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Collection date/time |

#### Validation Rules
- `amount`: Must be > 0
- `purchase_order_id`: Must point to a valid, Active PO
- **Invariant**: Sum of all collections for a PO must not exceed PO's `total_amount` (enforced by DB constraint and trigger)

#### Relationships
- **Purchase Order** (∞:1): Multiple collections belong to one PO

#### Triggers

**Trigger: `update_po_collected_amount_on_collection_insert`**
```sql
AFTER INSERT ON collections
FOR EACH ROW
EXECUTE FUNCTION update_purchase_order_collected_amount();

-- Function:
CREATE OR REPLACE FUNCTION update_purchase_order_collected_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET collected_amount = (
    SELECT COALESCE(SUM(amount), 0) FROM collections
    WHERE purchase_order_id = NEW.purchase_order_id
  )
  WHERE id = NEW.purchase_order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Safety Check: Prevent Over-Collection**
```sql
-- In create_collection function (PostgreSQL):
IF <new_collected_amount> > total_amount THEN
  RAISE EXCEPTION 'Collection amount would exceed purchase order total';
END IF;
```

#### RLS Policies
- Users can view collections for POs in their department
- Users can insert collections only for POs in their department

---

## Data Dictionary

### Shared Columns (across multiple tables)

| Column Pattern | Type | Purpose | Example |
|---|---|---|---|
| `*_id` (PK) | `uuid` | Primary key | `04f78c84-...` |
| `department_id` | `uuid` | Department scoping for data isolation | Links to `departments.id` |
| `created_by` | `uuid` | Audit: who created | Links to `auth.users.id` |
| `created_at` | `timestamp` | Audit: when created | `2026-04-05T10:23:45Z` |
| `updated_at` | `timestamp` | Audit: when last modified | `2026-04-05T10:23:45Z` |

### Enum Values

**Quotation Status**:
- `Draft`: Not yet submitted for approval
- `Pending[SalesManager]`: Awaiting sales manager approval
- `Pending[Owner]`: Awaiting owner approval (high-value only)
- `Pending[Executive]`: Awaiting executive approval (high-value only)
- `Approved`: All required approvals obtained
- `Rejected`: Rejected by any approver; terminal

**PurchaseOrder Status**:
- `Draft`: Not yet active
- `Active`: Live; can record collections
- `Closed`: No more collections allowed; terminal

**Approval Action**:
- `approved`: Approver gave approval
- `rejected`: Approver rejected with optional reason

**User Role** (JWT claim; not in table, but used by RLS):
- `sales_staff`: Can create quotations/POs; cannot approve
- `sales_manager`: Can approve low-value quotations; can approve first level of high-value
- `owner`: Can approve high-value first-level (partner)
- `executive`: Can approve high-value final level

---

## Constraints & Uniqueness

### Unique Constraints

| Table | Columns | Purpose |
|-------|---------|---------|
| `clients` | `(department_id, code)` | No duplicate client codes per department |
| `purchase_orders` | `(department_id, po_number)` | No duplicate PO numbers per department |

### Check Constraints

| Table | Constraint | Enforcement |
|-------|-----------|-------------|
| `quotations` | `status IN (...)` | Valid status values only |
| `quotations` | `amount > 0` | Positive quotation amounts |
| `purchase_orders` | `collected_amount >= 0` | Non-negative collections |
| `purchase_orders` | `collected_amount <= total_amount` | No over-collection |
| `purchase_orders` | `status IN (...)` | Valid PO status values |
| `collections` | `amount > 0` | Positive collection amounts |

### Indexes

| Table | Index | Rationale |
|-------|-------|----------|
| `clients` | `(department_id, code)` | RLS filter + code lookup |
| `quotations` | `(department_id, status)` | Filter quotations by dept + approval state |
| `quotations` | `(created_by)` | User's quotations history |
| `quotation_approvals` | `(quotation_id, created_at DESC)` | Audit trail for single quotation |
| `purchase_orders` | `(department_id, status)` | RLS filter + status filtering |
| `collections` | `(purchase_order_id, created_at DESC)` | Collection history per PO |

---

## Migration Strategy

### Phase 1: Schema Migration

1. **Create new tables**:
   - `quotations`
   - `quotation_approvals`
   - Update `purchase_orders` (if not already present)
   - `collections`

2. **Add RLS policies** to each table

3. **Create auxiliary objects**:
   - Function: `update_purchase_order_collected_amount()`
   - Function: `create_collection()` (with validation)
   - Triggers for collection → PO update

4. **Add indexes** for performance

5. **Run in a database migration** (e.g., Supabase SQL editor or migration script)

### Phase 2: Application Code

1. Update `schema.sql` to reflect all changes
2. Create TypeScript types from schema (Supabase types or manual)
3. Implement server actions for quotation/collection operations
4. Add RLS-enforced queries in `lib/sales/`

---

## Related Tables (Existing)

These tables are assumed to exist and are referenced by the new entities:

- **`auth.users`**: Supabase auth table; used for `created_by` FKs
- **`public.departments`**: Organization departments; linked via `department_id`
- **`public.quotation_items`** (if exists): Line items for quotations
- **`public.purchase_order_items`** (if exists): Line items for POs

If these tables don't exist, they should be created as part of the feature implementation.

---

## Example Data Scenarios

### Scenario 1: Low-Value Quotation Approval

**Client**: "Acme Corp" (code: `C542891`), department: sales

**Quotation**: Amount 1,500,000

1. Sales staff creates quotation in Draft
2. Sales staff clicks "Submit for Approval" → status = `Pending[SalesManager]`
3. Sales manager views quotation → sees "Approve" button (no Owner/Executive because amount < 3M)
4. Sales manager approves → status = `Approved`

**approval_chain JSON**:
```json
{
  "sales_manager": {
    "status": "PENDING | APPROVED | REJECTED",
    "approved_by": "user_uuid or null",
    "approved_at": "ISO 8601 timestamp or null",
    "reason": "rejection reason or null"
  },
  "owner": { ... },
  "executive": { ... }
}
```

### Scenario 2: High-Value Quotation Approval

**Client**: "BigCorp Inc" (code: `C089234`), department: sales

**Quotation**: Amount 5,000,000

1. Sales staff creates quotation in Draft
2. Sales staff submits → status = `Pending[SalesManager]`
3. Sales manager views → sees "Approve" button (approval needed, amount >= 3M)
4. Sales manager approves → status = `Pending[Owner]`
5. Owner (from executive dept) views → sees "Approve" button
6. Owner approves → status = `Pending[Executive]`
7. Executive views → sees "Approve" button
8. Executive approves → status = `Approved`

**approval_chain JSON after final approval**:
```json
{
  "sales_manager": {
    "status": "approved",
    "approved_by": "uuid-manager",
    "approved_at": "2026-04-05T10:15:00Z"
  },
  "owner": {
    "status": "approved",
    "approved_by": "uuid-owner",
    "approved_at": "2026-04-05T10:45:00Z"
  },
  "executive": {
    "status": "approved",
    "approved_by": "uuid-exec",
    "approved_at": "2026-04-05T11:00:00Z"
  }
}
```

### Scenario 3: Collection Recording Against PO

**PO**: PO-SALES-2026-001, total = $100,000

1. Sales staff records collection of $30,000 → collected_amount = $30,000 (rows: 1 collection)
2. Sales staff records collection of $25,000 → collected_amount = $55,000 (rows: 2 collections)
3. Sales staff attempts to record $50,000 → FAILS (would exceed total); toast shows "Collection exceeds available balance"
4. Sales staff records $45,000 → collected_amount = $100,000 (rows: 3 collections; PO complete)

---

## Conclusion

This data model supports all user stories and clarifications:
- ✅ Client code generation (format: C[6 digits], uniqueness enforced)
- ✅ Multi-level approval routing (amount-based)
- ✅ Collection tracking with accumulation and overflow prevention
- ✅ Audit trails for all approval actions
- ✅ RLS-enforced department and role-based access control
- ✅ Transactional safety for concurrent operations
