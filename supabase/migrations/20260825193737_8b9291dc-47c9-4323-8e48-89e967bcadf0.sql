CREATE OR REPLACE FUNCTION public.add_to_cart(
  p_product_id uuid,
  p_qty integer DEFAULT 1,
  p_variant_id uuid DEFAULT NULL,
  p_shop_id uuid DEFAULT NULL
)
RETURNS public.cart_items
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.cart_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  INSERT INTO public.cart_items (user_id, product_id, variant_id, shop_id, quantity)
  VALUES (auth.uid(), p_product_id, p_variant_id, p_shop_id, p_qty)
  ON CONFLICT (user_id, product_id)
  DO UPDATE SET
    quantity = cart_items.quantity + EXCLUDED.quantity,
    variant_id = EXCLUDED.variant_id,
    shop_id = EXCLUDED.shop_id,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_to_cart(uuid, integer, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_to_cart(uuid, integer, uuid, uuid) TO authenticated;