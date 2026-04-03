# Feature Specification: Auth Fixes

**Feature Branch**: `002-auth-fixes`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: Fix login redirect loop, ensure sign-up creates a profile record, apply Schwer brand colors (primary/secondary) and app name, and default logged-out users to the login page.

## Clarifications

### Session 2026-04-03

- Q: When should a `profiles` record be created? → A: Create/ensure a profile row for any new user (email/password and OAuth). If a user logs in and no profile exists, create it then (idempotent).
- Q: What should `/` do for logged-out users? → A: `/` remains a public landing page that presents Login and Sign up buttons; only protected routes redirect to the login page.
- Q: What should happen after login if a user has no department selected? → A: Always route the user to `/auth/choose-department` and block dashboard access until a department is chosen.

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

### User Story 1 - Stable Login & Default-to-Login (Priority: P1)

As a user, when I’m not logged in I should see a public landing page with clear Login/Sign up actions, and when I successfully log in I should land on the correct authenticated destination (dashboard or the next required onboarding step) without being bounced back to the login page.

**Why this priority**: Without this, users cannot access the app at all.

**Independent Test**: Can be fully tested by navigating to `/` while logged out (seeing landing + CTAs), then logging in once, and confirming the user remains on the authenticated area without repeated redirects.

**Acceptance Scenarios**:

1. **Given** I am not logged in, **When** I open `/`, **Then** I see a public landing page with Login and Sign up buttons.
2. **Given** I am not logged in, **When** I try to open any protected page, **Then** I am redirected to the login page.
3. **Given** I successfully log in and I do not have a department selected yet, **When** the login completes, **Then** I am redirected to the department chooser (`/auth/choose-department`) once and stay authenticated (no redirect loop).
4. **Given** I successfully log in and I already have a department selected, **When** the login completes, **Then** I am redirected to my department dashboard once and stay authenticated (no redirect loop between login and dashboard).
5. **Given** I am already logged in, **When** I navigate to the login page, **Then** I am redirected to the authenticated landing page.

---

### User Story 2 - Create Profile on Sign-Up (Priority: P2)

As a new user, after I create an account, the system should also create my profile record so that my account is fully recognized by the application.

**Why this priority**: Missing profile data breaks downstream flows that depend on user profile presence.

**Independent Test**: Can be tested by signing up a new user and verifying a profile record exists and is linked to that user.

**Acceptance Scenarios**:

1. **Given** I am logged out, **When** I sign up successfully, **Then** a profile record is created for my new account.
2. **Given** my profile record already exists, **When** I sign up or complete account creation via an alternate entry path, **Then** the system does not create duplicate profiles.
3. **Given** profile creation cannot be completed, **When** sign-up finishes, **Then** I receive a clear message and a supported recovery path (retry or support) instead of being silently logged in with a broken account.
4. **Given** I sign up or log in using an OAuth provider, **When** account creation completes, **Then** a profile record is created for my account (same guarantees as email/password).
5. **Given** I successfully log in and my profile record is missing (legacy or inconsistent data), **When** the session is established, **Then** the system creates/repairs my profile record without duplicates.

---

### User Story 3 - Schwer Branding & Theme Tokens (Priority: P3)

As a user, the application should clearly display the product name “Schwer Online Management” and consistently use the brand’s primary and secondary colors across the UI.

**Why this priority**: Consistent branding improves trust and recognizability and reduces UI inconsistency.

**Independent Test**: Can be tested by loading the login and authenticated pages and verifying the product name is present and the primary/secondary colors are used consistently.

**Acceptance Scenarios**:

1. **Given** I open the login page, **When** the page renders, **Then** “Schwer Online Management” is visible in the UI (e.g., header/title area).
2. **Given** I navigate across key pages (login, sign-up, dashboard), **When** UI elements use brand accents, **Then** they use the defined primary/secondary colors and do not introduce new custom colors.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- User logs in successfully, but the authenticated landing page requires additional setup (e.g., department selection) before the dashboard can load.
- Session expires mid-navigation: user should be redirected to login once (without redirect loops).
- User completes sign-up but profile creation fails due to a transient error (retry should be possible).
- User exists without a profile (legacy users): system should create or repair profile on next successful auth, without duplicates.
- User opens multiple tabs and logs in/out in one tab while the other is navigating.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The route `/` MUST remain a public landing page and MUST present Login and Sign up calls-to-action when the user is not authenticated.
- **FR-002**: When a user is not authenticated, the system MUST prevent access to protected pages and redirect the user to the login page.
- **FR-003**: After a successful login, the system MUST redirect the user to the correct authenticated destination (dashboard or required onboarding step) and MUST NOT enter a redirect loop.
- **FR-003a**: If the user has no department selected, the post-auth destination MUST be `/auth/choose-department`.
- **FR-003b**: If the user has a department selected, the post-auth destination MUST be their department dashboard.
- **FR-004**: If a user was redirected to login from a protected page, the system MUST return the user to the originally intended destination after successful authentication; if additional required onboarding must occur first, onboarding MUST take precedence and the system MUST return the user to the originally intended destination immediately after onboarding completes.
- **FR-005**: If a user is already authenticated, the system MUST not show the login page and MUST route them to the authenticated landing page.
- **FR-006**: On successful sign-up, the system MUST create a profile record linked to the new user.
- **FR-007**: Profile creation MUST be idempotent: the system MUST NOT create duplicate profile records for the same user.
- **FR-008**: If profile creation cannot be completed, the system MUST provide a user-visible error state and a supported recovery path (retry or contact support).
- **FR-008a**: Profile creation/ensurement MUST apply to all account creation paths (including OAuth).
- **FR-008b**: On successful login, if a profile record is missing, the system MUST create/repair it (idempotent) before proceeding to post-auth routing.
- **FR-009**: The application name MUST be presented as “Schwer Online Management” in user-visible branding locations.
- **FR-010**: The UI MUST use only the brand palette defined in the constitution for primary and secondary accents:
  - Primary: `#f07b26`
  - Secondary: `#d4620f`

### Constitution-Driven Constraints *(mandatory)*

- **C-001 (Approved Stack)**: The feature MUST comply with the project constitution’s approved technology and UI constraints.
- **C-002 (Access Control)**: Protected access MUST follow the constitution’s authentication and authorization principles (unauthenticated users cannot access protected areas; authorization is enforced consistently).
- **C-003 (Schema Contract)**: Any data-model change MUST be reflected in the project’s authoritative schema contract.
- **C-004 (Design Tokens)**: UI MUST follow the constitution’s brand tokens and consistent styling rules.
- **C-005 (Testing)**: Changes MUST include appropriate unit, integration, and end-to-end test coverage for the modified behaviors.

### Key Entities *(include if feature involves data)*

- **User Account**: An authenticated user identity that can log into the application.
- **Profile**: A user-associated record that stores the application’s user profile information required for normal operation.
- **Department Selection**: The user’s chosen department context (where applicable) that may influence the post-login destination.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 99%+ of successful logins reach the authenticated destination without any repeated login↔dashboard redirect cycle.
- **SC-002**: 100% of successful sign-ups result in exactly one profile record linked to the new user.
- **SC-003**: 100% of logged-out visits to / land on the public landing page with Login and Sign up calls-to-action.
- **SC-004**: Brand accent colors on key surfaces (login, sign-up, dashboard) match the constitution’s primary/secondary palette with no additional custom colors introduced.
- **SC-005**: 100% of logged-out attempts to access protected routes are redirected to /auth/login (single redirect; no login↔protected redirect loop).

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- Users can authenticate using the existing project authentication system (no new sign-in methods are introduced by this feature).
- The product’s authenticated “dashboard” already exists and is the intended landing destination for logged-in users.
- Some users may require a post-login onboarding step (such as department selection) before reaching the dashboard.
- A user profile store exists and is the authoritative place for application user profile records.
- Brand palette tokens are defined by the project constitution (primary `#f07b26`, secondary `#d4620f`) and must be used consistently.
