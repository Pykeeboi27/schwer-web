# Research: Auth Fixes

**Feature**: 002-auth-fixes  
**Date**: 2026-04-03

## Decisions

### 1) Root cause of the login redirect loop
- **Decision**: Treat a missing `public.profiles` row as the primary root cause of the observed login↔dashboard loop, and fix it at the data layer first.
- **Rationale**: Current routing logic depends on a profile being present:
  - `/protected` requires `getCurrentProfile()`; if null → redirects to `/auth/login`.
  - Post-auth routing uses `getPostAuthRedirectPath(profile)`; if profile is null → routes to `/auth/choose-department`.
  - `/auth/choose-department` also requires `getCurrentProfile()`; if null → redirects to `/auth/login`.
  If the user is authenticated but has no profile row, these redirects can bounce between pages indefinitely.
- **Alternatives considered**:
  - Add client-only redirect logic (rejected: fragile; can reintroduce loops; violates server-first auth boundaries).

### 2) Profile creation strategy (all auth paths)
- **Decision**: Keep database-side profile creation as the primary mechanism (trigger on `auth.users`), and add an application-level “ensure profile exists” fallback for resilience.
- **Rationale**:
  - Supabase Auth user creation (email/password and OAuth) ultimately inserts into `auth.users`; a DB trigger is the most reliable and avoids client-side privilege concerns.
  - The reported behavior strongly suggests schema drift (trigger not present in the running DB) or a misconfiguration.
  - The app should still self-heal: if a session exists but the profile row is missing, create it idempotently and continue.
- **Alternatives considered**:
  - Only create profiles in sign-up server action (rejected: does not cover OAuth; does not cover legacy users).

### 3) RLS implications for “ensure profile” fallback
- **Decision**: Add a narrowly-scoped RLS INSERT policy that allows users to insert their own profile row (id = `auth.uid()`), enabling an authenticated server action to upsert the row without using service-role credentials.
- **Rationale**: The server-side Supabase client runs as the signed-in user. With current policies, an authenticated user can select/update their row but cannot insert it when missing. A self-insert policy enables safe idempotent creation.
- **Alternatives considered**:
  - Use service role for profile creation (rejected: avoid expanding privileged surface area; constitution emphasizes avoiding service role exposure).
  - Create a new SECURITY DEFINER RPC to insert profiles (possible, but heavier than a self-insert policy).

### 4) Post-auth routing rule
- **Decision**: Preserve the existing rule: if `department` is missing, route to `/auth/choose-department` and block dashboard access until selected.
- **Rationale**: Matches current helper `getPostAuthRedirectPath()` and prevents undefined dashboard states.

### 5) Public landing page vs default-to-login
- **Decision**: Keep `/` as a public landing page that shows “Login” and “Sign up” calls-to-action; only protected routes redirect to `/auth/login`.
- **Rationale**: Matches user clarification and keeps marketing/entry content accessible.

### 6) Branding + theme tokens
- **Decision**: Apply the constitution’s brand colors through existing CSS variables (`--primary`, `--secondary`) and keep all UI using Tailwind tokens (no ad-hoc colors). Update visible app name to “Schwer Online Management”.
- **Rationale**: Project already uses shadcn-style CSS variables wired into Tailwind (`bg-primary`, `text-primary-foreground`, etc.), so swapping variable values updates the theme consistently.

### 7) Testing approach (all levels required)
- **Decision**:
  - Unit: keep/extend helper tests (post-auth redirect decisions, department validation).
  - Integration: add/extend tests around “ensure profile exists” and redirect behavior when profile is missing.
  - E2E: verify login does not loop and that first-time users without department land on `/auth/choose-department`.
- **Rationale**: This issue is a state-machine bug across routes; integration/E2E tests are the best guardrail.

## Notes / Constraints from Constitution

- Must use the approved stack (Next.js + TypeScript + Tailwind + Supabase + Lucide; shadcn/ui + Radix allowed).
- Must enforce brand tokens (Primary `#f07b26`, Secondary `#d4620f`) and avoid new custom colors.
- Must follow Supabase Auth with RLS enforcement, and reflect any DB changes in `schema.sql`.
- Must add/update unit, integration, and E2E tests for meaningful behavior changes.

## Implementation Log

### Setup and baseline checks
- Prerequisites check passed for feature directory `specs/002-auth-fixes` with all required docs present.
- `npm install` completed with no install blockers.
- Baseline checks passed:
  - `npm run lint`
  - `npm test`

### Post-implementation validation
- Lint passes after implementation changes: `npm run lint`.
- Unit and integration tests pass after implementation changes: `npm test`.
- New tests added for:
  - ensure-profile helper behavior
  - confirm flow profile recovery/error routing
  - protected redirect contract behavior
  - landing page CTA and branding metadata assertions

### Remaining verification
- E2E command executed: `npm run test:e2e`.
  - Result: 1 passed, 4 skipped (credential-dependent flows remain skipped until env vars are provided).
