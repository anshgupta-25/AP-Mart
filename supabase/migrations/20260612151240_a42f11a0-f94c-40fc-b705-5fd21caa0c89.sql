
CREATE OR REPLACE FUNCTION public.shop_live_team(_shop_id uuid)
RETURNS TABLE(
  partner_id uuid,
  name text,
  phone text,
  vehicle text,
  is_online boolean,
  rating numeric,
  availability_status text,
  active_order_count integer,
  current_order_id uuid,
  current_order_number text,
  eta_minutes integer,
  status_updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dp.id, dp.name, dp.phone, dp.vehicle, dp.is_online, dp.rating,
         dp.availability_status, dp.active_order_count,
         dp.current_order_id, o.order_number, dp.eta_minutes, dp.status_updated_at
  FROM public.shop_delivery_assignments a
  JOIN public.delivery_partners dp ON dp.id = a.delivery_partner_id
  LEFT JOIN public.orders o ON o.id = dp.current_order_id
  WHERE a.shop_id = _shop_id
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.owner_id = auth.uid())
    )
  ORDER BY dp.is_online DESC, dp.status_updated_at DESC NULLS LAST, dp.name ASC;
$$;

REVOKE ALL ON FUNCTION public.shop_live_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_live_team(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_live_partners()
RETURNS TABLE(
  partner_id uuid,
  name text,
  phone text,
  vehicle text,
  is_online boolean,
  rating numeric,
  availability_status text,
  active_order_count integer,
  current_order_id uuid,
  current_order_number text,
  eta_minutes integer,
  status_updated_at timestamptz,
  shop_id uuid,
  shop_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dp.id, dp.name, dp.phone, dp.vehicle, dp.is_online, dp.rating,
         dp.availability_status, dp.active_order_count,
         dp.current_order_id, o.order_number, dp.eta_minutes, dp.status_updated_at,
         s.id, s.name
  FROM public.delivery_partners dp
  LEFT JOIN public.orders o ON o.id = dp.current_order_id
  LEFT JOIN public.shops  s ON s.id = COALESCE(o.shop_id, dp.shop_id)
  WHERE public.has_role(auth.uid(),'admin'::app_role)
  ORDER BY s.name NULLS LAST, dp.is_online DESC, dp.status_updated_at DESC NULLS LAST, dp.name ASC;
$$;

REVOKE ALL ON FUNCTION public.admin_live_partners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_live_partners() TO authenticated;
