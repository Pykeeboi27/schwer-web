# Tasks: Authentication + Department Dashboard Redirect

**Input**: Design documents from `specs/001-auth-dept-redirect/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), plus `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: REQUIRED (unit + integration + E2E) per project constitution.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `- [ ] T### [P?] [US#?] Description (with file path)`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US#]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the minimal testing/tooling scaffolding required by the constitution.

- [X] T001 Create test directory structure in `tests/unit/`, `tests/integration/`, `tests/e2e/`
- [X] T002 [P] Add unit/integration test tooling deps in `package.json` (Vitest + React Testing Library + jsdom)
- [X] T003 [P] Add E2E test tooling deps in `package.json` (Playwright)
- [X] T004 [P] Add Vitest config in `vitest.config.ts`
- [X] T005 [P] Add unit test setup in `tests/unit/setup.ts` (e.g., `@testing-library/jest-dom`)
- [X] T006 [P] Add Playwright config in `playwright.config.ts`
- [X] T007 Update npm scripts for tests in `package.json` (e.g., `test`, `test:unit`, `test:integration`, `test:e2e`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared auth/profile infrastructure that MUST exist before user stories.

- [X] T008 Update `schema.sql` to auto-create `public.profiles` rows for new `auth.users` (trigger inserts `profiles.id = NEW.id`, `profiles.email = NEW.email`, and (optionally) `profiles.department = NEW.raw_user_meta_data->>'department'` when valid)
- [X] T009 Update `schema.sql` to allow users to update their own profile (add `public.profiles` self-update RLS policy)
- [X] T010 Update `schema.sql` to prevent changing `public.profiles.department` once set (add a DB constraint/trigger)
- [X] T011 [P] Add department enum source-of-truth in `lib/profile/departments.ts` (values from `department_enum`)
- [X] T012 [P] Add profile data access helper in `lib/profile/get-current-profile.ts` (server: uses `lib/supabase/server.ts`)
- [X] T013 [P] Add redirect decision helper in `lib/profile/redirect-to-dashboard.ts` (auth/profile complete vs incomplete)
- [X] T014 Update `app/auth/confirm/route.ts` to handle email OTP (`token_hash` + `type`) and OAuth (`code`) callbacks, then redirect to `/auth/choose-department` if department missing else `/protected/[department]`

---

## Phase 3: User Story 1 — Log in with Email + Password (Priority: P1) 🎯 MVP

**Goal**: Existing users can log in with email/password, toggle password visibility, and land on `/protected/[department]` with department-level access enforcement.

**Independent Test**: A confirmed user with a known department logs in and is redirected to the correct `/protected/[department]`; cross-department access redirects back.

### Tests for User Story 1 (Required)

- [X] T015 [P] [US1] Unit test password visibility toggle in `tests/unit/login-form.test.tsx`
- [X] T016 [P] [US1] Unit test “unconfirmed email” error copy in `tests/unit/login-form.test.tsx` (assert actionable confirm instructions)
- [X] T017 [P] [US1] Integration test login server action handles unconfirmed email in `tests/integration/login-action.test.ts`
- [X] T018 [P] [US1] Integration test redirect helper behavior in `tests/integration/redirect-to-dashboard.test.ts`
- [X] T019 [P] [US1] E2E test login → redirect to dashboard in `tests/e2e/login.spec.ts`

### Implementation for User Story 1

- [X] T020 [US1] Add password show/hide toggle UI in `components/login-form.tsx`
- [X] T021 [US1] Implement login server action in `app/auth/login/actions.ts` using `lib/supabase/server.ts` (no direct Supabase calls in UI)
- [X] T022 [US1] Refactor `components/login-form.tsx` to submit via the server action (preserve UX + client-side validation)
- [X] T023 [US1] Improve unconfirmed-email error messaging in `components/login-form.tsx` (friendly “confirm your email” guidance)
- [X] T024 [US1] Convert `/protected` into a redirector in `app/protected/page.tsx` (server: auth + profile + redirect)
- [X] T025 [US1] Add department dashboard route in `app/protected/[department]/page.tsx`
- [X] T026 [US1] Enforce department match in `app/protected/[department]/page.tsx` (redirect mismatches to the user’s own dashboard)

**Checkpoint**: US1 works end-to-end and is independently testable.

---

## Phase 4: User Story 2 — Sign up with Email + Password + Department (Priority: P2)

**Goal**: New users can sign up with email/password + department, see “check your email” guidance, and (after confirming) be routed to `/protected/[department]`.

**Independent Test**: A brand-new user signs up with department selected, sees `/auth/sign-up-success`, confirms email, and lands on `/protected/[department]`.

### Tests for User Story 2 (Required)

- [X] T027 [P] [US2] Unit test sign-up department selection + password toggle in `tests/unit/sign-up-form.test.tsx`
- [X] T028 [P] [US2] Integration test sign-up server action includes department metadata + redirect URL in `tests/integration/sign-up-action.test.ts`
- [X] T029 [P] [US2] E2E test sign-up → success screen in `tests/e2e/sign-up.spec.ts`

### Implementation for User Story 2

- [X] T030 [US2] Add department selection UI in `components/sign-up-form.tsx` (options from `lib/profile/departments.ts`)
- [X] T031 [US2] Add password show/hide toggle UI in `components/sign-up-form.tsx` (password + repeat password)
- [X] T032 [US2] Implement sign-up server action in `app/auth/sign-up/actions.ts` using `lib/supabase/server.ts` (includes `options.data.department` and email redirect to `/auth/confirm?next=/protected`)
- [X] T033 [US2] Refactor `components/sign-up-form.tsx` to submit via the server action (no direct Supabase calls in UI)

**Checkpoint**: US2 works end-to-end and does not break US1.

---

## Phase 5: User Story 3 — Authenticate with Google (Priority: P3)

**Goal**: Users can sign in with Google; if department is missing after OAuth, they must choose a department before accessing `/protected/*`.

**Independent Test**: An authenticated user with `profiles.department = NULL` is forced through `/auth/choose-department`, then lands on `/protected/[department]`.

### Tests for User Story 3 (Required)

- [X] T034 [P] [US3] Unit test choose-department form validation in `tests/unit/choose-department.test.tsx`
- [X] T035 [P] [US3] Integration test `/auth/confirm` redirect when department missing in `tests/integration/confirm.test.ts`
- [X] T036 [P] [US3] E2E test department completion gate in `tests/e2e/choose-department.spec.ts`

### Implementation for User Story 3

- [X] T037 [US3] Implement Google OAuth entry route in `app/auth/oauth/google/route.ts` (server-side `signInWithOAuth`, redirect back to `/auth/confirm?next=/protected`)
- [X] T038 [US3] Update `components/login-form.tsx` Google button to navigate to `/auth/oauth/google` (no direct Supabase calls in UI)
- [X] T039 [US3] Implement `/auth/choose-department` page in `app/auth/choose-department/page.tsx` (authenticated-only; department-missing-only)
- [X] T040 [US3] Implement profile update to set department in `app/auth/choose-department/page.tsx` (update `public.profiles.department` under RLS)

**Checkpoint**: US3 works end-to-end and does not break US1/US2.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T041 [P] Align Quickstart redirect URLs with implementation in `specs/001-auth-dept-redirect/quickstart.md`
- [X] T042 [P] Verify all auth redirect rules match the route contract in `specs/001-auth-dept-redirect/contracts/routes.md`
- [X] T043 Audit Supabase key usage and session handling in `lib/supabase/server.ts` and `lib/supabase/client.ts` (no service role keys)
- [X] T044 [P] Add CI workflow in `.github/workflows/ci.yml` to run `npm ci`, `npm run lint`, and `npm run test:unit`/`npm run test:integration` (and `npm run test:e2e` if env/secrets are available)
- [X] T045 Run `npm run lint` and the added test scripts in `package.json` and fix any issues introduced by this feature

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → blocks Foundational until test tooling is ready
- Foundational (Phase 2) → blocks all user stories
- User Stories (Phase 3+) → can be implemented in priority order (US1 → US2 → US3)
- Polish (Phase 6) → after desired user stories are complete

### User Story Dependencies

- US1: Depends on Phase 2 (profile fetch + redirect helpers)
- US2: Depends on Phase 2 (confirm route + DB profile creation)
- US3: Depends on Phase 2 (confirm route + profile update policy)

---

## Parallel Execution Examples

### After Phase 2 completes

- US1 tasks (login + `/protected` redirector + dashboard route) can proceed independently of US2/US3.
- US2 tasks (sign-up dept selection) can proceed independently of US3.
- Tests marked `[P]` within a story can be implemented in parallel (different files).

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: US1
4. Validate: run unit + integration + e2e for US1

### Incremental Delivery

1. Complete US1 → validate
2. Add US2 → validate
3. Add US3 → validate
