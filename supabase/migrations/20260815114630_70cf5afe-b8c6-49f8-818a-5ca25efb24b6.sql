-- Preserve historical orders when their shop is removed (detach, never delete/restatus)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_shop_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_shop_id_fkey
  FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.admin_delete_shop(_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _active_orders int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Only these order_status values are terminal in FlashBasket.
  SELECT COUNT(*) INTO _active_orders
    FROM public.orders
   WHERE shop_id = _shop_id
     AND status NOT IN ('delivered'::order_status, 'cancelled'::order_status, 'no_shop_available'::order_status);

  IF _active_orders > 0 THEN
    RAISE EXCEPTION 'Cannot delete this shop because it has active orders.';
  END IF;

  -- Shop-scoped merchandising data
  DELETE FROM public.shop_collection_items
    WHERE collection_id IN (SELECT id FROM public.shop_collections WHERE shop_id = _shop_id);
  DELETE FROM public.shop_collections WHERE shop_id = _shop_id;
  DELETE FROM public.shop_category_items
    WHERE category_id IN (SELECT id FROM public.shop_categories WHERE shop_id = _shop_id);
  DELETE FROM public.shop_categories WHERE shop_id = _shop_id;
  DELETE FROM public.offers WHERE shop_id = _shop_id;
  DELETE FROM public.shop_delivery_assignments WHERE shop_id = _shop_id;

  -- Detach riders and staff, then drop this shop's inventory (master catalog untouched)
  UPDATE public.delivery_partners SET shop_id = NULL, updated_at = now() WHERE shop_id = _shop_id;
  UPDATE public.profiles SET shop_id = NULL, updated_at = now() WHERE shop_id = _shop_id;
  DELETE FROM public.shop_products WHERE shop_id = _shop_id;

  DELETE FROM public.shops WHERE id = _shop_id;
END; $function$;

REVOKE ALL ON FUNCTION public.admin_delete_shop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_shop(uuid) TO authenticated, service_role;