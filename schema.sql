-- ============================================================
-- SUPABASE POSTGRESQL SCHEMA
-- ERP System: HR, Sales, Accounting, Purchasing, Inventory
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

CREATE TYPE request_type_enum AS ENUM (
  'leave',
  'overtime',
  'reimbursement',
  'purchase_requisition',
  'quotation_approval',
  'document_approval',
  'other'
);

CREATE TYPE leave_type_enum AS ENUM (
  'vacation',
  'sick',
  'emergency',
  'maternity',
  'paternity',
  'unpaid',
  'other'
);

CREATE TYPE stock_movement_type_enum AS ENUM (
  'incoming',
  'outgoing',
  'adjustment',
  'transfer',
  'return'
);

CREATE TYPE revenue_type_enum AS ENUM (
  'closed_sale',    -- Total PO amount
  'recognized_sale' -- Total collected from PO
);

CREATE TYPE employment_status_enum AS ENUM (
  'active',
  'inactive',
  'on_leave',
  'terminated',
  'resigned'
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
  is_executive_viewer BOOLEAN NOT NULL DEFAULT FALSE, -- grants access to Overall Dashboard
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.profiles.is_executive_viewer IS 'Only 2 users max should have this set to TRUE (top management dashboard access)';


-- ============================================================
-- SECTION 2: AUDIT / CHANGE HISTORY
-- Generic audit log for all major tables
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

-- Reusable trigger function for audit logging
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

-- Auto-update updated_at helper
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create profile rows for newly created auth users.
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
    SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enforce department set-once behavior for this MVP.
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
-- SECTION 3: HR MODULE
-- ============================================================

CREATE TABLE public.employees (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  employee_code       TEXT UNIQUE NOT NULL,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  middle_name         TEXT,
  email               TEXT NOT NULL UNIQUE,
  phone               TEXT,
  department          department_enum NOT NULL,
  position            TEXT NOT NULL,
  employment_status   employment_status_enum NOT NULL DEFAULT 'active',
  date_hired          DATE NOT NULL,
  date_regularized    DATE,
  date_separated      DATE,
  basic_salary        NUMERIC(15, 2),
  sss_number          TEXT,
  philhealth_number   TEXT,
  pagibig_number      TEXT,
  tin_number          TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  address             TEXT,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_department ON public.employees(department);
CREATE INDEX idx_employees_status     ON public.employees(employment_status);

CREATE TABLE public.employee_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL,  -- e.g. 'contract', 'nbi_clearance', 'id_photo'
  document_name   TEXT NOT NULL,
  file_url        TEXT,           -- Supabase Storage URL
  file_size_bytes BIGINT,
  mime_type       TEXT,
  expiry_date     DATE,
  notes           TEXT,
  uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.leave_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type      leave_type_enum NOT NULL,
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  days_count      NUMERIC(5, 1) NOT NULL,
  reason          TEXT,
  status          approval_status_enum NOT NULL DEFAULT 'pending',
  approved_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status   ON public.leave_requests(status);


-- ============================================================
-- SECTION 4: CLIENTS (Sales Module)
-- ============================================================

CREATE TABLE public.clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_code         TEXT UNIQUE NOT NULL,
  company_name        TEXT NOT NULL,
  sector              sector_enum NOT NULL,
  address             TEXT,
  city                TEXT,
  province            TEXT,
  country             TEXT DEFAULT 'Philippines',
  website             TEXT,
  payment_terms_days  INTEGER NOT NULL DEFAULT 30, -- net days
  credit_limit        NUMERIC(15, 2),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes               TEXT,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_sector    ON public.clients(sector);
CREATE INDEX idx_clients_is_active ON public.clients(is_active);

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
-- SECTION 5: SALES MODULE — QUOTATIONS & POs
-- ============================================================

CREATE TABLE public.quotations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_number    TEXT UNIQUE NOT NULL,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  sector              sector_enum NOT NULL,
  subject             TEXT NOT NULL,
  description         TEXT,
  amount              NUMERIC(15, 2) NOT NULL,
  cost                NUMERIC(15, 2),                          -- for margin calculation
  margin_amount       NUMERIC(15, 2) GENERATED ALWAYS AS (amount - COALESCE(cost, 0)) STORED,
  margin_percent      NUMERIC(6, 2) GENERATED ALWAYS AS (
                        CASE WHEN amount > 0 THEN ((amount - COALESCE(cost, 0)) / amount) * 100 ELSE 0 END
                      ) STORED,
  -- Approval tier: < 3M = sales_manager, >= 3M = owner + 2 executives
  requires_executive_approval BOOLEAN GENERATED ALWAYS AS (amount >= 3000000) STORED,
  status              approval_status_enum NOT NULL DEFAULT 'pending',
  valid_until         DATE,
  notes               TEXT,
  prepared_by         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotations_client ON public.quotations(client_id);
CREATE INDEX idx_quotations_status ON public.quotations(status);

-- Tracks each required approver per quotation
CREATE TABLE public.quotation_approvals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id     UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  approver_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approver_role    user_role_enum NOT NULL,
  approval_order   INTEGER NOT NULL DEFAULT 1,  -- sequence if multi-level
  status           approval_status_enum NOT NULL DEFAULT 'pending',
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quotation_id, approver_id)
);

CREATE TABLE public.purchase_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number           TEXT UNIQUE NOT NULL,
  quotation_id        UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  sector              sector_enum NOT NULL,
  subject             TEXT NOT NULL,
  po_amount           NUMERIC(15, 2) NOT NULL,       -- Closed Sale (total PO value)
  cost                NUMERIC(15, 2),
  margin_amount       NUMERIC(15, 2) GENERATED ALWAYS AS (po_amount - COALESCE(cost, 0)) STORED,
  margin_percent      NUMERIC(6, 2) GENERATED ALWAYS AS (
                        CASE WHEN po_amount > 0 THEN ((po_amount - COALESCE(cost, 0)) / po_amount) * 100 ELSE 0 END
                      ) STORED,
  recognized_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Recognized Sale (collected so far)
  payment_terms_days  INTEGER NOT NULL DEFAULT 30,
  payment_status      payment_status_enum NOT NULL DEFAULT 'unpaid',
  po_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_completion DATE,
  notes               TEXT,
  created_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_client        ON public.purchase_orders(client_id);
CREATE INDEX idx_po_payment_status ON public.purchase_orders(payment_status);
CREATE INDEX idx_po_po_date       ON public.purchase_orders(po_date);

-- Individual payments/collections against a PO (drives recognized_sale)
CREATE TABLE public.po_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id           UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  amount_collected NUMERIC(15, 2) NOT NULL,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT,           -- e.g. 'bank_transfer', 'check', 'cash'
  reference_number TEXT,
  notes           TEXT,
  recorded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_payments_po_id ON public.po_payments(po_id);


-- ============================================================
-- SECTION 6: ACCOUNTING MODULE
-- ============================================================

CREATE TABLE public.revenue_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id           UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  revenue_type    revenue_type_enum NOT NULL,
  sector          sector_enum NOT NULL,
  amount          NUMERIC(15, 2) NOT NULL,
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_quarter  INTEGER NOT NULL GENERATED ALWAYS AS (CEIL(period_month / 3.0)::INTEGER) STORED,
  notes           TEXT,
  recorded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_period      ON public.revenue_records(period_year, period_month);
CREATE INDEX idx_revenue_type        ON public.revenue_records(revenue_type);
CREATE INDEX idx_revenue_sector      ON public.revenue_records(sector);

-- Annual revenue targets for dashboard YTD vs Target
CREATE TABLE public.revenue_targets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year            INTEGER NOT NULL,
  month           INTEGER CHECK (month BETWEEN 1 AND 12),  -- NULL = annual target
  target_amount   NUMERIC(15, 2) NOT NULL,
  sector          sector_enum,  -- NULL = overall target
  set_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month, sector)
);

CREATE TABLE public.accounting_approvals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_type   TEXT NOT NULL,   -- e.g. 'invoice', 'journal_entry', 'expense'
  reference_id     UUID NOT NULL,
  approver_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status           approval_status_enum NOT NULL DEFAULT 'pending',
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SECTION 7: VENDORS & PURCHASING MODULE
-- ============================================================

CREATE TABLE public.vendors (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_code      TEXT UNIQUE NOT NULL,
  company_name     TEXT NOT NULL,
  contact_person   TEXT,
  email            TEXT,
  phone            TEXT,
  mobile           TEXT,
  address          TEXT,
  city             TEXT,
  payment_terms_days INTEGER DEFAULT 30,
  tax_id           TEXT,
  bank_name        TEXT,
  bank_account     TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendors_is_active ON public.vendors(is_active);

CREATE TABLE public.purchase_requisitions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_number  TEXT UNIQUE NOT NULL,
  requested_by        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  department          department_enum NOT NULL,
  vendor_id           UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  purpose             TEXT NOT NULL,
  total_amount        NUMERIC(15, 2),
  status              approval_status_enum NOT NULL DEFAULT 'pending',
  needed_by_date      DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.purchase_requisition_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id      UUID NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  item_description    TEXT NOT NULL,
  quantity            NUMERIC(12, 4) NOT NULL,
  unit                TEXT,
  unit_price          NUMERIC(15, 2),
  total_price         NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * COALESCE(unit_price, 0)) STORED,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SECTION 8: INVENTORY MODULE
-- ============================================================

CREATE TABLE public.inventory_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_code        TEXT UNIQUE NOT NULL,
  item_name        TEXT NOT NULL,
  description      TEXT,
  category         TEXT,
  unit             TEXT NOT NULL DEFAULT 'pcs',
  unit_cost        NUMERIC(15, 2),
  reorder_level    NUMERIC(12, 4) DEFAULT 0,
  current_stock    NUMERIC(12, 4) NOT NULL DEFAULT 0,
  vendor_id        UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_category  ON public.inventory_items(category);
CREATE INDEX idx_inventory_is_active ON public.inventory_items(is_active);

CREATE TABLE public.stock_movements (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id          UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  movement_type    stock_movement_type_enum NOT NULL,
  quantity         NUMERIC(12, 4) NOT NULL,        -- always positive; direction from type
  stock_before     NUMERIC(12, 4) NOT NULL,
  stock_after      NUMERIC(12, 4) NOT NULL,
  unit_cost        NUMERIC(15, 2),
  reference_type   TEXT,   -- e.g. 'purchase_requisition', 'po', 'adjustment'
  reference_id     UUID,
  reason           TEXT,
  moved_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  movement_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_item        ON public.stock_movements(item_id);
CREATE INDEX idx_stock_movements_date        ON public.stock_movements(movement_date DESC);
CREATE INDEX idx_stock_movements_ref         ON public.stock_movements(reference_type, reference_id);


-- ============================================================
-- SECTION 9: DOCUMENTED REQUESTS & APPROVALS
-- Generic multi-department request + multi-level workflow
-- ============================================================

CREATE TABLE public.department_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number    TEXT UNIQUE NOT NULL,
  department        department_enum NOT NULL,
  request_type      request_type_enum NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  requested_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status            approval_status_enum NOT NULL DEFAULT 'pending',
  priority          TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_date          DATE,
  reference_type    TEXT,   -- links to related record type if any
  reference_id      UUID,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dept_requests_dept       ON public.department_requests(department);
CREATE INDEX idx_dept_requests_status     ON public.department_requests(status);
CREATE INDEX idx_dept_requests_requested  ON public.department_requests(requested_by);

CREATE TABLE public.request_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID NOT NULL REFERENCES public.department_requests(id) ON DELETE CASCADE,
  document_name   TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type       TEXT,
  uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each step in the approval chain for a request
CREATE TABLE public.approval_steps (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id        UUID NOT NULL REFERENCES public.department_requests(id) ON DELETE CASCADE,
  step_order        INTEGER NOT NULL,
  approver_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approver_role     user_role_enum NOT NULL,
  status            approval_status_enum NOT NULL DEFAULT 'pending',
  is_current_step   BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, step_order)
);

CREATE INDEX idx_approval_steps_request  ON public.approval_steps(request_id);
CREATE INDEX idx_approval_steps_approver ON public.approval_steps(approver_id);
CREATE INDEX idx_approval_steps_status   ON public.approval_steps(status);


-- ============================================================
-- SECTION 10: NOTIFICATIONS (optional but useful)
-- ============================================================

CREATE TABLE public.notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT,
  type            TEXT,           -- 'approval_needed', 'approved', 'rejected', etc.
  reference_type  TEXT,
  reference_id    UUID,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, is_read);


-- ============================================================
-- SECTION 11: ATTACH AUDIT TRIGGERS TO KEY TABLES
-- ============================================================

-- profiles
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- employees
CREATE TRIGGER trg_audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- leave_requests
CREATE TRIGGER trg_audit_leave_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- clients
CREATE TRIGGER trg_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- quotations
CREATE TRIGGER trg_audit_quotations
  AFTER INSERT OR UPDATE OR DELETE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- quotation_approvals
CREATE TRIGGER trg_audit_quotation_approvals
  AFTER INSERT OR UPDATE OR DELETE ON public.quotation_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- purchase_orders
CREATE TRIGGER trg_audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- po_payments
CREATE TRIGGER trg_audit_po_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.po_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- revenue_records
CREATE TRIGGER trg_audit_revenue_records
  AFTER INSERT OR UPDATE OR DELETE ON public.revenue_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- vendors
CREATE TRIGGER trg_audit_vendors
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- inventory_items
CREATE TRIGGER trg_audit_inventory_items
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- stock_movements
CREATE TRIGGER trg_audit_stock_movements
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- department_requests
CREATE TRIGGER trg_audit_department_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.department_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- approval_steps
CREATE TRIGGER trg_audit_approval_steps
  AFTER INSERT OR UPDATE OR DELETE ON public.approval_steps
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();


-- ============================================================
-- SECTION 12: ATTACH updated_at TRIGGERS
-- ============================================================

CREATE TRIGGER trg_updated_at_profiles             BEFORE UPDATE ON public.profiles             FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_profiles_department_set_once    BEFORE UPDATE OF department ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_department_set_once();
CREATE TRIGGER trg_updated_at_employees            BEFORE UPDATE ON public.employees            FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_employee_documents   BEFORE UPDATE ON public.employee_documents   FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_leave_requests       BEFORE UPDATE ON public.leave_requests       FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_clients              BEFORE UPDATE ON public.clients              FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_client_contacts      BEFORE UPDATE ON public.client_contacts      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_quotations           BEFORE UPDATE ON public.quotations           FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_quotation_approvals  BEFORE UPDATE ON public.quotation_approvals  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_purchase_orders      BEFORE UPDATE ON public.purchase_orders      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_po_payments          BEFORE UPDATE ON public.po_payments          FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_revenue_records      BEFORE UPDATE ON public.revenue_records      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_revenue_targets      BEFORE UPDATE ON public.revenue_targets      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_vendors              BEFORE UPDATE ON public.vendors              FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_purchase_requisitions BEFORE UPDATE ON public.purchase_requisitions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_inventory_items      BEFORE UPDATE ON public.inventory_items      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_department_requests  BEFORE UPDATE ON public.department_requests  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_updated_at_approval_steps       BEFORE UPDATE ON public.approval_steps       FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- ============================================================
-- SECTION 13: DASHBOARD HELPER VIEWS
-- Supports Executive Dashboard: YTD Revenue, Margin, PO totals
-- ============================================================

-- YTD Revenue vs Target view
CREATE OR REPLACE VIEW public.vw_ytd_revenue AS
SELECT
  r.period_year,
  r.period_quarter,
  r.period_month,
  r.sector,
  r.revenue_type,
  SUM(r.amount)                                  AS total_revenue,
  (SELECT t.target_amount
   FROM public.revenue_targets t
   WHERE t.year = r.period_year AND t.sector IS NULL AND t.month IS NULL
   LIMIT 1)                                       AS annual_target
FROM public.revenue_records r
GROUP BY r.period_year, r.period_quarter, r.period_month, r.sector, r.revenue_type;

-- PO summary with margin
CREATE OR REPLACE VIEW public.vw_po_summary AS
SELECT
  po.id,
  po.po_number,
  c.company_name,
  c.sector,
  po.po_amount          AS closed_sale,
  po.recognized_amount  AS recognized_sale,
  po.margin_amount,
  po.margin_percent,
  po.payment_status,
  po.po_date,
  EXTRACT(YEAR  FROM po.po_date)::INTEGER AS year,
  EXTRACT(MONTH FROM po.po_date)::INTEGER AS month,
  CEIL(EXTRACT(MONTH FROM po.po_date) / 3.0)::INTEGER AS quarter
FROM public.purchase_orders po
JOIN public.clients c ON c.id = po.client_id;


-- ============================================================
-- SECTION 14: ROW LEVEL SECURITY (RLS) — STARTER POLICIES
-- Enable after testing; adjust as needed per business rules
-- ============================================================

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_targets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_auth_user();

-- Profiles: users can read their own profile; admins can read all
CREATE POLICY "profiles_self_read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'executive')
    )
  );

-- Audit logs: only executives and owners can read
CREATE POLICY "audit_logs_exec_read"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'executive')
    )
  );

-- Revenue targets: only executive_viewer can see dashboard targets
CREATE POLICY "revenue_targets_exec_only"
  ON public.revenue_targets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_executive_viewer = TRUE
    )
  );


-- ============================================================
-- END OF SCHEMA
-- ============================================================
-- Table count: 22 tables, 2 views, 2 helper functions
-- Audit triggers: 14 tables fully tracked
-- Modules: Auth/Profiles, HR, Sales, Accounting,
--          Purchasing, Inventory, Requests/Approvals,
--          Notifications, Dashboard Views
-- ============================================================
