CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, full_name text, phone text, email text, address text, status text, created_at timestamp with time zone, roles app_role[], pending_request_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_super boolean;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  v_is_super := public.is_super_admin(auth.uid());

  RETURN QUERY
  SELECT p.id, p.full_name, p.phone, u.email::text, p.address, p.status, p.created_at,
    COALESCE(
      ARRAY_AGG(DISTINCT ur.role) FILTER (
        WHERE ur.role IS NOT NULL
          AND (v_is_super OR ur.role::text <> 'super_admin')
      ), '{}'::app_role[]
    ) AS roles,
    (SELECT COUNT(*)::int FROM public.role_requests rr WHERE rr.user_id = p.id AND rr.status = 'pending') AS pending_request_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE v_is_super OR NOT EXISTS (
    SELECT 1 FROM public.user_roles s
    WHERE s.user_id = p.id AND s.role::text = 'super_admin'
  )
  GROUP BY p.id, u.email
  ORDER BY p.created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_search_users(_q text, _limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_is_super boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _q IS NULL OR length(trim(_q)) < 2 THEN RETURN; END IF;
  v_is_super := public.is_super_admin(auth.uid());
  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name, p.phone, COALESCE(p.status,'active')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE (u.email ILIKE '%'||_q||'%' OR p.full_name ILIKE '%'||_q||'%' OR p.phone ILIKE '%'||_q||'%')
    AND (v_is_super OR NOT EXISTS (
      SELECT 1 FROM public.user_roles s WHERE s.user_id = u.id AND s.role::text = 'super_admin'
    ))
  ORDER BY u.email
  LIMIT LEAST(GREATEST(_limit,1), 25);
END; $function$;