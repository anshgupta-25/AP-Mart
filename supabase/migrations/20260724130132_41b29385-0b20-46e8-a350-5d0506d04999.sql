CREATE OR REPLACE FUNCTION public.list_customer_products(
  _pincode text,
  _category_id uuid DEFAULT NULL,
  _search text DEFAULT NULL,
  _only_featured boolean DEFAULT false,
  _only_bestseller boolean DEFAULT false,
  _sort text DEFAULT 'relevance',
  _limit integer DEFAULT 60,
  _ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  unit text,
  price numeric,
  mrp numeric,
  image_url text,
  delivery_minutes integer,
  stock integer,
  rating numeric,
  category_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT sp.product_id,
           MIN(sp.price) AS min_price,
           SUM(sp.stock)::int AS total_stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true
      AND sp.stock > 0
      AND s.is_open = true
      AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
    GROUP BY sp.product_id
  ),
  variant_img AS (
    SELECT DISTINCT ON (pv.product_id)
           pv.product_id,
           CASE WHEN pv.images IS NOT NULL AND array_length(pv.images, 1) > 0
                THEN pv.images[1] ELSE NULL END AS img
    FROM public.product_variants pv
    WHERE pv.is_available = true
    ORDER BY pv.product_id, pv.is_default DESC, pv.display_order ASC, pv.created_at ASC
  )
  SELECT p.id, p.slug, p.name, p.unit,
         COALESCE(e.min_price, p.price) AS price,
         p.mrp,
         COALESCE(
           p.cover_image,
           CASE WHEN p.image_gallery IS NOT NULL AND array_length(p.image_gallery, 1) > 0
                THEN p.image_gallery[1] ELSE NULL END,
           p.image_url,
           vi.img
         ) AS image_url,
         p.delivery_minutes,
         COALESCE(e.total_stock, p.stock) AS stock,
         p.rating, p.category_id
  FROM public.products p
  JOIN eligible e ON e.product_id = p.id
  LEFT JOIN variant_img vi ON vi.product_id = p.id
  WHERE p.is_available = true
    AND (_category_id IS NULL OR p.category_id = _category_id)
    AND (_search IS NULL OR p.name ILIKE '%' || _search || '%')
    AND (NOT _only_featured OR p.is_featured = true)
    AND (NOT _only_bestseller OR p.is_bestseller = true)
    AND (_ids IS NULL OR p.id = ANY(_ids))
  ORDER BY
    CASE WHEN _sort = 'price_asc'  THEN COALESCE(e.min_price, p.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc' THEN COALESCE(e.min_price, p.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'rating'     THEN p.rating END DESC NULLS LAST,
    p.is_featured DESC, p.is_bestseller DESC, p.rating DESC
  LIMIT GREATEST(_limit, 1);
$$;