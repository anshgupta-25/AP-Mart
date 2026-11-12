-- 1. Fix non-correlated RLS subqueries
DROP POLICY IF EXISTS pickup_events_customer_read ON public.pickup_events;
CREATE POLICY pickup_events_customer_read ON public.pickup_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = pickup_events.parent_order_id
    AND o.user_id = auth.uid()
));

DROP POLICY IF EXISTS pickup_events_partner_read ON public.pickup_events;
CREATE POLICY pickup_events_partner_read ON public.pickup_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.delivery_partners dp ON dp.id = o.partner_id
  WHERE o.id = pickup_events.parent_order_id
    AND dp.user_id = auth.uid()
));

DROP POLICY IF EXISTS reservations_customer_read ON public.inventory_reservations;
CREATE POLICY reservations_customer_read ON public.inventory_reservations
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = inventory_reservations.parent_order_id
    AND o.user_id = auth.uid()
));

-- 2. Hide shop phone from unauthenticated visitors
DROP POLICY IF EXISTS shops_public_read ON public.shops;
CREATE POLICY shops_public_read ON public.shops
FOR SELECT TO anon, authenticated
USING (true);

REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (
  id, owner_id, name, address, city, pincode, latitude, longitude,
  is_open, service_radius_km, created_at, updated_at, state, status, logo_url
) ON public.shops TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;