
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, payment_method, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_order_status(uuid, order_status) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid, text) FROM anon, public;
