
-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. app_config (stores OneSignal app id; REST key stays as vault secret used by edge / cannot be read here, so we use a Postgres setting via service role)
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_config_admin_all ON public.app_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed OneSignal app id (publishable; safe in DB)
-- NOTE: the OneSignal REST API key is a secret and is intentionally NOT stored in this file.
-- Set it after migrating:  INSERT INTO public.app_config (key, value) VALUES ('onesignal_rest_api_key', '<key>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
INSERT INTO public.app_config (key, value) VALUES
  ('onesignal_app_id', '0179c4bc-1662-45b2-8be2-0826d8f3dc2b')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 3. onesignal_subscriptions
CREATE TABLE IF NOT EXISTS public.onesignal_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  player_id text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_onesignal_subs_user ON public.onesignal_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onesignal_subscriptions TO authenticated;
GRANT ALL ON public.onesignal_subscriptions TO service_role;
ALTER TABLE public.onesignal_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_subs_self_all ON public.onesignal_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  push_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  order_updates boolean NOT NULL DEFAULT true,
  promotions boolean NOT NULL DEFAULT true,
  inventory_alerts boolean NOT NULL DEFAULT true,
  system_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_prefs_self_all ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. notification_dispatch_log (for retry / debug)
CREATE TABLE IF NOT EXISTS public.notification_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  user_id uuid,
  request_id bigint,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 1,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_status ON public.notification_dispatch_log(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_user ON public.notification_dispatch_log(user_id);
GRANT SELECT ON public.notification_dispatch_log TO authenticated;
GRANT ALL ON public.notification_dispatch_log TO service_role;
ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY dispatch_log_admin_select ON public.notification_dispatch_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- 6. Add category column to notifications for routing/filters
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 7. Dispatch function: send push via pg_net to OneSignal
CREATE OR REPLACE FUNCTION public.send_onesignal_push(_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _n record;
  _app_id text;
  _api_key text;
  _player_ids text[];
  _req_id bigint;
  _prefs record;
BEGIN
  SELECT * INTO _n FROM public.notifications WHERE id = _notification_id;
  IF _n IS NULL THEN RETURN; END IF;

  -- Check user preferences
  SELECT * INTO _prefs FROM public.notification_preferences WHERE user_id = _n.user_id;
  IF _prefs.user_id IS NOT NULL AND _prefs.push_enabled = false THEN RETURN; END IF;

  SELECT value INTO _app_id  FROM public.app_config WHERE key = 'onesignal_app_id';
  SELECT value INTO _api_key FROM public.app_config WHERE key = 'onesignal_rest_api_key';
  IF _app_id IS NULL OR _api_key IS NULL THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'skipped', 'OneSignal config missing');
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT player_id) INTO _player_ids
  FROM public.onesignal_subscriptions WHERE user_id = _n.user_id;

  IF _player_ids IS NULL OR array_length(_player_ids, 1) IS NULL THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'no_subscribers', 'User has no OneSignal subscriptions');
    RETURN;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := 'https://api.onesignal.com/notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Basic ' || _api_key
      ),
      body := jsonb_build_object(
        'app_id', _app_id,
        'include_player_ids', to_jsonb(_player_ids),
        'headings', jsonb_build_object('en', _n.title),
        'contents', jsonb_build_object('en', COALESCE(_n.body, '')),
        'data', jsonb_build_object(
          'notification_id', _n.id,
          'category', _n.category,
          'payload', _n.data
        ),
        'web_url', COALESCE(_n.data->>'url', NULL)
      )
    ) INTO _req_id;

    INSERT INTO public.notification_dispatch_log(notification_id, user_id, request_id, status)
    VALUES (_notification_id, _n.user_id, _req_id, 'sent');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'error', SQLERRM);
  END;
END $$;

-- 8. Trigger on notifications insert -> dispatch push (fire-and-forget, never blocks)
CREATE OR REPLACE FUNCTION public.trg_notifications_dispatch_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.send_onesignal_push(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Never block the insert
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (NEW.id, NEW.user_id, 'trigger_error', SQLERRM);
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notifications_dispatch_push ON public.notifications;
CREATE TRIGGER notifications_dispatch_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_notifications_dispatch_push();

-- 9. Helper: notify_user — convenience to create a notification (which then fires push)
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _title text, _body text, _category text DEFAULT 'general', _data jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, category, data)
  VALUES (_user_id, _title, _body, _category, _data)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 10. Helper: notify_role — fan-out by role (admin, shopkeeper, delivery)
CREATE OR REPLACE FUNCTION public.notify_role(
  _role app_role, _title text, _body text, _category text DEFAULT 'general', _data jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer := 0; r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = _role LOOP
    INSERT INTO public.notifications (user_id, title, body, category, data)
    VALUES (r.user_id, _title, _body, _category, _data);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- 11. Enable realtime on notifications (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- 12. Updated_at trigger for prefs
DROP TRIGGER IF EXISTS notif_prefs_updated ON public.notification_preferences;
CREATE TRIGGER notif_prefs_updated BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
