
-- 1) New columns on orders to record why a shop was chosen and how far it is
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assignment_reason text,
  ADD COLUMN IF NOT EXISTS assignment_distance_km numeric;

-- 2) Rank shops by distance, then rating (tiebreaker). Same eligibility as before.
CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_cart(
  _user_id uuid, _lat double precision, _lng double precision, _exclude uuid[] DEFAULT '{}'::uuid[]
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
DECLARE _shop_id uuid;
BEGIN
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true
    AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(_exclude))
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci
      LEFT JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = s.id
      WHERE ci.user_id = _user_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < ci.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((SELECT AVG(rating)::numeric FROM public.reviews r WHERE r.shop_id = s.id), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $function$;

CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_order(_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
DECLARE _shop_id uuid; _lat double precision; _lng double precision; _excl uuid[];
BEGIN
  SELECT delivery_lat, delivery_lng, rejected_shop_ids INTO _lat, _lng, _excl FROM public.orders WHERE id = _order_id;
  IF _lat IS NULL THEN RETURN NULL; END IF;
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true
    AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(_excl))
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      LEFT JOIN public.shop_products sp ON sp.product_id = oi.product_id AND sp.shop_id = s.id
      WHERE oi.order_id = _order_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((SELECT AVG(rating)::numeric FROM public.reviews r WHERE r.shop_id = s.id), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $function$;

-- 3) Rewrite place_order: same behaviour + records assignment_reason & assignment_distance_km,
--    and returns a customer-friendly error when no shop can fulfill the whole cart.
DROP FUNCTION IF EXISTS public.place_order(jsonb, payment_method, text, text, text);
CREATE OR REPLACE FUNCTION public.place_order(
  _address jsonb,
  _payment_method payment_method,
  _coupon_code text DEFAULT NULL,
  _delivery_instruction text DEFAULT NULL,
  _delivery_type text DEFAULT 'standard_delivery'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _subtotal numeric := 0;
  _discount numeric := 0;
  _delivery_fee numeric := 0;
  _fast_fee numeric := 0;
  _handling numeric := 5;
  _total numeric := 0;
  _coupon record;
  _lat double precision;
  _lng double precision;
  _shop_id uuid;
  _distance numeric;
  r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _delivery_type NOT IN ('fast_delivery','standard_delivery','pickup') THEN
    RAISE EXCEPTION 'Invalid delivery type';
  END IF;

  _lat := (_address->>'lat')::double precision;
  _lng := (_address->>'lng')::double precision;
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Delivery address needs coordinates'; END IF;

  _shop_id := public.find_nearest_shop_for_cart(_uid, _lat, _lng, '{}');
  IF _shop_id IS NULL THEN
    RAISE EXCEPTION 'Sorry, this item is currently unavailable in nearby shops.';
  END IF;

  SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng)
    INTO _distance FROM public.shops s WHERE s.id = _shop_id;

  FOR r IN
    SELECT ci.product_id, ci.quantity, sp.price, sp.stock, p.name
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
    WHERE ci.user_id = _uid
    FOR UPDATE OF sp
  LOOP
    IF r.quantity > r.stock THEN
      RAISE EXCEPTION 'Sorry, this item is currently unavailable in nearby shops.';
    END IF;
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

  IF _delivery_type = 'fast_delivery' THEN
    _fast_fee := 100; _delivery_fee := 100;
  ELSE
    _fast_fee := 0; _delivery_fee := 0;
  END IF;

  _total := _subtotal - _discount + _delivery_fee + _handling;

  INSERT INTO public.orders (
    user_id, shop_id, address, delivery_lat, delivery_lng,
    payment_method, payment_status, status,
    subtotal, discount, delivery_fee, handling_fee, tax, total,
    coupon_code, delivery_instruction, assignment_attempts, assignment_expires_at,
    delivery_type, fast_delivery_fee,
    assignment_reason, assignment_distance_km
  ) VALUES (
    _uid, _shop_id, _address, _lat, _lng,
    _payment_method, 'pending'::payment_status, 'awaiting_shop'::order_status,
    _subtotal, _discount, _delivery_fee, _handling, 0, _total,
    _coupon_code, _delivery_instruction, 1, now() + interval '10 minutes',
    _delivery_type, _fast_fee,
    'Nearest shop with all items in stock', _distance
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
END $function$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, payment_method, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, payment_method, text, text, text) TO authenticated;

-- 4) Update reason + distance when a shop rejects and we re-route
CREATE OR REPLACE FUNCTION public.shop_reject_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _next_shop uuid; _cust uuid; _dist numeric; _lat double precision; _lng double precision;
BEGIN
  SELECT shop_id, user_id, delivery_lat, delivery_lng INTO _shop_id, _cust, _lat, _lng FROM public.orders WHERE id = _order_id;
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
    UPDATE public.orders SET status = 'no_shop_available'::order_status, assignment_expires_at = NULL,
      assignment_reason = 'No eligible shop with all items in stock' WHERE id = _order_id;
    INSERT INTO public.notifications (user_id, title, body) VALUES (_cust, 'No shop available', 'Sorry, this item is currently unavailable in nearby shops.');
  ELSE
    UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _next_shop;
    SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng) INTO _dist FROM public.shops s WHERE s.id = _next_shop;
    UPDATE public.orders SET shop_id = _next_shop, status = 'awaiting_shop'::order_status,
      assignment_attempts = assignment_attempts + 1, assignment_expires_at = now() + interval '10 minutes',
      assignment_reason = 'Next nearest eligible shop selected', assignment_distance_km = _dist
    WHERE id = _order_id;
  END IF;
END $function$;

-- 5) Same for the timeout reassignment worker
CREATE OR REPLACE FUNCTION public.reassign_stale_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _count integer := 0; r record; _next uuid; _dist numeric;
BEGIN
  FOR r IN
    SELECT id, shop_id, user_id, rejected_shop_ids, delivery_lat, delivery_lng FROM public.orders
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
      UPDATE public.orders SET rejected_shop_ids = '{}'::uuid[] WHERE id = r.id;
      _next := public.find_nearest_shop_for_order(r.id);
    END IF;

    IF _next IS NULL THEN
      UPDATE public.orders SET status = 'no_shop_available'::order_status, assignment_expires_at = NULL,
        assignment_reason = 'No eligible shop with all items in stock' WHERE id = r.id;
      INSERT INTO public.notifications (user_id, title, body) VALUES (r.user_id, 'No shop available', 'Sorry, this item is currently unavailable in nearby shops.');
    ELSE
      UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _next;
      SELECT public.haversine_km(s.latitude, s.longitude, r.delivery_lat, r.delivery_lng) INTO _dist FROM public.shops s WHERE s.id = _next;
      UPDATE public.orders SET shop_id = _next, assignment_attempts = assignment_attempts + 1,
        assignment_expires_at = now() + interval '10 minutes',
        assignment_reason = 'Next nearest eligible shop selected', assignment_distance_km = _dist
      WHERE id = r.id;
    END IF;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $function$;
