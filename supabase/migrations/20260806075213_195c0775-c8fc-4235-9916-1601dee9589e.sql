-- 1. Junction table: product ↔ subcategories (many-to-many)
CREATE TABLE IF NOT EXISTS public.product_subcategories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, subcategory_id)
);

GRANT SELECT ON public.product_subcategories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_subcategories TO authenticated;
GRANT ALL ON public.product_subcategories TO service_role;

ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psub_public_read" ON public.product_subcategories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "psub_manage_staff" ON public.product_subcategories
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.shop_products sp
      JOIN public.shops sh ON sh.id = sp.shop_id
      WHERE sp.product_id = product_subcategories.product_id
        AND sh.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'shopkeeper')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'shopkeeper')
  );

CREATE INDEX IF NOT EXISTS idx_product_subcategories_sub ON public.product_subcategories(subcategory_id);

-- 2. Backfill from the legacy single-subcategory column
INSERT INTO public.product_subcategories (product_id, subcategory_id)
SELECT p.id, p.subcategory_id FROM public.products p
WHERE p.subcategory_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Subcategory bar counts include junction links
CREATE OR REPLACE FUNCTION public.list_category_subcategories(
  _category_id uuid,
  _pincode text DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, slug text, image_url text, icon text, display_order integer, product_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT DISTINCT sp.product_id
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
  )
  SELECT sc.id, sc.name, sc.slug, sc.image_url, sc.icon, sc.display_order,
         COALESCE((
           SELECT count(*)::int FROM public.products p
           JOIN eligible e ON e.product_id = p.id
           WHERE p.is_available = true
             AND (p.subcategory_id = sc.id
                  OR EXISTS (SELECT 1 FROM public.product_subcategories ps
                             WHERE ps.product_id = p.id AND ps.subcategory_id = sc.id))
         ), 0) AS product_count
  FROM public.subcategories sc
  WHERE sc.category_id = _category_id AND sc.is_active = true
  ORDER BY sc.display_order, sc.name;
$$;

REVOKE ALL ON FUNCTION public.list_category_subcategories(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.list_category_subcategories(uuid, text) TO anon, authenticated, service_role;

-- 4. Facets: subcategory counts via junction (falling back to legacy column)
CREATE OR REPLACE FUNCTION public.category_filter_facets(_pincode text DEFAULT NULL::text, _category_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT sp.product_id, MIN(sp.price) AS min_price, SUM(sp.stock)::int AS total_stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
    GROUP BY sp.product_id
  ),
  prods AS (
    SELECT p.id, p.brand, p.unit, p.rating, p.mrp, p.category_id, p.subcategory_id,
           p.delivery_minutes,
           COALESCE(e.min_price, p.price) AS price
    FROM public.products p
    JOIN eligible e ON e.product_id = p.id
    WHERE p.is_available = true
      AND (_category_id IS NULL
           OR p.category_id = _category_id
           OR EXISTS (SELECT 1 FROM public.product_categories pc
                      WHERE pc.product_id = p.id AND pc.category_id = _category_id))
  ),
  sizes AS (
    SELECT DISTINCT pr.id AS product_id, lbl
    FROM prods pr
    CROSS JOIN LATERAL (
      SELECT NULLIF(btrim(pv.size || ' ' || COALESCE(pv.unit, '')), '') AS lbl
      FROM public.product_variants pv
      WHERE pv.product_id = pr.id AND pv.is_available = true
      UNION
      SELECT NULLIF(btrim(pr.unit), '')
    ) s
    WHERE lbl IS NOT NULL
  ),
  prod_subs AS (
    SELECT DISTINCT pr.id AS product_id, sid FROM prods pr
    CROSS JOIN LATERAL (
      SELECT pr.subcategory_id AS sid WHERE pr.subcategory_id IS NOT NULL
      UNION
      SELECT ps.subcategory_id FROM public.product_subcategories ps WHERE ps.product_id = pr.id
    ) u
  ),
  subcats AS (
    SELECT sc.id AS sub_id, sc.name, sc.display_order, count(DISTINCT x.product_id) AS cnt
    FROM prod_subs x
    JOIN public.subcategories sc ON sc.id = x.sid
    WHERE sc.is_active = true
      AND (_category_id IS NULL OR sc.category_id = _category_id)
    GROUP BY sc.id, sc.name, sc.display_order
  ),
  delivery AS (
    SELECT CASE WHEN delivery_minutes <= 15 THEN 'express'
                WHEN delivery_minutes <= 30 THEN 'fast'
                ELSE 'standard' END AS key,
           count(*) AS cnt
    FROM prods
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM prods),
    'min_price', (SELECT COALESCE(floor(min(price)), 0) FROM prods),
    'max_price', (SELECT COALESCE(ceil(max(price)), 0) FROM prods),
    'brands', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'label')
      FROM (
        SELECT jsonb_build_object('label', btrim(brand), 'count', count(*)) AS x
        FROM prods WHERE NULLIF(btrim(COALESCE(brand, '')), '') IS NOT NULL
        GROUP BY btrim(brand)
      ) b
    ), '[]'::jsonb),
    'sizes', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'label')
      FROM (
        SELECT jsonb_build_object('label', lbl, 'count', count(DISTINCT product_id)) AS x
        FROM sizes GROUP BY lbl
      ) s2
    ), '[]'::jsonb),
    'subcategories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', sub_id, 'label', name, 'count', cnt)
                       ORDER BY display_order, name)
      FROM subcats
    ), '[]'::jsonb),
    'delivery', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'value', key,
               'label', CASE key WHEN 'express' THEN 'Express (under 15 min)'
                                 WHEN 'fast' THEN 'Fast (under 30 min)'
                                 ELSE 'Standard' END,
               'count', cnt)
               ORDER BY CASE key WHEN 'express' THEN 1 WHEN 'fast' THEN 2 ELSE 3 END)
      FROM delivery
    ), '[]'::jsonb),
    'ratings', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'value')::numeric DESC)
      FROM (
        SELECT jsonb_build_object('value', v, 'count', (SELECT count(*) FROM prods WHERE rating >= v)) AS x
        FROM (VALUES (4.0), (3.0), (2.0)) t(v)
        WHERE EXISTS (SELECT 1 FROM prods WHERE rating >= t.v)
      ) r
    ), '[]'::jsonb),
    'discounts', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'value')::int DESC)
      FROM (
        SELECT jsonb_build_object('value', v, 'count', (
                 SELECT count(*) FROM prods
                 WHERE mrp > 0 AND round((mrp - price) / mrp * 100) >= t.v)) AS x
        FROM (VALUES (50), (30), (20), (10)) t(v)
        WHERE EXISTS (SELECT 1 FROM prods
                      WHERE mrp > 0 AND round((mrp - price) / mrp * 100) >= t.v)
      ) d
    ), '[]'::jsonb)
  );
$function$;

-- 5. Product listing: subcategory filters match junction rows too
CREATE OR REPLACE FUNCTION public.list_category_products(_pincode text DEFAULT NULL::text, _category_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text, _brands text[] DEFAULT NULL::text[], _sizes text[] DEFAULT NULL::text[], _subcategory_ids uuid[] DEFAULT NULL::uuid[], _min_price numeric DEFAULT NULL::numeric, _max_price numeric DEFAULT NULL::numeric, _min_rating numeric DEFAULT NULL::numeric, _min_discount integer DEFAULT NULL::integer, _sort text DEFAULT 'relevance'::text, _limit integer DEFAULT 60, _subcategory_id uuid DEFAULT NULL::uuid, _delivery text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, slug text, name text, unit text, price numeric, mrp numeric, image_url text, delivery_minutes integer, stock integer, rating numeric, category_id uuid, brand text, subcategory_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT sp.product_id, MIN(sp.price) AS min_price, SUM(sp.stock)::int AS total_stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
    GROUP BY sp.product_id
  ),
  variant_img AS (
    SELECT DISTINCT ON (pv.product_id) pv.product_id,
           CASE WHEN pv.images IS NOT NULL AND array_length(pv.images, 1) > 0 THEN pv.images[1] ELSE NULL END AS img
    FROM public.product_variants pv WHERE pv.is_available = true
    ORDER BY pv.product_id, pv.is_default DESC, pv.display_order ASC, pv.created_at ASC
  )
  SELECT p.id, p.slug, p.name, p.unit,
         COALESCE(e.min_price, p.price) AS price, p.mrp,
         COALESCE(p.cover_image,
           CASE WHEN p.image_gallery IS NOT NULL AND array_length(p.image_gallery, 1) > 0 THEN p.image_gallery[1] ELSE NULL END,
           p.image_url, vi.img) AS image_url,
         p.delivery_minutes, COALESCE(e.total_stock, p.stock) AS stock, p.rating, p.category_id, p.brand,
         p.subcategory_id
  FROM public.products p
  JOIN eligible e ON e.product_id = p.id
  LEFT JOIN variant_img vi ON vi.product_id = p.id
  WHERE p.is_available = true
    AND (_category_id IS NULL
         OR p.category_id = _category_id
         OR EXISTS (SELECT 1 FROM public.product_categories pc
                    WHERE pc.product_id = p.id AND pc.category_id = _category_id))
    AND (_subcategory_id IS NULL
         OR p.subcategory_id = _subcategory_id
         OR EXISTS (SELECT 1 FROM public.product_subcategories ps
                    WHERE ps.product_id = p.id AND ps.subcategory_id = _subcategory_id))
    AND (_search IS NULL OR p.name ILIKE '%' || _search || '%')
    AND (_brands IS NULL OR array_length(_brands, 1) IS NULL
         OR btrim(COALESCE(p.brand, '')) = ANY(_brands))
    AND (_sizes IS NULL OR array_length(_sizes, 1) IS NULL
         OR btrim(COALESCE(p.unit, '')) = ANY(_sizes)
         OR EXISTS (SELECT 1 FROM public.product_variants pv2
                    WHERE pv2.product_id = p.id AND pv2.is_available = true
                      AND btrim(pv2.size || ' ' || COALESCE(pv2.unit, '')) = ANY(_sizes)))
    AND (_subcategory_ids IS NULL OR array_length(_subcategory_ids, 1) IS NULL
         OR p.subcategory_id = ANY(_subcategory_ids)
         OR EXISTS (SELECT 1 FROM public.product_subcategories ps2
                    WHERE ps2.product_id = p.id AND ps2.subcategory_id = ANY(_subcategory_ids)))
    AND (_delivery IS NULL OR array_length(_delivery, 1) IS NULL
         OR (CASE WHEN p.delivery_minutes <= 15 THEN 'express'
                  WHEN p.delivery_minutes <= 30 THEN 'fast'
                  ELSE 'standard' END) = ANY(_delivery))
    AND (_min_price IS NULL OR COALESCE(e.min_price, p.price) >= _min_price)
    AND (_max_price IS NULL OR COALESCE(e.min_price, p.price) <= _max_price)
    AND (_min_rating IS NULL OR p.rating >= _min_rating)
    AND (_min_discount IS NULL OR (p.mrp > 0
         AND round((p.mrp - COALESCE(e.min_price, p.price)) / p.mrp * 100) >= _min_discount))
  ORDER BY
    CASE WHEN _sort = 'price_asc'  THEN COALESCE(e.min_price, p.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc' THEN COALESCE(e.min_price, p.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'rating'     THEN p.rating END DESC NULLS LAST,
    p.is_featured DESC, p.is_bestseller DESC, p.rating DESC
  LIMIT GREATEST(_limit, 1);
$function$;

REVOKE ALL ON FUNCTION public.category_filter_facets(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.category_filter_facets(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_category_products(text, uuid, text, text[], text[], uuid[], numeric, numeric, numeric, integer, text, integer, uuid, text[]) TO anon, authenticated;