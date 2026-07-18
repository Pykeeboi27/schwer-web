-- New enum values feeding engineering-module notifications (see migration
-- 0013 for the trigger that uses them). Kept in its own migration, isolated
-- from any statement that references the new values, matching
-- 0005_quotations_closed_status.sql's ALTER TYPE ADD VALUE pattern --
-- Postgres won't let a new enum label be used in the same transaction that
-- added it.

ALTER TYPE public.notification_section_enum ADD VALUE IF NOT EXISTS 'engineering_quotations';

ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'costing_quotation_received';
ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'costing_quotation_returned';
