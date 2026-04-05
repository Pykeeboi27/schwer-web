# Route Contracts: Auth Fixes

**Feature**: 002-auth-fixes  
**Date**: 2026-04-03

This document describes the user-visible routing and redirect contracts that must hold after implementing this feature.

## Public Routes

### `GET /`
- If logged out: show a public landing page with two primary CTAs:
  - “Login” → `/auth/login`
  - “Sign up” → `/auth/sign-up`
- If logged in: MAY still show the landing page, but MUST NOT cause a redirect loop.
  - (Optional follow-up: redirect to post-auth destination; if implemented, must be stable and consistent.)

## Auth Routes

### `GET /auth/login`
- If logged out: show login form.
- If logged in:
  - Redirect to post-auth destination:
    - If department missing → `/auth/choose-department`
    - If department present → `/protected/{department}`

### `POST /auth/login` (server action)
- On success: establishes a Supabase session and returns a success state.
- Client follows up by navigating into authenticated flow (typically `/protected`).

### `GET /auth/sign-up`
- If logged out: show sign-up form.
- On successful sign-up:
  - A profile record must exist for the user (primary via DB trigger; fallback via app ensurement).

### `GET /auth/confirm`
Handles email OTP verification and OAuth callback session exchange.

- On success: establishes session.
- MUST ensure profile exists (create if missing) before deciding post-auth redirect.
- Redirects:
  - If department missing → `/auth/choose-department`
  - If department present → `/protected/{department}`

### `GET /auth/choose-department`
- If logged out: redirect to `/auth/login`.
- If logged in and department already set: redirect to `/protected/{department}`.
- If logged in and department missing:
  - Render department selection UI.

### Department selection submit
- Updates `profiles.department`.
- Redirects to `/protected/{department}`.

## Protected Routes

### `GET /protected`
- If logged out: redirect to `/auth/login`.
- If logged in:
  - MUST ensure profile exists (create if missing) before routing.
  - Redirect to:
    - `/auth/choose-department` if department missing
    - `/protected/{department}` if department present

### `GET /protected/{department}`
- If logged out: redirect to `/auth/login`.
- If logged in and department missing: redirect to `/auth/choose-department`.
- If logged in and `{department}` differs from profile department: redirect to the profile’s department dashboard.

## Loop Prevention Invariant

For any authenticated user, visiting `/auth/login`, `/protected`, or `/auth/choose-department` MUST converge to a stable page in <= 2 redirects.
