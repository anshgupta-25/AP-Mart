-- 1. Data API grants (were missing entirely)
GRANT SELECT ON public.locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;

-- 2. Normalize existing data
UPDATE public.locations
SET state = btrim(state),
    city = btrim(city),
    pincode = regexp_replace(pincode, '\s', '', 'g')
WHERE state <> btrim(state)
   OR city <> btrim(city)
   OR pincode <> regexp_replace(pincode, '\s', '', 'g');

-- 3. Enforce 6-digit text PIN
ALTER TABLE public.locations
  ADD CONSTRAINT locations_pincode_format CHECK (pincode ~ '^[0-9]{6}$');

-- 4. Normalization + updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_locations_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.state := btrim(NEW.state);
  NEW.city := btrim(NEW.city);
  NEW.pincode := regexp_replace(NEW.pincode, '\s', '', 'g');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_locations_normalize ON public.locations;
CREATE TRIGGER tg_locations_normalize
BEFORE INSERT OR UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.tg_locations_normalize();

-- 5. Index for PIN lookups
CREATE INDEX IF NOT EXISTS locations_pincode_idx ON public.locations (pincode);