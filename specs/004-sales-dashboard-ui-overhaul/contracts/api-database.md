# API & Database Contracts: Sales Dashboard UI Overhaul

**Feature**: 004-sales-dashboard-ui-overhaul  
**Date**: April 5, 2026  
**Purpose**: Document the contracts between frontend, server actions, and database for the sales dashboard

---

## Server Actions (Frontend ↔ Backend)

All server actions live in `app/protected/sales/[feature]/actions.ts` with proper error handling and return types.

### Client Management

#### `createClientAction(data: CreateClientForm) → CreateClientResponse`

**Input**:
```typescript
interface CreateClientForm {
  code: string;           // Required, format: C[6 digits]
  name: string;           // Required, non-empty
  contact_person?: string;
  email?: string;         // Optional, valid email if provided
  phone?: string;
  address?: string;
}
```

**Output**:
```typescript
interface CreateClientResponse {
  success: boolean;
  client?: Client;  // If success
  error?: string;   // If error
}

interface Client {
  id: UUID;
  department_id: UUID;
  code: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  created_by: UUID;
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

**Validation**:
- `code` must be unique (checked at DB constraint level)
- `name` must be non-empty
- `email` must be valid if provided

**Side Effects**:
- Inserts new row in `clients` table
- Sets `department_id` from current user's department
- Sets `created_by` to current user's ID

**Error Cases**:
- `Unauthorized`: User not authenticated
- `Invalid input`: Missing required fields
- `Duplicate code`: Code already exists
- `Database error`: Any Supabase error

---

#### `fetchClientsAction() → Client[]`

**Input**: None

**Output**: Array of clients in user's department

**Filtering**: Automatically filters to clients in the authenticated user's department (via RLS)

**Sorting**: Returned in order of `created_at DESC`

---

### Quotation Management

#### `submitQuotationForApprovalAction(quotationId: UUID) → SubmitQuotationResponse`

**Input**: 
```typescript
{
  quotationId: UUID
}
```

**Output**:
```typescript
interface SubmitQuotationResponse {
  success: boolean;
  quotation?: Quotation;
  error?: string;
}

interface Quotation {
  id: UUID;
  department_id: UUID;
  client_id: UUID;
  amount: Decimal;
  status: QuotationStatus;  // Will be 'Pending[SalesManager]' after submission
  approval_chain: ApprovalChain;
  created_by: UUID;
  submitted_at?: ISO8601;
  created_at: ISO8601;
  updated_at: ISO8601;
}

type QuotationStatus = 
  | 'Draft'
  | 'Pending[SalesManager]'
  | 'Pending[Owner]'
  | 'Pending[Executive]'
  | 'Approved'
  | 'Rejected';

interface ApprovalChain {
  sales_manager?: ApprovalStatus;
  owner?: ApprovalStatus;
  executive?: ApprovalStatus;
}

interface ApprovalStatus {
  status: 'approved' | 'rejected' | 'pending';
  approved_by?: UUID;
  approved_at?: ISO8601;
  reason?: string;
}
```

**Preconditions**:
- Quotation status must be 'Draft'
- User must be the quotation creator or have admin privileges

**State Transition**:
- Draft → Pending[SalesManager]

**Side Effects**:
- Updates `quotations.status` to 'Pending[SalesManager]'
- Sets `submitted_at` to current timestamp

---

#### `approveQuotationAction(quotationId: UUID, role: UserRole) → ApproveQuotationResponse`

**Input**:
```typescript
{
  quotationId: UUID;
  role: 'sales_manager' | 'owner' | 'executive';
}
```

**Output**:
```typescript
interface ApproveQuotationResponse {
  success: boolean;
  quotation?: Quotation;
  error?: string;
}
```

**Preconditions**:
- User's role must match the required approver for the current quotation status
- Quotation must be in a pending approval state (not Draft, Approved, or Rejected)

**State Transitions**:
- If amount < 3,000,000:
  - Pending[SalesManager] → Approved
- If amount >= 3,000,000:
  - Pending[SalesManager] → Pending[Owner]
  - Pending[Owner] → Pending[Executive]
  - Pending[Executive] → Approved

**Side Effects**:
- Updates quotation status
- Records approval in `quotation_approvals` table for audit
- Updates `approval_chain` JSON with approval timestamp

---

#### `rejectQuotationAction(quotationId: UUID, reason: string) → RejectQuotationResponse`

**Input**:
```typescript
{
  quotationId: UUID;
  reason?: string;  // Optional reason for rejection
}
```

**Output**: Same as ApproveQuotationResponse

**State Transition**:
- Any pending status → Rejected (terminal)

**Side Effects**:
- Sets quotation status to 'Rejected'
- Records rejection in `quotation_approvals` table with reason
- Terminates approval chain (no further approvals needed)

---

### Purchase Order Management

#### `recordCollectionAction(poId: UUID, amount: number) → RecordCollectionResponse`

**Input**:
```typescript
{
  poId: UUID;
  amount: Decimal;  // Positive number
}
```

**Output**:
```typescript
interface RecordCollectionResponse {
  success: boolean;
  purchaseOrder?: PurchaseOrder;
  error?: string;
}

interface PurchaseOrder {
  id: UUID;
  department_id: UUID;
  client_id: UUID;
  po_number: string;
  total_amount: Decimal;
  collected_amount: Decimal;
  status: 'Draft' | 'Active' | 'Closed';
  created_by: UUID;
  created_at: ISO8601;
  updated_at: ISO8601;
}
```

**Validation**:
- `amount` must be > 0
- `collected_amount + amount` must be <= `total_amount`
- PO must be in 'Active' status

**Side Effects**:
- Inserts new row in `collections` table
- Updates `purchase_orders.collected_amount` via trigger
- Trigger recalculates total from all collections

**Error Cases**:
- `Amount exceeds balance`: New total would exceed PO total
- `PO not active`: PO is in Draft or Closed status
- `Invalid amount`: Amount <= 0
- `Database error`: Any Supabase error

---

## Database RLS Policies

### Clients Table

```sql
-- SELECT: Users can view clients in their department
CREATE POLICY "users_can_view_clients_in_department"
ON clients FOR SELECT
USING (department_id = auth.jwt()->>'department_id'::UUID);

-- INSERT: sales_staff and higher can create
CREATE POLICY "sales_staff_can_create_clients"
ON clients FOR INSERT
WITH CHECK (
  department_id = auth.jwt()->>'department_id'::UUID
  AND auth.jwt()->>'role' IN ('sales_staff', 'sales_manager', 'owner', 'executive')
);
```

### Quotations Table

```sql
-- SELECT: Users can view quotations in their department
-- EXCEPTION: executives can view high-value quotations from any department (>= 3M)
CREATE POLICY "users_can_view_quotations"
ON quotations FOR SELECT
USING (
  department_id = auth.jwt()->>'department_id'::UUID
  OR (
    auth.jwt()->>'role' IN ('owner', 'executive')
    AND amount >= 3000000
  )
);

-- INSERT: sales_staff can create
CREATE POLICY "sales_staff_can_create_quotations"
ON quotations FOR INSERT
WITH CHECK (
  department_id = auth.jwt()->>'department_id'::UUID
  AND auth.jwt()->>'role' = 'sales_staff'
);

-- UPDATE: Controls approval transitions
CREATE POLICY "sales_manager_can_approve_low_value"
ON quotations FOR UPDATE
USING (
  department_id = auth.jwt()->>'department_id'::UUID
  AND auth.jwt()->>'role' = 'sales_manager'
  AND (amount < 3000000 OR status = 'Pending[SalesManager]')
)
WITH CHECK (
  status IN ('Pending[SalesManager]', 'Approved', 'Rejected')
);

CREATE POLICY "owner_can_approve_high_value"
ON quotations FOR UPDATE
USING (
  amount >= 3000000
  AND auth.jwt()->>'role' = 'owner'
  AND status = 'Pending[Owner]'
)
WITH CHECK (
  status IN ('Pending[Owner]', 'Pending[Executive]', 'Rejected')
);

CREATE POLICY "executive_can_approve_high_value"
ON quotations FOR UPDATE
USING (
  amount >= 3000000
  AND auth.jwt()->>'role' = 'executive'
  AND status = 'Pending[Executive]'
)
WITH CHECK (
  status IN ('Approved', 'Rejected')
);
```

### Purchase Orders Table

```sql
-- SELECT: Users can view POs in their department
CREATE POLICY "users_can_view_purchase_orders"
ON purchase_orders FOR SELECT
USING (department_id = auth.jwt()->>'department_id'::UUID);

-- INSERT: sales_staff can create
CREATE POLICY "sales_staff_can_create_purchase_orders"
ON purchase_orders FOR INSERT
WITH CHECK (
  department_id = auth.jwt()->>'department_id'::UUID
  AND auth.jwt()->>'role' IN ('sales_staff', 'sales_manager')
);

-- UPDATE: For recording collections (automatic via trigger)
CREATE POLICY "system_can_update_collected_amount"
ON purchase_orders FOR UPDATE
USING (TRUE)  -- Only via trigger
WITH CHECK (TRUE);
```

### Collections Table

```sql
-- INSERT: Users can record collections for their department POs
CREATE POLICY "users_can_record_collections"
ON collections FOR INSERT
WITH CHECK (
  (SELECT department_id FROM purchase_orders WHERE id = purchase_order_id)
  = auth.jwt()->>'department_id'::UUID
);

-- SELECT: Users can view collections for their department POs
CREATE POLICY "users_can_view_collections"
ON collections FOR SELECT
USING (
  (SELECT department_id FROM purchase_orders WHERE id = purchase_order_id)
  = auth.jwt()->>'department_id'::UUID
);
```

---

## Database Functions

### `create_collection(po_id UUID, collection_amount DECIMAL, recorded_by UUID)`

**Purpose**: Safely record a collection with balance validation and transaction safety.

**Logic**:
1. Acquire row lock on purchase_order
2. Fetch current `collected_amount` and `total_amount`
3. Validate: `collected_amount + collection_amount <= total_amount`
4. If valid: INSERT into collections table
5. Trigger automatically updates PO's `collected_amount`

**Error Handling**:
- Raises `EXCEPTION 'Collection amount exceeds available balance'` if validation fails
- Transactional: All or nothing

**Returns**: Updated PurchaseOrder record

---

## Triggers

### `update_po_collected_amount_on_collection_insert`

**Event**: AFTER INSERT on collections

**Action**: Recalculates `purchase_orders.collected_amount` by summing all associated collections

**Function**:
```sql
CREATE OR REPLACE FUNCTION update_purchase_order_collected_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET collected_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM collections
    WHERE purchase_order_id = NEW.purchase_order_id
  )
  WHERE id = NEW.purchase_order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Query / Service Layer Contracts

### `lib/sales/clients.ts`

```typescript
export async function fetchClients(userId: string): Promise<Client[]>
export async function createClient(userId: string, data: CreateClientForm): Promise<Client>
export async function getClient(clientId: UUID): Promise<Client>
```

### `lib/sales/quotations.ts`

```typescript
export async function fetchQuotations(userId: string): Promise<Quotation[]>
export async function getQuotation(quotationId: UUID): Promise<Quotation>
export async function submitQuotation(quotationId: UUID, userId: string): Promise<Quotation>
export async function approveQuotation(quotationId: UUID, userId: string, role: string): Promise<Quotation>
export async function rejectQuotation(quotationId: UUID, userId: string, reason?: string): Promise<Quotation>
export async function logApprovalAction(quotationId: UUID, userId: UUID, role: string, action: 'approved' | 'rejected', reason?: string): Promise<void>
```

### `lib/sales/purchase-orders.ts`

```typescript
export async function fetchPurchaseOrders(userId: string): Promise<PurchaseOrder[]>
export async function getPurchaseOrder(poId: UUID): Promise<PurchaseOrder>
export async function createPurchaseOrder(userId: string, data: CreatePOForm): Promise<PurchaseOrder>
export async function recordCollection(poId: UUID, amount: number, userId: string): Promise<PurchaseOrder>
export async function fetchCollectionHistory(poId: UUID): Promise<Collection[]>
```

### `lib/sales/approval-workflow.ts`

```typescript
export function determineApprovalLevel(amount: number, currentStatus: string): string
export function getApprovalChainStatus(quotation: Quotation, userRole: string): ApprovalChainStatus
export interface ApprovalChainStatus {
  canApprove: boolean;
  nextLevel: string;
  message: string;
}
```

---

## Error Response Format

All server actions follow a consistent error response format:

```typescript
// Success
{
  success: true,
  data: { /* response object */ }
}

// Error
{
  success: false,
  error: "Human-readable error message",
  code?: "ERROR_CODE"  // Optional: Machine-readable error code
}
```

---

## Conclusion

These contracts ensure:
- ✅ Type safety across frontend ↔ backend boundaries
- ✅ Clear RLS enforcement at database level
- ✅ Transaction safety for concurrent operations
- ✅ Consistent error handling
- ✅ Audit trail for all state changes
