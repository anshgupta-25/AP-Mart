
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS initial_stock integer,
  ADD COLUMN IF NOT EXISTS expiry_date date;

UPDATE public.shop_products SET initial_stock = stock WHERE initial_stock IS NULL;
