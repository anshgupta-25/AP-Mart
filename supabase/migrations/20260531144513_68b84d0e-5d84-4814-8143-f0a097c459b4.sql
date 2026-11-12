
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_id text,
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_order ON public.payments(provider_order_id);

-- Allow service role and the order owner to update payments (used by server fn after verify)
DROP POLICY IF EXISTS pay_self_update ON public.payments;
CREATE POLICY pay_self_update ON public.payments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admin: revenue summary
CREATE OR REPLACE FUNCTION public.admin_payments_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'revenue_total', COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0),
    'revenue_today', COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND created_at::date = current_date), 0),
    'txn_count',     COUNT(*) FILTER (WHERE status = 'paid'),
    'failed_count',  COUNT(*) FILTER (WHERE status = 'failed'),
    'refund_total',  COALESCE(SUM(refund_amount) FILTER (WHERE status = 'refunded'), 0),
    'refund_count',  COUNT(*) FILTER (WHERE status = 'refunded')
  ) INTO _out FROM public.payments;
  RETURN _out;
END $$;

-- Admin: list transactions
CREATE OR REPLACE FUNCTION public.admin_list_payments(_status payment_status DEFAULT NULL, _limit int DEFAULT 100)
RETURNS TABLE (
  id uuid, order_id uuid, user_id uuid, provider text, provider_payment_id text,
  amount numeric, status payment_status, method text, error_code text, error_description text,
  refund_amount numeric, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT p.id, p.order_id, p.user_id, p.provider, p.provider_payment_id,
           p.amount, p.status, p.method, p.error_code, p.error_description,
           p.refund_amount, p.created_at
    FROM public.payments p
    WHERE (_status IS NULL OR p.status = _status)
    ORDER BY p.created_at DESC
    LIMIT _limit;
END $$;

-- Mark refund (called from server fn after Razorpay refund call succeeds)
CREATE OR REPLACE FUNCTION public.admin_record_refund(_payment_id uuid, _refund_id text, _amount numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _order uuid; _user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.payments
    SET status = 'refunded', refund_id = _refund_id, refund_amount = _amount,
        refunded_at = now(), updated_at = now()
    WHERE id = _payment_id
    RETURNING order_id, user_id INTO _order, _user;
  IF _order IS NOT NULL THEN
    UPDATE public.orders SET payment_status = 'refunded', updated_at = now() WHERE id = _order;
    INSERT INTO public.notifications (user_id, title, body, category)
    VALUES (_user, 'Refund issued', 'Your refund of ₹' || _amount || ' has been processed.', 'payment');
  END IF;
END $$;

-- Updated_at trigger
DROP TRIGGER IF EXISTS payments_updated ON public.payments;
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
