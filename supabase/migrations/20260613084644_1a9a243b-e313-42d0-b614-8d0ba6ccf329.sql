CREATE OR REPLACE FUNCTION public.admin_assign_shop_owner(_shop_id uuid, _user_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE _uid uuid := auth.uid(); _target uuid;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _shop_id IS NULL OR _user_email IS NULL OR length(trim(_user_email)) = 0 THEN
    RAISE EXCEPTION 'shop_id and user email are required';
  END IF;
  SELECT id INTO _target FROM auth.users WHERE lower(email) = lower(trim(_user_email)) LIMIT 1;
  IF _target IS NULL THEN RAISE EXCEPTION 'No user found with that email'; END IF;
  UPDATE public.shops SET owner_id = _target, updated_at = now() WHERE id = _shop_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shop not found'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_target, 'shopkeeper'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_target, 'Shop assigned', 'You have been assigned to a shop. Open your dashboard.', 'role_request',
    jsonb_build_object('url','/shopkeeper/dashboard','shop_id',_shop_id));
  RETURN _shop_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_assign_shop_owner(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_shop_owner(uuid, text) TO authenticated;