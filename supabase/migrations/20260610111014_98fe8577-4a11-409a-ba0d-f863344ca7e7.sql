CREATE OR REPLACE FUNCTION public.admin_list_complaints()
RETURNS TABLE(
  id uuid, ticket_number text, title text, description text,
  category text, status text, role_at_creation text,
  created_at timestamptz, user_id uuid,
  full_name text, phone text,
  address_line text, city text, pincode text,
  shop_name text, shop_address text, shop_phone text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    t.id, t.ticket_number, t.title, t.description,
    t.category::text, t.status::text, t.role_at_creation,
    t.created_at, t.user_id,
    p.full_name, COALESCE(p.phone, a.phone) AS phone,
    CONCAT_WS(', ', a.line1, a.line2, a.landmark) AS address_line,
    a.city, a.pincode,
    s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone
  FROM public.support_tickets t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.addresses
    WHERE user_id = t.user_id
    ORDER BY is_default DESC NULLS LAST, updated_at DESC
    LIMIT 1
  ) a ON TRUE
  LEFT JOIN LATERAL (
    SELECT * FROM public.shops
    WHERE owner_id = t.user_id
    ORDER BY created_at ASC
    LIMIT 1
  ) s ON TRUE
  WHERE t.role_at_creation IN ('customer','shopkeeper')
  ORDER BY t.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_complaints() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_complaints() TO authenticated;