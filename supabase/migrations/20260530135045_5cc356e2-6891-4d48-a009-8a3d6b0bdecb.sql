
-- Auto-assign roles for designated test accounts on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _email text := lower(coalesce(NEW.email, ''));
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.raw_user_meta_data->>'phone',''));

  -- Default customer role for everyone
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
    ON CONFLICT (user_id, role) DO NOTHING;

  -- Pre-provisioned test accounts
  IF _email = 'eshanthakur767@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _email = 'eshanthaku959@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'shopkeeper')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _email = 'aroopsinghchinder@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'delivery')
      ON CONFLICT (user_id, role) DO NOTHING;
    -- Also create a delivery_partners row so they can accept orders
    INSERT INTO public.delivery_partners (user_id, name, phone, is_online)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name','Delivery Partner'), COALESCE(NEW.raw_user_meta_data->>'phone',''), false)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;

-- Ensure trigger is wired
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Retroactively apply roles if the accounts already exist
DO $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = 'eshanthakur767@gmail.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name) VALUES (_uid, '') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = 'eshanthaku959@gmail.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name) VALUES (_uid, '') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'shopkeeper') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = 'aroopsinghchinder@gmail.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name) VALUES (_uid, '') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'delivery') ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.delivery_partners (user_id, name, is_online)
      SELECT _uid, 'Delivery Partner', false
      WHERE NOT EXISTS (SELECT 1 FROM public.delivery_partners WHERE user_id = _uid);
  END IF;
END $$;
