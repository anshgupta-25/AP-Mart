-- Ensure the image buckets the app uploads to exist, with their storage policies.
--
-- The app uploads new product photos to `products` (and banners to `categories`,
-- `offers`, `shop-collections`), stored as `storage://<bucket>/<path>` and displayed
-- via signed URLs. Earlier migrations only created POLICIES for these buckets, never
-- the buckets, so a project set up from migrations has no `products` bucket and
-- uploads fail with "row-level security" / images never display.
--
-- Safe to run more than once. `product-images` (legacy) is left unchanged.

-- 1) Buckets -----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('products',         'products',         true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('categories',       'categories',       true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('offers',           'offers',           true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('shop-collections', 'shop-collections', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Read: anyone may view images (needed for display and signed URLs) --------
DROP POLICY IF EXISTS image_buckets_public_read ON storage.objects;
CREATE POLICY image_buckets_public_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = ANY (ARRAY['products','categories','offers','shop-collections']));

-- 3) Admins: full write -----------------------------------------------------------
DROP POLICY IF EXISTS image_buckets_admin_write ON storage.objects;
CREATE POLICY image_buckets_admin_write
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS image_buckets_admin_update ON storage.objects;
CREATE POLICY image_buckets_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS image_buckets_admin_delete ON storage.objects;
CREATE POLICY image_buckets_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['products','categories','offers','shop-collections'])
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 4) Shopkeepers: upload only under shops/<own shop id>/, change only own files --
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
