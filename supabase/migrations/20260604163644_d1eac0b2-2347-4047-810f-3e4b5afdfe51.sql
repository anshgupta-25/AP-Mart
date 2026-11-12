
CREATE TABLE public.shop_category_items (
  category_id uuid NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_category_items TO authenticated;
GRANT SELECT ON public.shop_category_items TO anon;
GRANT ALL ON public.shop_category_items TO service_role;

ALTER TABLE public.shop_category_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_cat_items_public_read ON public.shop_category_items
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY shop_cat_items_owner_write ON public.shop_category_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shop_categories c
    JOIN public.shops s ON s.id = c.shop_id
    WHERE c.id = shop_category_items.category_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shop_categories c
    JOIN public.shops s ON s.id = c.shop_id
    WHERE c.id = shop_category_items.category_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))
  ));
