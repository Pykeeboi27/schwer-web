# schwer-web Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-05

## Active Technologies
- Supabase Postgres (schema defined in `schema.sql`) (002-auth-fixes)
- TypeScript (Next.js App Router / React) + Next.js, Tailwind CSS, Supabase, Lucide Icons (plus existing shadcn/ui primitives) (003-sales-dashboard)
- Supabase Postgres (authoritative schema in `schema.sql`) (003-sales-dashboard)
- Supabase Postgres with RLS policies (schema defined in `schema.sql`) (004-sales-dashboard-ui-overhaul)
- TypeScript (Next.js App Router / React) + Next.js, Tailwind CSS, Supabase (SSR cookie auth), Lucide, existing shadcn/ui primitives (005-executive-dashboard)
- Supabase Postgres (canonical schema in `schema.sql`) (005-executive-dashboard)

- TypeScript (Next.js / React) + Next.js (App Router), Tailwind CSS, Supabase, Lucide Icons (001-auth-dept-redirect)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript (Next.js / React): Follow standard conventions

## Recent Changes
- 005-executive-dashboard: Added TypeScript (Next.js App Router / React) + Next.js, Tailwind CSS, Supabase (SSR cookie auth), Lucide, existing shadcn/ui primitives
- 004-sales-dashboard-ui-overhaul: Added TypeScript (Next.js App Router / React)
- 003-sales-dashboard: Added TypeScript (Next.js App Router / React) + Next.js, Tailwind CSS, Supabase, Lucide Icons (plus existing shadcn/ui primitives)


<!-- MANUAL ADDITIONS START -->
## Overrides (This Repo)

## Project Structure

```text
app/
components/
lib/
tests/  # created when implementing multi-level testing
```

## Commands

- `npm run dev`
- `npm run build`
- `npm run lint`

Testing commands will be added during implementation (unit + integration + e2e required by constitution).
<!-- MANUAL ADDITIONS END -->
