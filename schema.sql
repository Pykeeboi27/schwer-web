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
  'cancelled'
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
  amount              NUMERIC(15, 2) NOT NULL,
  cost                NUMERIC(15, 2),
  margin_amount       NUMERIC(15, 2) GENERATED ALWAYS AS (amount - COALESCE(cost, 0)) STORED,
  margin_percent      NUMERIC(6, 2) GENERATED ALWAYS AS (
                        CASE WHEN amount > 0 THEN ((amount - COALESCE(cost, 0)) / amount) * 100 ELSE 0 END
                      ) STORED,
  requires_executive_approval BOOLEAN GENERATED ALWAYS AS (amount >= 3000000) STORED,
  status              approval_status_enum NOT NULL DEFAULT 'draft',
  phase               quotation_phase_enum NOT NULL DEFAULT 'sales',
  google_drive_link   TEXT,
  costing_rejection_reason TEXT,
  costing_approved_at TIMESTAMPTZ,
  sales_margin_percent NUMERIC(6, 2),
  payment_terms       TEXT,
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

CREATE OR REPLACE FUNCTION public.fn_sync_quotation_status_from_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qid UUID;
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
  approved_at = CASE
    WHEN q.approved_at IS NOT NULL THEN q.approved_at
    WHEN EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.quotation_approvals qa
      WHERE qa.quotation_id = qid AND qa.status IN ('pending', 'rejected')
    ) THEN NOW()
    ELSE q.approved_at
  END,
  updated_at = NOW()
  WHERE q.id = qid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_quotation_status_from_approvals ON public.quotation_approvals;
CREATE TRIGGER trg_sync_quotation_status_from_approvals
AFTER INSERT OR UPDATE OR DELETE ON public.quotation_approvals
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_quotation_status_from_approvals();


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
      WHERE p.id = auth.uid() AND p.is_executive_viewer = TRUE AND p.is_active = TRUE
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


-- ============================================================
-- END OF SCHEMA
-- ============================================================
-- Tables: 8 (profiles, audit_logs, clients, client_contacts,
--            quotations, quotation_approvals, po_payments, revenue_targets)
-- Modules: Auth/Profiles, Sales, Executive Dashboard
-- Approved quotations serve as the canonical purchase-order record.
-- ============================================================
