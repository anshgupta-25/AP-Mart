CREATE OR REPLACE FUNCTION public.admin_remove_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _user_id = auth.uid() AND _role = 'admin' THEN
    RAISE EXCEPTION 'You cannot remove your own admin role';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
END $function$;