# Feature Specification: Authentication + Department Dashboard Redirect

**Feature Branch**: `001-auth-dept-redirect`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "We will start the project with the log in and sign up feature, the log-in must ask for email and password and the password has an option to be hidden or not, the sign up must also do the same. The sign up card must include these criteria: email, password, department (deparments are seen on schema.sql). Google authentication must also be implemented. After successfully logging in and signing up, the user will be redirected to their respective dashboards, based on their department (deparments are seen on schema.sql)."

## Clarifications

### Session 2026-04-03

- Q: Where should department dashboards live? → A: `/protected/[department]` (e.g., `/protected/hr`)
- Q: Should sign-up require email confirmation before dashboard access? → A: Yes — require email confirmation before accessing dashboards.
- Q: For Google auth, how is department selected when missing? → A: After Google auth completes, show an in-app “Choose department” step, then redirect to `/protected/[department]`.
- Q: How should unconfirmed-email users behave on login? → A: Block login until email is confirmed (show “check your email / confirm” message).

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Log in with Email + Password (Priority: P1)

As a user who already has an account, I can log in using my email and password. I can toggle whether the password is shown or hidden, and after a successful login I am taken directly to the dashboard for my department.

**Why this priority**: Users must be able to access the app to do any work.

**Independent Test**: A user with a known department can log in and lands on the correct department dashboard without touching the sign-up flow.

**Acceptance Scenarios**:

1. **Given** an existing account with a known department, **When** I submit a valid email and password, **Then** I am authenticated and redirected to the dashboard for that department.
2. **Given** the login form, **When** I toggle the password visibility control, **Then** the password input switches between hidden and visible without altering the entered value.
3. **Given** an invalid email/password combination, **When** I attempt to log in, **Then** I remain on the login screen and see a clear error message.
4. **Given** missing required fields, **When** I attempt to log in, **Then** I see validation feedback and authentication is not attempted.
5. **Given** I signed up but have not confirmed my email yet, **When** I attempt to log in, **Then** login is blocked and I see instructions to confirm my email.
6. **Given** I am authenticated and belong to department A, **When** I try to access `/protected/[departmentB]`, **Then** access is denied and I am redirected to `/protected/[departmentA]`.
7. **Given** I am not authenticated, **When** I try to access `/protected/[anyDepartment]`, **Then** I am redirected to the login screen.

---

### User Story 2 - Sign up with Email + Password + Department (Priority: P2)

As a new user, I can create an account with an email and password, choose my department during sign up, and toggle password visibility while entering it. After a successful sign up, I am guided to confirm my email address before I can access my department dashboard.

**Why this priority**: New users need a clear onboarding path to start using the system.

**Independent Test**: A brand-new user can create an account, choose a department, and the system stores that department for correct routing after authentication.

**Acceptance Scenarios**:

1. **Given** I do not have an account, **When** I sign up with a valid email, password, and department selection, **Then** my account is created and my department is stored with my profile.
2. **Given** a successful sign up, **When** sign up completes, **Then** I see clear instructions that I must confirm my email before accessing dashboards.
3. **Given** I have not confirmed my email yet, **When** I attempt to log in, **Then** login is blocked and I am instructed to confirm my email.
4. **Given** the sign-up form, **When** I toggle the password visibility control, **Then** the password input switches between hidden and visible without altering the entered value.
5. **Given** I enter an email that is already in use, **When** I attempt to sign up, **Then** I receive a clear error message and remain on the sign-up screen.
6. **Given** the sign-up form, **When** I open department selection, **Then** I can choose only from the allowed departments: `hr`, `sales`, `accounting`, `engineering`, `purchasing`, `executive`.

---

### User Story 3 - Authenticate with Google (Priority: P3)

As a user, I can sign in using Google authentication. If it's my first time using Google authentication in this app and my department is not yet known, I am prompted to select a department before being taken to a dashboard. If my department is already known, I am routed directly to the correct dashboard after authentication.

**Why this priority**: Google authentication provides a faster sign-in/sign-up path and reduces password friction.

**Independent Test**: A user can authenticate via Google and the system reliably determines (or collects) their department, then routes them to the correct dashboard.

**Acceptance Scenarios**:

1. **Given** I choose Google sign-in and my account already has a stored department, **When** authentication succeeds, **Then** I am redirected to the dashboard for that department.
2. **Given** I choose Google sign-in for the first time and my department is not stored yet, **When** authentication succeeds, **Then** I see an in-app “Choose department” step and cannot access `/protected/*` until I complete it.
3. **Given** I cancel or fail Google authentication, **When** I return to the app, **Then** I remain unauthenticated and see a clear message indicating sign-in did not complete.
4. **Given** I am in the “Choose department” step, **When** I select an allowed department and submit, **Then** my department is stored and I am redirected to `/protected/[department]`.

---

### Edge Cases

- Department missing/unknown: user cannot be routed; system prompts for department selection.
- Department value not in the allowed list: system treats it as invalid and prompts for re-selection.
- User is marked inactive (if applicable): user cannot access dashboards and sees an access/activation message.
- Authentication succeeds but profile data is not available yet: system shows a safe fallback state and retries / asks user to complete profile.
- User attempts to access a dashboard not matching their department: access is denied and user is redirected to their own dashboard.
- User has signed up but not confirmed email: user cannot access dashboards until confirmation is completed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an email + password login form.
- **FR-002**: Login and sign-up forms MUST include a password visibility toggle (show/hide) that does not change the entered value.
- **FR-003**: System MUST provide an email + password sign-up form.
- **FR-004**: Sign-up MUST require a department selection.
- **FR-005**: Department selection MUST be restricted to the departments defined in `schema.sql` (`department_enum`): `hr`, `sales`, `accounting`, `engineering`, `purchasing`, `executive`.
- **FR-006**: System MUST support Google authentication as an alternative sign-in/sign-up method.
- **FR-007**: After successful authentication, system MUST redirect the user to the correct dashboard route `/protected/[department]` based on their stored department.
- **FR-008**: If a user authenticates successfully but has no stored department, system MUST prompt the user to select a department before granting dashboard access.
- **FR-009**: System MUST prevent unauthenticated users from accessing any dashboard.
- **FR-010**: System MUST prevent users from accessing dashboards that do not match their department.
- **FR-011**: System MUST display clear, user-friendly error messages for authentication failures and validation errors.
- **FR-012**: System MUST store and retrieve the user's department in a persistent user profile so routing remains consistent across sessions.
- **FR-013**: After email/password sign-up, the user MUST confirm their email address before accessing any dashboard routes.
- **FR-014**: If a user is not email-confirmed, the system MUST block email/password login and display instructions to confirm their email.
- **FR-015**: After Google authentication, if the user has no stored department, the system MUST present an in-app “Choose department” step and block access to `/protected/*` until it is completed.
- **FR-016**: Once a user’s department is set, the system MUST prevent changing it (department is set-once for this MVP).

### Constitution-Driven Constraints *(mandatory)*

- **C-001 (Stack)**: Features MUST use the project's approved technology stack and UI primitives (per the project constitution).
- **C-002 (Auth/RLS)**: Authentication MUST use Supabase Auth. Authorization MUST follow Supabase rules, including Row Level Security (RLS) for sensitive data.
- **C-003 (Schema)**: Any data-model change MUST be reflected in `schema.sql`.
- **C-004 (Design)**: UI MUST follow the project's brand tokens and consistent styling.
- **C-005 (Testing)**: Every story MUST define unit + integration + E2E coverage appropriate to its scope.

### Key Entities *(include if feature involves data)*

- **User Account**: An authenticated identity (email/password or Google authentication).
- **Profile**: A persistent record associated with the user that includes at minimum: email and department (as defined by `department_enum`).
- **Department**: One of: `hr`, `sales`, `accounting`, `engineering`, `purchasing`, `executive`. Used to determine dashboard routing and access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of new users can complete sign up (including department selection) in under 2 minutes.
- **SC-002**: At least 95% of existing users can complete login in under 30 seconds.
- **SC-003**: In acceptance testing, 100% of authenticated users are routed to the dashboard matching their stored department.
- **SC-004**: In acceptance testing, 0% of unauthenticated users can access any dashboard.

## Assumptions

- Users have access to email (for email/password sign up) and to a Google account (for Google authentication).
- Each user belongs to exactly one department for routing purposes.
- A department-specific dashboard exists (or will exist) for each allowed department.
- Changing a user's department after sign up is out of scope for this initial feature.
