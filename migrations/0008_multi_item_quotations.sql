-- Multi-item Request for Quotation flow.
--
-- Quotations and purchase orders were single-item/single-amount rows. Sales
-- now raises a "Request for Quotation" with N line items (description +
-- quantity, no cost); Engineering fills in unit_cost per line before
-- submitting for costing approval. quotations.cost becomes an aggregate
-- (rolled up by trigger, since a child-table sum can't be a GENERATED
-- column). quotations.amount / purchase_orders.po_amount stay scalars set
-- once in the sales phase, so the >=3M executive-approval threshold
-- (requires_executive_approval, requiredApproverRolesForAmount) is
-- unaffected.

BEGIN;

-- 1. quotation_items — line items on a quotation, costed by Engineering.
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     NUMERIC(15, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost    NUMERIC(15, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  line_total   NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost, 0)) STORED,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items(quotation_id);

DROP TRIGGER IF EXISTS trg_updated_at_quotation_items ON public.quotation_items;
CREATE TRIGGER trg_updated_at_quotation_items
  BEFORE UPDATE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_quotation_items ON public.quotation_items;
CREATE TRIGGER trg_audit_quotation_items
  AFTER INSERT OR UPDATE OR DELETE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- 2. purchase_order_items — snapshot copied from quotation_items on PO
-- conversion (same "PO snapshots quotation pricing" pattern as the scalar
-- columns on purchase_orders).
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  quantity          NUMERIC(15, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost         NUMERIC(15, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  line_total        NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost, 0)) STORED,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON public.purchase_order_items(purchase_order_id);

DROP TRIGGER IF EXISTS trg_audit_purchase_order_items ON public.purchase_order_items;
CREATE TRIGGER trg_audit_purchase_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- 3. Roll up quotations.cost = SUM(quotation_items.line_total) whenever items
-- change. NULL while the quotation has no items yet (matches the prior
-- "cost IS NULL until costed" semantics used by submitCostingForApproval).
CREATE OR REPLACE FUNCTION public.fn_sync_quotation_cost_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qid UUID;
BEGIN
  qid := COALESCE(NEW.quotation_id, OLD.quotation_id);

  UPDATE public.quotations
  SET cost = (
        SELECT SUM(qi.line_total) FROM public.quotation_items qi WHERE qi.quotation_id = qid
      ),
      updated_at = NOW()
  WHERE id = qid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quotation_cost_from_items ON public.quotation_items;
CREATE TRIGGER trg_sync_quotation_cost_from_items
AFTER INSERT OR UPDATE OR DELETE ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_quotation_cost_from_items();

-- 4. RLS.
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Sales: full access to items on quotations they can already reach — their
-- own costing-phase RFQ (prepared_by = self) or any sales-phase quotation
-- (mirrors sales_quotations_sales_all).
DROP POLICY IF EXISTS "quotation_items_sales_all" ON public.quotation_items;
CREATE POLICY "quotation_items_sales_all"
  ON public.quotation_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND p.department = 'sales' AND p.is_active = TRUE
        AND (q.phase = 'sales' OR (q.phase = 'costing' AND q.prepared_by = auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND p.department = 'sales' AND p.is_active = TRUE
        AND (q.phase = 'sales' OR (q.phase = 'costing' AND q.prepared_by = auth.uid()))
    )
  );

-- Engineering: full access (set unit_cost) on costing-phase quotations,
-- regardless of who raised the RFQ (mirrors eng_quotations_eng_all).
DROP POLICY IF EXISTS "quotation_items_engineering_all" ON public.quotation_items;
CREATE POLICY "quotation_items_engineering_all"
  ON public.quotation_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND q.phase = 'costing'
        AND p.department = 'engineering' AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND q.phase = 'costing'
        AND p.department = 'engineering' AND p.is_active = TRUE
    )
  );

-- Executive: read items while reviewing a costing submission (mirrors
-- eng_quotations_executive_costing_select) and on high-value sales-phase
-- quotations (mirrors sales_quotations_executive_high_value_select).
DROP POLICY IF EXISTS "quotation_items_executive_costing_select" ON public.quotation_items;
CREATE POLICY "quotation_items_executive_costing_select"
  ON public.quotation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND q.phase = 'costing'
        AND p.department = 'executive' AND p.role = 'executive' AND p.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "quotation_items_executive_high_value_select" ON public.quotation_items;
CREATE POLICY "quotation_items_executive_high_value_select"
  ON public.quotation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE q.id = quotation_items.quotation_id
        AND q.amount >= 3000000
        AND p.department = 'executive' AND p.role IN ('owner', 'executive') AND p.is_active = TRUE
    )
  );

-- Approvers (sales_manager/owner/executive assigned in quotation_approvals):
-- read items on quotations they're approving (mirrors sales_quotations_approver_select).
DROP POLICY IF EXISTS "quotation_items_approver_select" ON public.quotation_items;
CREATE POLICY "quotation_items_approver_select"
  ON public.quotation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = quotation_items.quotation_id AND qa.approver_id = auth.uid()
    )
  );

-- purchase_order_items: same broad-access shape as po_payments/po_approvals.
DROP POLICY IF EXISTS "purchase_order_items_sales_all" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items_sales_all"
  ON public.purchase_order_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE)
  );

DROP POLICY IF EXISTS "purchase_order_items_executive_select" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items_executive_select"
  ON public.purchase_order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = 'executive' AND p.role IN ('owner', 'executive') AND p.is_active = TRUE)
  );

DROP POLICY IF EXISTS "purchase_order_items_approver_select" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items_approver_select"
  ON public.purchase_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = purchase_order_items.purchase_order_id AND pa.approver_id = auth.uid()
    )
  );

COMMIT;
