
-- Allow shopkeepers to create and update products in the catalog
CREATE POLICY prod_shopkeeper_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'shopkeeper'::app_role));

CREATE POLICY prod_shopkeeper_update ON public.products
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'shopkeeper'::app_role))
  WITH CHECK (has_role(auth.uid(), 'shopkeeper'::app_role));

-- Allow shopkeepers to upload/manage images in the products bucket
CREATE POLICY image_buckets_shopkeeper_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND has_role(auth.uid(), 'shopkeeper'::app_role));

CREATE POLICY image_buckets_shopkeeper_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products' AND has_role(auth.uid(), 'shopkeeper'::app_role))
  WITH CHECK (bucket_id = 'products' AND has_role(auth.uid(), 'shopkeeper'::app_role));

CREATE POLICY image_buckets_shopkeeper_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND has_role(auth.uid(), 'shopkeeper'::app_role));
