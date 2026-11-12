
CREATE TABLE IF NOT EXISTS public.partner_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.partner_attendance TO authenticated;
GRANT ALL ON public.partner_attendance TO service_role;

ALTER TABLE public.partner_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_self_read ON public.partner_attendance FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY attendance_self_write ON public.partner_attendance FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid()));
CREATE POLICY attendance_self_update ON public.partner_attendance FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = partner_id AND dp.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS partner_attendance_partner_idx ON public.partner_attendance(partner_id, check_in_at DESC);

CREATE OR REPLACE FUNCTION public.partner_check_in()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _id uuid; _open uuid;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  SELECT id INTO _open FROM public.partner_attendance
    WHERE partner_id = _pid AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1;
  IF _open IS NOT NULL THEN RETURN _open; END IF;
  INSERT INTO public.partner_attendance(partner_id) VALUES (_pid) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.partner_check_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_check_in() TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_check_out()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  UPDATE public.partner_attendance SET check_out_at = now()
    WHERE partner_id = _pid AND check_out_at IS NULL;
  UPDATE public.delivery_partners SET is_online = false WHERE id = _pid;
END $$;
REVOKE ALL ON FUNCTION public.partner_check_out() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_check_out() TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_today_hours(_partner_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(check_out_at, now()) - check_in_at)) / 3600.0), 0)::numeric
  FROM public.partner_attendance
  WHERE partner_id = _partner_id AND check_in_at::date = current_date;
$$;
REVOKE ALL ON FUNCTION public.partner_today_hours(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_today_hours(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_assign_partner(_order_id uuid, _partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _order_number text; _partner_user uuid;
BEGIN
  SELECT shop_id, order_number INTO _shop_id, _order_number FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid)
     AND NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  UPDATE public.orders SET partner_id = _partner_id, updated_at = now()
    WHERE id = _order_id AND status IN ('packed'::order_status,'accepted_by_shop'::order_status);
  SELECT user_id INTO _partner_user FROM public.delivery_partners WHERE id = _partner_id;
  IF _partner_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_partner_user, 'New delivery assignment',
            'Order ' || COALESCE(_order_number,'') || ' assigned to you.',
            'delivery_assignment',
            jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.shop_assign_partner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_assign_partner(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reassign_partner(_order_id uuid, _partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _order_number text; _partner_user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT order_number INTO _order_number FROM public.orders WHERE id = _order_id;
  UPDATE public.orders SET partner_id = _partner_id, updated_at = now() WHERE id = _order_id;
  SELECT user_id INTO _partner_user FROM public.delivery_partners WHERE id = _partner_id;
  IF _partner_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_partner_user, 'Delivery reassigned',
            'You have been assigned to order ' || COALESCE(_order_number,'') || '.',
            'delivery_assignment',
            jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_reassign_partner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reassign_partner(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_partner_performance(_shop_id uuid)
RETURNS TABLE(
  partner_id uuid, name text, phone text, is_online boolean, rating numeric,
  orders_today bigint, orders_7d bigint,
  avg_minutes_today numeric, on_time_pct numeric, hours_today numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dp.id AS partner_id, dp.name, dp.phone, dp.is_online, dp.rating,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at::date = current_date) AS orders_today,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '7 days') AS orders_7d,
    COALESCE(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.placed_at))/60.0)
      FILTER (WHERE o.status='delivered'::order_status AND o.placed_at::date = current_date), 0)::numeric AS avg_minutes_today,
    COALESCE(
      100.0 * COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND EXTRACT(EPOCH FROM (o.updated_at - o.placed_at))/60.0 <= 30)
      / NULLIF(COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status), 0)
    , 0)::numeric AS on_time_pct,
    public.partner_today_hours(dp.id) AS hours_today
  FROM public.delivery_partners dp
  LEFT JOIN public.orders o ON o.partner_id = dp.id AND o.shop_id = _shop_id
  WHERE EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)))
  GROUP BY dp.id
  ORDER BY 6 DESC, dp.name ASC;
$$;
REVOKE ALL ON FUNCTION public.shop_partner_performance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_partner_performance(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_partner_performance()
RETURNS TABLE(
  partner_id uuid, name text, phone text, is_online boolean, rating numeric,
  orders_today bigint, orders_7d bigint, orders_30d bigint,
  avg_minutes_30d numeric, on_time_pct_30d numeric, hours_today numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dp.id AS partner_id, dp.name, dp.phone, dp.is_online, dp.rating,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at::date = current_date) AS orders_today,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '7 days') AS orders_7d,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '30 days') AS orders_30d,
    COALESCE(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.placed_at))/60.0)
      FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '30 days'), 0)::numeric AS avg_minutes_30d,
    COALESCE(
      100.0 * COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '30 days' AND EXTRACT(EPOCH FROM (o.updated_at - o.placed_at))/60.0 <= 30)
      / NULLIF(COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '30 days'), 0)
    , 0)::numeric AS on_time_pct_30d,
    public.partner_today_hours(dp.id) AS hours_today
  FROM public.delivery_partners dp
  LEFT JOIN public.orders o ON o.partner_id = dp.id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY dp.id
  ORDER BY 6 DESC, dp.name ASC;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_performance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_performance() TO authenticated;
