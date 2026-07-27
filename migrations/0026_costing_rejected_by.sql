-- The costing (RFQ) rejection Callouts in the Engineering dialogs hardcoded
-- "Returned by executive" / "Rejected by executive" -- the role, not who
-- actually returned it -- because quotations had no column recording which
-- executive rejected a costing submission (unlike the sales/PO approval
-- chain, which tracks this per-row in quotation_approvals/po_approvals).
-- Adding it here so the UI can show the actual person.

ALTER TABLE public.quotations
  ADD COLUMN costing_rejected_by UUID REFERENCES public.profiles(id);
