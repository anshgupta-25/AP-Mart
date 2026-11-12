
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.shop_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  image_url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, slug)
);

GRANT SELECT ON public.shop_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_categories TO authenticated;
GRANT ALL ON public.shop_categories TO service_role;

ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_categories_public_read ON public.shop_categories
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY shop_categories_owner_all ON public.shop_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_categories.shop_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_categories.shop_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))));

CREATE TRIGGER trg_shop_categories_updated
  BEFORE UPDATE ON public.shop_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
