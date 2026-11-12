
CREATE OR REPLACE FUNCTION public.debug_shop_routing(
  _pincode text,
  _lat double precision,
  _lng double precision,
  _order_id uuid DEFAULT NULL
)
RETURNS TABLE(
  shop_id uuid,
  shop_name text,
  shop_pincode text,
  is_open boolean,
  has_owner boolean,
  distance_km numeric,
  service_radius_km numeric,
  pincode_match boolean,
  within_radius boolean,
  previously_rejected boolean,
  missing_items int,
  eligible boolean,
  reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _excl uuid[] := '{}';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF _order_id IS NOT NULL THEN
    SELECT rejected_shop_ids INTO _excl FROM public.orders WHERE id = _order_id;
    _excl := COALESCE(_excl, '{}');
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.pincode,
    s.is_open,
    (s.owner_id IS NOT NULL) AS has_owner,
    ROUND(public.haversine_km(s.latitude, s.longitude, _lat, _lng)::numeric, 2),
    s.service_radius_km::numeric,
    (s.pincode = _pincode) AS pincode_match,
    (public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km) AS within_radius,
    (s.id = ANY(_excl)) AS previously_rejected,
    CASE
      WHEN _order_id IS NOT NULL THEN (
        SELECT COUNT(*)::int FROM public.order_items oi
        LEFT JOIN public.shop_products sp
          ON sp.product_id = oi.product_id AND sp.shop_id = s.id
        WHERE oi.order_id = _order_id
          AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
      )
      ELSE 0
    END AS missing_items,
    (
      s.is_open
      AND s.owner_id IS NOT NULL
      AND s.pincode = _pincode
      AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
      AND NOT (s.id = ANY(_excl))
      AND (_order_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        LEFT JOIN public.shop_products sp
          ON sp.product_id = oi.product_id AND sp.shop_id = s.id
        WHERE oi.order_id = _order_id
          AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
      ))
    ) AS eligible,
    CASE
      WHEN NOT s.is_open THEN 'shop_closed'
      WHEN s.owner_id IS NULL THEN 'no_shopkeeper_assigned'
      WHEN s.pincode <> _pincode THEN 'pincode_mismatch'
      WHEN public.haversine_km(s.latitude, s.longitude, _lat, _lng) > s.service_radius_km THEN 'outside_service_radius'
      WHEN s.id = ANY(_excl) THEN 'previously_rejected'
      WHEN _order_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.order_items oi
        LEFT JOIN public.shop_products sp
          ON sp.product_id = oi.product_id AND sp.shop_id = s.id
        WHERE oi.order_id = _order_id
          AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
      ) THEN 'missing_stock'
      ELSE 'eligible'
    END AS reason
  FROM public.shops s
  ORDER BY
    (s.is_open AND s.owner_id IS NOT NULL AND s.pincode = _pincode) DESC,
    public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC;
END $$;

REVOKE ALL ON FUNCTION public.debug_shop_routing(text, double precision, double precision, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_shop_routing(text, double precision, double precision, uuid) TO authenticated;
