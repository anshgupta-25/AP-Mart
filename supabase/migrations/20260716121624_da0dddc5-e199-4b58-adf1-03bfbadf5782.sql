
-- 1. Columns + indexes
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_pincode text,
  ADD COLUMN IF NOT EXISTS routing_status text;

CREATE INDEX IF NOT EXISTS idx_shops_pincode ON public.shops(pincode) WHERE is_open = true;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pincode ON public.orders(delivery_pincode);

-- 2. Routing log for admin auditability
CREATE TABLE IF NOT EXISTS public.order_routing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  pincode text,
  delivery_lat double precision,
  delivery_lng double precision,
  candidates_considered int NOT NULL DEFAULT 0,
  chosen_shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  chosen_distance_km numeric,
  outcome text NOT NULL,           -- 'assigned' | 'no_shop_in_pincode' | 'no_stock' | 'out_of_radius' | 'no_shop_available'
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_routing_log TO authenticated;
GRANT ALL ON public.order_routing_log TO service_role;
ALTER TABLE public.order_routing_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routing_log_admin_read" ON public.order_routing_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_routing_log_order ON public.order_routing_log(order_id);
CREATE INDEX IF NOT EXISTS idx_routing_log_created ON public.order_routing_log(created_at DESC);

-- 3. Rewrite shop finder for cart with pincode requirement
CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_cart(
  _user_id uuid, _lat double precision, _lng double precision, _exclude uuid[] DEFAULT '{}'::uuid[]
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- kept for backward compatibility; delegates to pincode-aware version with NULL pincode
  RETURN public.find_best_shop_for_cart(_user_id, _lat, _lng, NULL, _exclude);
END $$;

CREATE OR REPLACE FUNCTION public.find_best_shop_for_cart(
  _user_id uuid,
  _lat double precision,
  _lng double precision,
  _pincode text,
  _exclude uuid[] DEFAULT '{}'::uuid[]
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _shop_id uuid;
BEGIN
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true
    AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(_exclude))
    AND (_pincode IS NULL OR s.pincode = _pincode)                              -- pincode gate
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci
      LEFT JOIN public.shop_products sp
        ON sp.product_id = ci.product_id AND sp.shop_id = s.id
      WHERE ci.user_id = _user_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < ci.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((
             SELECT AVG(r.rating)::numeric FROM public.reviews r
             JOIN public.shop_products sp2 ON sp2.product_id = r.product_id
             WHERE sp2.shop_id = s.id
           ), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $$;

-- 4. Rewrite order finder to enforce delivery_pincode
CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_order(_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _shop_id uuid; _lat double precision; _lng double precision; _pin text; _excl uuid[];
BEGIN
  SELECT delivery_lat, delivery_lng, delivery_pincode, rejected_shop_ids
    INTO _lat, _lng, _pin, _excl
  FROM public.orders WHERE id = _order_id;
  IF _lat IS NULL THEN RETURN NULL; END IF;

  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true
    AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(_excl))
    AND (_pin IS NULL OR s.pincode = _pin)                                       -- pincode gate
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      LEFT JOIN public.shop_products sp
        ON sp.product_id = oi.product_id AND sp.shop_id = s.id
      WHERE oi.order_id = _order_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((
             SELECT AVG(r.rating)::numeric FROM public.reviews r
             JOIN public.shop_products sp2 ON sp2.product_id = r.product_id
             WHERE sp2.shop_id = s.id
           ), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $$;

-- 5. Rewrite place_order to enforce pincode + record routing log
CREATE OR REPLACE FUNCTION public.place_order(
  _address jsonb,
  _payment_method payment_method,
  _coupon_code text DEFAULT NULL,
  _delivery_instruction text DEFAULT NULL,
  _delivery_type text DEFAULT 'standard_delivery'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  _pin text;
  _shop_id uuid;
  _distance numeric;
  _candidates int := 0;
  _has_pin_match boolean := false;
  _has_in_radius boolean := false;
  r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _delivery_type NOT IN ('fast_delivery','standard_delivery','pickup') THEN
    RAISE EXCEPTION 'Invalid delivery type';
  END IF;

  _lat := (_address->>'lat')::double precision;
  _lng := (_address->>'lng')::double precision;
  _pin := NULLIF(trim(_address->>'pincode'), '');
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Delivery address needs coordinates'; END IF;
  IF _pin IS NULL THEN RAISE EXCEPTION 'Delivery address is missing a pincode'; END IF;

  -- Diagnostics before finding a shop, for routing log
  SELECT count(*) INTO _candidates FROM public.shops WHERE is_open = true AND owner_id IS NOT NULL;
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE is_open = true AND owner_id IS NOT NULL AND pincode = _pin) INTO _has_pin_match;
  SELECT EXISTS (
    SELECT 1 FROM public.shops s WHERE s.is_open = true AND s.owner_id IS NOT NULL
      AND s.pincode = _pin
      AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
  ) INTO _has_in_radius;

  _shop_id := public.find_best_shop_for_cart(_uid, _lat, _lng, _pin, '{}');

  IF _shop_id IS NULL THEN
    INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, outcome, reason, details)
    VALUES (
      NULL, _pin, _lat, _lng, _candidates,
      CASE
        WHEN NOT _has_pin_match THEN 'no_shop_in_pincode'
        WHEN NOT _has_in_radius THEN 'out_of_radius'
        ELSE 'no_stock'
      END,
      CASE
        WHEN NOT _has_pin_match THEN 'No active shop registered for pincode ' || _pin
        WHEN NOT _has_in_radius THEN 'Shops in pincode ' || _pin || ' do not cover this address within their delivery radius'
        ELSE 'Shops in pincode ' || _pin || ' do not have all requested items in stock'
      END,
      jsonb_build_object('user_id', _uid)
    );
    IF NOT _has_pin_match THEN
      RAISE EXCEPTION 'No shop currently delivers to your location or has the requested products available.';
    ELSIF NOT _has_in_radius THEN
      RAISE EXCEPTION 'No shop currently delivers to your location or has the requested products available.';
    ELSE
      RAISE EXCEPTION 'Sorry, the requested items are currently out of stock in shops serving your pincode.';
    END IF;
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
    user_id, shop_id, address, delivery_lat, delivery_lng, delivery_pincode,
    payment_method, payment_status, status,
    subtotal, discount, delivery_fee, handling_fee, tax, total,
    coupon_code, delivery_instruction, assignment_attempts, assignment_expires_at,
    delivery_type, fast_delivery_fee,
    assignment_reason, assignment_distance_km, routing_status
  ) VALUES (
    _uid, _shop_id, _address, _lat, _lng, _pin,
    _payment_method, 'pending'::payment_status, 'awaiting_shop'::order_status,
    _subtotal, _discount, _delivery_fee, _handling, 0, _total,
    _coupon_code, _delivery_instruction, 1, now() + interval '10 minutes',
    _delivery_type, _fast_fee,
    'Pincode ' || _pin || ' • nearest in-stock shop', _distance, 'assigned'
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

  INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, chosen_shop_id, chosen_distance_km, outcome, reason)
  VALUES (_order_id, _pin, _lat, _lng, _candidates, _shop_id, _distance, 'assigned', 'Pincode match + nearest in-stock shop within radius');

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_uid, 'Order placed!', 'Looking for a shop to accept your order...');
  RETURN _order_id;
END $$;

REVOKE ALL ON FUNCTION public.find_best_shop_for_cart(uuid, double precision, double precision, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_best_shop_for_cart(uuid, double precision, double precision, text, uuid[]) TO authenticated;
