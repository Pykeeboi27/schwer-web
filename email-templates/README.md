# Auth email templates

These are the redesigned Supabase auth emails for this project. Supabase hosts and sends
these itself — there's no code path in this repo that renders or sends them — so getting
them live requires pasting the HTML into the Supabase Dashboard by hand.

## How to apply

1. Open the Supabase Dashboard for this project.
2. Go to **Authentication → Emails → Templates** (may show as "Email Templates" depending
   on dashboard version).
3. Select the **Confirm signup** template, switch to the source/HTML editor, and replace its
   contents with `confirm-signup.html`.
4. Select the **Reset Password** template and replace its contents with `reset-password.html`.
5. Save each template, then use the Dashboard's built-in preview or "send test email" option
   to confirm it renders correctly before relying on it.

## Notes

- Both templates use `{{ .ConfirmationURL }}`, which Supabase substitutes automatically —
  don't rename or remove it.
- Colors match the app's brand tokens (`--secondary` / `--primary` in `app/globals.css`),
  hardcoded as hex since email clients don't support CSS custom properties:
  - Header/background: `#2C313A` (secondary)
  - Accent/button: `#BF570D` (primary)
- "Successfully signed up" and "Confirm sign up" are the same email in this project —
  Supabase only sends one signup-related email by default (Confirm signup). There is no
  separate welcome email; adding one would require a new Supabase Edge Function + DB
  webhook, which is out of scope here.
- Markup is table-based with inline styles for maximum compatibility across email clients
  (many strip `<style>` blocks or don't support flexbox/grid).
