
-- Add cancelled_at timestamp
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Update cancel_order to allow more statuses, restore shop_products stock, and notify shop + admins
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _st order_status;
  _shop uuid;
  _owner uuid;
  _num text;
  _pay_status payment_status;
  _pay_method payment_method;
  r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT status, shop_id, order_number, payment_status, payment_method
    INTO _st, _shop, _num, _pay_status, _pay_method
    FROM public.orders WHERE id = _order_id AND user_id = _uid;

  IF _st IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF _st NOT IN ('placed'::order_status, 'payment_confirmed'::order_status,
                 'awaiting_shop'::order_status, 'accepted_by_shop'::order_status) THEN
    RAISE EXCEPTION 'This order can no longer be cancelled';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  -- Restore shop_products stock (place_order decremented from shop_products)
  IF _shop IS NOT NULL THEN
    UPDATE public.shop_products sp
      SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
      AND sp.product_id = oi.product_id
      AND sp.shop_id = _shop;
  END IF;

  -- Mark cancelled
  UPDATE public.orders
    SET status = 'cancelled'::order_status,
        cancel_reason = _reason,
        cancelled_at = now(),
        assignment_expires_at = NULL,
        updated_at = now()
    WHERE id = _order_id;

  -- If paid online, flag payment for refund processing
  IF _pay_status = 'paid'::payment_status AND _pay_method <> 'cod'::payment_method THEN
    UPDATE public.payments
      SET status = 'refund_pending', updated_at = now()
      WHERE order_id = _order_id;
    UPDATE public.orders
      SET payment_status = 'refund_pending'::payment_status, updated_at = now()
      WHERE id = _order_id;
  END IF;

  -- Notify customer
  INSERT INTO public.notifications (user_id, title, body, category, data)
  VALUES (_uid, 'Order cancelled',
          'Your order ' || COALESCE(_num,'') || ' has been cancelled. Reason: ' || _reason,
          'order',
          jsonb_build_object('order_id', _order_id, 'url', '/customer/orders/' || _order_id));

  -- Notify shop owner
  IF _shop IS NOT NULL THEN
    SELECT owner_id INTO _owner FROM public.shops WHERE id = _shop;
    IF _owner IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, category, data)
      VALUES (_owner, 'Order cancelled by customer',
              'Order ' || COALESCE(_num,'') || ' was cancelled. Reason: ' || _reason,
              'order',
              jsonb_build_object('order_id', _order_id, 'url', '/shopkeeper/orders/' || _order_id));
    END IF;
  END IF;

  -- Notify admins
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    INSERT INTO public.notifications (user_id, title, body, category, data)
    VALUES (r.user_id, 'Order cancelled',
            'Customer cancelled order ' || COALESCE(_num,'') || '. Reason: ' || _reason,
            'order',
            jsonb_build_object('order_id', _order_id, 'url', '/admin/orders/' || _order_id));
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;
