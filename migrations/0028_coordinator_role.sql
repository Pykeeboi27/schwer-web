-- Adds the 'coordinator' role, which will be the only role permitted to
-- create/delete manually-encoded purchase orders (see migration 0029).
--
-- Deliberately NOT wrapped in BEGIN/COMMIT, and deliberately its own
-- migration: PostgreSQL will not let a newly added enum value be referenced
-- by other statements in the same transaction that added it. Any statement
-- that uses 'coordinator' (e.g. the RPC updates in 0029) must run in a
-- later, separate transaction after this one has committed.
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'coordinator';
