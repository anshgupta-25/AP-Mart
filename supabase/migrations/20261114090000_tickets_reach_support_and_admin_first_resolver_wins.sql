-- Support tickets: every new ticket reaches both the support team and admins,
-- and whoever resolves it first wins.
--
-- 1. create_support_ticket notifies support agents AND admins (each with a link to
--    their own portal), not just support.
-- 2. admin_list_complaints returns tickets from every role (delivery partners were
--    missing) and includes assigned_to / resolved_by.
-- 3. update_ticket_status locks the ticket row, rejects a second "resolve" with
--    "Already resolved by <name>", skips no-op updates (no duplicate notifications),
--    records a fresh resolver after a reopen, and tells the assigned agent when
--    someone else resolved their ticket.
-- 4. Drop the old 2-argument update_ticket_status overload that made PostgREST
--    calls ambiguous ("Could not choose the best candidate function").
-- 5. ticket_staff_name(uid) lets support/admin show who resolved a ticket.

-- 1 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  _title text, _description text, _category ticket_category,
  _order_id uuid DEFAULT NULL, _shop_id uuid DEFAULT NULL, _partner_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _role text; _num text; r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;
  IF _description IS NULL OR length(trim(_description)) = 0 THEN RAISE EXCEPTION 'Description required'; END IF;

  _role := CASE
    WHEN has_role(_uid,'admin'::app_role) THEN 'admin'
    WHEN has_role(_uid,'support'::app_role) THEN 'support'
    WHEN has_role(_uid,'shopkeeper'::app_role) THEN 'shopkeeper'
    WHEN has_role(_uid,'delivery'::app_role) THEN 'delivery'
    ELSE 'customer'
  END;

  INSERT INTO public.support_tickets(user_id, role_at_creation, title, description, category, order_id, shop_id, partner_id)
  VALUES (_uid, _role, _title, _description, _category, _order_id, _shop_id, _partner_id)
  RETURNING id, ticket_number INTO _id, _num;

  -- One notification per staff member. Someone with both roles gets the admin link.
  FOR r IN
    SELECT ur.user_id, bool_or(ur.role = 'admin'::app_role) AS is_admin
    FROM public.user_roles ur
    WHERE ur.role IN ('support'::app_role, 'admin'::app_role)
      AND ur.user_id <> _uid
    GROUP BY ur.user_id
  LOOP
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (r.user_id, 'New support ticket',
      COALESCE(_num || ' · ', '') || _title, 'support',
      jsonb_build_object('ticket_id', _id, 'url',
        CASE WHEN r.is_admin THEN '/admin/complaints/' ELSE '/support/tickets/' END || _id));
  END LOOP;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_uid, 'Ticket created', 'We received your support request and will respond shortly.', 'support',
    jsonb_build_object('ticket_id', _id, 'url', '/support/ticket/' || _id));

  RETURN _id;
END $$;

-- 2 ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_complaints();
CREATE FUNCTION public.admin_list_complaints()
RETURNS TABLE(
  id uuid, ticket_number text, title text, description text,
  category text, status text, role_at_creation text,
  created_at timestamptz, assigned_to uuid, resolved_by uuid, user_id uuid,
  full_name text, phone text,
  address_line text, city text, pincode text,
  shop_name text, shop_address text, shop_phone text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    t.id, t.ticket_number, t.title, t.description,
    t.category::text, t.status::text, t.role_at_creation,
    t.created_at, t.assigned_to, t.resolved_by, t.user_id,
    p.full_name, COALESCE(p.phone, a.phone) AS phone,
    CONCAT_WS(', ', a.line1, a.line2, a.landmark) AS address_line,
    a.city, a.pincode,
    s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone
  FROM public.support_tickets t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.addresses
    WHERE addresses.user_id = t.user_id
    ORDER BY is_default DESC NULLS LAST, updated_at DESC
    LIMIT 1
  ) a ON TRUE
  LEFT JOIN LATERAL (
    SELECT * FROM public.shops
    WHERE owner_id = t.user_id
    ORDER BY shops.created_at ASC
    LIMIT 1
  ) s ON TRUE
  ORDER BY t.created_at DESC
  LIMIT 500;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_complaints() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_complaints() TO authenticated;

-- 4 ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_ticket_status(uuid, ticket_status);

-- 5 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_staff_name(_user_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF NOT (has_role(auth.uid(),'support'::app_role) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(
    (SELECT sa.display_name FROM public.support_agents sa WHERE sa.user_id = _user_id LIMIT 1),
    (SELECT NULLIF(trim(p.full_name), '') FROM public.profiles p WHERE p.id = _user_id),
    CASE WHEN has_role(_user_id,'admin'::app_role) THEN 'Admin' ELSE 'Support' END
  ) INTO _name;
  RETURN _name;
END $$;

REVOKE ALL ON FUNCTION public.ticket_staff_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_staff_name(uuid) TO authenticated;

-- 3 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_ticket_status(_ticket_id uuid, _status ticket_status, _notes text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _cur ticket_status;
  _resolver uuid;
  _assignee uuid;
  _creator uuid;
  _num text;
  _role text;
  _title text;
  _body text;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Lock the row so two people resolving at the same moment are serialised:
  -- the second one sees the first one's result.
  SELECT status, resolved_by, assigned_to
    INTO _cur, _resolver, _assignee
    FROM public.support_tickets
    WHERE id = _ticket_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;

  IF _status = 'resolved' AND _cur = 'resolved' THEN
    RAISE EXCEPTION 'Already resolved by %', COALESCE(public.ticket_staff_name(_resolver), 'another agent');
  END IF;
  IF _status = 'resolved' AND _cur = 'closed' THEN
    RAISE EXCEPTION 'This ticket is already closed';
  END IF;
  IF _status = _cur THEN
    RETURN; -- nothing changed: no update, no duplicate notification
  END IF;

  UPDATE public.support_tickets
    SET status = _status,
        resolution_notes = CASE
          WHEN _status = 'resolved' AND _notes IS NOT NULL AND length(trim(_notes)) > 0 THEN _notes
          WHEN _status IN ('open','assigned','in_progress') THEN NULL
          ELSE resolution_notes END,
        resolved_by = CASE
          WHEN _status = 'resolved' THEN _uid
          WHEN _status IN ('open','assigned','in_progress') THEN NULL
          ELSE resolved_by END,
        resolved_at = CASE
          WHEN _status = 'resolved' THEN now()
          WHEN _status IN ('open','assigned','in_progress') THEN NULL
          ELSE resolved_at END,
        closed_at = CASE
          WHEN _status = 'closed' THEN now()
          WHEN _status IN ('open','assigned','in_progress') THEN NULL
          ELSE closed_at END,
        updated_at = now()
    WHERE id = _ticket_id
    RETURNING user_id, ticket_number, role_at_creation INTO _creator, _num, _role;

  -- Let the assigned agent know if someone else closed out their ticket.
  IF _status IN ('resolved','closed') AND _assignee IS NOT NULL AND _assignee <> _uid THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_assignee, 'Ticket ' || _status::text,
      'Ticket ' || COALESCE(_num,'') || ' was ' || _status::text || ' by '
        || COALESCE(public.ticket_staff_name(_uid), 'another agent') || '.',
      'support',
      jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/tickets/' || _ticket_id));
  END IF;

  IF _creator IS NULL THEN RETURN; END IF;

  IF _status = 'resolved' THEN
    _title := 'Complaint resolved';
    IF _role = 'customer' THEN
      _body := 'Your complaint ' || COALESCE(_num,'') || ' has been resolved. Please check the Help & Support section for details.';
    ELSIF _role = 'shopkeeper' THEN
      _body := 'Your support request ' || COALESCE(_num,'') || ' has been resolved. Please check the Support Center for details.';
    ELSIF _role = 'delivery' THEN
      _body := 'Your complaint ' || COALESCE(_num,'') || ' has been resolved. Please check the Support Center for details.';
    ELSE
      _body := 'Your ticket ' || COALESCE(_num,'') || ' has been resolved.';
    END IF;
  ELSIF _status = 'closed' THEN
    _title := 'Ticket closed';
    _body := 'Your ticket ' || COALESCE(_num,'') || ' has been closed.';
  ELSIF _status = 'in_progress' THEN
    _title := 'Ticket update';
    _body := 'Your ticket ' || COALESCE(_num,'') || ' is now in progress.';
  ELSIF _status = 'open' AND _cur IN ('resolved','closed') THEN
    _title := 'Ticket reopened';
    _body := 'Your ticket ' || COALESCE(_num,'') || ' has been reopened. We are looking into it again.';
  ELSE
    _title := 'Ticket ' || _status::text;
    _body := 'Your ticket ' || COALESCE(_num,'') || ' is now ' || replace(_status::text, '_', ' ') || '.';
  END IF;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_creator, _title, _body, 'support',
    jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
END $function$;
