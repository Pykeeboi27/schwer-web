-- Sales quotas become annual instead of monthly.
--
-- Existing monthly rows are collapsed into one row per (profile_id, year)
-- whose quota_amount is the SUM of that year's monthly quotas — the closest
-- annual equivalent of what was already assigned. The most recently updated
-- monthly row survives as the annual row (keeping its set_by/created_at);
-- the rest are deleted. Dropping `month` also drops the old
-- UNIQUE (profile_id, year, month), replaced by UNIQUE (profile_id, year) so
-- the plain `ON CONFLICT (profile_id, year)` upsert in
-- lib/executive/quotas.ts keeps working.

BEGIN;

WITH ranked AS (
  SELECT
    id,
    SUM(quota_amount) OVER (PARTITION BY profile_id, year) AS annual_amount,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, year
      ORDER BY updated_at DESC, month DESC
    ) AS rn
  FROM public.sales_quotas
)
UPDATE public.sales_quotas q
SET quota_amount = r.annual_amount
FROM ranked r
WHERE q.id = r.id AND r.rn = 1;

DELETE FROM public.sales_quotas q
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, year
      ORDER BY updated_at DESC, month DESC
    ) AS rn
  FROM public.sales_quotas
) r
WHERE q.id = r.id AND r.rn > 1;

ALTER TABLE public.sales_quotas DROP COLUMN month;

ALTER TABLE public.sales_quotas
  ADD CONSTRAINT sales_quotas_profile_id_year_key UNIQUE (profile_id, year);

COMMIT;
