-- 1. Category enrichment
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- 2. Subcategories
CREATE TABLE IF NOT EXISTS public.subcategories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  image_url text,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

GRANT SELECT ON public.subcategories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
GRANT ALL ON public.subcategories TO service_role;

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sub_public_read ON public.subcategories;
CREATE POLICY sub_public_read ON public.subcategories
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS sub_admin_all ON public.subcategories;
CREATE POLICY sub_admin_all ON public.subcategories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS subcategories_category_order_idx
  ON public.subcategories (category_id, display_order, name);

DROP TRIGGER IF EXISTS trg_subcategories_updated_at ON public.subcategories;
CREATE TRIGGER trg_subcategories_updated_at
  BEFORE UPDATE ON public.subcategories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Product -> subcategory link
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_subcategory_idx ON public.products (subcategory_id);

-- Keep subcategory consistent with the product's category
CREATE OR REPLACE FUNCTION public.tg_product_subcategory_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE parent uuid;
BEGIN
  IF NEW.subcategory_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT category_id INTO parent FROM public.subcategories WHERE id = NEW.subcategory_id;
  IF parent IS NULL THEN
    RAISE EXCEPTION 'Subcategory does not exist';
  END IF;
  IF NEW.category_id IS NULL THEN
    NEW.category_id := parent;
  ELSIF NEW.category_id <> parent THEN
    RAISE EXCEPTION 'Subcategory does not belong to the selected category';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_subcategory_guard ON public.products;
CREATE TRIGGER trg_product_subcategory_guard
  BEFORE INSERT OR UPDATE OF subcategory_id, category_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_product_subcategory_guard();

-- 4. Seed starter hierarchy
INSERT INTO public.subcategories (category_id, name, slug, display_order)
SELECT c.id, v.name, v.slug, v.ord
FROM public.categories c
JOIN (VALUES
  ('grocery','Cooking Oil','cooking-oil',1),
  ('grocery','Rice','rice',2),
  ('grocery','Dal','dal',3),
  ('grocery','Flour','flour',4),
  ('grocery','Sugar','sugar',5),
  ('grocery','Salt','salt',6),
  ('dairy','Milk','milk',1),
  ('dairy','Butter','butter',2),
  ('dairy','Cheese','cheese',3),
  ('dairy','Paneer','paneer',4),
  ('dairy','Curd','curd',5),
  ('pooja','Agarbatti','agarbatti',1),
  ('pooja','Diya','diya',2),
  ('pooja','Camphor','camphor',3),
  ('pooja','Flowers','flowers',4)
) AS v(cat, name, slug, ord)
  ON lower(c.slug) LIKE '%' || v.cat || '%' OR lower(c.name) LIKE '%' || v.cat || '%'
ON CONFLICT (category_id, slug) DO NOTHING;

-- 5. Subcategory bar with live counts
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
           WHERE p.is_available = true AND p.subcategory_id = sc.id
         ), 0) AS product_count
  FROM public.subcategories sc
  WHERE sc.category_id = _category_id AND sc.is_active = true
  ORDER BY sc.display_order, sc.name;
$$;

REVOKE ALL ON FUNCTION public.list_category_subcategories(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.list_category_subcategories(uuid, text) TO anon, authenticated, service_role;

-- 6. Category product listing gains a single-subcategory filter
CREATE OR REPLACE FUNCTION public.list_category_products(
  _pincode text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _search text DEFAULT NULL,
  _brands text[] DEFAULT NULL,
  _sizes text[] DEFAULT NULL,
  _subcategory_ids uuid[] DEFAULT NULL,
  _min_price numeric DEFAULT NULL,
  _max_price numeric DEFAULT NULL,
  _min_rating numeric DEFAULT NULL,
  _min_discount integer DEFAULT NULL,
  _sort text DEFAULT 'relevance',
  _limit integer DEFAULT 60,
  _subcategory_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, slug text, name text, unit text, price numeric, mrp numeric, image_url text, delivery_minutes integer, stock integer, rating numeric, category_id uuid, brand text, subcategory_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
    AND (_subcategory_id IS NULL OR p.subcategory_id = _subcategory_id)
    AND (_search IS NULL OR p.name ILIKE '%' || _search || '%')
    AND (_brands IS NULL OR array_length(_brands, 1) IS NULL
         OR btrim(COALESCE(p.brand, '')) = ANY(_brands))
    AND (_sizes IS NULL OR array_length(_sizes, 1) IS NULL
         OR btrim(COALESCE(p.unit, '')) = ANY(_sizes)
         OR EXISTS (SELECT 1 FROM public.product_variants pv2
                    WHERE pv2.product_id = p.id AND pv2.is_available = true
                      AND btrim(pv2.size || ' ' || COALESCE(pv2.unit, '')) = ANY(_sizes)))
    AND (_subcategory_ids IS NULL OR array_length(_subcategory_ids, 1) IS NULL
         OR EXISTS (SELECT 1 FROM public.product_categories pc3
                    WHERE pc3.product_id = p.id AND pc3.category_id = ANY(_subcategory_ids)))
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
$$;

REVOKE ALL ON FUNCTION public.list_category_products(text, uuid, text, text[], text[], uuid[], numeric, numeric, numeric, integer, text, integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_category_products(text, uuid, text, text[], text[], uuid[], numeric, numeric, numeric, integer, text, integer, uuid) TO anon, authenticated, service_role;