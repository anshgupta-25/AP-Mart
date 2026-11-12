-- Restrict sensitive shop columns from anonymous visitors
REVOKE SELECT (phone) ON public.shops FROM anon;

-- Restrict sensitive coupon columns from anonymous visitors
REVOKE SELECT (times_used, usage_limit, max_discount, value, min_order) ON public.coupons FROM anon;
