-- Account deletion (issue #21): complete the purge, block customers with orders in progress,
-- and keep other people's support history intact when a support agent deletes their account.
--
-- Decisions (delete vs anonymise), per table holding a user reference:
--   DELETED       cart_items, wishlist_items, addresses, reviews, notifications,
--                 notification_preferences, notification_dispatch_log, onesignal_subscriptions,
--                 fcm_tokens, role_requests, support_agents, user_roles, delivery_messages
--                 (customer side), phone_otps (by the profile's phone number), the user's OWN
--                 support tickets (messages, attachments and assignments cascade with them;
--                 attachment files are removed from storage by the server before the purge).
--   ANONYMISED    orders: the delivery address is cut down to city/state/PIN with the name
--                 "Deleted user"; the delivery coordinates and instruction are cleared; user_id
--                 becomes NULL when the auth user is deleted (FK ON DELETE SET NULL).
--                 payments: user_id becomes NULL (FK ON DELETE SET NULL).
--                 delivery_partners: re-keyed to a random id with no personal details.
--                 shops: detached from the owner and closed (inventory is deleted).
--   KEPT, UNLINKED  (a support agent's work on OTHER people's tickets) support_messages.sender_id,
--                 ticket_attachments.uploaded_by: now set to NULL instead of deleting the
--                 customer's conversation history. support_tickets.assigned_to / resolved_by,
--                 shop_delivery_assignments.assigned_by, ticket_assignments.assigned_by:
--                 already SET NULL. offers.created_by, role_requests.decided_by (no FK):
--                 set to NULL by the purge.
--   CASCADED      profiles (and everything above with ON DELETE CASCADE) is removed when the
--                 auth user is deleted, so the same email can sign up again as a brand-new user.

-- 1. A support agent's replies/attachments on other customers' tickets survive the agent's deletion.
ALTER TABLE public.support_messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_sender_id_fkey;
ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ticket_attachments ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.ticket_attachments DROP CONSTRAINT IF EXISTS ticket_attachments_uploaded_by_fkey;
ALTER TABLE public.ticket_attachments ADD CONSTRAINT ticket_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Eligibility check for the CURRENT user. Adds: customers with orders in progress are blocked,
--    a machine-readable `blocker`, and `has_password` (Google sign-ins have none, so the delete
--    screen asks for an emailed code instead of a password).
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
  v_has_password boolean := false;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not signed in');
  END IF;

  SELECT coalesce(encrypted_password, '') <> '' INTO v_has_password
  FROM auth.users WHERE id = uid;
  v_has_password := coalesce(v_has_password, false);

  SELECT coalesce(array_agg(role::text), '{}') INTO v_roles
  FROM public.user_roles WHERE user_id = uid;

  -- Anyone (customer) with their own orders still in progress: the shop and the delivery
  -- partner still need the delivery address and phone number. Counts what the customer sees
  -- (top-level orders); a multi-shop parent counts only while one of its shop orders is open.
  SELECT count(*) INTO v_active
  FROM public.orders o
  WHERE o.user_id = uid
    AND o.parent_order_id IS NULL
    AND o.status NOT IN ('delivered', 'cancelled', 'no_shop_available')
    AND (
      NOT coalesce(o.is_parent, false)
      OR NOT EXISTS (SELECT 1 FROM public.orders c WHERE c.parent_order_id = o.id)
      OR EXISTS (
        SELECT 1 FROM public.orders c
        WHERE c.parent_order_id = o.id
          AND c.status NOT IN ('delivered', 'cancelled', 'no_shop_available')
      )
    );
  IF v_active > 0 THEN
    RETURN jsonb_build_object('allowed', false, 'roles', v_roles, 'active_count', v_active,
      'blocker', 'orders', 'has_password', v_has_password,
      'reason', format('You have %s order%s in progress. Wait until %s delivered or cancel %s first.',
        v_active, CASE WHEN v_active = 1 THEN '' ELSE 's' END,
        CASE WHEN v_active = 1 THEN 'it is' ELSE 'they are' END,
        CASE WHEN v_active = 1 THEN 'it' ELSE 'them' END));
  END IF;

  IF 'shopkeeper' = ANY(v_roles) THEN
    SELECT count(*) INTO v_active
    FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE s.owner_id = uid
      AND o.status NOT IN ('delivered', 'cancelled');
    IF v_active > 0 THEN
      RETURN jsonb_build_object('allowed', false, 'roles', v_roles, 'active_count', v_active,
        'blocker', 'shop_orders', 'has_password', v_has_password,
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
        'blocker', 'deliveries', 'has_password', v_has_password,
        'reason', 'You have active deliveries. Please complete or resolve them before deleting your account.');
    END IF;
  END IF;

  IF 'super_admin' = ANY(v_roles) THEN
    SELECT count(*) INTO v_other_super
    FROM public.user_roles
    WHERE role = 'super_admin' AND user_id <> uid;
    IF v_other_super = 0 THEN
      RETURN jsonb_build_object('allowed', false, 'roles', v_roles,
        'blocker', 'last_super_admin', 'has_password', v_has_password,
        'reason', 'The last Super Admin account cannot be deleted. Assign another Super Admin before deleting this account.');
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'roles', v_roles, 'has_password', v_has_password);
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
         shop_id = NULL, is_active = false, status = 'deleted', updated_at = now()
   WHERE id = uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account_data() TO authenticated, service_role;
