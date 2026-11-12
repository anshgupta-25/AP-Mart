
-- 1) Assignment history table
CREATE TABLE IF NOT EXISTS public.shop_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  status text NOT NULL, -- 'assigned' | 'accepted' | 'rejected' | 'timeout' | 'admin_override' | 'no_shop_available'
  reason text,
  attempt_number int NOT NULL DEFAULT 1,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_assignment_history TO authenticated;
GRANT ALL ON public.shop_assignment_history TO service_role;
ALTER TABLE public.shop_assignment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assignment_history_admin_read" ON public.shop_assignment_history;
CREATE POLICY "assignment_history_admin_read" ON public.shop_assignment_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "assignment_history_shop_read" ON public.shop_assignment_history;
CREATE POLICY "assignment_history_shop_read" ON public.shop_assignment_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_assignment_history.shop_id AND s.owner_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_assignment_history_order ON public.shop_assignment_history(order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_shop ON public.shop_assignment_history(shop_id);

-- 2) shop_reject_order with reason + permanent rejection + history log
DROP FUNCTION IF EXISTS public.shop_reject_order(uuid);
DROP FUNCTION IF EXISTS public.shop_reject_order(uuid, text);
CREATE OR REPLACE FUNCTION public.shop_reject_order(_order_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _shop_id uuid;
  _next_shop uuid;
  _cust uuid;
  _dist numeric;
  _lat double precision;
  _lng double precision;
  _attempts int;
BEGIN
  SELECT shop_id, user_id, delivery_lat, delivery_lng, assignment_attempts
    INTO _shop_id, _cust, _lat, _lng, _attempts
  FROM public.orders WHERE id = _order_id;

  IF _shop_id IS NULL THEN RAISE EXCEPTION 'Order has no assigned shop'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  -- restore stock at rejecting shop
  UPDATE public.shop_products sp SET stock = stock + oi.quantity, updated_at = now()
  FROM public.order_items oi
  WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _shop_id;

  -- Permanently add to rejection list (dedup)
  UPDATE public.orders
     SET rejected_shop_ids = (
           SELECT ARRAY(SELECT DISTINCT UNNEST(array_append(rejected_shop_ids, _shop_id)))
         ),
         shop_id = NULL,
         updated_at = now()
   WHERE id = _order_id;

  -- Log the rejection
  INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, responded_at)
  VALUES (_order_id, _shop_id, 'rejected', _reason, COALESCE(_attempts, 1), now());

  -- Find next eligible shop (find_nearest_shop_for_order already excludes rejected_shop_ids)
  _next_shop := public.find_nearest_shop_for_order(_order_id);

  IF _next_shop IS NULL THEN
    UPDATE public.orders SET status = 'no_shop_available'::order_status,
      assignment_expires_at = NULL,
      assignment_reason = 'No other eligible shop has the required items'
    WHERE id = _order_id;

    INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason)
    VALUES (_order_id, NULL, 'no_shop_available', 'All eligible shops have rejected or no stock remaining');

    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (
      _cust,
      'Item unavailable',
      'No shop in your area could fulfill this order. You can continue, replace items, or cancel.',
      jsonb_build_object('order_id', _order_id, 'url', '/customer/orders/' || _order_id)
    );
  ELSE
    -- Reserve stock at next shop
    UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _next_shop;

    SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng)
      INTO _dist FROM public.shops s WHERE s.id = _next_shop;

    UPDATE public.orders SET
      shop_id = _next_shop,
      status = 'awaiting_shop'::order_status,
      assignment_attempts = assignment_attempts + 1,
      assignment_expires_at = now() + interval '10 minutes',
      assignment_reason = 'Reassigned to next eligible shop after rejection',
      assignment_distance_km = _dist
    WHERE id = _order_id;

    INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, assigned_at)
    VALUES (_order_id, _next_shop, 'assigned', 'Next eligible shop after previous rejection',
            COALESCE(_attempts, 1) + 1, now());
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.shop_reject_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_reject_order(uuid, text) TO authenticated;

-- 3) reassign_stale_orders: never clear rejection history
CREATE OR REPLACE FUNCTION public.reassign_stale_orders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _count integer := 0; r record; _next uuid; _dist numeric;
BEGIN
  FOR r IN
    SELECT id, shop_id, user_id, delivery_lat, delivery_lng, assignment_attempts
      FROM public.orders
      WHERE status = 'awaiting_shop'::order_status
        AND assignment_expires_at IS NOT NULL
        AND assignment_expires_at < now()
  LOOP
    -- restore stock
    UPDATE public.shop_products sp SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = r.shop_id;

    -- Permanently add timed-out shop to rejection list
    UPDATE public.orders
       SET rejected_shop_ids = (
             SELECT ARRAY(SELECT DISTINCT UNNEST(array_append(rejected_shop_ids, r.shop_id)))
           ),
           shop_id = NULL
     WHERE id = r.id;

    INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, responded_at)
    VALUES (r.id, r.shop_id, 'timeout', 'Shop did not respond within the acceptance window',
            COALESCE(r.assignment_attempts, 1), now());

    -- Find next shop — DO NOT clear rejected_shop_ids
    _next := public.find_nearest_shop_for_order(r.id);

    IF _next IS NULL THEN
      UPDATE public.orders SET status = 'no_shop_available'::order_status,
        assignment_expires_at = NULL,
        assignment_reason = 'No other eligible shop after timeout'
      WHERE id = r.id;

      INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason)
      VALUES (r.id, NULL, 'no_shop_available', 'No eligible shops remaining after timeout');

      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (r.user_id, 'Item unavailable',
              'No shop in your area could fulfill this order.',
              jsonb_build_object('order_id', r.id, 'url', '/customer/orders/' || r.id));
    ELSE
      UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _next;

      SELECT public.haversine_km(s.latitude, s.longitude, r.delivery_lat, r.delivery_lng)
        INTO _dist FROM public.shops s WHERE s.id = _next;

      UPDATE public.orders SET
        shop_id = _next,
        assignment_attempts = assignment_attempts + 1,
        assignment_expires_at = now() + interval '10 minutes',
        assignment_reason = 'Reassigned to next eligible shop after timeout',
        assignment_distance_km = _dist
      WHERE id = r.id;

      INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, assigned_at)
      VALUES (r.id, _next, 'assigned', 'Next eligible shop after timeout',
              COALESCE(r.assignment_attempts, 1) + 1, now());
    END IF;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

REVOKE EXECUTE ON FUNCTION public.reassign_stale_orders() FROM anon, authenticated;

-- 4) Admin override — can reassign to any shop, including previously rejected ones
CREATE OR REPLACE FUNCTION public.admin_reassign_shop(_order_id uuid, _shop_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _prev_shop uuid; _lat double precision; _lng double precision; _dist numeric;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT shop_id, delivery_lat, delivery_lng INTO _prev_shop, _lat, _lng
  FROM public.orders WHERE id = _order_id;

  -- restore stock at previous shop if any
  IF _prev_shop IS NOT NULL THEN
    UPDATE public.shop_products sp SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _prev_shop;
  END IF;

  -- Reserve stock at new shop
  UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
  FROM public.order_items oi
  WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _shop_id;

  SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng)
    INTO _dist FROM public.shops s WHERE s.id = _shop_id;

  -- Remove the new shop from rejection list so it can receive it
  UPDATE public.orders SET
    shop_id = _shop_id,
    rejected_shop_ids = array_remove(rejected_shop_ids, _shop_id),
    status = 'awaiting_shop'::order_status,
    assignment_attempts = assignment_attempts + 1,
    assignment_expires_at = now() + interval '10 minutes',
    assignment_reason = 'Admin manually reassigned',
    assignment_distance_km = _dist,
    updated_at = now()
  WHERE id = _order_id;

  INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, assigned_at)
  VALUES (_order_id, _shop_id, 'admin_override', 'Admin manually reassigned this order', now());

  INSERT INTO public.notifications (user_id, title, body, data)
  VALUES (
    (SELECT owner_id FROM public.shops WHERE id = _shop_id),
    'New order (admin assigned)',
    'An administrator assigned an order to your shop',
    jsonb_build_object('order_id', _order_id, 'url', '/shopkeeper/orders/' || _order_id)
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_reassign_shop(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reassign_shop(uuid, uuid) TO authenticated;
