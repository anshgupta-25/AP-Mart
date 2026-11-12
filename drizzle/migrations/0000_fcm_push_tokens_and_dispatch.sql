-- 1. FCM device tokens
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fcm_tokens_own_all ON public.fcm_tokens;
CREATE POLICY fcm_tokens_own_all ON public.fcm_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON public.fcm_tokens(user_id);

-- 2. Dispatch a notification row to FCM via the app's secure server route
CREATE OR REPLACE FUNCTION public.send_fcm_push(_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _n record;
  _prefs record;
  _base_url text;
  _secret text;
  _tokens text[];
  _req_id bigint;
BEGIN
  SELECT * INTO _n FROM public.notifications WHERE id = _notification_id;
  IF _n IS NULL THEN RETURN; END IF;

  SELECT * INTO _prefs FROM public.notification_preferences WHERE user_id = _n.user_id;
  IF _prefs.user_id IS NOT NULL AND _prefs.push_enabled = false THEN RETURN; END IF;

  SELECT value INTO _base_url FROM public.app_config WHERE key = 'app_base_url';
  SELECT value INTO _secret   FROM public.app_config WHERE key = 'fcm_dispatch_secret';
  IF _base_url IS NULL OR _secret IS NULL THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'skipped', 'FCM dispatch config missing (app_base_url / fcm_dispatch_secret)');
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT token) INTO _tokens
  FROM public.fcm_tokens WHERE user_id = _n.user_id;

  IF _tokens IS NULL OR array_length(_tokens, 1) IS NULL THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'no_subscribers', 'User has no FCM tokens');
    RETURN;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := rtrim(_base_url, '/') || '/api/public/fcm-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', _secret
      ),
      body := jsonb_build_object('notification_id', _n.id)
    ) INTO _req_id;

    INSERT INTO public.notification_dispatch_log(notification_id, user_id, request_id, status)
    VALUES (_notification_id, _n.user_id, _req_id, 'sent');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'error', SQLERRM);
  END;
END $$;

REVOKE ALL ON FUNCTION public.send_fcm_push(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_fcm_push(uuid) TO service_role;

-- 3. Repoint the notifications trigger from OneSignal to FCM
CREATE OR REPLACE FUNCTION public.trg_notifications_dispatch_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.send_fcm_push(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (NEW.id, NEW.user_id, 'trigger_error', SQLERRM);
  END;
  RETURN NEW;
END $$;

-- 4. Config placeholders (no secrets committed; values set by admin)
INSERT INTO public.app_config(key, value)
VALUES ('fcm_dispatch_secret', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (key) DO NOTHING;
