-- Engineering module: assign a sales person to a costing quotation.
--
-- Costings previously had no explicit assignee — the "sales person" shown on
-- the printed worksheet was just the preparer's name. This adds a real,
-- nullable FK so a costing engineer can assign a specific Sales-department
-- user. It's optional while a costing is a draft but is enforced (in
-- application code, lib/engineering/costing-quotations.ts) before it can be
-- submitted for executive approval.

BEGIN;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS sales_person_id UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_quotations_sales_person ON public.quotations(sales_person_id);

COMMIT;
