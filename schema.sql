-- ============================================================
-- SUPABASE POSTGRESQL SCHEMA
-- ERP System: Sales, Executive Dashboard
-- Includes: Audit History, RLS-ready, Google OAuth compatible
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role_enum AS ENUM (
  'owner',
  'executive',
  'sales_manager',
  'sales_staff',
  'hr_staff',
  'hr_manager',
  'accountant',
  'accounting_manager',
  'engineer',
  'purchasing_staff',
  'viewer'
);

CREATE TYPE department_enum AS ENUM (
  'hr',
  'sales',
  'accounting',
  'engineering',
  'purchasing',
  'executive'
);

CREATE TYPE sector_enum AS ENUM (
  'commercial',
  'industrial',
  'solar'
);

CREATE TYPE approval_status_enum AS ENUM (
  'draft',
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'closed'
);

CREATE TYPE payment_status_enum AS ENUM (
  'unpaid',
  'partial',
  'paid',
  'overdue'
);

CREATE TYPE quotation_phase_enum AS ENUM (
  'costing',
  'sales'
);

CREATE TYPE notification_type_enum AS ENUM (
  'quotation_approval_requested',
  'quotation_approved',
  'quotation_rejected',
  'po_approval_requested',
  'po_approved',
  'po_rejected',
  'costing_approval_requested',
  'costing_approved',
  'costing_rejected',
  -- Added by migration 0012 for the engineering module (no per-user
  -- assignment column there -- lib/engineering/access.ts gates purely on
  -- department='engineering', so these broadcast department-wide).
  'costing_quotation_received',
  'costing_quotation_returned',
  -- Added by migration 0014/0015: an engineer updated item unit costs on a
  -- costing quotation, notifying the RFQ's preparer. Created via an RPC
  -- (fn_notify_costing_cost_updated), not a trigger -- see that function.
  'costing_cost_updated',
  -- Added by migration 0016/0017: symmetric with costing_quotation_returned --
  -- engineering is notified when costing is approved too, not just rejected.
  'costing_quotation_approved'
);

-- One section per nav tab that can show an "unseen changes" dot. Sales-phase
-- quotation outcomes surface on the Quotations tab; costing outcomes surface
-- on Request for Quotation, since that's where a preparer tracks their
-- costing-phase items (lib/sales/quotations.ts's costing list is filtered to
-- phase='costing' AND prepared_by = current user, shown on that tab, not the
-- Quotations tab which is phase='sales' only).
CREATE TYPE notification_section_enum AS ENUM (
  'request_for_quotation',
  'quotations',
  'purchase_orders',
  'approvals',
  'costing_approvals',
  -- Added by migration 0012, for the Engineering module's Quotations tab.
  'engineering_quotations'
);


-- ============================================================
-- SECTION 1: USER PROFILES & ROLES
-- Extends Supabase auth.users (Google OAuth compatible)
-- ============================================================

CREATE TABLE public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL UNIQUE,
  full_name           TEXT,
  avatar_url          TEXT,
  phone               TEXT,
  department          department_enum,
  role                user_role_enum NOT NULL DEFAULT 'viewer',
  is_executive_viewer BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.profiles.is_executive_viewer IS 'Only 2 users max should have this set to TRUE (top management dashboard access)';


-- ============================================================
-- SECTION 2: AUDIT / CHANGE HISTORY
-- ============================================================

CREATE TABLE public.audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  table_name    TEXT NOT NULL,
  record_id     UUID NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data      JSONB,
  new_data      JSONB,
  changed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    INET,
  notes         TEXT
);

CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_changed_by   ON public.audit_logs(changed_by);
CREATE INDEX idx_audit_logs_changed_at   ON public.audit_logs(changed_at DESC);

CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(table_name, record_id, action, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NULL, row_to_json(NEW)::JSONB);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs(table_name, record_id, action, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(table_name, record_id, action, old_data, new_data)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::JSONB, NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_department TEXT;
BEGIN
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Cannot create profile for user %: email is required', NEW.id;
  END IF;

  raw_department := NEW.raw_user_meta_data ->> 'department';

  INSERT INTO public.profiles (id, email, department)
  VALUES (
    NEW.id,
    NEW.email,
    CASE
      WHEN raw_department IN ('hr', 'sales', 'accounting', 'engineering', 'purchasing', 'executive')
        THEN raw_department::department_enum
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        department = COALESCE(public.profiles.department, EXCLUDED.department);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_profiles_department_set_once()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.department IS NOT NULL AND NEW.department IS DISTINCT FROM OLD.department THEN
    RAISE EXCEPTION 'Department cannot be changed once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- SECTION 3: CLIENTS (Sales Module)
-- ============================================================

CREATE TABLE public.clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id       UUID,
  client_code         TEXT UNIQUE NOT NULL,
  code                TEXT GENERATED ALWAYS AS (client_code) STORED,
  company_name        TEXT NOT NULL,
  name                TEXT GENERATED ALWAYS AS (company_name) STORED,
  contact_person      TEXT,
  email               TEXT,
  phone               TEXT,
  sector              sector_enum NOT NULL,
  address             TEXT,
  city                TEXT,
  province            TEXT,
  country             TEXT DEFAULT 'Philippines',
  website             TEXT,
  tin                 TEXT,
  bir_registration_link TEXT,
  payment_terms_days  INTEGER NOT NULL DEFAULT 30,
  credit_limit        NUMERIC(15, 2),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes               TEXT,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_sector    ON public.clients(sector);
CREATE INDEX idx_clients_is_active ON public.clients(is_active);
CREATE UNIQUE INDEX idx_clients_code_unique ON public.clients(code);

CREATE TABLE public.client_contacts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  position     TEXT,
  email        TEXT,
  phone        TEXT,
  mobile       TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SECTION 4: SALES MODULE — QUOTATIONS & POs
-- ============================================================

CREATE TABLE public.quotations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id       UUID,
  quotation_number    TEXT UNIQUE NOT NULL,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  sector              sector_enum NOT NULL,
  subject             TEXT NOT NULL,
  description         TEXT,
  -- `amount` holds the selling amount. During the costing phase it stays 0;
  -- the sales phase sets it to the computed selling_amount.
  amount              NUMERIC(15, 2) NOT NULL DEFAULT 0,
  cost                NUMERIC(15, 2),
  -- Input-driven sales pricing (Phase 1). *_amount fields are computed on the
  -- frontend from `cost` (direct cost) and the corresponding percentage:
  --   margin_amount  = cost * margin_percentage / 100
  --   bank_amount    = cost * bank_percentage   / 100
  --   sop_amount     = cost * sop_percentage    / 100
  --   selling_amount = cost + margin_amount + bank_amount + sop_amount  (== amount)
  margin_percentage   NUMERIC(6, 2),
  margin_amount       NUMERIC(15, 2),
  bank_percentage     NUMERIC(6, 2),
  bank_amount         NUMERIC(15, 2),
  sop_percentage      NUMERIC(6, 2),
  sop_amount          NUMERIC(15, 2),
  selling_amount      NUMERIC(15, 2),
  margin_percent      NUMERIC(6, 2) GENERATED ALWAYS AS (
                        CASE WHEN amount > 0 THEN ((amount - COALESCE(cost, 0)) / amount) * 100 ELSE 0 END
                      ) STORED,
  requires_executive_approval BOOLEAN GENERATED ALWAYS AS (amount >= 3000000) STORED,
  status              approval_status_enum NOT NULL DEFAULT 'draft',
  phase               quotation_phase_enum NOT NULL DEFAULT 'sales',
  google_drive_link   TEXT,
  costing_rejection_reason TEXT,
  costing_approved_at TIMESTAMPTZ,
  sales_person_id     UUID REFERENCES public.profiles(id),
  sales_margin_percent NUMERIC(6, 2),
  payment_terms       TEXT,
  payment_terms_custom TEXT,
  lead_time_days      INTEGER,
  approved_at         TIMESTAMPTZ,
  recognized_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_status      payment_status_enum NOT NULL DEFAULT 'unpaid',
  approval_chain      JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason    TEXT,
  submitted_at        TIMESTAMPTZ,
  valid_until         DATE,
  notes               TEXT,
  prepared_by         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by          UUID GENERATED ALWAYS AS (prepared_by) STORED,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotations_client ON public.quotations(client_id);
CREATE INDEX idx_quotations_status ON public.quotations(status);
CREATE INDEX idx_quotations_sales_person ON public.quotations(sales_person_id);

CREATE TABLE public.quotation_approvals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id     UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  approver_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by      UUID GENERATED ALWAYS AS (approver_id) STORED,
  approver_role    user_role_enum NOT NULL,
  role             user_role_enum GENERATED ALWAYS AS (approver_role) STORED,
  approval_order   INTEGER NOT NULL DEFAULT 1,
  status           approval_status_enum NOT NULL DEFAULT 'pending',
  action           TEXT GENERATED ALWAYS AS (
                     CASE
                       WHEN status = 'approved' THEN 'approved'
                       WHEN status = 'rejected' THEN 'rejected'
                       ELSE NULL
                     END
                   ) STORED,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  reason           TEXT GENERATED ALWAYS AS (rejection_reason) STORED,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quotation_id, approver_id)
);

-- Approved quotations are the canonical purchase-order record.
-- Payments hang off quotations via po_payments.po_id (kept for column-name continuity;
-- it now references quotations.id).

CREATE TABLE public.po_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id            UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  amount_collected NUMERIC(15, 2) NOT NULL,
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method   TEXT,
  reference_number TEXT,
  notes            TEXT,
  recorded_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_payments_po_id ON public.po_payments(po_id);

-- PO-based collections (Phase 2). New collections set purchase_order_id; the
-- legacy po_id (-> quotations) is retained for the rows recorded before POs
-- became separate records.
ALTER TABLE public.po_payments
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_po_payments_purchase_order_id ON public.po_payments(purchase_order_id);

-- Proof of payment (see migrations/0023_po_payments_proof_of_payment.sql).
-- Points at an object in the private `payment-proofs` Storage bucket, at
-- path `${auth.uid()}/${purchaseOrderId}/${uuid}.webp`. Nullable at the DB
-- level (legacy rows have none); required-for-new-collections is enforced
-- in the app layer, not here.
ALTER TABLE public.po_payments
  ADD COLUMN IF NOT EXISTS proof_path TEXT;


-- ============================================================
-- SECTION 4b: PURCHASE ORDERS (Phase 2 — separate PO records)
-- ============================================================
-- An approved quotation is re-opened when the client provides their PO, then
-- explicitly converted into a purchase_orders row that runs through po_approvals
-- (same >=3M role thresholds as quotations). See migration 0002.

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number           TEXT UNIQUE NOT NULL,
  quotation_id        UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  sector              sector_enum NOT NULL,
  subject             TEXT NOT NULL,
  po_amount           NUMERIC(15, 2) NOT NULL,
  cost                NUMERIC(15, 2),
  margin_amount       NUMERIC(15, 2),
  margin_percent      NUMERIC(6, 2) GENERATED ALWAYS AS (
                        CASE WHEN po_amount > 0 THEN ((po_amount - COALESCE(cost, 0)) / po_amount) * 100 ELSE 0 END
                      ) STORED,
  recognized_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_terms_days  INTEGER NOT NULL DEFAULT 30,
  payment_status      payment_status_enum NOT NULL DEFAULT 'unpaid',
  po_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_completion DATE,
  notes               TEXT,
  created_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Phase 2 additions: approval lifecycle + sales pricing snapshot.
  status               approval_status_enum NOT NULL DEFAULT 'pending',
  client_po_number     TEXT,
  -- Free-text reference (e.g. internal project code, or original quotation
  -- number for manually created POs not linked via converted_po_id).
  quotation_reference  TEXT,
  margin_percentage    NUMERIC(6, 2),
  bank_percentage      NUMERIC(6, 2),
  bank_amount          NUMERIC(15, 2),
  sop_percentage       NUMERIC(6, 2),
  sop_amount           NUMERIC(15, 2),
  selling_amount       NUMERIC(15, 2),
  payment_terms        TEXT,
  payment_terms_custom TEXT,
  lead_time_days       INTEGER,
  approved_at          TIMESTAMPTZ,
  submitted_at         TIMESTAMPTZ,
  requires_executive_approval BOOLEAN GENERATED ALWAYS AS (po_amount >= 3000000) STORED
);

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

-- Quotation -> PO conversion bookkeeping.
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS client_po_number    TEXT,
  ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_po_id     UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS po_converted_at     TIMESTAMPTZ;

-- Per-item Sales Margin/Bank/SOP pricing (migration 0020). Sales can price
-- each quotation_items/purchase_order_items row individually instead of one
-- shared percentage for the whole record; has_unequal_margins records
-- whether the record is using per-item percentages or one shared value
-- broadcast to every item. The *_amount/percentage columns on the item
-- tables are plain (not GENERATED — they'd need to reference the already-
-- GENERATED line_total column, which Postgres disallows) and are written
-- app-side by lib/sales/pricing.ts, same as the record-level columns below.
-- quotation_items and purchase_order_items themselves are created by
-- migration 0008 (multi-item quotations), not inline in this file.
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS has_unequal_margins BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS has_unequal_margins BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS margin_amount     NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS bank_percentage   NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS bank_amount       NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS sop_percentage    NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS sop_amount        NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS selling_amount    NUMERIC(15, 2);

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS margin_amount     NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS bank_percentage   NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS bank_amount       NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS sop_percentage    NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS sop_amount        NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS selling_amount    NUMERIC(15, 2);

-- Exact-decimal landed unit cost (migration 0024). The source Excel costing
-- template never has Engineering type the final per-unit cost directly: they
-- type a clean 2-decimal raw material+labor figure, and the sheet
-- automatically applies a fixed +3% OPEX loading then a fixed +1.5% delivery
-- fee (Q = P*1.03, R = Q*1.015), carrying that full-precision result into the
-- line total and rounding only once, for display. raw_cost is that new input
-- column; line_total is redefined to compute straight from
-- raw_cost * 1.03 * 1.015 * quantity (Postgres NUMERIC arithmetic is exact
-- decimal, reproducing Excel's total to the centavo) when raw_cost is set,
-- falling back to the pre-existing quantity * unit_cost behavior otherwise --
-- every row from before this migration has raw_cost NULL, so nothing about
-- their stored total changes. unit_cost remains a plain column: for new
-- items it's now the *display* landed cost (computed app-side by
-- lib/engineering/costing-quotations.ts::computeLandedUnitCost) but no
-- longer participates in computing line_total once raw_cost is present.
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS raw_cost NUMERIC(15, 2) CHECK (raw_cost IS NULL OR raw_cost >= 0);
ALTER TABLE public.quotation_items DROP COLUMN IF EXISTS line_total;
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15, 2)
  GENERATED ALWAYS AS (
    quantity * CASE
      WHEN raw_cost IS NOT NULL THEN raw_cost * 1.03 * 1.015
      ELSE COALESCE(unit_cost, 0)
    END
  ) STORED;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS raw_cost NUMERIC(15, 2) CHECK (raw_cost IS NULL OR raw_cost >= 0);
ALTER TABLE public.purchase_order_items DROP COLUMN IF EXISTS line_total;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15, 2)
  GENERATED ALWAYS AS (
    quantity * CASE
      WHEN raw_cost IS NOT NULL THEN raw_cost * 1.03 * 1.015
      ELSE COALESCE(unit_cost, 0)
    END
  ) STORED;


-- ============================================================
-- SECTION 5: EXECUTIVE DASHBOARD — TARGETS
-- ============================================================

CREATE TABLE public.revenue_targets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year            INTEGER NOT NULL,
  month           INTEGER CHECK (month BETWEEN 1 AND 12),
  target_amount   NUMERIC(15, 2) NOT NULL,
  sector          sector_enum,
  set_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month, sector)
);

-- Per-salesperson annual quota, distinct from the company/sector-wide
-- revenue_targets above. profile_id/year are NOT NULL, so (unlike
-- revenue_targets) a plain `ON CONFLICT (profile_id, year)` upsert
-- works without the read-update-delete dance in lib/executive/targets.ts.
CREATE TABLE public.sales_quotas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year          INTEGER NOT NULL,
  quota_amount  NUMERIC(15, 2) NOT NULL,
  set_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, year)
);
CREATE INDEX idx_sales_quotas_profile ON public.sales_quotas(profile_id);


-- ============================================================
-- SECTION 6: AUDIT TRIGGERS
-- ============================================================

CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_audit_quotations
  AFTER INSERT OR UPDATE OR DELETE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_audit_quotation_approvals
  AFTER INSERT OR UPDATE OR DELETE ON public.quotation_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_audit_po_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.po_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_audit_revenue_targets
  AFTER INSERT OR UPDATE OR DELETE ON public.revenue_targets
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER trg_audit_sales_quotas
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_quotas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();


-- ============================================================
-- SECTION 7: UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER trg_updated_at_profiles            BEFORE UPDATE ON public.profiles            FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_profiles_department_set_once   BEFORE UPDATE OF department ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_department_set_once();
CREATE TRIGGER trg_updated_at_clients             BEFORE UPDATE ON public.clients             FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_client_contacts     BEFORE UPDATE ON public.client_contacts     FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_quotations          BEFORE UPDATE ON public.quotations          FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_quotation_approvals BEFORE UPDATE ON public.quotation_approvals FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_po_payments         BEFORE UPDATE ON public.po_payments         FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_revenue_targets     BEFORE UPDATE ON public.revenue_targets     FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_sales_quotas        BEFORE UPDATE ON public.sales_quotas        FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- ============================================================
-- SECTION 8: DASHBOARD HELPER VIEWS & FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_refresh_quotation_payment_totals(target_quotation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC(15, 2);
  v_collected_total NUMERIC(15, 2);
BEGIN
  IF target_quotation_id IS NULL THEN RETURN; END IF;

  SELECT amount INTO v_amount
  FROM public.quotations WHERE id = target_quotation_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount_collected), 0) INTO v_collected_total
  FROM public.po_payments WHERE po_id = target_quotation_id;

  IF v_collected_total > v_amount THEN
    RAISE EXCEPTION
      'Collected amount (%.2f) exceeds quotation amount (%.2f) for quotation %',
      v_collected_total, v_amount, target_quotation_id
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.quotations
  SET recognized_amount = v_collected_total,
      payment_status = CASE
        WHEN v_collected_total = 0         THEN 'unpaid'::payment_status_enum
        WHEN v_collected_total < v_amount  THEN 'partial'::payment_status_enum
        ELSE 'paid'::payment_status_enum
      END,
      updated_at = NOW()
  WHERE id = target_quotation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_quotation_totals_from_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_refresh_quotation_payment_totals(COALESCE(NEW.po_id, OLD.po_id));
  IF TG_OP = 'UPDATE' AND NEW.po_id IS DISTINCT FROM OLD.po_id THEN
    PERFORM public.fn_refresh_quotation_payment_totals(OLD.po_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quotation_totals_from_payments ON public.po_payments;
CREATE TRIGGER trg_sync_quotation_totals_from_payments
AFTER INSERT OR UPDATE OR DELETE ON public.po_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_quotation_totals_from_payments();

-- Also drives the sequential approval chain: sales_manager -> executive ->
-- owner (amount >= 3,000,000 only; below that, sales_manager is terminal).
-- The app only ever seeds the sales_manager row at submission
-- (lib/sales/quotations.ts, submitQuotationForApproval); this function opens
-- each subsequent stage once the prior one is approved, so a role never sees
-- an item in its approval queue before its turn. The chain order and 3M
-- threshold are intentionally duplicated in lib/sales/quotations.ts
-- (requiredApproverRolesForAmount / approvalChainForAmount / nextApproverRole)
-- for stage-1 seeding and UI display; keep both in sync if either changes.
CREATE OR REPLACE FUNCTION public.fn_sync_quotation_status_from_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qid UUID;
  v_amount NUMERIC;
  v_next user_role_enum;
BEGIN
  qid := COALESCE(NEW.quotation_id, OLD.quotation_id);

  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.quotation_approvals
    SET status = 'cancelled', updated_at = NOW()
    WHERE quotation_id = qid
      AND approver_role = NEW.approver_role
      AND status = 'pending'
      AND id <> NEW.id;

    -- Sequential chain: sales_manager -> executive -> owner (owner only for
    -- amount >= 3,000,000; below that, sales_manager approval is terminal).
    -- Open the next stage here, inside the same trigger invocation, so the
    -- status recompute below always sees a fresh pending row for a
    -- not-yet-complete chain instead of transiently observing "no pending
    -- rows" and marking the quotation approved early.
    SELECT amount INTO v_amount FROM public.quotations WHERE id = qid;
    v_next := CASE NEW.approver_role
      WHEN 'sales_manager' THEN
        CASE WHEN v_amount >= 3000000 THEN 'executive'::user_role_enum ELSE NULL END
      WHEN 'executive' THEN 'owner'::user_role_enum
      ELSE NULL -- owner is terminal
    END;

    IF v_next IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.quotation_approvals
         WHERE quotation_id = qid AND approver_role = v_next
       ) THEN
      INSERT INTO public.quotation_approvals (quotation_id, approver_id, approver_role, status)
      SELECT qid, p.id, v_next, 'pending'
      FROM public.profiles p
      WHERE p.role = v_next AND p.department = 'executive' AND p.is_active = TRUE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No active approver for role % on quotation %', v_next, qid;
      END IF;
    END IF;
  END IF;

  UPDATE public.quotations q
  SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'rejected'
    ) THEN 'rejected'::approval_status_enum
    WHEN EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'pending'
    ) THEN 'pending'::approval_status_enum
    WHEN EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'pending'
    ) THEN 'approved'::approval_status_enum
    ELSE 'pending'::approval_status_enum
  END,
  updated_at = NOW()
  WHERE q.id = qid;
  -- Note: unlike the PO version below, this does not stamp
  -- quotations.approved_at. That column exists but has never actually been
  -- written by this trigger in production; an approved_at CASE branch was
  -- drafted here at some point but never deployed, so this migration keeps
  -- schema.sql matching deployed reality rather than silently introducing
  -- that as a side effect of the approval-chain change.

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quotation_status_from_approvals ON public.quotation_approvals;
CREATE TRIGGER trg_sync_quotation_status_from_approvals
AFTER INSERT OR UPDATE OR DELETE ON public.quotation_approvals
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_quotation_status_from_approvals();

-- Mirrors fn_sync_quotation_status_from_approvals for purchase orders. Without
-- this, when a role (e.g. "executive") has more than one active approver, the
-- app fans out one po_approvals row per approver and nothing cancelled the
-- sibling pending rows once one of them approved — the aggregate (which
-- requires every row to be approved/cancelled) stayed "pending" forever.
-- Also mirrors the sequential chain-advancement behavior described above the
-- quotation version: the app seeds only the sales_manager po_approvals row on
-- conversion (lib/sales/purchase-orders.ts, convertQuotationToPurchaseOrder),
-- and this function opens each subsequent stage as the prior one is approved.
CREATE OR REPLACE FUNCTION public.fn_sync_po_status_from_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  v_amount NUMERIC;
  v_next user_role_enum;
BEGIN
  pid := COALESCE(NEW.po_id, OLD.po_id);

  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.po_approvals
    SET status = 'cancelled', updated_at = NOW()
    WHERE po_id = pid
      AND approver_role = NEW.approver_role
      AND status = 'pending'
      AND id <> NEW.id;

    -- Sequential chain: sales_manager -> executive -> owner (owner only for
    -- amount >= 3,000,000). See fn_sync_quotation_status_from_approvals for
    -- why the next stage is opened here rather than from the app session.
    SELECT po_amount INTO v_amount FROM public.purchase_orders WHERE id = pid;
    v_next := CASE NEW.approver_role
      WHEN 'sales_manager' THEN
        CASE WHEN v_amount >= 3000000 THEN 'executive'::user_role_enum ELSE NULL END
      WHEN 'executive' THEN 'owner'::user_role_enum
      ELSE NULL -- owner is terminal
    END;

    IF v_next IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.po_approvals
         WHERE po_id = pid AND approver_role = v_next
       ) THEN
      INSERT INTO public.po_approvals (po_id, approver_id, approver_role, status)
      SELECT pid, p.id, v_next, 'pending'
      FROM public.profiles p
      WHERE p.role = v_next AND p.department = 'executive' AND p.is_active = TRUE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No active approver for role % on purchase order %', v_next, pid;
      END IF;
    END IF;
  END IF;

  UPDATE public.purchase_orders p
  SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'rejected'
    ) THEN 'rejected'::approval_status_enum
    WHEN EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'pending'
    ) THEN 'pending'::approval_status_enum
    WHEN EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'pending'
    ) THEN 'approved'::approval_status_enum
    ELSE p.status
  END,
  approved_at = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.po_approvals pa
      WHERE pa.po_id = pid AND pa.status IN ('pending', 'rejected')
    ) THEN COALESCE(p.approved_at, NOW())
    ELSE NULL
  END,
  updated_at = NOW()
  WHERE p.id = pid
    AND p.status NOT IN ('draft', 'closed', 'cancelled');

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_po_status_from_approvals ON public.po_approvals;
CREATE TRIGGER trg_sync_po_status_from_approvals
AFTER INSERT OR UPDATE OR DELETE ON public.po_approvals
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_po_status_from_approvals();

-- Atomically resubmits a rejected quotation/PO: deletes the stale approval
-- row(s), seeds a fresh pending stage-one (sales_manager) approval, and flips
-- status back to 'pending' -- all in one transaction. Called via
-- supabase.rpc from lib/sales/quotations.ts resubmitQuotationForApproval /
-- lib/sales/purchase-orders.ts resubmitPurchaseOrderForApproval instead of
-- doing these as separate client calls, which could leave the record stuck
-- at status 'pending' with zero approval rows (invisible to any approver's
-- queue) if the insert step failed after the status flip and delete had
-- already committed. SECURITY DEFINER also sidesteps
-- sales_quotation_approvals_sales_delete_pending, whose USING clause only
-- covers a still-'pending'/still-'draft' row and can never match a rejected
-- one being resubmitted -- the same reason the sync triggers above run as
-- SECURITY DEFINER. See migrations/0025_atomic_quotation_po_resubmit.sql.
CREATE OR REPLACE FUNCTION public.fn_resubmit_quotation_for_approval(p_quotation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status approval_status_enum;
BEGIN
  SELECT status INTO v_status
  FROM public.quotations
  WHERE id = p_quotation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quotation not found.';
  END IF;

  IF v_status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected quotations can be resubmitted.';
  END IF;

  DELETE FROM public.quotation_approvals WHERE quotation_id = p_quotation_id;

  INSERT INTO public.quotation_approvals (quotation_id, approver_id, approver_role, status)
  SELECT p_quotation_id, p.id, 'sales_manager', 'pending'
  FROM public.profiles p
  WHERE p.role = 'sales_manager' AND p.department = 'sales' AND p.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active approver for role sales_manager on quotation %', p_quotation_id;
  END IF;

  UPDATE public.quotations
  SET status = 'pending', rejection_reason = NULL, submitted_at = NOW()
  WHERE id = p_quotation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resubmit_quotation_for_approval(UUID) TO authenticated;

-- Mirrors fn_resubmit_quotation_for_approval for purchase orders.
CREATE OR REPLACE FUNCTION public.fn_resubmit_po_for_approval(p_po_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status approval_status_enum;
BEGIN
  SELECT status INTO v_status
  FROM public.purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found.';
  END IF;

  IF v_status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected purchase orders can be resubmitted.';
  END IF;

  DELETE FROM public.po_approvals WHERE po_id = p_po_id;

  INSERT INTO public.po_approvals (po_id, approver_id, approver_role, status)
  SELECT p_po_id, p.id, 'sales_manager', 'pending'
  FROM public.profiles p
  WHERE p.role = 'sales_manager' AND p.department = 'sales' AND p.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active approver for role sales_manager on purchase order %', p_po_id;
  END IF;

  UPDATE public.purchase_orders
  SET status = 'pending', submitted_at = NOW()
  WHERE id = p_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resubmit_po_for_approval(UUID) TO authenticated;

-- ============================================================
-- SECTION 9: AUTH TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_auth_user();


-- ============================================================
-- SECTION 10: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_targets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotas        ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_self_read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_self_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'executive')
    )
  );

-- Audit logs: owners and executives only
CREATE POLICY "audit_logs_exec_read"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'executive')
    )
  );

-- Revenue targets
CREATE POLICY "revenue_targets_exec_only"
  ON public.revenue_targets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = TRUE
        AND (p.is_executive_viewer = TRUE OR p.role IN ('owner','executive'))
    )
  );

CREATE POLICY "revenue_targets_target_editor_insert"
  ON public.revenue_targets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'executive') AND p.is_active = TRUE
    )
  );

CREATE POLICY "revenue_targets_target_editor_update"
  ON public.revenue_targets FOR UPDATE
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

-- Sales quotas: the quota holder can read their own row; owner/executive can
-- read every row and are the only ones who can write.
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

-- Clients: Sales full access
CREATE POLICY "sales_clients_sales_all"
  ON public.clients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

-- Clients: Engineering read access (to select a client when starting a costing quotation)
CREATE POLICY "eng_clients_eng_select"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'engineering' AND p.is_active = TRUE
    )
  );

-- Client contacts: Sales full access
CREATE POLICY "sales_client_contacts_sales_all"
  ON public.client_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

-- Quotations: Sales full access (sales-phase rows only; costing-phase rows are
-- engineering's until handover)
CREATE POLICY "sales_quotations_sales_all"
  ON public.quotations FOR ALL
  USING (
    phase = 'sales'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    phase = 'sales'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

-- Quotations: Engineering full access on costing-phase rows
CREATE POLICY "eng_quotations_eng_all"
  ON public.quotations FOR ALL
  USING (
    phase = 'costing'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'engineering' AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    phase = 'costing'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'engineering' AND p.is_active = TRUE
    )
  );

-- Quotations: Executive (role='executive') can read all costing-phase rows
CREATE POLICY "eng_quotations_executive_costing_select"
  ON public.quotations FOR SELECT
  USING (
    phase = 'costing'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = 'executive'
        AND p.role = 'executive'
        AND p.is_active = TRUE
    )
  );

-- Quotations: Executive (role='executive') can update costing-phase rows (approve/reject).
-- Server actions enforce which columns may change; this policy only gates access.
CREATE POLICY "eng_quotations_executive_costing_update"
  ON public.quotations FOR UPDATE
  USING (
    phase = 'costing'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = 'executive'
        AND p.role = 'executive'
        AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = 'executive'
        AND p.role = 'executive'
        AND p.is_active = TRUE
    )
  );

-- Quotations: Executive (role='executive') can delete costing-phase rows (e.g. a
-- costing submission entered in error). Server actions restrict this to rows still
-- pending costing approval; this policy only gates access.
CREATE POLICY "eng_quotations_executive_costing_delete"
  ON public.quotations FOR DELETE
  USING (
    phase = 'costing'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = 'executive'
        AND p.role = 'executive'
        AND p.is_active = TRUE
    )
  );

CREATE POLICY "sales_quotations_approver_select"
  ON public.quotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = id AND qa.approver_id = auth.uid()
    )
  );

CREATE POLICY "sales_quotations_executive_high_value_select"
  ON public.quotations FOR SELECT
  USING (
    amount >= 3000000
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = 'executive'
        AND p.role IN ('owner', 'executive')
        AND p.is_active = TRUE
    )
  );

-- Executive tracking (migration 0021): unrestricted quotation visibility for the
-- Executive > Quotations tab, mirroring the already-unrestricted po_executive_select
-- on purchase_orders. Additive alongside the high-value policy above (RLS policies
-- for a command are OR'd). quotation_items needs no matching policy -- migration 0009
-- already delegates item visibility to "can you see the parent quotations row".
CREATE POLICY "quotations_executive_select_all"
  ON public.quotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = 'executive'
        AND p.role IN ('owner', 'executive')
        AND p.is_active = TRUE
    )
  );

-- Quotation approvals
CREATE POLICY "sales_quotation_approvals_sales_select"
  ON public.quotation_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

CREATE OR REPLACE FUNCTION public.fn_sales_can_assign_quotation_approver(
  target_approver_id UUID,
  target_role user_role_enum
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles caller
      WHERE caller.id = auth.uid()
        AND caller.department = 'sales'
        AND caller.is_active = TRUE
    )
    AND (
      (target_role = 'sales_manager' AND EXISTS (
        SELECT 1 FROM public.profiles a
        WHERE a.id = target_approver_id AND a.is_active = TRUE
          AND a.role = 'sales_manager' AND a.department = 'sales'
      ))
      OR
      (target_role = 'owner' AND EXISTS (
        SELECT 1 FROM public.profiles a
        WHERE a.id = target_approver_id AND a.is_active = TRUE
          AND a.role = 'owner' AND a.department = 'executive'
      ))
      OR
      (target_role = 'executive' AND EXISTS (
        SELECT 1 FROM public.profiles a
        WHERE a.id = target_approver_id AND a.is_active = TRUE
          AND a.role = 'executive' AND a.department = 'executive'
      ))
    );
$$;

DROP POLICY IF EXISTS "sales_quotation_approvals_sales_insert" ON public.quotation_approvals;
CREATE POLICY "sales_quotation_approvals_sales_insert"
  ON public.quotation_approvals FOR INSERT
  WITH CHECK (
    public.fn_sales_can_assign_quotation_approver(approver_id, approver_role)
    AND status = 'pending'
    AND approved_at IS NULL
    AND rejection_reason IS NULL
  );

DROP POLICY IF EXISTS "sales_quotation_approvals_sales_delete_pending" ON public.quotation_approvals;
CREATE POLICY "sales_quotation_approvals_sales_delete_pending"
  ON public.quotation_approvals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id AND q.status = 'draft'
    )
  );

CREATE POLICY "sales_quotation_approvals_approver_select_own"
  ON public.quotation_approvals FOR SELECT
  USING (approver_id = auth.uid());

CREATE POLICY "sales_quotation_approvals_visible_quotation_select"
  ON public.quotation_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
          )
          OR (
            q.amount >= 3000000
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.department = 'executive'
                AND p.role IN ('owner', 'executive')
                AND p.is_active = TRUE
            )
          )
          OR approver_id = auth.uid()
        )
    )
  );

CREATE POLICY "sales_quotation_approvals_approver_update_own"
  ON public.quotation_approvals FOR UPDATE
  USING (approver_id = auth.uid())
  WITH CHECK (approver_id = auth.uid());

-- PO payments: Sales full access
CREATE POLICY "sales_po_payments_sales_all"
  ON public.po_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

-- Proof of payment storage (see migrations/0023_po_payments_proof_of_payment.sql).
-- Private bucket; the anon/publishable key is the only key this project
-- uses, so these storage.objects policies are the sole line of defense.
-- Writes are scoped to the caller's own top-level folder
-- (payment-proofs/<auth.uid()>/...); reads are department-wide, mirroring
-- sales_po_payments_sales_all above.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "sales_payment_proofs_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

CREATE POLICY "sales_payment_proofs_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

CREATE POLICY "sales_payment_proofs_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  )
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

CREATE POLICY "sales_payment_proofs_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );


-- ============================================================
-- SECTION 10: NOTIFICATIONS
-- ============================================================
-- Persisted, per-user notification feed for the bell/dropdown, the full
-- notifications history page, and the small "unseen changes" dots on nav
-- tabs. See migrations/0011_notifications.sql for the introducing migration.
--
-- Notifications are created entirely by SECURITY DEFINER triggers (never by
-- application code) so every status-changing path is covered automatically,
-- mirroring fn_audit_trigger()/fn_set_updated_at() above.
--
-- Two independent "cleared" timestamps drive two different UI signals:
--   read_at  -> bell unread count; cleared when the user clicks that
--               notification, or visits that section's tab (app-level, via
--               markSectionRead()), even if the notification itself was
--               never opened.
--   seen_at  -> nav-tab dot; always cleared alongside read_at (read implies
--               seen, not the reverse) by the same markSectionRead() call.
--
-- Scope is strictly personal: an approver assigned via quotation_approvals/
-- po_approvals.approver_id, or the owner of a quotation/PO
-- (sales_person_id/prepared_by/created_by). Company-wide browse views never
-- generate notifications because nothing there fires these triggers.
--
-- Costing-phase quotations have no per-approver assignment row (any active
-- profile with role='executive' AND department='executive' can act, per
-- lib/executive/costing-approvals.ts assertExecutiveActor()), so the costing
-- "approval requested" notification fans out to every such profile instead of
-- a single recipient.

CREATE TABLE public.notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type         notification_type_enum NOT NULL,
  section      notification_section_enum NOT NULL,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('quotation', 'purchase_order')),
  entity_id    UUID NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT NOT NULL,
  read_at      TIMESTAMPTZ,
  seen_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bell dropdown / unread count.
CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications(recipient_id, created_at DESC) WHERE read_at IS NULL;
-- Nav-tab dot lookup.
CREATE INDEX idx_notifications_recipient_section_unseen
  ON public.notifications(recipient_id, section) WHERE seen_at IS NULL;
-- Full paginated history page.
CREATE INDEX idx_notifications_recipient_created
  ON public.notifications(recipient_id, created_at DESC);

CREATE TRIGGER trg_updated_at_notifications
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Deliberately NOT audited (unlike quotations/clients/etc.): notifications are
-- high-volume, derived, self-healing rows, not a source of truth worth a
-- second audit_logs copy.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_recipient_read"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Mark-read / mark-seen only; recipient may only ever touch their own rows,
-- and WITH CHECK keeps recipient_id from being reassigned. No INSERT/DELETE
-- policy exists, so clients can neither forge nor delete notifications --
-- only the SECURITY DEFINER trigger functions below (which bypass RLS) insert
-- rows.
CREATE POLICY "notifications_recipient_update"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- (a) A quotation approval was assigned to an approver -> notify them.
CREATE OR REPLACE FUNCTION public.fn_notify_quotation_approver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation RECORD;
  v_link TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT quotation_number, subject INTO v_quotation
  FROM public.quotations WHERE id = NEW.quotation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_link := CASE
    WHEN NEW.approver_role IN ('owner', 'executive') THEN '/protected/executive/approvals'
    ELSE '/protected/sales/approvals'
  END;

  IF NEW.approver_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
    VALUES (
      NEW.approver_id,
      auth.uid(),
      'quotation_approval_requested',
      'approvals',
      'quotation',
      NEW.quotation_id,
      'Quotation ' || v_quotation.quotation_number || ' needs your approval',
      v_quotation.subject,
      v_link
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_quotation_approver
  AFTER INSERT ON public.quotation_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_quotation_approver();

-- (b) A PO approval was assigned to an approver -> notify them.
CREATE OR REPLACE FUNCTION public.fn_notify_po_approver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po RECORD;
  v_link TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT po_number, subject INTO v_po
  FROM public.purchase_orders WHERE id = NEW.po_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_link := CASE
    WHEN NEW.approver_role IN ('owner', 'executive') THEN '/protected/executive/approvals'
    ELSE '/protected/sales/approvals'
  END;

  IF NEW.approver_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications
      (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
    VALUES (
      NEW.approver_id,
      auth.uid(),
      'po_approval_requested',
      'approvals',
      'purchase_order',
      NEW.po_id,
      'PO ' || v_po.po_number || ' needs your approval',
      v_po.subject,
      v_link
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_po_approver
  AFTER INSERT ON public.po_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_po_approver();

-- (c) A costing-phase quotation was submitted for costing approval (engineering
-- moves it draft -> pending while phase='costing') -> broadcast to every
-- active executive-department executive, since costing approval has no
-- per-approver assignment row.
CREATE OR REPLACE FUNCTION public.fn_notify_costing_approval_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient RECORD;
BEGIN
  IF NEW.phase = 'costing' AND NEW.status = 'pending' AND OLD.status = 'draft' THEN
    FOR v_recipient IN
      SELECT id FROM public.profiles
      WHERE department = 'executive' AND role = 'executive' AND is_active = TRUE
    LOOP
      IF v_recipient.id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notifications
          (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
        VALUES (
          v_recipient.id,
          auth.uid(),
          'costing_approval_requested',
          'costing_approvals',
          'quotation',
          NEW.id,
          'Quotation ' || NEW.quotation_number || ' needs costing approval',
          NEW.subject,
          '/protected/executive/costing-approvals'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_costing_approval_requested
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_notify_costing_approval_requested();

-- (d) A quotation reached a terminal outcome -> notify its owner. Covers both
-- the sales-phase chain (status -> approved/rejected) and the costing-phase
-- decision (costing_approved_at / costing_rejection_reason newly set; costing
-- approval resets status back to 'draft' rather than 'approved', so it can't
-- be detected via the status column alone).
--
-- quotations.status is itself driven by fn_sync_quotation_status_from_approvals
-- (above), which aggregates quotation_approvals rows but never writes
-- quotations.rejection_reason (that column is otherwise unused/always NULL in
-- this schema) -- the actual reason lives on whichever quotation_approvals row
-- was rejected, so it's pulled from there.
CREATE OR REPLACE FUNCTION public.fn_notify_quotation_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_reason TEXT;
  v_engineering_recipient RECORD;
BEGIN
  IF NEW.phase = 'sales' AND NEW.status IN ('approved', 'rejected')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_recipient := COALESCE(NEW.sales_person_id, NEW.prepared_by);

    IF NEW.status = 'rejected' THEN
      SELECT rejection_reason INTO v_reason
      FROM public.quotation_approvals
      WHERE quotation_id = NEW.id AND status = 'rejected'
      ORDER BY updated_at DESC
      LIMIT 1;
    ELSE
      v_reason := NULL;
    END IF;

    IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications
        (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
      VALUES (
        v_recipient,
        auth.uid(),
        CASE WHEN NEW.status = 'approved' THEN 'quotation_approved' ELSE 'quotation_rejected' END,
        'quotations',
        'quotation',
        NEW.id,
        'Quotation ' || NEW.quotation_number ||
          CASE WHEN NEW.status = 'approved' THEN ' was approved' ELSE ' was rejected' END,
        v_reason,
        '/protected/sales/quotations'
      );
    END IF;
  END IF;

  IF OLD.costing_approved_at IS NULL AND NEW.costing_approved_at IS NOT NULL THEN
    v_recipient := NEW.prepared_by;
    IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications
        (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
      VALUES (
        v_recipient,
        auth.uid(),
        'costing_approved',
        'request_for_quotation',
        'quotation',
        NEW.id,
        'Costing for quotation ' || NEW.quotation_number || ' was approved',
        NULL,
        '/protected/sales/request-for-quotation'
      );
    END IF;

    -- Symmetric with the engineering broadcast on rejection below: they
    -- costed it, so they should know it was approved and handed to Sales too
    -- (added by migration 0017).
    FOR v_engineering_recipient IN
      SELECT id FROM public.profiles
      WHERE department = 'engineering' AND is_active = TRUE
    LOOP
      IF v_engineering_recipient.id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notifications
          (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
        VALUES (
          v_engineering_recipient.id,
          auth.uid(),
          'costing_quotation_approved',
          'engineering_quotations',
          'quotation',
          NEW.id,
          'Quotation ' || NEW.quotation_number || ' costing was approved',
          NEW.subject,
          '/protected/engineering/quotations'
        );
      END IF;
    END LOOP;
  END IF;

  IF OLD.costing_rejection_reason IS NULL AND NEW.costing_rejection_reason IS NOT NULL THEN
    v_recipient := NEW.prepared_by;
    IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications
        (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
      VALUES (
        v_recipient,
        auth.uid(),
        'costing_rejected',
        'request_for_quotation',
        'quotation',
        NEW.id,
        'Costing for quotation ' || NEW.quotation_number || ' was rejected',
        NEW.costing_rejection_reason,
        '/protected/sales/request-for-quotation'
      );
    END IF;

    -- Broadcast to the engineering department too -- the ball is back in
    -- their court for rework (added by migration 0013).
    FOR v_engineering_recipient IN
      SELECT id FROM public.profiles
      WHERE department = 'engineering' AND is_active = TRUE
    LOOP
      IF v_engineering_recipient.id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notifications
          (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
        VALUES (
          v_engineering_recipient.id,
          auth.uid(),
          'costing_quotation_returned',
          'engineering_quotations',
          'quotation',
          NEW.id,
          'Quotation ' || NEW.quotation_number || ' was sent back for costing rework',
          NEW.costing_rejection_reason,
          '/protected/engineering/quotations'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_quotation_resolved
  AFTER UPDATE OF status, costing_approved_at, costing_rejection_reason ON public.quotations
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.costing_approved_at IS DISTINCT FROM NEW.costing_approved_at
    OR OLD.costing_rejection_reason IS DISTINCT FROM NEW.costing_rejection_reason
  )
  EXECUTE FUNCTION public.fn_notify_quotation_resolved();

-- (e) A PO reached a terminal outcome -> notify its creator. Mirrors (d): the
-- rejection reason lives on the rejected po_approvals row, not on
-- purchase_orders itself.
CREATE OR REPLACE FUNCTION public.fn_notify_po_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.created_by IS DISTINCT FROM auth.uid() THEN
    IF NEW.status = 'rejected' THEN
      SELECT rejection_reason INTO v_reason
      FROM public.po_approvals
      WHERE po_id = NEW.id AND status = 'rejected'
      ORDER BY updated_at DESC
      LIMIT 1;
    ELSE
      v_reason := NULL;
    END IF;

    INSERT INTO public.notifications
      (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
    VALUES (
      NEW.created_by,
      auth.uid(),
      CASE WHEN NEW.status = 'approved' THEN 'po_approved' ELSE 'po_rejected' END,
      'purchase_orders',
      'purchase_order',
      NEW.id,
      'PO ' || NEW.po_number ||
        CASE WHEN NEW.status = 'approved' THEN ' was approved' ELSE ' was rejected' END,
      v_reason,
      '/protected/sales/purchase-orders'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_po_resolved
  AFTER UPDATE OF status ON public.purchase_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_notify_po_resolved();

-- (f) A new RFQ arrives for costing (quotations INSERT with phase='costing',
-- inserted directly as status='draft' by lib/sales/quotations.ts
-- createRequestForQuotation) -> broadcast to the engineering department, same
-- department-wide reasoning as (c)/the engineering broadcast in (d): there is
-- no per-user assignment column for engineering (lib/engineering/access.ts
-- gates purely on department='engineering'). Added by migration 0013.
CREATE OR REPLACE FUNCTION public.fn_notify_costing_quotation_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient RECORD;
BEGIN
  IF NEW.phase = 'costing' THEN
    FOR v_recipient IN
      SELECT id FROM public.profiles
      WHERE department = 'engineering' AND is_active = TRUE
    LOOP
      IF v_recipient.id IS DISTINCT FROM auth.uid() THEN
        INSERT INTO public.notifications
          (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
        VALUES (
          v_recipient.id,
          auth.uid(),
          'costing_quotation_received',
          'engineering_quotations',
          'quotation',
          NEW.id,
          'New request for quotation ' || NEW.quotation_number || ' needs costing',
          NEW.subject,
          '/protected/engineering/quotations'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_costing_quotation_received
  AFTER INSERT ON public.quotations
  FOR EACH ROW
  WHEN (NEW.phase = 'costing')
  EXECUTE FUNCTION public.fn_notify_costing_quotation_received();

-- (g) Not a trigger. Called once via RPC from
-- lib/engineering/costing-quotations.ts setQuotationItemCosts() after a batch
-- of quotation_items unit_cost updates succeeds (that function updates N
-- items sequentially per Save click; a row-level trigger would fire N times
-- for one click). Regular clients have no INSERT policy on notifications, so
-- this validates its own caller (must be an active engineering profile)
-- rather than relying on RLS, and derives all notification content
-- server-side from target_quotation_id. Added by migration 0015.
CREATE OR REPLACE FUNCTION public.fn_notify_costing_cost_updated(target_quotation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_engineering BOOLEAN;
  v_quotation RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND department = 'engineering' AND is_active = TRUE
  ) INTO v_caller_is_engineering;

  IF NOT v_caller_is_engineering THEN
    RAISE EXCEPTION 'Only an active engineering profile may report a costing update.';
  END IF;

  SELECT quotation_number, subject, prepared_by, phase INTO v_quotation
  FROM public.quotations
  WHERE id = target_quotation_id;

  IF NOT FOUND OR v_quotation.phase <> 'costing' THEN
    RETURN;
  END IF;

  IF v_quotation.prepared_by IS NULL OR v_quotation.prepared_by = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications
    (recipient_id, actor_id, type, section, entity_type, entity_id, title, body, link)
  VALUES (
    v_quotation.prepared_by,
    auth.uid(),
    'costing_cost_updated',
    'request_for_quotation',
    'quotation',
    target_quotation_id,
    'Costing was updated for quotation ' || v_quotation.quotation_number,
    v_quotation.subject,
    '/protected/sales/request-for-quotation'
  );
END;
$$;

-- Realtime delivery: the bell subscribes to a per-user filtered channel
-- (recipient_id=eq.<uid>), the first filtered postgres_changes subscription in
-- this codebase (existing RealtimeRefresh channels are unfiltered/table-wide).
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ============================================================
-- END OF SCHEMA
-- ============================================================
-- Tables: 9 (profiles, audit_logs, clients, client_contacts,
--            quotations, quotation_approvals, po_payments, revenue_targets,
--            notifications)
-- Modules: Auth/Profiles, Sales, Executive Dashboard
-- Approved quotations serve as the canonical purchase-order record.
-- ============================================================
