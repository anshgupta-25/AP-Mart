
-- Admin can assign/remove roles via SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
END $$;

-- Admin listing of users with roles
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid, full_name text, phone text, created_at timestamptz, roles app_role[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.phone, p.created_at,
    COALESCE(ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}'::app_role[]) AS roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id
  ORDER BY p.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.admin_assign_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_remove_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
