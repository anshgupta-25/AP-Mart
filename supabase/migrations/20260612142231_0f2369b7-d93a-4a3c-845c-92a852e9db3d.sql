
CREATE OR REPLACE FUNCTION public.create_delivery_partner(
  _name text, _phone text, _vehicle text DEFAULT NULL, _user_email text DEFAULT NULL, _shop_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can create delivery partners';
  END IF;
  RETURN public.admin_create_delivery_partner(_name, _phone, _vehicle, _user_email);
END $$;

CREATE OR REPLACE FUNCTION public.delete_delivery_partner(_partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can remove delivery partners';
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
