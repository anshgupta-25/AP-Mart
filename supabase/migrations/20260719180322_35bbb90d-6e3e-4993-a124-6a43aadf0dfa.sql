
-- 1) Add manufacturing_date column
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS manufacturing_date date;

-- 2) Update list_customer_products to exclude expired stock
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
  )
  SELECT p.id, p.slug, p.name, p.unit,
         COALESCE(e.min_price, p.price) AS price,
         p.mrp, p.image_url, p.delivery_minutes,
         COALESCE(e.total_stock, p.stock) AS stock,
         p.rating, p.category_id
  FROM public.products p
  JOIN eligible e ON e.product_id = p.id
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

REVOKE ALL ON FUNCTION public.list_customer_products(text, uuid, text, boolean, boolean, text, integer, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_products(text, uuid, text, boolean, boolean, text, integer, uuid[]) TO anon, authenticated;

-- 3) Daily expiry notifier for shopkeepers
CREATE OR REPLACE FUNCTION public.notify_expiring_products()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  _days int;
  _title text;
  _body text;
BEGIN
  FOR r IN
    SELECT sp.expiry_date, sp.stock, s.owner_id, p.name
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    JOIN public.products p ON p.id = sp.product_id
    WHERE s.owner_id IS NOT NULL
      AND sp.expiry_date IS NOT NULL
      AND sp.is_available = true
      AND sp.stock > 0
      AND (sp.expiry_date - CURRENT_DATE) IN (30, 7, 1, 0, -1)
  LOOP
    _days := (r.expiry_date - CURRENT_DATE);
    IF _days < 0 THEN
      _title := '🔴 Product expired';
      _body  := r.name || ' has expired. Please remove it from your inventory.';
    ELSIF _days = 0 THEN
      _title := '🔴 Expires today';
      _body  := r.name || ' expires today.';
    ELSIF _days = 1 THEN
      _title := '⚠️ Expires tomorrow';
      _body  := r.name || ' expires tomorrow.';
    ELSIF _days = 7 THEN
      _title := '🟠 Expires in 7 days';
      _body  := r.name || ' expires in 7 days.';
    ELSE
      _title := '🟡 Expires in 30 days';
      _body  := r.name || ' expires in 30 days.';
    END IF;
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (r.owner_id, _title, _body);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_expiring_products() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_expiring_products() TO service_role;

-- 4) Schedule daily at 08:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  PERFORM cron.unschedule('notify-expiring-products-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'notify-expiring-products-daily',
  '0 8 * * *',
  $$SELECT public.notify_expiring_products();$$
);
