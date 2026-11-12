CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY collections_public_read ON public.collections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY collections_admin_all ON public.collections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER collections_set_updated_at BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_collections (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, product_id)
);

GRANT SELECT ON public.product_collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_collections TO authenticated;
GRANT ALL ON public.product_collections TO service_role;

ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_public_read ON public.product_collections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pc_admin_all ON public.product_collections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));