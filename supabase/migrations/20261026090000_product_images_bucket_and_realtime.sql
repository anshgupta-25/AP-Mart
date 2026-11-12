CREATE POLICY product_images_public_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY product_images_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY product_images_shopkeeper_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'products'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END
$$;
