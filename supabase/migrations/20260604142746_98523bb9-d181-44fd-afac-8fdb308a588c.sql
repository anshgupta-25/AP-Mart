
CREATE TYPE public.offer_scope AS ENUM ('global', 'shop');

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  link_url text,
  badge text,
  scope public.offer_scope NOT NULL DEFAULT 'global',
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_scope_shop_chk CHECK (
    (scope = 'global' AND shop_id IS NULL) OR (scope = 'shop' AND shop_id IS NOT NULL)
  )
);

CREATE INDEX offers_active_idx ON public.offers (is_active, display_order);
CREATE INDEX offers_shop_idx ON public.offers (shop_id);

GRANT SELECT ON public.offers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Public can read active offers within date window
CREATE POLICY offers_public_read ON public.offers
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

-- Admins: full access
CREATE POLICY offers_admin_all ON public.offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Shopkeepers: manage offers for their own shops only
CREATE POLICY offers_shop_owner_all ON public.offers
  FOR ALL TO authenticated
  USING (
    scope = 'shop' AND EXISTS (
      SELECT 1 FROM public.shops s WHERE s.id = offers.shop_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    scope = 'shop' AND EXISTS (
      SELECT 1 FROM public.shops s WHERE s.id = offers.shop_id AND s.owner_id = auth.uid()
    )
  );

CREATE TRIGGER offers_set_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed initial global offers using the existing banner URLs
INSERT INTO public.offers (title, subtitle, image_url, link_url, scope, display_order) VALUES
  ('50% off fresh fruits', 'Limited time deal', 'https://cdn.lovable.dev/projects/10138c73-9a20-4df9-9ef9-cb7c5e7e2934/assets/banner1.jpg', '/category/fruits-vegetables', 'global', 1),
  ('Free delivery', 'On orders above ₹199', 'https://cdn.lovable.dev/projects/10138c73-9a20-4df9-9ef9-cb7c5e7e2934/assets/banner2.jpg', '/', 'global', 2),
  ('Buy 1 Get 1 on dairy', 'Today only', 'https://cdn.lovable.dev/projects/10138c73-9a20-4df9-9ef9-cb7c5e7e2934/assets/banner3.jpg', '/category/dairy', 'global', 3),
  ('Weekend sale up to 70% off', 'All categories', 'https://cdn.lovable.dev/projects/10138c73-9a20-4df9-9ef9-cb7c5e7e2934/assets/banner4.jpg', '/', 'global', 4);
