DROP POLICY IF EXISTS prod_shopkeeper_insert ON public.products;
CREATE POLICY prod_shopkeeper_insert ON public.products
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'shopkeeper'::app_role)
  AND EXISTS (SELECT 1 FROM public.shops s WHERE s.owner_id = auth.uid())
);