<!--
Sync Impact Report (2026-04-02)

- Version change: template -> 1.0.0
- Modified principles: template placeholders -> project-specific principles (5)
- Added sections: Technology & Styling Constraints; Workflow & Quality Gates
- Removed sections: none
- Templates requiring updates:

  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
- Deferred TODOs:
  - TODO(RATIFICATION_DATE): Original adoption date not recorded.
  - TODO(TECH_STACK_STRICTNESS): Confirm whether existing shadcn/ui + Radix deps are
    considered acceptable under the "ONLY" stack constraint.
-->

# Schwer Web Constitution

## Core Principles

### I. Schema-First Database (Authoritative `schema.sql`)
- `schema.sql` is the canonical database contract for this project.
- Any change to tables/enums/functions/policies MUST be represented in `schema.sql`.
- Supabase database changes MUST be applied via SQL (migrations/SQL editor) in a way
	that keeps production schema consistent with `schema.sql`.
- Schema drift is a release blocker: if the running DB differs from `schema.sql`,
	treat it as a defect and reconcile immediately.

### II. Supabase Auth + RLS Security Model (NON-NEGOTIABLE)
- Authentication MUST use Supabase Auth (no bespoke auth/session system).
- Authorization MUST be enforced in the database with Row Level Security (RLS).
- All tables containing user/org data MUST have RLS enabled with explicit policies.
- Never use a service-role key in the browser/client bundle.
- Server-side Supabase access MUST use the server client pattern (cookie-based SSR).
- Route protection MUST follow Supabase session rules (unauthenticated users cannot
	access protected routes; server actions/route handlers verify session).

### III. Design Tokens + Consistent UI (Clean, Easy-to-Follow)
- Styling MUST be consistent across the entire app.
- Use Tailwind CSS and shared UI components/patterns; avoid one-off styling.
- Brand colors MUST be the only custom palette:
	- Primary: `#f07b26`
	- Secondary: `#d4620f`
	- Black: `#000000`
	- White: `#ffffff`
- Do not introduce new hard-coded colors. If a color is needed, it MUST be derived
	from the above tokens or existing Tailwind neutrals.
- Icons MUST use Lucide.

### IV. Next.js App Router Boundaries (Keep Code Clean)
- Keep server-only and client-only code clearly separated.
- Data access and Supabase calls belong in `lib/` and server utilities, not inside
	presentational components.
- Components MUST remain focused: UI components render UI; data fetching/side
	effects live in server components, route handlers, or dedicated helpers.
- Prefer small, composable functions and predictable file organization.

### V. Testing at All Levels (NON-NEGOTIABLE)
- Every meaningful change MUST include tests at the appropriate levels:
	- Unit tests: utilities, hooks, component logic.
	- Integration tests: key user flows that touch Next route handlers/server actions
		+ Supabase interactions (mocked or local where feasible).
	- E2E tests: critical journeys in the browser.
- Tests MUST run in CI (or an equivalent gating workflow) before merge.
- A PR that changes behavior without updating/adding tests is presumed incomplete.

## Technology & Styling Constraints

- Runtime stack MUST remain limited to:
	- Next.js (React)
	- TypeScript
	- Tailwind CSS
	- Lucide Icons
	- Supabase (DB + Auth)
- Adding new runtime frameworks/libraries that change the architecture requires a
	constitution amendment.
- Database MUST follow `schema.sql` and be implemented in Supabase Postgres.
- Supabase RLS policies are mandatory for any sensitive table.

## Workflow & Quality Gates

- Every PR MUST satisfy:
	- TypeScript typecheck (no `any`-based escapes without justification).
	- Linting passes.
	- Tests at all required levels updated/added.
	- Security review: no secrets committed; no service role exposure.
	- Design review: uses tokens and consistent UI patterns.
- If work requires a constraint exception (e.g., adding a dependency), the PR MUST
	propose a constitution amendment in the same change set.

## Governance

- This constitution supersedes local conventions and defaults.
- Amendments:
	- Propose the change (what/why), include migration plan (if needed), and update
		dependent templates.
	- Versioning policy:
		- MAJOR: breaking redefinitions/removal of principles, or security model change.
		- MINOR: new principle/section or materially expanded constraints.
		- PATCH: clarifications, wording improvements, non-semantic refinements.
- Compliance is reviewed on every PR (check principles + constraints + gates).

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2026-04-02
