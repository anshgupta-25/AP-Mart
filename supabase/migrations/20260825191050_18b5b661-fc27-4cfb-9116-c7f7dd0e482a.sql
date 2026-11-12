CREATE OR REPLACE FUNCTION public.shop_accept_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _cust uuid; _parent uuid; _status order_status;
BEGIN
  SELECT shop_id, user_id, parent_order_id, status INTO _shop_id, _cust, _parent, _status
  FROM public.orders WHERE id = _order_id;

  -- Multi-shop child order: delegate to the child-aware accept (handles parent rollup)
  IF _parent IS NOT NULL THEN
    IF _status = 'awaiting_shop'::order_status THEN
      PERFORM public.shop_accept_child(_order_id, 15);
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  UPDATE public.orders
  SET status = 'accepted_by_shop'::order_status, assignment_expires_at = NULL, updated_at = now()
  WHERE id = _order_id AND status = 'awaiting_shop'::order_status;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_cust, 'Order accepted', 'A shop is preparing your order.');
END
$function$;

CREATE OR REPLACE FUNCTION public.shop_mark_packed(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _shop_id uuid;
  _shop_owner uuid;
  _cust uuid;
  _order_number text;
  _dt text;
  _parent uuid;
  _status order_status;
  _partner record;
BEGIN
  SELECT o.shop_id, o.user_id, o.order_number, o.delivery_type, o.parent_order_id, o.status, s.owner_id
    INTO _shop_id, _cust, _order_number, _dt, _parent, _status, _shop_owner
  FROM public.orders o
  JOIN public.shops s ON s.id = o.shop_id
  WHERE o.id = _order_id;

  -- Multi-shop child order: delegate to the child-aware ready (handles parent rollup + reservations)
  IF _parent IS NOT NULL THEN
    IF _status = 'accepted_by_shop'::order_status THEN
      PERFORM public.shop_mark_child_ready(_order_id);
    END IF;
    RETURN;
  END IF;

  IF _shop_owner IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  UPDATE public.orders
  SET status = 'packed'::order_status, updated_at = now()
  WHERE id = _order_id AND status = 'accepted_by_shop'::order_status;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_cust, 'Order packed', 'Your order is packed and waiting for a delivery partner.');

  FOR _partner IN
    SELECT dp.user_id
    FROM public.shop_delivery_assignments sda
    JOIN public.delivery_partners dp ON dp.id = sda.delivery_partner_id
    WHERE sda.shop_id = _shop_id AND dp.is_online = true
  LOOP
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (
      _partner.user_id,
      CASE WHEN _dt = 'fast_delivery' THEN '⚡ FAST delivery — new order available' ELSE 'New order available' END,
      'Order ' || COALESCE(_order_number, '') || ' is packed and ready for pickup.'
    );
  END LOOP;
END
$function$;

CREATE OR REPLACE FUNCTION public.shop_reject_order(_order_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _shop_id uuid; _cust uuid;
  _lat double precision; _lng double precision; _attempts int;
  _parent uuid; _status order_status;
  _new_shop uuid; _new_name text; _dist numeric;
BEGIN
  SELECT shop_id, user_id, delivery_lat, delivery_lng, assignment_attempts, parent_order_id, status
    INTO _shop_id, _cust, _lat, _lng, _attempts, _parent, _status
  FROM public.orders WHERE id = _order_id;

  -- Multi-shop child order: delegate to child-aware reject (replacement-shop re-routing)
  IF _parent IS NOT NULL THEN
    IF _status IN ('awaiting_shop'::order_status, 'accepted_by_shop'::order_status) THEN
      PERFORM public.shop_reject_child(_order_id, _reason);
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  INSERT INTO public.shop_assignment_history(order_id, shop_id, status, reason, attempt_number, responded_at)
  VALUES (_order_id, _shop_id, 'rejected', _reason, COALESCE(_attempts, 0) + 1, now());

  UPDATE public.orders
  SET shop_id = NULL, status = 'awaiting_shop'::order_status,
      assignment_attempts = assignment_attempts + 1,
      assignment_expires_at = NULL,
      rejected_shop_ids = array_append(rejected_shop_ids, _shop_id),
      updated_at = now()
  WHERE id = _order_id;

  SELECT o.shop_id, s.name, o.assignment_distance_km INTO _new_shop, _new_name, _dist
  FROM public.find_nearest_shop_for_order(_order_id) o
  JOIN public.shops s ON s.id = o.shop_id;

  IF _new_shop IS NOT NULL THEN
    UPDATE public.orders
    SET shop_id = _new_shop, assignment_expires_at = now() + interval '10 minutes',
        assignment_distance_km = _dist, updated_at = now()
    WHERE id = _order_id;
    INSERT INTO public.shop_assignment_history(order_id, shop_id, status, attempt_number)
    VALUES (_order_id, _new_shop, 'assigned', COALESCE(_attempts, 0) + 2);
    PERFORM public.notify_shop_owner_on_assignment(_order_id, _new_shop, NULL);
  ELSE
    UPDATE public.orders SET status = 'no_shop_available'::order_status, updated_at = now()
    WHERE id = _order_id;
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (_cust, 'Order delayed', 'We could not find a shop for your order. Our team will help.');
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.partner_mark_delivered(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _pid uuid; _cust uuid; _is_parent boolean;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  UPDATE public.orders SET status = 'delivered'::order_status, updated_at = now()
  WHERE id = _order_id AND partner_id = _pid
  RETURNING user_id, is_parent INTO _cust, _is_parent;
  -- Multi-shop parent delivered: mark all its shop parts delivered too
  IF _cust IS NOT NULL AND _is_parent THEN
    UPDATE public.orders SET status = 'delivered'::order_status, updated_at = now()
    WHERE parent_order_id = _order_id AND status <> 'cancelled'::order_status;
  END IF;
  IF _cust IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (_cust, 'Order delivered', 'Your order has been delivered. Enjoy!');
  END IF;
END
$function$;

-- Realtime UPDATE events on orders must include previous values so the
-- customer tracking page can diff old vs new status reliably.
ALTER TABLE public.orders REPLICA IDENTITY FULL;