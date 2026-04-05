# Tasks: Auth Fixes

**Input**: Design documents from `specs/002-auth-fixes/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), plus `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are REQUIRED (unit + integration + E2E) per the project constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a known-good baseline before making behavior changes.

- [X] T001 Confirm local prerequisites and record any blockers in specs/002-auth-fixes/research.md
- [X] T002 [P] Run `npm install` and record any required environment notes in specs/002-auth-fixes/quickstart.md
- [X] T003 [P] Run baseline checks (`npm run lint`, `npm test`) and record failures + hypotheses in specs/002-auth-fixes/research.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix the root cause of the login loop and create a resilient “profile exists” invariant that all user stories rely on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Update RLS to allow safe self-insert of missing profiles in schema.sql
- [X] T005 [P] Add `ensureCurrentProfile` helper (idempotent create-on-missing) in lib/profile/ensure-current-profile.ts
- [X] T006 Update profile lookup APIs to use the new helper where needed in lib/profile/get-current-profile.ts
- [X] T007 [P] Add integration tests for ensure/create-on-missing profile behavior in tests/integration/ensure-current-profile.test.ts
- [X] T008 Update post-auth entrypoints to ensure profile exists before routing in app/auth/confirm/route.ts
- [X] T009 Update protected redirector to ensure profile exists before routing in app/protected/page.tsx
- [X] T010 Update department chooser gate to ensure profile exists before redirecting to login in app/auth/choose-department/page.tsx
- [X] T011 Update or add integration tests for /auth/confirm behavior when profile is missing in tests/integration/confirm.test.ts
- [X] T035 Implement “profile ensure failure” user-visible error + recovery path (redirect to /auth/error with a stable message + Try again + Back to login) for post-auth entrypoints (confirm, protected redirector, choose-department gate)
- [X] T036 [P] Add integration test covering ensure/profile-create failure → /auth/error shows recovery CTAs (no silent broken login)

**Checkpoint**: Foundation ready — an authenticated user must always have a profile row (via DB trigger or fallback) and routing must converge without loops.

---

## Phase 3: User Story 1 — Stable Login + Public Landing CTAs (Priority: P1) 🎯 MVP

**Goal**: Logged-out users can use the public landing page to navigate to Login/Sign up; protected routes redirect to login; successful login never enters a redirect loop.

**Independent Test**: Visit `/` while logged out and see CTAs; log in once and reach `/auth/choose-department` (if missing department) or `/protected/{department}` (if present) without ping-pong redirects.

### Tests for User Story 1 (Required) ⚠️

- [X] T012 [P] [US1] Add unit tests for public landing CTAs in tests/unit/landing-page.test.tsx
- [X] T013 [P] [US1] Add integration tests for protected redirect behavior stability in tests/integration/protected-redirect.test.ts
- [X] T014 [P] [US1] Add E2E coverage ensuring login does not loop (and ends at choose-department or dashboard) in tests/e2e/login.spec.ts

### Implementation for User Story 1

- [X] T015 [US1] Replace the current `/` home with a public landing page and Login/Sign up buttons in app/page.tsx
- [X] T016 [US1] Ensure `/auth/login` does not render for authenticated users (redirect to post-auth destination) in app/auth/login/page.tsx
- [X] T017 [US1] Ensure protected-route redirect rules are consistent with `/` being public in lib/supabase/proxy.ts
- [X] T037 [US1] Implement return-to-intended destination capture when redirecting unauthenticated users to /auth/login (e.g., add redirectTo query param)
- [X] T038 [US1] After successful login, honor `redirectTo` unless onboarding is required; if onboarding occurs first, persist `redirectTo` until department selection completes, then redirect to it
- [X] T039 [P] [US1] Add integration test: deep-link → login → (choose-department if needed) → returns to deep-link; verify no redirect loop
- [X] T040 [P] [US1] Extend E2E login coverage to include a deep-link return-to-intended scenario

**Checkpoint**: Logged-out behavior and post-login routing are stable; no redirect loop is possible in the documented flows.

---

## Phase 4: User Story 2 — Profile Creation on Sign-Up + Self-Heal on Login (Priority: P2)

**Goal**: New users (email/password and OAuth) reliably get a profile record; legacy users missing a profile are auto-repaired after login.

**Independent Test**: Create/sign-in as a user with no existing profile row and verify the app creates the profile and proceeds to routing without errors.

### Tests for User Story 2 (Required) ⚠️

- [X] T018 [P] [US2] Add unit tests for profile creation fallback behavior (mocked Supabase) in tests/unit/ensure-current-profile.test.ts
- [X] T019 [P] [US2] Extend integration tests to cover “profile missing on login” scenarios in tests/integration/ensure-current-profile.test.ts
- [X] T020 [P] [US2] Add/extend E2E sign-up test expectations to cover post-sign-up routing for users with/without department in tests/e2e/sign-up.spec.ts

### Implementation for User Story 2

- [X] T021 [US2] Reconcile the `auth.users` → `public.profiles` trigger behavior in schema.sql (ensure it exists and remains idempotent)
- [X] T022 [US2] Implement minimal profile upsert fields for fallback creation (id, email) in lib/profile/ensure-current-profile.ts
- [X] T023 [US2] Validate OAuth callback flow: extend tests to confirm /auth/confirm ensures profile before redirect decision (implementation covered by T008); include “profile missing” and “profile exists” cases
- [X] T024 [US2] Validate /protected and /auth/choose-department self-heal missing profiles before redirecting (implementation covered by T009–T010); add/extend integration coverage as needed

**Checkpoint**: Profile existence is guaranteed for any authenticated user and profile creation is idempotent across all entry points.

---

## Phase 5: User Story 3 — Schwer Branding + Theme Tokens (Priority: P3)

**Goal**: App name shows as “Schwer Online Management” and UI accent colors use the constitution palette via existing tokens.

**Independent Test**: Load `/` and `/protected/*` and verify product name is visible and primary/secondary accents follow the constitution palette without introducing new custom colors.

### Tests for User Story 3 (Required) ⚠️

- [X] T025 [P] [US3] Add unit test verifying branding text appears in key layouts/pages in tests/unit/branding.test.tsx
- [X] T026 [P] [US3] Add E2E check for title/branding presence on landing and login pages in tests/e2e/branding.spec.ts
- [X] T027 [P] [US3] Add/adjust integration snapshot/assertions if needed for metadata defaults in tests/integration/metadata.test.ts

### Implementation for User Story 3

- [X] T028 [US3] Update site metadata title/description to “Schwer Online Management” in app/layout.tsx
- [X] T029 [US3] Replace starter navbar label with “Schwer Online Management” in app/page.tsx and app/protected/layout.tsx
- [X] T030 [US3] Update theme CSS variables to use constitution primary/secondary colors (convert hex → HSL) in app/globals.css

**Checkpoint**: Branding and theme tokens are applied consistently and the UI uses only token-based colors.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Clean up and ensure full compliance.

- [X] T031 [P] Update documentation to match final behavior (landing page, routing invariants) in README.md
- [X] T032 Ensure quickstart steps match implemented behavior and test commands in specs/002-auth-fixes/quickstart.md
- [X] T033 Run full test suite and record results (unit+integration+e2e) in specs/002-auth-fixes/research.md
- [X] T034 [P] Remove any obsolete references to the starter kit name in shared UI components (e.g., headers/footers) in app/page.tsx and app/protected/layout.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: Depend on Foundational completion.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (ensure-profile + stable routing). No dependency on US2/US3.
- **US2 (P2)**: Depends on Foundational (ensure-profile + RLS). May reuse US1’s routing changes.
- **US3 (P3)**: Depends on none beyond Foundational; can be done in parallel once Phase 2 is complete.

### Parallel Opportunities

- In Phase 1: T002 and T003 can run in parallel.
- In Phase 2: T005 and T007 can run in parallel; schema change task T004 is independent but should land before testing fallback insert.
- Within each story: unit/integration/E2E test tasks are marked [P] and can be run in parallel across different files.

## Parallel Example: User Story 1

Parallelize by writing tests in separate files:

- Unit test file: `tests/unit/landing-page.test.tsx`
- E2E test file: `tests/e2e/landing.spec.ts`

## Implementation Strategy

### MVP First (US1 Only)

- Complete Phase 1 → Phase 2 → Phase 3.
- Validate via `specs/002-auth-fixes/quickstart.md`.

### Incremental Delivery

- After MVP (US1), implement US2 (profile guarantees) and then US3 (branding/theme).
