ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS house_no text,
  ADD COLUMN IF NOT EXISTS building text;

CREATE OR REPLACE FUNCTION public.tg_addresses_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- first address for a user is always the default
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.addresses a WHERE a.user_id = NEW.user_id AND a.id <> NEW.id
  ) THEN
    NEW.is_default := true;
  END IF;

  IF NEW.is_default THEN
    UPDATE public.addresses
       SET is_default = false, updated_at = now()
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS addresses_single_default ON public.addresses;
CREATE TRIGGER addresses_single_default
BEFORE INSERT OR UPDATE OF is_default ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.tg_addresses_single_default();

CREATE OR REPLACE FUNCTION public.count_eligible_shops(
  _pincode text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.shops s
  WHERE s.is_open
    AND s.status = 'active'
    AND s.owner_id IS NOT NULL
    AND (
      (_pincode IS NOT NULL AND s.pincode = _pincode)
      OR (
        _lat IS NOT NULL AND _lng IS NOT NULL
        AND public.haversine_km(_lat, _lng, s.latitude, s.longitude) <= COALESCE(s.service_radius_km, 15)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.count_eligible_shops(text, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_eligible_shops(text, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_eligible_shops(text, double precision, double precision) TO service_role;