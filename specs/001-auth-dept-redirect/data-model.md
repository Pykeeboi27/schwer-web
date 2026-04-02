# Data Model: Authentication + Department Dashboard Redirect

**Feature**: 001-auth-dept-redirect  
**Date**: 2026-04-03

## Authoritative Source

- Database schema is defined in `schema.sql`.
- This feature primarily uses `auth.users` (Supabase Auth) and `public.profiles`.

## Entities

### 1) `auth.users` (Supabase-managed)
- **Purpose**: Authentication identity store (email/password, Google OAuth).
- **Key fields used (conceptual)**:
  - `id` (UUID) — primary identity, becomes `public.profiles.id`
  - `email`
  - `email_confirmed_at` / confirmation state (managed by Supabase)
  - `raw_user_meta_data` (used as an optional source for initial department)

### 2) `public.profiles`
Defined in `schema.sql`.

- **Primary key**: `id UUID` (FK → `auth.users(id)`)
- **Key fields used by this feature**:
  - `email TEXT NOT NULL UNIQUE`
  - `department department_enum NULL`
  - `role user_role_enum NOT NULL DEFAULT 'viewer'`
  - `is_active BOOLEAN NOT NULL DEFAULT TRUE`
  - `created_at`, `updated_at`

#### Validation rules
- `department` MUST be either NULL or one of `department_enum`:
  - `hr`, `sales`, `accounting`, `engineering`, `purchasing`, `executive`
- `email` MUST be present and unique.

#### Relationships
- `public.profiles.id` ↔ `auth.users.id` (1:1)

## State & Transitions (Feature-relevant)

### Profile completeness
- **Incomplete profile**: `profiles.department IS NULL`
- **Complete profile**: `profiles.department IS NOT NULL`

### Access gating
- **Unauthenticated**: cannot access `/protected/*`
- **Authenticated + profile complete**: can access `/protected/[department]` where `[department] == profiles.department`
- **Authenticated + profile incomplete**: must complete department selection before accessing `/protected/*`
- **Unconfirmed email (email/password)**: cannot log in (Supabase Auth blocks login)

## RLS & Policies (from `schema.sql` + required additions)

### Existing in `schema.sql`
- `public.profiles` has RLS enabled.
- `profiles_self_read`: a user can SELECT their own profile.
- `profiles_admin_all`: owner/executive can do ALL operations.

### Required for this feature (to be added to `schema.sql`)
- **Self update policy** for `public.profiles` so users can set/update their own `department` (needed for Google auth onboarding and any future profile edits):
  - `FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`

### Profile row creation
This feature assumes a DB-side mechanism exists to ensure a profile row is created for every user.

- Preferred approach: **Trigger on `auth.users` INSERT** that inserts a corresponding `public.profiles` record.
- Department may be set from `raw_user_meta_data` at creation time (email/password sign-up), or left NULL (Google first-time).

## Audit / updated_at
- `schema.sql` already defines audit triggers and an `updated_at` trigger for `public.profiles`.
