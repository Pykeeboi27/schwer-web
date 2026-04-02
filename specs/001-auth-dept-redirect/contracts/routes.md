# Contracts: Routes & Navigation

**Feature**: 001-auth-dept-redirect  
**Date**: 2026-04-03

This document defines the user-facing route contract for authentication and department dashboards.

## Public (Unauthenticated)

- `GET /auth/login`
  - Shows email/password login form.
  - Includes password visibility toggle.
  - Includes Google sign-in entry point.

- `GET /auth/oauth/google`
  - Starts Google OAuth sign-in.
  - Redirects the user to Google, then returns to `/auth/confirm?next=/protected`.

- `GET /auth/sign-up`
  - Shows email/password sign-up form.
  - Required fields: email, password, department.
  - Includes password visibility toggle.

- `GET /auth/sign-up-success`
  - Shows "check your email" confirmation instructions.

- `GET /auth/confirm`
  - Auth callback endpoint.
  - Exchanges auth code for session.
  - Redirects to:
    - `/auth/choose-department` if department is missing
    - `/protected/[department]` if department is present

## Authenticated (but profile incomplete)

- `GET /auth/choose-department`
  - Only accessible when authenticated.
  - Only used when `profiles.department` is missing.
  - Submitting a valid department stores it on the profile, then redirects to `/protected/[department]`.

## Protected (Authenticated)

- `GET /protected`
  - Acts as a redirector.
  - Redirects to `/protected/[department]`.

- `GET /protected/[department]`
  - Department dashboard.
  - Access rules:
    - Must be authenticated
    - Must have profile department set
    - `[department]` must match the user’s stored department

## Errors / Redirects

- Attempting to access any `/protected/*` route while unauthenticated redirects to `/auth/login`.
- Attempting to access a different department’s dashboard redirects to the user’s correct `/protected/[department]`.
