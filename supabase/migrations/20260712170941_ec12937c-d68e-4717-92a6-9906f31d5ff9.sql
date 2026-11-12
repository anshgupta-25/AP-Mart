
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _o record;
  _shop_owner uuid;
  _new_pay payment_status;
  _admin record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND user_id = _uid;
  IF _o IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF _o.status NOT IN ('placed'::order_status,'payment_confirmed'::order_status,
                       'awaiting_shop'::order_status,'accepted_by_shop'::order_status) THEN
    RAISE EXCEPTION 'Order can no longer be cancelled';
  END IF;

  -- Restore stock in shop_products for the assigned shop
  IF _o.shop_id IS NOT NULL THEN
    UPDATE public.shop_products sp
      SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
      AND sp.product_id = oi.product_id
      AND sp.shop_id = _o.shop_id;
  END IF;

  -- Also keep the legacy products.stock in sync where present
  PERFORM public.restore_order_stock(_order_id);

  -- Compute refund state for paid non-COD orders
  _new_pay := _o.payment_status;
  IF _o.payment_method <> 'cod'::payment_method AND _o.payment_status = 'paid'::payment_status THEN
    _new_pay := 'refund_initiated'::payment_status;
  END IF;

  UPDATE public.orders
    SET status = 'cancelled'::order_status,
        cancel_reason = _reason,
        cancelled_at = now(),
        payment_status = _new_pay,
        assignment_expires_at = NULL,
        updated_at = now()
    WHERE id = _order_id;

  -- Notify customer
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_uid, 'Order cancelled',
    'Your order ' || COALESCE(_o.order_number,'') || ' has been cancelled.'
      || CASE WHEN _new_pay = 'refund_initiated'::payment_status THEN ' Refund is being processed.' ELSE '' END,
    'order',
    jsonb_build_object('order_id', _order_id, 'url', '/customer/orders/' || _order_id));

  -- Notify assigned shop owner
  IF _o.shop_id IS NOT NULL THEN
    SELECT owner_id INTO _shop_owner FROM public.shops WHERE id = _o.shop_id;
    IF _shop_owner IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, category, data)
      VALUES (_shop_owner, 'Order cancelled by customer',
        'Order ' || COALESCE(_o.order_number,'') || ' was cancelled. Reason: ' || COALESCE(_reason,'—'),
        'order',
        jsonb_build_object('order_id', _order_id, 'url', '/shopkeeper/orders/' || _order_id));
    END IF;
  END IF;

  -- Notify admins
  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_admin.user_id, 'Customer cancelled order',
      'Order ' || COALESCE(_o.order_number,'') || ' cancelled. Reason: ' || COALESCE(_reason,'—'),
      'order',
      jsonb_build_object('order_id', _order_id, 'url', '/admin/orders/' || _order_id));
  END LOOP;
END; $function$;
