
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _st order_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT status INTO _st FROM public.orders WHERE id = _order_id AND user_id = _uid;
  IF _st IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _st NOT IN ('placed','payment_confirmed') THEN
    RAISE EXCEPTION 'Order can no longer be cancelled';
  END IF;
  PERFORM public.restore_order_stock(_order_id);
  UPDATE public.orders SET status = 'cancelled', cancel_reason = _reason, updated_at = now()
    WHERE id = _order_id;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_uid, 'Order cancelled', 'Your order has been cancelled and stock restored.');
END; $$;
REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;
