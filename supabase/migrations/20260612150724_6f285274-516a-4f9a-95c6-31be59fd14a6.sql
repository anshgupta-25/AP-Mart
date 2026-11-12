
CREATE OR REPLACE FUNCTION public.partner_send_eta_update(
  _order_id uuid,
  _kind text,
  _eta_minutes integer DEFAULT NULL,
  _custom_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _partner_user_id uuid;
  _customer_id uuid;
  _order_number text;
  _title text;
  _body text;
BEGIN
  -- Auth: only the assigned delivery partner for this order
  SELECT o.customer_id, o.order_number, dp.user_id
    INTO _customer_id, _order_number, _partner_user_id
  FROM public.orders o
  JOIN public.delivery_partners dp ON dp.id = o.delivery_partner_id
  WHERE o.id = _order_id;

  IF _customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found or no partner assigned';
  END IF;

  IF _partner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized: you are not assigned to this order';
  END IF;

  _title := 'Order ' || COALESCE(_order_number, '');

  IF _kind = 'eta' THEN
    IF _eta_minutes IS NULL OR _eta_minutes < 0 OR _eta_minutes > 240 THEN
      RAISE EXCEPTION 'Invalid ETA';
    END IF;
    _body := 'Your order will arrive in approximately ' || _eta_minutes || ' minute'
             || CASE WHEN _eta_minutes = 1 THEN '' ELSE 's' END || '.';
  ELSIF _kind = 'nearby' THEN
    _body := 'Your delivery partner has reached your area.';
  ELSIF _kind = 'delay' THEN
    IF _eta_minutes IS NULL OR _eta_minutes < 1 OR _eta_minutes > 240 THEN
      RAISE EXCEPTION 'Invalid delay minutes';
    END IF;
    _body := 'Traffic delay. Your order may take an additional ' || _eta_minutes || ' minutes.';
  ELSIF _kind = 'custom' THEN
    IF _custom_message IS NULL OR length(trim(_custom_message)) = 0 THEN
      RAISE EXCEPTION 'Message required';
    END IF;
    _body := left(trim(_custom_message), 240);
  ELSE
    RAISE EXCEPTION 'Unknown update kind';
  END IF;

  RETURN public.notify_user(
    _customer_id,
    _title,
    _body,
    'delivery',
    jsonb_build_object('order_id', _order_id, 'kind', _kind, 'eta_minutes', _eta_minutes)
  );
END $$;

REVOKE ALL ON FUNCTION public.partner_send_eta_update(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_send_eta_update(uuid, text, integer, text) TO authenticated;
