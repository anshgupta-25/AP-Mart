
DROP POLICY IF EXISTS dp_read_all_auth ON public.delivery_partners;

CREATE POLICY dp_scoped_read ON public.delivery_partners
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.partner_id = delivery_partners.id
      AND o.status IN ('packed'::order_status, 'out_for_delivery'::order_status, 'delivered'::order_status)
      AND (
        o.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS orders_shop_select ON public.orders;

CREATE POLICY orders_shop_select ON public.orders
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = orders.shop_id AND s.owner_id = auth.uid()
  )
  OR (
    status = 'packed'::order_status
    AND partner_id IS NULL
    AND EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.user_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.delivery_partners dp
    WHERE dp.id = orders.partner_id AND dp.user_id = auth.uid()
  )
);

-- Hide shops.phone from anonymous visitors via column-level grants
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, owner_id, name, address, city, pincode, latitude, longitude, is_open, service_radius_km, created_at, updated_at) ON public.shops TO anon;
