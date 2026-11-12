
CREATE POLICY "image_buckets_public_read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id IN ('products','categories','offers','shop-collections'));

CREATE POLICY "image_buckets_auth_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('products','categories','offers','shop-collections'));

CREATE POLICY "image_buckets_auth_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('products','categories','offers','shop-collections'));

CREATE POLICY "image_buckets_auth_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('products','categories','offers','shop-collections'));
