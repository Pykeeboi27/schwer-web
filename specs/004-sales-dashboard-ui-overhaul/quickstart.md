# Developer Quickstart: Sales Dashboard UI Overhaul

**Feature**: 004-sales-dashboard-ui-overhaul  
**Date**: April 5, 2026  
**Purpose**: Help developers understand the feature architecture, setup, and common patterns

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Project Setup](#project-setup)
3. [Common Development Tasks](#common-development-tasks)
4. [Component Examples](#component-examples)
5. [Testing Patterns](#testing-patterns)
6. [Key Files & Structure](#key-files--structure)
7. [Troubleshooting](#troubleshooting)

---

## Feature Overview

The Sales Dashboard UI Overhaul delivers four major improvements:

1. **Responsive Layout**: Sidebar navigation (desktop) + hamburger menu (mobile)
2. **Client Management**: Table with filtering, create dialog, details dialog
3. **Quotation Approval**: Amount-based multi-role approval workflow
4. **Purchase Order Tracking**: Collection recording with balance validation

### Key Entities

- **Client**: Business contact; auto-generated code (C[6 digits])
- **Quotation**: Sales quotation with approval workflow (single aggregate amount; no line items in MVP)
- **PurchaseOrder**: Purchase order with collection tracking
- **Collection**: Payment record; accumulated against PO total

### Architecture Decisions

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Supabase (Auth + Postgres + RLS)
- **Testing**: Playwright (E2E), Vitest (unit), custom integration tests
- **State Management**: React hooks + server actions (no Redux/Zustand for this scope)
- **Form Handling**: React Hook Form + Shadcn/ui inputs

---

## Project Setup

### Prerequisites

- Node.js 18+
- Supabase account (already configured)
- TypeScript 5+
- Playwright CLI (for E2E tests)

### Environment Variables

Ensure `.env.local` contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (server-side only)
```

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start dev server**:
   ```bash
   npm run dev
   ```
   Access dashboard at `http://localhost:3000/protected/sales`

3. **Database setup** (one-time):
   - Apply migration: `schema.sql` changes (in Supabase SQL editor)
   - Create test user profiles with roles: `sales_staff`, `sales_manager`, `owner`, `executive`
   - Seed test data (clients, quotations, POs)

4. **Run tests**:
   ```bash
   npm run test:unit                          # Unit tests
   npm run test:integration                   # Integration tests
   npx playwright test                        # E2E tests
   ```

### Running Feature 004 E2E Tests

Authenticated sales flows are skip-gated unless credentials are provided.

Set required environment variables before running Feature 004 E2E specs:

```powershell
$env:E2E_SALES_LOGIN_EMAIL="sales.staff@example.com"
$env:E2E_SALES_LOGIN_PASSWORD="your-password"
$env:E2E_SALES_MANAGER_LOGIN_EMAIL="sales.manager@example.com"
$env:E2E_SALES_MANAGER_LOGIN_PASSWORD="your-password"
$env:E2E_OWNER_LOGIN_EMAIL="owner@example.com"
$env:E2E_OWNER_LOGIN_PASSWORD="your-password"
```

Run only Feature 004 specs:

```bash
npx playwright test tests/e2e/sales-dashboard-layout.spec.ts
npx playwright test tests/e2e/clients-create-search.spec.ts
npx playwright test tests/e2e/quotations-approval-workflow.spec.ts
npx playwright test tests/e2e/purchase-orders-collection.spec.ts
```

Run all sales-related E2E tests in one command:

```bash
npx playwright test tests/e2e/sales-*.spec.ts tests/e2e/*-workflow.spec.ts tests/e2e/*-collection.spec.ts
```

---

## Common Development Tasks

### Task 1: Add a New Client

**Files involved**:
- `app/protected/sales/clients/page.tsx` (table view)
- `app/protected/sales/clients/actions.ts` (server action)
- `components/dialogs/create-client-dialog.tsx` (dialog)
- `lib/sales/clients.ts` (service layer)
- `lib/utils/client-code-generator.ts` (code generation utility)

**Step-by-step**:

1. **Client-side (Form)**:

   ```tsx
   // components/dialogs/create-client-dialog.tsx
   export function CreateClientDialog({ open, onOpenChange }) {
     const [code, setCode] = useState('');
     const [formData, setFormData] = useState({
       name: '', contact_person: '', email: '', phone: '', address: ''
     });
     const router = useRouter();
     const { toast } = useToast();

     const handleGenerateCode = async () => {
       let newCode: string;
       let isUnique = false;
       let attempts = 0;

       while (!isUnique && attempts < 10) {
         newCode = generateClientCode();
         isUnique = await validateClientCodeUniqueness(newCode);
         attempts++;
       }

       if (isUnique) {
         setCode(newCode);
       } else {
         toast({ title: 'Failed to generate unique code', variant: 'destructive' });
       }
     };

     const handleSubmit = async (e) => {
       e.preventDefault();
       try {
         await createClient({ code, ...formData });
         toast({ title: 'Client created successfully' });
         onOpenChange(false);
         router.refresh(); // Refresh client list table
       } catch (error) {
         toast({ title: error.message, variant: 'destructive' });
       }
     };

     return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent>
           <DialogHeader><DialogTitle>Create Client</DialogTitle></DialogHeader>
           <form onSubmit={handleSubmit}>
             <div className="space-y-4">
               <div>
                 <Label htmlFor="name">Client Name *</Label>
                 <Input
                   id="name"
                   required
                   value={formData.name}
                   onChange={(e) => setFormData({...formData, name: e.target.value})}
                 />
               </div>

               <div>
                 <Label htmlFor="code">Client Code</Label>
                 <div className="flex gap-2">
                   <Input id="code" value={code} disabled className="flex-1" />
                   <Button onClick={handleGenerateCode} type="button" variant="outline">
                     Generate
                   </Button>
                 </div>
               </div>

               <div>
                 <Label htmlFor="contact">Contact Person</Label>
                 <Input
                   id="contact"
                   value={formData.contact_person}
                   onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                 />
               </div>

               <div>
                 <Label htmlFor="email">Email</Label>
                 <Input
                   id="email"
                   type="email"
                   value={formData.email}
                   onChange={(e) => setFormData({...formData, email: e.target.value})}
                 />
               </div>

               <div>
                 <Label htmlFor="phone">Phone</Label>
                 <Input
                   id="phone"
                   value={formData.phone}
                   onChange={(e) => setFormData({...formData, phone: e.target.value})}
                 />
               </div>

               <div>
                 <Label htmlFor="address">Address</Label>
                 <Input
                   id="address"
                   as="textarea"
                   value={formData.address}
                   onChange={(e) => setFormData({...formData, address: e.target.value})}
                 />
               </div>
             </div>

             <DialogFooter className="mt-6">
               <Button type="submit">Create Client</Button>
             </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>
     );
   }
   ```

2. **Server-side (Action)**:

   ```typescript
   // app/protected/sales/clients/actions.ts
   'use server';

   import { createClient } from '@/lib/sales/clients';
   import { getCurrentUser } from '@/lib/supabase/auth';

   export async function createClientAction(data: CreateClientForm) {
     const user = await getCurrentUser();
     if (!user) throw new Error('Unauthorized');

     try {
       const newClient = await createClient(user.id, data);
       return { success: true, client: newClient };
     } catch (error) {
       return { success: false, error: error.message };
     }
   }
   ```

3. **Service Layer**:

   ```typescript
   // lib/sales/clients.ts
   import { supabaseServer } from '@/lib/supabase/server';

   export async function createClient(
     userId: string,
     data: { code: string; name: string; email?: string; ... }
   ) {
     const { data: newClient, error } = await supabaseServer
       .from('clients')
       .insert({
         department_id: await getUserDepartment(userId), // Helper function
         created_by: userId,
         ...data,
       })
       .select()
       .single();

     if (error) throw new Error(error.message);
     return newClient;
   }
   ```

4. **Code Generator**:

   ```typescript
   // lib/utils/client-code-generator.ts
   export function generateClientCode(): string {
     const randomDigits = Array.from({ length: 6 }, () =>
       Math.floor(Math.random() * 10)
     ).join('');
     return `C${randomDigits}`;
   }

   export async function validateClientCodeUniqueness(code: string): Promise<boolean> {
     const { data } = await supabaseClient
       .from('clients')
       .select('id')
       .eq('code', code)
       .single();
     return !data; // True if code is unique
   }
   ```

---

### Task 2: Approve a Quotation (High-Value)

**Files involved**:
- `app/protected/sales/quotations/page.tsx` (table)
- `app/protected/sales/quotations/actions.ts` (server actions)
- `components/dialogs/quotation-details-dialog.tsx` (dialog with approve button)
- `lib/sales/quotations.ts` (service layer)
- `lib/sales/approval-workflow.ts` (routing logic)

**Step-by-step**:

1. **Approval Routing Logic**:

   ```typescript
   // lib/sales/approval-workflow.ts
   import { determineNextQuotationStatus } from '@/lib/sales/approval-workflow';

   export function getApprovalChainStatus(
     quotation: Quotation,
     userRole: string
   ): {
     canApprove: boolean;
     nextLevel: string;
     message: string;
   } {
     const nextStatus = determineNextQuotationStatus(quotation.status, userRole, quotation.amount);

     if (nextStatus === 'approved') {
       return {
         canApprove: false,
         nextLevel: 'finalized',
         message: 'Quotation approval is complete',
       };
     }

     const roleToStatusMap = {
       'sales_manager': 'pending_sales_manager',
       'owner': 'pending_owner',
       'executive': 'pending_executive',
     };

     const canApprove = quotation.status === roleToStatusMap[userRole] && nextStatus !== quotation.status;

     return {
       canApprove,
       nextLevel,
       message: canApprove ? `You can approve this quotation` : 
                `Waiting for ${nextLevel} approval`,
     };
   }
   ```

2. **Dialog Component**:

   ```tsx
   // components/dialogs/quotation-details-dialog.tsx
   export function QuotationDetailsDialog({ quotation, open, onOpenChange }) {
     const { toast } = useToast();
     const user = useCurrentUser();
     const [isApproving, setIsApproving] = useState(false);
     const router = useRouter();

     const approvalStatus = getApprovalChainStatus(quotation, user.role);

     const handleApprove = async () => {
       setIsApproving(true);
       try {
         await approveQuotation(quotation.id);
         toast({ title: 'Quotation approved successfully' });
         router.refresh();
         onOpenChange(false);
       } catch (error) {
         toast({ title: error.message, variant: 'destructive' });
       } finally {
         setIsApproving(false);
       }
     };

     return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Quotation Details</DialogTitle>
           </DialogHeader>
           
           <div className="space-y-4">
             <div><strong>Amount:</strong> ${quotation.amount.toLocaleString()}</div>
             <div><strong>Status:</strong> <Badge>{quotation.status}</Badge></div>
             <div><strong>Client:</strong> {quotation.client.name}</div>
             
             {/* Approval Chain Visualization */}
             <div className="border-t pt-4">
               <strong>Approval Chain:</strong>
               {quotation.amount >= 3000000 && (
                 <div className="mt-2 space-y-2 text-sm">
                   <div className="flex items-center gap-2">
                     {quotation.approval_chain?.sales_manager?.status === 'approved' ? '✓' : '○'}
                     Sales Manager
                   </div>
                   <div className="flex items-center gap-2">
                     {quotation.approval_chain?.owner?.status === 'approved' ? '✓' : '○'}
                     Owner
                   </div>
                   <div className="flex items-center gap-2">
                     {quotation.approval_chain?.executive?.status === 'approved' ? '✓' : '○'}
                     Executive
                   </div>
                 </div>
               )}
             </div>
           </div>

           <DialogFooter>
             {approvalStatus.canApprove && (
               <Button
                 onClick={handleApprove}
                 disabled={isApproving}
                 loading={isApproving}
               >
                 Approve
               </Button>
             )}
             {!approvalStatus.canApprove && (
               <p className="text-sm text-gray-500">{approvalStatus.message}</p>
             )}
           </DialogFooter>
         </DialogContent>
       </Dialog>
     );
   }
   ```

3. **Server Action**:

   ```typescript
   // app/protected/sales/quotations/actions.ts
   'use server';

   import { approveQuotation as approveQuotationService } from '@/lib/sales/quotations';
   import { getCurrentUser } from '@/lib/supabase/auth';

   export async function approveQuotation(quotationId: string) {
     const user = await getCurrentUser();
     if (!user) throw new Error('Unauthorized');

     try {
       const updated = await approveQuotationService(quotationId, user.id, user.role);
       return updated;
     } catch (error) {
       throw new Error(error.message);
     }
   }
   ```

4. **Service Layer**:

   ```typescript
   // lib/sales/quotations.ts
   export async function approveQuotation(
     quotationId: string,
     userId: string,
     userRole: string
   ) {
     const quotation = await getQuotation(quotationId);
     const newStatus = determineNextQuotationStatus(
       quotation.status,
       userRole,
       quotation.amount,
     );

     if (newStatus === quotation.status) {
       throw new Error('Quotation approval is already complete');
     }

     // Update quotation status + approval chain
     const { data, error } = await supabaseServer
       .from('quotations')
       .update({
         status: newStatus,
         approval_chain: {
           ...quotation.approval_chain,
           [userRole]: {
             status: 'approved',
             approved_by: userId,
             approved_at: new Date().toISOString(),
           },
         },
       })
       .eq('id', quotationId)
       .select()
       .single();

     if (error) throw new Error(error.message);

     // Log approval in audit table
     await logApprovalAction(quotationId, userId, userRole, 'approved');

     return data;
   }
   ```

---

### Task 3: Record a Collection on a Purchase Order

**Files involved**:
- `app/protected/sales/purchase-orders/page.tsx` (table)
- `app/protected/sales/purchase-orders/actions.ts` (server actions)
- `components/dialogs/record-collection-dialog.tsx` (dialog)
- `lib/sales/purchase-orders.ts` (service layer)

**Step-by-step**:

1. **Record Collection Dialog**:

   ```tsx
   // components/dialogs/record-collection-dialog.tsx
   export function RecordCollectionDialog({ po, open, onOpenChange }) {
     const { toast } = useToast();
     const [amount, setAmount] = useState('');
     const [isSubmitting, setIsSubmitting] = useState(false);
     const router = useRouter();

     const remainingAmount = po.total_amount - po.collected_amount;

     const handleSubmit = async (e) => {
       e.preventDefault();
       const collectionAmount = parseFloat(amount);

       if (collectionAmount <= 0) {
         toast({ title: 'Amount must be greater than 0', variant: 'destructive' });
         return;
       }

       if (collectionAmount > remainingAmount) {
         toast({
           title: `Amount exceeds remaining balance (${remainingAmount.toLocaleString()})`,
           variant: 'destructive',
         });
         return;
       }

       setIsSubmitting(true);

       try {
         await recordCollection(po.id, collectionAmount);
         toast({ title: `Collection of $${collectionAmount.toLocaleString()} recorded` });
         setAmount('');
         router.refresh();
         onOpenChange(false);
       } catch (error) {
         toast({ title: error.message, variant: 'destructive' });
       } finally {
         setIsSubmitting(false);
       }
     };

     return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Record Collection</DialogTitle>
           </DialogHeader>

           <div className="space-y-4 mb-6">
             <div>
               <strong>PO Total:</strong> ${po.total_amount.toLocaleString()}
             </div>
             <div>
               <strong>Already Collected:</strong> ${po.collected_amount.toLocaleString()}
             </div>
             <div className="bg-blue-50 p-3 rounded">
               <strong>Remaining:</strong> ${remainingAmount.toLocaleString()}
             </div>
           </div>

           <form onSubmit={handleSubmit}>
             <div className="space-y-4">
               <div>
                 <Label htmlFor="amount">Collection Amount *</Label>
                 <Input
                   id="amount"
                   type="number"
                   step="0.01"
                   min="0"
                   max={remainingAmount}
                   required
                   value={amount}
                   onChange={(e) => setAmount(e.target.value)}
                   placeholder="Enter amount"
                 />
               </div>
             </div>

             <DialogFooter className="mt-6">
               <Button
                 type="submit"
                 disabled={isSubmitting}
                 loading={isSubmitting}
               >
                 Record Collection
               </Button>
             </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>
     );
   }
   ```

2. **Server Action**:

   ```typescript
   // app/protected/sales/purchase-orders/actions.ts
   'use server';

   import { recordCollection as recordCollectionService } from '@/lib/sales/purchase-orders';
   import { getCurrentUser } from '@/lib/supabase/auth';

   export async function recordCollection(poId: string, amount: number) {
     const user = await getCurrentUser();
     if (!user) throw new Error('Unauthorized');

     return await recordCollectionService(poId, amount, user.id);
   }
   ```

3. **Service with Transaction**:

   ```typescript
   // lib/sales/purchase-orders.ts
   export async function recordCollection(
     poId: string,
     amount: number,
     userId: string
   ) {
     return await supabaseServer.rpc('create_collection', {
       po_id: poId,
       collection_amount: amount,
       recorded_by: userId,
     });
   }
   ```

---

## Component Examples

### Example: Sidebar Component with Responsive Hamburger

```tsx
// components/layouts/sidebar.tsx
'use client';

import { useState } from 'react';
import { useMediaQuery } from '@/lib/utils/useMediaQuery';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const toggleSidebar = () => setIsOpen(!isOpen);

  const navItems = [
    { label: 'Clients', href: '/protected/sales/clients' },
    { label: 'Quotations', href: '/protected/sales/quotations' },
    { label: 'Purchase Orders', href: '/protected/sales/purchase-orders' },
  ];

  return (
    <>
      {/* Mobile Hamburger */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          aria-label="Toggle menu"
          className="fixed top-4 left-4 z-50 p-2"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative md:block
          w-64 h-screen bg-gray-900 text-white
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          z-40
        `}
      >
        <nav className="p-6">
          <h1 className="text-2xl font-bold mb-8">Sales Dashboard</h1>
          <ul className="space-y-4">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => isMobile && setIsOpen(false)}
                  className="block py-2 px-4 rounded hover:bg-gray-800"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Backdrop (mobile) */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
```

### Example: Clients Table with Search/Filter

```tsx
// components/tables/clients-table.tsx
'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClientDetailsDialog } from '@/components/dialogs/client-details-dialog';

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (client) =>
          client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [clients, searchTerm]
  );

  return (
    <>
      <div className="mb-4">
        <Input
          placeholder="Search by name, code, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No clients found matching "{searchTerm}"
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.map((client) => (
              <TableRow
                key={client.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  setSelectedClient(client);
                  setDialogOpen(true);
                }}
              >
                <TableCell><code className="bg-gray-100 px-2 py-1 rounded">{client.code}</code></TableCell>
                <TableCell>{client.name}</TableCell>
                <TableCell>{client.contact_person}</TableCell>
                <TableCell>{client.email}</TableCell>
                <TableCell>{client.phone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selectedClient && (
        <ClientDetailsDialog
          client={selectedClient}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </>
  );
}
```

---

## Testing Patterns

### Unit Test: Code Generation

```typescript
// tests/unit/client-code-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateClientCode } from '@/lib/utils/client-code-generator';

describe('generateClientCode', () => {
  it('should generate code with C prefix and 6 digits', () => {
    const code = generateClientCode();
    expect(code).toMatch(/^C\d{6}$/);
  });

  it('should generate different codes on multiple calls', () => {
    const codes = new Set(
      Array.from({ length: 10 }, () => generateClientCode())
    );
    expect(codes.size).toBeGreaterThan(1); // Should not always be the same
  });
});
```

### Integration Test: Create Client

```typescript
// tests/integration/clients.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@/lib/sales/clients';
import { supabaseServiceRole } from '@/lib/supabase/server';

describe('createClient', () => {
  beforeEach(async () => {
    // Setup: Create test user and department
    // Setup: Login as test user
  });

  it('should create a client with unique code', async () => {
    const result = await createClient('user-123', {
      code: 'C123456',
      name: 'Test Client',
      email: 'test@example.com',
    });

    expect(result).toHaveProperty('id');
    expect(result.code).toBe('C123456');
    expect(result.name).toBe('Test Client');
  });

  it('should fail on duplicate code', async () => {
    await createClient('user-123', {
      code: 'C999999',
      name: 'Client A',
    });

    expect(async () => {
      await createClient('user-123', {
        code: 'C999999', // Duplicate
        name: 'Client B',
      });
    }).rejects.toThrow('Unique constraint violation');
  });
});
```

### E2E Test: Create Client Flow

```typescript
// tests/e2e/clients-create-search.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Create Client E2E', () => {
  test('should create a client on desktop', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'staff@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button:has-text("Sign In")');

    // Navigate to clients
    await page.goto('/protected/sales/clients');

    // Open create dialog
    await page.click('button:has-text("Create Client")');
    expect(page.locator('[role="dialog"]')).toBeVisible();

    // Generate code
    await page.click('button:has-text("Generate Code")');
    const codeInput = page.locator('input[name="code"]');
    const code = await codeInput.inputValue();
    expect(code).toMatch(/^C\d{6}$/);

    // Fill form and submit
    await page.fill('input[name="name"]', 'New Client Inc');
    await page.fill('input[name="email"]', 'contact@newclient.com');
    await page.click('button[type="submit"]');

    // Verify success toast
    expect(page.locator('text=Client created successfully')).toBeVisible();

    // Verify in table
    expect(page.locator('text=New Client Inc')).toBeVisible();
    expect(page.locator('code:has-text("' + code + '")')).toBeVisible();
  });

  test('should create and search on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    // ... rest of test with hamburger menu interactions
  });
});
```

---

## Key Files & Structure

### Directory Layout

```
app/protected/sales/
├── page.tsx                    # Dashboard index
├── layout.tsx                  # Shared layout (sidebar)
├── clients/
│   ├── page.tsx               # Clients table
│   ├── actions.ts             # Server actions (createClient, etc.)
│   └── error.tsx              # Error boundary
├── quotations/
│   ├── page.tsx               # Quotations table
│   ├── actions.ts             # Server actions (submitQuotation, approveQuotation)
│   └── error.tsx
└── purchase-orders/
    ├── page.tsx               # POs table
    ├── actions.ts             # Server actions (createPO, recordCollection)
    └── error.tsx

components/
├── layouts/
│   ├── sidebar.tsx            # Main sidebar + hamburger
│   └── dashboard-layout.tsx   # Page wrapper with sidebar
├── dialogs/
│   ├── create-client-dialog.tsx
│   ├── client-details-dialog.tsx
│   ├── quotation-details-dialog.tsx
│   ├── create-po-dialog.tsx
│   └── record-collection-dialog.tsx
├── tables/
│   ├── clients-table.tsx
│   ├── quotations-table.tsx
│   └── purchase-orders-table.tsx
└── ui/                        # Shadcn/ui components

lib/sales/
├── clients.ts                 # fetchClients, createClient, etc.
├── quotations.ts              # fetchQuotations, approveQuotation, etc.
├── purchase-orders.ts         # fetchPOs, recordCollection, etc.
└── approval-workflow.ts       # determineNextQuotationStatus, routing

lib/utils/
├── client-code-generator.ts   # generateClientCode, generateUniqueClientCode
└── useMediaQuery.ts           # Custom hook for responsive design
```

---

## Troubleshooting

### Issue: RLS permission errors on sales pages or server actions

**Symptoms**: Queries return empty data unexpectedly, or inserts fail with permission errors.

**Checks**:
- Confirm the authenticated user has a profile row with the expected `department` and `role`.
- Validate `schema.sql` RLS policies for `clients`, `quotations`, `quotation_approvals`, `purchase_orders`, and collection/payment tables.
- Verify you are signed in using the same account expected by the test or browser session.

### Issue: Client code generation conflicts (duplicate code)

**Symptoms**: Client creation fails with duplicate/unique errors even after generating a new code.

**Checks**:
- Use the Generate Code action again and resubmit.
- Confirm uniqueness check reads the latest state (`validateClientCodeUniqueness`).
- If running parallel tests, avoid reusing fixed client codes across specs.

### Issue: Collection validation rejects the entered amount

**Symptoms**: Collection form shows amount format errors or "exceeds available balance".

**Checks**:
- Enter a positive number with up to 15 digits and up to 2 decimal places.
- Ensure amount does not exceed current PO remaining balance.
- Confirm PO totals and recognized amount are current after a refresh.

### Issue: Sidebar doesn't collapse on mobile after navigation

**Cause**: The toggle state is not reset on route change.

**Solution**: Ensure nav click handlers close the sidebar in mobile state and verify behavior at 320px, 640px, and 768px breakpoints.

---

## Contributing

When adding new features to this dashboard:

1. **Update schema.sql first** if data model changes
2. **Create server actions** in `app/protected/sales/[feature]/actions.ts`
3. **Create dialogs/tables** in `components/` for UI
4. **Add service functions** in `lib/sales/` for business logic
5. **Write tests** at unit, integration, and E2E levels
6. **Update this quickstart** with new patterns

---

## Resources

- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Shadcn/ui Components](https://ui.shadcn.com/)
- [Playwright Testing](https://playwright.dev/)
- [Feature Spec](./spec.md)
- [Data Model](./data-model.md)
- [Research & Technical Decisions](./research.md)
