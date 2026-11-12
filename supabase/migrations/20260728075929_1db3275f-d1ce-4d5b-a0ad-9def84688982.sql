
-- 1. Add columns
ALTER TABLE public.delivery_zone_settings
  ADD COLUMN IF NOT EXISTS handling_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handling_type text NOT NULL DEFAULT 'fixed' CHECK (handling_type IN ('fixed','percent')),
  ADD COLUMN IF NOT EXISTS default_handling_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handling_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_handling_above numeric,
  ADD COLUMN IF NOT EXISTS standard_handling_fee numeric,
  ADD COLUMN IF NOT EXISTS fast_handling_fee numeric,
  ADD COLUMN IF NOT EXISTS express_handling_fee numeric;

-- 2. Rewrite admin_upsert_delivery_zone to persist new fields
CREATE OR REPLACE FUNCTION public.admin_upsert_delivery_zone(_data jsonb)
RETURNS delivery_zone_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.delivery_zone_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF (_data->>'id') IS NOT NULL AND (_data->>'id') <> '' THEN
    UPDATE public.delivery_zone_settings SET
      state = COALESCE(_data->>'state', state),
      city = COALESCE(_data->>'city', city),
      pin_code = COALESCE(_data->>'pin_code', pin_code),
      is_active = COALESCE((_data->>'is_active')::boolean, is_active),
      delivery_radius_km = COALESCE((_data->>'delivery_radius_km')::numeric, delivery_radius_km),
      standard_enabled = COALESCE((_data->>'standard_enabled')::boolean, standard_enabled),
      standard_fee = COALESCE((_data->>'standard_fee')::numeric, standard_fee),
      standard_eta_minutes = COALESCE(_data->>'standard_eta_minutes', standard_eta_minutes),
      minimum_order_standard = NULLIF(_data->>'minimum_order_standard','')::numeric,
      fast_enabled = COALESCE((_data->>'fast_enabled')::boolean, fast_enabled),
      fast_fee = COALESCE((_data->>'fast_fee')::numeric, fast_fee),
      fast_eta_minutes = COALESCE(_data->>'fast_eta_minutes', fast_eta_minutes),
      minimum_order_fast = NULLIF(_data->>'minimum_order_fast','')::numeric,
      express_enabled = COALESCE((_data->>'express_enabled')::boolean, express_enabled),
      express_fee = COALESCE((_data->>'express_fee')::numeric, express_fee),
      express_eta_minutes = COALESCE(_data->>'express_eta_minutes', express_eta_minutes),
      minimum_order_express = NULLIF(_data->>'minimum_order_express','')::numeric,
      handling_enabled = COALESCE((_data->>'handling_enabled')::boolean, handling_enabled),
      handling_type = COALESCE(_data->>'handling_type', handling_type),
      default_handling_fee = COALESCE((_data->>'default_handling_fee')::numeric, default_handling_fee),
      handling_percentage = COALESCE((_data->>'handling_percentage')::numeric, handling_percentage),
      free_handling_above = NULLIF(_data->>'free_handling_above','')::numeric,
      standard_handling_fee = NULLIF(_data->>'standard_handling_fee','')::numeric,
      fast_handling_fee = NULLIF(_data->>'fast_handling_fee','')::numeric,
      express_handling_fee = NULLIF(_data->>'express_handling_fee','')::numeric,
      updated_at = now()
    WHERE id = (_data->>'id')::uuid
    RETURNING * INTO r;
  ELSE
    INSERT INTO public.delivery_zone_settings(
      state, city, pin_code, is_active, delivery_radius_km,
      standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
      fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
      express_enabled, express_fee, express_eta_minutes, minimum_order_express,
      handling_enabled, handling_type, default_handling_fee, handling_percentage,
      free_handling_above, standard_handling_fee, fast_handling_fee, express_handling_fee
    ) VALUES (
      _data->>'state', _data->>'city', _data->>'pin_code',
      COALESCE((_data->>'is_active')::boolean, true),
      COALESCE((_data->>'delivery_radius_km')::numeric, 10),
      COALESCE((_data->>'standard_enabled')::boolean, true),
      COALESCE((_data->>'standard_fee')::numeric, 0),
      COALESCE(_data->>'standard_eta_minutes','45-60'),
      NULLIF(_data->>'minimum_order_standard','')::numeric,
      COALESCE((_data->>'fast_enabled')::boolean, false),
      COALESCE((_data->>'fast_fee')::numeric, 49),
      COALESCE(_data->>'fast_eta_minutes','20-30'),
      NULLIF(_data->>'minimum_order_fast','')::numeric,
      COALESCE((_data->>'express_enabled')::boolean, false),
      COALESCE((_data->>'express_fee')::numeric, 99),
      COALESCE(_data->>'express_eta_minutes','10-15'),
      NULLIF(_data->>'minimum_order_express','')::numeric,
      COALESCE((_data->>'handling_enabled')::boolean, false),
      COALESCE(_data->>'handling_type','fixed'),
      COALESCE((_data->>'default_handling_fee')::numeric, 0),
      COALESCE((_data->>'handling_percentage')::numeric, 0),
      NULLIF(_data->>'free_handling_above','')::numeric,
      NULLIF(_data->>'standard_handling_fee','')::numeric,
      NULLIF(_data->>'fast_handling_fee','')::numeric,
      NULLIF(_data->>'express_handling_fee','')::numeric
    )
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $function$;

-- 3. Extend get_delivery_options_for_pincode return
DROP FUNCTION IF EXISTS public.get_delivery_options_for_pincode(text);
CREATE OR REPLACE FUNCTION public.get_delivery_options_for_pincode(_pincode text)
RETURNS TABLE(
  pin_code text, state text, city text, is_active boolean,
  standard_enabled boolean, standard_fee numeric, standard_eta_minutes text, minimum_order_standard numeric,
  fast_enabled boolean, fast_fee numeric, fast_eta_minutes text, minimum_order_fast numeric,
  express_enabled boolean, express_fee numeric, express_eta_minutes text, minimum_order_express numeric,
  handling_enabled boolean, handling_type text, default_handling_fee numeric, handling_percentage numeric,
  free_handling_above numeric, standard_handling_fee numeric, fast_handling_fee numeric, express_handling_fee numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT pin_code, state, city, is_active,
    standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
    fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
    express_enabled, express_fee, express_eta_minutes, minimum_order_express,
    handling_enabled, handling_type, default_handling_fee, handling_percentage,
    free_handling_above, standard_handling_fee, fast_handling_fee, express_handling_fee
  FROM public.delivery_zone_settings
  WHERE pin_code = _pincode AND is_active = true
  LIMIT 1;
$function$;

-- 4. Helper: compute handling fee for pincode + delivery type + subtotal
CREATE OR REPLACE FUNCTION public.compute_handling_fee(_pincode text, _delivery_type text, _subtotal numeric)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  z public.delivery_zone_settings;
  fee numeric := 0;
  tier_override numeric;
BEGIN
  SELECT * INTO z FROM public.delivery_zone_settings WHERE pin_code = _pincode AND is_active = true LIMIT 1;
  IF NOT FOUND OR NOT z.handling_enabled THEN RETURN 0; END IF;
  IF z.free_handling_above IS NOT NULL AND _subtotal >= z.free_handling_above THEN RETURN 0; END IF;

  tier_override := CASE _delivery_type
    WHEN 'standard_delivery' THEN z.standard_handling_fee
    WHEN 'fast_delivery' THEN z.fast_handling_fee
    WHEN 'express_delivery' THEN z.express_handling_fee
    ELSE NULL
  END;

  IF tier_override IS NOT NULL THEN
    RETURN GREATEST(0, tier_override);
  END IF;

  IF z.handling_type = 'percent' THEN
    fee := ROUND(COALESCE(_subtotal,0) * COALESCE(z.handling_percentage,0) / 100.0, 2);
  ELSE
    fee := COALESCE(z.default_handling_fee, 0);
  END IF;
  RETURN GREATEST(0, fee);
END; $function$;

GRANT EXECUTE ON FUNCTION public.compute_handling_fee(text,text,numeric) TO authenticated, anon;

-- 5. Patch place_order to use computed handling
CREATE OR REPLACE FUNCTION public.place_order(_address jsonb, _payment_method payment_method, _coupon_code text DEFAULT NULL::text, _delivery_instruction text DEFAULT NULL::text, _delivery_type text DEFAULT 'standard_delivery'::text)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _subtotal numeric := 0;
  _discount numeric := 0;
  _delivery_fee numeric := 0;
  _fast_fee numeric := 0;
  _handling numeric := 0;
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
  _manual_shop_id uuid;
  _distinct_shops int;
  _mode text := 'auto';
  _reason_text text;
  r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _delivery_type NOT IN ('fast_delivery','standard_delivery','express_delivery','pickup') THEN
    RAISE EXCEPTION 'Invalid delivery type';
  END IF;

  _lat := (_address->>'lat')::double precision;
  _lng := (_address->>'lng')::double precision;
  _pin := NULLIF(trim(_address->>'pincode'), '');
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Delivery address needs coordinates'; END IF;
  IF _pin IS NULL THEN RAISE EXCEPTION 'Delivery address is missing a pincode'; END IF;

  SELECT count(DISTINCT shop_id) FILTER (WHERE shop_id IS NOT NULL)
    INTO _distinct_shops FROM public.cart_items WHERE user_id = _uid;

  IF _distinct_shops > 1 THEN
    RAISE EXCEPTION 'Your cart contains items from multiple shops. Please choose one shop.';
  END IF;

  IF _distinct_shops = 1 THEN
    SELECT shop_id INTO _manual_shop_id
    FROM public.cart_items WHERE user_id = _uid AND shop_id IS NOT NULL LIMIT 1;
  END IF;

  SELECT count(*) INTO _candidates FROM public.shops WHERE is_open = true AND owner_id IS NOT NULL;
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE is_open = true AND owner_id IS NOT NULL AND pincode = _pin) INTO _has_pin_match;
  SELECT EXISTS (
    SELECT 1 FROM public.shops s WHERE s.is_open = true AND s.owner_id IS NOT NULL
      AND s.pincode = _pin
      AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
  ) INTO _has_in_radius;

  IF _manual_shop_id IS NOT NULL THEN
    PERFORM 1 FROM public.shops s
      WHERE s.id = _manual_shop_id AND s.is_open = true AND s.owner_id IS NOT NULL
        AND s.pincode = _pin
        AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected shop does not deliver to this address.';
    END IF;
    _shop_id := _manual_shop_id;
    _mode := 'manual';
    _reason_text := 'Customer manually selected shop';
  ELSE
    _shop_id := public.find_best_shop_for_cart(_uid, _lat, _lng, _pin, '{}');
    _mode := 'auto';
    _reason_text := 'Pincode ' || _pin || ' • nearest in-stock shop';
  END IF;

  IF _shop_id IS NULL THEN
    INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, outcome, reason, details)
    VALUES (NULL, _pin, _lat, _lng, _candidates,
      CASE WHEN NOT _has_pin_match THEN 'no_shop_in_pincode' WHEN NOT _has_in_radius THEN 'out_of_radius' ELSE 'no_stock' END,
      CASE WHEN NOT _has_pin_match THEN 'No active shop registered for pincode ' || _pin
           WHEN NOT _has_in_radius THEN 'Shops in pincode ' || _pin || ' do not cover this address within their delivery radius'
           ELSE 'Shops in pincode ' || _pin || ' do not have all requested items in stock' END,
      jsonb_build_object('user_id', _uid));
    RAISE EXCEPTION 'No shop currently delivers to your location or has the requested products available.';
  END IF;

  SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng)
    INTO _distance FROM public.shops s WHERE s.id = _shop_id;

  FOR r IN
    SELECT ci.product_id, ci.variant_id, ci.quantity,
           COALESCE(pv.selling_price, sp.price) AS eff_price,
           COALESCE(pv.stock, sp.stock) AS eff_stock,
           p.name
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
    LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id
    WHERE ci.user_id = _uid
    FOR UPDATE OF sp
  LOOP
    IF r.quantity > r.eff_stock THEN
      RAISE EXCEPTION 'Sorry, "%" is out of stock.', r.name;
    END IF;
    _subtotal := _subtotal + r.eff_price * r.quantity;
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

  -- Delivery + handling fees from zone
  SELECT
    CASE _delivery_type
      WHEN 'fast_delivery' THEN COALESCE(z.fast_fee, 0)
      WHEN 'express_delivery' THEN COALESCE(z.express_fee, 0)
      WHEN 'standard_delivery' THEN COALESCE(z.standard_fee, 0)
      ELSE 0
    END
  INTO _delivery_fee
  FROM public.delivery_zone_settings z
  WHERE z.pin_code = _pin AND z.is_active = true
  LIMIT 1;
  _delivery_fee := COALESCE(_delivery_fee, CASE WHEN _delivery_type='fast_delivery' THEN 100 ELSE 0 END);
  _fast_fee := CASE WHEN _delivery_type = 'fast_delivery' THEN _delivery_fee ELSE 0 END;

  _handling := public.compute_handling_fee(_pin, _delivery_type, _subtotal);

  _total := _subtotal - _discount + _delivery_fee + _handling;

  INSERT INTO public.orders (
    user_id, shop_id, address, delivery_lat, delivery_lng, delivery_pincode,
    payment_method, payment_status, status,
    subtotal, discount, delivery_fee, handling_fee, tax, total,
    coupon_code, delivery_instruction, assignment_attempts, assignment_expires_at,
    delivery_type, fast_delivery_fee,
    assignment_reason, assignment_distance_km, routing_status, shop_selection_mode
  ) VALUES (
    _uid, _shop_id, _address, _lat, _lng, _pin,
    _payment_method, 'pending'::payment_status, 'awaiting_shop'::order_status,
    _subtotal, _discount, _delivery_fee, _handling, 0, _total,
    _coupon_code, _delivery_instruction, 1, now() + interval '10 minutes',
    _delivery_type, _fast_fee,
    _reason_text, _distance, 'assigned', _mode
  ) RETURNING id INTO _order_id;

  INSERT INTO public.order_items (order_id, product_id, variant_id, variant_label, name, image_url, unit, price, quantity)
  SELECT _order_id, ci.product_id, ci.variant_id,
         CASE WHEN pv.id IS NOT NULL THEN COALESCE(pv.name, pv.size) END,
         p.name,
         COALESCE((pv.images)[1], p.cover_image, p.image_url),
         COALESCE(pv.size || COALESCE(' ' || pv.unit, ''), p.unit),
         COALESCE(pv.selling_price, sp.price),
         ci.quantity
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
  LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id
  WHERE ci.user_id = _uid;

  UPDATE public.product_variants pv
    SET stock = pv.stock - ci.quantity, updated_at = now()
  FROM public.cart_items ci
  WHERE ci.user_id = _uid AND ci.variant_id = pv.id;

  UPDATE public.shop_products sp SET stock = sp.stock - ci.quantity, updated_at = now()
  FROM public.cart_items ci
  WHERE ci.user_id = _uid AND ci.variant_id IS NULL
    AND ci.product_id = sp.product_id AND sp.shop_id = _shop_id;

  DELETE FROM public.cart_items WHERE user_id = _uid;

  INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, chosen_shop_id, chosen_distance_km, outcome, reason)
  VALUES (_order_id, _pin, _lat, _lng, _candidates, _shop_id, _distance, 'assigned', _reason_text);

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_uid, 'Order placed!', 'Looking for a shop to accept your order...');
  RETURN _order_id;
END $function$;

-- 6. Patch place_multi_shop_order handling
CREATE OR REPLACE FUNCTION public.place_multi_shop_order(_address jsonb, _payment_method text, _coupon_code text DEFAULT NULL::text, _delivery_instruction text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _pincode text DEFAULT NULL::text, _delivery_type text DEFAULT 'standard_delivery'::text)
 RETURNS TABLE(parent_order_id uuid, order_number text, shop_count integer, total numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  plan_rows record;
  distinct_shops uuid[];
  parent_id uuid;
  parent_number text;
  child_id uuid;
  cart_product_count int;
  plan_product_count int;
  total_subtotal numeric := 0;
  total_amount numeric := 0;
  del_fee numeric := 0;
  fast_fee numeric := 0;
  handling_fee numeric := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT COUNT(DISTINCT ci.product_id) INTO cart_product_count
  FROM cart_items ci WHERE ci.user_id = uid;
  IF cart_product_count = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  DROP TABLE IF EXISTS _cart_plan;
  CREATE TEMP TABLE _cart_plan ON COMMIT DROP AS
    SELECT * FROM plan_multi_shop_cart(uid, _lat, _lng, _pincode);

  SELECT COUNT(DISTINCT cp.product_id) INTO plan_product_count FROM _cart_plan cp;
  IF plan_product_count < cart_product_count THEN
    RAISE EXCEPTION 'no_coverage: only % of % cart items can be sourced', plan_product_count, cart_product_count;
  END IF;

  SELECT ARRAY(SELECT DISTINCT cp.shop_id FROM _cart_plan cp) INTO distinct_shops;

  SELECT COALESCE(SUM(cp.price * cp.quantity), 0) INTO total_subtotal FROM _cart_plan cp;

  SELECT
    CASE _delivery_type
      WHEN 'fast_delivery' THEN COALESCE(z.fast_fee, 0)
      WHEN 'express_delivery' THEN COALESCE(z.express_fee, 0)
      WHEN 'standard_delivery' THEN COALESCE(z.standard_fee, 0)
      ELSE 0
    END
  INTO del_fee
  FROM public.delivery_zone_settings z
  WHERE z.pin_code = _pincode AND z.is_active = true
  LIMIT 1;
  del_fee := COALESCE(del_fee, CASE WHEN _delivery_type = 'fast_delivery' THEN 100 ELSE 20 END);
  fast_fee := CASE WHEN _delivery_type = 'fast_delivery' THEN del_fee ELSE 0 END;

  handling_fee := public.compute_handling_fee(_pincode, _delivery_type, total_subtotal);

  total_amount := total_subtotal + del_fee + handling_fee;

  INSERT INTO orders(
    user_id, status, payment_method, subtotal, delivery_fee, handling_fee, tax, total,
    coupon_code, address, delivery_instruction, delivery_lat, delivery_lng,
    delivery_pincode, delivery_type, fast_delivery_fee, is_parent, shop_count,
    shop_selection_mode
  ) VALUES (
    uid, 'awaiting_shop', _payment_method::payment_method, total_subtotal, del_fee, handling_fee, 0, total_amount,
    _coupon_code, _address, _delivery_instruction, _lat, _lng,
    _pincode, _delivery_type, fast_fee, true, array_length(distinct_shops, 1),
    'auto'
  ) RETURNING orders.id, orders.order_number INTO parent_id, parent_number;

  FOR plan_rows IN
    SELECT cp.shop_id AS s_id, cp.shop_name AS s_name,
           SUM(cp.price * cp.quantity)::numeric AS sub,
           MIN(cp.distance_km) AS dist
    FROM _cart_plan cp
    GROUP BY cp.shop_id, cp.shop_name
  LOOP
    INSERT INTO orders(
      user_id, status, payment_method, subtotal, delivery_fee, handling_fee, tax, total,
      address, delivery_lat, delivery_lng, delivery_pincode, delivery_type,
      shop_id, parent_order_id, is_parent, shop_count,
      assignment_distance_km, pickup_otp
    ) VALUES (
      uid, 'awaiting_shop', _payment_method::payment_method, plan_rows.sub, 0, 0, 0, plan_rows.sub,
      _address, _lat, _lng, _pincode, _delivery_type,
      plan_rows.s_id, parent_id, false, 1,
      plan_rows.dist, lpad(floor(random() * 9000 + 1000)::text, 4, '0')
    ) RETURNING orders.id INTO child_id;

    INSERT INTO order_items(order_id, child_order_id, shop_id, shop_product_id,
                            product_id, variant_id, name, image_url, unit, price, quantity)
    SELECT child_id, child_id, cp.shop_id, cp.shop_product_id,
           cp.product_id, cp.variant_id, cp.product_name, cp.image_url, cp.unit,
           cp.price, cp.quantity
    FROM _cart_plan cp WHERE cp.shop_id = plan_rows.s_id;

    INSERT INTO inventory_reservations(parent_order_id, child_order_id, shop_product_id, quantity, expires_at)
    SELECT parent_id, child_id, cp.shop_product_id, cp.quantity, now() + interval '5 minutes'
    FROM _cart_plan cp WHERE cp.shop_id = plan_rows.s_id;

    INSERT INTO shop_assignment_history(order_id, shop_id, status, attempt_number)
      VALUES (parent_id, plan_rows.s_id, 'assigned', 1);

    PERFORM notify_user((SELECT sh.owner_id FROM shops sh WHERE sh.id = plan_rows.s_id),
                       'New order — ' || parent_number,
                       'A new order needs your acceptance within 60 seconds.',
                       'order',
                       jsonb_build_object('order_id', child_id, 'parent_order_id', parent_id));
  END LOOP;

  PERFORM notify_user(uid, 'Order placed — ' || parent_number,
                     'Finding shops for your order…', 'order',
                     jsonb_build_object('order_id', parent_id));

  DROP TABLE IF EXISTS _cart_plan;
  DELETE FROM cart_items WHERE cart_items.user_id = uid;

  RETURN QUERY SELECT parent_id, parent_number, array_length(distinct_shops, 1), total_amount;
END $function$;
