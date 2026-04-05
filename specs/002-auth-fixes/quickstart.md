# Quickstart: Auth Fixes

**Feature**: 002-auth-fixes  
**Date**: 2026-04-03

## Goal

Verify that:
- Login no longer causes a redirect loop.
- A profile record exists for new users (email/password and OAuth).
- Users without a department are routed to `/auth/choose-department`.
- Brand theme and product naming are applied.

## Prerequisites

- Node.js installed.
- Supabase project configured and environment variables present.

## Run locally

1) Install deps

- `npm install`

2) Start the dev server

- `npm run dev`

## Manual verification (happy paths)

### 1) Logged-out user
- Visit `/` → see landing page with Login + Sign up buttons.
- Visit `/protected` or `/protected/hr` while logged out → redirected to `/auth/login?redirectTo=...`.

### 2) Email/password sign-up creates profile
- Sign up a new user.
- After completion, confirm a `profiles` row exists for that user in Supabase (and no duplicates).

### 3) Login does not loop
- Log out.
- Log in with a known user.
- Expected:
  - If department missing → `/auth/choose-department` (and preserves `redirectTo` if present).
  - If department present → `/protected/{department}`.
  - No ping-pong redirects between `/auth/login` and `/protected`.

### 4) Department selection
- For a user without department, choose one.
- Verify redirect to `redirectTo` when present, otherwise `/protected/{department}`.

### 5) Branding + theme
- Confirm the visible app name is “Schwer Online Management” (header and document title).
- Confirm primary/secondary accents follow the constitution palette and no new custom colors are introduced.

## Automated tests

- Unit + integration:
  - `npm test`

Current status:
- `npm test` passes for this feature branch.

- E2E:
  - `npm run test:e2e`

Current status:
- Pending local E2E environment credentials.

## Troubleshooting

- If profiles are not created on sign-up:
  - Verify the running Supabase DB matches `schema.sql` (especially the `auth.users` trigger that inserts into `public.profiles`).
  - Confirm RLS policies allow the intended reads/updates, and that the feature’s planned self-insert policy is applied.
