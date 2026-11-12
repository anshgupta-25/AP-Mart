
-- =========================================================================
-- MULTI-SHOP CONSOLIDATED ORDER SYSTEM (Phase 1 + Phase 2)
-- Extends existing single-shop schema; existing orders unaffected.
-- =========================================================================

-- ---------- 1. Schema additions to orders ----------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_otp text,
  ADD COLUMN IF NOT EXISTS pickup_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS prep_time_minutes integer,
  ADD COLUMN IF NOT EXISTS shop_count integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_orders_parent ON public.orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_parent ON public.orders(is_parent) WHERE is_parent = true;

-- ---------- 2. Schema additions to order_items ----------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS child_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shop_product_id uuid REFERENCES public.shop_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_child ON public.order_items(child_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop ON public.order_items(shop_id);

-- ---------- 3. Inventory reservations ----------
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  child_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_product_id uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  expires_at timestamptz NOT NULL,
  released boolean NOT NULL DEFAULT false,
  released_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_parent ON public.inventory_reservations(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_active
  ON public.inventory_reservations(shop_product_id) WHERE released = false;

GRANT SELECT ON public.inventory_reservations TO authenticated;
GRANT ALL ON public.inventory_reservations TO service_role;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_customer_read" ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = parent_order_id AND o.user_id = auth.uid()));

CREATE POLICY "reservations_admin_read" ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- 4. Pickup events (audit) ----------
CREATE TABLE IF NOT EXISTS public.pickup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  child_order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  actor_user_id uuid,
  event text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pickup_events_parent ON public.pickup_events(parent_order_id);

GRANT SELECT ON public.pickup_events TO authenticated;
GRANT ALL ON public.pickup_events TO service_role;
ALTER TABLE public.pickup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pickup_events_customer_read" ON public.pickup_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = parent_order_id AND o.user_id = auth.uid()));

CREATE POLICY "pickup_events_shopkeeper_read" ON public.pickup_events
  FOR SELECT TO authenticated
  USING (shop_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shops s WHERE s.id = pickup_events.shop_id AND s.owner_id = auth.uid()
  ));

CREATE POLICY "pickup_events_partner_read" ON public.pickup_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.delivery_partners dp ON dp.id = o.partner_id
    WHERE o.id = parent_order_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "pickup_events_admin_read" ON public.pickup_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- 5. Helper: effective available stock (stock - active reservations) ----------
CREATE OR REPLACE FUNCTION public.effective_available_stock(_shop_product_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(
    0,
    (SELECT stock FROM shop_products WHERE id = _shop_product_id)
    - COALESCE((
        SELECT SUM(quantity) FROM inventory_reservations
        WHERE shop_product_id = _shop_product_id
          AND released = false
          AND expires_at > now()
      ), 0)::int
  )
$$;

-- ---------- 6. Helper: greedy set-cover for min-shops multi-shop plan ----------
-- Returns rows: shop_id, distance_km, product_id, variant_id, quantity, price, name
DROP FUNCTION IF EXISTS public.plan_multi_shop_cart(uuid, double precision, double precision, text);
CREATE OR REPLACE FUNCTION public.plan_multi_shop_cart(
  _user uuid,
  _lat double precision,
  _lng double precision,
  _pincode text
)
RETURNS TABLE (
  shop_id uuid,
  shop_name text,
  distance_km numeric,
  product_id uuid,
  variant_id uuid,
  quantity integer,
  price numeric,
  shop_product_id uuid,
  product_name text,
  image_url text,
  unit text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  remaining_items uuid[];
  chosen_shop uuid;
  chosen_dist numeric;
BEGIN
  -- Build eligible pool: (product_id, shop_id, price, distance, stock)
  CREATE TEMP TABLE IF NOT EXISTS _pool ON COMMIT DROP AS
  SELECT ci.product_id,
         ci.variant_id,
         ci.quantity::int AS qty,
         sp.shop_id,
         s.name AS shop_name,
         sp.id AS shop_product_id,
         sp.price::numeric AS price,
         effective_available_stock(sp.id) AS avail_stock,
         (CASE WHEN _lat IS NULL OR _lng IS NULL THEN NULL
               ELSE ROUND((6371 * acos(LEAST(1, cos(radians(_lat)) * cos(radians(s.latitude))
                    * cos(radians(s.longitude) - radians(_lng))
                    + sin(radians(_lat)) * sin(radians(s.latitude)))))::numeric, 2)
          END) AS distance_km,
         p.name AS product_name,
         p.image_url,
         p.unit
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  JOIN shop_products sp ON sp.product_id = ci.product_id AND sp.is_available = true
  JOIN shops s ON s.id = sp.shop_id AND s.is_open = true AND s.owner_id IS NOT NULL
  WHERE ci.user_id = _user
    AND (_pincode IS NULL OR s.pincode = _pincode OR
         (_lat IS NOT NULL AND _lng IS NOT NULL
          AND (6371 * acos(LEAST(1, cos(radians(_lat)) * cos(radians(s.latitude))
               * cos(radians(s.longitude) - radians(_lng))
               + sin(radians(_lat)) * sin(radians(s.latitude))))) <= COALESCE(s.service_radius_km, 8)))
    AND effective_available_stock(sp.id) >= ci.quantity;

  -- Products still needing a shop
  SELECT ARRAY(SELECT DISTINCT product_id FROM _pool) INTO remaining_items;

  CREATE TEMP TABLE IF NOT EXISTS _plan(
    shop_id uuid, product_id uuid, variant_id uuid, qty int,
    shop_product_id uuid, price numeric, shop_name text,
    distance_km numeric, product_name text, image_url text, unit text
  ) ON COMMIT DROP;

  -- Greedy set-cover: pick the shop that covers the MOST remaining items;
  -- tiebreak by shortest average distance, then lowest total price.
  WHILE array_length(remaining_items, 1) > 0 LOOP
    SELECT p.shop_id, AVG(p.distance_km) INTO chosen_shop, chosen_dist
    FROM _pool p
    WHERE p.product_id = ANY(remaining_items)
    GROUP BY p.shop_id
    ORDER BY COUNT(DISTINCT p.product_id) DESC,
             AVG(COALESCE(p.distance_km, 999)) ASC,
             SUM(p.price * p.qty) ASC
    LIMIT 1;

    IF chosen_shop IS NULL THEN EXIT; END IF;

    INSERT INTO _plan
    SELECT DISTINCT ON (p.product_id)
      p.shop_id, p.product_id, p.variant_id, p.qty,
      p.shop_product_id, p.price, p.shop_name, p.distance_km,
      p.product_name, p.image_url, p.unit
    FROM _pool p
    WHERE p.shop_id = chosen_shop
      AND p.product_id = ANY(remaining_items)
    ORDER BY p.product_id, p.price ASC;

    remaining_items := ARRAY(
      SELECT unnest(remaining_items) EXCEPT SELECT product_id FROM _plan
    );
  END LOOP;

  RETURN QUERY
    SELECT pl.shop_id, pl.shop_name, pl.distance_km, pl.product_id, pl.variant_id,
           pl.qty, pl.price, pl.shop_product_id, pl.product_name, pl.image_url, pl.unit
    FROM _plan pl;

  DROP TABLE IF EXISTS _pool;
  DROP TABLE IF EXISTS _plan;
END $$;

REVOKE ALL ON FUNCTION public.plan_multi_shop_cart(uuid, double precision, double precision, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_multi_shop_cart(uuid, double precision, double precision, text) TO authenticated;

-- ---------- 7. place_multi_shop_order — main entry point ----------
DROP FUNCTION IF EXISTS public.place_multi_shop_order(jsonb, text, text, text, double precision, double precision, text, text);
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
  fast_fee numeric := CASE WHEN _delivery_type = 'fast_delivery' THEN 30 ELSE 0 END;
  del_fee numeric := 20;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT COUNT(DISTINCT product_id) INTO cart_product_count FROM cart_items WHERE user_id = uid;
  IF cart_product_count = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  -- Materialize plan
  CREATE TEMP TABLE _cart_plan ON COMMIT DROP AS
    SELECT * FROM plan_multi_shop_cart(uid, _lat, _lng, _pincode);

  SELECT COUNT(DISTINCT product_id) INTO plan_product_count FROM _cart_plan;
  IF plan_product_count < cart_product_count THEN
    RAISE EXCEPTION 'no_coverage: only % of % cart items can be sourced', plan_product_count, cart_product_count;
  END IF;

  SELECT ARRAY(SELECT DISTINCT shop_id FROM _cart_plan) INTO distinct_shops;

  -- Reserve inventory (5 min)
  INSERT INTO inventory_reservations(parent_order_id, shop_product_id, quantity, expires_at)
    SELECT NULL, shop_product_id, qty, now() + interval '5 minutes' FROM _cart_plan;
  -- We'll patch parent_order_id after creating parent.

  -- Totals
  SELECT COALESCE(SUM(price * qty), 0) INTO total_subtotal FROM _cart_plan;
  total_amount := total_subtotal + del_fee + fast_fee;

  -- Create PARENT order (aggregate; shop_id NULL)
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
  ) RETURNING id, order_number INTO parent_id, parent_number;

  -- Attach reservations to parent
  UPDATE inventory_reservations SET parent_order_id = parent_id
    WHERE parent_order_id IS NULL
      AND shop_product_id IN (SELECT shop_product_id FROM _cart_plan);

  -- Create CHILD orders — one per shop
  FOR plan_rows IN
    SELECT shop_id, shop_name,
           SUM(price * qty)::numeric AS sub,
           MIN(distance_km) AS dist
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

    -- Move items belonging to this shop
    INSERT INTO order_items(order_id, child_order_id, shop_id, shop_product_id,
                            product_id, variant_id, name, image_url, unit, price, quantity)
    SELECT parent_id, child_id, cp.shop_id, cp.shop_product_id,
           cp.product_id, cp.variant_id, cp.product_name, cp.image_url, cp.unit,
           cp.price, cp.qty
    FROM _cart_plan cp WHERE cp.shop_id = plan_rows.shop_id;

    -- Attach reservations to child
    UPDATE inventory_reservations SET child_order_id = child_id
      WHERE parent_order_id = parent_id
        AND shop_product_id IN (SELECT shop_product_id FROM _cart_plan WHERE shop_id = plan_rows.shop_id);

    -- Assignment history entry
    INSERT INTO shop_assignment_history(order_id, shop_id, status, attempt_number)
      VALUES (parent_id, plan_rows.shop_id, 'assigned', 1);

    -- Notify shopkeeper
    PERFORM notify_user((SELECT owner_id FROM shops WHERE id = plan_rows.shop_id),
                       'New order — ' || parent_number,
                       'A new order needs your acceptance within 60 seconds.',
                       'order',
                       jsonb_build_object('order_id', child_id, 'parent_order_id', parent_id));
  END LOOP;

  -- Notify customer
  PERFORM notify_user(uid, 'Order placed — ' || parent_number,
                     'Finding shops for your order…', 'order',
                     jsonb_build_object('order_id', parent_id));

  DROP TABLE IF EXISTS _cart_plan;

  -- Clear cart
  DELETE FROM cart_items WHERE user_id = uid;

  RETURN QUERY SELECT parent_id, parent_number, array_length(distinct_shops, 1), total_amount;
END $$;

REVOKE ALL ON FUNCTION public.place_multi_shop_order(jsonb, text, text, text, double precision, double precision, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_multi_shop_order(jsonb, text, text, text, double precision, double precision, text, text) TO authenticated;

-- ---------- 8. Child accept / reject ----------
CREATE OR REPLACE FUNCTION public.shop_accept_child(_child_id uuid, _prep_minutes int DEFAULT 15)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_id uuid; ord record;
BEGIN
  SELECT o.* INTO ord FROM orders o
    WHERE o.id = _child_id
      AND o.parent_order_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'child not found or not yours'; END IF;
  IF ord.status <> 'awaiting_shop' THEN RAISE EXCEPTION 'already processed'; END IF;

  UPDATE orders SET status = 'accepted_by_shop', prep_time_minutes = _prep_minutes, updated_at = now()
    WHERE id = _child_id;
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event, detail)
    VALUES (ord.parent_order_id, _child_id, ord.shop_id, auth.uid(), 'shop_accepted',
            jsonb_build_object('prep_minutes', _prep_minutes));

  -- If ALL siblings accepted, promote parent to accepted_by_shop
  IF NOT EXISTS (
    SELECT 1 FROM orders WHERE parent_order_id = ord.parent_order_id AND status = 'awaiting_shop'
  ) AND NOT EXISTS (
    SELECT 1 FROM orders WHERE parent_order_id = ord.parent_order_id AND status = 'cancelled'
  ) THEN
    UPDATE orders SET status = 'accepted_by_shop', updated_at = now()
      WHERE id = ord.parent_order_id AND status = 'awaiting_shop';
    PERFORM notify_user((SELECT user_id FROM orders WHERE id = ord.parent_order_id),
                       'All shops confirmed', 'Your order is being prepared.', 'order',
                       jsonb_build_object('order_id', ord.parent_order_id));
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.shop_accept_child(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_accept_child(uuid, int) TO authenticated;

-- Try to find a replacement shop for a set of products (excluding rejected shops)
CREATE OR REPLACE FUNCTION public.shop_reject_child(_child_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ord record; parent_id uuid; excluded_shops uuid[];
  replacement_shop uuid; replacement_name text; replacement_dist numeric;
  covered_products uuid[]; new_child_id uuid;
  child_sub numeric := 0; parent_row record;
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

  -- Mark child rejected and release its reservations
  UPDATE orders SET status = 'cancelled', cancel_reason = _reason, cancelled_at = now(), updated_at = now()
    WHERE id = _child_id;
  UPDATE inventory_reservations SET released = true, released_reason = 'shop_rejected'
    WHERE child_order_id = _child_id AND released = false;

  INSERT INTO shop_assignment_history(order_id, shop_id, status, reason, responded_at)
    VALUES (parent_id, ord.shop_id, 'rejected', _reason, now());
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event, detail)
    VALUES (parent_id, _child_id, ord.shop_id, auth.uid(), 'shop_rejected', jsonb_build_object('reason', _reason));

  -- Add to permanent exclusion on parent
  UPDATE orders SET rejected_shop_ids = array_append(rejected_shop_ids, ord.shop_id)
    WHERE id = parent_id AND NOT (rejected_shop_ids @> ARRAY[ord.shop_id]);

  SELECT * INTO parent_row FROM orders WHERE id = parent_id;
  excluded_shops := parent_row.rejected_shop_ids;

  -- Collect products from rejected child
  SELECT ARRAY(SELECT product_id FROM order_items WHERE child_order_id = _child_id)
    INTO covered_products;

  -- Look for ONE alternative shop that covers ALL those products
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
    -- No single-shop replacement — mark parent needs_customer_action
    UPDATE orders SET routing_status = 'partial_no_replacement', updated_at = now()
      WHERE id = parent_id;
    PERFORM notify_user(parent_row.user_id,
      'Some items unavailable',
      'A shop rejected part of your order and no replacement was found. Please review options.',
      'order', jsonb_build_object('order_id', parent_id));
    RETURN jsonb_build_object('replaced', false, 'reason', 'no_replacement');
  END IF;

  -- Create replacement child, copy items, reserve inventory
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
    SELECT parent_id, new_child_id, replacement_shop,
           (SELECT id FROM shop_products WHERE shop_id = replacement_shop AND product_id = oi.product_id),
           oi.product_id, oi.variant_id, oi.name, oi.image_url, oi.unit,
           COALESCE((SELECT price FROM shop_products WHERE shop_id = replacement_shop AND product_id = oi.product_id), oi.price),
           oi.quantity
    FROM order_items oi WHERE oi.child_order_id = _child_id;

  INSERT INTO inventory_reservations(parent_order_id, child_order_id, shop_product_id, quantity, expires_at)
    SELECT parent_id, new_child_id, oi.shop_product_id, oi.quantity, now() + interval '5 minutes'
    FROM order_items oi WHERE oi.child_order_id = new_child_id;

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

-- ---------- 9. Ready / pickup / delivery ----------
CREATE OR REPLACE FUNCTION public.shop_mark_child_ready(_child_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ord record;
BEGIN
  SELECT o.* INTO ord FROM orders o
    WHERE o.id = _child_id
      AND EXISTS (SELECT 1 FROM shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not your child'; END IF;
  UPDATE orders SET status = 'packed', ready_for_pickup_at = now(), updated_at = now() WHERE id = _child_id;
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event)
    VALUES (ord.parent_order_id, _child_id, ord.shop_id, auth.uid(), 'ready_for_pickup');

  -- If ALL children ready, promote parent to packed
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE parent_order_id = ord.parent_order_id
      AND status NOT IN ('packed','cancelled')
  ) THEN
    UPDATE orders SET status = 'packed', ready_for_pickup_at = now(), updated_at = now()
      WHERE id = ord.parent_order_id;
    -- Consume reservations (deduct stock, mark released)
    UPDATE shop_products sp SET stock = GREATEST(0, sp.stock - r.quantity)
      FROM inventory_reservations r
      WHERE r.shop_product_id = sp.id
        AND r.parent_order_id = ord.parent_order_id
        AND r.released = false;
    UPDATE inventory_reservations SET released = true, released_reason = 'consumed'
      WHERE parent_order_id = ord.parent_order_id AND released = false;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.shop_mark_child_ready(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_mark_child_ready(uuid) TO authenticated;

-- Rider pickup verification with OTP
CREATE OR REPLACE FUNCTION public.rider_verify_pickup(_child_id uuid, _otp text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ord record; parent record;
BEGIN
  SELECT o.* INTO ord FROM orders o WHERE o.id = _child_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'child not found'; END IF;
  SELECT * INTO parent FROM orders WHERE id = ord.parent_order_id;
  IF NOT EXISTS (
    SELECT 1 FROM delivery_partners dp WHERE dp.id = parent.partner_id AND dp.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not your delivery'; END IF;
  IF ord.pickup_otp IS DISTINCT FROM _otp THEN RAISE EXCEPTION 'invalid OTP'; END IF;

  UPDATE orders SET pickup_verified_at = now(), updated_at = now() WHERE id = _child_id;
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event)
    VALUES (parent.id, _child_id, ord.shop_id, auth.uid(), 'pickup_verified');

  -- If ALL children verified, promote parent to out_for_delivery
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE parent_order_id = parent.id AND status <> 'cancelled' AND pickup_verified_at IS NULL
  ) THEN
    UPDATE orders SET status = 'out_for_delivery', updated_at = now() WHERE id = parent.id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.rider_verify_pickup(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_verify_pickup(uuid, text) TO authenticated;

-- ---------- 10. Reservation expiry / stale cleanup ----------
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  WITH freed AS (
    UPDATE inventory_reservations SET released = true, released_reason = 'expired'
    WHERE released = false AND expires_at < now()
    RETURNING parent_order_id
  )
  SELECT COUNT(*) INTO n FROM freed;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.release_expired_reservations() TO authenticated;

-- ---------- 11. Debug timeline for admin ----------
CREATE OR REPLACE FUNCTION public.admin_order_timeline(_parent_id uuid)
RETURNS TABLE(at timestamptz, event text, actor uuid, detail jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT created_at, event, actor_user_id, detail FROM pickup_events WHERE parent_order_id = _parent_id
  UNION ALL
  SELECT assigned_at, 'assign_' || status, NULL, jsonb_build_object('shop_id', shop_id, 'reason', reason, 'attempt', attempt_number)
    FROM shop_assignment_history WHERE order_id = _parent_id
  ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.admin_order_timeline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_order_timeline(uuid) TO authenticated;

-- ---------- 12. Realtime for pickup events + reservations ----------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pickup_events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
