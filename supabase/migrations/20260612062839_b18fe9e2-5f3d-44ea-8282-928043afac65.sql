
-- 1. New columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'standard_delivery',
  ADD COLUMN IF NOT EXISTS fast_delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ready_for_pickup_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_delivery_type_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_type_check
      CHECK (delivery_type IN ('fast_delivery','standard_delivery','pickup'));
  END IF;
END $$;

-- 2. Replace place_order to accept delivery_type and compute fee accordingly
DROP FUNCTION IF EXISTS public.place_order(jsonb, payment_method, text, text);
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

  IF _delivery_type = 'fast_delivery' THEN
    _fast_fee := 100;
    _delivery_fee := 100;
  ELSE
    _fast_fee := 0;
    _delivery_fee := 0;
  END IF;

  _total := _subtotal - _discount + _delivery_fee + _handling;

  INSERT INTO public.orders (
    user_id, shop_id, address, delivery_lat, delivery_lng,
    payment_method, payment_status, status,
    subtotal, discount, delivery_fee, handling_fee, tax, total,
    coupon_code, delivery_instruction, assignment_attempts, assignment_expires_at,
    delivery_type, fast_delivery_fee
  ) VALUES (
    _uid, _shop_id, _address, _lat, _lng,
    _payment_method, 'pending'::payment_status, 'awaiting_shop'::order_status,
    _subtotal, _discount, _delivery_fee, _handling, 0, _total,
    _coupon_code, _delivery_instruction, 1, now() + interval '60 seconds',
    _delivery_type, _fast_fee
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

-- 3. Update shop_mark_packed: skip partner assignment for pickup orders, notify customer
CREATE OR REPLACE FUNCTION public.shop_mark_packed(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _uid uuid := auth.uid();
  _shop_id uuid;
  _cust uuid;
  _partner_id uuid;
  _partner_user uuid;
  _order_number text;
  _dt text;
BEGIN
  SELECT shop_id, user_id, order_number, delivery_type
    INTO _shop_id, _cust, _order_number, _dt
  FROM public.orders WHERE id = _order_id;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  UPDATE public.orders
  SET status = 'packed'::order_status, updated_at = now()
  WHERE id = _order_id AND status = 'accepted_by_shop'::order_status;

  IF _dt = 'pickup' THEN
    UPDATE public.orders SET ready_for_pickup_at = now() WHERE id = _order_id;
    IF _cust IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, category, data)
      VALUES (_cust, 'Ready for pickup',
              'Order ' || COALESCE(_order_number,'') || ' is ready to collect at the shop.',
              'order', jsonb_build_object('order_id', _order_id, 'url', '/orders/' || _order_id));
    END IF;
    RETURN;
  END IF;

  -- Non-pickup: auto-assign nearest online partner (priority partner for fast delivery)
  _partner_id := public.find_nearest_partner_for_order(_order_id, '{}');
  IF _partner_id IS NOT NULL THEN
    UPDATE public.orders SET partner_id = _partner_id, updated_at = now() WHERE id = _order_id;
    SELECT user_id INTO _partner_user FROM public.delivery_partners WHERE id = _partner_id;
    IF _partner_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, category, data)
      VALUES (_partner_user,
              CASE WHEN _dt = 'fast_delivery' THEN '⚡ Priority delivery assignment'
                   ELSE 'New delivery assignment' END,
              'Order ' || COALESCE(_order_number, '') || ' is ready for pickup.',
              'delivery_assignment',
              jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id, 'delivery_type', _dt));
    END IF;
  END IF;
END $function$;

-- 4. New action: shopkeeper marks a pickup order as collected by the customer
CREATE OR REPLACE FUNCTION public.shop_mark_collected(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _cust uuid; _dt text; _num text;
BEGIN
  SELECT shop_id, user_id, delivery_type, order_number
    INTO _shop_id, _cust, _dt, _num
  FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid)
     AND NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  IF _dt <> 'pickup' THEN RAISE EXCEPTION 'Not a pickup order'; END IF;

  UPDATE public.orders
    SET status = 'delivered'::order_status, updated_at = now()
    WHERE id = _order_id AND status = 'packed'::order_status;

  IF _cust IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, category, data)
    VALUES (_cust, 'Order collected',
            'Thanks for collecting order ' || COALESCE(_num,'') || '. Enjoy!',
            'order', jsonb_build_object('order_id', _order_id));
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.shop_mark_collected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_mark_collected(uuid) TO authenticated;
