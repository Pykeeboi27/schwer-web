# Data Model: Auth Fixes

**Feature**: 002-auth-fixes  
**Date**: 2026-04-03

## Existing Entities

### `public.profiles`
Authoritative application profile record for each Supabase Auth user.

**Key fields (current schema):**
- `id` (UUID, PK) — references `auth.users(id)`
- `email` (text, unique, required)
- `full_name` (text, optional)
- `avatar_url` (text, optional)
- `phone` (text, optional)
- `department` (`department_enum`, nullable)
- `role` (`user_role_enum`, default `viewer`)
- `is_executive_viewer` (boolean, default false)
- `is_active` (boolean, default true)
- `created_at`, `updated_at` (timestamps)

**Key invariants required by this feature:**
- For every authenticated user, there MUST be exactly one `profiles` row with `profiles.id = auth.uid()`.
- Profile creation MUST be idempotent (no duplicates).
- `department` MAY be null; if null, user must complete `/auth/choose-department` before accessing dashboards.

## Data Lifecycle

### Profile creation
**Primary mechanism:** DB-triggered creation on `auth.users` insert.

- Trigger: `trg_on_auth_user_created` on `auth.users`
- Function: `public.fn_handle_new_auth_user()`
- Behavior: inserts minimal profile (`id`, `email`, optional `department` derived from `raw_user_meta_data.department`) and updates email on conflict.

**Fallback mechanism (added by this feature):** application-level “ensure profile exists”
- If a session exists but `profiles` lookup returns no row, the app will create the missing profile row (idempotent) and re-fetch.
- This requires a safe RLS policy to allow self-insert (see below).

## RLS / Authorization

### Existing policies (current schema)
- Self read (`SELECT`) policy for `profiles`
- Self update (`UPDATE`) policy for `profiles`
- Admin/all policy for `profiles`

### Planned policy addition for this feature
Add a narrowly-scoped INSERT policy that allows users to insert their own row:
- `WITH CHECK (auth.uid() = id)`
- This enables a server-side authenticated request to `upsert` a missing row without using a service-role key.

## Schema Changes

- Update `schema.sql` to include the new `profiles` INSERT policy for self-insert.
- Ensure the deployed Supabase database includes the `auth.users` trigger for profile creation; reconcile any drift.
