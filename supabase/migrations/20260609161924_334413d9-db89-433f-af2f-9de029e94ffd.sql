
-- Enums
DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM (
    'order_issue','payment_issue','refund_issue','delivery_issue',
    'product_issue','shop_issue','account_issue','technical_issue'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open','assigned','in_progress','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('low','normal','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1000;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE DEFAULT ('TCK-' || nextval('support_ticket_seq')::text),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_at_creation text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category ticket_category NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'normal',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  body text NOT NULL,
  is_internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_messages(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  mime text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ticket_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.ticket_assignments TO authenticated;
GRANT ALL ON public.ticket_assignments TO service_role;
ALTER TABLE public.ticket_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.support_agents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  max_concurrent integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_agents TO authenticated;
GRANT ALL ON public.support_agents TO service_role;
ALTER TABLE public.support_agents ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_support_tickets_updated ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_support_agents_updated ON public.support_agents;
CREATE TRIGGER trg_support_agents_updated BEFORE UPDATE ON public.support_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
DROP POLICY IF EXISTS "tickets_select_own_or_support" ON public.support_tickets;
CREATE POLICY "tickets_select_own_or_support" ON public.support_tickets FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR has_role(auth.uid(),'support'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
  );
DROP POLICY IF EXISTS "tickets_insert_own" ON public.support_tickets;
CREATE POLICY "tickets_insert_own" ON public.support_tickets FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "tickets_update_support" ON public.support_tickets;
CREATE POLICY "tickets_update_support" ON public.support_tickets FOR UPDATE
  TO authenticated USING (
    has_role(auth.uid(),'support'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );

DROP POLICY IF EXISTS "messages_select" ON public.support_messages;
CREATE POLICY "messages_select" ON public.support_messages FOR SELECT
  TO authenticated USING (
    (
      EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
      AND is_internal_note = false
    )
    OR has_role(auth.uid(),'support'::app_role)
    OR has_role(auth.uid(),'admin'::app_role)
  );
DROP POLICY IF EXISTS "messages_insert" ON public.support_messages;
CREATE POLICY "messages_insert" ON public.support_messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
      OR has_role(auth.uid(),'support'::app_role)
      OR has_role(auth.uid(),'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "att_select" ON public.ticket_attachments;
CREATE POLICY "att_select" ON public.ticket_attachments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    OR has_role(auth.uid(),'support'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );
DROP POLICY IF EXISTS "att_insert" ON public.ticket_attachments;
CREATE POLICY "att_insert" ON public.ticket_attachments FOR INSERT
  TO authenticated WITH CHECK (
    uploaded_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
      OR has_role(auth.uid(),'support'::app_role) OR has_role(auth.uid(),'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "assign_all_support" ON public.ticket_assignments;
CREATE POLICY "assign_all_support" ON public.ticket_assignments FOR ALL
  TO authenticated USING (
    has_role(auth.uid(),'support'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  ) WITH CHECK (
    has_role(auth.uid(),'support'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );

DROP POLICY IF EXISTS "agents_select" ON public.support_agents;
CREATE POLICY "agents_select" ON public.support_agents FOR SELECT
  TO authenticated USING (
    has_role(auth.uid(),'support'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  );
DROP POLICY IF EXISTS "agents_manage_admin" ON public.support_agents;
CREATE POLICY "agents_manage_admin" ON public.support_agents FOR ALL
  TO authenticated USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- Functions
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  _title text, _description text, _category ticket_category,
  _order_id uuid DEFAULT NULL, _shop_id uuid DEFAULT NULL, _partner_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _role text; r record;
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
  RETURNING id INTO _id;

  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'support'::app_role LOOP
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (r.user_id, 'New support ticket', _title, 'support',
      jsonb_build_object('ticket_id', _id, 'url', '/support/tickets/' || _id));
  END LOOP;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_uid, 'Ticket created', 'We received your support request and will respond shortly.', 'support',
    jsonb_build_object('ticket_id', _id, 'url', '/support/ticket/' || _id));

  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.assign_ticket(_ticket_id uuid, _agent_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _creator uuid; _num text;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT has_role(_agent_id,'support'::app_role) THEN
    RAISE EXCEPTION 'Target user is not a support agent';
  END IF;

  UPDATE public.ticket_assignments SET unassigned_at = now()
    WHERE ticket_id = _ticket_id AND unassigned_at IS NULL;
  INSERT INTO public.ticket_assignments(ticket_id, assigned_to, assigned_by)
    VALUES (_ticket_id, _agent_id, _uid);

  UPDATE public.support_tickets
    SET assigned_to = _agent_id,
        status = CASE WHEN status = 'open' THEN 'assigned'::ticket_status ELSE status END,
        updated_at = now()
    WHERE id = _ticket_id
    RETURNING user_id, ticket_number INTO _creator, _num;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_agent_id, 'Ticket assigned', 'Ticket ' || COALESCE(_num,'') || ' has been assigned to you.', 'support',
    jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/tickets/' || _ticket_id));

  IF _creator IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_creator, 'Ticket assigned', 'A support executive is now handling your ticket.', 'support',
      jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_ticket_status(_ticket_id uuid, _status ticket_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _creator uuid; _num text;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.support_tickets
    SET status = _status,
        resolved_at = CASE WHEN _status = 'resolved' THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
        closed_at = CASE WHEN _status = 'closed' THEN COALESCE(closed_at, now()) ELSE closed_at END,
        updated_at = now()
    WHERE id = _ticket_id
    RETURNING user_id, ticket_number INTO _creator, _num;
  IF _creator IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_creator, 'Ticket ' || _status::text, 'Your ticket ' || COALESCE(_num,'') || ' is now ' || _status::text || '.', 'support',
      jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.post_ticket_message(_ticket_id uuid, _body text, _is_internal boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _role text; _is_support boolean; _id uuid;
        _creator uuid; _assignee uuid; _num text; _t record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'Empty message'; END IF;

  SELECT * INTO _t FROM public.support_tickets WHERE id = _ticket_id;
  IF _t IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;

  _is_support := has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role);
  IF NOT _is_support AND _t.user_id <> _uid THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _is_internal AND NOT _is_support THEN RAISE EXCEPTION 'Only support can post internal notes'; END IF;

  _role := CASE WHEN _is_support THEN 'support' ELSE _t.role_at_creation END;

  INSERT INTO public.support_messages(ticket_id, sender_id, sender_role, body, is_internal_note)
  VALUES (_ticket_id, _uid, _role, _body, COALESCE(_is_internal,false))
  RETURNING id INTO _id;

  IF _is_support AND NOT _is_internal AND _t.first_response_at IS NULL THEN
    UPDATE public.support_tickets SET first_response_at = now(), updated_at = now() WHERE id = _ticket_id;
  END IF;

  IF NOT _is_internal THEN
    _creator := _t.user_id; _assignee := _t.assigned_to; _num := _t.ticket_number;
    IF _is_support THEN
      IF _creator IS NOT NULL AND _creator <> _uid THEN
        INSERT INTO public.notifications(user_id, title, body, category, data)
        VALUES (_creator, 'Support replied', left(_body, 120), 'support',
          jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
      END IF;
    ELSE
      IF _assignee IS NOT NULL AND _assignee <> _uid THEN
        INSERT INTO public.notifications(user_id, title, body, category, data)
        VALUES (_assignee, 'New reply on ' || COALESCE(_num,''), left(_body, 120), 'support',
          jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/tickets/' || _ticket_id));
      END IF;
    END IF;
  END IF;

  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_support_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb; _agents jsonb;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'open', COUNT(*) FILTER (WHERE status IN ('open','assigned','in_progress')),
    'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
    'closed', COUNT(*) FILTER (WHERE status = 'closed'),
    'avg_resolution_minutes', COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60.0)
       FILTER (WHERE resolved_at IS NOT NULL), 0)::numeric
  ) INTO _out FROM public.support_tickets;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', a.user_id,
    'display_name', COALESCE(a.display_name, p.full_name, 'Agent'),
    'is_active', a.is_active,
    'assigned', COALESCE(x.assigned,0),
    'resolved', COALESCE(x.resolved,0),
    'avg_minutes', COALESCE(x.avg_minutes,0)
  )), '[]'::jsonb)
  INTO _agents
  FROM public.support_agents a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed')) AS assigned,
           COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
           COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60.0)
             FILTER (WHERE resolved_at IS NOT NULL),0)::numeric AS avg_minutes
    FROM public.support_tickets t WHERE t.assigned_to = a.user_id
  ) x ON true;

  RETURN _out || jsonb_build_object('agents', _agents);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_support_agent(_user_email text, _is_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _target uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO _target FROM auth.users WHERE lower(email) = lower(trim(_user_email));
  IF _target IS NULL THEN RAISE EXCEPTION 'No user with email %', _user_email; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_target,'support'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.support_agents(user_id, is_active) VALUES (_target, _is_active)
    ON CONFLICT (user_id) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();
  RETURN _target;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_support_agent(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'support'::app_role;
  DELETE FROM public.support_agents WHERE user_id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.support_ticket_context(_ticket_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _t record; _out jsonb;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO _t FROM public.support_tickets WHERE id = _ticket_id;
  IF _t IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;

  _out := jsonb_build_object(
    'ticket', to_jsonb(_t),
    'creator', (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'phone', p.phone, 'email', u.email, 'created_at', p.created_at)
                FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE p.id = _t.user_id),
    'addresses', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.addresses a WHERE a.user_id = _t.user_id), '[]'::jsonb),
    'recent_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total,'placed_at',o.placed_at))
                  FROM (SELECT * FROM public.orders WHERE user_id = _t.user_id ORDER BY placed_at DESC LIMIT 10) o), '[]'::jsonb),
    'current_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total))
                  FROM public.orders o WHERE o.user_id = _t.user_id
                    AND o.status NOT IN ('delivered'::order_status,'cancelled'::order_status)), '[]'::jsonb),
    'referenced_order', (SELECT to_jsonb(o) FROM public.orders o WHERE o.id = _t.order_id),
    'shop', (SELECT jsonb_build_object('shop',to_jsonb(s),'owner',to_jsonb(p),'product_count',
                  (SELECT COUNT(*) FROM public.shop_products sp WHERE sp.shop_id = s.id),
                  'recent_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total))
                    FROM (SELECT * FROM public.orders WHERE shop_id = s.id ORDER BY placed_at DESC LIMIT 10) o), '[]'::jsonb))
              FROM public.shops s LEFT JOIN public.profiles p ON p.id = s.owner_id
              WHERE s.id = COALESCE(_t.shop_id, (SELECT shop_id FROM public.orders WHERE id = _t.order_id))
                 OR s.owner_id = _t.user_id
              LIMIT 1),
    'partner', (SELECT jsonb_build_object('partner', to_jsonb(dp),
                  'assigned_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total))
                    FROM public.orders o WHERE o.partner_id = dp.id
                      AND o.status IN ('packed'::order_status,'out_for_delivery'::order_status)), '[]'::jsonb))
              FROM public.delivery_partners dp
              WHERE dp.id = _t.partner_id OR dp.user_id = _t.user_id
              LIMIT 1),
    'attachments', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.ticket_attachments a WHERE a.ticket_id = _t.id), '[]'::jsonb)
  );
  RETURN _out;
END $$;

-- Storage policies
DROP POLICY IF EXISTS "support_att_select" ON storage.objects;
CREATE POLICY "support_att_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'support-attachments' AND (
  owner = auth.uid()
  OR has_role(auth.uid(),'support'::app_role)
  OR has_role(auth.uid(),'admin'::app_role)
));
DROP POLICY IF EXISTS "support_att_insert" ON storage.objects;
CREATE POLICY "support_att_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-attachments' AND owner = auth.uid());
DROP POLICY IF EXISTS "support_att_delete" ON storage.objects;
CREATE POLICY "support_att_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'support-attachments' AND (
  owner = auth.uid() OR has_role(auth.uid(),'admin'::app_role)
));
