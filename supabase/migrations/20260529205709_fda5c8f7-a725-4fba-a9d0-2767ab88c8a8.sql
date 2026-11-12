
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'shopkeeper';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_shop';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'accepted_by_shop';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'packed';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'no_shop_available';
