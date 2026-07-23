-- Proof of payment for collections.
--
-- The client wants photographic proof attached to every collection recorded
-- against a purchase order (the "Record Collection" flow, po_payments
-- rows). This adds a nullable `proof_path` column pointing at an object in a
-- new private Supabase Storage bucket, `payment-proofs`. The column is
-- nullable at the DB level (legacy rows have no proof) -- "required" for new
-- collections is enforced in the app layer (recordCollectionAction).
--
-- Storage layout: `${auth.uid()}/${purchaseOrderId}/${uuid}.webp`. The
-- leading auth.uid() segment is what the owner-folder RLS check below keys
-- on for writes; reads are department-wide, mirroring the existing
-- sales_po_payments_sales_all policy on po_payments itself.
--
-- Uploads/reads happen from the browser using the publishable/anon key (this
-- project has no service-role key), so correctness relies entirely on these
-- storage.objects policies -- there is no server-side admin bypass.

BEGIN;

ALTER TABLE public.po_payments
  ADD COLUMN IF NOT EXISTS proof_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sales_payment_proofs_insert" ON storage.objects;
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

DROP POLICY IF EXISTS "sales_payment_proofs_select" ON storage.objects;
CREATE POLICY "sales_payment_proofs_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.department = 'sales' AND p.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "sales_payment_proofs_update" ON storage.objects;
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

DROP POLICY IF EXISTS "sales_payment_proofs_delete" ON storage.objects;
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

COMMIT;
