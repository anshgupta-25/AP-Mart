
CREATE OR REPLACE FUNCTION public.list_eligible_shops_for_cart(
  _pincode text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
) RETURNS TABLE (
  shop_id uuid,
  shop_name text,
  shop_address text,
  latitude double precision,
  longitude double precision,
  pincode text,
  service_radius_km numeric,
  distance_km numeric,
  delivery_minutes int,
  price numeric,
  mrp numeric,
  stock int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cart_count int;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _cart_count FROM public.cart_items WHERE user_id = _uid;
  IF _cart_count = 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH cart AS (
    SELECT ci.product_id, ci.variant_id, ci.quantity
    FROM public.cart_items ci WHERE ci.user_id = _uid
  ),
  shop_match AS (
    SELECT s.id AS shop_id, s.name, s.address, s.latitude, s.longitude, s.pincode, s.service_radius_km
    FROM public.shops s
    WHERE s.is_open = true AND s.owner_id IS NOT NULL
      AND (_pincode IS NULL OR s.pincode = _pincode)
      AND (
        _lat IS NULL OR _lng IS NULL
        OR public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
      )
  ),
  eligible AS (
    SELECT sm.shop_id, sm.name, sm.address, sm.latitude, sm.longitude, sm.pincode, sm.service_radius_km,
           SUM(COALESCE(pv.selling_price, sp.price) * c.quantity) AS total_price,
           SUM(COALESCE(pv.mrp, sp.price) * c.quantity) AS total_mrp,
           MIN(COALESCE(pv.stock, sp.stock)) AS min_stock
    FROM shop_match sm
    JOIN cart c ON true
    JOIN public.shop_products sp ON sp.shop_id = sm.shop_id AND sp.product_id = c.product_id AND sp.is_available = true
    LEFT JOIN public.product_variants pv ON pv.id = c.variant_id AND pv.is_available = true
    WHERE COALESCE(pv.stock, sp.stock) >= c.quantity
    GROUP BY sm.shop_id, sm.name, sm.address, sm.latitude, sm.longitude, sm.pincode, sm.service_radius_km
    HAVING COUNT(*) = (SELECT COUNT(*) FROM cart)
  )
  SELECT
    e.shop_id, e.name, e.address, e.latitude, e.longitude, e.pincode, e.service_radius_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN round(public.haversine_km(e.latitude, e.longitude, _lat, _lng)::numeric, 2)
      ELSE NULL END AS distance_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN GREATEST(8, LEAST(45, (public.haversine_km(e.latitude, e.longitude, _lat, _lng) * 4 + 8)::int))
      ELSE 15 END AS delivery_minutes,
    e.total_price::numeric AS price,
    e.total_mrp::numeric AS mrp,
    e.min_stock::int AS stock
  FROM eligible e
  ORDER BY distance_km NULLS LAST, price ASC;
END $$;

REVOKE ALL ON FUNCTION public.list_eligible_shops_for_cart(text, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_eligible_shops_for_cart(text, double precision, double precision) TO authenticated;
