-- Phase 2: separate Purchase Order records with their own approval workflow.
--
-- Reverses the "approved quotation == PO" model. An approved quotation is
-- re-opened when the client provides their PO (client_po_number /
-- client_confirmed_at), then explicitly "Converted to Purchase Order": a
-- snapshot purchase_orders row is created and run through po_approvals using
-- the same >=3M role thresholds as quotations. Once the PO is fully approved
-- the source quotation is hidden from the Quotation module (converted_po_id)
-- and the PO appears in the Purchase Order module.

-- 1. Quotations: track the client's PO + the conversion link.
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS client_po_number    TEXT,
  ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_po_id     UUID,
  ADD COLUMN IF NOT EXISTS po_converted_at     TIMESTAMPTZ;

-- 2. Purchase orders: approval lifecycle + snapshot of sales pricing.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS status               approval_status_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS client_po_number     TEXT,
  ADD COLUMN IF NOT EXISTS margin_percentage    NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS bank_percentage      NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS bank_amount          NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS sop_percentage       NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS sop_amount           NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS selling_amount       NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS payment_terms        TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms_custom TEXT,
  ADD COLUMN IF NOT EXISTS lead_time_days       INTEGER,
  ADD COLUMN IF NOT EXISTS approved_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at         TIMESTAMPTZ;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS requires_executive_approval BOOLEAN
    GENERATED ALWAYS AS (po_amount >= 3000000) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_converted_po_id_fkey'
  ) THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT quotations_converted_po_id_fkey
      FOREIGN KEY (converted_po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. PO approvals (mirrors quotation_approvals).
CREATE TABLE IF NOT EXISTS public.po_approvals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id            UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  approver_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approver_role    user_role_enum NOT NULL,
  status           approval_status_enum NOT NULL DEFAULT 'pending',
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (po_id, approver_id)
);
CREATE INDEX IF NOT EXISTS idx_po_approvals_po_id ON public.po_approvals(po_id);

-- 4. PO-based collections (existing po_id -> quotations rows stay valid).
ALTER TABLE public.po_payments
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_po_payments_purchase_order_id ON public.po_payments(purchase_order_id);

-- 5. RLS for po_approvals.
ALTER TABLE public.po_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_po_approvals_sales_all" ON public.po_approvals;
CREATE POLICY "sales_po_approvals_sales_all" ON public.po_approvals FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE));

DROP POLICY IF EXISTS "po_approvals_approver_select_own" ON public.po_approvals;
CREATE POLICY "po_approvals_approver_select_own" ON public.po_approvals FOR SELECT
  USING (approver_id = auth.uid());

DROP POLICY IF EXISTS "po_approvals_approver_update_own" ON public.po_approvals;
CREATE POLICY "po_approvals_approver_update_own" ON public.po_approvals FOR UPDATE
  USING (approver_id = auth.uid()) WITH CHECK (approver_id = auth.uid());

DROP POLICY IF EXISTS "po_approvals_executive_select" ON public.po_approvals;
CREATE POLICY "po_approvals_executive_select" ON public.po_approvals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = 'executive' AND p.role IN ('owner','executive') AND p.is_active = TRUE));

-- 6. Executive access on purchase_orders (sales already has ALL).
DROP POLICY IF EXISTS "po_executive_select" ON public.purchase_orders;
CREATE POLICY "po_executive_select" ON public.purchase_orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = 'executive' AND p.role IN ('owner','executive') AND p.is_active = TRUE));

DROP POLICY IF EXISTS "po_executive_update" ON public.purchase_orders;
CREATE POLICY "po_executive_update" ON public.purchase_orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = 'executive' AND p.role IN ('owner','executive') AND p.is_active = TRUE));

-- 7. Audit + updated_at triggers for po_approvals.
DROP TRIGGER IF EXISTS trg_audit_po_approvals ON public.po_approvals;
CREATE TRIGGER trg_audit_po_approvals
  AFTER INSERT OR UPDATE OR DELETE ON public.po_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_updated_at_po_approvals ON public.po_approvals;
CREATE TRIGGER trg_updated_at_po_approvals
  BEFORE UPDATE ON public.po_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
