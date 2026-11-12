
-- 1) Tighten storage policies to admins only for image buckets
DROP POLICY IF EXISTS image_buckets_auth_write ON storage.objects;
DROP POLICY IF EXISTS image_buckets_auth_update ON storage.objects;
DROP POLICY IF EXISTS image_buckets_auth_delete ON storage.objects;

CREATE POLICY image_buckets_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('products','categories','offers','shop-collections')
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY image_buckets_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('products','categories','offers','shop-collections')
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    bucket_id IN ('products','categories','offers','shop-collections')
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY image_buckets_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('products','categories','offers','shop-collections')
    AND public.has_role(auth.uid(), 'admin')
  );

-- 2) Enable RLS on realtime.messages and add policies
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_can_receive ON realtime.messages;
DROP POLICY IF EXISTS deny_direct_writes ON realtime.messages;

-- Allow authenticated users to read (subscribe to) realtime broadcast/presence messages
CREATE POLICY authenticated_can_receive ON realtime.messages
  FOR SELECT TO authenticated
  USING (true);
