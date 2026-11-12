CREATE OR REPLACE FUNCTION public.admin_list_shops()
RETURNS TABLE(
  id uuid,
  owner_id uuid,
  owner_email text,
  name text,
  address text,
  city text,
  pincode text,
  phone text,
  latitude double precision,
  longitude double precision,
  is_open boolean,
  service_radius_km numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.owner_id,
    u.email::text AS owner_email,
    s.name,
    s.address,
    s.city,
    s.pincode,
    s.phone,
    s.latitude,
    s.longitude,
    s.is_open,
    s.service_radius_km,
    s.created_at,
    s.updated_at
  FROM public.shops s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  ORDER BY s.name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_shops() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_shops() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unassign_shop_owner(_shop_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
  _old_owner uuid;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  SELECT owner_id INTO _old_owner
  FROM public.shops
  WHERE id = _shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF _old_owner IS NULL THEN
    RETURN _shop_id;
  END IF;

  UPDATE public.shops
  SET owner_id = NULL, updated_at = now()
  WHERE id = _shop_id;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE owner_id = _old_owner) THEN
    DELETE FROM public.user_roles
    WHERE user_id = _old_owner AND role = 'shopkeeper'::app_role;
  END IF;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_old_owner, 'Shop removed', 'A shop has been removed from your shopkeeper account.', 'role_request',
    jsonb_build_object('url','/dashboard','shop_id',_shop_id));

  RETURN _shop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unassign_shop_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unassign_shop_owner(uuid) TO authenticated;