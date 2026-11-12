-- 1. Preserve order/payment history when the auth user is deleted
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Eligibility check for the CURRENT user only
CREATE OR REPLACE FUNCTION public.account_deletion_check()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_roles text[];
  v_active int := 0;
  v_other_super int := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not signed in');
  END IF;

  SELECT coalesce(array_agg(role::text), '{}') INTO v_roles
  FROM public.user_roles WHERE user_id = uid;

  IF 'shopkeeper' = ANY(v_roles) THEN
    SELECT count(*) INTO v_active
    FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE s.owner_id = uid
      AND o.status NOT IN ('delivered', 'cancelled');
    IF v_active > 0 THEN
      RETURN jsonb_build_object('allowed', false, 'roles', v_roles, 'active_count', v_active,
        'reason', 'Your account cannot be deleted while you have active orders. Please complete or resolve your active orders first.');
    END IF;
  END IF;

  IF 'delivery' = ANY(v_roles) THEN
    SELECT count(*) INTO v_active
    FROM public.orders o
    JOIN public.delivery_partners dp ON dp.id = o.partner_id
    WHERE dp.user_id = uid
      AND o.status NOT IN ('delivered', 'cancelled');
    IF v_active > 0 THEN
      RETURN jsonb_build_object('allowed', false, 'roles', v_roles, 'active_count', v_active,
        'reason', 'You have active deliveries. Please complete or resolve them before deleting your account.');
    END IF;
  END IF;

  IF 'super_admin' = ANY(v_roles) THEN
    SELECT count(*) INTO v_other_super
    FROM public.user_roles
    WHERE role = 'super_admin' AND user_id <> uid;
    IF v_other_super = 0 THEN
      RETURN jsonb_build_object('allowed', false, 'roles', v_roles,
        'reason', 'The last Super Admin account cannot be deleted. Assign another Super Admin before deleting this account.');
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'roles', v_roles);
END;
$$;

REVOKE ALL ON FUNCTION public.account_deletion_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_deletion_check() TO authenticated, service_role;

-- 3. Purge / anonymise data owned by the CURRENT user. Master catalog is never touched.
CREATE OR REPLACE FUNCTION public.delete_my_account_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_check jsonb;
  v_shop_ids uuid[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  v_check := public.account_deletion_check();
  IF NOT (v_check->>'allowed')::boolean THEN
    RAISE EXCEPTION '%', v_check->>'reason';
  END IF;

  -- Shopkeeper: release ownership + delete shop-specific inventory (NOT catalog products)
  SELECT coalesce(array_agg(id), '{}') INTO v_shop_ids FROM public.shops WHERE owner_id = uid;
  IF array_length(v_shop_ids, 1) > 0 THEN
    DELETE FROM public.shop_collection_items
      WHERE collection_id IN (SELECT id FROM public.shop_collections WHERE shop_id = ANY(v_shop_ids));
    DELETE FROM public.shop_collections WHERE shop_id = ANY(v_shop_ids);
    DELETE FROM public.shop_category_items
      WHERE category_id IN (SELECT id FROM public.shop_categories WHERE shop_id = ANY(v_shop_ids));
    DELETE FROM public.shop_categories WHERE shop_id = ANY(v_shop_ids);
    DELETE FROM public.offers WHERE shop_id = ANY(v_shop_ids);
    DELETE FROM public.shop_delivery_assignments WHERE shop_id = ANY(v_shop_ids);
    DELETE FROM public.shop_products WHERE shop_id = ANY(v_shop_ids);
    UPDATE public.shops
       SET owner_id = NULL, is_open = false, phone = NULL, status = 'inactive', updated_at = now()
     WHERE id = ANY(v_shop_ids);
  END IF;

  -- Delivery partner: anonymise so historical deliveries stay intact
  UPDATE public.delivery_partners
     SET user_id = gen_random_uuid(),
         name = 'Deleted partner',
         phone = NULL,
         vehicle = NULL,
         shop_id = NULL,
         is_online = false,
         availability_status = 'offline',
         current_lat = NULL,
         current_lng = NULL,
         current_order_id = NULL,
         updated_at = now()
   WHERE user_id = uid;

  -- Anonymise personal contact details on retained business records
  UPDATE public.orders
     SET address = coalesce(address, '{}'::jsonb) || jsonb_build_object('name', 'Deleted user', 'phone', NULL)
   WHERE user_id = uid;

  -- Personal data
  DELETE FROM public.cart_items WHERE user_id = uid;
  DELETE FROM public.wishlist_items WHERE user_id = uid;
  DELETE FROM public.addresses WHERE user_id = uid;
  DELETE FROM public.reviews WHERE user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid;
  DELETE FROM public.notification_preferences WHERE user_id = uid;
  DELETE FROM public.onesignal_subscriptions WHERE user_id = uid;
  DELETE FROM public.role_requests WHERE user_id = uid;
  DELETE FROM public.support_agents WHERE user_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;

  UPDATE public.profiles
     SET full_name = 'Deleted user', phone = NULL, email = NULL, avatar_url = NULL,
         address = NULL, state = NULL, city = NULL, pincode = NULL,
         shop_id = NULL, is_active = false, status = 'deleted', updated_at = now()
   WHERE id = uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account_data() TO authenticated, service_role;