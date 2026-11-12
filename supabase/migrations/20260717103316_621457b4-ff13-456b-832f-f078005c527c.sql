
-- 1. Extend profiles with location fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS pincode text;

-- 2. Locations catalogue
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  city text NOT NULL,
  pincode text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state, city, pincode)
);

CREATE INDEX IF NOT EXISTS locations_state_idx ON public.locations (state) WHERE is_active;
CREATE INDEX IF NOT EXISTS locations_state_city_idx ON public.locations (state, city) WHERE is_active;

GRANT SELECT ON public.locations TO anon, authenticated;
GRANT ALL ON public.locations TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.locations TO authenticated;

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locations_public_read" ON public.locations;
CREATE POLICY "locations_public_read" ON public.locations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "locations_admin_write" ON public.locations;
CREATE POLICY "locations_admin_write" ON public.locations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_locations_updated ON public.locations;
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Update handle_new_user to persist state/city/pincode from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(NEW.email, ''));
  _phone text := coalesce(NEW.raw_user_meta_data->>'phone', NEW.phone, '');
  _name  text := coalesce(NEW.raw_user_meta_data->>'full_name', '');
  _state text := NULLIF(NEW.raw_user_meta_data->>'state', '');
  _city  text := NULLIF(NEW.raw_user_meta_data->>'city', '');
  _pin   text := NULLIF(NEW.raw_user_meta_data->>'pincode', '');
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, state, city, pincode)
  VALUES (NEW.id, _name, _phone, NULLIF(_email, ''), _state, _city, _pin)
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
        phone     = COALESCE(NULLIF(EXCLUDED.phone,''),     public.profiles.phone),
        email     = COALESCE(EXCLUDED.email,                public.profiles.email),
        state     = COALESCE(EXCLUDED.state,                public.profiles.state),
        city      = COALESCE(EXCLUDED.city,                 public.profiles.city),
        pincode   = COALESCE(EXCLUDED.pincode,              public.profiles.pincode);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
    ON CONFLICT (user_id, role) DO NOTHING;

  IF _email = 'eshanthakur767@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _email = 'eshanthaku959@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'shopkeeper')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _email = 'aroopsinghchinder@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'delivery')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.delivery_partners (user_id, name, phone, is_online)
    VALUES (NEW.id, COALESCE(NULLIF(_name,''),'Delivery Partner'), _phone, false)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $function$;

-- 4. Seed starter data (idempotent)
INSERT INTO public.locations (state, city, pincode) VALUES
  ('Uttar Pradesh','Noida','201301'),
  ('Uttar Pradesh','Noida','201302'),
  ('Uttar Pradesh','Noida','201303'),
  ('Uttar Pradesh','Noida','201304'),
  ('Uttar Pradesh','Noida','201305'),
  ('Uttar Pradesh','Lucknow','226001'),
  ('Uttar Pradesh','Lucknow','226010'),
  ('Uttar Pradesh','Lucknow','226016'),
  ('Uttar Pradesh','Kanpur','208001'),
  ('Uttar Pradesh','Kanpur','208012'),
  ('Uttar Pradesh','Agra','282001'),
  ('Uttar Pradesh','Agra','282005'),
  ('Uttar Pradesh','Varanasi','221001'),
  ('Uttar Pradesh','Varanasi','221005'),
  ('Uttar Pradesh','Prayagraj','211001'),
  ('Uttar Pradesh','Prayagraj','211003'),
  ('Bihar','Patna','800001'),
  ('Bihar','Patna','800013'),
  ('Bihar','Patna','800020'),
  ('Bihar','Gaya','823001'),
  ('Bihar','Muzaffarpur','842001'),
  ('Bihar','Bhagalpur','812001'),
  ('Delhi','New Delhi','110001'),
  ('Delhi','New Delhi','110003'),
  ('Delhi','New Delhi','110016'),
  ('Delhi','Dwarka','110075'),
  ('Delhi','Rohini','110085'),
  ('Delhi','Saket','110017'),
  ('Haryana','Gurugram','122001'),
  ('Haryana','Gurugram','122002'),
  ('Haryana','Gurugram','122018'),
  ('Haryana','Faridabad','121001'),
  ('Haryana','Faridabad','121003'),
  ('Haryana','Panipat','132103'),
  ('Haryana','Karnal','132001'),
  ('Punjab','Ludhiana','141001'),
  ('Punjab','Ludhiana','141002'),
  ('Punjab','Amritsar','143001'),
  ('Punjab','Amritsar','143005'),
  ('Punjab','Jalandhar','144001'),
  ('Punjab','Patiala','147001'),
  ('Punjab','Mohali','160055')
ON CONFLICT (state, city, pincode) DO NOTHING;
