
-- shops
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  pincode text NOT NULL,
  phone text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  service_radius_km numeric NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shops TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shops_public_read ON public.shops;
CREATE POLICY shops_public_read ON public.shops FOR SELECT USING (true);
DROP POLICY IF EXISTS shops_owner_write ON public.shops;
CREATE POLICY shops_owner_write ON public.shops FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shops_admin_insert ON public.shops;
CREATE POLICY shops_admin_insert ON public.shops FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shops_admin_delete ON public.shops;
CREATE POLICY shops_admin_delete ON public.shops FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- shop_products
CREATE TABLE IF NOT EXISTS public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_products_product ON public.shop_products(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON public.shop_products(shop_id);
GRANT SELECT ON public.shop_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_products TO authenticated;
GRANT ALL ON public.shop_products TO service_role;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sp_public_read ON public.shop_products;
CREATE POLICY sp_public_read ON public.shop_products FOR SELECT USING (true);
DROP POLICY IF EXISTS sp_shop_owner_write ON public.shop_products;
CREATE POLICY sp_shop_owner_write ON public.shop_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_products.shop_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_products.shop_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'))));

-- delivery_partners
CREATE TABLE IF NOT EXISTS public.delivery_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  vehicle text,
  is_online boolean NOT NULL DEFAULT false,
  current_lat double precision,
  current_lng double precision,
  rating numeric NOT NULL DEFAULT 4.8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_partners TO authenticated;
GRANT ALL ON public.delivery_partners TO service_role;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dp_self_all ON public.delivery_partners;
CREATE POLICY dp_self_all ON public.delivery_partners FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS dp_read_all_auth ON public.delivery_partners;
CREATE POLICY dp_read_all_auth ON public.delivery_partners FOR SELECT TO authenticated USING (true);

-- orders: add columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id),
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.delivery_partners(id),
  ADD COLUMN IF NOT EXISTS assignment_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assignment_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_shop_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision;
CREATE INDEX IF NOT EXISTS idx_orders_shop ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON public.orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- orders: expand RLS
DROP POLICY IF EXISTS orders_self_select ON public.orders;
DROP POLICY IF EXISTS orders_shop_select ON public.orders;
CREATE POLICY orders_shop_select ON public.orders FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.owner_id = auth.uid())
    OR (orders.status IN ('packed'::order_status,'out_for_delivery'::order_status)
        AND EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = orders.partner_id AND dp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS oi_self_select ON public.order_items;
CREATE POLICY oi_self_select ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND (
      o.user_id = auth.uid()
      OR has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = o.partner_id AND dp.user_id = auth.uid())
      OR (o.status IN ('packed'::order_status,'out_for_delivery'::order_status)
          AND EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.user_id = auth.uid()))
    )
  ));

-- haversine + nearest-shop functions
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 2 * 6371 * asin(sqrt(
    sin(radians((lat2 - lat1) / 2))^2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians((lng2 - lng1) / 2))^2
  ));
$$;

CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_cart(
  _user_id uuid, _lat double precision, _lng double precision, _exclude uuid[] DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop_id uuid;
BEGIN
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true
    AND NOT (s.id = ANY(_exclude))
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci
      LEFT JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = s.id
      WHERE ci.user_id = _user_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < ci.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC
  LIMIT 1;
  RETURN _shop_id;
END $$;

CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_order(_order_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop_id uuid; _lat double precision; _lng double precision; _excl uuid[];
BEGIN
  SELECT delivery_lat, delivery_lng, rejected_shop_ids INTO _lat, _lng, _excl FROM public.orders WHERE id = _order_id;
  IF _lat IS NULL THEN RETURN NULL; END IF;
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true
    AND NOT (s.id = ANY(_excl))
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      LEFT JOIN public.shop_products sp ON sp.product_id = oi.product_id AND sp.shop_id = s.id
      WHERE oi.order_id = _order_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC
  LIMIT 1;
  RETURN _shop_id;
END $$;

-- Rewrite place_order
CREATE OR REPLACE FUNCTION public.place_order(
  _address jsonb, _payment_method payment_method, _coupon_code text DEFAULT NULL, _delivery_instruction text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _subtotal numeric := 0;
  _discount numeric := 0;
  _delivery_fee numeric := 0;
  _handling numeric := 5;
  _total numeric := 0;
  _coupon record;
  _lat double precision;
  _lng double precision;
  _shop_id uuid;
  r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _lat := (_address->>'lat')::double precision;
  _lng := (_address->>'lng')::double precision;
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Delivery address needs coordinates'; END IF;

  _shop_id := public.find_nearest_shop_for_cart(_uid, _lat, _lng, '{}');
  IF _shop_id IS NULL THEN RAISE EXCEPTION 'No shop available with all items in stock'; END IF;

  FOR r IN
    SELECT ci.product_id, ci.quantity, sp.price, sp.stock, p.name
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
    WHERE ci.user_id = _uid
    FOR UPDATE OF sp
  LOOP
    IF r.quantity > r.stock THEN RAISE EXCEPTION 'Insufficient stock for %', r.name; END IF;
    _subtotal := _subtotal + r.price * r.quantity;
  END LOOP;
  IF _subtotal = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  IF _coupon_code IS NOT NULL AND length(_coupon_code) > 0 THEN
    SELECT * INTO _coupon FROM public.coupons
      WHERE code = upper(_coupon_code) AND active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (usage_limit IS NULL OR times_used < usage_limit) LIMIT 1;
    IF _coupon.id IS NOT NULL AND _subtotal >= _coupon.min_order THEN
      IF _coupon.type = 'flat' THEN _discount := LEAST(_coupon.value, _subtotal);
      ELSE
        _discount := (_subtotal * _coupon.value / 100.0);
        IF _coupon.max_discount IS NOT NULL THEN _discount := LEAST(_discount, _coupon.max_discount); END IF;
      END IF;
      UPDATE public.coupons SET times_used = times_used + 1 WHERE id = _coupon.id;
    END IF;
  END IF;

  _delivery_fee := CASE WHEN _subtotal - _discount >= 199 THEN 0 ELSE 25 END;
  _total := _subtotal - _discount + _delivery_fee + _handling;

  INSERT INTO public.orders (
    user_id, shop_id, address, delivery_lat, delivery_lng,
    payment_method, payment_status, status,
    subtotal, discount, delivery_fee, handling_fee, tax, total,
    coupon_code, delivery_instruction, assignment_attempts, assignment_expires_at
  ) VALUES (
    _uid, _shop_id, _address, _lat, _lng,
    _payment_method, 'pending'::payment_status, 'awaiting_shop'::order_status,
    _subtotal, _discount, _delivery_fee, _handling, 0, _total,
    _coupon_code, _delivery_instruction, 1, now() + interval '60 seconds'
  ) RETURNING id INTO _order_id;

  INSERT INTO public.order_items (order_id, product_id, name, image_url, unit, price, quantity)
  SELECT _order_id, ci.product_id, p.name, p.image_url, p.unit, sp.price, ci.quantity
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
  WHERE ci.user_id = _uid;

  UPDATE public.shop_products sp SET stock = stock - ci.quantity, updated_at = now()
  FROM public.cart_items ci
  WHERE ci.user_id = _uid AND ci.product_id = sp.product_id AND sp.shop_id = _shop_id;

  DELETE FROM public.cart_items WHERE user_id = _uid;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_uid, 'Order placed!', 'Looking for a shop to accept your order...');
  RETURN _order_id;
END $$;

CREATE OR REPLACE FUNCTION public.shop_accept_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _cust uuid;
BEGIN
  SELECT shop_id, user_id INTO _shop_id, _cust FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  UPDATE public.orders SET status = 'accepted_by_shop'::order_status,
    assignment_expires_at = NULL, updated_at = now()
    WHERE id = _order_id AND status = 'awaiting_shop'::order_status;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_cust, 'Order accepted', 'A shop is preparing your order.');
END $$;

CREATE OR REPLACE FUNCTION public.shop_reject_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _next_shop uuid; _cust uuid;
BEGIN
  SELECT shop_id, user_id INTO _shop_id, _cust FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  UPDATE public.shop_products sp SET stock = stock + oi.quantity, updated_at = now()
  FROM public.order_items oi
  WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _shop_id;
  UPDATE public.orders SET rejected_shop_ids = array_append(rejected_shop_ids, _shop_id), shop_id = NULL, updated_at = now()
  WHERE id = _order_id;
  _next_shop := public.find_nearest_shop_for_order(_order_id);
  IF _next_shop IS NULL THEN
    UPDATE public.orders SET status = 'no_shop_available'::order_status, assignment_expires_at = NULL WHERE id = _order_id;
    INSERT INTO public.notifications (user_id, title, body) VALUES (_cust, 'No shop available', 'We could not find a shop for your order.');
  ELSE
    UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _next_shop;
    UPDATE public.orders SET shop_id = _next_shop, status = 'awaiting_shop'::order_status,
      assignment_attempts = assignment_attempts + 1, assignment_expires_at = now() + interval '60 seconds'
    WHERE id = _order_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reassign_stale_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer := 0; r record; _next uuid;
BEGIN
  FOR r IN
    SELECT id, shop_id, user_id FROM public.orders
    WHERE status = 'awaiting_shop'::order_status
      AND assignment_expires_at IS NOT NULL AND assignment_expires_at < now()
  LOOP
    UPDATE public.shop_products sp SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = r.shop_id;
    UPDATE public.orders SET rejected_shop_ids = array_append(rejected_shop_ids, r.shop_id), shop_id = NULL
    WHERE id = r.id;
    _next := public.find_nearest_shop_for_order(r.id);
    IF _next IS NULL THEN
      UPDATE public.orders SET status = 'no_shop_available'::order_status, assignment_expires_at = NULL WHERE id = r.id;
      INSERT INTO public.notifications (user_id, title, body) VALUES (r.user_id, 'No shop available', 'We could not find a shop for your order.');
    ELSE
      UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _next;
      UPDATE public.orders SET shop_id = _next, assignment_attempts = assignment_attempts + 1,
        assignment_expires_at = now() + interval '60 seconds' WHERE id = r.id;
    END IF;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

CREATE OR REPLACE FUNCTION public.shop_mark_packed(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _shop_id uuid;
BEGIN
  SELECT shop_id INTO _shop_id FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  UPDATE public.orders SET status = 'packed'::order_status, updated_at = now()
  WHERE id = _order_id AND status = 'accepted_by_shop'::order_status;
END $$;

CREATE OR REPLACE FUNCTION public.partner_accept_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _pid uuid; _cust uuid;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  UPDATE public.orders SET partner_id = _pid, status = 'out_for_delivery'::order_status, updated_at = now()
  WHERE id = _order_id AND partner_id IS NULL AND status = 'packed'::order_status
  RETURNING user_id INTO _cust;
  IF _cust IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body) VALUES (_cust, 'Out for delivery', 'Your order is on its way!');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.partner_mark_delivered(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _pid uuid; _cust uuid;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  UPDATE public.orders SET status = 'delivered'::order_status, updated_at = now()
  WHERE id = _order_id AND partner_id = _pid RETURNING user_id INTO _cust;
  IF _cust IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body) VALUES (_cust, 'Delivered', 'Your order has been delivered. Enjoy!');
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.reassign_stale_orders() FROM anon, authenticated;

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='shop_products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_products;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('flashbasket_reassign_stale');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('flashbasket_reassign_stale', '30 seconds', $$SELECT public.reassign_stale_orders();$$);
