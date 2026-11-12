DROP FUNCTION IF EXISTS public.support_list_complaints();

CREATE OR REPLACE FUNCTION public.support_list_complaints()
 RETURNS TABLE(id uuid, ticket_number text, title text, description text, category text, status text, role_at_creation text, created_at timestamp with time zone, assigned_to uuid, user_id uuid, full_name text, phone text, address_line text, city text, pincode text, shop_name text, shop_address text, shop_phone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'support'::app_role)
    OR EXISTS (SELECT 1 FROM public.support_agents sa WHERE sa.user_id = auth.uid() AND sa.is_active = true)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    t.id, t.ticket_number, t.title, t.description,
    t.category::text, t.status::text, t.role_at_creation,
    t.created_at, t.assigned_to, t.user_id,
    p.full_name, COALESCE(p.phone, a.phone) AS phone,
    CONCAT_WS(', ', a.line1, a.line2, a.landmark) AS address_line,
    a.city, a.pincode,
    s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone
  FROM public.support_tickets t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN LATERAL (
    SELECT addr.* FROM public.addresses addr
    WHERE addr.user_id = t.user_id
    ORDER BY addr.is_default DESC NULLS LAST, addr.updated_at DESC
    LIMIT 1
  ) a ON TRUE
  LEFT JOIN LATERAL (
    SELECT sh.* FROM public.shops sh
    WHERE sh.owner_id = t.user_id
    ORDER BY sh.created_at ASC
    LIMIT 1
  ) s ON TRUE
  ORDER BY t.created_at DESC
  LIMIT 500;
END;
$function$;