
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disabled')),
  ADD COLUMN IF NOT EXISTS address text;

CREATE TABLE IF NOT EXISTS public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_requests_role_check CHECK (requested_role IN ('shopkeeper','delivery')),
  CONSTRAINT role_requests_status_check CHECK (status IN ('pending','approved','rejected'))
);

GRANT SELECT, INSERT, UPDATE ON public.role_requests TO authenticated;
GRANT ALL ON public.role_requests TO service_role;

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rr_self_read" ON public.role_requests;
DROP POLICY IF EXISTS "rr_self_insert" ON public.role_requests;
DROP POLICY IF EXISTS "rr_admin_update" ON public.role_requests;

CREATE POLICY "rr_self_read" ON public.role_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "rr_self_insert" ON public.role_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "rr_admin_update" ON public.role_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS role_requests_user_idx ON public.role_requests(user_id);
CREATE INDEX IF NOT EXISTS role_requests_status_idx ON public.role_requests(status);

DROP TRIGGER IF EXISTS trg_role_requests_updated ON public.role_requests;
CREATE TRIGGER trg_role_requests_updated
  BEFORE UPDATE ON public.role_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.submit_role_request(_role app_role, _data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _role NOT IN ('shopkeeper','delivery') THEN RAISE EXCEPTION 'Only shopkeeper or delivery role can be requested'; END IF;
  IF public.has_role(_uid, _role) THEN RAISE EXCEPTION 'You already have this role'; END IF;
  IF EXISTS (SELECT 1 FROM public.role_requests WHERE user_id = _uid AND requested_role = _role AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending request for this role';
  END IF;
  INSERT INTO public.role_requests(user_id, requested_role, data)
  VALUES (_uid, _role, COALESCE(_data,'{}'::jsonb)) RETURNING id INTO _id;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  SELECT ur.user_id, 'New role request',
    'A user requested ' || _role::text || ' access.', 'role_request',
    jsonb_build_object('request_id', _id, 'url','/admin/role-requests')
  FROM public.user_roles ur WHERE ur.role = 'admin'::app_role;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_approve_shopkeeper_request(
  _request_id uuid, _shop_id uuid DEFAULT NULL, _shop_name text DEFAULT NULL,
  _address text DEFAULT NULL, _city text DEFAULT NULL, _pincode text DEFAULT NULL,
  _phone text DEFAULT NULL, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL,
  _radius numeric DEFAULT 8)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _req record; _shop uuid;
BEGIN
  IF NOT public.has_role(_uid,'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _req FROM public.role_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF _req.requested_role <> 'shopkeeper' THEN RAISE EXCEPTION 'Wrong request type'; END IF;
  IF _shop_id IS NOT NULL THEN
    UPDATE public.shops SET owner_id = _req.user_id, updated_at = now() WHERE id = _shop_id;
    _shop := _shop_id;
  ELSE
    IF _shop_name IS NULL OR _address IS NULL OR _lat IS NULL OR _lng IS NULL THEN
      RAISE EXCEPTION 'Shop name, address, latitude and longitude are required';
    END IF;
    INSERT INTO public.shops(owner_id, name, address, city, pincode, phone, latitude, longitude, service_radius_km, is_open)
    VALUES (_req.user_id, _shop_name, _address, COALESCE(_city,''), COALESCE(_pincode,''), _phone, _lat, _lng, COALESCE(_radius,8), true)
    RETURNING id INTO _shop;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_req.user_id,'shopkeeper'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.role_requests SET status='approved', decided_at=now(), decided_by=_uid,
    data = data || jsonb_build_object('approved_shop_id', _shop) WHERE id = _request_id;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_req.user_id,'Shopkeeper request approved',
    'You are now a shopkeeper. Open your shop dashboard.','role_request',
    jsonb_build_object('url','/shopkeeper/dashboard','shop_id',_shop));
  RETURN _shop;
END $$;

CREATE OR REPLACE FUNCTION public.admin_approve_delivery_request(
  _request_id uuid, _shop_id uuid, _name text DEFAULT NULL,
  _phone text DEFAULT NULL, _vehicle text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _req record; _pid uuid; _full text;
BEGIN
  IF NOT public.has_role(_uid,'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _shop_id IS NULL THEN RAISE EXCEPTION 'shop_id required'; END IF;
  SELECT * INTO _req FROM public.role_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF _req.requested_role <> 'delivery' THEN RAISE EXCEPTION 'Wrong request type'; END IF;
  SELECT full_name INTO _full FROM public.profiles WHERE id = _req.user_id;
  INSERT INTO public.delivery_partners(user_id, name, phone, vehicle, shop_id, is_online)
  VALUES (_req.user_id, COALESCE(_name,_full,'Delivery Partner'),
          COALESCE(_phone, _req.data->>'phone'),
          COALESCE(_vehicle, _req.data->>'vehicle_type'),
          _shop_id, false)
  ON CONFLICT (user_id) DO UPDATE SET shop_id = EXCLUDED.shop_id,
    phone = COALESCE(EXCLUDED.phone, public.delivery_partners.phone),
    vehicle = COALESCE(EXCLUDED.vehicle, public.delivery_partners.vehicle),
    updated_at = now()
  RETURNING id INTO _pid;
  INSERT INTO public.user_roles(user_id, role) VALUES (_req.user_id,'delivery'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.role_requests SET status='approved', decided_at=now(), decided_by=_uid,
    data = data || jsonb_build_object('approved_shop_id', _shop_id, 'partner_id', _pid)
    WHERE id = _request_id;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_req.user_id,'Delivery partner request approved',
    'You can now accept deliveries from your assigned shop.','role_request',
    jsonb_build_object('url','/delivery/dashboard','shop_id',_shop_id));
  RETURN _pid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reject_role_request(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _req record;
BEGIN
  IF NOT public.has_role(_uid,'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _req FROM public.role_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  UPDATE public.role_requests SET status='rejected', decided_at=now(), decided_by=_uid, rejection_reason=_reason
    WHERE id = _request_id;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_req.user_id,'Role request rejected',
    COALESCE(_reason,'Your role upgrade request was not approved.'),'role_request', '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _status NOT IN ('active','disabled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF _user_id = auth.uid() AND _status = 'disabled' THEN RAISE EXCEPTION 'You cannot disable your own account'; END IF;
  UPDATE public.profiles SET status = _status, updated_at = now() WHERE id = _user_id;
END $$;

DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, full_name text, phone text, email text, address text, status text, created_at timestamptz, roles app_role[], pending_request_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.phone, u.email::text, p.address, p.status, p.created_at,
    COALESCE(ARRAY_AGG(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}'::app_role[]) AS roles,
    (SELECT COUNT(*)::int FROM public.role_requests rr WHERE rr.user_id = p.id AND rr.status = 'pending') AS pending_request_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id, u.email
  ORDER BY p.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_role_requests(_status text DEFAULT NULL)
RETURNS TABLE(id uuid, user_id uuid, requested_role app_role, status text, data jsonb, rejection_reason text, submitted_at timestamptz, decided_at timestamptz, full_name text, email text, phone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT r.id, r.user_id, r.requested_role, r.status, r.data, r.rejection_reason,
         r.submitted_at, r.decided_at, p.full_name, u.email::text, p.phone
  FROM public.role_requests r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  WHERE _status IS NULL OR r.status = _status
  ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END, r.submitted_at DESC;
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_role_request(app_role, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_role_request(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_role_requests(text) FROM anon;
