
-- 1. Columns for live status
ALTER TABLE public.delivery_partners
  ADD COLUMN IF NOT EXISTS current_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eta_minutes integer,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS delivery_partners_current_order_idx ON public.delivery_partners(current_order_id);

-- 2. Fix partner_send_eta_update (previous version referenced non-existent columns)
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
  SELECT o.user_id, o.order_number, dp.user_id
    INTO _customer_id, _order_number, _partner_user_id
  FROM public.orders o
  JOIN public.delivery_partners dp ON dp.id = o.partner_id
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

  RETURN public.notify_user(_customer_id, _title, _body, 'delivery',
    jsonb_build_object('order_id', _order_id, 'kind', _kind, 'eta_minutes', _eta_minutes));
END $$;

-- 3. Live status update RPC
CREATE OR REPLACE FUNCTION public.partner_update_status(
  _status text,
  _order_id uuid DEFAULT NULL,
  _eta_minutes integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _cust uuid;
  _order_number text;
  _title text;
  _body text;
  _new_order_status order_status;
BEGIN
  IF _status NOT IN ('available','assigned','going_to_shop','picked_up','out_for_delivery','reached_area','delivered','offline') THEN
    RAISE EXCEPTION 'Invalid status %', _status;
  END IF;

  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;

  -- If an order is referenced, it must belong to this partner
  IF _order_id IS NOT NULL THEN
    SELECT user_id, order_number INTO _cust, _order_number
    FROM public.orders WHERE id = _order_id AND partner_id = _pid;
    IF _cust IS NULL THEN
      RAISE EXCEPTION 'Order not assigned to you';
    END IF;
  END IF;

  -- Map partner status -> order status changes
  _new_order_status := NULL;
  IF _status IN ('picked_up','out_for_delivery','reached_area') THEN
    _new_order_status := 'out_for_delivery'::order_status;
  ELSIF _status = 'delivered' THEN
    _new_order_status := 'delivered'::order_status;
  END IF;

  IF _order_id IS NOT NULL AND _new_order_status IS NOT NULL THEN
    UPDATE public.orders
       SET status = _new_order_status, updated_at = now()
     WHERE id = _order_id
       AND partner_id = _pid
       AND status <> _new_order_status
       AND status <> 'delivered'::order_status
       AND status <> 'cancelled'::order_status;
  END IF;

  -- Update delivery_partners live state
  UPDATE public.delivery_partners
     SET availability_status = _status,
         current_order_id = CASE
           WHEN _status IN ('delivered','available','offline') THEN NULL
           ELSE COALESCE(_order_id, current_order_id)
         END,
         eta_minutes = CASE
           WHEN _status IN ('delivered','available','offline') THEN NULL
           ELSE COALESCE(_eta_minutes, eta_minutes)
         END,
         is_online = CASE WHEN _status = 'offline' THEN false ELSE true END,
         status_updated_at = now(),
         updated_at = now()
   WHERE id = _pid;

  -- Notify customer
  IF _cust IS NOT NULL THEN
    _title := 'Order ' || COALESCE(_order_number, '');
    _body := CASE _status
      WHEN 'going_to_shop'    THEN 'Your delivery partner is heading to the shop to pick up your order.'
      WHEN 'picked_up'        THEN 'Your order has been picked up and will be on its way shortly.'
      WHEN 'out_for_delivery' THEN 'Your order is out for delivery'
                                 || CASE WHEN _eta_minutes IS NOT NULL THEN ' (ETA ' || _eta_minutes || ' min).' ELSE '.' END
      WHEN 'reached_area'     THEN 'Your delivery partner has reached your area.'
      WHEN 'delivered'        THEN 'Your order has been delivered. Enjoy!'
      ELSE NULL
    END;
    IF _body IS NOT NULL THEN
      PERFORM public.notify_user(_cust, _title, _body, 'delivery',
        jsonb_build_object('order_id', _order_id, 'status', _status, 'eta_minutes', _eta_minutes));
    END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.partner_update_status(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_update_status(text, uuid, integer) TO authenticated;
