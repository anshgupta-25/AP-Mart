
CREATE OR REPLACE FUNCTION public.set_updated_at_dzs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.delivery_zone_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  city text NOT NULL,
  pin_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  delivery_radius_km numeric NOT NULL DEFAULT 10,
  standard_enabled boolean NOT NULL DEFAULT true,
  standard_fee numeric NOT NULL DEFAULT 0,
  standard_eta_minutes text NOT NULL DEFAULT '45-60',
  minimum_order_standard numeric,
  fast_enabled boolean NOT NULL DEFAULT false,
  fast_fee numeric NOT NULL DEFAULT 49,
  fast_eta_minutes text NOT NULL DEFAULT '20-30',
  minimum_order_fast numeric,
  express_enabled boolean NOT NULL DEFAULT false,
  express_fee numeric NOT NULL DEFAULT 99,
  express_eta_minutes text NOT NULL DEFAULT '10-15',
  minimum_order_express numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_zone_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_zone_settings TO authenticated;
GRANT ALL ON public.delivery_zone_settings TO service_role;

ALTER TABLE public.delivery_zone_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dzs_public_read_active" ON public.delivery_zone_settings
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "dzs_admin_all" ON public.delivery_zone_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_dzs_pin ON public.delivery_zone_settings(pin_code);
CREATE INDEX idx_dzs_state_city ON public.delivery_zone_settings(state, city);

CREATE TRIGGER trg_dzs_updated BEFORE UPDATE ON public.delivery_zone_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_dzs();

CREATE OR REPLACE FUNCTION public.get_delivery_options_for_pincode(_pincode text)
RETURNS TABLE(
  pin_code text, state text, city text, is_active boolean,
  standard_enabled boolean, standard_fee numeric, standard_eta_minutes text, minimum_order_standard numeric,
  fast_enabled boolean, fast_fee numeric, fast_eta_minutes text, minimum_order_fast numeric,
  express_enabled boolean, express_fee numeric, express_eta_minutes text, minimum_order_express numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pin_code, state, city, is_active,
    standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
    fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
    express_enabled, express_fee, express_eta_minutes, minimum_order_express
  FROM public.delivery_zone_settings
  WHERE pin_code = _pincode AND is_active = true
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_delivery_options_for_pincode(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_delivery_zones()
RETURNS SETOF public.delivery_zone_settings
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY SELECT * FROM public.delivery_zone_settings ORDER BY state, city, pin_code;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_delivery_zones() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_delivery_zone(_data jsonb)
RETURNS public.delivery_zone_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.delivery_zone_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF (_data->>'id') IS NOT NULL AND (_data->>'id') <> '' THEN
    UPDATE public.delivery_zone_settings SET
      state = COALESCE(_data->>'state', state),
      city = COALESCE(_data->>'city', city),
      pin_code = COALESCE(_data->>'pin_code', pin_code),
      is_active = COALESCE((_data->>'is_active')::boolean, is_active),
      delivery_radius_km = COALESCE((_data->>'delivery_radius_km')::numeric, delivery_radius_km),
      standard_enabled = COALESCE((_data->>'standard_enabled')::boolean, standard_enabled),
      standard_fee = COALESCE((_data->>'standard_fee')::numeric, standard_fee),
      standard_eta_minutes = COALESCE(_data->>'standard_eta_minutes', standard_eta_minutes),
      minimum_order_standard = NULLIF(_data->>'minimum_order_standard','')::numeric,
      fast_enabled = COALESCE((_data->>'fast_enabled')::boolean, fast_enabled),
      fast_fee = COALESCE((_data->>'fast_fee')::numeric, fast_fee),
      fast_eta_minutes = COALESCE(_data->>'fast_eta_minutes', fast_eta_minutes),
      minimum_order_fast = NULLIF(_data->>'minimum_order_fast','')::numeric,
      express_enabled = COALESCE((_data->>'express_enabled')::boolean, express_enabled),
      express_fee = COALESCE((_data->>'express_fee')::numeric, express_fee),
      express_eta_minutes = COALESCE(_data->>'express_eta_minutes', express_eta_minutes),
      minimum_order_express = NULLIF(_data->>'minimum_order_express','')::numeric,
      updated_at = now()
    WHERE id = (_data->>'id')::uuid
    RETURNING * INTO r;
  ELSE
    INSERT INTO public.delivery_zone_settings(
      state, city, pin_code, is_active, delivery_radius_km,
      standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
      fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
      express_enabled, express_fee, express_eta_minutes, minimum_order_express
    ) VALUES (
      _data->>'state', _data->>'city', _data->>'pin_code',
      COALESCE((_data->>'is_active')::boolean, true),
      COALESCE((_data->>'delivery_radius_km')::numeric, 10),
      COALESCE((_data->>'standard_enabled')::boolean, true),
      COALESCE((_data->>'standard_fee')::numeric, 0),
      COALESCE(_data->>'standard_eta_minutes','45-60'),
      NULLIF(_data->>'minimum_order_standard','')::numeric,
      COALESCE((_data->>'fast_enabled')::boolean, false),
      COALESCE((_data->>'fast_fee')::numeric, 49),
      COALESCE(_data->>'fast_eta_minutes','20-30'),
      NULLIF(_data->>'minimum_order_fast','')::numeric,
      COALESCE((_data->>'express_enabled')::boolean, false),
      COALESCE((_data->>'express_fee')::numeric, 99),
      COALESCE(_data->>'express_eta_minutes','10-15'),
      NULLIF(_data->>'minimum_order_express','')::numeric
    )
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_delivery_zone(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_delivery_zone(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  DELETE FROM public.delivery_zone_settings WHERE id = _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_delivery_zone(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_duplicate_delivery_zone(_id uuid, _new_pin text)
RETURNS public.delivery_zone_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.delivery_zone_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  INSERT INTO public.delivery_zone_settings(
    state, city, pin_code, is_active, delivery_radius_km,
    standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
    fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
    express_enabled, express_fee, express_eta_minutes, minimum_order_express
  )
  SELECT state, city, _new_pin, is_active, delivery_radius_km,
    standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
    fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
    express_enabled, express_fee, express_eta_minutes, minimum_order_express
  FROM public.delivery_zone_settings WHERE id = _id
  RETURNING * INTO r;
  RETURN r;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_duplicate_delivery_zone(uuid, text) TO authenticated;
