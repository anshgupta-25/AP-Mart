-- Helper: find nearest online delivery partner not currently on an active order, excluding given ids
CREATE OR REPLACE FUNCTION public.find_nearest_partner_for_order(_order_id uuid, _exclude uuid[] DEFAULT '{}'::uuid[])
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shop_lat double precision;
  _shop_lng double precision;
  _partner_id uuid;
BEGIN
  SELECT s.latitude, s.longitude INTO _shop_lat, _shop_lng
  FROM public.orders o
  JOIN public.shops s ON s.id = o.shop_id
  WHERE o.id = _order_id;

  IF _shop_lat IS NULL OR _shop_lng IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT dp.id INTO _partner_id
  FROM public.delivery_partners dp
  WHERE dp.is_online = true
    AND dp.current_lat IS NOT NULL
    AND dp.current_lng IS NOT NULL
    AND NOT (dp.id = ANY(_exclude))
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o2
      WHERE o2.partner_id = dp.id
        AND o2.status IN ('out_for_delivery'::order_status)
    )
  ORDER BY public.haversine_km(dp.current_lat, dp.current_lng, _shop_lat, _shop_lng) ASC
  LIMIT 1;

  RETURN _partner_id;
END $$;

-- Replace shop_mark_packed to also auto-assign nearest partner
CREATE OR REPLACE FUNCTION public.shop_mark_packed(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _shop_id uuid;
  _cust uuid;
  _partner_id uuid;
  _partner_user uuid;
  _order_number text;
BEGIN
  SELECT shop_id, user_id, order_number INTO _shop_id, _cust, _order_number
  FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  UPDATE public.orders
  SET status = 'packed'::order_status, updated_at = now()
  WHERE id = _order_id AND status = 'accepted_by_shop'::order_status;

  -- Try to auto-assign nearest online partner
  _partner_id := public.find_nearest_partner_for_order(_order_id, '{}');
  IF _partner_id IS NOT NULL THEN
    UPDATE public.orders SET partner_id = _partner_id, updated_at = now() WHERE id = _order_id;
    SELECT user_id INTO _partner_user FROM public.delivery_partners WHERE id = _partner_id;
    IF _partner_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, category, data)
      VALUES (_partner_user, 'New delivery assignment', 'Order ' || COALESCE(_order_number, '') || ' is ready for pickup.', 'delivery_assignment',
              jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id));
    END IF;
  END IF;
END $$;

-- Allow assigned partner to accept; falls back to anyone if unassigned (kept compatible)
CREATE OR REPLACE FUNCTION public.partner_accept_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _pid uuid; _cust uuid; _assigned uuid;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;

  SELECT partner_id INTO _assigned FROM public.orders WHERE id = _order_id;

  IF _assigned IS NOT NULL AND _assigned <> _pid THEN
    RAISE EXCEPTION 'Order is assigned to another partner';
  END IF;

  UPDATE public.orders
  SET partner_id = _pid, status = 'out_for_delivery'::order_status, updated_at = now()
  WHERE id = _order_id
    AND status = 'packed'::order_status
    AND (partner_id IS NULL OR partner_id = _pid)
  RETURNING user_id INTO _cust;

  IF _cust IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, category, data)
    VALUES (_cust, 'Out for delivery', 'Your order is on its way!', 'order',
            jsonb_build_object('order_id', _order_id));
  END IF;
END $$;

-- Partner declines assignment → clear and reassign to next nearest, excluding decliner
CREATE OR REPLACE FUNCTION public.partner_decline_assignment(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _next uuid;
  _next_user uuid;
  _order_number text;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;

  UPDATE public.orders SET partner_id = NULL, updated_at = now()
  WHERE id = _order_id AND partner_id = _pid AND status = 'packed'::order_status;

  SELECT order_number INTO _order_number FROM public.orders WHERE id = _order_id;
  _next := public.find_nearest_partner_for_order(_order_id, ARRAY[_pid]);
  IF _next IS NOT NULL THEN
    UPDATE public.orders SET partner_id = _next, updated_at = now() WHERE id = _order_id;
    SELECT user_id INTO _next_user FROM public.delivery_partners WHERE id = _next;
    IF _next_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, category, data)
      VALUES (_next_user, 'New delivery assignment', 'Order ' || COALESCE(_order_number, '') || ' is ready for pickup.', 'delivery_assignment',
              jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id));
    END IF;
  END IF;
END $$;

-- Allow assigned partners to also see orders specifically assigned to them
-- (current orders_shop_select already covers partner_id = current_user_partner_id())

REVOKE ALL ON FUNCTION public.find_nearest_partner_for_order(uuid, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.partner_decline_assignment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_nearest_partner_for_order(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_decline_assignment(uuid) TO authenticated;