# Quickstart: Authentication + Department Dashboard Redirect

**Feature**: 001-auth-dept-redirect  
**Date**: 2026-04-03

## Prerequisites

- Node.js (LTS recommended)
- A Supabase project

## 1) Configure environment variables

Create/update `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 2) Configure Supabase Auth

In Supabase Dashboard:

### Email/password
- Enable Email auth.
- Enable **Confirm email** (required by this feature).

### Google OAuth
- Enable Google provider.
- Configure OAuth credentials (Client ID/Secret) in Supabase.

### Redirect URLs
Add your local and production URLs (examples):
- `http://localhost:3000/auth/confirm?next=/protected`
- `https://<your-domain>/auth/confirm?next=/protected`

## 3) Apply database schema

- Apply `schema.sql` to your Supabase database.
- Confirm RLS is enabled (the schema enables it for key tables).

This feature expects:
- `public.profiles` exists (already in `schema.sql`).
- RLS policies allow users to read their own profile.
- Additional policy and trigger described in `data-model.md` should be applied when implementing this feature.

## 4) Run the app

- Install dependencies: `npm install`
- Start dev server: `npm run dev`

## 5) Manual verification

### Email/password sign-up
- Go to `/auth/sign-up`
- Enter email/password and pick a department.
- Confirm you land on a "check your email" success screen.
- Click the confirmation link in email.
- Confirm you are redirected to `/protected/[department]`.

### Email/password login
- Go to `/auth/login`
- Log in with a confirmed account.
- Confirm you are redirected to `/protected/[department]`.

### Google authentication
- Use "Continue with Google" (routes to `/auth/oauth/google`).
- If department is missing, confirm the app requires selecting department first.
- Confirm final redirect is `/protected/[department]`.
