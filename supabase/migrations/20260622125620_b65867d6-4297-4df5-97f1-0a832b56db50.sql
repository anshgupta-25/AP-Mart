
-- Notify shop owner whenever an order is assigned to their shop (awaiting_shop)
CREATE OR REPLACE FUNCTION public.notify_shop_owner_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  -- Only fire when the order is awaiting a shop AND a shop is set
  IF NEW.shop_id IS NULL OR NEW.status <> 'awaiting_shop'::order_status THEN
    RETURN NEW;
  END IF;

  -- On INSERT: always notify. On UPDATE: only when shop_id changed
  IF TG_OP = 'UPDATE' AND NEW.shop_id IS NOT DISTINCT FROM OLD.shop_id THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO _owner FROM public.shops WHERE id = NEW.shop_id;
  IF _owner IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, category, data)
  VALUES (
    _owner,
    'New order received',
    'Order ' || COALESCE(NEW.order_number, '') || ' is waiting for your acceptance.',
    'order',
    jsonb_build_object(
      'order_id', NEW.id,
      'url', '/shopkeeper/orders/' || NEW.id,
      'order_number', NEW.order_number
    )
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_shop_owner_on_assignment_ins ON public.orders;
CREATE TRIGGER trg_notify_shop_owner_on_assignment_ins
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_shop_owner_on_assignment();

DROP TRIGGER IF EXISTS trg_notify_shop_owner_on_assignment_upd ON public.orders;
CREATE TRIGGER trg_notify_shop_owner_on_assignment_upd
AFTER UPDATE OF shop_id, status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_shop_owner_on_assignment();
