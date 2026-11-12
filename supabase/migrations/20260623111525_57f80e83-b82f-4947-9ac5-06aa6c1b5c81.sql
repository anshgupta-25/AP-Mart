
-- 1) delivery_partners: remove customer branch from RLS, add safe tracking RPC
DROP POLICY IF EXISTS dp_scoped_read ON public.delivery_partners;
CREATE POLICY dp_scoped_read ON public.delivery_partners
  FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_order_partner_tracking(_order_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  vehicle text,
  rating numeric,
  current_lat double precision,
  current_lng double precision,
  eta_minutes integer,
  availability_status text,
  status_updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dp.id, dp.name, dp.vehicle, dp.rating,
         dp.current_lat, dp.current_lng, dp.eta_minutes,
         dp.availability_status, dp.status_updated_at
  FROM public.orders o
  JOIN public.delivery_partners dp ON dp.id = o.partner_id
  WHERE o.id = _order_id
    AND (
      o.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
      OR dp.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.get_order_partner_tracking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_partner_tracking(uuid) TO authenticated;

-- 2) products: restrict shopkeeper INSERT to users who own a shop
DROP POLICY IF EXISTS prod_shopkeeper_insert ON public.products;
CREATE POLICY prod_shopkeeper_insert ON public.products
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'shopkeeper'::app_role)
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.owner_id = auth.uid())
  );

-- 3) storage: shopkeepers can only update/delete their own uploaded objects
DROP POLICY IF EXISTS image_buckets_shopkeeper_delete ON storage.objects;
CREATE POLICY image_buckets_shopkeeper_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'products'
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS image_buckets_shopkeeper_update ON storage.objects;
CREATE POLICY image_buckets_shopkeeper_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'products'
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'products'
    AND public.has_role(auth.uid(), 'shopkeeper'::app_role)
    AND owner = auth.uid()
  );
