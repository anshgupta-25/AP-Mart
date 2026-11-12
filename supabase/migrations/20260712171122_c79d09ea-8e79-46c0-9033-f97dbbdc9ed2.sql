
DROP FUNCTION IF EXISTS public.partner_available_orders();

CREATE OR REPLACE FUNCTION public.partner_available_orders()
 RETURNS TABLE(
   id uuid, order_number text, total numeric,
   city text, area_pincode text, placed_at timestamptz,
   item_count bigint, shop_name text,
   delivery_type text, fast_delivery_fee numeric
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid := public.current_user_partner_id();
BEGIN
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  RETURN QUERY
  SELECT o.id, o.order_number, o.total,
         (o.address->>'city')::text,
         (o.address->>'pincode')::text,
         o.placed_at,
         (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id),
         s.name,
         o.delivery_type,
         o.fast_delivery_fee
  FROM public.orders o
  LEFT JOIN public.shops s ON s.id = o.shop_id
  WHERE o.partner_id = _pid
    AND o.status = 'packed'::order_status
    AND COALESCE(o.delivery_type,'standard_delivery') <> 'pickup'
  ORDER BY (CASE WHEN o.delivery_type = 'fast_delivery' THEN 0 ELSE 1 END) ASC,
           o.placed_at ASC;
END $function$;
