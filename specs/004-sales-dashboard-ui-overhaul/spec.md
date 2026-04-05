# Feature Specification: Sales Dashboard UI Overhaul

**Feature Branch**: `004-sales-dashboard-ui-overhaul`  
**Created**: April 5, 2026  
**Status**: Draft  
**Input**: User description: Multiple UX and functionality fixes for sales dashboard including layout, client management, quotation approvals, and purchase order tracking

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Responsive Dashboard Layout with Sidebar Navigation (Priority: P1)

Sales employees need a professional, responsive dashboard layout with a persistent sidebar on desktop and mobile-friendly hamburger navigation. The current layout is not intuitive and doesn't properly organize navigation and main content areas.

**Why this priority**: This is foundational infrastructure for the entire dashboard. UI/UX improvements and navigation clarity directly impact user productivity and reduce cognitive load. A proper sidebar pattern is a standard in modern web applications.

**Independent Test**: A user can access the dashboard on desktop and see a full sidebar with navigation, and can access the dashboard on mobile and open/close a hamburger menu that reveals the same navigation without page refresh.

**Acceptance Scenarios**:

1. **Given** a sales employee on desktop view, **When** they load the dashboard, **Then** they see a standalone sidebar on the left with all navigation options visible and the main content area properly sized to the right
2. **Given** a sales employee on mobile view, **When** they load the dashboard, **Then** navigation is hidden and a hamburger menu (≡) is visible at the top-left; **When** they tap the hamburger, **Then** the sidebar slides in/out with no page reload
3. **Given** a user with the sidebar expanded on mobile, **When** they click a navigation item, **Then** the sidebar automatically collapses after navigation
4. **Given** a user navigating between sections, **When** they switch tabs (Clients, Quotations, Purchase Orders), **Then** the sidebar remains persistent and responsive to viewport changes

---

### User Story 2 - Improved Client Management with Dialog and Table (Priority: P1)

Sales employees need a streamlined way to create and manage clients. The current card-based create interface should be replaced with a dialog, clients should be displayed in a filterable table, and client codes should be auto-generated during creation.

**Why this priority**: Client management is a core task. A dialog-based creation flow and table view with filtering significantly improve usability and make it easier to manage large numbers of clients. Auto-generated codes eliminate data entry errors.

**Independent Test**: A user can open a create client dialog, enter client information, auto-generate a client code, and see the new client appear in a filterable table. They can search/filter the table and click a client row to view full details in a dialog.

**Acceptance Scenarios**:

1. **Given** a sales employee on the Clients tab, **When** they click the "Create Client" button, **Then** a dialog opens with all required client fields and a button to auto-generate the client code
2. **Given** a user in the create client dialog with auto-generated code, **When** they submit, **Then** the dialog closes and the new client appears at the top of the clients table
3. **Given** a sales employee viewing the clients table, **When** they use the filter/search functionality, **Then** the table updates in real-time to show only matching clients (filterable by name, code, contact, etc.)
4. **Given** a user viewing the clients table, **When** they click on a client row, **Then** a read-only dialog opens showing all client information (code, name, contact details, address, etc.)
5. **Given** the create client dialog, **When** a user hovers over or clicks the "Generate Code" button, **Then** a unique client code with format C[6 random numbers] is generated and displayed (e.g., C734829); if the code already exists, the system generates a new one until a unique code is found
6. **Given** a user trying to create a client with the same code, **When** they attempt to submit, **Then** the system prevents duplicate codes and shows an error message

---

### User Story 3 - Quotation Management with Table and Approval Workflow (Priority: P2)

Sales managers need to view quotations in a table format, access detailed information via a dialog, and have the ability to submit quotations for approval and approve/reject quotations. The approval process follows an amount-based hierarchy: quotations under 3,000,000 require only sales manager approval, while quotations of 3,000,000 or more require approval from sales manager, owner, and executive roles.

**Why this priority**: Approval workflows are critical for sales operations but are currently broken for sales manager roles. The table format is more efficient for scanning multiple quotations. Amount-based multi-level approval ensures proper oversight of high-value deals.

**Independent Test**: A sales staff member can create quotations, a sales manager can approve/reject quotations under 3,000,000, and high-value quotations (≥ 3,000,000) route to multiple approvers (sales manager, owner, executive).

**Acceptance Scenarios**:

1. **Given** a sales employee on the Quotations tab, **When** they view quotations, **Then** they are displayed in a table with columns for quotation ID, client name, amount, status, and date
2. **Given** a user viewing the quotations table, **When** they click on a quotation row, **Then** a dialog opens showing complete quotation details (quotation amount, client info, creation date, status, approval chain, etc.)
3. **Given** a sales staff member who created a quotation with status "Draft", **When** they open the quotation dialog, **Then** they see a "Submit for Approval" button
4. **Given** a quotation submitted with amount < 3,000,000 and status "Pending Approval", **When** a sales manager opens the dialog, **Then** they see "Approve" and "Reject" buttons
5. **Given** a sales manager clicking "Approve" on a quotation < 3,000,000, **When** they confirm, **Then** the quotation status changes to "Approved" and the dialog closes
6. **Given** a sales manager clicking "Reject" on a quotation, **When** they confirm, **Then** the quotation status changes to "Rejected" and they are prompted for a rejection reason
7. **Given** a quotation submitted with amount >= 3,000,000 and status "Pending Sales Manager Approval", **When** a sales manager opens the dialog, **Then** they see "Approve" and "Reject" buttons leading to next approval stage
8. **Given** a sales manager approving a high-value quotation (>= 3,000,000), **When** confirmed, **Then** status changes to "Pending Owner/Executive Approval" and routed to owner and executive roles
9. **Given** a quotation in "Pending Owner/Executive Approval", **When** an owner or executive from the executive department opens the dialog, **Then** they see their own "Approve" and "Reject" buttons
10. **Given** all required approvers (sales manager, owner, executive) approve a high-value quotation, **When** the last approval is confirmed, **Then** status becomes "Approved" and all approvers are notified

---

### User Story 4 - Purchase Order Management with Dialog and Collection Tracking (Priority: P2)

Sales employees need to manage purchase orders in a table format with dialog-based details view, similar to clients and quotations. Additionally, recording collections must correctly update the collected value on the purchase order.

**Why this priority**: Purchase order tracking is important for sales operations. The table format provides consistency with other tabs, and fixing the collection recording bug is critical for accurate financial tracking.

**Independent Test**: A user can create purchase orders viewed in a table, click to see details in a dialog, and recording a collection correctly updates the collected amount on the purchase order.

**Acceptance Scenarios**:

1. **Given** a sales employee on the Purchase Orders tab, **When** they view purchase orders, **Then** they are displayed in a table with columns for PO number, client name, total amount, collected amount, status, and date
2. **Given** a user viewing the purchase orders table, **When** they click on a PO row, **Then** a dialog opens showing complete order details (PO number, total amount, client info, collection history, and previously recorded collections, etc.)
3. **Given** a user on the Purchase Orders tab, **When** they click the "Create Purchase Order" button, **Then** a dialog opens allowing them to enter PO details
4. **Given** a user in the purchase order dialog, **When** they submit the form, **Then** the dialog closes and the new PO appears in the table
5. **Given** a user viewing a purchase order dialog with collection tracking, **When** they click "Record Collection" and enter a collection amount, **Then** the collection is saved and the PO's "collected amount" field updates immediately
6. **Given** a purchase order with initial collected amount of $500, **When** a user records a $200 collection, **Then** the collected amount updates to $700 (not replaced, but accumulated)
7. **Given** a purchase order with a collection history, **When** a user opens the PO dialog, **Then** they see a breakdown of all collections made over time

---

### Edge Cases

- What happens when a user creates a client/quotation/PO and the auto-generated code conflicts with an existing code?
- How does the system handle filtering when no results match the search criteria? (Show empty state message)
- What happens when a sales manager tries to approve a quotation they did not create—is this permitted?
- What happens when a user tries to record a collection amount greater than the remaining balance on a purchase order?
- How does the sidebar navigation respond when the user resizes the browser viewport between mobile and desktop breakpoints?
- What happens if a collection is recorded offline? (Sync handling)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a persistent sidebar navigation on desktop (viewport width ≥ 768px) containing all main navigation links (Clients, Quotations, Purchase Orders)
- **FR-002**: System MUST collapse the sidebar into a hamburger menu on mobile (viewport width < 768px) with the menu triggerable via a toggle button
- **FR-003**: System MUST generate client codes client-side using format C[6 random numbers] (e.g., C123456) and validate uniqueness against existing codes before allowing submission
- **FR-004**: Sales employees MUST be able to create clients via a dialog form with fields for name, contact info, address, and other relevant details
- **FR-005**: System MUST display clients in a table with sortable/filterable columns (name, code, contact, email, phone). Filter behavior: substring search (case-insensitive), searches apply across all visible columns using OR logic (e.g., searching "john" finds clients with name="John Smith", contact_person="John Doe", or email="john@example.com").
- **FR-006**: Clicking a client in the table MUST open a dialog showing all client details in read-only format
- **FR-007**: System MUST prevent duplicate client codes from being created; creation must fail with a clear error message if a code already exists
- **FR-008**: System MUST display quotations in a table format with columns for ID, client, amount, status, and date
- **FR-009**: Clicking a quotation MUST open a dialog showing complete quotation details including items, amounts, and approval chain
- **FR-010**: Sales staff MUST be able to submit quotations they created for approval via a "Submit for Approval" button
- **FR-011**: System MUST route quotation approvals based on amount: quotations < 3,000,000 require sales_manager approval only; quotations >= 3,000,000 require sequential approval from sales_manager, then owner, then executive (executive department)
- **FR-012**: Sales manager MUST be able to approve quotations < 3,000,000 and be first approver for high-value quotations >= 3,000,000
- **FR-013**: Owner and executive roles (executive department) MUST be able to approve/reject high-value quotations >= 3,000,000 after sales manager approval
- **FR-014**: All approvers MUST be able to reject quotations at any stage with an optional rejection reason; rejection must terminate the approval chain
- **FR-015**: System MUST display the approval status and chain (e.g., "Pending Sales Manager", "Pending Owner/Executive") in the quotation dialog
- **FR-016**: System MUST display purchase orders in a table with columns for PO number, client, total amount, collected amount, and status
- **FR-017**: Clicking a purchase order MUST open a dialog showing complete order details and collection history
- **FR-018**: Sales employees MUST be able to create new purchase orders via a dialog form
- **FR-019**: System MUST allow recording collections on purchase orders, and collected amounts MUST accumulate (not replace previous values)
- **FR-020**: When a collection is recorded, the purchase order's collected amount field MUST update to reflect the new total; system must reject collections that would exceed available balance
- **FR-021**: System MUST provide visual feedback when filters result in no matches (empty state message)
- **FR-022**: System MUST display in-app toast notifications for all approval actions (submit for approval, approve, reject) with clear success/error messages. Success toasts auto-dismiss after 3 seconds; error toasts auto-dismiss after 5 seconds.
- **FR-023**: Tables (clients, quotations, purchase orders) MUST refresh when users perform form submissions (create, record collection, approve, reject) to reflect immediate changes

### Constitution-Driven Constraints *(mandatory)*

- **C-001 (Stack)**: Features MUST use Next.js (React), TypeScript, Tailwind CSS, and Shadcn/ui components consistent with the project
- **C-002 (Auth/RLS)**: All data access MUST use Supabase Auth and enforce Row-Level Security; sales manager approval functionality MUST verify permissions at the database level
- **C-003 (Schema)**: Any new fields (auto-generated codes, collection tracking, status fields) MUST be reflected in `schema.sql`
- **C-004 (Design)**: UI components MUST follow the project's theme tokens and use Shadcn/ui dialog and table components
- **C-005 (Testing)**: Each user story MUST include E2E tests using Playwright to validate UI interactions, data mutations, and responsive behavior

### Key Entities

- **Client**: Represents a business client with auto-generated code, name, contact information, and address
- **Quotation**: Represents a sales quotation with associated client, items, total amount, and approval status (Draft → Pending Approval → Approved/Rejected)
- **Purchase Order**: Represents a PO with associated client, items, total amount, collected amount (accumulative), and status
- **Collection**: Represents a payment collected against a PO with amount and date; multiple collections can be recorded per PO and must sum to the collected amount

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sales employees can create a client in under 1 minute using the new dialog flow
- **SC-002**: Sales employees can find a specific client using table filters in under 30 seconds
- **SC-003**: Sales managers can approve/reject a quotation in under 2 minutes including reviewing details
- **SC-004**: The dashboard is fully responsive and functional on mobile devices (tested on viewports from 320px to 768px)
- **SC-005**: 100% of quotation approval actions by sales managers complete successfully (no permission errors)
- **SC-006**: Recording a collection on a PO correctly updates the collected amount field within 2 seconds (no stale data)
- **SC-007**: All form submissions (create client, record collection, etc.) include validation with user-friendly error messages
- **SC-008**: Zero data loss or duplication in auto-generated codes across all client creation sessions

## Clarifications

### Session April 5, 2026

- Q: When multiple users simultaneously record collections on the same PO, how should the system handle cases where the total would exceed the available balance? → A: Reject the transaction if total exceeds balance; collections are validated using database transactions to ensure data integrity.

- Q: What are the sales manager approval permissions and workflow boundaries? → A: Multi-level approval based on quotation amount: (< 3,000,000) only sales_manager role (sales department) approves; (>= 3,000,000) sales_manager + owner + executive role (executive department) all must approve sequentially.

- Q: What format and generation method should client codes use? → A: Client-side generated code with format C[6 random numbers] (e.g., C123456); system must validate uniqueness against existing codes before submission.

- Q: How should users be notified of approval actions (submit, approve, reject)? → A: In-app toast notifications only for all approval actions; no email notifications. Table refreshes on user manual refresh or after form submission actions.

- Q: Which sidebar navigation tabs should be visible to different user roles? → A: All tabs (Clients, Quotations, Purchase Orders) visible to all roles; permissions enforced at data/action level via RLS and role checks rather than UI-level hiding.

**Integrated into**: FR-001-023, All User Stories, Acceptance Scenarios

## Assumptions

- **Target Users**: Sales employees, sales managers, owners, and executives using modern browsers (Chrome, Firefox, Safari, Edge) on desktop and mobile devices
- **Data Volume**: The feature assumes reasonable data volumes (up to 1000 clients, quotations, and POs per sales department) for initial release; pagination will be added if needed
- **Mobile Support**: Mobile responsiveness is in scope for this feature; tested on common viewport sizes (320px, 768px, 1024px+)
- **Existing Auth**: The project's existing Supabase Auth and department-based access control will be reused; the sales manager role already exists in the system
- **Auto-Generated Code Format**: Client codes are generated client-side using format C[6 random numbers] (e.g., C123456); the system validates uniqueness by checking against existing codes before allowing submission
- **Collection Accuracy**: Collections are recorded individually and accumulate; there are no batch collection imports initially
- **Collection Validation**: Collection transactions are validated against the current PO balance; if a collection would exceed available balance, the transaction is rejected with an error message
- **Approval Workflow**: Quotation approval workflow is amount-based: quotations < 3,000,000 require single sales_manager approval; quotations >= 3,000,000 require sequential approval from sales_manager → owner → executive
- **Navigation Visibility**: All sidebar navigation tabs (Clients, Quotations, Purchase Orders) are visible to all roles in the sales department; permissions are enforced at the data level via RLS policies and action-level checks, not via UI hiding
- **Notifications**: Approval actions display in-app toast notifications only; no email notifications are sent in this release
- **Toast Notification Duration**: All in-app toast notifications auto-dismiss after 3-5 seconds. Success toasts dismiss at 3s; error/warning toasts dismiss at 5s to allow user reading time.
- **Scope Boundary**: Edit/delete operations for existing clients, quotations, and POs are out of scope for this release (can be addressed in future feature)
