
-- Restrict delivery_partners dp_scoped_read to authenticated role only
DROP POLICY IF EXISTS dp_scoped_read ON public.delivery_partners;
CREATE POLICY dp_scoped_read ON public.delivery_partners
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Restrict shop_products sp_public_read to anon+authenticated explicitly (still public catalog)
DROP POLICY IF EXISTS sp_public_read ON public.shop_products;
CREATE POLICY sp_public_read ON public.shop_products
  FOR SELECT
  TO anon, authenticated
  USING (true);
