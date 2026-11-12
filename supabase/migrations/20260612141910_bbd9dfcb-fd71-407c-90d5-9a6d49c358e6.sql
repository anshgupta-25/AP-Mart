
-- 1) Many-to-many shop ↔ delivery partner
CREATE TABLE IF NOT EXISTS public.shop_delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  delivery_partner_id uuid NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, delivery_partner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_delivery_assignments TO authenticated;
GRANT ALL ON public.shop_delivery_assignments TO service_role;

ALTER TABLE public.shop_delivery_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sda_admin_all ON public.shop_delivery_assignments;
CREATE POLICY sda_admin_all ON public.shop_delivery_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS sda_shopkeeper_read ON public.shop_delivery_assignments;
CREATE POLICY sda_shopkeeper_read ON public.shop_delivery_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS sda_partner_read ON public.shop_delivery_assignments;
CREATE POLICY sda_partner_read ON public.shop_delivery_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = delivery_partner_id AND dp.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS sda_shop_idx ON public.shop_delivery_assignments(shop_id);
CREATE INDEX IF NOT EXISTS sda_partner_idx ON public.shop_delivery_assignments(delivery_partner_id);

-- 2) Backfill from existing delivery_partners.shop_id
INSERT INTO public.shop_delivery_assignments (shop_id, delivery_partner_id)
SELECT dp.shop_id, dp.id
FROM public.delivery_partners dp
WHERE dp.shop_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3) Extend dp shopkeeper read to cover team via assignments
DROP POLICY IF EXISTS dp_shopkeeper_read ON public.delivery_partners;
CREATE POLICY dp_shopkeeper_read ON public.delivery_partners FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shop_delivery_assignments a
    JOIN public.shops s ON s.id = a.shop_id
    WHERE a.delivery_partner_id = delivery_partners.id AND s.owner_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = delivery_partners.shop_id AND s.owner_id = auth.uid())
);

-- 4) Admin-only create_delivery_partner (no shop required)
CREATE OR REPLACE FUNCTION public.admin_create_delivery_partner(
  _name text, _phone text, _vehicle text DEFAULT NULL, _user_email text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _target uuid; _pid uuid;
BEGIN
  IF NOT public.has_role(_uid,'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _name IS NULL OR length(trim(_name))=0 THEN RAISE EXCEPTION 'Name required'; END IF;

  IF _user_email IS NOT NULL AND length(trim(_user_email))>0 THEN
    SELECT id INTO _target FROM auth.users WHERE lower(email)=lower(trim(_user_email));
    IF _target IS NULL THEN RAISE EXCEPTION 'No user with email %', _user_email; END IF;
    IF EXISTS (SELECT 1 FROM public.delivery_partners WHERE user_id=_target) THEN
      RAISE EXCEPTION 'User is already a delivery partner';
    END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (_target,'delivery'::app_role)
      ON CONFLICT (user_id,role) DO NOTHING;
  ELSE
    _target := gen_random_uuid();
  END IF;

  INSERT INTO public.delivery_partners(user_id, name, phone, vehicle, is_online)
  VALUES (_target, _name, _phone, _vehicle, false) RETURNING id INTO _pid;
  RETURN _pid;
END $$;

REVOKE ALL ON FUNCTION public.admin_create_delivery_partner(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_delivery_partner(text,text,text,text) TO authenticated;

-- 5) Shop team management RPCs
CREATE OR REPLACE FUNCTION public.shop_list_team(_shop_id uuid)
RETURNS TABLE(
  partner_id uuid, name text, phone text, vehicle text, is_online boolean,
  rating numeric, availability_status text, active_order_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT dp.id, dp.name, dp.phone, dp.vehicle, dp.is_online, dp.rating,
         dp.availability_status, dp.active_order_count
  FROM public.shop_delivery_assignments a
  JOIN public.delivery_partners dp ON dp.id = a.delivery_partner_id
  WHERE a.shop_id = _shop_id
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.owner_id = auth.uid())
    )
  ORDER BY dp.is_online DESC, dp.name ASC;
$$;

CREATE OR REPLACE FUNCTION public.shop_available_partners(_shop_id uuid)
RETURNS TABLE(
  partner_id uuid, name text, phone text, vehicle text, is_online boolean,
  rating numeric, on_team boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT dp.id, dp.name, dp.phone, dp.vehicle, dp.is_online, dp.rating,
         EXISTS (SELECT 1 FROM public.shop_delivery_assignments a
                 WHERE a.delivery_partner_id = dp.id AND a.shop_id = _shop_id) AS on_team
  FROM public.delivery_partners dp
  WHERE (
    public.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.owner_id = auth.uid())
  )
  ORDER BY dp.name ASC;
$$;

CREATE OR REPLACE FUNCTION public.shop_set_team(_shop_id uuid, _partner_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(_uid,'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Block removal of partners that currently have active orders for this shop
  IF EXISTS (
    SELECT 1 FROM public.shop_delivery_assignments a
    JOIN public.orders o ON o.partner_id = a.delivery_partner_id
    WHERE a.shop_id = _shop_id
      AND NOT (a.delivery_partner_id = ANY(COALESCE(_partner_ids,'{}'::uuid[])))
      AND o.shop_id = _shop_id
      AND o.status IN ('packed'::order_status,'out_for_delivery'::order_status)
  ) THEN
    RAISE EXCEPTION 'Cannot remove a partner with active orders';
  END IF;

  DELETE FROM public.shop_delivery_assignments
  WHERE shop_id = _shop_id
    AND NOT (delivery_partner_id = ANY(COALESCE(_partner_ids,'{}'::uuid[])));

  INSERT INTO public.shop_delivery_assignments (shop_id, delivery_partner_id, assigned_by)
  SELECT _shop_id, pid, _uid
  FROM unnest(COALESCE(_partner_ids,'{}'::uuid[])) AS pid
  ON CONFLICT (shop_id, delivery_partner_id) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.shop_list_team(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shop_available_partners(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shop_set_team(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_list_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_available_partners(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_set_team(uuid, uuid[]) TO authenticated;

-- 6) Tighten shop_assign_partner to enforce team membership
CREATE OR REPLACE FUNCTION public.shop_assign_partner(_order_id uuid, _partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _order_number text; _partner_user uuid;
BEGIN
  SELECT shop_id, order_number INTO _shop_id, _order_number FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid)
     AND NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  IF NOT public.has_role(_uid,'admin'::app_role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.shop_delivery_assignments
      WHERE shop_id = _shop_id AND delivery_partner_id = _partner_id
    ) THEN
      RAISE EXCEPTION 'Partner is not on this shop''s delivery team';
    END IF;
  END IF;

  UPDATE public.orders SET partner_id = _partner_id, updated_at = now()
    WHERE id = _order_id AND status IN ('packed'::order_status,'accepted_by_shop'::order_status);

  SELECT user_id INTO _partner_user FROM public.delivery_partners WHERE id = _partner_id;
  IF _partner_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_partner_user, 'New delivery assignment',
            'Order ' || COALESCE(_order_number,'') || ' assigned to you. Tap to accept.',
            'delivery_assignment',
            jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id));
  END IF;
END $$;
