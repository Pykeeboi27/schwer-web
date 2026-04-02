# Implementation Plan: Authentication + Department Dashboard Redirect

**Branch**: `001-auth-dept-redirect` | **Date**: 2026-04-03 | **Spec**: ./spec.md
**Input**: Feature specification from `specs/001-auth-dept-redirect/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver the initial authentication and routing foundation:

- Email/password login with password visibility toggle.
- Email/password sign-up with department selection (from `department_enum`) and required email confirmation.
- Google authentication; if department is missing after OAuth, collect it via an in-app step.
- Redirect and protect dashboards at `/protected/[department]` so users cannot access other departments.

Implementation must comply with the Constitution’s Technology & Styling Constraints (fixed stack, approved UI primitives, brand tokens only).

## Phase Outputs

- Phase 0 (Research): `research.md`
- Phase 1 (Design): `data-model.md`, `contracts/`, `quickstart.md`

## Technical Context

**Language/Version**: TypeScript (Next.js / React)
**Primary Dependencies**: Next.js (App Router), Tailwind CSS, Supabase, Lucide Icons
**Storage**: Supabase Postgres (schema defined in `schema.sql`)
**Testing**: Unit + Integration + E2E (all required by constitution; recommended: Vitest + Testing Library + Playwright)
**Target Platform**: Web (modern evergreen browsers)
**Project Type**: Web application
**Performance Goals**: Prioritize correctness + security; keep auth-related redirects and server checks fast enough to feel instant for typical users.
**Constraints**: No service role key in client; enforce brand tokens (no ad-hoc colors); follow Supabase Auth + RLS requirements; do not introduce new UI frameworks.
**Scale/Scope**: MVP for initial rollout; keep architecture extensible (more dashboards, roles, and RLS policies) without reworking auth.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Fixed stack honored (Next.js + TypeScript + Tailwind + Lucide + Supabase)
- Approved UI primitives only (shadcn/ui + Radix allowed)
- Brand colors enforced via tokens only (no ad-hoc colors)
- Supabase Auth used; RLS policies required for sensitive tables
- Database changes reflected in `schema.sql`
- Test plan covers unit + integration + E2E

**Implementation MUST explicitly follow**: Constitution “Technology & Styling Constraints” section.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-dept-redirect/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
app/
├── auth/
│   ├── login/page.tsx
│   ├── sign-up/page.tsx
│   ├── sign-up-success/page.tsx
│   ├── confirm/route.ts
│   └── choose-department/page.tsx          # to be added
├── protected/layout.tsx
├── protected/page.tsx                      # redirector to /protected/[department]
└── protected/[department]/page.tsx         # to be added

components/
├── login-form.tsx
├── sign-up-form.tsx
└── ...

lib/
├── supabase/
└── profile/                                # to be added
public/

tests/
├── unit/
├── integration/
└── e2e/
```

**Structure Decision**: Use the existing Next.js App Router structure. Auth pages remain under `app/auth/*`. Department dashboards are implemented as a protected dynamic route under `app/protected/[department]`. Session + profile lookup and redirect decisions are centralized on the server (route handlers / server components) with small helpers under `lib/profile/*`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations anticipated for this feature.
