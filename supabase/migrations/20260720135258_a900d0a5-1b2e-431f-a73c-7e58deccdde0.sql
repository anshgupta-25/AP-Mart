
-- Redefine place_multi_shop_order: order_items.order_id points to CHILD.
CREATE OR REPLACE FUNCTION public.place_multi_shop_order(
  _address jsonb,
  _payment_method text,
  _coupon_code text DEFAULT NULL,
  _delivery_instruction text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _pincode text DEFAULT NULL,
  _delivery_type text DEFAULT 'standard_delivery'
)
RETURNS TABLE (parent_order_id uuid, order_number text, shop_count int, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  fast_fee numeric := CASE WHEN _delivery_type = 'fast_delivery' THEN 100 ELSE 0 END;
  del_fee numeric := 20;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT COUNT(DISTINCT product_id) INTO cart_product_count FROM cart_items WHERE user_id = uid;
  IF cart_product_count = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  CREATE TEMP TABLE _cart_plan ON COMMIT DROP AS
    SELECT * FROM plan_multi_shop_cart(uid, _lat, _lng, _pincode);

  SELECT COUNT(DISTINCT product_id) INTO plan_product_count FROM _cart_plan;
  IF plan_product_count < cart_product_count THEN
    RAISE EXCEPTION 'no_coverage: only % of % cart items can be sourced', plan_product_count, cart_product_count;
  END IF;

  SELECT ARRAY(SELECT DISTINCT shop_id FROM _cart_plan) INTO distinct_shops;

  SELECT COALESCE(SUM(price * qty), 0) INTO total_subtotal FROM _cart_plan;
  total_amount := total_subtotal + del_fee + fast_fee;

  -- Parent order (aggregate, no shop_id)
  INSERT INTO orders(
    user_id, status, payment_method, subtotal, delivery_fee, handling_fee, tax, total,
    coupon_code, address, delivery_instruction, delivery_lat, delivery_lng,
    delivery_pincode, delivery_type, fast_delivery_fee, is_parent, shop_count,
    shop_selection_mode
  ) VALUES (
    uid, 'awaiting_shop', _payment_method::payment_method, total_subtotal, del_fee, 0, 0, total_amount,
    _coupon_code, _address, _delivery_instruction, _lat, _lng,
    _pincode, _delivery_type, fast_fee, true, array_length(distinct_shops, 1),
    'auto'
  ) RETURNING id, orders.order_number INTO parent_id, parent_number;

  -- Child orders per shop + items
  FOR plan_rows IN
    SELECT shop_id, shop_name, SUM(price * qty)::numeric AS sub, MIN(distance_km) AS dist
    FROM _cart_plan GROUP BY shop_id, shop_name
  LOOP
    INSERT INTO orders(
      user_id, status, payment_method, subtotal, delivery_fee, handling_fee, tax, total,
      address, delivery_lat, delivery_lng, delivery_pincode, delivery_type,
      shop_id, parent_order_id, is_parent, shop_count,
      assignment_distance_km, pickup_otp
    ) VALUES (
      uid, 'awaiting_shop', _payment_method::payment_method, plan_rows.sub, 0, 0, 0, plan_rows.sub,
      _address, _lat, _lng, _pincode, _delivery_type,
      plan_rows.shop_id, parent_id, false, 1,
      plan_rows.dist, lpad(floor(random() * 9000 + 1000)::text, 4, '0')
    ) RETURNING id INTO child_id;

    -- Items belong to the CHILD (so existing shopkeeper queries by order_id work)
    INSERT INTO order_items(order_id, child_order_id, shop_id, shop_product_id,
                            product_id, variant_id, name, image_url, unit, price, quantity)
    SELECT child_id, child_id, cp.shop_id, cp.shop_product_id,
           cp.product_id, cp.variant_id, cp.product_name, cp.image_url, cp.unit,
           cp.price, cp.qty
    FROM _cart_plan cp WHERE cp.shop_id = plan_rows.shop_id;

    -- Reserve inventory (5 min hold)
    INSERT INTO inventory_reservations(parent_order_id, child_order_id, shop_product_id, quantity, expires_at)
    SELECT parent_id, child_id, cp.shop_product_id, cp.qty, now() + interval '5 minutes'
    FROM _cart_plan cp WHERE cp.shop_id = plan_rows.shop_id;

    INSERT INTO shop_assignment_history(order_id, shop_id, status, attempt_number)
      VALUES (parent_id, plan_rows.shop_id, 'assigned', 1);

    PERFORM notify_user((SELECT owner_id FROM shops WHERE id = plan_rows.shop_id),
                       'New order — ' || parent_number,
                       'A new order needs your acceptance within 60 seconds.',
                       'order',
                       jsonb_build_object('order_id', child_id, 'parent_order_id', parent_id));
  END LOOP;

  PERFORM notify_user(uid, 'Order placed — ' || parent_number,
                     'Finding shops for your order…', 'order',
                     jsonb_build_object('order_id', parent_id));

  DROP TABLE IF EXISTS _cart_plan;
  DELETE FROM cart_items WHERE user_id = uid;

  RETURN QUERY SELECT parent_id, parent_number, array_length(distinct_shops, 1), total_amount;
END $$;

REVOKE ALL ON FUNCTION public.place_multi_shop_order(jsonb, text, text, text, double precision, double precision, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_multi_shop_order(jsonb, text, text, text, double precision, double precision, text, text) TO authenticated;

-- Similarly fix shop_reject_child so replacement child owns its items
CREATE OR REPLACE FUNCTION public.shop_reject_child(_child_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ord record; parent_id uuid; excluded_shops uuid[];
  replacement_shop uuid; replacement_name text; replacement_dist numeric;
  covered_products uuid[]; new_child_id uuid;
  parent_row record;
BEGIN
  SELECT o.* INTO ord FROM orders o
    WHERE o.id = _child_id AND o.parent_order_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'child not found or not yours'; END IF;
  IF ord.status NOT IN ('awaiting_shop','accepted_by_shop') THEN
    RAISE EXCEPTION 'cannot reject in status %', ord.status;
  END IF;

  parent_id := ord.parent_order_id;

  UPDATE orders SET status = 'cancelled', cancel_reason = _reason, cancelled_at = now(), updated_at = now()
    WHERE id = _child_id;
  UPDATE inventory_reservations SET released = true, released_reason = 'shop_rejected'
    WHERE child_order_id = _child_id AND released = false;

  INSERT INTO shop_assignment_history(order_id, shop_id, status, reason, responded_at)
    VALUES (parent_id, ord.shop_id, 'rejected', _reason, now());
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event, detail)
    VALUES (parent_id, _child_id, ord.shop_id, auth.uid(), 'shop_rejected', jsonb_build_object('reason', _reason));

  UPDATE orders SET rejected_shop_ids = array_append(rejected_shop_ids, ord.shop_id)
    WHERE id = parent_id AND NOT (rejected_shop_ids @> ARRAY[ord.shop_id]);

  SELECT * INTO parent_row FROM orders WHERE id = parent_id;
  excluded_shops := parent_row.rejected_shop_ids;

  SELECT ARRAY(SELECT product_id FROM order_items WHERE order_id = _child_id) INTO covered_products;

  SELECT sp.shop_id, s.name,
         (CASE WHEN parent_row.delivery_lat IS NULL THEN NULL
               ELSE ROUND((6371 * acos(LEAST(1, cos(radians(parent_row.delivery_lat)) * cos(radians(s.latitude))
                    * cos(radians(s.longitude) - radians(parent_row.delivery_lng))
                    + sin(radians(parent_row.delivery_lat)) * sin(radians(s.latitude)))))::numeric, 2)
          END) AS dist
    INTO replacement_shop, replacement_name, replacement_dist
  FROM shop_products sp
  JOIN shops s ON s.id = sp.shop_id AND s.is_open = true AND s.owner_id IS NOT NULL
  WHERE sp.product_id = ANY(covered_products)
    AND sp.is_available = true
    AND NOT (excluded_shops @> ARRAY[sp.shop_id])
    AND effective_available_stock(sp.id) > 0
  GROUP BY sp.shop_id, s.name, s.latitude, s.longitude
  HAVING COUNT(DISTINCT sp.product_id) = array_length(covered_products, 1)
  ORDER BY dist NULLS LAST
  LIMIT 1;

  IF replacement_shop IS NULL THEN
    UPDATE orders SET routing_status = 'partial_no_replacement', updated_at = now()
      WHERE id = parent_id;
    PERFORM notify_user(parent_row.user_id,
      'Some items unavailable',
      'A shop rejected part of your order and no replacement was found. Please review options.',
      'order', jsonb_build_object('order_id', parent_id));
    RETURN jsonb_build_object('replaced', false, 'reason', 'no_replacement');
  END IF;

  INSERT INTO orders(user_id, status, payment_method, subtotal, delivery_fee, handling_fee, tax, total,
                     address, delivery_lat, delivery_lng, delivery_pincode, delivery_type,
                     shop_id, parent_order_id, is_parent, shop_count, assignment_distance_km, pickup_otp)
    SELECT parent_row.user_id, 'awaiting_shop', parent_row.payment_method, ord.subtotal, 0, 0, 0, ord.subtotal,
           parent_row.address, parent_row.delivery_lat, parent_row.delivery_lng,
           parent_row.delivery_pincode, parent_row.delivery_type,
           replacement_shop, parent_id, false, 1, replacement_dist,
           lpad(floor(random() * 9000 + 1000)::text, 4, '0')
    RETURNING id INTO new_child_id;

  INSERT INTO order_items(order_id, child_order_id, shop_id, shop_product_id,
                          product_id, variant_id, name, image_url, unit, price, quantity)
    SELECT new_child_id, new_child_id, replacement_shop,
           (SELECT id FROM shop_products WHERE shop_id = replacement_shop AND product_id = oi.product_id),
           oi.product_id, oi.variant_id, oi.name, oi.image_url, oi.unit,
           COALESCE((SELECT price FROM shop_products WHERE shop_id = replacement_shop AND product_id = oi.product_id), oi.price),
           oi.quantity
    FROM order_items oi WHERE oi.order_id = _child_id;

  INSERT INTO inventory_reservations(parent_order_id, child_order_id, shop_product_id, quantity, expires_at)
    SELECT parent_id, new_child_id, oi.shop_product_id, oi.quantity, now() + interval '5 minutes'
    FROM order_items oi WHERE oi.order_id = new_child_id;

  INSERT INTO shop_assignment_history(order_id, shop_id, status, attempt_number)
    VALUES (parent_id, replacement_shop, 'assigned',
            (SELECT COUNT(*)+1 FROM shop_assignment_history WHERE order_id = parent_id));
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event, detail)
    VALUES (parent_id, new_child_id, replacement_shop, NULL, 'replacement_assigned',
            jsonb_build_object('replaced_child', _child_id));

  PERFORM notify_user((SELECT owner_id FROM shops WHERE id = replacement_shop),
                     'New order — ' || parent_row.order_number,
                     'Replacement order needs your acceptance.',
                     'order', jsonb_build_object('order_id', new_child_id, 'parent_order_id', parent_id));

  RETURN jsonb_build_object('replaced', true, 'new_child_id', new_child_id, 'shop_id', replacement_shop, 'shop_name', replacement_name);
END $$;
REVOKE ALL ON FUNCTION public.shop_reject_child(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_reject_child(uuid, text) TO authenticated;

-- Update RLS on order_items so shopkeeper can read items belonging to their child orders
DROP POLICY IF EXISTS "oi_shop_owner_select" ON public.order_items;
CREATE POLICY "oi_shop_owner_select" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = order_items.order_id AND s.owner_id = auth.uid()
  ));

-- And so delivery partner can read all items across a parent's children
DROP POLICY IF EXISTS "oi_partner_select" ON public.order_items;
CREATE POLICY "oi_partner_select" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.orders p ON p.id = COALESCE(o.parent_order_id, o.id)
    JOIN public.delivery_partners dp ON dp.id = p.partner_id
    WHERE o.id = order_items.order_id AND dp.user_id = auth.uid()
  ));

-- Allow customer to read their child orders (already covered by user_id policy on orders)
-- Verify parent-child user_id match: yes, both set to uid in place_multi_shop_order.
