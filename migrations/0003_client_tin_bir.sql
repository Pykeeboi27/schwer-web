-- Phase 4 — Client Module: add TIN and BIR registration link to clients.
-- BIR registration is stored as a manually pasted Google Drive (or any URL) link;
-- no app-level file upload integration exists.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tin TEXT,
  ADD COLUMN IF NOT EXISTS bir_registration_link TEXT;
