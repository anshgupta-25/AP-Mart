-- shop_categories: writes restricted to admins (super_admin inherits admin via has_role)
DROP POLICY IF EXISTS shop_categories_owner_all ON public.shop_categories;
CREATE POLICY shop_categories_admin_all ON public.shop_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS shop_cat_items_owner_write ON public.shop_category_items;
CREATE POLICY shop_cat_items_admin_write ON public.shop_category_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- global categories table: ensure only admins can write (already admin-only), no change needed.
-- product_categories: shopkeepers may keep linking their own products to existing categories.
