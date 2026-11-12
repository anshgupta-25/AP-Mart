
CREATE OR REPLACE FUNCTION public.admin_create_shopkeeper(_user_email text, _shop_name text, _address text, _city text, _pincode text, _lat double precision, _lng double precision, _phone text DEFAULT NULL::text, _radius numeric DEFAULT 8)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE _uid uuid := auth.uid(); _target uuid; _shop uuid;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _shop_name IS NULL OR length(trim(_shop_name)) = 0 THEN RAISE EXCEPTION 'Shop name required'; END IF;
  IF _user_email IS NULL OR length(trim(_user_email)) = 0 THEN RAISE EXCEPTION 'Owner email required'; END IF;
  IF _address IS NULL OR length(trim(_address)) = 0 THEN RAISE EXCEPTION 'Address required'; END IF;
  IF _city IS NULL OR length(trim(_city)) = 0 THEN RAISE EXCEPTION 'City required'; END IF;
  IF _pincode IS NULL OR length(trim(_pincode)) = 0 THEN RAISE EXCEPTION 'Pincode required'; END IF;
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Location required'; END IF;

  SELECT id INTO _target FROM auth.users WHERE lower(email) = lower(trim(_user_email)) LIMIT 1;
  IF _target IS NULL THEN RAISE EXCEPTION 'No user account with email %. Ask them to sign up first.', _user_email; END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (_target, 'shopkeeper'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.shops(owner_id, name, address, city, pincode, phone, latitude, longitude, service_radius_km, is_open)
  VALUES (_target, _shop_name, _address, _city, _pincode, _phone, _lat, _lng, _radius, true)
  RETURNING id INTO _shop;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_target, 'Shop assigned', 'You have been assigned to a shop. Open your dashboard.', 'role_request',
    jsonb_build_object('url','/shopkeeper/dashboard','shop_id',_shop));

  RETURN _shop;
END $function$;
