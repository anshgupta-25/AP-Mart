
-- 1. RLS: shopkeepers can read partners assigned to a shop they own
CREATE POLICY "dp_shopkeeper_read" ON public.delivery_partners
  FOR SELECT TO authenticated
  USING (
    shop_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = delivery_partners.shop_id AND s.owner_id = auth.uid())
  );

-- 2. admin_assign_role: auto-create delivery_partners row when granting delivery role
CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _role = 'delivery' THEN
    IF NOT EXISTS (SELECT 1 FROM public.delivery_partners WHERE user_id = _user_id) THEN
      SELECT COALESCE(NULLIF(full_name,''), 'Delivery Partner') INTO _name FROM public.profiles WHERE id = _user_id;
      INSERT INTO public.delivery_partners (user_id, name, phone)
      SELECT _user_id, COALESCE(_name, 'Delivery Partner'), phone FROM public.profiles WHERE id = _user_id;
    END IF;
  END IF;
END $function$;

-- 3. Reassign existing unassigned partner to the only owned shop, so demo data is visible
UPDATE public.delivery_partners dp
SET shop_id = (SELECT id FROM public.shops WHERE owner_id IS NOT NULL ORDER BY created_at LIMIT 1)
WHERE dp.shop_id IS NULL
   OR dp.shop_id NOT IN (SELECT id FROM public.shops WHERE owner_id IS NOT NULL);
