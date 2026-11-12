
-- Break the RLS recursion between orders <-> delivery_partners
-- by routing cross-table lookups through SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.current_user_partner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.delivery_partners WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_owns_shop_for_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = _order_id AND s.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.partner_is_on_order(_partner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.partner_id = _partner_id
      AND o.status IN ('packed'::order_status,'out_for_delivery'::order_status,'delivered'::order_status)
      AND (
        o.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_partner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_shop_for_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_is_on_order(uuid) TO authenticated;

-- Rewrite orders SELECT policy without referencing delivery_partners directly
DROP POLICY IF EXISTS orders_shop_select ON public.orders;
CREATE POLICY orders_shop_select ON public.orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id AND s.owner_id = auth.uid())
  OR (status = 'packed'::order_status AND partner_id IS NULL AND public.current_user_partner_id() IS NOT NULL)
  OR partner_id = public.current_user_partner_id()
);

-- Rewrite delivery_partners SELECT policy without referencing orders directly
DROP POLICY IF EXISTS dp_scoped_read ON public.delivery_partners;
CREATE POLICY dp_scoped_read ON public.delivery_partners
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.partner_is_on_order(id)
);
