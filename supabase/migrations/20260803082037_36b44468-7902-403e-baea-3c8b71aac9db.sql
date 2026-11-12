CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, category_id)
);

GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc_public_read" ON public.product_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "pc_admin_all" ON public.product_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "pc_shopkeeper_manage" ON public.product_categories
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'shopkeeper'::app_role) AND EXISTS (
      SELECT 1 FROM public.shop_products sp
      JOIN public.shops s ON s.id = sp.shop_id
      WHERE sp.product_id = product_categories.product_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'shopkeeper'::app_role) AND EXISTS (
      SELECT 1 FROM public.shops s WHERE s.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_product_categories_category ON public.product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON public.product_categories(product_id);

-- Backfill existing single-category products
INSERT INTO public.product_categories (product_id, category_id)
SELECT p.id, p.category_id FROM public.products p
WHERE p.category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_customer_products(_pincode text, _category_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text, _only_featured boolean DEFAULT false, _only_bestseller boolean DEFAULT false, _sort text DEFAULT 'relevance'::text, _limit integer DEFAULT 60, _ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, slug text, name text, unit text, price numeric, mrp numeric, image_url text, delivery_minutes integer, stock integer, rating numeric, category_id uuid)
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