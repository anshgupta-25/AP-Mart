
-- 1. Schema additions
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_sequence jsonb,
  ADD COLUMN IF NOT EXISTS pickup_route_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_pickup_index integer NOT NULL DEFAULT 0;

-- 2. Idempotency guards
CREATE UNIQUE INDEX IF NOT EXISTS uq_pickup_events_child_event
  ON public.pickup_events (child_order_id, event)
  WHERE child_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_dispatch_user_notif
  ON public.notification_dispatch_log (user_id, notification_id)
  WHERE notification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_orders_parent_partner
  ON public.orders (parent_order_id) WHERE parent_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_orders_ready_no_partner
  ON public.orders (status, partner_id) WHERE is_parent = true AND partner_id IS NULL;

-- 3. Partner live location update
CREATE OR REPLACE FUNCTION public.partner_update_location(_lat double precision, _lng double precision)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pid uuid;
BEGIN
  IF _lat IS NULL OR _lng IS NULL OR abs(_lat) > 90 OR abs(_lng) > 180 THEN
    RAISE EXCEPTION 'invalid coordinates';
  END IF;
  SELECT id INTO _pid FROM delivery_partners WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RAISE EXCEPTION 'not a delivery partner'; END IF;
  UPDATE delivery_partners
    SET current_lat = _lat, current_lng = _lng, updated_at = now(), is_online = true
  WHERE id = _pid;
END $$;

REVOKE ALL ON FUNCTION public.partner_update_location(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_update_location(double precision, double precision) TO authenticated;

-- 4. Rank riders for a parent order
CREATE OR REPLACE FUNCTION public.rank_riders_for_parent(_parent_id uuid, _limit integer DEFAULT 5)
RETURNS TABLE (
  partner_id uuid,
  user_id uuid,
  distance_km numeric,
  active_order_count integer,
  rating numeric,
  score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _first_lat double precision; _first_lng double precision;
BEGIN
  -- Use the first child shop's coordinates as the initial pickup anchor
  SELECT s.latitude, s.longitude INTO _first_lat, _first_lng
  FROM orders c
  JOIN shops s ON s.id = c.shop_id
  WHERE c.parent_order_id = _parent_id
    AND c.status <> 'cancelled'
  ORDER BY c.placed_at ASC
  LIMIT 1;

  IF _first_lat IS NULL THEN RAISE EXCEPTION 'parent has no active children'; END IF;

  RETURN QUERY
  SELECT
    dp.id,
    dp.user_id,
    ROUND((
      2 * 6371 * asin(sqrt(
        power(sin(radians((_first_lat - dp.current_lat)/2)), 2)
        + cos(radians(_first_lat)) * cos(radians(dp.current_lat))
          * power(sin(radians((_first_lng - dp.current_lng)/2)), 2)
      ))
    )::numeric, 3) AS distance_km,
    COALESCE(dp.active_order_count, 0) AS active_order_count,
    COALESCE(dp.rating, 4.5) AS rating,
    -- Composite score: lower is better. Distance dominates; penalise load, reward rating.
    (COALESCE(
       2 * 6371 * asin(sqrt(
         power(sin(radians((_first_lat - dp.current_lat)/2)), 2)
         + cos(radians(_first_lat)) * cos(radians(dp.current_lat))
           * power(sin(radians((_first_lng - dp.current_lng)/2)), 2)
       )), 999)
      + COALESCE(dp.active_order_count,0) * 1.5
      - COALESCE(dp.rating,4.5) * 0.3
    )::numeric AS score
  FROM delivery_partners dp
  WHERE dp.is_online = true
    AND dp.current_lat IS NOT NULL AND dp.current_lng IS NOT NULL
    AND COALESCE(dp.active_order_count,0) < 3
    AND COALESCE(dp.availability_status,'available') = 'available'
  ORDER BY score ASC
  LIMIT GREATEST(1, _limit);
END $$;

REVOKE ALL ON FUNCTION public.rank_riders_for_parent(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_riders_for_parent(uuid, integer) TO authenticated;

-- 5. Rider accepts a whole parent (all children in one shot)
CREATE OR REPLACE FUNCTION public.partner_accept_parent(_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pid uuid; _cust uuid;
BEGIN
  SELECT id INTO _pid FROM delivery_partners WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RAISE EXCEPTION 'not a delivery partner'; END IF;

  -- Advisory lock so two riders cannot both accept
  PERFORM pg_advisory_xact_lock(hashtext(_parent_id::text));

  IF EXISTS (SELECT 1 FROM orders WHERE id = _parent_id AND partner_id IS NOT NULL AND partner_id <> _pid) THEN
    RAISE EXCEPTION 'already assigned to another rider';
  END IF;

  UPDATE orders SET partner_id = _pid, updated_at = now()
    WHERE id = _parent_id AND is_parent = true AND status = 'packed'
    RETURNING user_id INTO _cust;
  IF _cust IS NULL THEN RAISE EXCEPTION 'parent not ready for pickup'; END IF;

  UPDATE orders SET partner_id = _pid, status = 'out_for_delivery', updated_at = now()
    WHERE parent_order_id = _parent_id AND status = 'packed';

  UPDATE delivery_partners
    SET active_order_count = COALESCE(active_order_count,0) + 1,
        current_order_id = _parent_id,
        status_updated_at = now()
  WHERE id = _pid;

  INSERT INTO notifications (user_id, title, body, category, data)
    VALUES (_cust, 'Rider assigned',
            'A rider is on the way to pick up your order.',
            'order', jsonb_build_object('order_id', _parent_id));
END $$;

REVOKE ALL ON FUNCTION public.partner_accept_parent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_accept_parent(uuid) TO authenticated;

-- 6. Available multi-shop parents (packed, no rider)
CREATE OR REPLACE FUNCTION public.partner_available_parent_orders()
RETURNS TABLE (
  parent_id uuid,
  order_number text,
  total numeric,
  shop_count integer,
  items_count bigint,
  city text,
  pincode text,
  ready_at timestamptz,
  delivery_type text,
  fast_delivery_fee numeric,
  first_pickup_lat double precision,
  first_pickup_lng double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pid uuid := current_user_partner_id();
BEGIN
  IF _pid IS NULL THEN RAISE EXCEPTION 'not a delivery partner'; END IF;
  RETURN QUERY
  SELECT o.id, o.order_number, o.total, o.shop_count,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id IN (SELECT id FROM orders WHERE parent_order_id = o.id)),
         (o.address->>'city')::text, (o.address->>'pincode')::text,
         o.ready_for_pickup_at,
         o.delivery_type, o.fast_delivery_fee,
         (SELECT s.latitude FROM orders c JOIN shops s ON s.id = c.shop_id WHERE c.parent_order_id = o.id ORDER BY c.placed_at LIMIT 1),
         (SELECT s.longitude FROM orders c JOIN shops s ON s.id = c.shop_id WHERE c.parent_order_id = o.id ORDER BY c.placed_at LIMIT 1)
  FROM orders o
  WHERE o.is_parent = true
    AND o.status = 'packed'
    AND o.partner_id IS NULL
    AND COALESCE(o.delivery_type,'standard_delivery') <> 'pickup'
  ORDER BY (CASE WHEN o.delivery_type = 'fast_delivery' THEN 0 ELSE 1 END), o.ready_for_pickup_at ASC;
END $$;

REVOKE ALL ON FUNCTION public.partner_available_parent_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_available_parent_orders() TO authenticated;

-- 7. Pickup summary for the rider screen (one row per shop stop)
CREATE OR REPLACE FUNCTION public.partner_parent_pickup_stops(_parent_id uuid)
RETURNS TABLE (
  child_id uuid,
  shop_id uuid,
  shop_name text,
  shop_address text,
  shop_phone text,
  shop_lat double precision,
  shop_lng double precision,
  status order_status,
  pickup_verified_at timestamptz,
  items_count bigint,
  seq integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pid uuid := current_user_partner_id();
BEGIN
  IF _pid IS NULL THEN RAISE EXCEPTION 'not a delivery partner'; END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = _parent_id AND partner_id = _pid) THEN
    RAISE EXCEPTION 'not your delivery';
  END IF;
  RETURN QUERY
  SELECT c.id, s.id, s.name, s.address, s.phone, s.latitude, s.longitude,
         c.status, c.pickup_verified_at,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = c.id),
         ROW_NUMBER() OVER (ORDER BY (c.pickup_verified_at IS NULL) DESC, c.placed_at)::int
  FROM orders c JOIN shops s ON s.id = c.shop_id
  WHERE c.parent_order_id = _parent_id AND c.status <> 'cancelled'
  ORDER BY c.placed_at;
END $$;

REVOKE ALL ON FUNCTION public.partner_parent_pickup_stops(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_parent_pickup_stops(uuid) TO authenticated;

-- 8. Notify top-ranked riders when parent becomes packed
CREATE OR REPLACE FUNCTION public.notify_riders_on_parent_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.is_parent = true AND NEW.status = 'packed'
     AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.partner_id IS NULL THEN
    FOR r IN SELECT * FROM rank_riders_for_parent(NEW.id, 5) LOOP
      INSERT INTO notifications (user_id, title, body, category, data)
      VALUES (
        r.user_id,
        'New multi-shop delivery',
        'Order ' || NEW.order_number || ' (' || NEW.shop_count || ' shops) ready for pickup — '
          || r.distance_km || ' km away',
        'delivery',
        jsonb_build_object('parent_id', NEW.id, 'shop_count', NEW.shop_count,
                            'distance_km', r.distance_km, 'is_parent', true)
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_riders_parent_ready ON public.orders;
CREATE TRIGGER trg_notify_riders_parent_ready
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_riders_on_parent_ready();

-- 9. Schedule reservation cleanup every minute
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release_expired_reservations') THEN
    PERFORM cron.schedule('release_expired_reservations', '* * * * *',
      $cron$ SELECT public.release_expired_reservations(); $cron$);
  END IF;
END $$;
