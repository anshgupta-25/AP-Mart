-- Tighten shopkeeper uploads: objects must live under shops/<shop id>/ where the
-- caller owns that shop. Admin and support-attachment policies are untouched, and no
-- bucket privacy is changed. (Only the INSERT policy is replaced; it becomes stricter.)
DROP POLICY IF EXISTS image_buckets_shopkeeper_write ON storage.objects;
CREATE POLICY image_buckets_shopkeeper_write
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
    AND (storage.foldername(name))[1] = 'shops'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[2]
    )
  );
