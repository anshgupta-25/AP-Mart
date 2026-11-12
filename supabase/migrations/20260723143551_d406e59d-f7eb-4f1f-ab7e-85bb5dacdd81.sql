
DROP FUNCTION IF EXISTS public.admin_list_shops();

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_status_check;
ALTER TABLE public.shops ADD CONSTRAINT shops_status_check CHECK (status IN ('active','suspended'));

CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_placed ON public.orders(shop_id, placed_at);

CREATE OR REPLACE FUNCTION public.admin_list_shops()
RETURNS TABLE(
  id uuid, owner_id uuid, owner_email text, owner_name text, owner_phone text, owner_status text,
  name text, address text, city text, state text, pincode text, phone text,
  latitude double precision, longitude double precision,
  is_open boolean, status text, logo_url text, service_radius_km numeric,
  created_at timestamptz, updated_at timestamptz,
  today_orders bigint, monthly_revenue numeric, acceptance_rate numeric, avg_rating numeric, total_orders bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  WITH ord_stats AS (
    SELECT o.shop_id,
      COUNT(*) FILTER (WHERE o.placed_at::date = CURRENT_DATE) AS today_orders,
      COUNT(*) AS total_orders,
      COALESCE(SUM(o.total) FILTER (WHERE o.status='delivered' AND o.placed_at >= date_trunc('month', now())), 0) AS monthly_revenue
    FROM public.orders o WHERE o.shop_id IS NOT NULL GROUP BY o.shop_id
  ),
  acc AS (
    SELECT h.shop_id,
      CASE WHEN COUNT(*)=0 THEN NULL
        ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE h.status='accepted') / COUNT(*), 1)
      END AS acceptance_rate
    FROM public.shop_assignment_history h GROUP BY h.shop_id
  )
  SELECT
    s.id, s.owner_id,
    u.email::text, p.full_name, p.phone, p.status,
    s.name, s.address, s.city, s.state, s.pincode, s.phone,
    s.latitude, s.longitude, s.is_open, s.status, s.logo_url, s.service_radius_km,
    s.created_at, s.updated_at,
    COALESCE(os.today_orders,0), COALESCE(os.monthly_revenue,0),
    acc.acceptance_rate, NULL::numeric, COALESCE(os.total_orders,0)
  FROM public.shops s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  LEFT JOIN public.profiles p ON p.id = s.owner_id
  LEFT JOIN ord_stats os ON os.shop_id = s.id
  LEFT JOIN acc ON acc.shop_id = s.id
  ORDER BY s.name;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_shop(
  _shop_id uuid, _name text DEFAULT NULL, _address text DEFAULT NULL,
  _city text DEFAULT NULL, _state text DEFAULT NULL, _pincode text DEFAULT NULL,
  _phone text DEFAULT NULL, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL,
  _radius numeric DEFAULT NULL, _is_open boolean DEFAULT NULL, _logo_url text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _pincode IS NOT NULL AND _pincode !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'Invalid pincode'; END IF;
  IF _radius IS NOT NULL AND (_radius <= 0 OR _radius > 100) THEN RAISE EXCEPTION 'Invalid radius'; END IF;
  IF _lat IS NOT NULL AND (_lat < -90 OR _lat > 90) THEN RAISE EXCEPTION 'Invalid latitude'; END IF;
  IF _lng IS NOT NULL AND (_lng < -180 OR _lng > 180) THEN RAISE EXCEPTION 'Invalid longitude'; END IF;
  UPDATE public.shops SET
    name = COALESCE(_name, name), address = COALESCE(_address, address),
    city = COALESCE(_city, city), state = COALESCE(_state, state),
    pincode = COALESCE(_pincode, pincode), phone = COALESCE(_phone, phone),
    latitude = COALESCE(_lat, latitude), longitude = COALESCE(_lng, longitude),
    service_radius_km = COALESCE(_radius, service_radius_km),
    is_open = COALESCE(_is_open, is_open), logo_url = COALESCE(_logo_url, logo_url),
    updated_at = now()
  WHERE id = _shop_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_shop_status(_shop_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.shops SET status = _status,
    is_open = CASE WHEN _status='suspended' THEN false ELSE is_open END,
    updated_at = now()
  WHERE id = _shop_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_shop(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _active_orders int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT COUNT(*) INTO _active_orders FROM public.orders
    WHERE shop_id = _shop_id AND status NOT IN ('delivered','cancelled','rejected');
  IF _active_orders > 0 THEN
    RAISE EXCEPTION 'Cannot delete shop with % active orders.', _active_orders;
  END IF;
  DELETE FROM public.shop_products WHERE shop_id = _shop_id;
  DELETE FROM public.shops WHERE id = _shop_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_search_users(_q text, _limit int DEFAULT 10)
RETURNS TABLE(id uuid, email text, full_name text, phone text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _q IS NULL OR length(trim(_q)) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name, p.phone, COALESCE(p.status,'active')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.email ILIKE '%'||_q||'%' OR p.full_name ILIKE '%'||_q||'%' OR p.phone ILIKE '%'||_q||'%'
  ORDER BY u.email
  LIMIT LEAST(GREATEST(_limit,1), 25);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_assign_shop_owner(_shop_id uuid, _user_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE _uid uuid; _pstatus text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_user_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'User not found: %', _user_email; END IF;
  SELECT status INTO _pstatus FROM public.profiles WHERE id = _uid;
  IF _pstatus = 'disabled' THEN RAISE EXCEPTION 'User is disabled/suspended'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'shopkeeper')
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.shops SET owner_id = _uid, updated_at = now() WHERE id = _shop_id;
  RETURN _uid;
END; $$;

REVOKE ALL ON FUNCTION public.admin_update_shop(uuid,text,text,text,text,text,text,double precision,double precision,numeric,boolean,text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_shop_status(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_delete_shop(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_search_users(text,int) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_shop(uuid,text,text,text,text,text,text,double precision,double precision,numeric,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_shop_status(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_shop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text,int) TO authenticated;
