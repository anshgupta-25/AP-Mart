-- 1. Catalog: only open + active shops
CREATE OR REPLACE FUNCTION public.list_customer_products(_pincode text, _category_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text, _only_featured boolean DEFAULT false, _only_bestseller boolean DEFAULT false, _sort text DEFAULT 'relevance'::text, _limit integer DEFAULT 60, _ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, slug text, name text, unit text, price numeric, mrp numeric, image_url text, delivery_minutes integer, stock integer, rating numeric, category_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT sp.product_id, MIN(sp.price) AS min_price, SUM(sp.stock)::int AS total_stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
    GROUP BY sp.product_id
  ),
  variant_img AS (
    SELECT DISTINCT ON (pv.product_id) pv.product_id,
           CASE WHEN pv.images IS NOT NULL AND array_length(pv.images, 1) > 0 THEN pv.images[1] ELSE NULL END AS img
    FROM public.product_variants pv WHERE pv.is_available = true
    ORDER BY pv.product_id, pv.is_default DESC, pv.display_order ASC, pv.created_at ASC
  )
  SELECT p.id, p.slug, p.name, p.unit,
         COALESCE(e.min_price, p.price) AS price, p.mrp,
         COALESCE(p.cover_image,
           CASE WHEN p.image_gallery IS NOT NULL AND array_length(p.image_gallery, 1) > 0 THEN p.image_gallery[1] ELSE NULL END,
           p.image_url, vi.img) AS image_url,
         p.delivery_minutes, COALESCE(e.total_stock, p.stock) AS stock, p.rating, p.category_id
  FROM public.products p
  JOIN eligible e ON e.product_id = p.id
  LEFT JOIN variant_img vi ON vi.product_id = p.id
  WHERE p.is_available = true
    AND (_category_id IS NULL OR p.category_id = _category_id)
    AND (_search IS NULL OR p.name ILIKE '%' || _search || '%')
    AND (NOT _only_featured OR p.is_featured = true)
    AND (NOT _only_bestseller OR p.is_bestseller = true)
    AND (_ids IS NULL OR p.id = ANY(_ids))
  ORDER BY
    CASE WHEN _sort = 'price_asc'  THEN COALESCE(e.min_price, p.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc' THEN COALESCE(e.min_price, p.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'rating'     THEN p.rating END DESC NULLS LAST,
    p.is_featured DESC, p.is_bestseller DESC, p.rating DESC
  LIMIT GREATEST(_limit, 1);
$function$;

-- 2. Eligible shops for a product
CREATE OR REPLACE FUNCTION public.list_eligible_shops_for_product(_product_id uuid, _variant_id uuid DEFAULT NULL::uuid, _pincode text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision)
 RETURNS TABLE(shop_id uuid, shop_name text, shop_address text, latitude double precision, longitude double precision, pincode text, service_radius_km numeric, distance_km numeric, delivery_minutes integer, price numeric, mrp numeric, stock integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.id, s.name, s.address, s.latitude, s.longitude, s.pincode, s.service_radius_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN round(public.haversine_km(s.latitude, s.longitude, _lat, _lng)::numeric, 2) ELSE NULL END AS distance_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN GREATEST(8, LEAST(45, (public.haversine_km(s.latitude, s.longitude, _lat, _lng) * 4 + 8)::int)) ELSE 15 END AS delivery_minutes,
    COALESCE(pv.selling_price, sp.price) AS price,
    COALESCE(pv.mrp, sp.price) AS mrp,
    COALESCE(pv.stock, sp.stock) AS stock
  FROM public.shops s
  JOIN public.shop_products sp ON sp.shop_id = s.id AND sp.product_id = _product_id AND sp.is_available = true
  LEFT JOIN public.product_variants pv ON pv.id = _variant_id AND pv.product_id = _product_id AND pv.is_available = true
  WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
    AND (_pincode IS NULL OR s.pincode = _pincode)
    AND (_lat IS NULL OR _lng IS NULL OR public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km)
    AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
    AND COALESCE(pv.stock, sp.stock) > 0
  ORDER BY distance_km NULLS LAST, price ASC;
$function$;

-- 3. Availability summary: open vs closed shops carrying a product
CREATE OR REPLACE FUNCTION public.product_shop_availability(_product_id uuid, _variant_id uuid DEFAULT NULL::uuid, _pincode text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision)
 RETURNS TABLE(open_shops integer, closed_shops integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH candidates AS (
    SELECT s.is_open, s.status
    FROM public.shops s
    JOIN public.shop_products sp ON sp.shop_id = s.id AND sp.product_id = _product_id AND sp.is_available = true
    LEFT JOIN public.product_variants pv ON pv.id = _variant_id AND pv.product_id = _product_id
    WHERE s.owner_id IS NOT NULL
      AND (_pincode IS NULL OR s.pincode = _pincode)
      AND (_lat IS NULL OR _lng IS NULL OR public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km)
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND COALESCE(pv.stock, sp.stock) > 0
  )
  SELECT COUNT(*) FILTER (WHERE is_open AND status = 'active')::int AS open_shops,
         COUNT(*) FILTER (WHERE NOT (is_open AND status = 'active'))::int AS closed_shops
  FROM candidates;
$function$;
REVOKE ALL ON FUNCTION public.product_shop_availability(uuid, uuid, text, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.product_shop_availability(uuid, uuid, text, double precision, double precision) TO anon, authenticated;

-- 4. Eligible shops for the whole cart
CREATE OR REPLACE FUNCTION public.list_eligible_shops_for_cart(_pincode text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision)
 RETURNS TABLE(shop_id uuid, shop_name text, shop_address text, latitude double precision, longitude double precision, pincode text, service_radius_km numeric, distance_km numeric, delivery_minutes integer, price numeric, mrp numeric, stock integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _cart_count int;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _cart_count FROM public.cart_items WHERE user_id = _uid;
  IF _cart_count = 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH cart AS (
    SELECT ci.product_id, ci.variant_id, ci.quantity FROM public.cart_items ci WHERE ci.user_id = _uid
  ),
  shop_match AS (
    SELECT s.id AS shop_id, s.name, s.address, s.latitude, s.longitude, s.pincode, s.service_radius_km
    FROM public.shops s
    WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (_pincode IS NULL OR s.pincode = _pincode)
      AND (_lat IS NULL OR _lng IS NULL OR public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km)
  ),
  eligible AS (
    SELECT sm.shop_id, sm.name, sm.address, sm.latitude, sm.longitude, sm.pincode, sm.service_radius_km,
           SUM(COALESCE(pv.selling_price, sp.price) * c.quantity) AS total_price,
           SUM(COALESCE(pv.mrp, sp.price) * c.quantity) AS total_mrp,
           MIN(COALESCE(pv.stock, sp.stock)) AS min_stock
    FROM shop_match sm
    JOIN cart c ON true
    JOIN public.shop_products sp ON sp.shop_id = sm.shop_id AND sp.product_id = c.product_id AND sp.is_available = true
    LEFT JOIN public.product_variants pv ON pv.id = c.variant_id AND pv.is_available = true
    WHERE COALESCE(pv.stock, sp.stock) >= c.quantity
    GROUP BY sm.shop_id, sm.name, sm.address, sm.latitude, sm.longitude, sm.pincode, sm.service_radius_km
    HAVING COUNT(*) = (SELECT COUNT(*) FROM cart)
  )
  SELECT e.shop_id, e.name, e.address, e.latitude, e.longitude, e.pincode, e.service_radius_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN round(public.haversine_km(e.latitude, e.longitude, _lat, _lng)::numeric, 2) ELSE NULL END AS distance_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN GREATEST(8, LEAST(45, (public.haversine_km(e.latitude, e.longitude, _lat, _lng) * 4 + 8)::int)) ELSE 15 END AS delivery_minutes,
    e.total_price::numeric AS price, e.total_mrp::numeric AS mrp, e.min_stock::int AS stock
  FROM eligible e
  ORDER BY distance_km NULLS LAST, price ASC;
END $function$;

-- 5. Routing helpers: skip closed / inactive shops
CREATE OR REPLACE FUNCTION public.find_best_shop_for_cart(_user_id uuid, _lat double precision, _lng double precision, _pincode text, _exclude uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _shop_id uuid;
BEGIN
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(_exclude))
    AND (_pincode IS NULL OR s.pincode = _pincode)
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci
      LEFT JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = s.id
      WHERE ci.user_id = _user_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < ci.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((SELECT AVG(r.rating)::numeric FROM public.reviews r
                     JOIN public.shop_products sp2 ON sp2.product_id = r.product_id
                     WHERE sp2.shop_id = s.id), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $function$;

CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_order(_order_id uuid)
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _shop_id uuid; _lat double precision; _lng double precision; _pin text; _excl uuid[];
BEGIN
  SELECT delivery_lat, delivery_lng, delivery_pincode, rejected_shop_ids
    INTO _lat, _lng, _pin, _excl
  FROM public.orders WHERE id = _order_id;
  IF _lat IS NULL THEN RETURN NULL; END IF;

  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(COALESCE(_excl, '{}'::uuid[])))
    AND (_pin IS NULL OR s.pincode = _pin)
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      LEFT JOIN public.shop_products sp ON sp.product_id = oi.product_id AND sp.shop_id = s.id
      WHERE oi.order_id = _order_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((SELECT AVG(r.rating)::numeric FROM public.reviews r
                     JOIN public.shop_products sp2 ON sp2.product_id = r.product_id
                     WHERE sp2.shop_id = s.id), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $function$;

-- 6. place_order: fall back to the next open shop if the chosen shop is closed
CREATE OR REPLACE FUNCTION public.place_order(_address jsonb, _payment_method payment_method, _coupon_code text DEFAULT NULL::text, _delivery_instruction text DEFAULT NULL::text, _delivery_type text DEFAULT 'standard_delivery'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  _rerouted boolean := false;
  _shop_name text;
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

  SELECT count(*) INTO _candidates FROM public.shops WHERE is_open = true AND status = 'active' AND owner_id IS NOT NULL;
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE is_open = true AND status = 'active' AND owner_id IS NOT NULL AND pincode = _pin) INTO _has_pin_match;
  SELECT EXISTS (
    SELECT 1 FROM public.shops s WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND s.pincode = _pin
      AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
  ) INTO _has_in_radius;

  IF _manual_shop_id IS NOT NULL THEN
    PERFORM 1 FROM public.shops s
      WHERE s.id = _manual_shop_id AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
        AND s.pincode = _pin
        AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km;
    IF FOUND THEN
      _shop_id := _manual_shop_id;
      _mode := 'manual';
      _reason_text := 'Customer manually selected shop';
    ELSE
      -- selected shop is closed / unavailable: auto route to next best open shop
      _shop_id := public.find_best_shop_for_cart(_uid, _lat, _lng, _pin, ARRAY[_manual_shop_id]);
      _mode := 'auto';
      _rerouted := _shop_id IS NOT NULL;
      _reason_text := 'Selected shop closed • auto-assigned nearest open shop';
    END IF;
  ELSE
    _shop_id := public.find_best_shop_for_cart(_uid, _lat, _lng, _pin, '{}');
    _mode := 'auto';
    _reason_text := 'Pincode ' || _pin || ' • nearest in-stock shop';
  END IF;

  IF _shop_id IS NULL THEN
    INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, outcome, reason, details)
    VALUES (NULL, _pin, _lat, _lng, _candidates,
      CASE WHEN NOT _has_pin_match THEN 'no_shop_in_pincode' WHEN NOT _has_in_radius THEN 'out_of_radius' ELSE 'no_stock' END,
      CASE WHEN NOT _has_pin_match THEN 'No open shop registered for pincode ' || _pin
           WHEN NOT _has_in_radius THEN 'Open shops in pincode ' || _pin || ' do not cover this address within their delivery radius'
           ELSE 'Open shops in pincode ' || _pin || ' do not have all requested items in stock' END,
      jsonb_build_object('user_id', _uid));
    RAISE EXCEPTION 'Sorry, all shops selling these products are currently closed or unavailable.';
  END IF;

  SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng), s.name
    INTO _distance, _shop_name FROM public.shops s WHERE s.id = _shop_id;

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

  INSERT INTO public.notifications (user_id, title, body, data)
  VALUES (_uid, 'Order placed!', 'Looking for a shop to accept your order...',
          jsonb_build_object('order_id', _order_id, 'url', '/customer/orders/' || _order_id));

  IF _rerouted THEN
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (_uid, 'Assigned to a nearby shop',
            'Your selected shop is closed, so your order was assigned to ' || COALESCE(_shop_name, 'another nearby shop') || '.',
            jsonb_build_object('order_id', _order_id, 'url', '/customer/orders/' || _order_id));
  END IF;

  RETURN _order_id;
END $function$;

-- 7. When a shop closes / is deactivated, reassign its not-yet-accepted orders
CREATE OR REPLACE FUNCTION public.reassign_orders_from_closed_shop(_shop_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _count int := 0; r record; _next uuid; _dist numeric; _next_name text;
BEGIN
  FOR r IN
    SELECT o.id, o.user_id, o.delivery_lat, o.delivery_lng, o.assignment_attempts
    FROM public.orders o
    WHERE o.shop_id = _shop_id
      AND o.status = 'awaiting_shop'::order_status
  LOOP
    -- restore stock at the closing shop
    UPDATE public.shop_products sp SET stock = sp.stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _shop_id;

    UPDATE public.orders
       SET rejected_shop_ids = (SELECT ARRAY(SELECT DISTINCT UNNEST(array_append(rejected_shop_ids, _shop_id)))),
           shop_id = NULL
     WHERE id = r.id;

    INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, responded_at)
    VALUES (r.id, _shop_id, 'rejected', 'Shop closed before accepting the order',
            COALESCE(r.assignment_attempts, 1), now());

    _next := public.find_nearest_shop_for_order(r.id);

    IF _next IS NULL THEN
      UPDATE public.orders SET status = 'no_shop_available'::order_status,
        assignment_expires_at = NULL,
        assignment_reason = 'All eligible shops are closed'
      WHERE id = r.id;

      INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason)
      VALUES (r.id, NULL, 'no_shop_available', 'All eligible shops are closed');

      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (r.user_id, 'All shops are closed',
              'Sorry, all shops selling these products are currently closed.',
              jsonb_build_object('order_id', r.id, 'url', '/customer/orders/' || r.id));
    ELSE
      UPDATE public.shop_products sp SET stock = sp.stock - oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _next;

      SELECT public.haversine_km(s.latitude, s.longitude, r.delivery_lat, r.delivery_lng), s.name
        INTO _dist, _next_name FROM public.shops s WHERE s.id = _next;

      UPDATE public.orders SET
        shop_id = _next,
        assignment_attempts = COALESCE(assignment_attempts, 1) + 1,
        assignment_expires_at = now() + interval '10 minutes',
        assignment_reason = 'Reassigned — previous shop closed',
        assignment_distance_km = _dist
      WHERE id = r.id;

      INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, assigned_at)
      VALUES (r.id, _next, 'assigned', 'Next eligible open shop after previous shop closed',
              COALESCE(r.assignment_attempts, 1) + 1, now());

      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (r.user_id, 'Assigned to a nearby shop',
              'Your order was moved to ' || COALESCE(_next_name, 'another nearby shop') || ' because the previous shop closed.',
              jsonb_build_object('order_id', r.id, 'url', '/customer/orders/' || r.id));
    END IF;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $function$;

REVOKE ALL ON FUNCTION public.reassign_orders_from_closed_shop(uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_shop_closed_reassign()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.is_open AND OLD.status = 'active') AND NOT (NEW.is_open AND NEW.status = 'active') THEN
    PERFORM public.reassign_orders_from_closed_shop(NEW.id);
  END IF;
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS shop_closed_reassign ON public.shops;
CREATE TRIGGER shop_closed_reassign
AFTER UPDATE OF is_open, status ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.tg_shop_closed_reassign();