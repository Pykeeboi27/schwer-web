# Research & Technical Decisions: Sales Dashboard UI Overhaul

**Feature**: 004-sales-dashboard-ui-overhaul  
**Date**: April 5, 2026  
**Purpose**: Document research findings and technical decisions for the UI/UX redesign and approval workflow implementation

---

## 1. Responsive Sidebar Navigation (Desktop + Mobile Hamburger)

### Problem Statement
Current dashboard layout does not provide clear navigation structure. Need persistent sidebar on desktop and hamburger menu on mobile with smooth transitions between breakpoints.

### Decision: Tailwind-Based Responsive Layout with Custom Hook

**Chosen Approach**: 
- **Desktop (≥768px)**: Persistent sidebar (200-250px width) + responsive main content
- **Mobile (<768px)**: Hidden sidebar, hamburger toggle in header; sidebar overlays on open
- **Responsive Logic**: Custom `useMediaQuery` hook to detect breakpoint changes
- **Implementation**: Tailwind classes (`hidden md:block`, `block md:hidden`) + state management

**Why Chosen**:
- Aligns with Next.js + Tailwind stack (no additional dependencies)
- Proven pattern in modern dashboards (GitHub, Vercel, etc.)
- Accessibility-friendly (semantic HTML, ARIA labels)
- No WebSocket or complex state management

**Alternatives Considered**:
- **CSS Media Queries only**: Insufficient for complex interactions (sidebar toggle state per viewport)
- **Radix UI Resizable**: Over-engineered; not needed for static sidebar widths
- **Custom CSS Grid**: Harder to maintain; Tailwind classes more readable

**Implementation Details**:
```tsx
// Custom hook: useMediaQuery
function useMediaQuery(query: string): boolean {
  // Returns true/false based on media query
  // Updates on resize
}

// Sidebar component
export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Sidebar renders: full on desktop, overlay on mobile
}
```

---

## 2. Shadcn/ui Dialog & Table Component Integration

### Problem Statement
Need consistent, accessible dialog and table components for client/quotation/PO management. Shadcn/ui provides Radix-based primitives that integrate well with Next.js + Tailwind.

### Decision: Shadcn/ui Dialog + Data Table Components

**Chosen Approach**:
- **Dialog**: Use Shadcn/ui `Dialog` component (wraps Radix Dialog) for create/edit/view modals
- **Table**: Use Shadcn/ui `Table` component with custom pagination, filtering, sorting
- **Form Integration**: Use React Hook Form + Shadcn/ui `Input`, `Label`, `Button` inside dialogs
- **Data Table**: Custom data table hook or library (e.g., TanStack Table) for advanced features (pagination, sorting, filtering)

**Why Chosen**:
- Shadcn/ui already approved in constitution
- Radix Dialog handles accessibility, focus management, keyboard shortcuts
- Tailwind styling matches existing design system
- Composability: easy to nest dialogs, build custom interactions

**Alternatives Considered**:
- **Headless UI**: Good but less opinionated; more boilerplate
- **MUI (Material-UI)**: Incompatible with Tailwind; adds weight
- **Custom HTML dialogs**: Accessibility burden; no focus management

**Implementation Details**:
```tsx
// CreateClientDialog.tsx
export function CreateClientDialog({open, onOpenChange}) {
  const [code, setCode] = useState('');
  const [clientData, setClientData] = useState({});
  
  const handleGenerateCode = () => {
    const newCode = generateClientCode();
    // Validate uniqueness here
    setCode(newCode);
  };
  
  const handleSubmit = async () => {
    // Server action: createClient
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>Create Client</DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input label="Name" {...} />
          <Input label="Code" value={code} disabled />
          <Button onClick={handleGenerateCode}>Generate Code</Button>
          {/* More fields */}
          <Button type="submit">Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 3. Supabase RLS for Department-Based & Role-Based Access Control

### Problem Statement
Must enforce authorization at the database level. Different roles (sales_staff, sales_manager, owner, executive) have different permissions for viewing/creating/approving resources.

### Decision: Row-Level Security (RLS) Policies + Role-Based Checks

**Chosen Approach**:
- **RLS Policies**: Enable RLS on sensitive tables (clients, quotations, purchase_orders, collections)
- **Department Isolation**: Every row includes `department_id`; policies filter by current user's department
- **Role-Based Actions**: Quotation approval actions validated via RLS statements like:
  ```sql
  CREATE POLICY "sales_manager_can_approve_quotations"
  ON quotations
  FOR UPDATE
  USING (department_id = auth.user_metadata()->'department_id'
         AND auth.user_metadata()->'role' = 'sales_manager'
         AND (status = 'Pending[SalesManager]' OR amount < 3000000))
  ```
- **Approval Chain**: Database function determines required approvers based on amount and routes accordingly

**Why Chosen**:
- RLS is mandatory per constitution (Principle II)
- Database-enforced permissions prevent client-side bypasses
- Scales to any number of departments/roles without code changes

**Alternatives Considered**:
- **Application-level authorization**: Insufficient; allows client-side tampering
- **JWT claims in RLS**: Complex; requires careful claim verification
- **Trigger-based audit**: Separate concern; RLS + audit triggers are complementary

**Implementation Details**:
```sql
-- In schema.sql
CREATE TABLE quotations (
  id UUID PRIMARY KEY,
  department_id UUID NOT NULL,
  client_id UUID NOT NULL,
  amount DECIMAL NOT NULL,
  status TEXT CHECK (status IN ('Draft', 'Pending[SalesManager]', 'Pending[Owner]', ...)),
  ...
);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_quotations_in_their_department"
ON quotations FOR SELECT
USING (department_id = (auth.jwt()->>'department_id')::UUID);

CREATE POLICY "sales_staff_can_create_quotations"
ON quotations FOR INSERT
WITH CHECK (
  department_id = (auth.jwt()->>'department_id')::UUID
  AND auth.jwt()->>'role' = 'sales_staff'
);
```

---

## 4. Client Code Generation & Uniqueness Guarantee

### Problem Statement
Auto-generate unique client codes with format C[6 random digits]. Must ensure no duplicates even under concurrent creation.

### Decision: Client-Side Generation + Database Constraint + Retry Logic

**Chosen Approach**:
- **Generation**: JavaScript on client side: `C` + 6 random digits (0-9)
- **Validation**: Query existing codes before submission; if conflict detected, regenerate
- **Database Guarantee**: UNIQUE constraint on `clients.code` column (last line of defense)
- **Retry Logic**: If submission fails due to unique constraint, client regenerates code and retries

**Why Chosen**:
- Client-side generation is stateless; no server roundtrip for code generation
- Random digits are simpler to generate than sequential numbers (which require counter state)
- UNIQUE constraint at DB level prevents concurrent collisions
- Retry logic with exponential backoff handles rare collisions gracefully

**Alternatives Considered**:
- **Server-side sequential**: Requires counter increment; more complex,  not user-preferred (user said client-side)
- **UUIDv4**: Globally unique but less human-readable; not preferred
- **Timestamp + random**: More complex; sequential approach preferred user's C[6 digits] request

**Implementation Details**:
```typescript
// lib/client-code-generator.ts
export function generateClientCode(): string {
  const randomDigits = Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 10)
  ).join('');
  return `C${randomDigits}`;
}

export async function validateClientCodeUniqueness(code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('code', code)
    .single();
  
  return !data; // Returns true if code is unique
}

// In CreateClientDialog.tsx
async function handleGenerateCode() {
  let code: string;
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    code = generateClientCode();
    isUnique = await validateClientCodeUniqueness(code);
    attempts++;
  }
  
  if (isUnique) {
    setCode(code);
  } else {
    showToast('error', 'Failed to generate unique code, please try again');
  }
}
```

---

## 5. Quotation Approval Workflow: Amount-Based Multi-Level Routing

### Problem Statement
Quotations under 3,000,000 require only sales_manager approval. Quotations >= 3,000,000 require sequential approval from sales_manager, then owner, then executive. Must track approval chain and route correctly.

### Decision: Database State Machine + Approval Routing Function

**Chosen Approach**:
- **Status Enum**: `status` field with values: Draft, Pending[SalesManager], Pending[Owner], Pending[Executive], Approved, Rejected
- **Approval Chain Metadata**: JSON field `approval_chain` tracks which roles have approved/need to approve
  ```json
  {
    "sales_manager": {"status": "approved", "at": "2026-04-05T10:00Z"},
    "owner": {"status": "pending"},
    "executive": {"status": "pending"}
  }
  ```
- **Routing Logic**: Function in `lib/sales/approval-workflow.ts` determines next approver based on amount + current state
- **Audit Trail**: Separate `quotation_approvals` table logs each approval action (who, when, action, reason)

**Why Chosen**:
- State machine formalization prevents invalid state transitions
- JSON metadata provides flexibility for future approval chains
- Audit trail required for compliance/traceability
- RLS policies enforce action permissions (e.g., only sales_manager can move status from Draft to Pending[SalesManager])

**Alternatives Considered**:
- **No state machine**: Leads to invalid states; hard to debug
- **Flat "all must approve"**: Doesn't capture sequential requirement
- **Hardcoded if/else**: Not maintainable; approval rules embedded in code

**Implementation Details**:
```typescript
// lib/sales/approval-workflow.ts
export function determineNextApprovalLevel(
  quotation: Quotation,
  currentRole: Role
): Role | 'finalized' {
  const amount = quotation.amount;
  
  if (amount < 3000000) {
    // Single approval: sales_manager
    return quotation.status === 'Draft' ? 'sales_manager' : 'finalized';
  } else {
    // Multi-level: sales_manager → owner → executive
    if (quotation.status === 'Draft') return 'sales_manager';
    if (quotation.status === 'Pending[SalesManager]') return 'owner';
    if (quotation.status === 'Pending[Owner]') return 'executive';
    return 'finalized';
  }
}

// Server action: approveQuotation
export async function approveQuotation(
  quotationId: string,
  approvingRole: Role
): Promise<Quotation | void> {
  const quotation = await fetchQuotation(quotationId);
  const nextLevel = determineNextApprovalLevel(quotation, approvingRole);
  
  let newStatus: string;
  if (nextLevel === 'finalized') {
    newStatus = 'Approved';
  } else {
    newStatus = `Pending[${nextLevel}]`;
  }
  
  // Update quotation.status
  // Log approval in quotation_approvals table
  // Return updated quotation
}
```

---

## 6. Collection Recording & Balance Validation

### Problem Statement
When recording a collection, must validate that the accumulated total doesn't exceed the purchase order's total amount. Concurrent collections must be handled safely.

### Decision: Database Transaction + Constraint-Based Validation

**Chosen Approach**:
- **Validation Check**: Before INSERT into `collections` table, compute `current_collected + new_amount <= po.total_amount`
- **Transaction**: Wrap collection recording in database transaction to prevent race conditions
- **Error Handling**: If validation fails, return error; UI shows toast "Collection amount exceeds available balance"
- **Accumulation**: Aggregated total computed via view or trigger; `po.collected_amount` updated after each collection

**Why Chosen**:
- Database transactions provide ACID guarantees; concurrent writes are serialized
- Constraint validation prevents logical errors at DB level
- Accumulation via trigger ensures `collected_amount` always reflects true total

**Alternatives Considered**:
- **Client-side validation only**: Insufficient; doesn't prevent concurrent over-collection
- **Optimistic locking**: Adds complexity; transaction-based approach simpler
- **Message queue**: Overkill for this use case; transactions sufficient

**Implementation Details**:
```typescript
// Server action: recordCollection
export async function recordCollection(
  poId: string,
  amount: number
): Promise<PurchaseOrder | Error> {
  return await supabase.rpc('create_collection', {
    po_id: poId,
    collection_amount: amount,
    recorded_by: userId,
  });
}

// In schema.sql (PostgreSQL function with transaction)
CREATE OR REPLACE FUNCTION create_collection(
  po_id UUID,
  collection_amount DECIMAL,
  recorded_by UUID
) RETURNS PURCHASE_ORDERS AS $$
BEGIN
  -- Start transaction
  -- Fetch current PO with lock
  -- Validate: collected_amount + collection_amount <= total_amount
  IF (SELECT (collected_amount + collection_amount) FROM purchase_orders WHERE id = po_id)
     > (SELECT total_amount FROM purchase_orders WHERE id = po_id)
  THEN
    RAISE EXCEPTION 'Collection exceeds available balance';
  END IF;
  
  -- Insert collection record
  INSERT INTO collections (po_id, amount, recorded_by, created_at)
  VALUES (po_id, collection_amount, recorded_by, NOW());
  
  -- Update PO: collected_amount = collected_amount + collection_amount
  UPDATE purchase_orders
  SET collected_amount = collected_amount + collection_amount
  WHERE id = po_id;
  
  -- Return updated PO
  RETURN (SELECT * FROM purchase_orders WHERE id = po_id);
END;
$$ LANGUAGE plpgsql;
```

---

## 7. In-App Toast Notifications (No Email)

### Problem Statement
Users need immediate feedback when approval actions succeed or fail. No email notifications in this release.

### Decision: Shadcn/ui Toast + React Context Hook

**Chosen Approach**:
- **Toast Component**: Use Shadcn/ui toast (or custom toast wrapper around Sonner/similar)
- **Context**: Toast context provides `showToast(type, message)` hook for use in server action callbacks
- **Auto-Dismiss**: Toasts auto-dismiss after 3-5 seconds
- **Types**: Success (green), error (red), info (blue)

**Why Chosen**:
- Simple, non-intrusive; doesn't require infrastructure changes
- Immediate feedback; faster than polling for status changes
- Aligns with modern dashboard UX patterns

**Alternatives Considered**:
- **Email notifications**: Deferred per user clarification
- **In-database notifications**: Requires WebSocket/polling; overkill
- **Browser notifications**: May trigger browser permission prompts; not ideal for internal dashboards

**Implementation Details**:
```tsx
// lib/hooks/useToast.ts
export function useToast() {
  const { toast } = useContext(ToastContext);
  return (type: 'success' | 'error' | 'info', message: string) => {
    toast({
      title: message,
      variant: type === 'error' ? 'destructive' : 'default',
      duration: 4000,
    });
  };
}

// In server action callback
async function handleApproveQuotation() {
  const toast = useToast();
  try {
    await approveQuotation(quotationId);
    toast('success', 'Quotation approved successfully');
    // Optionally trigger table refresh
  } catch (error) {
    toast('error', error.message);
  }
}
```

---

## 8. E2E Testing with Playwright

### Problem Statement
Must test responsive design, dialog interactions, form submissions, approval workflows, and collection validation. Playwright is already integrated in the project.

### Decision: Playwright E2E Tests for Critical User Journeys

**Chosen Approach**:
- **Test Suite**: Group tests by feature area (clients, quotations, POs)
- **Responsive Testing**: Test each flow at desktop (1024px) and mobile (375px) viewports
- **Server Action Mocking**: Use Playwright's interception to test error scenarios
- **Database Seeding**: Pre-populate test data; use transactions to rollback after each test

**Why Chosen**:
- Playwright already integrated; leverage existing infrastructure
- Tests actual browser behavior; catches UI bugs that unit tests miss
- Full-stack validation: UI + server actions + database

**Alternatives Considered**:
- **Cypress**: Already using Playwright; no need to add another framework
- **Selenium**: Outdated; Playwright more reliable
- **Manual testing only**: Doesn't scale; no regression protection

**Implementation Details**:
```typescript
// tests/e2e/clients-create-search.spec.ts
test.describe('Clients Tab: Create & Search', () => {
  test('should create a client and see it in the table (desktop)', async ({ page }) => {
    await page.goto('/sales');
    await page.click('button:has-text("Create Client")');
    
    // Dialog opens
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Generate code
    await page.click('button:has-text("Generate Code")');
    const codeValue = await page.locator('input[name="code"]').inputValue();
    expect(codeValue).toMatch(/^C\d{6}$/);
    
    // Fill form
    await page.fill('input[name="name"]', 'Test Client');
    await page.fill('input[name="contact"]', 'John Doe');
    await page.click('button[type="submit"]');
    
    // Dialog closes, table refreshes
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.locator('text=Test Client')).toBeVisible();
  });
  
  test('should filter clients by name (mobile)', async ({ page }) => {
    // Set viewport to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/sales');
    
    // Sidebar should be hidden
    await expect(page.locator('aside')).not.toBeVisible();
    
    // Hamburger visible
    await expect(page.locator('button[aria-label="Toggle menu"]')).toBeVisible();
    
    // Open sidebar
    await page.click('button[aria-label="Toggle menu"]');
    await expect(page.locator('aside')).toBeVisible();
    
    // Click Clients
    await page.click('a:has-text("Clients")');
    // Sidebar auto-closes on navigation
    await expect(page.locator('aside')).not.toBeVisible();
    
    // Filter clients
    await page.fill('input[placeholder="Search clients..."]', 'Test');
    await expect(page.locator('text=Test Client')).toBeVisible();
  });
});

// tests/e2e/quotations-approval-workflow.spec.ts
test.describe('Quotations Approval Workflow', () => {
  test('should require sales_manager approval for quotations < 3,000,000', async ({ page }) => {
    // Login as sales_staff
    await loginAs(page, 'sales_staff');
    await page.goto('/sales/quotations');
    
    // Create quotation with amount 2,000,000
    await page.click('button:has-text("Create Quotation")');
    await page.fill('input[name="amount"]', '2000000');
    await page.click('button[type="submit"]');
    
    // Quotation appears with status "Pending[SalesManager]"
    await expect(page.locator('text=Pending[SalesManager]')).toBeVisible();
    
    // Switch to sales_manager
    await loginAs(page, 'sales_manager');
    await page.goto('/sales/quotations');
    
    // Open quotation
    await page.click('tr:has-text("2000000")');
    
    // Should see Approve button (not Owner/Executive)
    await expect(page.locator('button:has-text("Approve")')).toBeVisible();
    
    // Approve
    await page.click('button:has-text("Approve")');
    
    // Should see success toast
    await expect(page.locator('text=Quotation approved')).toBeVisible();
  });
  
  test('should require sequential approval for quotations >= 3,000,000', async ({ page }) => {
    // Create quotation with amount 5,000,000
    // Submit as sales_staff
    // Verify sales_manager sees Approve button
    // Sales manager approves → status becomes "Pending[Owner]"
    // Owner approves → status becomes "Pending[Executive]"
    // Executive approves → status becomes "Approved"
  });
});
```

---

## Summary of Technical Decisions

| Decision | Approach | Why |
|----------|----------|-----|
| **Sidebar Navigation** | Tailwind responsive + custom hook | Simplicity, no external deps |
| **Dialogs & Tables** | Shadcn/ui components | Already approved, accessible |
| **Authorization** | Supabase RLS policies | Mandatory per constitution |
| **Client Code Generation** | Client-side C[6 digits] + DB constraint | User preference, simple |
| **Approval Routing** | DB state machine + routing function | Maintainable, auditable |
| **Collection Safety** | DB transaction + constraint validation | Prevents concurrent bugs |
| **Notifications** | In-app toast only | Immediate feedback, scope-appropriate |
| **Testing** | Playwright E2E + unit/integration | Full-stack coverage |

---

## Research Dependencies Resolved

✅ All unknowns from specification clarification phase eliminated.  
✅ All technical decisions justified and documented.  
✅ Ready for Phase 1 design artifact generation (data-model.md, quickstart.md, contracts/).
