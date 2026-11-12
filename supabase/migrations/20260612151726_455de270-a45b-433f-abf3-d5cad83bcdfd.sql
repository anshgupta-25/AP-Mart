
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text := lower(coalesce(NEW.email, ''));
  _phone text := coalesce(NEW.raw_user_meta_data->>'phone', NEW.phone, '');
  _name  text := coalesce(NEW.raw_user_meta_data->>'full_name', '');
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (NEW.id, _name, _phone, NULLIF(_email, ''))
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
        phone     = COALESCE(NULLIF(EXCLUDED.phone,''),     public.profiles.phone),
        email     = COALESCE(EXCLUDED.email,                public.profiles.email);

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
END $$;
