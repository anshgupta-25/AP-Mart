
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'eshanthakur50@gmail.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'eshanthakur50@gmail.com', crypt('123qwe@help', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Support Agent"}'::jsonb,
      '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', 'eshanthakur50@gmail.com', 'email_verified', true),
            'email', v_user_id::text, now(), now(), now());
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'support')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.profiles (id, full_name)
  VALUES (v_user_id, 'Support Agent')
  ON CONFLICT (id) DO NOTHING;
END $$;
