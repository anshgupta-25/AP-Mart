
-- 1. Order audit log
CREATE TABLE public.order_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  actor_id uuid,
  actor_role text,
  event_type text NOT NULL,
  from_value text,
  to_value text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oal_order ON public.order_audit_log(order_id, created_at DESC);
GRANT SELECT, INSERT ON public.order_audit_log TO authenticated;
GRANT ALL ON public.order_audit_log TO service_role;
ALTER TABLE public.order_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY oal_read ON public.order_audit_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_audit_log.order_id
      AND (o.user_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
           OR EXISTS (SELECT 1 FROM public.delivery_partners dp WHERE dp.id = o.partner_id AND dp.user_id = auth.uid())
      )
  )
);

CREATE OR REPLACE FUNCTION public.actor_role_label()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'admin'::app_role) THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.shops WHERE owner_id=auth.uid()) THEN 'shopkeeper'
    WHEN EXISTS (SELECT 1 FROM public.delivery_partners WHERE user_id=auth.uid()) THEN 'delivery'
    WHEN auth.uid() IS NOT NULL THEN 'customer'
    ELSE 'system'
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_orders_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, to_value, meta)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(), 'created', NEW.status::text,
      jsonb_build_object('shop_id', NEW.shop_id, 'total', NEW.total));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(), 'status_change', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, from_value, to_value, meta)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(),
      CASE WHEN OLD.partner_id IS NULL THEN 'partner_assigned'
           WHEN NEW.partner_id IS NULL THEN 'partner_unassigned'
           ELSE 'partner_reassigned' END,
      COALESCE(OLD.partner_id::text,''), COALESCE(NEW.partner_id::text,''),
      '{}'::jsonb);
  END IF;
  IF NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(), 'shop_change',
      COALESCE(OLD.shop_id::text,''), COALESCE(NEW.shop_id::text,''));
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(), 'payment_status', OLD.payment_status::text, NEW.payment_status::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_audit_ins ON public.orders;
DROP TRIGGER IF EXISTS orders_audit_upd ON public.orders;
CREATE TRIGGER orders_audit_ins AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_audit();
CREATE TRIGGER orders_audit_upd AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_audit();

-- 2. Delivery boy management RPCs
CREATE OR REPLACE FUNCTION public.create_delivery_partner(_name text, _phone text, _vehicle text DEFAULT NULL, _user_email text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _target_user uuid; _pid uuid;
BEGIN
  IF NOT (public.has_role(_uid,'admin'::app_role) OR EXISTS (SELECT 1 FROM public.shops WHERE owner_id=_uid)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _name IS NULL OR length(trim(_name))=0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF _user_email IS NOT NULL AND length(trim(_user_email))>0 THEN
    SELECT id INTO _target_user FROM auth.users WHERE lower(email)=lower(trim(_user_email));
    IF _target_user IS NULL THEN RAISE EXCEPTION 'No user with email %', _user_email; END IF;
    IF EXISTS (SELECT 1 FROM public.delivery_partners WHERE user_id=_target_user) THEN
      RAISE EXCEPTION 'User is already a delivery partner';
    END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (_target_user,'delivery'::app_role)
      ON CONFLICT (user_id,role) DO NOTHING;
  ELSE
    _target_user := gen_random_uuid(); -- placeholder; partner not linked to auth yet
  END IF;
  INSERT INTO public.delivery_partners(user_id, name, phone, vehicle, is_online)
  VALUES (_target_user, _name, _phone, _vehicle, false) RETURNING id INTO _pid;
  RETURN _pid;
END $$;

CREATE OR REPLACE FUNCTION public.delete_delivery_partner(_partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _user uuid;
BEGIN
  IF NOT (public.has_role(_uid,'admin'::app_role) OR EXISTS (SELECT 1 FROM public.shops WHERE owner_id=_uid)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE partner_id=_partner_id AND status IN ('packed'::order_status,'out_for_delivery'::order_status)) THEN
    RAISE EXCEPTION 'Partner has active orders';
  END IF;
  SELECT user_id INTO _user FROM public.delivery_partners WHERE id=_partner_id;
  DELETE FROM public.delivery_partners WHERE id=_partner_id;
  IF _user IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id=_user AND role='delivery'::app_role;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.create_delivery_partner(text,text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.delete_delivery_partner(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_delivery_partner(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_delivery_partner(uuid) TO authenticated;

-- 3. Per-shop collections
CREATE TABLE public.shop_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shop_collection_items (
  collection_id uuid NOT NULL REFERENCES public.shop_collections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_collections TO authenticated;
GRANT SELECT ON public.shop_collections TO anon;
GRANT SELECT, INSERT, DELETE ON public.shop_collection_items TO authenticated;
GRANT SELECT ON public.shop_collection_items TO anon;
GRANT ALL ON public.shop_collections TO service_role;
GRANT ALL ON public.shop_collection_items TO service_role;
ALTER TABLE public.shop_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY sc_public_read ON public.shop_collections FOR SELECT TO anon, authenticated USING (is_active=true);
CREATE POLICY sc_owner_all ON public.shop_collections FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id=shop_collections.shop_id AND (s.owner_id=auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id=shop_collections.shop_id AND (s.owner_id=auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));

CREATE POLICY sci_public_read ON public.shop_collection_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sci_owner_write ON public.shop_collection_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.shop_collections c JOIN public.shops s ON s.id=c.shop_id WHERE c.id=shop_collection_items.collection_id AND (s.owner_id=auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.shop_collections c JOIN public.shops s ON s.id=c.shop_id WHERE c.id=shop_collection_items.collection_id AND (s.owner_id=auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));

CREATE TRIGGER sc_set_updated BEFORE UPDATE ON public.shop_collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
