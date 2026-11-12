CREATE OR REPLACE FUNCTION public.list_eligible_shops_for_product(_product_id uuid, _variant_id uuid DEFAULT NULL::uuid, _pincode text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision)
 RETURNS TABLE(shop_id uuid, shop_name text, shop_address text, latitude double precision, longitude double precision, pincode text, service_radius_km numeric, distance_km numeric, delivery_minutes integer, price numeric, mrp numeric, stock integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, s.name, s.address, s.latitude, s.longitude, s.pincode, s.service_radius_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN round(public.haversine_km(s.latitude, s.longitude, _lat, _lng)::numeric, 2) ELSE NULL END AS distance_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN GREATEST(8, LEAST(45, (public.haversine_km(s.latitude, s.longitude, _lat, _lng) * 4 + 8)::int)) ELSE 15 END AS delivery_minutes,
    -- Shop inventory price is authoritative for the default/base size.
    -- Only a non-default variant falls back to catalog variant pricing.
    (CASE WHEN pv.id IS NULL OR pv.is_default THEN sp.price ELSE pv.selling_price END) AS price,
    GREATEST(
      (CASE WHEN pv.id IS NULL OR pv.is_default THEN sp.price ELSE pv.selling_price END),
      (CASE WHEN pv.id IS NULL OR pv.is_default
            THEN COALESCE(sp.mrp, pr.mrp, sp.price)
            ELSE COALESCE(pv.mrp, pr.mrp, pv.selling_price) END)
    ) AS mrp,
    (CASE WHEN pv.id IS NULL THEN sp.stock ELSE LEAST(pv.stock, sp.stock) END) AS stock
  FROM public.shops s
  JOIN public.shop_products sp ON sp.shop_id = s.id AND sp.product_id = _product_id AND sp.is_available = true
  JOIN public.products pr ON pr.id = sp.product_id
  LEFT JOIN public.product_variants pv ON pv.id = _variant_id AND pv.product_id = _product_id AND pv.is_available = true
  WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
    AND (_pincode IS NULL OR s.pincode = _pincode)
    AND (_lat IS NULL OR _lng IS NULL OR public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km)
    AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
    AND (CASE WHEN pv.id IS NULL THEN sp.stock ELSE LEAST(pv.stock, sp.stock) END) > 0
  ORDER BY distance_km NULLS LAST, price ASC;
$function$;

CREATE OR REPLACE FUNCTION public.list_customer_products(_pincode text, _category_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text, _only_featured boolean DEFAULT false, _only_bestseller boolean DEFAULT false, _sort text DEFAULT 'relevance'::text, _limit integer DEFAULT 60, _ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, slug text, name text, unit text, price numeric, mrp numeric, image_url text, delivery_minutes integer, stock integer, rating numeric, category_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH rows AS (
    SELECT sp.product_id, sp.price, sp.mrp, sp.stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
  ),
  best AS (
    -- The cheapest eligible shop row wins, and its own MRP travels with it
    SELECT DISTINCT ON (r.product_id) r.product_id, r.price AS min_price, r.mrp AS shop_mrp
    FROM rows r
    ORDER BY r.product_id, r.price ASC
  ),
  totals AS (
    SELECT r.product_id, SUM(r.stock)::int AS total_stock FROM rows r GROUP BY r.product_id
  ),
  eligible AS (
    SELECT b.product_id, b.min_price, b.shop_mrp, t.total_stock
    FROM best b JOIN totals t ON t.product_id = b.product_id
  ),
  variant_img AS (
    SELECT DISTINCT ON (pv.product_id) pv.product_id,
           CASE WHEN pv.images IS NOT NULL AND array_length(pv.images, 1) > 0 THEN pv.images[1] ELSE NULL END AS img
    FROM public.product_variants pv WHERE pv.is_available = true
    ORDER BY pv.product_id, pv.is_default DESC, pv.display_order ASC, pv.created_at ASC
  )
  SELECT p.id, p.slug, p.name, p.unit,
         COALESCE(e.min_price, p.price) AS price,
         GREATEST(COALESCE(e.min_price, p.price), COALESCE(e.shop_mrp, p.mrp, p.price)) AS mrp,
         COALESCE(p.cover_image,
           CASE WHEN p.image_gallery IS NOT NULL AND array_length(p.image_gallery, 1) > 0 THEN p.image_gallery[1] ELSE NULL END,
           p.image_url, vi.img) AS image_url,
         p.delivery_minutes, COALESCE(e.total_stock, p.stock) AS stock, p.rating, p.category_id
  FROM public.products p
  JOIN eligible e ON e.product_id = p.id
  LEFT JOIN variant_img vi ON vi.product_id = p.id
  WHERE p.is_available = true
    AND (_category_id IS NULL
         OR p.category_id = _category_id
         OR EXISTS (SELECT 1 FROM public.product_categories pc
                    WHERE pc.product_id = p.id AND pc.category_id = _category_id))
    AND (_search IS NULL
         OR p.name ILIKE '%' || _search || '%'
         OR EXISTS (SELECT 1 FROM public.product_categories pc2
                    JOIN public.categories c2 ON c2.id = pc2.category_id
                    WHERE pc2.product_id = p.id AND c2.name ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM public.categories c3
                    WHERE c3.id = p.category_id AND c3.name ILIKE '%' || _search || '%'))
    AND (NOT _only_featured OR p.is_featured = true)
    AND (NOT _only_bestseller OR p.is_bestseller = true)
    AND (_ids IS NULL OR p.id = ANY(_ids))
  ORDER BY
    CASE WHEN _sort = 'price_asc'  THEN COALESCE(e.min_price, p.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc' THEN COALESCE(e.min_price, p.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'rating'     THEN p.rating END DESC NULLS LAST,
    p.is_featured DESC, p.is_bestseller DESC, p.rating DESC
  LIMIT GREATEST(_limit, 1);
$function$;