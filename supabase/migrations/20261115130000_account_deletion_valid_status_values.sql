-- Account deletion (issue #21) fix: the purge set status values that the table CHECK constraints
-- reject, so every self-deletion failed and rolled back:
--   profiles_status_check allows ('active','disabled')  -> was 'deleted', now 'disabled'
--   shops_status_check    allows ('active','suspended') -> was 'inactive', now 'suspended'
-- (The profile row is removed with the auth user right after; the shop row is kept, closed.)

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
  v_phone_digits text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  v_check := public.account_deletion_check();
  IF NOT (v_check->>'allowed')::boolean THEN
    RAISE EXCEPTION '%', v_check->>'reason';
  END IF;

  -- Last 10 digits of the profile phone (numbers are stored with or without +91).
  SELECT right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) INTO v_phone_digits
  FROM public.profiles WHERE id = uid;

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
       SET owner_id = NULL, is_open = false, phone = NULL, status = 'suspended', updated_at = now()
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

  -- Orders are kept for accounting, but nothing in them points back to the person: the saved
  -- address (which also held the address row id and user id) is cut down to city/state/PIN.
  UPDATE public.orders
     SET address = jsonb_strip_nulls(jsonb_build_object(
           'name', 'Deleted user',
           'city', address->>'city',
           'state', address->>'state',
           'pincode', address->>'pincode')),
         delivery_lat = NULL,
         delivery_lng = NULL,
         delivery_instruction = NULL
   WHERE user_id = uid;

  -- The user's own support tickets (messages, attachments, assignments cascade).
  DELETE FROM public.support_tickets WHERE user_id = uid;

  -- References to this user on records that belong to others: keep the record, drop the link.
  UPDATE public.offers SET created_by = NULL WHERE created_by = uid;
  UPDATE public.role_requests SET decided_by = NULL WHERE decided_by = uid;

  -- Personal data
  DELETE FROM public.cart_items WHERE user_id = uid;
  DELETE FROM public.wishlist_items WHERE user_id = uid;
  DELETE FROM public.addresses WHERE user_id = uid;
  DELETE FROM public.reviews WHERE user_id = uid;
  DELETE FROM public.notification_dispatch_log WHERE user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid;
  DELETE FROM public.notification_preferences WHERE user_id = uid;
  DELETE FROM public.onesignal_subscriptions WHERE user_id = uid;
  DELETE FROM public.fcm_tokens WHERE user_id = uid;
  DELETE FROM public.delivery_messages WHERE customer_id = uid;
  DELETE FROM public.role_requests WHERE user_id = uid;
  DELETE FROM public.support_agents WHERE user_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;
  IF length(v_phone_digits) = 10 THEN
    DELETE FROM public.phone_otps
     WHERE right(regexp_replace(phone, '\D', '', 'g'), 10) = v_phone_digits;
  END IF;

  UPDATE public.profiles
     SET full_name = 'Deleted user', phone = NULL, email = NULL, avatar_url = NULL,
         address = NULL, state = NULL, city = NULL, pincode = NULL,
         shop_id = NULL, is_active = false, status = 'disabled', updated_at = now()
   WHERE id = uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account_data() TO authenticated, service_role;
