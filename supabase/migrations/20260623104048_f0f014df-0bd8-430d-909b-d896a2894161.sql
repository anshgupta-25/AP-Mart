
-- 1) Widen default service radius so nearby shops cover the area
UPDATE public.shops SET service_radius_km = 15 WHERE service_radius_km < 15;

-- 2) Extend shopkeeper acceptance window from 60s to 10 minutes (in place_order + reassign)
CREATE OR REPLACE FUNCTION public.reassign_stale_orders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _count integer := 0; r record; _next uuid;
BEGIN
  FOR r IN
    SELECT id, shop_id, user_id, rejected_shop_ids FROM public.orders
    WHERE status = 'awaiting_shop'::order_status
      AND assignment_expires_at IS NOT NULL AND assignment_expires_at < now()
  LOOP
    -- restore stock at current shop
    UPDATE public.shop_products sp SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = r.shop_id;

    UPDATE public.orders SET rejected_shop_ids = array_append(rejected_shop_ids, r.shop_id), shop_id = NULL
    WHERE id = r.id;

    _next := public.find_nearest_shop_for_order(r.id);

    -- If no shop in remaining set, retry with rejections cleared (give shops another chance)
    IF _next IS NULL THEN
      UPDATE public.orders SET rejected_shop_ids = '{}'::uuid[] WHERE id = r.id;
      _next := public.find_nearest_shop_for_order(r.id);
    END IF;

    IF _next IS NULL THEN
      UPDATE public.orders SET status = 'no_shop_available'::order_status, assignment_expires_at = NULL WHERE id = r.id;
      INSERT INTO public.notifications (user_id, title, body) VALUES (r.user_id, 'No shop available', 'We could not find a shop for your order.');
    ELSE
      UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _next;
      UPDATE public.orders SET shop_id = _next, assignment_attempts = assignment_attempts + 1,
        assignment_expires_at = now() + interval '10 minutes' WHERE id = r.id;
    END IF;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $function$;

-- 3) Also bump initial assignment window in place_order (find it and patch the literal)
DO $$
DECLARE _def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO _def FROM pg_proc WHERE proname='place_order' LIMIT 1;
  IF _def IS NOT NULL AND _def LIKE '%60 seconds%' THEN
    EXECUTE replace(_def, '60 seconds', '10 minutes');
  END IF;
END $$;

-- 4) Recover the stuck orders: clear rejections + retry assignment now
DO $$
DECLARE r record; _next uuid;
BEGIN
  FOR r IN SELECT id, user_id FROM public.orders WHERE status = 'no_shop_available'::order_status LOOP
    UPDATE public.orders SET rejected_shop_ids = '{}'::uuid[] WHERE id = r.id;
    _next := public.find_nearest_shop_for_order(r.id);
    IF _next IS NOT NULL THEN
      UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _next;
      UPDATE public.orders SET shop_id = _next, status = 'awaiting_shop'::order_status,
        assignment_attempts = assignment_attempts + 1,
        assignment_expires_at = now() + interval '10 minutes'
      WHERE id = r.id;
      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (
        (SELECT owner_id FROM public.shops WHERE id = _next),
        'New order', 'You have a new order to accept',
        jsonb_build_object('order_id', r.id, 'url', '/shopkeeper/orders/' || r.id)
      );
    END IF;
  END LOOP;
END $$;
