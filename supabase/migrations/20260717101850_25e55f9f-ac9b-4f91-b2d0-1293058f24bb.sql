
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text,
  size text NOT NULL,
  unit text,
  sku text,
  barcode text,
  weight text,
  mrp numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  retail_price numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}',
  is_available boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_public_read" ON public.product_variants
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "pv_shopkeeper_manage" ON public.product_variants
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.shop_products sp
      JOIN public.shops s ON s.id = sp.shop_id
      WHERE sp.product_id = product_variants.product_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.shop_products sp
      JOIN public.shops s ON s.id = sp.shop_id
      WHERE sp.product_id = product_variants.product_id AND s.owner_id = auth.uid()
    )
  );

CREATE INDEX idx_product_variants_product ON public.product_variants(product_id, display_order);

CREATE TRIGGER trg_pv_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cart_items ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN variant_label text;

CREATE OR REPLACE FUNCTION public.place_order(_address jsonb, _payment_method payment_method, _coupon_code text DEFAULT NULL::text, _delivery_instruction text DEFAULT NULL::text, _delivery_type text DEFAULT 'standard_delivery'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _subtotal numeric := 0;
  _discount numeric := 0;
  _delivery_fee numeric := 0;
  _fast_fee numeric := 0;
  _handling numeric := 5;
  _total numeric := 0;
  _coupon record;
  _lat double precision;
  _lng double precision;
  _pin text;
  _shop_id uuid;
  _distance numeric;
  _candidates int := 0;
  _has_pin_match boolean := false;
  _has_in_radius boolean := false;
  r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _delivery_type NOT IN ('fast_delivery','standard_delivery','pickup') THEN
    RAISE EXCEPTION 'Invalid delivery type';
  END IF;

  _lat := (_address->>'lat')::double precision;
  _lng := (_address->>'lng')::double precision;
  _pin := NULLIF(trim(_address->>'pincode'), '');
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Delivery address needs coordinates'; END IF;
  IF _pin IS NULL THEN RAISE EXCEPTION 'Delivery address is missing a pincode'; END IF;

  SELECT count(*) INTO _candidates FROM public.shops WHERE is_open = true AND owner_id IS NOT NULL;
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE is_open = true AND owner_id IS NOT NULL AND pincode = _pin) INTO _has_pin_match;
  SELECT EXISTS (
    SELECT 1 FROM public.shops s WHERE s.is_open = true AND s.owner_id IS NOT NULL
      AND s.pincode = _pin
      AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
  ) INTO _has_in_radius;

  _shop_id := public.find_best_shop_for_cart(_uid, _lat, _lng, _pin, '{}');

  IF _shop_id IS NULL THEN
    INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, outcome, reason, details)
    VALUES (
      NULL, _pin, _lat, _lng, _candidates,
      CASE WHEN NOT _has_pin_match THEN 'no_shop_in_pincode' WHEN NOT _has_in_radius THEN 'out_of_radius' ELSE 'no_stock' END,
      CASE WHEN NOT _has_pin_match THEN 'No active shop registered for pincode ' || _pin
           WHEN NOT _has_in_radius THEN 'Shops in pincode ' || _pin || ' do not cover this address within their delivery radius'
           ELSE 'Shops in pincode ' || _pin || ' do not have all requested items in stock' END,
      jsonb_build_object('user_id', _uid)
    );
    RAISE EXCEPTION 'No shop currently delivers to your location or has the requested products available.';
  END IF;

  SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng)
    INTO _distance FROM public.shops s WHERE s.id = _shop_id;

  FOR r IN
    SELECT ci.product_id, ci.variant_id, ci.quantity,
           COALESCE(pv.selling_price, sp.price) AS eff_price,
           COALESCE(pv.stock, sp.stock) AS eff_stock,
           p.name
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
    LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id
    WHERE ci.user_id = _uid
    FOR UPDATE OF sp
  LOOP
    IF r.quantity > r.eff_stock THEN
      RAISE EXCEPTION 'Sorry, "%" is out of stock.', r.name;
    END IF;
    _subtotal := _subtotal + r.eff_price * r.quantity;
  END LOOP;
  IF _subtotal = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  IF _coupon_code IS NOT NULL AND length(_coupon_code) > 0 THEN
    SELECT * INTO _coupon FROM public.coupons
      WHERE code = upper(_coupon_code) AND active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (usage_limit IS NULL OR times_used < usage_limit) LIMIT 1;
    IF _coupon.id IS NOT NULL AND _subtotal >= _coupon.min_order THEN
      IF _coupon.type = 'flat' THEN _discount := LEAST(_coupon.value, _subtotal);
      ELSE
        _discount := (_subtotal * _coupon.value / 100.0);
        IF _coupon.max_discount IS NOT NULL THEN _discount := LEAST(_discount, _coupon.max_discount); END IF;
      END IF;
      UPDATE public.coupons SET times_used = times_used + 1 WHERE id = _coupon.id;
    END IF;
  END IF;

  IF _delivery_type = 'fast_delivery' THEN
    _fast_fee := 100; _delivery_fee := 100;
  ELSE
    _fast_fee := 0; _delivery_fee := 0;
  END IF;

  _total := _subtotal - _discount + _delivery_fee + _handling;

  INSERT INTO public.orders (
    user_id, shop_id, address, delivery_lat, delivery_lng, delivery_pincode,
    payment_method, payment_status, status,
    subtotal, discount, delivery_fee, handling_fee, tax, total,
    coupon_code, delivery_instruction, assignment_attempts, assignment_expires_at,
    delivery_type, fast_delivery_fee,
    assignment_reason, assignment_distance_km, routing_status
  ) VALUES (
    _uid, _shop_id, _address, _lat, _lng, _pin,
    _payment_method, 'pending'::payment_status, 'awaiting_shop'::order_status,
    _subtotal, _discount, _delivery_fee, _handling, 0, _total,
    _coupon_code, _delivery_instruction, 1, now() + interval '10 minutes',
    _delivery_type, _fast_fee,
    'Pincode ' || _pin || ' • nearest in-stock shop', _distance, 'assigned'
  ) RETURNING id INTO _order_id;

  INSERT INTO public.order_items (order_id, product_id, variant_id, variant_label, name, image_url, unit, price, quantity)
  SELECT _order_id, ci.product_id, ci.variant_id,
         CASE WHEN pv.id IS NOT NULL THEN COALESCE(pv.name, pv.size) END,
         p.name,
         COALESCE((pv.images)[1], p.cover_image, p.image_url),
         COALESCE(pv.size || COALESCE(' ' || pv.unit, ''), p.unit),
         COALESCE(pv.selling_price, sp.price),
         ci.quantity
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
  LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id
  WHERE ci.user_id = _uid;

  UPDATE public.product_variants pv
    SET stock = pv.stock - ci.quantity, updated_at = now()
  FROM public.cart_items ci
  WHERE ci.user_id = _uid AND ci.variant_id = pv.id;

  UPDATE public.shop_products sp SET stock = sp.stock - ci.quantity, updated_at = now()
  FROM public.cart_items ci
  WHERE ci.user_id = _uid AND ci.variant_id IS NULL
    AND ci.product_id = sp.product_id AND sp.shop_id = _shop_id;

  DELETE FROM public.cart_items WHERE user_id = _uid;

  INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, chosen_shop_id, chosen_distance_km, outcome, reason)
  VALUES (_order_id, _pin, _lat, _lng, _candidates, _shop_id, _distance, 'assigned', 'Pincode match + nearest in-stock shop within radius');

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_uid, 'Order placed!', 'Looking for a shop to accept your order...');
  RETURN _order_id;
END $function$;
