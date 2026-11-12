
CREATE OR REPLACE FUNCTION public.place_order(
  _address jsonb,
  _payment_method payment_method,
  _coupon_code text DEFAULT NULL,
  _delivery_instruction text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _subtotal numeric := 0;
  _discount numeric := 0;
  _delivery_fee numeric := 0;
  _handling numeric := 5;
  _tax numeric := 0;
  _total numeric := 0;
  _coupon record;
  r record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock cart rows + product rows
  PERFORM 1
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.user_id = _uid
  FOR UPDATE OF p;

  -- Validate stock & compute subtotal
  FOR r IN
    SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name, p.image_url, p.unit
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.user_id = _uid
  LOOP
    IF r.quantity > r.stock THEN
      RAISE EXCEPTION 'Insufficient stock for %', r.name;
    END IF;
    _subtotal := _subtotal + r.price * r.quantity;
  END LOOP;

  IF _subtotal = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Coupon
  IF _coupon_code IS NOT NULL AND length(_coupon_code) > 0 THEN
    SELECT * INTO _coupon FROM public.coupons
      WHERE code = upper(_coupon_code) AND active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (usage_limit IS NULL OR times_used < usage_limit)
      LIMIT 1;
    IF _coupon.id IS NOT NULL AND _subtotal >= _coupon.min_order THEN
      IF _coupon.type = 'flat' THEN
        _discount := LEAST(_coupon.value, _subtotal);
      ELSE
        _discount := (_subtotal * _coupon.value / 100.0);
        IF _coupon.max_discount IS NOT NULL THEN
          _discount := LEAST(_discount, _coupon.max_discount);
        END IF;
      END IF;
      UPDATE public.coupons SET times_used = times_used + 1 WHERE id = _coupon.id;
    END IF;
  END IF;

  _delivery_fee := CASE WHEN _subtotal - _discount >= 199 THEN 0 ELSE 25 END;
  _total := _subtotal - _discount + _delivery_fee + _handling + _tax;

  INSERT INTO public.orders (
    user_id, address, payment_method, payment_status, status,
    subtotal, discount, delivery_fee, handling_fee, tax, total,
    coupon_code, delivery_instruction
  ) VALUES (
    _uid, _address, _payment_method,
    CASE WHEN _payment_method = 'cod' THEN 'pending'::payment_status ELSE 'pending'::payment_status END,
    'placed'::order_status,
    _subtotal, _discount, _delivery_fee, _handling, _tax, _total,
    _coupon_code, _delivery_instruction
  ) RETURNING id INTO _order_id;

  -- Insert items + decrement stock
  INSERT INTO public.order_items (order_id, product_id, name, image_url, unit, price, quantity)
  SELECT _order_id, ci.product_id, p.name, p.image_url, p.unit, p.price, ci.quantity
  FROM public.cart_items ci JOIN public.products p ON p.id = ci.product_id
  WHERE ci.user_id = _uid;

  UPDATE public.products p
  SET stock = stock - ci.quantity
  FROM public.cart_items ci
  WHERE ci.user_id = _uid AND ci.product_id = p.id;

  DELETE FROM public.cart_items WHERE user_id = _uid;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_uid, 'Order placed!', 'Your FlashBasket order is being prepared.');

  RETURN _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, payment_method, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, payment_method, text, text) TO authenticated;

-- Admin: function to update order status
CREATE OR REPLACE FUNCTION public.admin_update_order_status(_order_id uuid, _status order_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.orders SET status = _status, updated_at = now() WHERE id = _order_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, order_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, order_status) TO authenticated;

-- Cancel: user can cancel their own placed/confirmed order, restores stock
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _st order_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT status INTO _st FROM public.orders WHERE id = _order_id AND user_id = _uid;
  IF _st IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _st NOT IN ('placed','confirmed') THEN
    RAISE EXCEPTION 'Order can no longer be cancelled';
  END IF;
  PERFORM public.restore_order_stock(_order_id);
  UPDATE public.orders SET status = 'cancelled', cancel_reason = _reason, updated_at = now()
    WHERE id = _order_id;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_uid, 'Order cancelled', 'Your order has been cancelled and stock restored.');
END; $$;
REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;
