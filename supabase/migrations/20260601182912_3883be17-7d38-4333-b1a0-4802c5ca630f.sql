
-- Ensure pgcrypto is available for bcrypt
create extension if not exists pgcrypto;

-- 1) Admin: reset password to Admin@2026#
update auth.users
set encrypted_password = crypt('Admin@2026#', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where email = 'eshanthakur767@gmail.com';

insert into public.user_roles (user_id, role)
select id, 'admin'::app_role from auth.users where email = 'eshanthakur767@gmail.com'
on conflict (user_id, role) do nothing;

-- 2) Shopkeeper: existing account uses eshanthakur959@gmail.com (typo-tolerant)
update auth.users
set encrypted_password = crypt('Shop@2026#', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where email = 'eshanthakur959@gmail.com';

-- Remove any default customer role and assign shopkeeper
delete from public.user_roles
where user_id = (select id from auth.users where email = 'eshanthakur959@gmail.com')
  and role <> 'shopkeeper';

insert into public.user_roles (user_id, role)
select id, 'shopkeeper'::app_role from auth.users where email = 'eshanthakur959@gmail.com'
on conflict (user_id, role) do nothing;

-- 3) Delivery partner: create if missing
do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = 'aroopsinghchinder@gmail.com';
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'aroopsinghchinder@gmail.com', crypt('Delivery@2026#', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Delivery Partner"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', 'aroopsinghchinder@gmail.com', 'email_verified', true),
      'email', v_id::text, now(), now(), now()
    );
  else
    update auth.users
    set encrypted_password = crypt('Delivery@2026#', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_id;
  end if;

  delete from public.user_roles where user_id = v_id and role <> 'delivery';
  insert into public.user_roles (user_id, role) values (v_id, 'delivery'::app_role)
  on conflict (user_id, role) do nothing;
end $$;
