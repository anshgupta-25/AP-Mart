CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON public.orders (placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_products_shop_created ON public.shop_products (shop_id, created_at DESC);

DELETE FROM public.notifications WHERE read = true AND created_at < now() - interval '30 days';

CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.notifications
  WHERE (read = true AND created_at < now() - interval '30 days')
     OR created_at < now() - interval '90 days';
$$;

REVOKE ALL ON FUNCTION public.purge_old_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_notifications() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-old-notifications')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-notifications');
    PERFORM cron.schedule('purge-old-notifications', '17 3 * * *', 'SELECT public.purge_old_notifications();');
  END IF;
END $$;

ANALYZE public.notifications;