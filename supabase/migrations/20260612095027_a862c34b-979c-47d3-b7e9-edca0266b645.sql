-- 1) Schema changes
ALTER TABLE public.delivery_partners
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS active_order_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS delivery_partners_shop_id_idx ON public.delivery_partners(shop_id);

-- Best-effort backfill: link each unlinked partner to the first shop (admin can transfer later)
UPDATE public.delivery_partners dp
SET shop_id = (SELECT id FROM public.shops ORDER BY created_at LIMIT 1)
WHERE shop_id IS NULL;

-- 2) Maintain active_order_count via trigger
CREATE OR REPLACE FUNCTION public.trg_orders_partner_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _active_states order_status[] := ARRAY['packed'::order_status,'out_for_delivery'::order_status];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.partner_id IS NOT NULL AND NEW.status = ANY(_active_states) THEN
      UPDATE public.delivery_partners SET active_order_count = active_order_count + 1 WHERE id = NEW.partner_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- old contribution
    IF OLD.partner_id IS NOT NULL AND OLD.status = ANY(_active_states) THEN
      UPDATE public.delivery_partners SET active_order_count = GREATEST(active_order_count - 1, 0) WHERE id = OLD.partner_id;
    END IF;
    -- new contribution
    IF NEW.partner_id IS NOT NULL AND NEW.status = ANY(_active_states) THEN
      UPDATE public.delivery_partners SET active_order_count = active_order_count + 1 WHERE id = NEW.partner_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.partner_id IS NOT NULL AND OLD.status = ANY(_active_states) THEN
      UPDATE public.delivery_partners SET active_order_count = GREATEST(active_order_count - 1, 0) WHERE id = OLD.partner_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS orders_partner_count ON public.orders;
CREATE TRIGGER orders_partner_count
AFTER INSERT OR UPDATE OF partner_id, status OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_partner_count();

-- Recompute counts once after backfill
UPDATE public.delivery_partners dp SET active_order_count = COALESCE(c.cnt, 0)
FROM (
  SELECT partner_id, COUNT(*) AS cnt
  FROM public.orders
  WHERE partner_id IS NOT NULL AND status IN ('packed'::order_status,'out_for_delivery'::order_status)
  GROUP BY partner_id
) c
WHERE dp.id = c.partner_id;

-- 3) create_delivery_partner now accepts _shop_id (required for shopkeepers)
DROP FUNCTION IF EXISTS public.create_delivery_partner(text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_delivery_partner(
  _name text, _phone text, _vehicle text DEFAULT NULL, _user_email text DEFAULT NULL, _shop_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _target_user uuid; _pid uuid; _shop uuid := _shop_id;
BEGIN
  IF NOT (public.has_role(_uid,'admin'::app_role) OR EXISTS (SELECT 1 FROM public.shops WHERE owner_id=_uid)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _name IS NULL OR length(trim(_name))=0 THEN RAISE EXCEPTION 'Name required'; END IF;

  -- Shopkeepers can only create partners for their own shop
  IF NOT public.has_role(_uid,'admin'::app_role) THEN
    SELECT id INTO _shop FROM public.shops WHERE owner_id = _uid ORDER BY created_at LIMIT 1;
    IF _shop IS NULL THEN RAISE EXCEPTION 'You must own a shop to add a delivery partner'; END IF;
  ELSE
    IF _shop IS NULL THEN RAISE EXCEPTION 'Shop is required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop) THEN RAISE EXCEPTION 'Shop not found'; END IF;
  END IF;

  IF _user_email IS NOT NULL AND length(trim(_user_email))>0 THEN
    SELECT id INTO _target_user FROM auth.users WHERE lower(email)=lower(trim(_user_email));
    IF _target_user IS NULL THEN RAISE EXCEPTION 'No user with email %', _user_email; END IF;
    IF EXISTS (SELECT 1 FROM public.delivery_partners WHERE user_id=_target_user) THEN
      RAISE EXCEPTION 'User is already a delivery partner';
    END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (_target_user,'delivery'::app_role)
      ON CONFLICT (user_id,role) DO NOTHING;
  ELSE
    _target_user := gen_random_uuid();
  END IF;

  INSERT INTO public.delivery_partners(user_id, name, phone, vehicle, is_online, shop_id)
  VALUES (_target_user, _name, _phone, _vehicle, false, _shop) RETURNING id INTO _pid;
  RETURN _pid;
END $$;

-- 4) Admin: transfer partner between shops
CREATE OR REPLACE FUNCTION public.admin_transfer_partner(_partner_id uuid, _shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id) THEN RAISE EXCEPTION 'Shop not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE partner_id = _partner_id AND status IN ('packed'::order_status,'out_for_delivery'::order_status)) THEN
    RAISE EXCEPTION 'Partner has active orders, cannot transfer';
  END IF;
  UPDATE public.delivery_partners SET shop_id = _shop_id, updated_at = now() WHERE id = _partner_id;
END $$;

-- 5) shop_assign_partner — enforce same-shop and only notify the selected partner
CREATE OR REPLACE FUNCTION public.shop_assign_partner(_order_id uuid, _partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _order_number text; _partner_user uuid; _partner_shop uuid;
BEGIN
  SELECT shop_id, order_number INTO _shop_id, _order_number FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid)
     AND NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  SELECT shop_id INTO _partner_shop FROM public.delivery_partners WHERE id = _partner_id;
  IF _partner_shop IS DISTINCT FROM _shop_id AND NOT public.has_role(_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'Partner does not belong to this shop';
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

-- 6) shop_mark_packed — DO NOT auto-assign. Just mark packed; pickup orders notify customer; non-pickup notifies shopkeeper to assign.
CREATE OR REPLACE FUNCTION public.shop_mark_packed(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _shop_id uuid;
  _shop_owner uuid;
  _cust uuid;
  _order_number text;
  _dt text;
BEGIN
  SELECT o.shop_id, o.user_id, o.order_number, o.delivery_type, s.owner_id
    INTO _shop_id, _cust, _order_number, _dt, _shop_owner
  FROM public.orders o JOIN public.shops s ON s.id = o.shop_id
  WHERE o.id = _order_id;

  IF _shop_owner IS DISTINCT FROM _uid AND NOT public.has_role(_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  UPDATE public.orders
  SET status = 'packed'::order_status, updated_at = now()
  WHERE id = _order_id AND status = 'accepted_by_shop'::order_status;

  IF _dt = 'pickup' THEN
    UPDATE public.orders SET ready_for_pickup_at = now() WHERE id = _order_id;
    IF _cust IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, category, data)
      VALUES (_cust, 'Ready for pickup',
              'Order ' || COALESCE(_order_number,'') || ' is ready to collect at the shop.',
              'order', jsonb_build_object('order_id', _order_id, 'url', '/orders/' || _order_id));
    END IF;
    RETURN;
  END IF;

  -- Non-pickup: notify the shopkeeper to assign a partner manually
  IF _shop_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_shop_owner, 'Assign a delivery partner',
            'Order ' || COALESCE(_order_number,'') || ' is packed. Pick a delivery partner for this order.',
            'order',
            jsonb_build_object('order_id', _order_id, 'url', '/shopkeeper/delivery'));
  END IF;
END $$;

-- 7) partner_available_orders — only orders assigned to me
DROP FUNCTION IF EXISTS public.partner_available_orders();
CREATE OR REPLACE FUNCTION public.partner_available_orders()
RETURNS TABLE(id uuid, order_number text, total numeric, city text, area_pincode text, placed_at timestamp with time zone, item_count bigint, shop_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _pid uuid := public.current_user_partner_id();
BEGIN
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  RETURN QUERY
  SELECT o.id, o.order_number, o.total,
         (o.address->>'city')::text,
         (o.address->>'pincode')::text,
         o.placed_at,
         (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id),
         s.name
  FROM public.orders o
  LEFT JOIN public.shops s ON s.id = o.shop_id
  WHERE o.partner_id = _pid
    AND o.status = 'packed'::order_status
  ORDER BY o.placed_at ASC;
END $$;

-- 8) Grants (no schema changes to existing public tables here)
GRANT EXECUTE ON FUNCTION public.admin_transfer_partner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_delivery_partner(text, text, text, text, uuid) TO authenticated;