# Research: Authentication + Department Dashboard Redirect

**Feature**: 001-auth-dept-redirect  
**Date**: 2026-04-03

## Decisions

### 1) Dashboard routing model
- **Decision**: Use per-department dashboard routes at `/protected/[department]`.
- **Rationale**: Makes routing explicit, simplifies access control, and aligns with Next.js App Router patterns.
- **Alternatives considered**:
  - Single `/protected` dashboard with conditional rendering (rejected: weaker URL-level access rules; harder to reason about permissions)
  - `/dashboard/[department]` (rejected: project already uses `/protected` as the authenticated area)

### 2) Email/password sign-up confirmation gating
- **Decision**: Require email confirmation before the user can log in.
- **Rationale**: Simple and secure; aligns with typical Supabase Auth behavior when confirmations are enabled.
- **Alternatives considered**:
  - Allow login but block `/protected/*` until confirmed (rejected: more states and branching; easier to misconfigure)

### 3) Google authentication department completion
- **Decision**: After Google auth completes, if the user has no stored department, show an in-app “Choose department” step; block access to `/protected/*` until department is set.
- **Rationale**: Google OAuth does not provide `department_enum`; choosing post-auth keeps OAuth flow simple.
- **Alternatives considered**:
  - Pre-assign departments via admin-only workflow (rejected: not requested; prevents self-service)

### 4) Where department data lives
- **Decision**: Store department in `public.profiles.department` (type `department_enum`) per `schema.sql`.
- **Rationale**: Central, queryable, and consistent with the schema’s intent.
- **Alternatives considered**:
  - Store department only in `auth.users.user_metadata` (rejected: harder to use for RLS and business queries)

### 5) Profile creation + updates (schema + RLS)
- **Decision**: Add a database-side trigger to create a `public.profiles` row on new `auth.users` creation, and add a self-update policy for profiles.
- **Rationale**: Email-confirmation sign-up does not guarantee an immediate client session; DB-triggered creation avoids race conditions and client-side privilege issues.
- **Alternatives considered**:
  - Client-side insert into `public.profiles` during sign-up (rejected: may not have session before confirmation; requires additional insert policies)

### 6) Redirect orchestration
- **Decision**: Centralize “where should this user go?” logic on the server:
  - `/auth/confirm` exchanges code for a session, then redirects based on profile state.
  - `/protected` becomes a redirector that sends authenticated users to `/protected/[department]` or to department selection if missing.
- **Rationale**: Avoids leaking authorization decisions to client-only code; keeps behavior consistent.

### 7) Testing approach (all levels required)
- **Decision**:
  - Unit: form behaviors (password toggle, required fields) and redirect helpers.
  - Integration: server-side redirect logic for `/protected` and `/auth/confirm` using mocked Supabase clients.
  - E2E: Playwright-based flows for sign-up (confirmation screen), login (confirmed user), Google auth happy path (can be smoke-tested against staging/local Supabase).
- **Rationale**: Covers correctness and routing/security rules without depending entirely on a real external auth provider in unit/integration tests.

## Notes / Constraints from Constitution

- Must adhere to the approved stack and UI primitives (Next.js + TypeScript + Tailwind + Supabase + Lucide; shadcn/ui + Radix allowed).
- Must use brand tokens only; avoid introducing new ad-hoc colors.
- Must follow Supabase Auth and enforce access with RLS for sensitive tables.
