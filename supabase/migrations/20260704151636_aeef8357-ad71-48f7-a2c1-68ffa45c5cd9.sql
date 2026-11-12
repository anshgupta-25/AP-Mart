
CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_cart(_user_id uuid, _lat double precision, _lng double precision, _exclude uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _shop_id uuid;
BEGIN
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true
    AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(_exclude))
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci
      LEFT JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = s.id
      WHERE ci.user_id = _user_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < ci.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((
             SELECT AVG(r.rating)::numeric
             FROM public.reviews r
             JOIN public.shop_products sp2 ON sp2.product_id = r.product_id
             WHERE sp2.shop_id = s.id
           ), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $function$;

CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_order(_order_id uuid)
 RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _shop_id uuid; _lat double precision; _lng double precision; _excl uuid[];
BEGIN
  SELECT delivery_lat, delivery_lng, rejected_shop_ids INTO _lat, _lng, _excl FROM public.orders WHERE id = _order_id;
  IF _lat IS NULL THEN RETURN NULL; END IF;
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true
    AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(_excl))
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      LEFT JOIN public.shop_products sp ON sp.product_id = oi.product_id AND sp.shop_id = s.id
      WHERE oi.order_id = _order_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((
             SELECT AVG(r.rating)::numeric
             FROM public.reviews r
             JOIN public.shop_products sp2 ON sp2.product_id = r.product_id
             WHERE sp2.shop_id = s.id
           ), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $function$;
