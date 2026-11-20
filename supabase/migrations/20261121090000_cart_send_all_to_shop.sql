-- "Send all to shop": let a customer lock the whole cart to one shop.
--
-- place_multi_shop_order normally re-plans the cart with plan_multi_shop_cart,
-- which may split items across several shops. With _lock_shop_id set, every
-- item is sourced from that one shop instead (same open / stock / service-area
-- rules); if it cannot supply everything the order is refused with
-- shop_lock_unavailable. Without _lock_shop_id behaviour is unchanged.
-- The body below is the 20260728075929 definition plus the lock branch.

-- 1) Single-shop planner (same columns as plan_multi_shop_cart) --------------
CREATE OR REPLACE FUNCTION public.plan_single_shop_cart(
  _user uuid, _shop_id uuid, _lat double precision, _lng double precision, _pincode text
)
RETURNS TABLE(shop_id uuid, shop_name text, distance_km numeric, product_id uuid, variant_id uuid,
              quantity integer, price numeric, shop_product_id uuid, product_name text,
              image_url text, unit text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (ci.product_id)
         sp.shop_id,
         s.name,
         (CASE WHEN _lat IS NULL OR _lng IS NULL THEN NULL
               ELSE ROUND((6371 * acos(LEAST(1, cos(radians(_lat)) * cos(radians(s.latitude))
                    * cos(radians(s.longitude) - radians(_lng))
                    + sin(radians(_lat)) * sin(radians(s.latitude)))))::numeric, 2)
          END),
         ci.product_id,
         ci.variant_id,
         ci.quantity::int,
         sp.price::numeric,
         sp.id,
         p.name,
         p.image_url,
         p.unit
  FROM cart_items ci
  JOIN products p       ON p.id = ci.product_id
  JOIN shop_products sp ON sp.product_id = ci.product_id
                       AND sp.shop_id = _shop_id
                       AND sp.is_available = true
  JOIN shops s          ON s.id = sp.shop_id AND s.is_open = true AND s.owner_id IS NOT NULL
  WHERE ci.user_id = _user
    AND (_pincode IS NULL OR s.pincode = _pincode OR
         (_lat IS NOT NULL AND _lng IS NOT NULL
          AND (6371 * acos(LEAST(1, cos(radians(_lat)) * cos(radians(s.latitude))
               * cos(radians(s.longitude) - radians(_lng))
               + sin(radians(_lat)) * sin(radians(s.latitude))))) <= COALESCE(s.service_radius_km, 8)))
    AND effective_available_stock(sp.id) >= ci.quantity
  ORDER BY ci.product_id, sp.price ASC;
$function$;

-- Only called from place_multi_shop_order (SECURITY DEFINER); never directly.
REVOKE ALL ON FUNCTION public.plan_single_shop_cart(uuid, uuid, double precision, double precision, text)
  FROM PUBLIC, anon, authenticated;

-- 2) place_multi_shop_order with optional _lock_shop_id -----------------------
-- Drop the 8-argument version first so PostgREST has one unambiguous function.
DROP FUNCTION IF EXISTS public.place_multi_shop_order(jsonb, text, text, text, double precision, double precision, text, text);

CREATE OR REPLACE FUNCTION public.place_multi_shop_order(_address jsonb, _payment_method text, _coupon_code text DEFAULT NULL::text, _delivery_instruction text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _pincode text DEFAULT NULL::text, _delivery_type text DEFAULT 'standard_delivery'::text, _lock_shop_id uuid DEFAULT NULL::uuid)
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
  -- "Send all to shop": source every item from the shop the customer locked.
  IF _lock_shop_id IS NOT NULL THEN
    CREATE TEMP TABLE _cart_plan ON COMMIT DROP AS
      SELECT * FROM plan_single_shop_cart(uid, _lock_shop_id, _lat, _lng, _pincode);
  ELSE
    CREATE TEMP TABLE _cart_plan ON COMMIT DROP AS
      SELECT * FROM plan_multi_shop_cart(uid, _lat, _lng, _pincode);
  END IF;

  SELECT COUNT(DISTINCT cp.product_id) INTO plan_product_count FROM _cart_plan cp;
  IF plan_product_count < cart_product_count THEN
    IF _lock_shop_id IS NOT NULL THEN
      RAISE EXCEPTION 'shop_lock_unavailable: the selected shop can supply only % of % cart items', plan_product_count, cart_product_count;
    END IF;
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

REVOKE ALL ON FUNCTION public.place_multi_shop_order(jsonb, text, text, text, double precision, double precision, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_multi_shop_order(jsonb, text, text, text, double precision, double precision, text, text, uuid) TO authenticated;
