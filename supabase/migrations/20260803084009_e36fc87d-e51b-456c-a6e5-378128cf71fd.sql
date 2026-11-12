DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT name_normalized,
           (array_agg(id ORDER BY created_at, id))[1] AS keep_id,
           (array_agg(id ORDER BY created_at, id))[2:] AS dup_ids
      FROM public.products
     GROUP BY name_normalized
    HAVING count(*) > 1
  LOOP
    -- shop inventory: move rows that don't collide, drop the rest
    DELETE FROM public.shop_products d
     WHERE d.product_id = ANY(r.dup_ids)
       AND EXISTS (SELECT 1 FROM public.shop_products k
                    WHERE k.product_id = r.keep_id AND k.shop_id = d.shop_id);
    UPDATE public.shop_products SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);

    DELETE FROM public.product_categories d
     WHERE d.product_id = ANY(r.dup_ids)
       AND EXISTS (SELECT 1 FROM public.product_categories k
                    WHERE k.product_id = r.keep_id AND k.category_id = d.category_id);
    UPDATE public.product_categories SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);

    UPDATE public.product_variants SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);
    UPDATE public.cart_items SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);
    UPDATE public.order_items SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);
    UPDATE public.reviews SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);
    UPDATE public.product_collections SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);
    UPDATE public.shop_category_items SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);
    UPDATE public.shop_collection_items SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);

    DELETE FROM public.wishlist_items d
     WHERE d.product_id = ANY(r.dup_ids)
       AND EXISTS (SELECT 1 FROM public.wishlist_items k
                    WHERE k.product_id = r.keep_id AND k.user_id = d.user_id);
    UPDATE public.wishlist_items SET product_id = r.keep_id WHERE product_id = ANY(r.dup_ids);

    DELETE FROM public.products WHERE id = ANY(r.dup_ids);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_name_normalized
  ON public.products (name_normalized);