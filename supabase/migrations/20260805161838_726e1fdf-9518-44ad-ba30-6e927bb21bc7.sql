-- Shopkeepers may upload images for their categories, collections and offers,
-- not just products. Least privilege: only these image buckets, only their own objects.
DROP POLICY IF EXISTS image_buckets_shopkeeper_write ON storage.objects;
CREATE POLICY image_buckets_shopkeeper_write
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
  );

DROP POLICY IF EXISTS image_buckets_shopkeeper_update ON storage.objects;
CREATE POLICY image_buckets_shopkeeper_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS image_buckets_shopkeeper_delete ON storage.objects;
CREATE POLICY image_buckets_shopkeeper_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
    AND owner = auth.uid()
  );