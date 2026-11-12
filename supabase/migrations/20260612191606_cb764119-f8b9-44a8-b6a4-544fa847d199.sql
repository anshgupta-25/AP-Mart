DROP POLICY IF EXISTS sda_partner_read ON public.shop_delivery_assignments;
CREATE POLICY sda_partner_read ON public.shop_delivery_assignments
FOR SELECT TO authenticated
USING (delivery_partner_id = public.current_user_partner_id());