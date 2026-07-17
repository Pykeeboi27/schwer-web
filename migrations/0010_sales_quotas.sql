-- Adds per-salesperson monthly quotas for the executive "Quotas" tab.
--
-- Distinct from revenue_targets (company/sector-wide, annual+quarterly):
-- sales_quotas tracks a peso target per profile per month, so an individual
-- sales_staff/sales_manager can be assigned a goal and see their own progress.
--
-- profile_id/year/month are all NOT NULL, so a plain
-- `ON CONFLICT (profile_id, year, month)` upsert works, unlike revenue_targets'
-- nullable-column unique constraint (see lib/executive/targets.ts).

BEGIN;

CREATE TABLE public.sales_quotas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  quota_amount  NUMERIC(15, 2) NOT NULL,
  set_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, year, month)
);
CREATE INDEX idx_sales_quotas_profile ON public.sales_quotas(profile_id);

CREATE TRIGGER trg_audit_sales_quotas
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_quotas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_updated_at_sales_quotas
  BEFORE UPDATE ON public.sales_quotas
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.sales_quotas ENABLE ROW LEVEL SECURITY;

-- The quota holder can read their own row; owner/executive can read every row
-- and are the only ones who can write.
CREATE POLICY "sales_quotas_self_or_exec_read"
  ON public.sales_quotas FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = TRUE
        AND (p.is_executive_viewer = TRUE OR p.role IN ('owner','executive'))
    )
  );

CREATE POLICY "sales_quotas_target_editor_insert"
  ON public.sales_quotas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'executive') AND p.is_active = TRUE
    )
  );

CREATE POLICY "sales_quotas_target_editor_update"
  ON public.sales_quotas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'executive') AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'executive') AND p.is_active = TRUE
    )
  );

COMMIT;
