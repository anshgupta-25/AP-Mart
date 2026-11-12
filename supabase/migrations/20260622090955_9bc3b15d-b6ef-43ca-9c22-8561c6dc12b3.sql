
-- 1) Coupons: hide operational columns from public; expose only admin/shopkeeper for management, customers validate via RPC
DROP POLICY IF EXISTS "coupon_public_read_active" ON public.coupons;

CREATE POLICY "coupons_admin_shopkeeper_read" ON public.coupons
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'shopkeeper'::app_role));

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric)
RETURNS TABLE(code text, description text, discount numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
  disc numeric := 0;
BEGIN
  SELECT * INTO c FROM public.coupons
   WHERE coupons.code = upper(trim(_code)) AND active = true
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid coupon code';
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RAISE EXCEPTION 'Coupon expired';
  END IF;
  IF c.usage_limit IS NOT NULL AND c.times_used >= c.usage_limit THEN
    RAISE EXCEPTION 'Coupon usage limit reached';
  END IF;
  IF _subtotal < c.min_order THEN
    RAISE EXCEPTION 'Minimum order of % required', c.min_order;
  END IF;
  IF c.type::text = 'flat' THEN
    disc := LEAST(c.value, _subtotal);
  ELSE
    disc := (_subtotal * c.value) / 100.0;
    IF c.max_discount IS NOT NULL THEN
      disc := LEAST(disc, c.max_discount);
    END IF;
  END IF;
  RETURN QUERY SELECT c.code, c.description, round(disc::numeric, 2);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO authenticated;

-- 2) Products: scope shopkeeper UPDATE to products linked to their own shop
DROP POLICY IF EXISTS "prod_shopkeeper_update" ON public.products;

CREATE POLICY "prod_shopkeeper_update" ON public.products
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'shopkeeper'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.shop_products sp
      JOIN public.shops s ON s.id = sp.shop_id
      WHERE sp.product_id = products.id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'shopkeeper'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.shop_products sp
      JOIN public.shops s ON s.id = sp.shop_id
      WHERE sp.product_id = products.id AND s.owner_id = auth.uid()
    )
  );

-- 3) Support attachments: add UPDATE policy scoped to owner or admin
DROP POLICY IF EXISTS "support_att_update" ON storage.objects;
CREATE POLICY "support_att_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'support-attachments' AND (owner = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (bucket_id = 'support-attachments' AND (owner = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)));
