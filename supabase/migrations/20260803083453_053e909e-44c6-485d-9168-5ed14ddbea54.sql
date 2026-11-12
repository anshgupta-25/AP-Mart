-- 1. Normalized name for smart duplicate detection
CREATE OR REPLACE FUNCTION public.normalize_product_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(coalesce(_name, '')), '[^a-z0-9]+', '', 'g')
$$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_normalized text;

UPDATE public.products
  SET name_normalized = public.normalize_product_name(name)
  WHERE name_normalized IS DISTINCT FROM public.normalize_product_name(name);

CREATE OR REPLACE FUNCTION public.tg_products_normalize_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE dup_id uuid;
BEGIN
  NEW.name_normalized := public.normalize_product_name(NEW.name);
  IF NEW.name_normalized = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.name_normalized IS DISTINCT FROM OLD.name_normalized THEN
    SELECT p.id INTO dup_id
      FROM public.products p
     WHERE p.name_normalized = NEW.name_normalized
       AND (TG_OP = 'INSERT' OR p.id <> NEW.id)
     LIMIT 1;
    IF dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'This product already exists in the FlashBasket catalog. Use "Add from Catalog" instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_normalize_name ON public.products;
CREATE TRIGGER products_normalize_name
  BEFORE INSERT OR UPDATE OF name ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_products_normalize_name();

CREATE INDEX IF NOT EXISTS idx_products_name_normalized ON public.products (name_normalized);
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON public.products (lower(name));
CREATE INDEX IF NOT EXISTS idx_products_brand_lower ON public.products (lower(brand));

-- 2. Shop-specific inventory fields
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS retail_price numeric,
  ADD COLUMN IF NOT EXISTS mrp numeric,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

-- 3. One inventory row per (shop, catalog product)
DELETE FROM public.shop_products sp
 USING public.shop_products keep
 WHERE sp.shop_id = keep.shop_id
   AND sp.product_id = keep.product_id
   AND (keep.created_at, keep.id) < (sp.created_at, sp.id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_products_shop_product
  ON public.shop_products (shop_id, product_id);

CREATE INDEX IF NOT EXISTS idx_shop_products_product ON public.shop_products (product_id);

-- 4. Catalog search
CREATE OR REPLACE FUNCTION public.search_master_catalog(
  _shop_id uuid DEFAULT NULL,
  _q text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _brand text DEFAULT NULL,
  _limit int DEFAULT 24,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  brand text,
  unit text,
  image text,
  mrp numeric,
  price numeric,
  category_names text[],
  already_added boolean,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.*
      FROM public.products p
     WHERE (_q IS NULL OR btrim(_q) = ''
            OR p.name_normalized LIKE '%' || public.normalize_product_name(_q) || '%'
            OR lower(coalesce(p.brand, '')) LIKE '%' || lower(btrim(_q)) || '%')
       AND (_brand IS NULL OR lower(coalesce(p.brand, '')) = lower(_brand))
       AND (_category_id IS NULL OR p.category_id = _category_id
            OR EXISTS (SELECT 1 FROM public.product_categories pc
                        WHERE pc.product_id = p.id AND pc.category_id = _category_id))
  )
  SELECT b.id,
         b.name,
         b.brand,
         b.unit,
         COALESCE(b.cover_image, b.image_url, (b.image_gallery)[1]) AS image,
         b.mrp,
         b.price,
         COALESCE((
           SELECT array_agg(c.name ORDER BY c.name)
             FROM public.product_categories pc
             JOIN public.categories c ON c.id = pc.category_id
            WHERE pc.product_id = b.id
         ), ARRAY[]::text[]) AS category_names,
         EXISTS (
           SELECT 1 FROM public.shop_products sp
            WHERE sp.product_id = b.id AND sp.shop_id = _shop_id
         ) AS already_added,
         (SELECT count(*) FROM base) AS total_count
    FROM base b
   ORDER BY b.name
   LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0)
$$;

REVOKE ALL ON FUNCTION public.search_master_catalog(uuid, text, uuid, text, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_master_catalog(uuid, text, uuid, text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.master_catalog_brands()
RETURNS TABLE (brand text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.brand
    FROM public.products p
   WHERE p.brand IS NOT NULL AND btrim(p.brand) <> ''
   ORDER BY 1
$$;

REVOKE ALL ON FUNCTION public.master_catalog_brands() FROM anon;
GRANT EXECUTE ON FUNCTION public.master_catalog_brands() TO authenticated;

-- 5. Duplicate lookup while typing a new product name
CREATE OR REPLACE FUNCTION public.find_catalog_duplicate(
  _name text,
  _shop_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  brand text,
  unit text,
  image text,
  already_added boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         p.name,
         p.brand,
         p.unit,
         COALESCE(p.cover_image, p.image_url, (p.image_gallery)[1]) AS image,
         EXISTS (
           SELECT 1 FROM public.shop_products sp
            WHERE sp.product_id = p.id AND sp.shop_id = _shop_id
         ) AS already_added
    FROM public.products p
   WHERE public.normalize_product_name(_name) <> ''
     AND p.name_normalized = public.normalize_product_name(_name)
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_catalog_duplicate(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_catalog_duplicate(text, uuid) TO authenticated;