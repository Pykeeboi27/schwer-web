# Implementation Plan: Auth Fixes

**Branch**: `002-auth-fixes` | **Date**: 2026-04-03 | **Spec**: ./spec.md
**Input**: Feature specification from `specs/002-auth-fixes/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Fix three production-blocking areas while staying within the constitution’s stack and styling rules:

- Stop the login redirect loop by making post-auth routing resilient to missing profile rows.
- Ensure every new user (email/password and OAuth) has a `public.profiles` row; auto-repair on login if missing.
- Apply Schwer branding: product name “Schwer Online Management” and constitution-defined primary/secondary colors via existing design tokens.

Implementation approach (from research):
- Reconcile Supabase schema drift so the `auth.users` → `public.profiles` trigger is present and correct.
- Add an application-level “ensure profile exists” fallback (idempotent) that runs on post-auth entry points.
- Keep post-auth routing centralized on the server (`getPostAuthRedirectPath`), and ensure it converges in <= 2 redirects.

Supporting docs:
- Research: `./research.md`
- Data model: `./data-model.md`
- Route contracts: `./contracts/routes.md`
- Quickstart: `./quickstart.md`

## Phase Outputs

- Phase 0 (Research): `research.md`
- Phase 1 (Design): `data-model.md`, `contracts/`, `quickstart.md`

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (Next.js / React)
**Primary Dependencies**: Next.js (App Router), Tailwind CSS, Supabase, Lucide Icons
**Storage**: Supabase Postgres (schema defined in `schema.sql`)
**Testing**: Unit + Integration + E2E (all required by constitution)
**Target Platform**: Web (modern evergreen browsers)
**Project Type**: Web application
**Performance Goals**: Prioritize correctness + security; keep auth/profile lookups and redirects fast enough to feel instant for typical users.
**Constraints**: No service role key in client; enforce brand tokens (no ad-hoc colors); follow Supabase Auth + RLS requirements; keep server/client boundaries clean (App Router).
**Scale/Scope**: Targeted fixes to existing auth/profile/theme behaviors; avoid introducing new frameworks or new architectural layers.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Fixed stack honored (Next.js + TypeScript + Tailwind + Lucide + Supabase)
- Brand colors enforced via tokens only (no ad-hoc colors)
- Supabase Auth used; RLS policies required for sensitive tables
- Database changes reflected in `schema.sql`
- Test plan covers unit + integration + E2E

**Implementation MUST explicitly follow**: Constitution “Technology & Styling Constraints” section.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-fixes/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
app/
├── page.tsx
├── layout.tsx
├── auth/
│   ├── login/page.tsx
│   ├── login/actions.ts
│   ├── sign-up/page.tsx
│   ├── sign-up/actions.ts
│   ├── confirm/route.ts
│   └── choose-department/page.tsx
└── protected/
  ├── layout.tsx
  ├── page.tsx
  └── [department]/page.tsx

components/
├── auth-button.tsx
├── login-form.tsx
├── sign-up-form.tsx
└── ...

lib/
├── profile/
│   ├── get-current-profile.ts
│   └── redirect-to-dashboard.ts
└── supabase/
  ├── server.ts
  └── proxy.ts

tests/
├── unit/
├── integration/
└── e2e/
```

**Structure Decision**: Use the existing Next.js App Router structure and keep auth decisions server-side. Profile lookup and post-auth routing remain centralized under `lib/profile/*` and server entry points (`/protected`, `/auth/confirm`). UI continues to use Tailwind + the existing shadcn-style design tokens.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations anticipated for this feature.

## Implementation Plan (Phased)

### Phase A — Diagnose + Reconcile Schema Drift

1. Confirm the running Supabase DB matches `schema.sql` for the auth→profile creation flow:
  - Trigger on `auth.users` that calls `public.fn_handle_new_auth_user()`.
  - `public.profiles` table exists and has expected columns.
  - RLS enabled and policies present.
2. If drift exists, apply the missing SQL (or re-apply the relevant section) so DB behavior matches `schema.sql`.

### Phase B — Application-level “Ensure Profile Exists” Fallback

1. Add a server-side helper that:
  - Reads the authenticated user.
  - Fetches profile.
  - If missing, creates the minimal profile row idempotently, then re-fetches.
2. Run this helper on post-auth entry points that currently depend on profile existence:
  - `/auth/confirm` (OAuth + OTP confirmation)
  - `/protected` redirector
  - `/auth/choose-department` gate

### Phase C — Fix Redirect Convergence

1. Ensure the redirect graph converges in <= 2 redirects for these cases:
  - Logged-in user with profile + department → dashboard.
  - Logged-in user with profile but no department → choose-department.
  - Logged-in user missing profile → profile created → choose-department (or dashboard if department present).
2. Preserve “return to intended destination” when applicable, but never at the expense of stability. Implement this via a redirectTo value captured on unauth → login redirect; onboarding (/auth/choose-department) takes precedence, then returns to redirectTo after onboarding completes.

### Phase D — Landing Page + Branding + Theme

1. Update `/` to a public landing page with Login and Sign up CTAs.
2. Update visible app name to “Schwer Online Management”:
  - Document title/metadata
  - Header/navbar labels
3. Update theme tokens using the constitution palette by adjusting existing CSS variables:
  - Primary: `#f07b26`
  - Secondary: `#d4620f`

### Phase E — Tests

1. Unit: helpers (routing decisions, validation) remain covered.
2. Integration: add coverage for ensure-profile + redirect convergence.
3. E2E: cover “login does not loop” and “missing profile self-heals”.

## Post-Design Constitution Check (Re-evaluation)

PASS (expected). The design and planned implementation:
- Uses only the approved stack (Next.js + TypeScript + Tailwind + Supabase + Lucide).
- Applies branding via existing tokens/CSS variables (no new ad-hoc colors).
- Keeps auth and routing decisions server-side and consistent with Supabase SSR session rules.
- Treats `schema.sql` as authoritative for DB changes (trigger/policies).
- Adds/updates tests at unit, integration, and E2E levels.
