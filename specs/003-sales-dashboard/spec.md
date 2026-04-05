# Feature Specification: Sales Module Dashboard

**Feature Branch**: `003-sales-dashboard`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: Add a Sales module with its own dashboard, including: (1) Client Details CRUD with client classification and payment terms, (2) Quotation approval routing based on amount thresholds, (3) Purchase Orders logging with margin, sector tagging, and sales recognition tracking.

## Clarifications

### Session 2026-04-05

- Q: How should payment terms be represented? → A: Structured: `termLabel` + `netDays` + optional `downpaymentPercent` + optional `notes`.
- Q: How should sector tagging work on POs? → A: Canonical sector uses Commercial/Industrial/Solar (schema sector_enum). Additionally capture an optional free-form “sectorTag” (single text field) stored in PO notes for extra labeling.
- Q: Should a PO require a linked client? → A: Yes — PO must be linked to a Client.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate the Sales dashboard and see summaries (Priority: P1)

As a Sales team user, I can open the Sales dashboard, use the sidebar to navigate between Sales tabs, and see summary information for Clients, Quotations, and Purchase Orders in one place.

**Why this priority**: This is the entry point to the Sales module and provides immediate visibility into sales activity.

**Independent Test**: Can be fully tested by visiting the Sales dashboard, verifying the sidebar tabs exist, and confirming the dashboard shows summaries without requiring any approvals flow.

**Acceptance Scenarios**:

1. **Given** I am signed in and belong to the Sales department, **When** I open the Sales dashboard, **Then** I see a Sales sidebar with tabs for Client Details, Quotation Approval, and Purchase Orders.
2. **Given** there are existing Clients, Quotations, and Purchase Orders, **When** I view the Sales dashboard, **Then** I see summary totals for each area (counts and monetary totals where applicable).
3. Given I do not belong to the Sales department, When I attempt to open the Sales dashboard, Then I am redirected to my department dashboard.
4. **Given** I am an Owner or Executive approver, **When** I open the Quotation Approval tab for approvals assigned to me, **Then** I can review and approve/reject without needing full Sales dashboard access.

---

### User Story 2 - Manage client records (Priority: P2)

As a Sales team user, I can add, edit, update, and remove clients, including their details, contact information, classification, and payment terms.

**Why this priority**: Client records are foundational for quotations and purchase orders and reduce manual tracking.

**Independent Test**: Can be fully tested by creating a client, editing fields, and removing the client, without requiring quotations or POs.

**Acceptance Scenarios**:

1. **Given** I am on the Client Details tab, **When** I add a new client with required fields, **Then** the client appears in the client list and can be opened to view full details.
2. **Given** an existing client, **When** I update its contact information or payment terms, **Then** the updated information is shown consistently everywhere the client is referenced.
3. **Given** an existing client with no linked quotations or purchase orders, **When** I remove the client, **Then** the client is no longer available for new activity.
4. **Given** an existing client with linked quotations or purchase orders, **When** I remove the client, **Then** historical records remain readable and the client is treated as inactive (not selectable for new activity).

---

### User Story 3 - Submit quotations for approval with role-based routing (Priority: P3)

As a Sales team user (any Sales role), I can create a quotation request and submit it for approval. Approvers can approve or reject according to the quotation amount threshold rules.

**Why this priority**: Approval routing is a core Sales workflow control and ensures governance based on deal size.

**Independent Test**: Can be tested with one quotation under the threshold and one at/above the threshold, validating the required approvers and resulting status.

**Acceptance Scenarios**:

1. **Given** I am a Sales team user, **When** I submit a quotation for ₱2,999,999.99, **Then** it requires approval from a Sales Manager (Sales department) and no other roles.
2. **Given** I am a Sales team user, **When** I submit a quotation for ₱3,000,000.00, **Then** it requires approval from a Sales Manager (Sales department) AND an Owner role AND an Executive role (Executive department).
3. **Given** a quotation awaiting my approval, **When** I approve it, **Then** the quotation approval status updates and records who approved it and when.
4. **Given** a quotation requiring multiple approvals, **When** only some required approvals are completed, **Then** the overall quotation remains not fully approved.
5. **Given** a quotation is rejected by any required approver, **When** the rejection is recorded, **Then** the quotation is marked rejected and no further approvals are required.

---

### User Story 4 - Log purchase orders and track recognized vs closed sales (Priority: P4)

As a Sales team user, I can log Purchase Orders (POs) with their amount, payment terms, sector tag, and margin information, and track collected amounts to compute recognized sales.

**Why this priority**: POs and collections underpin sales reporting and allow the dashboard to summarize revenue and collections.

**Independent Test**: Can be tested by creating a PO, recording collections against it, and verifying the Closed Sale total vs Recognized Sale total calculations.

**Acceptance Scenarios**:

1. **Given** I am on the Purchase Orders tab, **When** I log a new PO for a selected client with PO amount and payment terms, **Then** the PO is listed with its total amount and current collected amount.
2. **Given** an existing PO, **When** I record a collection amount, **Then** the PO’s total collected amount increases and recognized sale totals reflect the new collected amount.
3. **Given** a PO exists, **When** I view sales summaries, **Then** the Closed Sale total includes the PO’s total amount.
4. **Given** a PO has partial collections, **When** I view sales summaries, **Then** the Recognized Sale total includes only the collected portion (not exceeding the PO amount).

### Edge Cases

- Client classification must be one of: Commercial, Industrial, Solar.
- Prevent saving a client missing required identifiers (e.g., name) or missing required payment terms fields.
- Validate payment terms structure:
  - `termLabel` is required
  - `netDays` is required and must be a non-negative integer
  - `downpaymentPercent`, when present, must be within 0–100
- Handle duplicate client names by allowing them but requiring a stable identifier for selection.
- Quotation approval threshold boundary: exactly ₱3,000,000.00 follows the ≥ ₱3,000,000 rule.
- Quotation amount cannot be negative; handle zero as invalid unless explicitly permitted.
- Prevent recognized sale (total collected) from exceeding the PO total amount.
- Canonical sector is required (Commercial/Industrial/Solar). The optional free-form “sectorTag” is stored in PO notes; prevent saving an empty sectorTag if the UI field is shown and marked required.
- Prevent saving a PO without selecting a client.
- If a client is removed/inactivated, existing quotations/POs still display the client name as of creation time.

## Requirements *(mandatory)*

### Functional Requirements

#### Sales dashboard and navigation

- **FR-001**: System MUST provide a Sales module with its own dashboard view, accessible only to users authorized for Sales.
- **FR-002**: The Sales dashboard MUST include a sidebar with tabs: Client Details, Quotation Approval, Purchase Orders.
- **FR-003**: The Sales dashboard MUST show a summary of all Sales tabs, including at minimum:
  - Total clients
  - Quotations by status (Draft, Pending Approval, Approved, Rejected)
  - Closed Sale total (sum across all logged POs)
  - Recognized Sale total (sum of collected amounts across POs)

#### Client Details (CRUD)

- **FR-004**: Users MUST be able to add, edit, update, and remove clients.
- **FR-005**: A client record MUST include client details, contact information, and payment terms.
- **FR-005a**: Client payment terms MUST be stored in structured form: `termLabel` (required), `netDays` (required), `downpaymentPercent` (optional), `notes` (optional).
**Implementation Note (schema-first)**: In v1, netDaysis stored inclients.payment_terms_days. Optional downpaymentPercentand optional payment-termnotesare serialized intoclients.notes as JSON text when provided.
- **FR-006**: A client MUST have a classification, with allowed values: Commercial, Industrial, Solar.
- **FR-007**: Removing a client MUST preserve historical readability for linked quotations and POs (client becomes inactive and is not selectable for new activity).

#### Quotation approval

- **FR-008**: Any user in the Sales department (regardless of Sales role) MUST be able to create a quotation and submit it for approval.
- **FR-009**: A quotation MUST include at minimum: a positive amount in Philippine Pesos and an associated client (existing or newly created before submission).
- **FR-010**: System MUST route quotation approvals based on amount:
  - If amount < ₱3,000,000: approval required from Sales Manager role (Sales department).
  - If amount ≥ ₱3,000,000: approvals required from Sales Manager role (Sales department) AND Owner role AND Executive role (Executive department).
- **FR-011**: System MUST track quotation status at minimum: Draft, Pending Approval, Approved, Rejected.
**Implementation Note**: “Draft” means quotations.status = 'draft'until the user submits the quotation for approval, at which point the system MUST setquotations.status = 'pending'.
- **FR-012**: Authorized approvers MUST be able to approve or reject a pending quotation.
- **FR-012a**: Owner and Executive approvers MUST be able to access the quotation approval view for quotations assigned to them, even if they are not in the Sales department.
- **FR-013**: System MUST record each approval decision with approver identity and timestamp (and optional note).
- **FR-014**: A quotation MUST be marked Approved only when all required approvals are completed; if any required approver rejects, the quotation MUST be marked Rejected.

#### Purchase Orders (PO)

- **FR-015**: Users MUST be able to log purchase orders with: PO amount, payment terms, sector tagging, and margin information.
- **FR-015b**: The system MUST capture an optional free-form “sectorTag” as a single text value for a PO; this MUST be stored in purchase_orders.notesand MUST NOT replace the canonicalsector enum used for reporting.
- **FR-015a**: PO payment terms MUST use the same structured form as client payment terms: `termLabel` (required), `netDays` (required), `downpaymentPercent` (optional), `notes` (optional).
**Implementation Note (schema-first)**: In v1, netDaysis stored inpurchase_orders.payment_terms_days. Optional downpaymentPercentand optional payment-termnotesare serialized intopurchase_orders.notes as JSON text when provided.
- **FR-015c**: A PO MUST be linked to a Client.
- **FR-016**: For margin, the system MUST support capturing an estimated cost and MUST calculate:
  - Margin Amount = PO Amount − Estimated Cost
  - Margin % = Margin Amount ÷ PO Amount
- **FR-017**: Users MUST be able to record collections against a PO; the system MUST maintain the total collected amount as the sum of recorded collections.
- **FR-018**: The system MUST prevent total collected amount from exceeding the PO amount.
- **FR-020**: Sales summaries MUST use these definitions:
  - Closed Sale total = sum across all logged POs
  - Recognized Sale total = sum of total collected amounts across POs
- **FR-021**: Users MUST be able to view a PO list that shows (per PO) the total amount, total collected amount, payment terms, sector tag, and margin.

### Constitution-Driven Constraints *(mandatory)*

- **C-001 (Stack)**: Features MUST use the project's approved technology stack and UI primitives (per the project constitution).
- **C-002 (Auth/RLS)**: Features involving data access MUST use Supabase Auth and enforce authorization via RLS.
- **C-003 (Schema)**: Any data-model change MUST be reflected in `schema.sql`.
- **C-004 (Design)**: UI MUST follow the project's brand tokens and consistent styling.
- **C-005 (Testing)**: Every story MUST define unit + integration + E2E coverage appropriate to its scope.

### Key Entities *(include if feature involves data)*

- **Client**: A customer organization receiving quotations and/or issuing purchase orders; includes classification and payment terms.
- **Client Contact**: A contact person or channel for a client (e.g., name, phone/email), including a primary contact.
- **Payment Terms**: A structured description of how and when payments are expected, with fields: `termLabel`, `netDays`, optional `downpaymentPercent`, optional `notes` (captured at client level and optionally overridden at PO level).
- **Quotation**: A sales quotation submitted for internal approval; includes amount, status, and optional linked client.
- **Quotation Approval**: An approval requirement and recorded decision by a specific required role/user for a quotation.
- **Purchase Order (PO)**: A logged purchase order linked to a client, with total amount, collected-to-date amount, payment terms, canonical sector (Commercial/Industrial/Solar), optional free-form sectorTag (stored in PO notes), and margin values.
- **PO Collection**: A recorded collection event against a PO contributing to recognized sales.
- **Sector Tag**: An optional free-form label stored in purchase_orders.notesfor extra categorization; canonical reporting usessector_enum (Commercial/Industrial/Solar).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Sales user can navigate from the Sales dashboard to any Sales tab in ≤ 2 clicks.
- **SC-002**: A Sales user can create a client record (including classification + payment terms) in under 2 minutes.
- **SC-003**: 100% of quotations route to the correct required approvers based on the ₱3,000,000 threshold.
- **SC-004**: Approvers can approve/reject a pending quotation in under 1 minute.
- **SC-005**: Recognized Sale totals exactly match the sum of recorded collections (capped per PO at the PO total amount).
- **SC-006**: Closed Sale totals exactly match the sum across all logged POs.

## Assumptions

- The organization already has defined departments and roles for: Sales user, Sales Manager (Sales department), Owner role, and Executive role (Executive department).
- Currency for quotation thresholds and PO amounts is Philippine Pesos (₱) and comparisons use the numeric amount.
- “Remove client” is implemented as deactivation/inactivation when the client has linked historical records, to preserve reporting integrity.
- Notifications (email/SMS) for approvals are out of scope unless later required; users will check the Quotation Approval tab.
- Quotation document generation (e.g., PDFs), external accounting integration, and advanced CRM features are out of scope for v1.
- Margin is calculated from PO Amount and an Estimated Cost captured on the PO, and is shown as both Margin Amount and Margin %.
