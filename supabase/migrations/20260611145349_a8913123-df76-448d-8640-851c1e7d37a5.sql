
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes text;

CREATE OR REPLACE FUNCTION public.update_ticket_status(_ticket_id uuid, _status ticket_status, _notes text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _creator uuid;
  _num text;
  _role text;
  _title text;
  _body text;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.support_tickets
    SET status = _status,
        resolution_notes = CASE WHEN _status = 'resolved' AND _notes IS NOT NULL AND length(trim(_notes)) > 0 THEN _notes ELSE resolution_notes END,
        resolved_by = CASE WHEN _status = 'resolved' THEN COALESCE(resolved_by, _uid) ELSE resolved_by END,
        resolved_at = CASE WHEN _status = 'resolved' THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
        closed_at = CASE WHEN _status = 'closed' THEN COALESCE(closed_at, now()) ELSE closed_at END,
        updated_at = now()
    WHERE id = _ticket_id
    RETURNING user_id, ticket_number, role_at_creation INTO _creator, _num, _role;

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
  ELSE
    _title := 'Ticket ' || _status::text;
    _body := 'Your ticket ' || COALESCE(_num,'') || ' is now ' || _status::text || '.';
  END IF;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_creator, _title, _body, 'support',
    jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
END $function$;
