
CREATE TABLE public.delivery_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  delivery_partner_id uuid NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  kind text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX delivery_messages_order_created_idx ON public.delivery_messages(order_id, created_at DESC);
CREATE INDEX delivery_messages_customer_idx ON public.delivery_messages(customer_id, created_at DESC);

GRANT SELECT ON public.delivery_messages TO authenticated;
GRANT ALL ON public.delivery_messages TO service_role;

ALTER TABLE public.delivery_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY dm_customer_read ON public.delivery_messages
  FOR SELECT TO authenticated USING (customer_id = auth.uid());

CREATE POLICY dm_partner_read ON public.delivery_messages
  FOR SELECT TO authenticated USING (
    delivery_partner_id = public.current_user_partner_id()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_messages;

CREATE OR REPLACE FUNCTION public.partner_send_message(
  _order_id uuid, _kind text, _custom_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _partner_id uuid;
  _partner_user_id uuid;
  _customer_id uuid;
  _order_number text;
  _title text;
  _body text;
  _msg_id uuid;
BEGIN
  SELECT o.user_id, o.order_number, o.partner_id, dp.user_id
    INTO _customer_id, _order_number, _partner_id, _partner_user_id
  FROM public.orders o
  LEFT JOIN public.delivery_partners dp ON dp.id = o.partner_id
  WHERE o.id = _order_id;

  IF _customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF _partner_user_id IS NULL OR _partner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized: you are not assigned to this order';
  END IF;

  _body := CASE _kind
    WHEN 'eta_2'        THEN 'Your delivery partner will arrive in about 2 minutes.'
    WHEN 'eta_5'        THEN 'Your delivery partner will arrive in about 5 minutes.'
    WHEN 'eta_10'       THEN 'Your delivery partner will arrive in about 10 minutes.'
    WHEN 'delay'        THEN 'Traffic delay — please allow some extra time for your order.'
    WHEN 'no_contact'   THEN 'Your delivery partner is unable to reach you. Please check your phone.'
    WHEN 'answer_phone' THEN 'Please answer your phone — your delivery partner is calling.'
    WHEN 'reached'      THEN 'Your delivery partner has reached your location.'
    WHEN 'delivered'    THEN 'Your order has been delivered. Enjoy!'
    WHEN 'custom'       THEN NULL
    ELSE NULL
  END;

  IF _kind = 'custom' THEN
    IF _custom_message IS NULL OR length(trim(_custom_message)) = 0 THEN
      RAISE EXCEPTION 'Message required';
    END IF;
    _body := left(trim(_custom_message), 280);
  ELSIF _body IS NULL THEN
    RAISE EXCEPTION 'Unknown message kind';
  END IF;

  INSERT INTO public.delivery_messages(order_id, customer_id, delivery_partner_id, kind, message)
  VALUES (_order_id, _customer_id, _partner_id, _kind, _body)
  RETURNING id INTO _msg_id;

  _title := '🚚 Delivery Update' || CASE WHEN _order_number IS NOT NULL THEN ' — ' || _order_number ELSE '' END;
  PERFORM public.notify_user(_customer_id, _title, _body, 'delivery',
    jsonb_build_object('order_id', _order_id, 'kind', _kind, 'message_id', _msg_id, 'url', '/customer/orders/' || _order_id));

  RETURN _msg_id;
END $$;

REVOKE ALL ON FUNCTION public.partner_send_message(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_send_message(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.partner_send_message(uuid, text, text) TO authenticated;
