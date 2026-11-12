
-- 1) Orders: tighten SELECT — drop the "any partner can see unassigned packed orders" branch
DROP POLICY IF EXISTS orders_shop_select ON public.orders;
CREATE POLICY orders_shop_select ON public.orders
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.owner_id = auth.uid())
  OR partner_id = current_user_partner_id()
);

-- Sanitized available-orders pool for delivery partners (no address / coordinates / customer data)
CREATE OR REPLACE FUNCTION public.partner_available_orders()
RETURNS TABLE (
  id uuid,
  order_number text,
  total numeric,
  city text,
  area_pincode text,
  placed_at timestamptz,
  item_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user_partner_id() IS NULL THEN
    RAISE EXCEPTION 'Not a delivery partner';
  END IF;
  RETURN QUERY
  SELECT o.id,
         o.order_number,
         o.total,
         (o.address->>'city')::text AS city,
         (o.address->>'pincode')::text AS area_pincode,
         o.placed_at,
         (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id) AS item_count
  FROM public.orders o
  WHERE o.status = 'packed'::order_status
    AND o.partner_id IS NULL
  ORDER BY o.placed_at ASC;
END $$;
REVOKE ALL ON FUNCTION public.partner_available_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_available_orders() TO authenticated;

-- 2) order_items: scope partner read to assigned orders only
DROP POLICY IF EXISTS oi_self_select ON public.order_items;
CREATE POLICY oi_self_select ON public.order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        o.user_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = o.partner_id AND dp.user_id = auth.uid())
      )
  )
);

-- 3) orders UPDATE: restrict direct UPDATE to admins; customers use cancel_order() RPC
DROP POLICY IF EXISTS orders_self_update ON public.orders;
CREATE POLICY orders_admin_update ON public.orders
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4) shops: hide phone from anon via column-level grants
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, owner_id, name, address, city, pincode, latitude, longitude,
              service_radius_km, is_open, created_at, updated_at) ON public.shops TO anon;

-- 5) coupons: hide internal usage/limits from anon via column-level grants
REVOKE SELECT ON public.coupons FROM anon;
GRANT SELECT (id, code, type, value, min_order, description, expires_at, active, created_at) ON public.coupons TO anon;
