-- ============================================================================
-- AP MART — COMPLETE DATABASE SCHEMA EXPORT
-- Run this file FIRST in your own Supabase project's SQL Editor.
-- Safe to re-run: CREATE ... IF NOT EXISTS / OR REPLACE / DROP IF EXISTS used throughout.
-- Nothing is deleted or overwritten.
-- ============================================================================

-- ---------- 1. Extensions ----------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_net";
-- NOTE: enable pg_cron from Dashboard -> Database -> Extensions if you want the scheduled jobs at the end of this file.

-- ---------- 2. Enum types ----------
DO $$ BEGIN
    CREATE TYPE address_type AS ENUM ('home', 'work', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'customer', 'shopkeeper', 'delivery', 'support', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE coupon_type AS ENUM ('percent', 'flat');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE offer_scope AS ENUM ('global', 'shop');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('placed', 'payment_confirmed', 'packing', 'out_for_delivery', 'delivered', 'cancelled', 'awaiting_shop', 'accepted_by_shop', 'packed', 'no_shop_available');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('razorpay', 'cod');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refund_initiated', 'refunded', 'cod');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE ticket_category AS ENUM ('order_issue', 'payment_issue', 'refund_issue', 'delivery_issue', 'product_issue', 'shop_issue', 'account_issue', 'technical_issue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- 3. Sequences ----------
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq;

-- ---------- 4. Tables ----------
CREATE TABLE IF NOT EXISTS public."addresses" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    line1 text NOT NULL,
    line2 text,
    landmark text,
    city text NOT NULL,
    state text NOT NULL,
    pincode text NOT NULL,
    type address_type NOT NULL DEFAULT 'home'::address_type,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    lat double precision,
    lng double precision,
    house_no text,
    building text,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."app_config" (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public."cart_items" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    variant_id uuid,
    shop_id uuid,
    CHECK ((quantity > 0)),
    PRIMARY KEY (id),
    UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public."categories" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    icon text,
    color text,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    image_url text,
    is_active boolean NOT NULL DEFAULT true,
    is_featured boolean NOT NULL DEFAULT false,
    PRIMARY KEY (id),
    UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public."collections" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    image_url text,
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public."coupons" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    description text,
    type coupon_type NOT NULL,
    value numeric(10,2) NOT NULL,
    min_order numeric(10,2) NOT NULL DEFAULT 0,
    max_discount numeric(10,2),
    expires_at timestamp with time zone,
    usage_limit integer,
    times_used integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public."delivery_messages" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    delivery_partner_id uuid NOT NULL,
    kind text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."delivery_partners" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    vehicle text,
    is_online boolean NOT NULL DEFAULT false,
    current_lat double precision,
    current_lng double precision,
    rating numeric NOT NULL DEFAULT 4.8,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    shop_id uuid,
    availability_status text NOT NULL DEFAULT 'available'::text,
    active_order_count integer NOT NULL DEFAULT 0,
    current_order_id uuid,
    eta_minutes integer,
    status_updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public."delivery_zone_settings" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    state text NOT NULL,
    city text NOT NULL,
    pin_code text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    delivery_radius_km numeric NOT NULL DEFAULT 10,
    standard_enabled boolean NOT NULL DEFAULT true,
    standard_fee numeric NOT NULL DEFAULT 0,
    standard_eta_minutes text NOT NULL DEFAULT '45-60'::text,
    minimum_order_standard numeric,
    fast_enabled boolean NOT NULL DEFAULT false,
    fast_fee numeric NOT NULL DEFAULT 49,
    fast_eta_minutes text NOT NULL DEFAULT '20-30'::text,
    minimum_order_fast numeric,
    express_enabled boolean NOT NULL DEFAULT false,
    express_fee numeric NOT NULL DEFAULT 99,
    express_eta_minutes text NOT NULL DEFAULT '10-15'::text,
    minimum_order_express numeric,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    handling_enabled boolean NOT NULL DEFAULT false,
    handling_type text NOT NULL DEFAULT 'fixed'::text,
    default_handling_fee numeric NOT NULL DEFAULT 0,
    handling_percentage numeric NOT NULL DEFAULT 0,
    free_handling_above numeric,
    standard_handling_fee numeric,
    fast_handling_fee numeric,
    express_handling_fee numeric,
    CHECK ((handling_type = ANY (ARRAY['fixed'::text, 'percent'::text]))),
    PRIMARY KEY (id),
    UNIQUE (pin_code)
);

CREATE TABLE IF NOT EXISTS public."inventory_reservations" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    parent_order_id uuid NOT NULL,
    child_order_id uuid,
    shop_product_id uuid NOT NULL,
    quantity integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    released boolean NOT NULL DEFAULT false,
    released_reason text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CHECK ((quantity > 0)),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."locations" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    state text NOT NULL,
    city text NOT NULL,
    pincode text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CHECK ((pincode ~ '^[0-9]{6}$'::text)),
    PRIMARY KEY (id),
    UNIQUE (state, city, pincode)
);

CREATE TABLE IF NOT EXISTS public."notification_dispatch_log" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    notification_id uuid,
    user_id uuid,
    request_id bigint,
    status text NOT NULL DEFAULT 'queued'::text,
    attempts integer NOT NULL DEFAULT 1,
    error text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."notification_preferences" (
    user_id uuid NOT NULL,
    push_enabled boolean NOT NULL DEFAULT true,
    in_app_enabled boolean NOT NULL DEFAULT true,
    email_enabled boolean NOT NULL DEFAULT false,
    order_updates boolean NOT NULL DEFAULT true,
    promotions boolean NOT NULL DEFAULT true,
    inventory_alerts boolean NOT NULL DEFAULT true,
    system_alerts boolean NOT NULL DEFAULT true,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public."notifications" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    body text,
    read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    category text NOT NULL DEFAULT 'general'::text,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."offers" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text NOT NULL,
    subtitle text,
    image_url text NOT NULL,
    link_url text,
    badge text,
    scope offer_scope NOT NULL DEFAULT 'global'::offer_scope,
    shop_id uuid,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CHECK ((((scope = 'global'::offer_scope) AND (shop_id IS NULL)) OR ((scope = 'shop'::offer_scope) AND (shop_id IS NOT NULL)))),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."onesignal_subscriptions" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    player_id text NOT NULL,
    platform text NOT NULL DEFAULT 'web'::text,
    user_agent text,
    last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, player_id)
);

CREATE TABLE IF NOT EXISTS public."order_audit_log" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    actor_id uuid,
    actor_role text,
    event_type text NOT NULL,
    from_value text,
    to_value text,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."order_items" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    product_id uuid,
    name text NOT NULL,
    image_url text,
    unit text,
    price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    variant_id uuid,
    variant_label text,
    child_order_id uuid,
    shop_id uuid,
    shop_product_id uuid,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."order_routing_log" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    order_id uuid,
    pincode text,
    delivery_lat double precision,
    delivery_lng double precision,
    candidates_considered integer NOT NULL DEFAULT 0,
    chosen_shop_id uuid,
    chosen_distance_km numeric,
    outcome text NOT NULL,
    reason text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."orders" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    order_number text NOT NULL DEFAULT (('FB'::text || to_char(now(), 'YYMMDD'::text)) || lpad((floor((random() * (100000)::double precision)))::text, 5, '0'::text)),
    user_id uuid,
    status order_status NOT NULL DEFAULT 'placed'::order_status,
    payment_status payment_status NOT NULL DEFAULT 'pending'::payment_status,
    payment_method payment_method NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    discount numeric(10,2) NOT NULL DEFAULT 0,
    delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
    handling_fee numeric(10,2) NOT NULL DEFAULT 0,
    tax numeric(10,2) NOT NULL DEFAULT 0,
    total numeric(10,2) NOT NULL,
    coupon_code text,
    address jsonb NOT NULL,
    delivery_instruction text,
    cancel_reason text,
    placed_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    shop_id uuid,
    partner_id uuid,
    assignment_attempts integer NOT NULL DEFAULT 0,
    assignment_expires_at timestamp with time zone,
    rejected_shop_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    delivery_lat double precision,
    delivery_lng double precision,
    paid_at timestamp with time zone,
    delivery_type text NOT NULL DEFAULT 'standard_delivery'::text,
    fast_delivery_fee numeric NOT NULL DEFAULT 0,
    ready_for_pickup_at timestamp with time zone,
    assignment_reason text,
    assignment_distance_km numeric,
    cancelled_at timestamp with time zone,
    delivery_pincode text,
    routing_status text,
    shop_selection_mode text NOT NULL DEFAULT 'auto'::text,
    parent_order_id uuid,
    is_parent boolean NOT NULL DEFAULT false,
    pickup_otp text,
    pickup_verified_at timestamp with time zone,
    prep_time_minutes integer,
    shop_count integer NOT NULL DEFAULT 1,
    pickup_sequence jsonb,
    pickup_route_computed_at timestamp with time zone,
    current_pickup_index integer NOT NULL DEFAULT 0,
    CHECK ((delivery_type = ANY (ARRAY['fast_delivery'::text, 'standard_delivery'::text, 'pickup'::text]))),
    CHECK ((shop_selection_mode = ANY (ARRAY['auto'::text, 'manual'::text]))),
    PRIMARY KEY (id),
    UNIQUE (order_number)
);

CREATE TABLE IF NOT EXISTS public."partner_attendance" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL,
    check_in_at timestamp with time zone NOT NULL DEFAULT now(),
    check_out_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."payments" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    user_id uuid,
    provider text NOT NULL,
    provider_order_id text,
    provider_payment_id text,
    signature text,
    amount numeric(10,2) NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending'::payment_status,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    method text,
    refunded_at timestamp with time zone,
    refund_id text,
    refund_amount numeric,
    error_code text,
    error_description text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."pickup_events" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    parent_order_id uuid NOT NULL,
    child_order_id uuid,
    shop_id uuid,
    actor_user_id uuid,
    event text NOT NULL,
    detail jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."product_categories" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (product_id, category_id)
);

CREATE TABLE IF NOT EXISTS public."product_collections" (
    collection_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_id, product_id)
);

CREATE TABLE IF NOT EXISTS public."product_subcategories" (
    product_id uuid NOT NULL,
    subcategory_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, subcategory_id)
);

CREATE TABLE IF NOT EXISTS public."product_variants" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    name text,
    size text NOT NULL,
    unit text,
    sku text,
    barcode text,
    weight text,
    mrp numeric NOT NULL DEFAULT 0,
    selling_price numeric NOT NULL DEFAULT 0,
    retail_price numeric NOT NULL DEFAULT 0,
    stock integer NOT NULL DEFAULT 0,
    images text[] NOT NULL DEFAULT '{}'::text[],
    is_available boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."products" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    category_id uuid,
    price numeric(10,2) NOT NULL,
    mrp numeric(10,2) NOT NULL,
    unit text NOT NULL DEFAULT '1 pc'::text,
    stock integer NOT NULL DEFAULT 0,
    rating numeric(2,1) NOT NULL DEFAULT 4.2,
    brand text,
    is_available boolean NOT NULL DEFAULT true,
    is_featured boolean NOT NULL DEFAULT false,
    is_bestseller boolean NOT NULL DEFAULT false,
    delivery_minutes integer NOT NULL DEFAULT 12,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    cover_image text,
    image_gallery text[] NOT NULL DEFAULT '{}'::text[],
    name_normalized text,
    subcategory_id uuid,
    PRIMARY KEY (id),
    UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public."profiles" (
    id uuid NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'active'::text,
    address text,
    email text,
    state text,
    city text,
    pincode text,
    is_active boolean NOT NULL DEFAULT true,
    shop_id uuid,
    CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text]))),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."reviews" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CHECK (((rating >= 1) AND (rating <= 5))),
    PRIMARY KEY (id),
    UNIQUE (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS public."role_requests" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    requested_role app_role NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    rejection_reason text,
    submitted_at timestamp with time zone NOT NULL DEFAULT now(),
    decided_at timestamp with time zone,
    decided_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CHECK ((requested_role = ANY (ARRAY['shopkeeper'::app_role, 'delivery'::app_role]))),
    CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."security_audit_log" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    actor_id uuid,
    actor_role text,
    target_user_id uuid,
    event_type text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."shop_assignment_history" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    shop_id uuid,
    status text NOT NULL,
    reason text,
    attempt_number integer NOT NULL DEFAULT 1,
    assigned_at timestamp with time zone NOT NULL DEFAULT now(),
    responded_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."shop_categories" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    shop_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image_url text NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (shop_id, slug)
);

CREATE TABLE IF NOT EXISTS public."shop_category_items" (
    category_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (category_id, product_id)
);

CREATE TABLE IF NOT EXISTS public."shop_collection_items" (
    collection_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_id, product_id)
);

CREATE TABLE IF NOT EXISTS public."shop_collections" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    shop_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."shop_delivery_assignments" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    shop_id uuid NOT NULL,
    delivery_partner_id uuid NOT NULL,
    assigned_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (shop_id, delivery_partner_id)
);

CREATE TABLE IF NOT EXISTS public."shop_products" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    shop_id uuid NOT NULL,
    product_id uuid NOT NULL,
    price numeric NOT NULL,
    stock integer NOT NULL DEFAULT 0,
    is_available boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    initial_stock integer,
    expiry_date date,
    manufacturing_date date,
    retail_price numeric,
    mrp numeric,
    sku text,
    barcode text,
    images text[] NOT NULL DEFAULT '{}'::text[],
    PRIMARY KEY (id),
    UNIQUE (shop_id, product_id)
);

CREATE TABLE IF NOT EXISTS public."shops" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    owner_id uuid,
    name text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    pincode text NOT NULL,
    phone text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    is_open boolean NOT NULL DEFAULT true,
    service_radius_km numeric NOT NULL DEFAULT 8,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    state text,
    status text NOT NULL DEFAULT 'active'::text,
    logo_url text,
    CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text]))),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."subcategories" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image_url text,
    icon text,
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    is_featured boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (category_id, slug)
);

CREATE TABLE IF NOT EXISTS public."support_agents" (
    user_id uuid NOT NULL,
    display_name text,
    is_active boolean NOT NULL DEFAULT true,
    max_concurrent integer NOT NULL DEFAULT 20,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public."support_messages" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_role text NOT NULL,
    body text NOT NULL,
    is_internal_note boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."support_tickets" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ticket_number text NOT NULL DEFAULT ('TCK-'::text || (nextval('support_ticket_seq'::regclass))::text),
    user_id uuid NOT NULL,
    role_at_creation text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category ticket_category NOT NULL,
    status ticket_status NOT NULL DEFAULT 'open'::ticket_status,
    priority ticket_priority NOT NULL DEFAULT 'normal'::ticket_priority,
    order_id uuid,
    shop_id uuid,
    partner_id uuid,
    assigned_to uuid,
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    resolved_by uuid,
    resolution_notes text,
    PRIMARY KEY (id),
    UNIQUE (ticket_number)
);

CREATE TABLE IF NOT EXISTS public."ticket_assignments" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone NOT NULL DEFAULT now(),
    unassigned_at timestamp with time zone,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."ticket_attachments" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL,
    message_id uuid,
    uploaded_by uuid NOT NULL,
    file_url text NOT NULL,
    file_name text,
    mime text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."user_roles" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public."wishlist_items" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, product_id)
);

-- ---------- 5. Foreign keys ----------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'addresses_user_id_fkey') THEN
        ALTER TABLE public."addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_product_id_fkey') THEN
        ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_shop_id_fkey') THEN
        ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_user_id_fkey') THEN
        ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_variant_id_fkey') THEN
        ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES public."product_variants"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_messages_delivery_partner_id_fkey') THEN
        ALTER TABLE public."delivery_messages" ADD CONSTRAINT "delivery_messages_delivery_partner_id_fkey" FOREIGN KEY (delivery_partner_id) REFERENCES public."delivery_partners"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_messages_order_id_fkey') THEN
        ALTER TABLE public."delivery_messages" ADD CONSTRAINT "delivery_messages_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_partners_current_order_id_fkey') THEN
        ALTER TABLE public."delivery_partners" ADD CONSTRAINT "delivery_partners_current_order_id_fkey" FOREIGN KEY (current_order_id) REFERENCES public."orders"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_partners_shop_id_fkey') THEN
        ALTER TABLE public."delivery_partners" ADD CONSTRAINT "delivery_partners_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_child_order_id_fkey') THEN
        ALTER TABLE public."inventory_reservations" ADD CONSTRAINT "inventory_reservations_child_order_id_fkey" FOREIGN KEY (child_order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_parent_order_id_fkey') THEN
        ALTER TABLE public."inventory_reservations" ADD CONSTRAINT "inventory_reservations_parent_order_id_fkey" FOREIGN KEY (parent_order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_shop_product_id_fkey') THEN
        ALTER TABLE public."inventory_reservations" ADD CONSTRAINT "inventory_reservations_shop_product_id_fkey" FOREIGN KEY (shop_product_id) REFERENCES public."shop_products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
        ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_shop_id_fkey') THEN
        ALTER TABLE public."offers" ADD CONSTRAINT "offers_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_child_order_id_fkey') THEN
        ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_child_order_id_fkey" FOREIGN KEY (child_order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_fkey') THEN
        ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_id_fkey') THEN
        ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_shop_id_fkey') THEN
        ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_shop_product_id_fkey') THEN
        ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_shop_product_id_fkey" FOREIGN KEY (shop_product_id) REFERENCES public."shop_products"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_variant_id_fkey') THEN
        ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES public."product_variants"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_routing_log_chosen_shop_id_fkey') THEN
        ALTER TABLE public."order_routing_log" ADD CONSTRAINT "order_routing_log_chosen_shop_id_fkey" FOREIGN KEY (chosen_shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_routing_log_order_id_fkey') THEN
        ALTER TABLE public."order_routing_log" ADD CONSTRAINT "order_routing_log_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_parent_order_id_fkey') THEN
        ALTER TABLE public."orders" ADD CONSTRAINT "orders_parent_order_id_fkey" FOREIGN KEY (parent_order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_partner_id_fkey') THEN
        ALTER TABLE public."orders" ADD CONSTRAINT "orders_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES public."delivery_partners"(id);
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_shop_id_fkey') THEN
        ALTER TABLE public."orders" ADD CONSTRAINT "orders_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_fkey') THEN
        ALTER TABLE public."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fkey') THEN
        ALTER TABLE public."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_user_id_fkey') THEN
        ALTER TABLE public."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pickup_events_child_order_id_fkey') THEN
        ALTER TABLE public."pickup_events" ADD CONSTRAINT "pickup_events_child_order_id_fkey" FOREIGN KEY (child_order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pickup_events_parent_order_id_fkey') THEN
        ALTER TABLE public."pickup_events" ADD CONSTRAINT "pickup_events_parent_order_id_fkey" FOREIGN KEY (parent_order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pickup_events_shop_id_fkey') THEN
        ALTER TABLE public."pickup_events" ADD CONSTRAINT "pickup_events_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_categories_category_id_fkey') THEN
        ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public."categories"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_categories_product_id_fkey') THEN
        ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_collections_collection_id_fkey') THEN
        ALTER TABLE public."product_collections" ADD CONSTRAINT "product_collections_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public."collections"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_collections_product_id_fkey') THEN
        ALTER TABLE public."product_collections" ADD CONSTRAINT "product_collections_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_subcategories_product_id_fkey') THEN
        ALTER TABLE public."product_subcategories" ADD CONSTRAINT "product_subcategories_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_subcategories_subcategory_id_fkey') THEN
        ALTER TABLE public."product_subcategories" ADD CONSTRAINT "product_subcategories_subcategory_id_fkey" FOREIGN KEY (subcategory_id) REFERENCES public."subcategories"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_product_id_fkey') THEN
        ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
        ALTER TABLE public."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public."categories"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_subcategory_id_fkey') THEN
        ALTER TABLE public."products" ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY (subcategory_id) REFERENCES public."subcategories"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
        ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_shop_id_fkey') THEN
        ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_product_id_fkey') THEN
        ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_user_id_fkey') THEN
        ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_requests_user_id_fkey') THEN
        ALTER TABLE public."role_requests" ADD CONSTRAINT "role_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_assignment_history_order_id_fkey') THEN
        ALTER TABLE public."shop_assignment_history" ADD CONSTRAINT "shop_assignment_history_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public."orders"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_assignment_history_shop_id_fkey') THEN
        ALTER TABLE public."shop_assignment_history" ADD CONSTRAINT "shop_assignment_history_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_categories_shop_id_fkey') THEN
        ALTER TABLE public."shop_categories" ADD CONSTRAINT "shop_categories_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_category_items_category_id_fkey') THEN
        ALTER TABLE public."shop_category_items" ADD CONSTRAINT "shop_category_items_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public."shop_categories"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_category_items_product_id_fkey') THEN
        ALTER TABLE public."shop_category_items" ADD CONSTRAINT "shop_category_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_collection_items_collection_id_fkey') THEN
        ALTER TABLE public."shop_collection_items" ADD CONSTRAINT "shop_collection_items_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public."shop_collections"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_delivery_assignments_assigned_by_fkey') THEN
        ALTER TABLE public."shop_delivery_assignments" ADD CONSTRAINT "shop_delivery_assignments_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES auth."users"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_delivery_assignments_delivery_partner_id_fkey') THEN
        ALTER TABLE public."shop_delivery_assignments" ADD CONSTRAINT "shop_delivery_assignments_delivery_partner_id_fkey" FOREIGN KEY (delivery_partner_id) REFERENCES public."delivery_partners"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_delivery_assignments_shop_id_fkey') THEN
        ALTER TABLE public."shop_delivery_assignments" ADD CONSTRAINT "shop_delivery_assignments_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_products_product_id_fkey') THEN
        ALTER TABLE public."shop_products" ADD CONSTRAINT "shop_products_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_products_shop_id_fkey') THEN
        ALTER TABLE public."shop_products" ADD CONSTRAINT "shop_products_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcategories_category_id_fkey') THEN
        ALTER TABLE public."subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public."categories"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_agents_user_id_fkey') THEN
        ALTER TABLE public."support_agents" ADD CONSTRAINT "support_agents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_sender_id_fkey') THEN
        ALTER TABLE public."support_messages" ADD CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_ticket_id_fkey') THEN
        ALTER TABLE public."support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public."support_tickets"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_assigned_to_fkey') THEN
        ALTER TABLE public."support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth."users"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_order_id_fkey') THEN
        ALTER TABLE public."support_tickets" ADD CONSTRAINT "support_tickets_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public."orders"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_partner_id_fkey') THEN
        ALTER TABLE public."support_tickets" ADD CONSTRAINT "support_tickets_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES public."delivery_partners"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_resolved_by_fkey') THEN
        ALTER TABLE public."support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth."users"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_shop_id_fkey') THEN
        ALTER TABLE public."support_tickets" ADD CONSTRAINT "support_tickets_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public."shops"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_user_id_fkey') THEN
        ALTER TABLE public."support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_assignments_assigned_by_fkey') THEN
        ALTER TABLE public."ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES auth."users"(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_assignments_assigned_to_fkey') THEN
        ALTER TABLE public."ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_assignments_ticket_id_fkey') THEN
        ALTER TABLE public."ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public."support_tickets"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_attachments_message_id_fkey') THEN
        ALTER TABLE public."ticket_attachments" ADD CONSTRAINT "ticket_attachments_message_id_fkey" FOREIGN KEY (message_id) REFERENCES public."support_messages"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_attachments_ticket_id_fkey') THEN
        ALTER TABLE public."ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public."support_tickets"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_attachments_uploaded_by_fkey') THEN
        ALTER TABLE public."ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey') THEN
        ALTER TABLE public."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_items_product_id_fkey') THEN
        ALTER TABLE public."wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public."products"(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_items_user_id_fkey') THEN
        ALTER TABLE public."wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth."users"(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ---------- 5. Indexes ----------
CREATE UNIQUE INDEX IF NOT EXISTS addresses_pkey ON public.addresses USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS app_config_pkey ON public.app_config USING btree (key);
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_pkey ON public.cart_items USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_id_product_id_key ON public.cart_items USING btree (user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_shop ON public.cart_items USING btree (user_id, shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_pkey ON public.categories USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON public.categories USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS collections_pkey ON public.collections USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS collections_slug_key ON public.collections USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_key ON public.coupons USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_pkey ON public.coupons USING btree (id);
CREATE INDEX IF NOT EXISTS delivery_messages_customer_idx ON public.delivery_messages USING btree (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_messages_order_created_idx ON public.delivery_messages USING btree (order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_messages_pkey ON public.delivery_messages USING btree (id);
CREATE INDEX IF NOT EXISTS delivery_partners_current_order_idx ON public.delivery_partners USING btree (current_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_partners_pkey ON public.delivery_partners USING btree (id);
CREATE INDEX IF NOT EXISTS delivery_partners_shop_id_idx ON public.delivery_partners USING btree (shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_partners_user_id_key ON public.delivery_partners USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_zone_settings_pin_code_key ON public.delivery_zone_settings USING btree (pin_code);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_zone_settings_pkey ON public.delivery_zone_settings USING btree (id);
CREATE INDEX IF NOT EXISTS idx_dzs_pin ON public.delivery_zone_settings USING btree (pin_code);
CREATE INDEX IF NOT EXISTS idx_dzs_state_city ON public.delivery_zone_settings USING btree (state, city);
CREATE INDEX IF NOT EXISTS idx_reservations_active ON public.inventory_reservations USING btree (shop_product_id) WHERE (released = false);
CREATE INDEX IF NOT EXISTS idx_reservations_parent ON public.inventory_reservations USING btree (parent_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_reservations_pkey ON public.inventory_reservations USING btree (id);
CREATE INDEX IF NOT EXISTS locations_pincode_idx ON public.locations USING btree (pincode);
CREATE UNIQUE INDEX IF NOT EXISTS locations_pkey ON public.locations USING btree (id);
CREATE INDEX IF NOT EXISTS locations_state_city_idx ON public.locations USING btree (state, city) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS locations_state_city_pincode_key ON public.locations USING btree (state, city, pincode);
CREATE INDEX IF NOT EXISTS locations_state_idx ON public.locations USING btree (state) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_dispatch_status ON public.notification_dispatch_log USING btree (status);
CREATE INDEX IF NOT EXISTS idx_dispatch_user ON public.notification_dispatch_log USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS notification_dispatch_log_pkey ON public.notification_dispatch_log USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_dispatch_user_notif ON public.notification_dispatch_log USING btree (user_id, notification_id) WHERE (notification_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_pkey ON public.notification_preferences USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications USING btree (user_id) WHERE (read = false);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_pkey ON public.notifications USING btree (id);
CREATE INDEX IF NOT EXISTS offers_active_idx ON public.offers USING btree (is_active, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS offers_pkey ON public.offers USING btree (id);
CREATE INDEX IF NOT EXISTS offers_shop_idx ON public.offers USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_onesignal_subs_user ON public.onesignal_subscriptions USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS onesignal_subscriptions_pkey ON public.onesignal_subscriptions USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS onesignal_subscriptions_user_id_player_id_key ON public.onesignal_subscriptions USING btree (user_id, player_id);
CREATE INDEX IF NOT EXISTS idx_oal_order ON public.order_audit_log USING btree (order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS order_audit_log_pkey ON public.order_audit_log USING btree (id);
CREATE INDEX IF NOT EXISTS idx_order_items_child ON public.order_items USING btree (child_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop ON public.order_items USING btree (shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS order_items_pkey ON public.order_items USING btree (id);
CREATE INDEX IF NOT EXISTS idx_routing_log_created ON public.order_routing_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_log_order ON public.order_routing_log USING btree (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS order_routing_log_pkey ON public.order_routing_log USING btree (id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pincode ON public.orders USING btree (delivery_pincode);
CREATE INDEX IF NOT EXISTS idx_orders_is_parent ON public.orders USING btree (is_parent) WHERE (is_parent = true);
CREATE INDEX IF NOT EXISTS idx_orders_parent ON public.orders USING btree (parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON public.orders USING btree (partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON public.orders USING btree (placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop ON public.orders USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_placed ON public.orders USING btree (shop_id, placed_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS ix_orders_parent_partner ON public.orders USING btree (parent_order_id) WHERE (parent_order_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS ix_orders_ready_no_partner ON public.orders USING btree (status, partner_id) WHERE ((is_parent = true) AND (partner_id IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders USING btree (order_number);
CREATE UNIQUE INDEX IF NOT EXISTS orders_pkey ON public.orders USING btree (id);
CREATE INDEX IF NOT EXISTS partner_attendance_partner_idx ON public.partner_attendance USING btree (partner_id, check_in_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS partner_attendance_pkey ON public.partner_attendance USING btree (id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_order ON public.payments USING btree (provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS payments_pkey ON public.payments USING btree (id);
CREATE INDEX IF NOT EXISTS idx_pickup_events_parent ON public.pickup_events USING btree (parent_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS pickup_events_pkey ON public.pickup_events USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pickup_events_child_event ON public.pickup_events USING btree (child_order_id, event) WHERE (child_order_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON public.product_categories USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON public.product_categories USING btree (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_categories_pkey ON public.product_categories USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS product_categories_product_id_category_id_key ON public.product_categories USING btree (product_id, category_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_collections_pkey ON public.product_collections USING btree (collection_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_subcategories_sub ON public.product_subcategories USING btree (subcategory_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_subcategories_pkey ON public.product_subcategories USING btree (product_id, subcategory_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants USING btree (product_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_pkey ON public.product_variants USING btree (id);
CREATE INDEX IF NOT EXISTS idx_products_brand_lower ON public.products USING btree (lower(brand));
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON public.products USING btree (lower(name));
CREATE INDEX IF NOT EXISTS idx_products_name_normalized ON public.products USING btree (name_normalized);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING gin (name extensions.gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS products_pkey ON public.products USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products USING btree (slug);
CREATE INDEX IF NOT EXISTS products_subcategory_idx ON public.products USING btree (subcategory_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_name_normalized ON public.products USING btree (name_normalized);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_shop_id ON public.profiles USING btree (shop_id) WHERE (shop_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_pkey ON public.reviews USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_product_id_user_id_key ON public.reviews USING btree (product_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS role_requests_pkey ON public.role_requests USING btree (id);
CREATE INDEX IF NOT EXISTS role_requests_status_idx ON public.role_requests USING btree (status);
CREATE INDEX IF NOT EXISTS role_requests_user_idx ON public.role_requests USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created ON public.security_audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_target ON public.security_audit_log USING btree (target_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS security_audit_log_pkey ON public.security_audit_log USING btree (id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_order ON public.shop_assignment_history USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_shop ON public.shop_assignment_history USING btree (shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_assignment_history_pkey ON public.shop_assignment_history USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_categories_pkey ON public.shop_categories USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_categories_shop_id_slug_key ON public.shop_categories USING btree (shop_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS shop_category_items_pkey ON public.shop_category_items USING btree (category_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_collection_items_pkey ON public.shop_collection_items USING btree (collection_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_collections_pkey ON public.shop_collections USING btree (id);
CREATE INDEX IF NOT EXISTS sda_partner_idx ON public.shop_delivery_assignments USING btree (delivery_partner_id);
CREATE INDEX IF NOT EXISTS sda_shop_idx ON public.shop_delivery_assignments USING btree (shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_delivery_assignments_pkey ON public.shop_delivery_assignments USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_delivery_assignments_shop_id_delivery_partner_id_key ON public.shop_delivery_assignments USING btree (shop_id, delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_product ON public.shop_products USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON public.shop_products USING btree (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_shop_created ON public.shop_products USING btree (shop_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS shop_products_pkey ON public.shop_products USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS shop_products_shop_id_product_id_key ON public.shop_products USING btree (shop_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_products_shop_product ON public.shop_products USING btree (shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON public.shops USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_pincode ON public.shops USING btree (pincode) WHERE (is_open = true);
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS shops_pkey ON public.shops USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS subcategories_category_id_slug_key ON public.subcategories USING btree (category_id, slug);
CREATE INDEX IF NOT EXISTS subcategories_category_order_idx ON public.subcategories USING btree (category_id, display_order, name);
CREATE UNIQUE INDEX IF NOT EXISTS subcategories_pkey ON public.subcategories USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS support_agents_pkey ON public.support_agents USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS support_messages_pkey ON public.support_messages USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_pkey ON public.support_tickets USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_ticket_number_key ON public.support_tickets USING btree (ticket_number);
CREATE UNIQUE INDEX IF NOT EXISTS ticket_assignments_pkey ON public.ticket_assignments USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS ticket_attachments_pkey ON public.ticket_attachments USING btree (id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles USING btree (user_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_pkey ON public.user_roles USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_pkey ON public.wishlist_items USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_user_id_product_id_key ON public.wishlist_items USING btree (user_id, product_id);

-- ---------- 6. Functions ----------
CREATE OR REPLACE FUNCTION public.account_deletion_check()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_roles text[];
  v_active int := 0;
  v_other_super int := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not signed in');
  END IF;

  SELECT coalesce(array_agg(role::text), '{}') INTO v_roles
  FROM public.user_roles WHERE user_id = uid;

  IF 'shopkeeper' = ANY(v_roles) THEN
    SELECT count(*) INTO v_active
    FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE s.owner_id = uid
      AND o.status NOT IN ('delivered', 'cancelled');
    IF v_active > 0 THEN
      RETURN jsonb_build_object('allowed', false, 'roles', v_roles, 'active_count', v_active,
        'reason', 'Your account cannot be deleted while you have active orders. Please complete or resolve your active orders first.');
    END IF;
  END IF;

  IF 'delivery' = ANY(v_roles) THEN
    SELECT count(*) INTO v_active
    FROM public.orders o
    JOIN public.delivery_partners dp ON dp.id = o.partner_id
    WHERE dp.user_id = uid
      AND o.status NOT IN ('delivered', 'cancelled');
    IF v_active > 0 THEN
      RETURN jsonb_build_object('allowed', false, 'roles', v_roles, 'active_count', v_active,
        'reason', 'You have active deliveries. Please complete or resolve them before deleting your account.');
    END IF;
  END IF;

  IF 'super_admin' = ANY(v_roles) THEN
    SELECT count(*) INTO v_other_super
    FROM public.user_roles
    WHERE role = 'super_admin' AND user_id <> uid;
    IF v_other_super = 0 THEN
      RETURN jsonb_build_object('allowed', false, 'roles', v_roles,
        'reason', 'The last Super Admin account cannot be deleted. Assign another Super Admin before deleting this account.');
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'roles', v_roles);
END;
$function$;

CREATE OR REPLACE FUNCTION public.actor_role_label()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'admin'::app_role) THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.shops WHERE owner_id=auth.uid()) THEN 'shopkeeper'
    WHEN EXISTS (SELECT 1 FROM public.delivery_partners WHERE user_id=auth.uid()) THEN 'delivery'
    WHEN auth.uid() IS NOT NULL THEN 'customer'
    ELSE 'system'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_approve_delivery_request(_request_id uuid, _shop_id uuid, _name text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _vehicle text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _req record; _pid uuid; _full text;
BEGIN
  IF NOT public.has_role(_uid,'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _shop_id IS NULL THEN RAISE EXCEPTION 'shop_id required'; END IF;
  SELECT * INTO _req FROM public.role_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF _req.requested_role <> 'delivery' THEN RAISE EXCEPTION 'Wrong request type'; END IF;
  SELECT full_name INTO _full FROM public.profiles WHERE id = _req.user_id;
  INSERT INTO public.delivery_partners(user_id, name, phone, vehicle, shop_id, is_online)
  VALUES (_req.user_id, COALESCE(_name,_full,'Delivery Partner'),
          COALESCE(_phone, _req.data->>'phone'),
          COALESCE(_vehicle, _req.data->>'vehicle_type'),
          _shop_id, false)
  ON CONFLICT (user_id) DO UPDATE SET shop_id = EXCLUDED.shop_id,
    phone = COALESCE(EXCLUDED.phone, public.delivery_partners.phone),
    vehicle = COALESCE(EXCLUDED.vehicle, public.delivery_partners.vehicle),
    updated_at = now()
  RETURNING id INTO _pid;
  INSERT INTO public.user_roles(user_id, role) VALUES (_req.user_id,'delivery'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.role_requests SET status='approved', decided_at=now(), decided_by=_uid,
    data = data || jsonb_build_object('approved_shop_id', _shop_id, 'partner_id', _pid)
    WHERE id = _request_id;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_req.user_id,'Delivery partner request approved',
    'You can now accept deliveries from your assigned shop.','role_request',
    jsonb_build_object('url','/delivery/dashboard','shop_id',_shop_id));
  RETURN _pid;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_approve_shopkeeper_request(_request_id uuid, _shop_id uuid DEFAULT NULL::uuid, _shop_name text DEFAULT NULL::text, _address text DEFAULT NULL::text, _city text DEFAULT NULL::text, _pincode text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _radius numeric DEFAULT 8)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _req record; _shop uuid;
BEGIN
  IF NOT public.has_role(_uid,'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _req FROM public.role_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF _req.requested_role <> 'shopkeeper' THEN RAISE EXCEPTION 'Wrong request type'; END IF;
  IF _shop_id IS NOT NULL THEN
    UPDATE public.shops SET owner_id = _req.user_id, updated_at = now() WHERE id = _shop_id;
    _shop := _shop_id;
  ELSE
    IF _shop_name IS NULL OR _address IS NULL OR _lat IS NULL OR _lng IS NULL THEN
      RAISE EXCEPTION 'Shop name, address, latitude and longitude are required';
    END IF;
    INSERT INTO public.shops(owner_id, name, address, city, pincode, phone, latitude, longitude, service_radius_km, is_open)
    VALUES (_req.user_id, _shop_name, _address, COALESCE(_city,''), COALESCE(_pincode,''), _phone, _lat, _lng, COALESCE(_radius,8), true)
    RETURNING id INTO _shop;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_req.user_id,'shopkeeper'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.role_requests SET status='approved', decided_at=now(), decided_by=_uid,
    data = data || jsonb_build_object('approved_shop_id', _shop) WHERE id = _request_id;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_req.user_id,'Shopkeeper request approved',
    'You are now a shopkeeper. Open your shop dashboard.','role_request',
    jsonb_build_object('url','/shopkeeper/dashboard','shop_id',_shop));
  RETURN _shop;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_privileged boolean := _role::text IN ('admin', 'super_admin');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can assign roles';
  END IF;

  IF v_privileged AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super Admin only: assigning the % role requires Super Admin access', _role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.log_security_event('role_assigned', _user_id, jsonb_build_object('role', _role::text));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_assign_shop_owner(_shop_id uuid, _user_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE _uid uuid; _pstatus text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_user_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'User not found: %', _user_email; END IF;
  SELECT status INTO _pstatus FROM public.profiles WHERE id = _uid;
  IF _pstatus = 'disabled' THEN RAISE EXCEPTION 'User is disabled/suspended'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'shopkeeper')
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.shops SET owner_id = _uid, updated_at = now() WHERE id = _shop_id;
  RETURN _uid;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_create_delivery_partner(_name text, _phone text, _vehicle text DEFAULT NULL::text, _user_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _target uuid; _pid uuid;
BEGIN
  IF NOT public.has_role(_uid,'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _name IS NULL OR length(trim(_name))=0 THEN RAISE EXCEPTION 'Name required'; END IF;

  IF _user_email IS NOT NULL AND length(trim(_user_email))>0 THEN
    SELECT id INTO _target FROM auth.users WHERE lower(email)=lower(trim(_user_email));
    IF _target IS NULL THEN RAISE EXCEPTION 'No user with email %', _user_email; END IF;
    IF EXISTS (SELECT 1 FROM public.delivery_partners WHERE user_id=_target) THEN
      RAISE EXCEPTION 'User is already a delivery partner';
    END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (_target,'delivery'::app_role)
      ON CONFLICT (user_id,role) DO NOTHING;
  ELSE
    _target := gen_random_uuid();
  END IF;

  INSERT INTO public.delivery_partners(user_id, name, phone, vehicle, is_online)
  VALUES (_target, _name, _phone, _vehicle, false) RETURNING id INTO _pid;
  RETURN _pid;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_create_shopkeeper(_user_email text, _shop_name text, _address text, _city text, _pincode text, _lat double precision, _lng double precision, _phone text DEFAULT NULL::text, _radius numeric DEFAULT 8)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE _uid uuid := auth.uid(); _target uuid; _shop uuid;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _shop_name IS NULL OR length(trim(_shop_name)) = 0 THEN RAISE EXCEPTION 'Shop name required'; END IF;
  IF _user_email IS NULL OR length(trim(_user_email)) = 0 THEN RAISE EXCEPTION 'Owner email required'; END IF;
  IF _address IS NULL OR length(trim(_address)) = 0 THEN RAISE EXCEPTION 'Address required'; END IF;
  IF _city IS NULL OR length(trim(_city)) = 0 THEN RAISE EXCEPTION 'City required'; END IF;
  IF _pincode IS NULL OR length(trim(_pincode)) = 0 THEN RAISE EXCEPTION 'Pincode required'; END IF;
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Location required'; END IF;

  SELECT id INTO _target FROM auth.users WHERE lower(email) = lower(trim(_user_email)) LIMIT 1;
  IF _target IS NULL THEN RAISE EXCEPTION 'No user account with email %. Ask them to sign up first.', _user_email; END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (_target, 'shopkeeper'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.shops(owner_id, name, address, city, pincode, phone, latitude, longitude, service_radius_km, is_open)
  VALUES (_target, _shop_name, _address, _city, _pincode, _phone, _lat, _lng, _radius, true)
  RETURNING id INTO _shop;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_target, 'Shop assigned', 'You have been assigned to a shop. Open your dashboard.', 'role_request',
    jsonb_build_object('url','/shopkeeper/dashboard','shop_id',_shop));

  RETURN _shop;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_delivery_zone(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  DELETE FROM public.delivery_zone_settings WHERE id = _id;
END; $function$;

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

CREATE OR REPLACE FUNCTION public.admin_duplicate_delivery_zone(_id uuid, _new_pin text)
 RETURNS delivery_zone_settings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.delivery_zone_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  INSERT INTO public.delivery_zone_settings(
    state, city, pin_code, is_active, delivery_radius_km,
    standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
    fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
    express_enabled, express_fee, express_eta_minutes, minimum_order_express
  )
  SELECT state, city, _new_pin, is_active, delivery_radius_km,
    standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
    fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
    express_enabled, express_fee, express_eta_minutes, minimum_order_express
  FROM public.delivery_zone_settings WHERE id = _id
  RETURNING * INTO r;
  RETURN r;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_list_complaints()
 RETURNS TABLE(id uuid, ticket_number text, title text, description text, category text, status text, role_at_creation text, created_at timestamp with time zone, user_id uuid, full_name text, phone text, address_line text, city text, pincode text, shop_name text, shop_address text, shop_phone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    t.id, t.ticket_number, t.title, t.description,
    t.category::text, t.status::text, t.role_at_creation,
    t.created_at, t.user_id,
    p.full_name, COALESCE(p.phone, a.phone) AS phone,
    CONCAT_WS(', ', a.line1, a.line2, a.landmark) AS address_line,
    a.city, a.pincode,
    s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone
  FROM public.support_tickets t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN LATERAL (
    SELECT addr.* FROM public.addresses addr
    WHERE addr.user_id = t.user_id
    ORDER BY addr.is_default DESC NULLS LAST, addr.updated_at DESC
    LIMIT 1
  ) a ON TRUE
  LEFT JOIN LATERAL (
    SELECT sh.* FROM public.shops sh
    WHERE sh.owner_id = t.user_id
    ORDER BY sh.created_at ASC
    LIMIT 1
  ) s ON TRUE
  WHERE t.role_at_creation IN ('customer','shopkeeper')
  ORDER BY t.created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_list_delivery_zones()
 RETURNS SETOF delivery_zone_settings
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY SELECT * FROM public.delivery_zone_settings ORDER BY state, city, pin_code;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_list_payments(_status payment_status DEFAULT NULL::payment_status, _limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, order_id uuid, user_id uuid, provider text, provider_payment_id text, amount numeric, status payment_status, method text, error_code text, error_description text, refund_amount numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT p.id, p.order_id, p.user_id, p.provider, p.provider_payment_id,
           p.amount, p.status, p.method, p.error_code, p.error_description,
           p.refund_amount, p.created_at
    FROM public.payments p
    WHERE (_status IS NULL OR p.status = _status)
    ORDER BY p.created_at DESC
    LIMIT _limit;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_list_role_requests(_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, user_id uuid, requested_role app_role, status text, data jsonb, rejection_reason text, submitted_at timestamp with time zone, decided_at timestamp with time zone, full_name text, email text, phone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT r.id, r.user_id, r.requested_role, r.status, r.data, r.rejection_reason,
         r.submitted_at, r.decided_at, p.full_name, u.email::text, p.phone
  FROM public.role_requests r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  WHERE _status IS NULL OR r.status = _status
  ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END, r.submitted_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_list_shops()
 RETURNS TABLE(id uuid, owner_id uuid, owner_email text, owner_name text, owner_phone text, owner_status text, name text, address text, city text, state text, pincode text, phone text, latitude double precision, longitude double precision, is_open boolean, status text, logo_url text, service_radius_km numeric, created_at timestamp with time zone, updated_at timestamp with time zone, today_orders bigint, monthly_revenue numeric, acceptance_rate numeric, avg_rating numeric, total_orders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  WITH ord_stats AS (
    SELECT o.shop_id,
      COUNT(*) FILTER (WHERE o.placed_at::date = CURRENT_DATE) AS today_orders,
      COUNT(*) AS total_orders,
      COALESCE(SUM(o.total) FILTER (WHERE o.status='delivered' AND o.placed_at >= date_trunc('month', now())), 0) AS monthly_revenue
    FROM public.orders o WHERE o.shop_id IS NOT NULL GROUP BY o.shop_id
  ),
  acc AS (
    SELECT h.shop_id,
      CASE WHEN COUNT(*)=0 THEN NULL
        ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE h.status='accepted') / COUNT(*), 1)
      END AS acceptance_rate
    FROM public.shop_assignment_history h GROUP BY h.shop_id
  )
  SELECT
    s.id, s.owner_id,
    u.email::text, p.full_name, p.phone, p.status,
    s.name, s.address, s.city, s.state, s.pincode, s.phone,
    s.latitude, s.longitude, s.is_open, s.status, s.logo_url, s.service_radius_km,
    s.created_at, s.updated_at,
    COALESCE(os.today_orders,0), COALESCE(os.monthly_revenue,0),
    acc.acceptance_rate, NULL::numeric, COALESCE(os.total_orders,0)
  FROM public.shops s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  LEFT JOIN public.profiles p ON p.id = s.owner_id
  LEFT JOIN ord_stats os ON os.shop_id = s.id
  LEFT JOIN acc ON acc.shop_id = s.id
  ORDER BY s.name;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, full_name text, phone text, email text, address text, status text, created_at timestamp with time zone, roles app_role[], pending_request_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_super boolean;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  v_is_super := public.is_super_admin(auth.uid());

  RETURN QUERY
  SELECT p.id, p.full_name, p.phone, u.email::text, p.address, p.status, p.created_at,
    COALESCE(
      ARRAY_AGG(DISTINCT ur.role) FILTER (
        WHERE ur.role IS NOT NULL
          AND (v_is_super OR ur.role::text <> 'super_admin')
      ), '{}'::app_role[]
    ) AS roles,
    (SELECT COUNT(*)::int FROM public.role_requests rr WHERE rr.user_id = p.id AND rr.status = 'pending') AS pending_request_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE v_is_super OR NOT EXISTS (
    SELECT 1 FROM public.user_roles s
    WHERE s.user_id = p.id AND s.role::text = 'super_admin'
  )
  GROUP BY p.id, u.email
  ORDER BY p.created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_live_partners()
 RETURNS TABLE(partner_id uuid, name text, phone text, vehicle text, is_online boolean, rating numeric, availability_status text, active_order_count integer, current_order_id uuid, current_order_number text, eta_minutes integer, status_updated_at timestamp with time zone, shop_id uuid, shop_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT dp.id, dp.name, dp.phone, dp.vehicle, dp.is_online, dp.rating,
         dp.availability_status, dp.active_order_count,
         dp.current_order_id, o.order_number, dp.eta_minutes, dp.status_updated_at,
         s.id, s.name
  FROM public.delivery_partners dp
  LEFT JOIN public.orders o ON o.id = dp.current_order_id
  LEFT JOIN public.shops  s ON s.id = COALESCE(o.shop_id, dp.shop_id)
  WHERE public.has_role(auth.uid(),'admin'::app_role)
  ORDER BY s.name NULLS LAST, dp.is_online DESC, dp.status_updated_at DESC NULLS LAST, dp.name ASC;
$function$;

CREATE OR REPLACE FUNCTION public.admin_order_timeline(_parent_id uuid)
 RETURNS TABLE(at timestamp with time zone, event text, actor uuid, detail jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT created_at, event, actor_user_id, detail FROM pickup_events WHERE parent_order_id = _parent_id
  UNION ALL
  SELECT assigned_at, 'assign_' || status, NULL, jsonb_build_object('shop_id', shop_id, 'reason', reason, 'attempt', attempt_number)
    FROM shop_assignment_history WHERE order_id = _parent_id
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.admin_partner_performance()
 RETURNS TABLE(partner_id uuid, name text, phone text, is_online boolean, rating numeric, orders_today bigint, orders_7d bigint, orders_30d bigint, avg_minutes_30d numeric, on_time_pct_30d numeric, hours_today numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT dp.id AS partner_id, dp.name, dp.phone, dp.is_online, dp.rating,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at::date = current_date) AS orders_today,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '7 days') AS orders_7d,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '30 days') AS orders_30d,
    COALESCE(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.placed_at))/60.0)
      FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '30 days'), 0)::numeric AS avg_minutes_30d,
    COALESCE(
      100.0 * COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '30 days' AND EXTRACT(EPOCH FROM (o.updated_at - o.placed_at))/60.0 <= 30)
      / NULLIF(COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '30 days'), 0)
    , 0)::numeric AS on_time_pct_30d,
    public.partner_today_hours(dp.id) AS hours_today
  FROM public.delivery_partners dp
  LEFT JOIN public.orders o ON o.partner_id = dp.id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY dp.id
  ORDER BY 6 DESC, dp.name ASC;
$function$;

CREATE OR REPLACE FUNCTION public.admin_payments_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'revenue_total', COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0),
    'revenue_today', COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND created_at::date = current_date), 0),
    'txn_count',     COUNT(*) FILTER (WHERE status = 'paid'),
    'failed_count',  COUNT(*) FILTER (WHERE status = 'failed'),
    'refund_total',  COALESCE(SUM(refund_amount) FILTER (WHERE status = 'refunded'), 0),
    'refund_count',  COUNT(*) FILTER (WHERE status = 'refunded')
  ) INTO _out FROM public.payments;
  RETURN _out;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reassign_partner(_order_id uuid, _partner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _order_number text; _partner_user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT order_number INTO _order_number FROM public.orders WHERE id = _order_id;
  UPDATE public.orders SET partner_id = _partner_id, updated_at = now() WHERE id = _order_id;
  SELECT user_id INTO _partner_user FROM public.delivery_partners WHERE id = _partner_id;
  IF _partner_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_partner_user, 'Delivery reassigned',
            'You have been assigned to order ' || COALESCE(_order_number,'') || '.',
            'delivery_assignment',
            jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reassign_shop(_order_id uuid, _shop_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _prev_shop uuid; _lat double precision; _lng double precision; _dist numeric;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT shop_id, delivery_lat, delivery_lng INTO _prev_shop, _lat, _lng
  FROM public.orders WHERE id = _order_id;

  -- restore stock at previous shop if any
  IF _prev_shop IS NOT NULL THEN
    UPDATE public.shop_products sp SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _prev_shop;
  END IF;

  -- Reserve stock at new shop
  UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
  FROM public.order_items oi
  WHERE oi.order_id = _order_id AND sp.product_id = oi.product_id AND sp.shop_id = _shop_id;

  SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng)
    INTO _dist FROM public.shops s WHERE s.id = _shop_id;

  -- Remove the new shop from rejection list so it can receive it
  UPDATE public.orders SET
    shop_id = _shop_id,
    rejected_shop_ids = array_remove(rejected_shop_ids, _shop_id),
    status = 'awaiting_shop'::order_status,
    assignment_attempts = assignment_attempts + 1,
    assignment_expires_at = now() + interval '10 minutes',
    assignment_reason = 'Admin manually reassigned',
    assignment_distance_km = _dist,
    updated_at = now()
  WHERE id = _order_id;

  INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, assigned_at)
  VALUES (_order_id, _shop_id, 'admin_override', 'Admin manually reassigned this order', now());

  INSERT INTO public.notifications (user_id, title, body, data)
  VALUES (
    (SELECT owner_id FROM public.shops WHERE id = _shop_id),
    'New order (admin assigned)',
    'An administrator assigned an order to your shop',
    jsonb_build_object('order_id', _order_id, 'url', '/shopkeeper/orders/' || _order_id)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.admin_record_refund(_payment_id uuid, _refund_id text, _amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _order uuid; _user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.payments
    SET status = 'refunded', refund_id = _refund_id, refund_amount = _amount,
        refunded_at = now(), updated_at = now()
    WHERE id = _payment_id
    RETURNING order_id, user_id INTO _order, _user;
  IF _order IS NOT NULL THEN
    UPDATE public.orders SET payment_status = 'refunded', updated_at = now() WHERE id = _order;
    INSERT INTO public.notifications (user_id, title, body, category)
    VALUES (_user, 'Refund issued', 'Your refund of ₹' || _amount || ' has been processed.', 'payment');
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reject_role_request(_request_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _req record;
BEGIN
  IF NOT public.has_role(_uid,'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _req FROM public.role_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  UPDATE public.role_requests SET status='rejected', decided_at=now(), decided_by=_uid, rejection_reason=_reason
    WHERE id = _request_id;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_req.user_id,'Role request rejected',
    COALESCE(_reason,'Your role upgrade request was not approved.'),'role_request', '{}'::jsonb);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_remove_role(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_privileged boolean := _role::text IN ('admin', 'super_admin');
  v_remaining int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can remove roles';
  END IF;

  IF v_privileged AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super Admin only: removing the % role requires Super Admin access', _role;
  END IF;

  -- Never allow the platform to be left without a Super Admin
  IF _role::text = 'super_admin' THEN
    SELECT count(*) INTO v_remaining
    FROM public.user_roles
    WHERE role::text = 'super_admin' AND user_id <> _user_id;

    IF v_remaining = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last Super Admin account';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;

  PERFORM public.log_security_event('role_removed', _user_id, jsonb_build_object('role', _role::text));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_remove_support_agent(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'support'::app_role;
  DELETE FROM public.support_agents WHERE user_id = _user_id;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_search_users(_q text, _limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_is_super boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _q IS NULL OR length(trim(_q)) < 2 THEN RETURN; END IF;
  v_is_super := public.is_super_admin(auth.uid());
  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name, p.phone, COALESCE(p.status,'active')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE (u.email ILIKE '%'||_q||'%' OR p.full_name ILIKE '%'||_q||'%' OR p.phone ILIKE '%'||_q||'%')
    AND (v_is_super OR NOT EXISTS (
      SELECT 1 FROM public.user_roles s WHERE s.user_id = u.id AND s.role::text = 'super_admin'
    ))
  ORDER BY u.email
  LIMIT LEAST(GREATEST(_limit,1), 25);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_shop_status(_shop_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.shops SET status = _status,
    is_open = CASE WHEN _status='suspended' THEN false ELSE is_open END,
    updated_at = now()
  WHERE id = _shop_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_support_agent(_user_email text, _is_active boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _target uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO _target FROM auth.users WHERE lower(email) = lower(trim(_user_email));
  IF _target IS NULL THEN RAISE EXCEPTION 'No user with email %', _user_email; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_target,'support'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.support_agents(user_id, is_active) VALUES (_target, _is_active)
    ON CONFLICT (user_id) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();
  RETURN _target;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target_privileged boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can change account status';
  END IF;

  IF _status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status: %', _status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin', 'super_admin')
  ) INTO v_target_privileged;

  IF v_target_privileged AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super Admin only: this account is privileged';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own account status';
  END IF;

  UPDATE public.profiles
  SET status = _status,
      is_active = (_status = 'active'),
      updated_at = now()
  WHERE id = _user_id;

  PERFORM public.log_security_event(
    CASE WHEN _status = 'active' THEN 'account_activated' ELSE 'account_suspended' END,
    _user_id,
    jsonb_build_object('status', _status)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_support_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _out jsonb; _agents jsonb;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'open', COUNT(*) FILTER (WHERE status IN ('open','assigned','in_progress')),
    'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
    'closed', COUNT(*) FILTER (WHERE status = 'closed'),
    'avg_resolution_minutes', COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60.0)
       FILTER (WHERE resolved_at IS NOT NULL), 0)::numeric
  ) INTO _out FROM public.support_tickets;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', a.user_id,
    'display_name', COALESCE(a.display_name, p.full_name, 'Agent'),
    'is_active', a.is_active,
    'assigned', COALESCE(x.assigned,0),
    'resolved', COALESCE(x.resolved,0),
    'avg_minutes', COALESCE(x.avg_minutes,0)
  )), '[]'::jsonb)
  INTO _agents
  FROM public.support_agents a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed')) AS assigned,
           COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
           COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60.0)
             FILTER (WHERE resolved_at IS NOT NULL),0)::numeric AS avg_minutes
    FROM public.support_tickets t WHERE t.assigned_to = a.user_id
  ) x ON true;

  RETURN _out || jsonb_build_object('agents', _agents);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_transfer_partner(_partner_id uuid, _shop_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id) THEN RAISE EXCEPTION 'Shop not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE partner_id = _partner_id AND status IN ('packed'::order_status,'out_for_delivery'::order_status)) THEN
    RAISE EXCEPTION 'Partner has active orders, cannot transfer';
  END IF;
  UPDATE public.delivery_partners SET shop_id = _shop_id, updated_at = now() WHERE id = _partner_id;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_unassign_shop_owner(_shop_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _old_owner uuid;
BEGIN
  IF NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _shop_id IS NULL THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  SELECT owner_id INTO _old_owner
  FROM public.shops
  WHERE id = _shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF _old_owner IS NULL THEN
    RETURN _shop_id;
  END IF;

  UPDATE public.shops
  SET owner_id = NULL, updated_at = now()
  WHERE id = _shop_id;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE owner_id = _old_owner) THEN
    DELETE FROM public.user_roles
    WHERE user_id = _old_owner AND role = 'shopkeeper'::app_role;
  END IF;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_old_owner, 'Shop removed', 'A shop has been removed from your shopkeeper account.', 'role_request',
    jsonb_build_object('url','/dashboard','shop_id',_shop_id));

  RETURN _shop_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(_order_id uuid, _status order_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.orders SET status = _status, updated_at = now() WHERE id = _order_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_shop(_shop_id uuid, _name text DEFAULT NULL::text, _address text DEFAULT NULL::text, _city text DEFAULT NULL::text, _state text DEFAULT NULL::text, _pincode text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _radius numeric DEFAULT NULL::numeric, _is_open boolean DEFAULT NULL::boolean, _logo_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _pincode IS NOT NULL AND _pincode !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'Invalid pincode'; END IF;
  IF _radius IS NOT NULL AND (_radius <= 0 OR _radius > 100) THEN RAISE EXCEPTION 'Invalid radius'; END IF;
  IF _lat IS NOT NULL AND (_lat < -90 OR _lat > 90) THEN RAISE EXCEPTION 'Invalid latitude'; END IF;
  IF _lng IS NOT NULL AND (_lng < -180 OR _lng > 180) THEN RAISE EXCEPTION 'Invalid longitude'; END IF;
  UPDATE public.shops SET
    name = COALESCE(_name, name), address = COALESCE(_address, address),
    city = COALESCE(_city, city), state = COALESCE(_state, state),
    pincode = COALESCE(_pincode, pincode), phone = COALESCE(_phone, phone),
    latitude = COALESCE(_lat, latitude), longitude = COALESCE(_lng, longitude),
    service_radius_km = COALESCE(_radius, service_radius_km),
    is_open = COALESCE(_is_open, is_open), logo_url = COALESCE(_logo_url, logo_url),
    updated_at = now()
  WHERE id = _shop_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_upsert_delivery_zone(_data jsonb)
 RETURNS delivery_zone_settings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.delivery_zone_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF (_data->>'id') IS NOT NULL AND (_data->>'id') <> '' THEN
    UPDATE public.delivery_zone_settings SET
      state = COALESCE(_data->>'state', state),
      city = COALESCE(_data->>'city', city),
      pin_code = COALESCE(_data->>'pin_code', pin_code),
      is_active = COALESCE((_data->>'is_active')::boolean, is_active),
      delivery_radius_km = COALESCE((_data->>'delivery_radius_km')::numeric, delivery_radius_km),
      standard_enabled = COALESCE((_data->>'standard_enabled')::boolean, standard_enabled),
      standard_fee = COALESCE((_data->>'standard_fee')::numeric, standard_fee),
      standard_eta_minutes = COALESCE(_data->>'standard_eta_minutes', standard_eta_minutes),
      minimum_order_standard = NULLIF(_data->>'minimum_order_standard','')::numeric,
      fast_enabled = COALESCE((_data->>'fast_enabled')::boolean, fast_enabled),
      fast_fee = COALESCE((_data->>'fast_fee')::numeric, fast_fee),
      fast_eta_minutes = COALESCE(_data->>'fast_eta_minutes', fast_eta_minutes),
      minimum_order_fast = NULLIF(_data->>'minimum_order_fast','')::numeric,
      express_enabled = COALESCE((_data->>'express_enabled')::boolean, express_enabled),
      express_fee = COALESCE((_data->>'express_fee')::numeric, express_fee),
      express_eta_minutes = COALESCE(_data->>'express_eta_minutes', express_eta_minutes),
      minimum_order_express = NULLIF(_data->>'minimum_order_express','')::numeric,
      handling_enabled = COALESCE((_data->>'handling_enabled')::boolean, handling_enabled),
      handling_type = COALESCE(_data->>'handling_type', handling_type),
      default_handling_fee = COALESCE((_data->>'default_handling_fee')::numeric, default_handling_fee),
      handling_percentage = COALESCE((_data->>'handling_percentage')::numeric, handling_percentage),
      free_handling_above = NULLIF(_data->>'free_handling_above','')::numeric,
      standard_handling_fee = NULLIF(_data->>'standard_handling_fee','')::numeric,
      fast_handling_fee = NULLIF(_data->>'fast_handling_fee','')::numeric,
      express_handling_fee = NULLIF(_data->>'express_handling_fee','')::numeric,
      updated_at = now()
    WHERE id = (_data->>'id')::uuid
    RETURNING * INTO r;
  ELSE
    INSERT INTO public.delivery_zone_settings(
      state, city, pin_code, is_active, delivery_radius_km,
      standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
      fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
      express_enabled, express_fee, express_eta_minutes, minimum_order_express,
      handling_enabled, handling_type, default_handling_fee, handling_percentage,
      free_handling_above, standard_handling_fee, fast_handling_fee, express_handling_fee
    ) VALUES (
      _data->>'state', _data->>'city', _data->>'pin_code',
      COALESCE((_data->>'is_active')::boolean, true),
      COALESCE((_data->>'delivery_radius_km')::numeric, 10),
      COALESCE((_data->>'standard_enabled')::boolean, true),
      COALESCE((_data->>'standard_fee')::numeric, 0),
      COALESCE(_data->>'standard_eta_minutes','45-60'),
      NULLIF(_data->>'minimum_order_standard','')::numeric,
      COALESCE((_data->>'fast_enabled')::boolean, false),
      COALESCE((_data->>'fast_fee')::numeric, 49),
      COALESCE(_data->>'fast_eta_minutes','20-30'),
      NULLIF(_data->>'minimum_order_fast','')::numeric,
      COALESCE((_data->>'express_enabled')::boolean, false),
      COALESCE((_data->>'express_fee')::numeric, 99),
      COALESCE(_data->>'express_eta_minutes','10-15'),
      NULLIF(_data->>'minimum_order_express','')::numeric,
      COALESCE((_data->>'handling_enabled')::boolean, false),
      COALESCE(_data->>'handling_type','fixed'),
      COALESCE((_data->>'default_handling_fee')::numeric, 0),
      COALESCE((_data->>'handling_percentage')::numeric, 0),
      NULLIF(_data->>'free_handling_above','')::numeric,
      NULLIF(_data->>'standard_handling_fee','')::numeric,
      NULLIF(_data->>'fast_handling_fee','')::numeric,
      NULLIF(_data->>'express_handling_fee','')::numeric
    )
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $function$;

CREATE OR REPLACE FUNCTION public.assign_ticket(_ticket_id uuid, _agent_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _creator uuid; _num text;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT has_role(_agent_id,'support'::app_role) THEN
    RAISE EXCEPTION 'Target user is not a support agent';
  END IF;

  UPDATE public.ticket_assignments SET unassigned_at = now()
    WHERE ticket_id = _ticket_id AND unassigned_at IS NULL;
  INSERT INTO public.ticket_assignments(ticket_id, assigned_to, assigned_by)
    VALUES (_ticket_id, _agent_id, _uid);

  UPDATE public.support_tickets
    SET assigned_to = _agent_id,
        status = CASE WHEN status = 'open' THEN 'assigned'::ticket_status ELSE status END,
        updated_at = now()
    WHERE id = _ticket_id
    RETURNING user_id, ticket_number INTO _creator, _num;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_agent_id, 'Ticket assigned', 'Ticket ' || COALESCE(_num,'') || ' has been assigned to you.', 'support',
    jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/tickets/' || _ticket_id));

  IF _creator IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_creator, 'Ticket assigned', 'A support executive is now handling your ticket.', 'support',
      jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _o record;
  _shop_owner uuid;
  _new_pay payment_status;
  _admin record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND user_id = _uid;
  IF _o IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF _o.status NOT IN ('placed'::order_status,'payment_confirmed'::order_status,
                       'awaiting_shop'::order_status,'accepted_by_shop'::order_status) THEN
    RAISE EXCEPTION 'Order can no longer be cancelled';
  END IF;

  -- Restore stock in shop_products for the assigned shop
  IF _o.shop_id IS NOT NULL THEN
    UPDATE public.shop_products sp
      SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
      AND sp.product_id = oi.product_id
      AND sp.shop_id = _o.shop_id;
  END IF;

  -- Also keep the legacy products.stock in sync where present
  PERFORM public.restore_order_stock(_order_id);

  -- Compute refund state for paid non-COD orders
  _new_pay := _o.payment_status;
  IF _o.payment_method <> 'cod'::payment_method AND _o.payment_status = 'paid'::payment_status THEN
    _new_pay := 'refund_initiated'::payment_status;
  END IF;

  UPDATE public.orders
    SET status = 'cancelled'::order_status,
        cancel_reason = _reason,
        cancelled_at = now(),
        payment_status = _new_pay,
        assignment_expires_at = NULL,
        updated_at = now()
    WHERE id = _order_id;

  -- Notify customer
  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_uid, 'Order cancelled',
    'Your order ' || COALESCE(_o.order_number,'') || ' has been cancelled.'
      || CASE WHEN _new_pay = 'refund_initiated'::payment_status THEN ' Refund is being processed.' ELSE '' END,
    'order',
    jsonb_build_object('order_id', _order_id, 'url', '/customer/orders/' || _order_id));

  -- Notify assigned shop owner
  IF _o.shop_id IS NOT NULL THEN
    SELECT owner_id INTO _shop_owner FROM public.shops WHERE id = _o.shop_id;
    IF _shop_owner IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, category, data)
      VALUES (_shop_owner, 'Order cancelled by customer',
        'Order ' || COALESCE(_o.order_number,'') || ' was cancelled. Reason: ' || COALESCE(_reason,'—'),
        'order',
        jsonb_build_object('order_id', _order_id, 'url', '/shopkeeper/orders/' || _order_id));
    END IF;
  END IF;

  -- Notify admins
  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_admin.user_id, 'Customer cancelled order',
      'Order ' || COALESCE(_o.order_number,'') || ' cancelled. Reason: ' || COALESCE(_reason,'—'),
      'order',
      jsonb_build_object('order_id', _order_id, 'url', '/admin/orders/' || _order_id));
  END LOOP;
END; $function$;

CREATE OR REPLACE FUNCTION public.category_filter_facets(_pincode text DEFAULT NULL::text, _category_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT sp.product_id, MIN(sp.price) AS min_price, SUM(sp.stock)::int AS total_stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
    GROUP BY sp.product_id
  ),
  prods AS (
    SELECT p.id, p.brand, p.unit, p.rating, p.mrp, p.category_id, p.subcategory_id,
           p.delivery_minutes,
           COALESCE(e.min_price, p.price) AS price
    FROM public.products p
    JOIN eligible e ON e.product_id = p.id
    WHERE p.is_available = true
      AND (_category_id IS NULL
           OR p.category_id = _category_id
           OR EXISTS (SELECT 1 FROM public.product_categories pc
                      WHERE pc.product_id = p.id AND pc.category_id = _category_id))
  ),
  sizes AS (
    SELECT DISTINCT pr.id AS product_id, lbl
    FROM prods pr
    CROSS JOIN LATERAL (
      SELECT NULLIF(btrim(pv.size || ' ' || COALESCE(pv.unit, '')), '') AS lbl
      FROM public.product_variants pv
      WHERE pv.product_id = pr.id AND pv.is_available = true
      UNION
      SELECT NULLIF(btrim(pr.unit), '')
    ) s
    WHERE lbl IS NOT NULL
  ),
  prod_subs AS (
    SELECT DISTINCT pr.id AS product_id, sid FROM prods pr
    CROSS JOIN LATERAL (
      SELECT pr.subcategory_id AS sid WHERE pr.subcategory_id IS NOT NULL
      UNION
      SELECT ps.subcategory_id FROM public.product_subcategories ps WHERE ps.product_id = pr.id
    ) u
  ),
  subcats AS (
    SELECT sc.id AS sub_id, sc.name, sc.display_order, count(DISTINCT x.product_id) AS cnt
    FROM prod_subs x
    JOIN public.subcategories sc ON sc.id = x.sid
    WHERE sc.is_active = true
      AND (_category_id IS NULL OR sc.category_id = _category_id)
    GROUP BY sc.id, sc.name, sc.display_order
  ),
  delivery AS (
    SELECT CASE WHEN delivery_minutes <= 15 THEN 'express'
                WHEN delivery_minutes <= 30 THEN 'fast'
                ELSE 'standard' END AS key,
           count(*) AS cnt
    FROM prods
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM prods),
    'min_price', (SELECT COALESCE(floor(min(price)), 0) FROM prods),
    'max_price', (SELECT COALESCE(ceil(max(price)), 0) FROM prods),
    'brands', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'label')
      FROM (
        SELECT jsonb_build_object('label', btrim(brand), 'count', count(*)) AS x
        FROM prods WHERE NULLIF(btrim(COALESCE(brand, '')), '') IS NOT NULL
        GROUP BY btrim(brand)
      ) b
    ), '[]'::jsonb),
    'sizes', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'label')
      FROM (
        SELECT jsonb_build_object('label', lbl, 'count', count(DISTINCT product_id)) AS x
        FROM sizes GROUP BY lbl
      ) s2
    ), '[]'::jsonb),
    'subcategories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', sub_id, 'label', name, 'count', cnt)
                       ORDER BY display_order, name)
      FROM subcats
    ), '[]'::jsonb),
    'delivery', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'value', key,
               'label', CASE key WHEN 'express' THEN 'Express (under 15 min)'
                                 WHEN 'fast' THEN 'Fast (under 30 min)'
                                 ELSE 'Standard' END,
               'count', cnt)
               ORDER BY CASE key WHEN 'express' THEN 1 WHEN 'fast' THEN 2 ELSE 3 END)
      FROM delivery
    ), '[]'::jsonb),
    'ratings', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'value')::numeric DESC)
      FROM (
        SELECT jsonb_build_object('value', v, 'count', (SELECT count(*) FROM prods WHERE rating >= v)) AS x
        FROM (VALUES (4.0), (3.0), (2.0)) t(v)
        WHERE EXISTS (SELECT 1 FROM prods WHERE rating >= t.v)
      ) r
    ), '[]'::jsonb),
    'discounts', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'value')::int DESC)
      FROM (
        SELECT jsonb_build_object('value', v, 'count', (
                 SELECT count(*) FROM prods
                 WHERE mrp > 0 AND round((mrp - price) / mrp * 100) >= t.v)) AS x
        FROM (VALUES (50), (30), (20), (10)) t(v)
        WHERE EXISTS (SELECT 1 FROM prods
                      WHERE mrp > 0 AND round((mrp - price) / mrp * 100) >= t.v)
      ) d
    ), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.compute_handling_fee(_pincode text, _delivery_type text, _subtotal numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  z public.delivery_zone_settings;
  fee numeric := 0;
  tier_override numeric;
BEGIN
  SELECT * INTO z FROM public.delivery_zone_settings WHERE pin_code = _pincode AND is_active = true LIMIT 1;
  IF NOT FOUND OR NOT z.handling_enabled THEN RETURN 0; END IF;
  IF z.free_handling_above IS NOT NULL AND _subtotal >= z.free_handling_above THEN RETURN 0; END IF;

  tier_override := CASE _delivery_type
    WHEN 'standard_delivery' THEN z.standard_handling_fee
    WHEN 'fast_delivery' THEN z.fast_handling_fee
    WHEN 'express_delivery' THEN z.express_handling_fee
    ELSE NULL
  END;

  IF tier_override IS NOT NULL THEN
    RETURN GREATEST(0, tier_override);
  END IF;

  IF z.handling_type = 'percent' THEN
    fee := ROUND(COALESCE(_subtotal,0) * COALESCE(z.handling_percentage,0) / 100.0, 2);
  ELSE
    fee := COALESCE(z.default_handling_fee, 0);
  END IF;
  RETURN GREATEST(0, fee);
END; $function$;

CREATE OR REPLACE FUNCTION public.count_eligible_shops(_pincode text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int
  FROM public.shops s
  WHERE s.is_open
    AND s.status = 'active'
    AND s.owner_id IS NOT NULL
    AND (
      (_pincode IS NOT NULL AND s.pincode = _pincode)
      OR (
        _lat IS NOT NULL AND _lng IS NOT NULL
        AND public.haversine_km(_lat, _lng, s.latitude, s.longitude) <= COALESCE(s.service_radius_km, 15)
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.create_delivery_partner(_name text, _phone text, _vehicle text DEFAULT NULL::text, _user_email text DEFAULT NULL::text, _shop_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can create delivery partners';
  END IF;
  RETURN public.admin_create_delivery_partner(_name, _phone, _vehicle, _user_email);
END $function$;

CREATE OR REPLACE FUNCTION public.create_support_ticket(_title text, _description text, _category ticket_category, _order_id uuid DEFAULT NULL::uuid, _shop_id uuid DEFAULT NULL::uuid, _partner_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _id uuid; _role text; r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'Title required'; END IF;
  IF _description IS NULL OR length(trim(_description)) = 0 THEN RAISE EXCEPTION 'Description required'; END IF;

  _role := CASE
    WHEN has_role(_uid,'admin'::app_role) THEN 'admin'
    WHEN has_role(_uid,'support'::app_role) THEN 'support'
    WHEN has_role(_uid,'shopkeeper'::app_role) THEN 'shopkeeper'
    WHEN has_role(_uid,'delivery'::app_role) THEN 'delivery'
    ELSE 'customer'
  END;

  INSERT INTO public.support_tickets(user_id, role_at_creation, title, description, category, order_id, shop_id, partner_id)
  VALUES (_uid, _role, _title, _description, _category, _order_id, _shop_id, _partner_id)
  RETURNING id INTO _id;

  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'support'::app_role LOOP
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (r.user_id, 'New support ticket', _title, 'support',
      jsonb_build_object('ticket_id', _id, 'url', '/support/tickets/' || _id));
  END LOOP;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_uid, 'Ticket created', 'We received your support request and will respond shortly.', 'support',
    jsonb_build_object('ticket_id', _id, 'url', '/support/ticket/' || _id));

  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.current_user_partner_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.delivery_partners WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.debug_shop_routing(_pincode text, _lat double precision, _lng double precision, _order_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(shop_id uuid, shop_name text, shop_pincode text, is_open boolean, has_owner boolean, distance_km numeric, service_radius_km numeric, pincode_match boolean, within_radius boolean, previously_rejected boolean, missing_items integer, eligible boolean, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _excl uuid[] := '{}';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF _order_id IS NOT NULL THEN
    SELECT rejected_shop_ids INTO _excl FROM public.orders WHERE id = _order_id;
    _excl := COALESCE(_excl, '{}');
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.pincode,
    s.is_open,
    (s.owner_id IS NOT NULL) AS has_owner,
    ROUND(public.haversine_km(s.latitude, s.longitude, _lat, _lng)::numeric, 2),
    s.service_radius_km::numeric,
    (s.pincode = _pincode) AS pincode_match,
    (public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km) AS within_radius,
    (s.id = ANY(_excl)) AS previously_rejected,
    CASE
      WHEN _order_id IS NOT NULL THEN (
        SELECT COUNT(*)::int FROM public.order_items oi
        LEFT JOIN public.shop_products sp
          ON sp.product_id = oi.product_id AND sp.shop_id = s.id
        WHERE oi.order_id = _order_id
          AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
      )
      ELSE 0
    END AS missing_items,
    (
      s.is_open
      AND s.owner_id IS NOT NULL
      AND s.pincode = _pincode
      AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
      AND NOT (s.id = ANY(_excl))
      AND (_order_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        LEFT JOIN public.shop_products sp
          ON sp.product_id = oi.product_id AND sp.shop_id = s.id
        WHERE oi.order_id = _order_id
          AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
      ))
    ) AS eligible,
    CASE
      WHEN NOT s.is_open THEN 'shop_closed'
      WHEN s.owner_id IS NULL THEN 'no_shopkeeper_assigned'
      WHEN s.pincode <> _pincode THEN 'pincode_mismatch'
      WHEN public.haversine_km(s.latitude, s.longitude, _lat, _lng) > s.service_radius_km THEN 'outside_service_radius'
      WHEN s.id = ANY(_excl) THEN 'previously_rejected'
      WHEN _order_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.order_items oi
        LEFT JOIN public.shop_products sp
          ON sp.product_id = oi.product_id AND sp.shop_id = s.id
        WHERE oi.order_id = _order_id
          AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
      ) THEN 'missing_stock'
      ELSE 'eligible'
    END AS reason
  FROM public.shops s
  ORDER BY
    (s.is_open AND s.owner_id IS NOT NULL AND s.pincode = _pincode) DESC,
    public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC;
END $function$;

CREATE OR REPLACE FUNCTION public.delete_delivery_partner(_partner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can remove delivery partners';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE partner_id=_partner_id AND status IN ('packed'::order_status,'out_for_delivery'::order_status)) THEN
    RAISE EXCEPTION 'Partner has active orders';
  END IF;
  SELECT user_id INTO _user FROM public.delivery_partners WHERE id=_partner_id;
  DELETE FROM public.delivery_partners WHERE id=_partner_id;
  IF _user IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id=_user AND role='delivery'::app_role;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.delete_my_account_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_check jsonb;
  v_shop_ids uuid[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  v_check := public.account_deletion_check();
  IF NOT (v_check->>'allowed')::boolean THEN
    RAISE EXCEPTION '%', v_check->>'reason';
  END IF;

  -- Shopkeeper: release ownership + delete shop-specific inventory (NOT catalog products)
  SELECT coalesce(array_agg(id), '{}') INTO v_shop_ids FROM public.shops WHERE owner_id = uid;
  IF array_length(v_shop_ids, 1) > 0 THEN
    DELETE FROM public.shop_collection_items
      WHERE collection_id IN (SELECT id FROM public.shop_collections WHERE shop_id = ANY(v_shop_ids));
    DELETE FROM public.shop_collections WHERE shop_id = ANY(v_shop_ids);
    DELETE FROM public.shop_category_items
      WHERE category_id IN (SELECT id FROM public.shop_categories WHERE shop_id = ANY(v_shop_ids));
    DELETE FROM public.shop_categories WHERE shop_id = ANY(v_shop_ids);
    DELETE FROM public.offers WHERE shop_id = ANY(v_shop_ids);
    DELETE FROM public.shop_delivery_assignments WHERE shop_id = ANY(v_shop_ids);
    DELETE FROM public.shop_products WHERE shop_id = ANY(v_shop_ids);
    UPDATE public.shops
       SET owner_id = NULL, is_open = false, phone = NULL, status = 'inactive', updated_at = now()
     WHERE id = ANY(v_shop_ids);
  END IF;

  -- Delivery partner: anonymise so historical deliveries stay intact
  UPDATE public.delivery_partners
     SET user_id = gen_random_uuid(),
         name = 'Deleted partner',
         phone = NULL,
         vehicle = NULL,
         shop_id = NULL,
         is_online = false,
         availability_status = 'offline',
         current_lat = NULL,
         current_lng = NULL,
         current_order_id = NULL,
         updated_at = now()
   WHERE user_id = uid;

  -- Anonymise personal contact details on retained business records
  UPDATE public.orders
     SET address = coalesce(address, '{}'::jsonb) || jsonb_build_object('name', 'Deleted user', 'phone', NULL)
   WHERE user_id = uid;

  -- Personal data
  DELETE FROM public.cart_items WHERE user_id = uid;
  DELETE FROM public.wishlist_items WHERE user_id = uid;
  DELETE FROM public.addresses WHERE user_id = uid;
  DELETE FROM public.reviews WHERE user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid;
  DELETE FROM public.notification_preferences WHERE user_id = uid;
  DELETE FROM public.onesignal_subscriptions WHERE user_id = uid;
  DELETE FROM public.role_requests WHERE user_id = uid;
  DELETE FROM public.support_agents WHERE user_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;

  UPDATE public.profiles
     SET full_name = 'Deleted user', phone = NULL, email = NULL, avatar_url = NULL,
         address = NULL, state = NULL, city = NULL, pincode = NULL,
         shop_id = NULL, is_active = false, status = 'deleted', updated_at = now()
   WHERE id = uid;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.effective_available_stock(_shop_product_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(
    0,
    (SELECT stock FROM shop_products WHERE id = _shop_product_id)
    - COALESCE((
        SELECT SUM(quantity) FROM inventory_reservations
        WHERE shop_product_id = _shop_product_id
          AND released = false
          AND expires_at > now()
      ), 0)::int
  )
$function$;

CREATE OR REPLACE FUNCTION public.find_best_shop_for_cart(_user_id uuid, _lat double precision, _lng double precision, _pincode text, _exclude uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _shop_id uuid;
BEGIN
  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(_exclude))
    AND (_pincode IS NULL OR s.pincode = _pincode)
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci
      LEFT JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = s.id
      WHERE ci.user_id = _user_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < ci.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((SELECT AVG(r.rating)::numeric FROM public.reviews r
                     JOIN public.shop_products sp2 ON sp2.product_id = r.product_id
                     WHERE sp2.shop_id = s.id), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $function$;

CREATE OR REPLACE FUNCTION public.find_catalog_duplicate(_name text, _shop_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, brand text, unit text, image text, already_added boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id,
         p.name,
         p.brand,
         p.unit,
         COALESCE(p.cover_image, p.image_url, (p.image_gallery)[1]) AS image,
         EXISTS (
           SELECT 1 FROM public.shop_products sp
            WHERE sp.product_id = p.id AND sp.shop_id = _shop_id
         ) AS already_added
    FROM public.products p
   WHERE public.normalize_product_name(_name) <> ''
     AND p.name_normalized = public.normalize_product_name(_name)
   LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.find_nearest_partner_for_order(_order_id uuid, _exclude uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _shop_lat double precision;
  _shop_lng double precision;
  _partner_id uuid;
BEGIN
  SELECT s.latitude, s.longitude INTO _shop_lat, _shop_lng
  FROM public.orders o
  JOIN public.shops s ON s.id = o.shop_id
  WHERE o.id = _order_id;

  IF _shop_lat IS NULL OR _shop_lng IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT dp.id INTO _partner_id
  FROM public.delivery_partners dp
  WHERE dp.is_online = true
    AND dp.current_lat IS NOT NULL
    AND dp.current_lng IS NOT NULL
    AND NOT (dp.id = ANY(_exclude))
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o2
      WHERE o2.partner_id = dp.id
        AND o2.status IN ('out_for_delivery'::order_status)
    )
  ORDER BY public.haversine_km(dp.current_lat, dp.current_lng, _shop_lat, _shop_lng) ASC
  LIMIT 1;

  RETURN _partner_id;
END $function$;

CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_cart(_user_id uuid, _lat double precision, _lng double precision, _exclude uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- kept for backward compatibility; delegates to pincode-aware version with NULL pincode
  RETURN public.find_best_shop_for_cart(_user_id, _lat, _lng, NULL, _exclude);
END $function$;

CREATE OR REPLACE FUNCTION public.find_nearest_shop_for_order(_order_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _shop_id uuid; _lat double precision; _lng double precision; _pin text; _excl uuid[];
BEGIN
  SELECT delivery_lat, delivery_lng, delivery_pincode, rejected_shop_ids
    INTO _lat, _lng, _pin, _excl
  FROM public.orders WHERE id = _order_id;
  IF _lat IS NULL THEN RETURN NULL; END IF;

  SELECT s.id INTO _shop_id
  FROM public.shops s
  WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
    AND NOT (s.id = ANY(COALESCE(_excl, '{}'::uuid[])))
    AND (_pin IS NULL OR s.pincode = _pin)
    AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      LEFT JOIN public.shop_products sp ON sp.product_id = oi.product_id AND sp.shop_id = s.id
      WHERE oi.order_id = _order_id
        AND (sp.id IS NULL OR sp.is_available = false OR sp.stock < oi.quantity)
    )
  ORDER BY public.haversine_km(s.latitude, s.longitude, _lat, _lng) ASC,
           COALESCE((SELECT AVG(r.rating)::numeric FROM public.reviews r
                     JOIN public.shop_products sp2 ON sp2.product_id = r.product_id
                     WHERE sp2.shop_id = s.id), 0) DESC
  LIMIT 1;
  RETURN _shop_id;
END $function$;

CREATE OR REPLACE FUNCTION public.get_delivery_options_for_pincode(_pincode text)
 RETURNS TABLE(pin_code text, state text, city text, is_active boolean, standard_enabled boolean, standard_fee numeric, standard_eta_minutes text, minimum_order_standard numeric, fast_enabled boolean, fast_fee numeric, fast_eta_minutes text, minimum_order_fast numeric, express_enabled boolean, express_fee numeric, express_eta_minutes text, minimum_order_express numeric, handling_enabled boolean, handling_type text, default_handling_fee numeric, handling_percentage numeric, free_handling_above numeric, standard_handling_fee numeric, fast_handling_fee numeric, express_handling_fee numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT pin_code, state, city, is_active,
    standard_enabled, standard_fee, standard_eta_minutes, minimum_order_standard,
    fast_enabled, fast_fee, fast_eta_minutes, minimum_order_fast,
    express_enabled, express_fee, express_eta_minutes, minimum_order_express,
    handling_enabled, handling_type, default_handling_fee, handling_percentage,
    free_handling_above, standard_handling_fee, fast_handling_fee, express_handling_fee
  FROM public.delivery_zone_settings
  WHERE pin_code = _pincode AND is_active = true
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_partner_tracking(_order_id uuid)
 RETURNS TABLE(id uuid, name text, vehicle text, rating numeric, current_lat double precision, current_lng double precision, eta_minutes integer, availability_status text, status_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT dp.id, dp.name, dp.vehicle, dp.rating,
         dp.current_lat, dp.current_lng, dp.eta_minutes,
         dp.availability_status, dp.status_updated_at
  FROM public.orders o
  JOIN public.delivery_partners dp ON dp.id = o.partner_id
  WHERE o.id = _order_id
    AND (
      o.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
      OR dp.user_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(NEW.email, ''));
  _phone text := coalesce(NEW.raw_user_meta_data->>'phone', NEW.phone, '');
  _name  text := coalesce(NEW.raw_user_meta_data->>'full_name', '');
  _state text := NULLIF(NEW.raw_user_meta_data->>'state', '');
  _city  text := NULLIF(NEW.raw_user_meta_data->>'city', '');
  _pin   text := NULLIF(NEW.raw_user_meta_data->>'pincode', '');
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, state, city, pincode)
  VALUES (NEW.id, _name, _phone, NULLIF(_email, ''), _state, _city, _pin)
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
        phone     = COALESCE(NULLIF(EXCLUDED.phone,''),     public.profiles.phone),
        email     = COALESCE(EXCLUDED.email,                public.profiles.email),
        state     = COALESCE(EXCLUDED.state,                public.profiles.state),
        city      = COALESCE(EXCLUDED.city,                 public.profiles.city),
        pincode   = COALESCE(EXCLUDED.pincode,              public.profiles.pincode);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
    ON CONFLICT (user_id, role) DO NOTHING;

  IF _email = 'eshanthakur767@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _email = 'eshanthaku959@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'shopkeeper')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _email = 'aroopsinghchinder@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'delivery')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.delivery_partners (user_id, name, phone, is_online)
    VALUES (NEW.id, COALESCE(NULLIF(_name,''),'Delivery Partner'), _phone, false)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.role = _role
        OR (_role::text = 'admin' AND ur.role::text = 'super_admin')
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT 2 * 6371 * asin(sqrt(
    sin(radians((lat2 - lat1) / 2))^2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians((lng2 - lng1) / 2))^2
  ));
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text = 'super_admin'
  )
$function$;

CREATE OR REPLACE FUNCTION public.list_category_products(_pincode text DEFAULT NULL::text, _category_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text, _brands text[] DEFAULT NULL::text[], _sizes text[] DEFAULT NULL::text[], _subcategory_ids uuid[] DEFAULT NULL::uuid[], _min_price numeric DEFAULT NULL::numeric, _max_price numeric DEFAULT NULL::numeric, _min_rating numeric DEFAULT NULL::numeric, _min_discount integer DEFAULT NULL::integer, _sort text DEFAULT 'relevance'::text, _limit integer DEFAULT 60, _subcategory_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, slug text, name text, unit text, price numeric, mrp numeric, image_url text, delivery_minutes integer, stock integer, rating numeric, category_id uuid, brand text, subcategory_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT sp.product_id, MIN(sp.price) AS min_price, SUM(sp.stock)::int AS total_stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
    GROUP BY sp.product_id
  ),
  variant_img AS (
    SELECT DISTINCT ON (pv.product_id) pv.product_id,
           CASE WHEN pv.images IS NOT NULL AND array_length(pv.images, 1) > 0 THEN pv.images[1] ELSE NULL END AS img
    FROM public.product_variants pv WHERE pv.is_available = true
    ORDER BY pv.product_id, pv.is_default DESC, pv.display_order ASC, pv.created_at ASC
  )
  SELECT p.id, p.slug, p.name, p.unit,
         COALESCE(e.min_price, p.price) AS price, p.mrp,
         COALESCE(p.cover_image,
           CASE WHEN p.image_gallery IS NOT NULL AND array_length(p.image_gallery, 1) > 0 THEN p.image_gallery[1] ELSE NULL END,
           p.image_url, vi.img) AS image_url,
         p.delivery_minutes, COALESCE(e.total_stock, p.stock) AS stock, p.rating, p.category_id, p.brand,
         p.subcategory_id
  FROM public.products p
  JOIN eligible e ON e.product_id = p.id
  LEFT JOIN variant_img vi ON vi.product_id = p.id
  WHERE p.is_available = true
    AND (_category_id IS NULL
         OR p.category_id = _category_id
         OR EXISTS (SELECT 1 FROM public.product_categories pc
                    WHERE pc.product_id = p.id AND pc.category_id = _category_id))
    AND (_subcategory_id IS NULL OR p.subcategory_id = _subcategory_id)
    AND (_search IS NULL OR p.name ILIKE '%' || _search || '%')
    AND (_brands IS NULL OR array_length(_brands, 1) IS NULL
         OR btrim(COALESCE(p.brand, '')) = ANY(_brands))
    AND (_sizes IS NULL OR array_length(_sizes, 1) IS NULL
         OR btrim(COALESCE(p.unit, '')) = ANY(_sizes)
         OR EXISTS (SELECT 1 FROM public.product_variants pv2
                    WHERE pv2.product_id = p.id AND pv2.is_available = true
                      AND btrim(pv2.size || ' ' || COALESCE(pv2.unit, '')) = ANY(_sizes)))
    AND (_subcategory_ids IS NULL OR array_length(_subcategory_ids, 1) IS NULL
         OR EXISTS (SELECT 1 FROM public.product_categories pc3
                    WHERE pc3.product_id = p.id AND pc3.category_id = ANY(_subcategory_ids)))
    AND (_min_price IS NULL OR COALESCE(e.min_price, p.price) >= _min_price)
    AND (_max_price IS NULL OR COALESCE(e.min_price, p.price) <= _max_price)
    AND (_min_rating IS NULL OR p.rating >= _min_rating)
    AND (_min_discount IS NULL OR (p.mrp > 0
         AND round((p.mrp - COALESCE(e.min_price, p.price)) / p.mrp * 100) >= _min_discount))
  ORDER BY
    CASE WHEN _sort = 'price_asc'  THEN COALESCE(e.min_price, p.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc' THEN COALESCE(e.min_price, p.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'rating'     THEN p.rating END DESC NULLS LAST,
    p.is_featured DESC, p.is_bestseller DESC, p.rating DESC
  LIMIT GREATEST(_limit, 1);
$function$;

CREATE OR REPLACE FUNCTION public.list_category_products(_pincode text DEFAULT NULL::text, _category_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text, _brands text[] DEFAULT NULL::text[], _sizes text[] DEFAULT NULL::text[], _subcategory_ids uuid[] DEFAULT NULL::uuid[], _min_price numeric DEFAULT NULL::numeric, _max_price numeric DEFAULT NULL::numeric, _min_rating numeric DEFAULT NULL::numeric, _min_discount integer DEFAULT NULL::integer, _sort text DEFAULT 'relevance'::text, _limit integer DEFAULT 60, _subcategory_id uuid DEFAULT NULL::uuid, _delivery text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, slug text, name text, unit text, price numeric, mrp numeric, image_url text, delivery_minutes integer, stock integer, rating numeric, category_id uuid, brand text, subcategory_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT sp.product_id, MIN(sp.price) AS min_price, SUM(sp.stock)::int AS total_stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
    GROUP BY sp.product_id
  ),
  variant_img AS (
    SELECT DISTINCT ON (pv.product_id) pv.product_id,
           CASE WHEN pv.images IS NOT NULL AND array_length(pv.images, 1) > 0 THEN pv.images[1] ELSE NULL END AS img
    FROM public.product_variants pv WHERE pv.is_available = true
    ORDER BY pv.product_id, pv.is_default DESC, pv.display_order ASC, pv.created_at ASC
  )
  SELECT p.id, p.slug, p.name, p.unit,
         COALESCE(e.min_price, p.price) AS price, p.mrp,
         COALESCE(p.cover_image,
           CASE WHEN p.image_gallery IS NOT NULL AND array_length(p.image_gallery, 1) > 0 THEN p.image_gallery[1] ELSE NULL END,
           p.image_url, vi.img) AS image_url,
         p.delivery_minutes, COALESCE(e.total_stock, p.stock) AS stock, p.rating, p.category_id, p.brand,
         p.subcategory_id
  FROM public.products p
  JOIN eligible e ON e.product_id = p.id
  LEFT JOIN variant_img vi ON vi.product_id = p.id
  WHERE p.is_available = true
    AND (_category_id IS NULL
         OR p.category_id = _category_id
         OR EXISTS (SELECT 1 FROM public.product_categories pc
                    WHERE pc.product_id = p.id AND pc.category_id = _category_id))
    AND (_subcategory_id IS NULL
         OR p.subcategory_id = _subcategory_id
         OR EXISTS (SELECT 1 FROM public.product_subcategories ps
                    WHERE ps.product_id = p.id AND ps.subcategory_id = _subcategory_id))
    AND (_search IS NULL OR p.name ILIKE '%' || _search || '%')
    AND (_brands IS NULL OR array_length(_brands, 1) IS NULL
         OR btrim(COALESCE(p.brand, '')) = ANY(_brands))
    AND (_sizes IS NULL OR array_length(_sizes, 1) IS NULL
         OR btrim(COALESCE(p.unit, '')) = ANY(_sizes)
         OR EXISTS (SELECT 1 FROM public.product_variants pv2
                    WHERE pv2.product_id = p.id AND pv2.is_available = true
                      AND btrim(pv2.size || ' ' || COALESCE(pv2.unit, '')) = ANY(_sizes)))
    AND (_subcategory_ids IS NULL OR array_length(_subcategory_ids, 1) IS NULL
         OR p.subcategory_id = ANY(_subcategory_ids)
         OR EXISTS (SELECT 1 FROM public.product_subcategories ps2
                    WHERE ps2.product_id = p.id AND ps2.subcategory_id = ANY(_subcategory_ids)))
    AND (_delivery IS NULL OR array_length(_delivery, 1) IS NULL
         OR (CASE WHEN p.delivery_minutes <= 15 THEN 'express'
                  WHEN p.delivery_minutes <= 30 THEN 'fast'
                  ELSE 'standard' END) = ANY(_delivery))
    AND (_min_price IS NULL OR COALESCE(e.min_price, p.price) >= _min_price)
    AND (_max_price IS NULL OR COALESCE(e.min_price, p.price) <= _max_price)
    AND (_min_rating IS NULL OR p.rating >= _min_rating)
    AND (_min_discount IS NULL OR (p.mrp > 0
         AND round((p.mrp - COALESCE(e.min_price, p.price)) / p.mrp * 100) >= _min_discount))
  ORDER BY
    CASE WHEN _sort = 'price_asc'  THEN COALESCE(e.min_price, p.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc' THEN COALESCE(e.min_price, p.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'rating'     THEN p.rating END DESC NULLS LAST,
    p.is_featured DESC, p.is_bestseller DESC, p.rating DESC
  LIMIT GREATEST(_limit, 1);
$function$;

CREATE OR REPLACE FUNCTION public.list_category_subcategories(_category_id uuid, _pincode text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, slug text, image_url text, icon text, display_order integer, product_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT DISTINCT sp.product_id
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
  )
  SELECT sc.id, sc.name, sc.slug, sc.image_url, sc.icon, sc.display_order,
         COALESCE((
           SELECT count(*)::int FROM public.products p
           JOIN eligible e ON e.product_id = p.id
           WHERE p.is_available = true
             AND (p.subcategory_id = sc.id
                  OR EXISTS (SELECT 1 FROM public.product_subcategories ps
                             WHERE ps.product_id = p.id AND ps.subcategory_id = sc.id))
         ), 0) AS product_count
  FROM public.subcategories sc
  WHERE sc.category_id = _category_id AND sc.is_active = true
  ORDER BY sc.display_order, sc.name;
$function$;

CREATE OR REPLACE FUNCTION public.list_customer_products(_pincode text, _category_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text, _only_featured boolean DEFAULT false, _only_bestseller boolean DEFAULT false, _sort text DEFAULT 'relevance'::text, _limit integer DEFAULT 60, _ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, slug text, name text, unit text, price numeric, mrp numeric, image_url text, delivery_minutes integer, stock integer, rating numeric, category_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH rows AS (
    SELECT sp.product_id, sp.price, sp.mrp, sp.stock
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    WHERE sp.is_available = true AND sp.stock > 0
      AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND (_pincode IS NULL OR s.pincode = _pincode)
  ),
  best AS (
    -- The cheapest eligible shop row wins, and its own MRP travels with it
    SELECT DISTINCT ON (r.product_id) r.product_id, r.price AS min_price, r.mrp AS shop_mrp
    FROM rows r
    ORDER BY r.product_id, r.price ASC
  ),
  totals AS (
    SELECT r.product_id, SUM(r.stock)::int AS total_stock FROM rows r GROUP BY r.product_id
  ),
  eligible AS (
    SELECT b.product_id, b.min_price, b.shop_mrp, t.total_stock
    FROM best b JOIN totals t ON t.product_id = b.product_id
  ),
  variant_img AS (
    SELECT DISTINCT ON (pv.product_id) pv.product_id,
           CASE WHEN pv.images IS NOT NULL AND array_length(pv.images, 1) > 0 THEN pv.images[1] ELSE NULL END AS img
    FROM public.product_variants pv WHERE pv.is_available = true
    ORDER BY pv.product_id, pv.is_default DESC, pv.display_order ASC, pv.created_at ASC
  )
  SELECT p.id, p.slug, p.name, p.unit,
         COALESCE(e.min_price, p.price) AS price,
         GREATEST(COALESCE(e.min_price, p.price), COALESCE(e.shop_mrp, p.mrp, p.price)) AS mrp,
         COALESCE(p.cover_image,
           CASE WHEN p.image_gallery IS NOT NULL AND array_length(p.image_gallery, 1) > 0 THEN p.image_gallery[1] ELSE NULL END,
           p.image_url, vi.img) AS image_url,
         p.delivery_minutes, COALESCE(e.total_stock, p.stock) AS stock, p.rating, p.category_id
  FROM public.products p
  JOIN eligible e ON e.product_id = p.id
  LEFT JOIN variant_img vi ON vi.product_id = p.id
  WHERE p.is_available = true
    AND (_category_id IS NULL
         OR p.category_id = _category_id
         OR EXISTS (SELECT 1 FROM public.product_categories pc
                    WHERE pc.product_id = p.id AND pc.category_id = _category_id))
    AND (_search IS NULL
         OR p.name ILIKE '%' || _search || '%'
         OR EXISTS (SELECT 1 FROM public.product_categories pc2
                    JOIN public.categories c2 ON c2.id = pc2.category_id
                    WHERE pc2.product_id = p.id AND c2.name ILIKE '%' || _search || '%')
         OR EXISTS (SELECT 1 FROM public.categories c3
                    WHERE c3.id = p.category_id AND c3.name ILIKE '%' || _search || '%'))
    AND (NOT _only_featured OR p.is_featured = true)
    AND (NOT _only_bestseller OR p.is_bestseller = true)
    AND (_ids IS NULL OR p.id = ANY(_ids))
  ORDER BY
    CASE WHEN _sort = 'price_asc'  THEN COALESCE(e.min_price, p.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc' THEN COALESCE(e.min_price, p.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'rating'     THEN p.rating END DESC NULLS LAST,
    p.is_featured DESC, p.is_bestseller DESC, p.rating DESC
  LIMIT GREATEST(_limit, 1);
$function$;

CREATE OR REPLACE FUNCTION public.list_eligible_shops_for_cart(_pincode text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision)
 RETURNS TABLE(shop_id uuid, shop_name text, shop_address text, latitude double precision, longitude double precision, pincode text, service_radius_km numeric, distance_km numeric, delivery_minutes integer, price numeric, mrp numeric, stock integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _cart_count int;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _cart_count FROM public.cart_items WHERE user_id = _uid;
  IF _cart_count = 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH cart AS (
    SELECT ci.product_id, ci.variant_id, ci.quantity FROM public.cart_items ci WHERE ci.user_id = _uid
  ),
  shop_match AS (
    SELECT s.id AS shop_id, s.name, s.address, s.latitude, s.longitude, s.pincode, s.service_radius_km
    FROM public.shops s
    WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND (_pincode IS NULL OR s.pincode = _pincode)
      AND (_lat IS NULL OR _lng IS NULL OR public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km)
  ),
  eligible AS (
    SELECT sm.shop_id, sm.name, sm.address, sm.latitude, sm.longitude, sm.pincode, sm.service_radius_km,
           SUM(COALESCE(pv.selling_price, sp.price) * c.quantity) AS total_price,
           SUM(COALESCE(pv.mrp, sp.price) * c.quantity) AS total_mrp,
           MIN(COALESCE(pv.stock, sp.stock)) AS min_stock
    FROM shop_match sm
    JOIN cart c ON true
    JOIN public.shop_products sp ON sp.shop_id = sm.shop_id AND sp.product_id = c.product_id AND sp.is_available = true
    LEFT JOIN public.product_variants pv ON pv.id = c.variant_id AND pv.is_available = true
    WHERE COALESCE(pv.stock, sp.stock) >= c.quantity
    GROUP BY sm.shop_id, sm.name, sm.address, sm.latitude, sm.longitude, sm.pincode, sm.service_radius_km
    HAVING COUNT(*) = (SELECT COUNT(*) FROM cart)
  )
  SELECT e.shop_id, e.name, e.address, e.latitude, e.longitude, e.pincode, e.service_radius_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN round(public.haversine_km(e.latitude, e.longitude, _lat, _lng)::numeric, 2) ELSE NULL END AS distance_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN GREATEST(8, LEAST(45, (public.haversine_km(e.latitude, e.longitude, _lat, _lng) * 4 + 8)::int)) ELSE 15 END AS delivery_minutes,
    e.total_price::numeric AS price, e.total_mrp::numeric AS mrp, e.min_stock::int AS stock
  FROM eligible e
  ORDER BY distance_km NULLS LAST, price ASC;
END $function$;

CREATE OR REPLACE FUNCTION public.list_eligible_shops_for_product(_product_id uuid, _variant_id uuid DEFAULT NULL::uuid, _pincode text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision)
 RETURNS TABLE(shop_id uuid, shop_name text, shop_address text, latitude double precision, longitude double precision, pincode text, service_radius_km numeric, distance_km numeric, delivery_minutes integer, price numeric, mrp numeric, stock integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, s.name, s.address, s.latitude, s.longitude, s.pincode, s.service_radius_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN round(public.haversine_km(s.latitude, s.longitude, _lat, _lng)::numeric, 2) ELSE NULL END AS distance_km,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN GREATEST(8, LEAST(45, (public.haversine_km(s.latitude, s.longitude, _lat, _lng) * 4 + 8)::int)) ELSE 15 END AS delivery_minutes,
    -- Shop inventory price is authoritative for the default/base size.
    -- Only a non-default variant falls back to catalog variant pricing.
    (CASE WHEN pv.id IS NULL OR pv.is_default THEN sp.price ELSE pv.selling_price END) AS price,
    GREATEST(
      (CASE WHEN pv.id IS NULL OR pv.is_default THEN sp.price ELSE pv.selling_price END),
      (CASE WHEN pv.id IS NULL OR pv.is_default
            THEN COALESCE(sp.mrp, pr.mrp, sp.price)
            ELSE COALESCE(pv.mrp, pr.mrp, pv.selling_price) END)
    ) AS mrp,
    (CASE WHEN pv.id IS NULL THEN sp.stock ELSE LEAST(pv.stock, sp.stock) END) AS stock
  FROM public.shops s
  JOIN public.shop_products sp ON sp.shop_id = s.id AND sp.product_id = _product_id AND sp.is_available = true
  JOIN public.products pr ON pr.id = sp.product_id
  LEFT JOIN public.product_variants pv ON pv.id = _variant_id AND pv.product_id = _product_id AND pv.is_available = true
  WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
    AND (_pincode IS NULL OR s.pincode = _pincode)
    AND (_lat IS NULL OR _lng IS NULL OR public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km)
    AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
    AND (CASE WHEN pv.id IS NULL THEN sp.stock ELSE LEAST(pv.stock, sp.stock) END) > 0
  ORDER BY distance_km NULLS LAST, price ASC;
$function$;

CREATE OR REPLACE FUNCTION public.log_security_event(_event_type text, _target_user_id uuid, _detail jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.security_audit_log (actor_id, actor_role, target_user_id, event_type, detail)
  VALUES (
    auth.uid(),
    CASE WHEN public.is_super_admin(auth.uid()) THEN 'super_admin'
         WHEN public.has_role(auth.uid(), 'admin') THEN 'admin'
         ELSE 'user' END,
    _target_user_id,
    _event_type,
    coalesce(_detail, '{}'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.master_catalog_brands()
 RETURNS TABLE(brand text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.brand
    FROM public.products p
   WHERE p.brand IS NOT NULL AND btrim(p.brand) <> ''
   ORDER BY 1
$function$;

CREATE OR REPLACE FUNCTION public.normalize_product_name(_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT regexp_replace(lower(coalesce(_name, '')), '[^a-z0-9]+', '', 'g')
$function$;

CREATE OR REPLACE FUNCTION public.notify_expiring_products()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  _days int;
  _title text;
  _body text;
BEGIN
  FOR r IN
    SELECT sp.expiry_date, sp.stock, s.owner_id, p.name
    FROM public.shop_products sp
    JOIN public.shops s ON s.id = sp.shop_id
    JOIN public.products p ON p.id = sp.product_id
    WHERE s.owner_id IS NOT NULL
      AND sp.expiry_date IS NOT NULL
      AND sp.is_available = true
      AND sp.stock > 0
      AND (sp.expiry_date - CURRENT_DATE) IN (30, 7, 1, 0, -1)
  LOOP
    _days := (r.expiry_date - CURRENT_DATE);
    IF _days < 0 THEN
      _title := '🔴 Product expired';
      _body  := r.name || ' has expired. Please remove it from your inventory.';
    ELSIF _days = 0 THEN
      _title := '🔴 Expires today';
      _body  := r.name || ' expires today.';
    ELSIF _days = 1 THEN
      _title := '⚠️ Expires tomorrow';
      _body  := r.name || ' expires tomorrow.';
    ELSIF _days = 7 THEN
      _title := '🟠 Expires in 7 days';
      _body  := r.name || ' expires in 7 days.';
    ELSE
      _title := '🟡 Expires in 30 days';
      _body  := r.name || ' expires in 30 days.';
    END IF;
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (r.owner_id, _title, _body);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_riders_on_parent_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF NEW.is_parent = true AND NEW.status = 'packed'
     AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.partner_id IS NULL THEN
    FOR r IN SELECT * FROM rank_riders_for_parent(NEW.id, 5) LOOP
      INSERT INTO notifications (user_id, title, body, category, data)
      VALUES (
        r.user_id,
        'New multi-shop delivery',
        'Order ' || NEW.order_number || ' (' || NEW.shop_count || ' shops) ready for pickup — '
          || r.distance_km || ' km away',
        'delivery',
        jsonb_build_object('parent_id', NEW.id, 'shop_count', NEW.shop_count,
                            'distance_km', r.distance_km, 'is_parent', true)
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.notify_role(_role app_role, _title text, _body text, _category text DEFAULT 'general'::text, _data jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _n integer := 0; r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = _role LOOP
    INSERT INTO public.notifications (user_id, title, body, category, data)
    VALUES (r.user_id, _title, _body, _category, _data);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $function$;

CREATE OR REPLACE FUNCTION public.notify_shop_owner_on_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _title text, _body text, _category text DEFAULT 'general'::text, _data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, category, data)
  VALUES (_user_id, _title, _body, _category, _data)
  RETURNING id INTO _id;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_accept_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _pid uuid; _cust uuid; _assigned uuid;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;

  SELECT partner_id INTO _assigned FROM public.orders WHERE id = _order_id;

  IF _assigned IS NOT NULL AND _assigned <> _pid THEN
    RAISE EXCEPTION 'Order is assigned to another partner';
  END IF;

  UPDATE public.orders
  SET partner_id = _pid, status = 'out_for_delivery'::order_status, updated_at = now()
  WHERE id = _order_id
    AND status = 'packed'::order_status
    AND (partner_id IS NULL OR partner_id = _pid)
  RETURNING user_id INTO _cust;

  IF _cust IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, category, data)
    VALUES (_cust, 'Out for delivery', 'Your order is on its way!', 'order',
            jsonb_build_object('order_id', _order_id));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_accept_parent(_parent_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid; _cust uuid;
BEGIN
  SELECT id INTO _pid FROM delivery_partners WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RAISE EXCEPTION 'not a delivery partner'; END IF;

  -- Advisory lock so two riders cannot both accept
  PERFORM pg_advisory_xact_lock(hashtext(_parent_id::text));

  IF EXISTS (SELECT 1 FROM orders WHERE id = _parent_id AND partner_id IS NOT NULL AND partner_id <> _pid) THEN
    RAISE EXCEPTION 'already assigned to another rider';
  END IF;

  UPDATE orders SET partner_id = _pid, updated_at = now()
    WHERE id = _parent_id AND is_parent = true AND status = 'packed'
    RETURNING user_id INTO _cust;
  IF _cust IS NULL THEN RAISE EXCEPTION 'parent not ready for pickup'; END IF;

  UPDATE orders SET partner_id = _pid, status = 'out_for_delivery', updated_at = now()
    WHERE parent_order_id = _parent_id AND status = 'packed';

  UPDATE delivery_partners
    SET active_order_count = COALESCE(active_order_count,0) + 1,
        current_order_id = _parent_id,
        status_updated_at = now()
  WHERE id = _pid;

  INSERT INTO notifications (user_id, title, body, category, data)
    VALUES (_cust, 'Rider assigned',
            'A rider is on the way to pick up your order.',
            'order', jsonb_build_object('order_id', _parent_id));
END $function$;

CREATE OR REPLACE FUNCTION public.partner_available_orders()
 RETURNS TABLE(id uuid, order_number text, total numeric, city text, area_pincode text, placed_at timestamp with time zone, item_count bigint, shop_name text, delivery_type text, fast_delivery_fee numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid := public.current_user_partner_id();
BEGIN
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  RETURN QUERY
  SELECT o.id, o.order_number, o.total,
         (o.address->>'city')::text,
         (o.address->>'pincode')::text,
         o.placed_at,
         (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id),
         s.name,
         o.delivery_type,
         o.fast_delivery_fee
  FROM public.orders o
  LEFT JOIN public.shops s ON s.id = o.shop_id
  WHERE o.partner_id = _pid
    AND o.status = 'packed'::order_status
    AND COALESCE(o.delivery_type,'standard_delivery') <> 'pickup'
  ORDER BY (CASE WHEN o.delivery_type = 'fast_delivery' THEN 0 ELSE 1 END) ASC,
           o.placed_at ASC;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_available_parent_orders()
 RETURNS TABLE(parent_id uuid, order_number text, total numeric, shop_count integer, items_count bigint, city text, pincode text, ready_at timestamp with time zone, delivery_type text, fast_delivery_fee numeric, first_pickup_lat double precision, first_pickup_lng double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid := current_user_partner_id();
BEGIN
  IF _pid IS NULL THEN RAISE EXCEPTION 'not a delivery partner'; END IF;
  RETURN QUERY
  SELECT o.id, o.order_number, o.total, o.shop_count,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id IN (SELECT id FROM orders WHERE parent_order_id = o.id)),
         (o.address->>'city')::text, (o.address->>'pincode')::text,
         o.ready_for_pickup_at,
         o.delivery_type, o.fast_delivery_fee,
         (SELECT s.latitude FROM orders c JOIN shops s ON s.id = c.shop_id WHERE c.parent_order_id = o.id ORDER BY c.placed_at LIMIT 1),
         (SELECT s.longitude FROM orders c JOIN shops s ON s.id = c.shop_id WHERE c.parent_order_id = o.id ORDER BY c.placed_at LIMIT 1)
  FROM orders o
  WHERE o.is_parent = true
    AND o.status = 'packed'
    AND o.partner_id IS NULL
    AND COALESCE(o.delivery_type,'standard_delivery') <> 'pickup'
  ORDER BY (CASE WHEN o.delivery_type = 'fast_delivery' THEN 0 ELSE 1 END), o.ready_for_pickup_at ASC;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_check_in()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid; _id uuid; _open uuid;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  SELECT id INTO _open FROM public.partner_attendance
    WHERE partner_id = _pid AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1;
  IF _open IS NOT NULL THEN RETURN _open; END IF;
  INSERT INTO public.partner_attendance(partner_id) VALUES (_pid) RETURNING id INTO _id;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_check_out()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  UPDATE public.partner_attendance SET check_out_at = now()
    WHERE partner_id = _pid AND check_out_at IS NULL;
  UPDATE public.delivery_partners SET is_online = false WHERE id = _pid;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_decline_assignment(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _next uuid;
  _next_user uuid;
  _order_number text;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;

  UPDATE public.orders SET partner_id = NULL, updated_at = now()
  WHERE id = _order_id AND partner_id = _pid AND status = 'packed'::order_status;

  SELECT order_number INTO _order_number FROM public.orders WHERE id = _order_id;
  _next := public.find_nearest_partner_for_order(_order_id, ARRAY[_pid]);
  IF _next IS NOT NULL THEN
    UPDATE public.orders SET partner_id = _next, updated_at = now() WHERE id = _order_id;
    SELECT user_id INTO _next_user FROM public.delivery_partners WHERE id = _next;
    IF _next_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, category, data)
      VALUES (_next_user, 'New delivery assignment', 'Order ' || COALESCE(_order_number, '') || ' is ready for pickup.', 'delivery_assignment',
              jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id));
    END IF;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_is_on_order(_partner_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.partner_id = _partner_id
      AND o.status IN ('packed'::order_status,'out_for_delivery'::order_status,'delivered'::order_status)
      AND (
        o.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.partner_mark_delivered(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _pid uuid; _cust uuid; _is_parent boolean;
BEGIN
  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;
  UPDATE public.orders SET status = 'delivered'::order_status, updated_at = now()
  WHERE id = _order_id AND partner_id = _pid
  RETURNING user_id, is_parent INTO _cust, _is_parent;
  -- Multi-shop parent delivered: mark all its shop parts delivered too
  IF _cust IS NOT NULL AND _is_parent THEN
    UPDATE public.orders SET status = 'delivered'::order_status, updated_at = now()
    WHERE parent_order_id = _order_id AND status <> 'cancelled'::order_status;
  END IF;
  IF _cust IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (_cust, 'Order delivered', 'Your order has been delivered. Enjoy!');
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.partner_parent_pickup_stops(_parent_id uuid)
 RETURNS TABLE(child_id uuid, shop_id uuid, shop_name text, shop_address text, shop_phone text, shop_lat double precision, shop_lng double precision, status order_status, pickup_verified_at timestamp with time zone, items_count bigint, seq integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid := current_user_partner_id();
BEGIN
  IF _pid IS NULL THEN RAISE EXCEPTION 'not a delivery partner'; END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = _parent_id AND partner_id = _pid) THEN
    RAISE EXCEPTION 'not your delivery';
  END IF;
  RETURN QUERY
  SELECT c.id, s.id, s.name, s.address, s.phone, s.latitude, s.longitude,
         c.status, c.pickup_verified_at,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = c.id),
         ROW_NUMBER() OVER (ORDER BY (c.pickup_verified_at IS NULL) DESC, c.placed_at)::int
  FROM orders c JOIN shops s ON s.id = c.shop_id
  WHERE c.parent_order_id = _parent_id AND c.status <> 'cancelled'
  ORDER BY c.placed_at;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_send_eta_update(_order_id uuid, _kind text, _eta_minutes integer DEFAULT NULL::integer, _custom_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _partner_user_id uuid;
  _customer_id uuid;
  _order_number text;
  _title text;
  _body text;
BEGIN
  SELECT o.user_id, o.order_number, dp.user_id
    INTO _customer_id, _order_number, _partner_user_id
  FROM public.orders o
  JOIN public.delivery_partners dp ON dp.id = o.partner_id
  WHERE o.id = _order_id;

  IF _customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found or no partner assigned';
  END IF;

  IF _partner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized: you are not assigned to this order';
  END IF;

  _title := 'Order ' || COALESCE(_order_number, '');

  IF _kind = 'eta' THEN
    IF _eta_minutes IS NULL OR _eta_minutes < 0 OR _eta_minutes > 240 THEN
      RAISE EXCEPTION 'Invalid ETA';
    END IF;
    _body := 'Your order will arrive in approximately ' || _eta_minutes || ' minute'
             || CASE WHEN _eta_minutes = 1 THEN '' ELSE 's' END || '.';
  ELSIF _kind = 'nearby' THEN
    _body := 'Your delivery partner has reached your area.';
  ELSIF _kind = 'delay' THEN
    IF _eta_minutes IS NULL OR _eta_minutes < 1 OR _eta_minutes > 240 THEN
      RAISE EXCEPTION 'Invalid delay minutes';
    END IF;
    _body := 'Traffic delay. Your order may take an additional ' || _eta_minutes || ' minutes.';
  ELSIF _kind = 'custom' THEN
    IF _custom_message IS NULL OR length(trim(_custom_message)) = 0 THEN
      RAISE EXCEPTION 'Message required';
    END IF;
    _body := left(trim(_custom_message), 240);
  ELSE
    RAISE EXCEPTION 'Unknown update kind';
  END IF;

  RETURN public.notify_user(_customer_id, _title, _body, 'delivery',
    jsonb_build_object('order_id', _order_id, 'kind', _kind, 'eta_minutes', _eta_minutes));
END $function$;

CREATE OR REPLACE FUNCTION public.partner_send_message(_order_id uuid, _kind text, _custom_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _partner_id uuid;
  _partner_user_id uuid;
  _customer_id uuid;
  _order_number text;
  _title text;
  _body text;
  _msg_id uuid;
BEGIN
  SELECT o.user_id, o.order_number, o.partner_id, dp.user_id
    INTO _customer_id, _order_number, _partner_id, _partner_user_id
  FROM public.orders o
  LEFT JOIN public.delivery_partners dp ON dp.id = o.partner_id
  WHERE o.id = _order_id;

  IF _customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF _partner_user_id IS NULL OR _partner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized: you are not assigned to this order';
  END IF;

  _body := CASE _kind
    WHEN 'eta_2'        THEN 'Your delivery partner will arrive in about 2 minutes.'
    WHEN 'eta_5'        THEN 'Your delivery partner will arrive in about 5 minutes.'
    WHEN 'eta_10'       THEN 'Your delivery partner will arrive in about 10 minutes.'
    WHEN 'delay'        THEN 'Traffic delay — please allow some extra time for your order.'
    WHEN 'no_contact'   THEN 'Your delivery partner is unable to reach you. Please check your phone.'
    WHEN 'answer_phone' THEN 'Please answer your phone — your delivery partner is calling.'
    WHEN 'reached'      THEN 'Your delivery partner has reached your location.'
    WHEN 'delivered'    THEN 'Your order has been delivered. Enjoy!'
    WHEN 'custom'       THEN NULL
    ELSE NULL
  END;

  IF _kind = 'custom' THEN
    IF _custom_message IS NULL OR length(trim(_custom_message)) = 0 THEN
      RAISE EXCEPTION 'Message required';
    END IF;
    _body := left(trim(_custom_message), 280);
  ELSIF _body IS NULL THEN
    RAISE EXCEPTION 'Unknown message kind';
  END IF;

  INSERT INTO public.delivery_messages(order_id, customer_id, delivery_partner_id, kind, message)
  VALUES (_order_id, _customer_id, _partner_id, _kind, _body)
  RETURNING id INTO _msg_id;

  _title := '🚚 Delivery Update' || CASE WHEN _order_number IS NOT NULL THEN ' — ' || _order_number ELSE '' END;
  PERFORM public.notify_user(_customer_id, _title, _body, 'delivery',
    jsonb_build_object('order_id', _order_id, 'kind', _kind, 'message_id', _msg_id, 'url', '/customer/orders/' || _order_id));

  RETURN _msg_id;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_today_hours(_partner_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(check_out_at, now()) - check_in_at)) / 3600.0), 0)::numeric
  FROM public.partner_attendance
  WHERE partner_id = _partner_id AND check_in_at::date = current_date;
$function$;

CREATE OR REPLACE FUNCTION public.partner_update_location(_lat double precision, _lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pid uuid;
BEGIN
  IF _lat IS NULL OR _lng IS NULL OR abs(_lat) > 90 OR abs(_lng) > 180 THEN
    RAISE EXCEPTION 'invalid coordinates';
  END IF;
  SELECT id INTO _pid FROM delivery_partners WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RAISE EXCEPTION 'not a delivery partner'; END IF;
  UPDATE delivery_partners
    SET current_lat = _lat, current_lng = _lng, updated_at = now(), is_online = true
  WHERE id = _pid;
END $function$;

CREATE OR REPLACE FUNCTION public.partner_update_status(_status text, _order_id uuid DEFAULT NULL::uuid, _eta_minutes integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
  _cust uuid;
  _order_number text;
  _title text;
  _body text;
  _new_order_status order_status;
BEGIN
  IF _status NOT IN ('available','assigned','going_to_shop','picked_up','out_for_delivery','reached_area','delivered','offline') THEN
    RAISE EXCEPTION 'Invalid status %', _status;
  END IF;

  SELECT id INTO _pid FROM public.delivery_partners WHERE user_id = _uid;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Not a delivery partner'; END IF;

  -- If an order is referenced, it must belong to this partner
  IF _order_id IS NOT NULL THEN
    SELECT user_id, order_number INTO _cust, _order_number
    FROM public.orders WHERE id = _order_id AND partner_id = _pid;
    IF _cust IS NULL THEN
      RAISE EXCEPTION 'Order not assigned to you';
    END IF;
  END IF;

  -- Map partner status -> order status changes
  _new_order_status := NULL;
  IF _status IN ('picked_up','out_for_delivery','reached_area') THEN
    _new_order_status := 'out_for_delivery'::order_status;
  ELSIF _status = 'delivered' THEN
    _new_order_status := 'delivered'::order_status;
  END IF;

  IF _order_id IS NOT NULL AND _new_order_status IS NOT NULL THEN
    UPDATE public.orders
       SET status = _new_order_status, updated_at = now()
     WHERE id = _order_id
       AND partner_id = _pid
       AND status <> _new_order_status
       AND status <> 'delivered'::order_status
       AND status <> 'cancelled'::order_status;
  END IF;

  -- Update delivery_partners live state
  UPDATE public.delivery_partners
     SET availability_status = _status,
         current_order_id = CASE
           WHEN _status IN ('delivered','available','offline') THEN NULL
           ELSE COALESCE(_order_id, current_order_id)
         END,
         eta_minutes = CASE
           WHEN _status IN ('delivered','available','offline') THEN NULL
           ELSE COALESCE(_eta_minutes, eta_minutes)
         END,
         is_online = CASE WHEN _status = 'offline' THEN false ELSE true END,
         status_updated_at = now(),
         updated_at = now()
   WHERE id = _pid;

  -- Notify customer
  IF _cust IS NOT NULL THEN
    _title := 'Order ' || COALESCE(_order_number, '');
    _body := CASE _status
      WHEN 'going_to_shop'    THEN 'Your delivery partner is heading to the shop to pick up your order.'
      WHEN 'picked_up'        THEN 'Your order has been picked up and will be on its way shortly.'
      WHEN 'out_for_delivery' THEN 'Your order is out for delivery'
                                 || CASE WHEN _eta_minutes IS NOT NULL THEN ' (ETA ' || _eta_minutes || ' min).' ELSE '.' END
      WHEN 'reached_area'     THEN 'Your delivery partner has reached your area.'
      WHEN 'delivered'        THEN 'Your order has been delivered. Enjoy!'
      ELSE NULL
    END;
    IF _body IS NOT NULL THEN
      PERFORM public.notify_user(_cust, _title, _body, 'delivery',
        jsonb_build_object('order_id', _order_id, 'status', _status, 'eta_minutes', _eta_minutes));
    END IF;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.place_multi_shop_order(_address jsonb, _payment_method text, _coupon_code text DEFAULT NULL::text, _delivery_instruction text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _pincode text DEFAULT NULL::text, _delivery_type text DEFAULT 'standard_delivery'::text)
 RETURNS TABLE(parent_order_id uuid, order_number text, shop_count integer, total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  plan_rows record;
  distinct_shops uuid[];
  parent_id uuid;
  parent_number text;
  child_id uuid;
  cart_product_count int;
  plan_product_count int;
  total_subtotal numeric := 0;
  total_amount numeric := 0;
  del_fee numeric := 0;
  fast_fee numeric := 0;
  handling_fee numeric := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT COUNT(DISTINCT ci.product_id) INTO cart_product_count
  FROM cart_items ci WHERE ci.user_id = uid;
  IF cart_product_count = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  DROP TABLE IF EXISTS _cart_plan;
  CREATE TEMP TABLE _cart_plan ON COMMIT DROP AS
    SELECT * FROM plan_multi_shop_cart(uid, _lat, _lng, _pincode);

  SELECT COUNT(DISTINCT cp.product_id) INTO plan_product_count FROM _cart_plan cp;
  IF plan_product_count < cart_product_count THEN
    RAISE EXCEPTION 'no_coverage: only % of % cart items can be sourced', plan_product_count, cart_product_count;
  END IF;

  SELECT ARRAY(SELECT DISTINCT cp.shop_id FROM _cart_plan cp) INTO distinct_shops;

  SELECT COALESCE(SUM(cp.price * cp.quantity), 0) INTO total_subtotal FROM _cart_plan cp;

  SELECT
    CASE _delivery_type
      WHEN 'fast_delivery' THEN COALESCE(z.fast_fee, 0)
      WHEN 'express_delivery' THEN COALESCE(z.express_fee, 0)
      WHEN 'standard_delivery' THEN COALESCE(z.standard_fee, 0)
      ELSE 0
    END
  INTO del_fee
  FROM public.delivery_zone_settings z
  WHERE z.pin_code = _pincode AND z.is_active = true
  LIMIT 1;
  del_fee := COALESCE(del_fee, CASE WHEN _delivery_type = 'fast_delivery' THEN 100 ELSE 20 END);
  fast_fee := CASE WHEN _delivery_type = 'fast_delivery' THEN del_fee ELSE 0 END;

  handling_fee := public.compute_handling_fee(_pincode, _delivery_type, total_subtotal);

  total_amount := total_subtotal + del_fee + handling_fee;

  INSERT INTO orders(
    user_id, status, payment_method, subtotal, delivery_fee, handling_fee, tax, total,
    coupon_code, address, delivery_instruction, delivery_lat, delivery_lng,
    delivery_pincode, delivery_type, fast_delivery_fee, is_parent, shop_count,
    shop_selection_mode
  ) VALUES (
    uid, 'awaiting_shop', _payment_method::payment_method, total_subtotal, del_fee, handling_fee, 0, total_amount,
    _coupon_code, _address, _delivery_instruction, _lat, _lng,
    _pincode, _delivery_type, fast_fee, true, array_length(distinct_shops, 1),
    'auto'
  ) RETURNING orders.id, orders.order_number INTO parent_id, parent_number;

  FOR plan_rows IN
    SELECT cp.shop_id AS s_id, cp.shop_name AS s_name,
           SUM(cp.price * cp.quantity)::numeric AS sub,
           MIN(cp.distance_km) AS dist
    FROM _cart_plan cp
    GROUP BY cp.shop_id, cp.shop_name
  LOOP
    INSERT INTO orders(
      user_id, status, payment_method, subtotal, delivery_fee, handling_fee, tax, total,
      address, delivery_lat, delivery_lng, delivery_pincode, delivery_type,
      shop_id, parent_order_id, is_parent, shop_count,
      assignment_distance_km, pickup_otp
    ) VALUES (
      uid, 'awaiting_shop', _payment_method::payment_method, plan_rows.sub, 0, 0, 0, plan_rows.sub,
      _address, _lat, _lng, _pincode, _delivery_type,
      plan_rows.s_id, parent_id, false, 1,
      plan_rows.dist, lpad(floor(random() * 9000 + 1000)::text, 4, '0')
    ) RETURNING orders.id INTO child_id;

    INSERT INTO order_items(order_id, child_order_id, shop_id, shop_product_id,
                            product_id, variant_id, name, image_url, unit, price, quantity)
    SELECT child_id, child_id, cp.shop_id, cp.shop_product_id,
           cp.product_id, cp.variant_id, cp.product_name, cp.image_url, cp.unit,
           cp.price, cp.quantity
    FROM _cart_plan cp WHERE cp.shop_id = plan_rows.s_id;

    INSERT INTO inventory_reservations(parent_order_id, child_order_id, shop_product_id, quantity, expires_at)
    SELECT parent_id, child_id, cp.shop_product_id, cp.quantity, now() + interval '5 minutes'
    FROM _cart_plan cp WHERE cp.shop_id = plan_rows.s_id;

    INSERT INTO shop_assignment_history(order_id, shop_id, status, attempt_number)
      VALUES (parent_id, plan_rows.s_id, 'assigned', 1);

    PERFORM notify_user((SELECT sh.owner_id FROM shops sh WHERE sh.id = plan_rows.s_id),
                       'New order — ' || parent_number,
                       'A new order needs your acceptance within 60 seconds.',
                       'order',
                       jsonb_build_object('order_id', child_id, 'parent_order_id', parent_id));
  END LOOP;

  PERFORM notify_user(uid, 'Order placed — ' || parent_number,
                     'Finding shops for your order…', 'order',
                     jsonb_build_object('order_id', parent_id));

  DROP TABLE IF EXISTS _cart_plan;
  DELETE FROM cart_items WHERE cart_items.user_id = uid;

  RETURN QUERY SELECT parent_id, parent_number, array_length(distinct_shops, 1), total_amount;
END $function$;

CREATE OR REPLACE FUNCTION public.place_order(_address jsonb, _payment_method payment_method, _coupon_code text DEFAULT NULL::text, _delivery_instruction text DEFAULT NULL::text, _delivery_type text DEFAULT 'standard_delivery'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _order_id uuid;
  _subtotal numeric := 0;
  _discount numeric := 0;
  _delivery_fee numeric := 0;
  _fast_fee numeric := 0;
  _handling numeric := 0;
  _total numeric := 0;
  _coupon record;
  _lat double precision;
  _lng double precision;
  _pin text;
  _shop_id uuid;
  _distance numeric;
  _candidates int := 0;
  _has_pin_match boolean := false;
  _has_in_radius boolean := false;
  _manual_shop_id uuid;
  _distinct_shops int;
  _mode text := 'auto';
  _reason_text text;
  _rerouted boolean := false;
  _shop_name text;
  r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _delivery_type NOT IN ('fast_delivery','standard_delivery','express_delivery','pickup') THEN
    RAISE EXCEPTION 'Invalid delivery type';
  END IF;

  _lat := (_address->>'lat')::double precision;
  _lng := (_address->>'lng')::double precision;
  _pin := NULLIF(trim(_address->>'pincode'), '');
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Delivery address needs coordinates'; END IF;
  IF _pin IS NULL THEN RAISE EXCEPTION 'Delivery address is missing a pincode'; END IF;

  SELECT count(DISTINCT shop_id) FILTER (WHERE shop_id IS NOT NULL)
    INTO _distinct_shops FROM public.cart_items WHERE user_id = _uid;

  IF _distinct_shops > 1 THEN
    RAISE EXCEPTION 'Your cart contains items from multiple shops. Please choose one shop.';
  END IF;

  IF _distinct_shops = 1 THEN
    SELECT shop_id INTO _manual_shop_id
    FROM public.cart_items WHERE user_id = _uid AND shop_id IS NOT NULL LIMIT 1;
  END IF;

  SELECT count(*) INTO _candidates FROM public.shops WHERE is_open = true AND status = 'active' AND owner_id IS NOT NULL;
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE is_open = true AND status = 'active' AND owner_id IS NOT NULL AND pincode = _pin) INTO _has_pin_match;
  SELECT EXISTS (
    SELECT 1 FROM public.shops s WHERE s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
      AND s.pincode = _pin
      AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km
  ) INTO _has_in_radius;

  IF _manual_shop_id IS NOT NULL THEN
    PERFORM 1 FROM public.shops s
      WHERE s.id = _manual_shop_id AND s.is_open = true AND s.status = 'active' AND s.owner_id IS NOT NULL
        AND s.pincode = _pin
        AND public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km;
    IF FOUND THEN
      _shop_id := _manual_shop_id;
      _mode := 'manual';
      _reason_text := 'Customer manually selected shop';
    ELSE
      -- selected shop is closed / unavailable: auto route to next best open shop
      _shop_id := public.find_best_shop_for_cart(_uid, _lat, _lng, _pin, ARRAY[_manual_shop_id]);
      _mode := 'auto';
      _rerouted := _shop_id IS NOT NULL;
      _reason_text := 'Selected shop closed • auto-assigned nearest open shop';
    END IF;
  ELSE
    _shop_id := public.find_best_shop_for_cart(_uid, _lat, _lng, _pin, '{}');
    _mode := 'auto';
    _reason_text := 'Pincode ' || _pin || ' • nearest in-stock shop';
  END IF;

  IF _shop_id IS NULL THEN
    INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, outcome, reason, details)
    VALUES (NULL, _pin, _lat, _lng, _candidates,
      CASE WHEN NOT _has_pin_match THEN 'no_shop_in_pincode' WHEN NOT _has_in_radius THEN 'out_of_radius' ELSE 'no_stock' END,
      CASE WHEN NOT _has_pin_match THEN 'No open shop registered for pincode ' || _pin
           WHEN NOT _has_in_radius THEN 'Open shops in pincode ' || _pin || ' do not cover this address within their delivery radius'
           ELSE 'Open shops in pincode ' || _pin || ' do not have all requested items in stock' END,
      jsonb_build_object('user_id', _uid));
    RAISE EXCEPTION 'Sorry, all shops selling these products are currently closed or unavailable.';
  END IF;

  SELECT public.haversine_km(s.latitude, s.longitude, _lat, _lng), s.name
    INTO _distance, _shop_name FROM public.shops s WHERE s.id = _shop_id;

  FOR r IN
    SELECT ci.product_id, ci.variant_id, ci.quantity,
           COALESCE(pv.selling_price, sp.price) AS eff_price,
           COALESCE(pv.stock, sp.stock) AS eff_stock,
           p.name
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
    LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id
    WHERE ci.user_id = _uid
    FOR UPDATE OF sp
  LOOP
    IF r.quantity > r.eff_stock THEN
      RAISE EXCEPTION 'Sorry, "%" is out of stock.', r.name;
    END IF;
    _subtotal := _subtotal + r.eff_price * r.quantity;
  END LOOP;
  IF _subtotal = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  IF _coupon_code IS NOT NULL AND length(_coupon_code) > 0 THEN
    SELECT * INTO _coupon FROM public.coupons
      WHERE code = upper(_coupon_code) AND active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (usage_limit IS NULL OR times_used < usage_limit) LIMIT 1;
    IF _coupon.id IS NOT NULL AND _subtotal >= _coupon.min_order THEN
      IF _coupon.type = 'flat' THEN _discount := LEAST(_coupon.value, _subtotal);
      ELSE
        _discount := (_subtotal * _coupon.value / 100.0);
        IF _coupon.max_discount IS NOT NULL THEN _discount := LEAST(_discount, _coupon.max_discount); END IF;
      END IF;
      UPDATE public.coupons SET times_used = times_used + 1 WHERE id = _coupon.id;
    END IF;
  END IF;

  SELECT
    CASE _delivery_type
      WHEN 'fast_delivery' THEN COALESCE(z.fast_fee, 0)
      WHEN 'express_delivery' THEN COALESCE(z.express_fee, 0)
      WHEN 'standard_delivery' THEN COALESCE(z.standard_fee, 0)
      ELSE 0
    END
  INTO _delivery_fee
  FROM public.delivery_zone_settings z
  WHERE z.pin_code = _pin AND z.is_active = true
  LIMIT 1;
  _delivery_fee := COALESCE(_delivery_fee, CASE WHEN _delivery_type='fast_delivery' THEN 100 ELSE 0 END);
  _fast_fee := CASE WHEN _delivery_type = 'fast_delivery' THEN _delivery_fee ELSE 0 END;

  _handling := public.compute_handling_fee(_pin, _delivery_type, _subtotal);

  _total := _subtotal - _discount + _delivery_fee + _handling;

  INSERT INTO public.orders (
    user_id, shop_id, address, delivery_lat, delivery_lng, delivery_pincode,
    payment_method, payment_status, status,
    subtotal, discount, delivery_fee, handling_fee, tax, total,
    coupon_code, delivery_instruction, assignment_attempts, assignment_expires_at,
    delivery_type, fast_delivery_fee,
    assignment_reason, assignment_distance_km, routing_status, shop_selection_mode
  ) VALUES (
    _uid, _shop_id, _address, _lat, _lng, _pin,
    _payment_method, 'pending'::payment_status, 'awaiting_shop'::order_status,
    _subtotal, _discount, _delivery_fee, _handling, 0, _total,
    _coupon_code, _delivery_instruction, 1, now() + interval '10 minutes',
    _delivery_type, _fast_fee,
    _reason_text, _distance, 'assigned', _mode
  ) RETURNING id INTO _order_id;

  INSERT INTO public.order_items (order_id, product_id, variant_id, variant_label, name, image_url, unit, price, quantity)
  SELECT _order_id, ci.product_id, ci.variant_id,
         CASE WHEN pv.id IS NOT NULL THEN COALESCE(pv.name, pv.size) END,
         p.name,
         COALESCE((pv.images)[1], p.cover_image, p.image_url),
         COALESCE(pv.size || COALESCE(' ' || pv.unit, ''), p.unit),
         COALESCE(pv.selling_price, sp.price),
         ci.quantity
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  JOIN public.shop_products sp ON sp.product_id = ci.product_id AND sp.shop_id = _shop_id
  LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id
  WHERE ci.user_id = _uid;

  UPDATE public.product_variants pv
    SET stock = pv.stock - ci.quantity, updated_at = now()
  FROM public.cart_items ci
  WHERE ci.user_id = _uid AND ci.variant_id = pv.id;

  UPDATE public.shop_products sp SET stock = sp.stock - ci.quantity, updated_at = now()
  FROM public.cart_items ci
  WHERE ci.user_id = _uid AND ci.variant_id IS NULL
    AND ci.product_id = sp.product_id AND sp.shop_id = _shop_id;

  DELETE FROM public.cart_items WHERE user_id = _uid;

  INSERT INTO public.order_routing_log(order_id, pincode, delivery_lat, delivery_lng, candidates_considered, chosen_shop_id, chosen_distance_km, outcome, reason)
  VALUES (_order_id, _pin, _lat, _lng, _candidates, _shop_id, _distance, 'assigned', _reason_text);

  INSERT INTO public.notifications (user_id, title, body, data)
  VALUES (_uid, 'Order placed!', 'Looking for a shop to accept your order...',
          jsonb_build_object('order_id', _order_id, 'url', '/customer/orders/' || _order_id));

  IF _rerouted THEN
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (_uid, 'Assigned to a nearby shop',
            'Your selected shop is closed, so your order was assigned to ' || COALESCE(_shop_name, 'another nearby shop') || '.',
            jsonb_build_object('order_id', _order_id, 'url', '/customer/orders/' || _order_id));
  END IF;

  RETURN _order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.plan_multi_shop_cart(_user uuid, _lat double precision, _lng double precision, _pincode text)
 RETURNS TABLE(shop_id uuid, shop_name text, distance_km numeric, product_id uuid, variant_id uuid, quantity integer, price numeric, shop_product_id uuid, product_name text, image_url text, unit text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  remaining_items uuid[];
  chosen_shop uuid;
  chosen_dist numeric;
BEGIN
  DROP TABLE IF EXISTS _pool;
  DROP TABLE IF EXISTS _plan;

  CREATE TEMP TABLE _pool ON COMMIT DROP AS
  SELECT ci.product_id  AS pool_product_id,
         ci.variant_id  AS pool_variant_id,
         ci.quantity::int AS qty,
         sp.shop_id     AS pool_shop_id,
         s.name         AS pool_shop_name,
         sp.id          AS pool_shop_product_id,
         sp.price::numeric AS pool_price,
         effective_available_stock(sp.id) AS avail_stock,
         (CASE WHEN _lat IS NULL OR _lng IS NULL THEN NULL
               ELSE ROUND((6371 * acos(LEAST(1, cos(radians(_lat)) * cos(radians(s.latitude))
                    * cos(radians(s.longitude) - radians(_lng))
                    + sin(radians(_lat)) * sin(radians(s.latitude)))))::numeric, 2)
          END) AS pool_distance_km,
         p.name         AS pool_product_name,
         p.image_url    AS pool_image_url,
         p.unit         AS pool_unit
  FROM cart_items ci
  JOIN products p       ON p.id = ci.product_id
  JOIN shop_products sp ON sp.product_id = ci.product_id AND sp.is_available = true
  JOIN shops s          ON s.id = sp.shop_id AND s.is_open = true AND s.owner_id IS NOT NULL
  WHERE ci.user_id = _user
    AND (_pincode IS NULL OR s.pincode = _pincode OR
         (_lat IS NOT NULL AND _lng IS NOT NULL
          AND (6371 * acos(LEAST(1, cos(radians(_lat)) * cos(radians(s.latitude))
               * cos(radians(s.longitude) - radians(_lng))
               + sin(radians(_lat)) * sin(radians(s.latitude))))) <= COALESCE(s.service_radius_km, 8)))
    AND effective_available_stock(sp.id) >= ci.quantity;

  SELECT ARRAY(SELECT DISTINCT pl.pool_product_id FROM _pool pl) INTO remaining_items;

  CREATE TEMP TABLE _plan(
    plan_shop_id uuid, plan_product_id uuid, plan_variant_id uuid, plan_qty int,
    plan_shop_product_id uuid, plan_price numeric, plan_shop_name text,
    plan_distance_km numeric, plan_product_name text, plan_image_url text, plan_unit text
  ) ON COMMIT DROP;

  WHILE array_length(remaining_items, 1) > 0 LOOP
    SELECT pp.pool_shop_id, AVG(pp.pool_distance_km)
      INTO chosen_shop, chosen_dist
    FROM _pool pp
    WHERE pp.pool_product_id = ANY(remaining_items)
    GROUP BY pp.pool_shop_id
    ORDER BY COUNT(DISTINCT pp.pool_product_id) DESC,
             AVG(COALESCE(pp.pool_distance_km, 999)) ASC,
             SUM(pp.pool_price * pp.qty) ASC
    LIMIT 1;

    IF chosen_shop IS NULL THEN EXIT; END IF;

    INSERT INTO _plan
    SELECT DISTINCT ON (pp.pool_product_id)
      pp.pool_shop_id, pp.pool_product_id, pp.pool_variant_id, pp.qty,
      pp.pool_shop_product_id, pp.pool_price, pp.pool_shop_name, pp.pool_distance_km,
      pp.pool_product_name, pp.pool_image_url, pp.pool_unit
    FROM _pool pp
    WHERE pp.pool_shop_id = chosen_shop
      AND pp.pool_product_id = ANY(remaining_items)
    ORDER BY pp.pool_product_id, pp.pool_price ASC;

    remaining_items := ARRAY(
      SELECT unnest(remaining_items)
      EXCEPT
      SELECT pln.plan_product_id FROM _plan pln
    );
  END LOOP;

  RETURN QUERY
    SELECT pln.plan_shop_id, pln.plan_shop_name, pln.plan_distance_km,
           pln.plan_product_id, pln.plan_variant_id, pln.plan_qty,
           pln.plan_price, pln.plan_shop_product_id, pln.plan_product_name,
           pln.plan_image_url, pln.plan_unit
    FROM _plan pln;

  DROP TABLE IF EXISTS _pool;
  DROP TABLE IF EXISTS _plan;
END $function$;

CREATE OR REPLACE FUNCTION public.post_ticket_message(_ticket_id uuid, _body text, _is_internal boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _role text; _is_support boolean; _id uuid;
        _creator uuid; _assignee uuid; _num text; _t record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'Empty message'; END IF;

  SELECT * INTO _t FROM public.support_tickets WHERE id = _ticket_id;
  IF _t IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;

  _is_support := has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role);
  IF NOT _is_support AND _t.user_id <> _uid THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _is_internal AND NOT _is_support THEN RAISE EXCEPTION 'Only support can post internal notes'; END IF;

  _role := CASE WHEN _is_support THEN 'support' ELSE _t.role_at_creation END;

  INSERT INTO public.support_messages(ticket_id, sender_id, sender_role, body, is_internal_note)
  VALUES (_ticket_id, _uid, _role, _body, COALESCE(_is_internal,false))
  RETURNING id INTO _id;

  IF _is_support AND NOT _is_internal AND _t.first_response_at IS NULL THEN
    UPDATE public.support_tickets SET first_response_at = now(), updated_at = now() WHERE id = _ticket_id;
  END IF;

  IF NOT _is_internal THEN
    _creator := _t.user_id; _assignee := _t.assigned_to; _num := _t.ticket_number;
    IF _is_support THEN
      IF _creator IS NOT NULL AND _creator <> _uid THEN
        INSERT INTO public.notifications(user_id, title, body, category, data)
        VALUES (_creator, 'Support replied', left(_body, 120), 'support',
          jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
      END IF;
    ELSE
      IF _assignee IS NOT NULL AND _assignee <> _uid THEN
        INSERT INTO public.notifications(user_id, title, body, category, data)
        VALUES (_assignee, 'New reply on ' || COALESCE(_num,''), left(_body, 120), 'support',
          jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/tickets/' || _ticket_id));
      END IF;
    END IF;
  END IF;

  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.product_shop_availability(_product_id uuid, _variant_id uuid DEFAULT NULL::uuid, _pincode text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision)
 RETURNS TABLE(open_shops integer, closed_shops integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH candidates AS (
    SELECT s.is_open, s.status
    FROM public.shops s
    JOIN public.shop_products sp ON sp.shop_id = s.id AND sp.product_id = _product_id AND sp.is_available = true
    LEFT JOIN public.product_variants pv ON pv.id = _variant_id AND pv.product_id = _product_id
    WHERE s.owner_id IS NOT NULL
      AND (_pincode IS NULL OR s.pincode = _pincode)
      AND (_lat IS NULL OR _lng IS NULL OR public.haversine_km(s.latitude, s.longitude, _lat, _lng) <= s.service_radius_km)
      AND (sp.expiry_date IS NULL OR sp.expiry_date >= CURRENT_DATE)
      AND COALESCE(pv.stock, sp.stock) > 0
  )
  SELECT COUNT(*) FILTER (WHERE is_open AND status = 'active')::int AS open_shops,
         COUNT(*) FILTER (WHERE NOT (is_open AND status = 'active'))::int AS closed_shops
  FROM candidates;
$function$;

CREATE OR REPLACE FUNCTION public.purge_old_notifications()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.notifications
  WHERE (read = true AND created_at < now() - interval '30 days')
     OR created_at < now() - interval '90 days';
$function$;

CREATE OR REPLACE FUNCTION public.rank_riders_for_parent(_parent_id uuid, _limit integer DEFAULT 5)
 RETURNS TABLE(partner_id uuid, user_id uuid, distance_km numeric, active_order_count integer, rating numeric, score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _first_lat double precision; _first_lng double precision;
BEGIN
  -- Use the first child shop's coordinates as the initial pickup anchor
  SELECT s.latitude, s.longitude INTO _first_lat, _first_lng
  FROM orders c
  JOIN shops s ON s.id = c.shop_id
  WHERE c.parent_order_id = _parent_id
    AND c.status <> 'cancelled'
  ORDER BY c.placed_at ASC
  LIMIT 1;

  IF _first_lat IS NULL THEN RAISE EXCEPTION 'parent has no active children'; END IF;

  RETURN QUERY
  SELECT
    dp.id,
    dp.user_id,
    ROUND((
      2 * 6371 * asin(sqrt(
        power(sin(radians((_first_lat - dp.current_lat)/2)), 2)
        + cos(radians(_first_lat)) * cos(radians(dp.current_lat))
          * power(sin(radians((_first_lng - dp.current_lng)/2)), 2)
      ))
    )::numeric, 3) AS distance_km,
    COALESCE(dp.active_order_count, 0) AS active_order_count,
    COALESCE(dp.rating, 4.5) AS rating,
    -- Composite score: lower is better. Distance dominates; penalise load, reward rating.
    (COALESCE(
       2 * 6371 * asin(sqrt(
         power(sin(radians((_first_lat - dp.current_lat)/2)), 2)
         + cos(radians(_first_lat)) * cos(radians(dp.current_lat))
           * power(sin(radians((_first_lng - dp.current_lng)/2)), 2)
       )), 999)
      + COALESCE(dp.active_order_count,0) * 1.5
      - COALESCE(dp.rating,4.5) * 0.3
    )::numeric AS score
  FROM delivery_partners dp
  WHERE dp.is_online = true
    AND dp.current_lat IS NOT NULL AND dp.current_lng IS NOT NULL
    AND COALESCE(dp.active_order_count,0) < 3
    AND COALESCE(dp.availability_status,'available') = 'available'
  ORDER BY score ASC
  LIMIT GREATEST(1, _limit);
END $function$;

CREATE OR REPLACE FUNCTION public.reassign_orders_from_closed_shop(_shop_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _count int := 0; r record; _next uuid; _dist numeric; _next_name text;
BEGIN
  FOR r IN
    SELECT o.id, o.user_id, o.delivery_lat, o.delivery_lng, o.assignment_attempts
    FROM public.orders o
    WHERE o.shop_id = _shop_id
      AND o.status = 'awaiting_shop'::order_status
  LOOP
    -- restore stock at the closing shop
    UPDATE public.shop_products sp SET stock = sp.stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _shop_id;

    UPDATE public.orders
       SET rejected_shop_ids = (SELECT ARRAY(SELECT DISTINCT UNNEST(array_append(rejected_shop_ids, _shop_id)))),
           shop_id = NULL
     WHERE id = r.id;

    INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, responded_at)
    VALUES (r.id, _shop_id, 'rejected', 'Shop closed before accepting the order',
            COALESCE(r.assignment_attempts, 1), now());

    _next := public.find_nearest_shop_for_order(r.id);

    IF _next IS NULL THEN
      UPDATE public.orders SET status = 'no_shop_available'::order_status,
        assignment_expires_at = NULL,
        assignment_reason = 'All eligible shops are closed'
      WHERE id = r.id;

      INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason)
      VALUES (r.id, NULL, 'no_shop_available', 'All eligible shops are closed');

      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (r.user_id, 'All shops are closed',
              'Sorry, all shops selling these products are currently closed.',
              jsonb_build_object('order_id', r.id, 'url', '/customer/orders/' || r.id));
    ELSE
      UPDATE public.shop_products sp SET stock = sp.stock - oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _next;

      SELECT public.haversine_km(s.latitude, s.longitude, r.delivery_lat, r.delivery_lng), s.name
        INTO _dist, _next_name FROM public.shops s WHERE s.id = _next;

      UPDATE public.orders SET
        shop_id = _next,
        assignment_attempts = COALESCE(assignment_attempts, 1) + 1,
        assignment_expires_at = now() + interval '10 minutes',
        assignment_reason = 'Reassigned — previous shop closed',
        assignment_distance_km = _dist
      WHERE id = r.id;

      INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, assigned_at)
      VALUES (r.id, _next, 'assigned', 'Next eligible open shop after previous shop closed',
              COALESCE(r.assignment_attempts, 1) + 1, now());

      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (r.user_id, 'Assigned to a nearby shop',
              'Your order was moved to ' || COALESCE(_next_name, 'another nearby shop') || ' because the previous shop closed.',
              jsonb_build_object('order_id', r.id, 'url', '/customer/orders/' || r.id));
    END IF;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $function$;

CREATE OR REPLACE FUNCTION public.reassign_stale_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _count integer := 0; r record; _next uuid; _dist numeric;
BEGIN
  FOR r IN
    SELECT id, shop_id, user_id, delivery_lat, delivery_lng, assignment_attempts
      FROM public.orders
      WHERE status = 'awaiting_shop'::order_status
        AND assignment_expires_at IS NOT NULL
        AND assignment_expires_at < now()
  LOOP
    -- restore stock
    UPDATE public.shop_products sp SET stock = stock + oi.quantity, updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = r.shop_id;

    -- Permanently add timed-out shop to rejection list
    UPDATE public.orders
       SET rejected_shop_ids = (
             SELECT ARRAY(SELECT DISTINCT UNNEST(array_append(rejected_shop_ids, r.shop_id)))
           ),
           shop_id = NULL
     WHERE id = r.id;

    INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, responded_at)
    VALUES (r.id, r.shop_id, 'timeout', 'Shop did not respond within the acceptance window',
            COALESCE(r.assignment_attempts, 1), now());

    -- Find next shop — DO NOT clear rejected_shop_ids
    _next := public.find_nearest_shop_for_order(r.id);

    IF _next IS NULL THEN
      UPDATE public.orders SET status = 'no_shop_available'::order_status,
        assignment_expires_at = NULL,
        assignment_reason = 'No other eligible shop after timeout'
      WHERE id = r.id;

      INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason)
      VALUES (r.id, NULL, 'no_shop_available', 'No eligible shops remaining after timeout');

      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (r.user_id, 'Item unavailable',
              'No shop in your area could fulfill this order.',
              jsonb_build_object('order_id', r.id, 'url', '/customer/orders/' || r.id));
    ELSE
      UPDATE public.shop_products sp SET stock = stock - oi.quantity, updated_at = now()
      FROM public.order_items oi
      WHERE oi.order_id = r.id AND sp.product_id = oi.product_id AND sp.shop_id = _next;

      SELECT public.haversine_km(s.latitude, s.longitude, r.delivery_lat, r.delivery_lng)
        INTO _dist FROM public.shops s WHERE s.id = _next;

      UPDATE public.orders SET
        shop_id = _next,
        assignment_attempts = assignment_attempts + 1,
        assignment_expires_at = now() + interval '10 minutes',
        assignment_reason = 'Reassigned to next eligible shop after timeout',
        assignment_distance_km = _dist
      WHERE id = r.id;

      INSERT INTO public.shop_assignment_history (order_id, shop_id, status, reason, attempt_number, assigned_at)
      VALUES (r.id, _next, 'assigned', 'Next eligible shop after timeout',
              COALESCE(r.assignment_attempts, 1) + 1, now());
    END IF;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $function$;

CREATE OR REPLACE FUNCTION public.release_expired_reservations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  WITH freed AS (
    UPDATE inventory_reservations SET released = true, released_reason = 'expired'
    WHERE released = false AND expires_at < now()
    RETURNING parent_order_id
  )
  SELECT COUNT(*) INTO n FROM freed;
  RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.restore_order_stock(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.products p
  SET stock = stock + oi.quantity
  FROM public.order_items oi
  WHERE oi.order_id = _order_id AND oi.product_id = p.id;
END; $function$;

CREATE OR REPLACE FUNCTION public.rider_verify_pickup(_child_id uuid, _otp text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ord record; parent record;
BEGIN
  SELECT o.* INTO ord FROM orders o WHERE o.id = _child_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'child not found'; END IF;
  SELECT * INTO parent FROM orders WHERE id = ord.parent_order_id;
  IF NOT EXISTS (
    SELECT 1 FROM delivery_partners dp WHERE dp.id = parent.partner_id AND dp.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not your delivery'; END IF;
  IF ord.pickup_otp IS DISTINCT FROM _otp THEN RAISE EXCEPTION 'invalid OTP'; END IF;

  UPDATE orders SET pickup_verified_at = now(), updated_at = now() WHERE id = _child_id;
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event)
    VALUES (parent.id, _child_id, ord.shop_id, auth.uid(), 'pickup_verified');

  -- If ALL children verified, promote parent to out_for_delivery
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE parent_order_id = parent.id AND status <> 'cancelled' AND pickup_verified_at IS NULL
  ) THEN
    UPDATE orders SET status = 'out_for_delivery', updated_at = now() WHERE id = parent.id;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.search_master_catalog(_shop_id uuid DEFAULT NULL::uuid, _q text DEFAULT NULL::text, _category_id uuid DEFAULT NULL::uuid, _brand text DEFAULT NULL::text, _limit integer DEFAULT 24, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, brand text, unit text, image text, mrp numeric, price numeric, category_names text[], already_added boolean, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT p.*
      FROM public.products p
     WHERE (_q IS NULL OR btrim(_q) = ''
            OR p.name_normalized LIKE '%' || public.normalize_product_name(_q) || '%'
            OR lower(coalesce(p.brand, '')) LIKE '%' || lower(btrim(_q)) || '%')
       AND (_brand IS NULL OR lower(coalesce(p.brand, '')) = lower(_brand))
       AND (_category_id IS NULL OR p.category_id = _category_id
            OR EXISTS (SELECT 1 FROM public.product_categories pc
                        WHERE pc.product_id = p.id AND pc.category_id = _category_id))
  )
  SELECT b.id,
         b.name,
         b.brand,
         b.unit,
         COALESCE(b.cover_image, b.image_url, (b.image_gallery)[1]) AS image,
         b.mrp,
         b.price,
         COALESCE((
           SELECT array_agg(c.name ORDER BY c.name)
             FROM public.product_categories pc
             JOIN public.categories c ON c.id = pc.category_id
            WHERE pc.product_id = b.id
         ), ARRAY[]::text[]) AS category_names,
         EXISTS (
           SELECT 1 FROM public.shop_products sp
            WHERE sp.product_id = b.id AND sp.shop_id = _shop_id
         ) AS already_added,
         (SELECT count(*) FROM base) AS total_count
    FROM base b
   ORDER BY b.name
   LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0)
$function$;

CREATE OR REPLACE FUNCTION public.send_onesignal_push(_notification_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _n record;
  _app_id text;
  _api_key text;
  _player_ids text[];
  _req_id bigint;
  _prefs record;
BEGIN
  SELECT * INTO _n FROM public.notifications WHERE id = _notification_id;
  IF _n IS NULL THEN RETURN; END IF;

  -- Check user preferences
  SELECT * INTO _prefs FROM public.notification_preferences WHERE user_id = _n.user_id;
  IF _prefs.user_id IS NOT NULL AND _prefs.push_enabled = false THEN RETURN; END IF;

  SELECT value INTO _app_id  FROM public.app_config WHERE key = 'onesignal_app_id';
  SELECT value INTO _api_key FROM public.app_config WHERE key = 'onesignal_rest_api_key';
  IF _app_id IS NULL OR _api_key IS NULL THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'skipped', 'OneSignal config missing');
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT player_id) INTO _player_ids
  FROM public.onesignal_subscriptions WHERE user_id = _n.user_id;

  IF _player_ids IS NULL OR array_length(_player_ids, 1) IS NULL THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'no_subscribers', 'User has no OneSignal subscriptions');
    RETURN;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := 'https://api.onesignal.com/notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Basic ' || _api_key
      ),
      body := jsonb_build_object(
        'app_id', _app_id,
        'include_player_ids', to_jsonb(_player_ids),
        'headings', jsonb_build_object('en', _n.title),
        'contents', jsonb_build_object('en', COALESCE(_n.body, '')),
        'data', jsonb_build_object(
          'notification_id', _n.id,
          'category', _n.category,
          'payload', _n.data
        ),
        'web_url', COALESCE(_n.data->>'url', NULL)
      )
    ) INTO _req_id;

    INSERT INTO public.notification_dispatch_log(notification_id, user_id, request_id, status)
    VALUES (_notification_id, _n.user_id, _req_id, 'sent');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (_notification_id, _n.user_id, 'error', SQLERRM);
  END;
END $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at_dzs()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.shop_accept_child(_child_id uuid, _prep_minutes integer DEFAULT 15)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parent_id uuid; ord record;
BEGIN
  SELECT o.* INTO ord FROM orders o
    WHERE o.id = _child_id
      AND o.parent_order_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'child not found or not yours'; END IF;
  IF ord.status <> 'awaiting_shop' THEN RAISE EXCEPTION 'already processed'; END IF;

  UPDATE orders SET status = 'accepted_by_shop', prep_time_minutes = _prep_minutes, updated_at = now()
    WHERE id = _child_id;
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event, detail)
    VALUES (ord.parent_order_id, _child_id, ord.shop_id, auth.uid(), 'shop_accepted',
            jsonb_build_object('prep_minutes', _prep_minutes));

  -- If ALL siblings accepted, promote parent to accepted_by_shop
  IF NOT EXISTS (
    SELECT 1 FROM orders WHERE parent_order_id = ord.parent_order_id AND status = 'awaiting_shop'
  ) AND NOT EXISTS (
    SELECT 1 FROM orders WHERE parent_order_id = ord.parent_order_id AND status = 'cancelled'
  ) THEN
    UPDATE orders SET status = 'accepted_by_shop', updated_at = now()
      WHERE id = ord.parent_order_id AND status = 'awaiting_shop';
    PERFORM notify_user((SELECT user_id FROM orders WHERE id = ord.parent_order_id),
                       'All shops confirmed', 'Your order is being prepared.', 'order',
                       jsonb_build_object('order_id', ord.parent_order_id));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.shop_accept_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _cust uuid; _parent uuid; _status order_status;
BEGIN
  SELECT shop_id, user_id, parent_order_id, status INTO _shop_id, _cust, _parent, _status
  FROM public.orders WHERE id = _order_id;

  -- Multi-shop child order: delegate to the child-aware accept (handles parent rollup)
  IF _parent IS NOT NULL THEN
    IF _status = 'awaiting_shop'::order_status THEN
      PERFORM public.shop_accept_child(_order_id, 15);
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  UPDATE public.orders
  SET status = 'accepted_by_shop'::order_status, assignment_expires_at = NULL, updated_at = now()
  WHERE id = _order_id AND status = 'awaiting_shop'::order_status;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_cust, 'Order accepted', 'A shop is preparing your order.');
END
$function$;

CREATE OR REPLACE FUNCTION public.shop_assign_partner(_order_id uuid, _partner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _order_number text; _partner_user uuid;
BEGIN
  SELECT shop_id, order_number INTO _shop_id, _order_number FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid)
     AND NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  IF NOT public.has_role(_uid,'admin'::app_role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.shop_delivery_assignments
      WHERE shop_id = _shop_id AND delivery_partner_id = _partner_id
    ) THEN
      RAISE EXCEPTION 'Partner is not on this shop''s delivery team';
    END IF;
  END IF;

  UPDATE public.orders SET partner_id = _partner_id, updated_at = now()
    WHERE id = _order_id AND status IN ('packed'::order_status,'accepted_by_shop'::order_status);

  SELECT user_id INTO _partner_user FROM public.delivery_partners WHERE id = _partner_id;
  IF _partner_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_partner_user, 'New delivery assignment',
            'Order ' || COALESCE(_order_number,'') || ' assigned to you. Tap to accept.',
            'delivery_assignment',
            jsonb_build_object('order_id', _order_id, 'url', '/delivery/task/' || _order_id));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.shop_available_partners(_shop_id uuid)
 RETURNS TABLE(partner_id uuid, name text, phone text, vehicle text, is_online boolean, rating numeric, on_team boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT dp.id, dp.name, dp.phone, dp.vehicle, dp.is_online, dp.rating,
         EXISTS (SELECT 1 FROM public.shop_delivery_assignments a
                 WHERE a.delivery_partner_id = dp.id AND a.shop_id = _shop_id) AS on_team
  FROM public.delivery_partners dp
  WHERE (
    public.has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.owner_id = auth.uid())
  )
  ORDER BY dp.name ASC;
$function$;

CREATE OR REPLACE FUNCTION public.shop_list_team(_shop_id uuid)
 RETURNS TABLE(partner_id uuid, name text, phone text, vehicle text, is_online boolean, rating numeric, availability_status text, active_order_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT dp.id, dp.name, dp.phone, dp.vehicle, dp.is_online, dp.rating,
         dp.availability_status, dp.active_order_count
  FROM public.shop_delivery_assignments a
  JOIN public.delivery_partners dp ON dp.id = a.delivery_partner_id
  WHERE a.shop_id = _shop_id
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.owner_id = auth.uid())
    )
  ORDER BY dp.is_online DESC, dp.name ASC;
$function$;

CREATE OR REPLACE FUNCTION public.shop_live_team(_shop_id uuid)
 RETURNS TABLE(partner_id uuid, name text, phone text, vehicle text, is_online boolean, rating numeric, availability_status text, active_order_count integer, current_order_id uuid, current_order_number text, eta_minutes integer, status_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT dp.id, dp.name, dp.phone, dp.vehicle, dp.is_online, dp.rating,
         dp.availability_status, dp.active_order_count,
         dp.current_order_id, o.order_number, dp.eta_minutes, dp.status_updated_at
  FROM public.shop_delivery_assignments a
  JOIN public.delivery_partners dp ON dp.id = a.delivery_partner_id
  LEFT JOIN public.orders o ON o.id = dp.current_order_id
  WHERE a.shop_id = _shop_id
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.owner_id = auth.uid())
    )
  ORDER BY dp.is_online DESC, dp.status_updated_at DESC NULLS LAST, dp.name ASC;
$function$;

CREATE OR REPLACE FUNCTION public.shop_mark_child_ready(_child_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ord record;
BEGIN
  SELECT o.* INTO ord FROM orders o
    WHERE o.id = _child_id
      AND EXISTS (SELECT 1 FROM shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not your child'; END IF;
  UPDATE orders SET status = 'packed', ready_for_pickup_at = now(), updated_at = now() WHERE id = _child_id;
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event)
    VALUES (ord.parent_order_id, _child_id, ord.shop_id, auth.uid(), 'ready_for_pickup');

  -- If ALL children ready, promote parent to packed
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE parent_order_id = ord.parent_order_id
      AND status NOT IN ('packed','cancelled')
  ) THEN
    UPDATE orders SET status = 'packed', ready_for_pickup_at = now(), updated_at = now()
      WHERE id = ord.parent_order_id;
    -- Consume reservations (deduct stock, mark released)
    UPDATE shop_products sp SET stock = GREATEST(0, sp.stock - r.quantity)
      FROM inventory_reservations r
      WHERE r.shop_product_id = sp.id
        AND r.parent_order_id = ord.parent_order_id
        AND r.released = false;
    UPDATE inventory_reservations SET released = true, released_reason = 'consumed'
      WHERE parent_order_id = ord.parent_order_id AND released = false;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.shop_mark_collected(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _shop_id uuid; _cust uuid; _dt text; _num text;
BEGIN
  SELECT shop_id, user_id, delivery_type, order_number
    INTO _shop_id, _cust, _dt, _num
  FROM public.orders WHERE id = _order_id;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid)
     AND NOT public.has_role(_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;
  IF _dt <> 'pickup' THEN RAISE EXCEPTION 'Not a pickup order'; END IF;

  UPDATE public.orders
    SET status = 'delivered'::order_status, updated_at = now()
    WHERE id = _order_id AND status = 'packed'::order_status;

  IF _cust IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, category, data)
    VALUES (_cust, 'Order collected',
            'Thanks for collecting order ' || COALESCE(_num,'') || '. Enjoy!',
            'order', jsonb_build_object('order_id', _order_id));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.shop_mark_packed(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _shop_id uuid;
  _shop_owner uuid;
  _cust uuid;
  _order_number text;
  _dt text;
  _parent uuid;
  _status order_status;
  _partner record;
BEGIN
  SELECT o.shop_id, o.user_id, o.order_number, o.delivery_type, o.parent_order_id, o.status, s.owner_id
    INTO _shop_id, _cust, _order_number, _dt, _parent, _status, _shop_owner
  FROM public.orders o
  JOIN public.shops s ON s.id = o.shop_id
  WHERE o.id = _order_id;

  -- Multi-shop child order: delegate to the child-aware ready (handles parent rollup + reservations)
  IF _parent IS NOT NULL THEN
    IF _status = 'accepted_by_shop'::order_status THEN
      PERFORM public.shop_mark_child_ready(_order_id);
    END IF;
    RETURN;
  END IF;

  IF _shop_owner IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  UPDATE public.orders
  SET status = 'packed'::order_status, updated_at = now()
  WHERE id = _order_id AND status = 'accepted_by_shop'::order_status;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_cust, 'Order packed', 'Your order is packed and waiting for a delivery partner.');

  FOR _partner IN
    SELECT dp.user_id
    FROM public.shop_delivery_assignments sda
    JOIN public.delivery_partners dp ON dp.id = sda.delivery_partner_id
    WHERE sda.shop_id = _shop_id AND dp.is_online = true
  LOOP
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (
      _partner.user_id,
      CASE WHEN _dt = 'fast_delivery' THEN '⚡ FAST delivery — new order available' ELSE 'New order available' END,
      'Order ' || COALESCE(_order_number, '') || ' is packed and ready for pickup.'
    );
  END LOOP;
END
$function$;

CREATE OR REPLACE FUNCTION public.shop_partner_performance(_shop_id uuid)
 RETURNS TABLE(partner_id uuid, name text, phone text, is_online boolean, rating numeric, orders_today bigint, orders_7d bigint, avg_minutes_today numeric, on_time_pct numeric, hours_today numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT dp.id AS partner_id, dp.name, dp.phone, dp.is_online, dp.rating,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at::date = current_date) AS orders_today,
    COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND o.placed_at >= now() - interval '7 days') AS orders_7d,
    COALESCE(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.placed_at))/60.0)
      FILTER (WHERE o.status='delivered'::order_status AND o.placed_at::date = current_date), 0)::numeric AS avg_minutes_today,
    COALESCE(
      100.0 * COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status AND EXTRACT(EPOCH FROM (o.updated_at - o.placed_at))/60.0 <= 30)
      / NULLIF(COUNT(o.id) FILTER (WHERE o.status='delivered'::order_status), 0)
    , 0)::numeric AS on_time_pct,
    public.partner_today_hours(dp.id) AS hours_today
  FROM public.delivery_partners dp
  LEFT JOIN public.orders o ON o.partner_id = dp.id AND o.shop_id = _shop_id
  WHERE EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)))
  GROUP BY dp.id
  ORDER BY 6 DESC, dp.name ASC;
$function$;

CREATE OR REPLACE FUNCTION public.shop_reject_child(_child_id uuid, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ord record; parent_id uuid; excluded_shops uuid[];
  replacement_shop uuid; replacement_name text; replacement_dist numeric;
  covered_products uuid[]; new_child_id uuid;
  parent_row record;
BEGIN
  SELECT o.* INTO ord FROM orders o
    WHERE o.id = _child_id AND o.parent_order_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM shops s WHERE s.id = o.shop_id AND s.owner_id = auth.uid())
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'child not found or not yours'; END IF;
  IF ord.status NOT IN ('awaiting_shop','accepted_by_shop') THEN
    RAISE EXCEPTION 'cannot reject in status %', ord.status;
  END IF;

  parent_id := ord.parent_order_id;

  UPDATE orders SET status = 'cancelled', cancel_reason = _reason, cancelled_at = now(), updated_at = now()
    WHERE id = _child_id;
  UPDATE inventory_reservations SET released = true, released_reason = 'shop_rejected'
    WHERE child_order_id = _child_id AND released = false;

  INSERT INTO shop_assignment_history(order_id, shop_id, status, reason, responded_at)
    VALUES (parent_id, ord.shop_id, 'rejected', _reason, now());
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event, detail)
    VALUES (parent_id, _child_id, ord.shop_id, auth.uid(), 'shop_rejected', jsonb_build_object('reason', _reason));

  UPDATE orders SET rejected_shop_ids = array_append(rejected_shop_ids, ord.shop_id)
    WHERE id = parent_id AND NOT (rejected_shop_ids @> ARRAY[ord.shop_id]);

  SELECT * INTO parent_row FROM orders WHERE id = parent_id;
  excluded_shops := parent_row.rejected_shop_ids;

  SELECT ARRAY(SELECT product_id FROM order_items WHERE order_id = _child_id) INTO covered_products;

  SELECT sp.shop_id, s.name,
         (CASE WHEN parent_row.delivery_lat IS NULL THEN NULL
               ELSE ROUND((6371 * acos(LEAST(1, cos(radians(parent_row.delivery_lat)) * cos(radians(s.latitude))
                    * cos(radians(s.longitude) - radians(parent_row.delivery_lng))
                    + sin(radians(parent_row.delivery_lat)) * sin(radians(s.latitude)))))::numeric, 2)
          END) AS dist
    INTO replacement_shop, replacement_name, replacement_dist
  FROM shop_products sp
  JOIN shops s ON s.id = sp.shop_id AND s.is_open = true AND s.owner_id IS NOT NULL
  WHERE sp.product_id = ANY(covered_products)
    AND sp.is_available = true
    AND NOT (excluded_shops @> ARRAY[sp.shop_id])
    AND effective_available_stock(sp.id) > 0
  GROUP BY sp.shop_id, s.name, s.latitude, s.longitude
  HAVING COUNT(DISTINCT sp.product_id) = array_length(covered_products, 1)
  ORDER BY dist NULLS LAST
  LIMIT 1;

  IF replacement_shop IS NULL THEN
    UPDATE orders SET routing_status = 'partial_no_replacement', updated_at = now()
      WHERE id = parent_id;
    PERFORM notify_user(parent_row.user_id,
      'Some items unavailable',
      'A shop rejected part of your order and no replacement was found. Please review options.',
      'order', jsonb_build_object('order_id', parent_id));
    RETURN jsonb_build_object('replaced', false, 'reason', 'no_replacement');
  END IF;

  INSERT INTO orders(user_id, status, payment_method, subtotal, delivery_fee, handling_fee, tax, total,
                     address, delivery_lat, delivery_lng, delivery_pincode, delivery_type,
                     shop_id, parent_order_id, is_parent, shop_count, assignment_distance_km, pickup_otp)
    SELECT parent_row.user_id, 'awaiting_shop', parent_row.payment_method, ord.subtotal, 0, 0, 0, ord.subtotal,
           parent_row.address, parent_row.delivery_lat, parent_row.delivery_lng,
           parent_row.delivery_pincode, parent_row.delivery_type,
           replacement_shop, parent_id, false, 1, replacement_dist,
           lpad(floor(random() * 9000 + 1000)::text, 4, '0')
    RETURNING id INTO new_child_id;

  INSERT INTO order_items(order_id, child_order_id, shop_id, shop_product_id,
                          product_id, variant_id, name, image_url, unit, price, quantity)
    SELECT new_child_id, new_child_id, replacement_shop,
           (SELECT id FROM shop_products WHERE shop_id = replacement_shop AND product_id = oi.product_id),
           oi.product_id, oi.variant_id, oi.name, oi.image_url, oi.unit,
           COALESCE((SELECT price FROM shop_products WHERE shop_id = replacement_shop AND product_id = oi.product_id), oi.price),
           oi.quantity
    FROM order_items oi WHERE oi.order_id = _child_id;

  INSERT INTO inventory_reservations(parent_order_id, child_order_id, shop_product_id, quantity, expires_at)
    SELECT parent_id, new_child_id, oi.shop_product_id, oi.quantity, now() + interval '5 minutes'
    FROM order_items oi WHERE oi.order_id = new_child_id;

  INSERT INTO shop_assignment_history(order_id, shop_id, status, attempt_number)
    VALUES (parent_id, replacement_shop, 'assigned',
            (SELECT COUNT(*)+1 FROM shop_assignment_history WHERE order_id = parent_id));
  INSERT INTO pickup_events(parent_order_id, child_order_id, shop_id, actor_user_id, event, detail)
    VALUES (parent_id, new_child_id, replacement_shop, NULL, 'replacement_assigned',
            jsonb_build_object('replaced_child', _child_id));

  PERFORM notify_user((SELECT owner_id FROM shops WHERE id = replacement_shop),
                     'New order — ' || parent_row.order_number,
                     'Replacement order needs your acceptance.',
                     'order', jsonb_build_object('order_id', new_child_id, 'parent_order_id', parent_id));

  RETURN jsonb_build_object('replaced', true, 'new_child_id', new_child_id, 'shop_id', replacement_shop, 'shop_name', replacement_name);
END $function$;

CREATE OR REPLACE FUNCTION public.shop_reject_order(_order_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _shop_id uuid; _cust uuid;
  _lat double precision; _lng double precision; _attempts int;
  _parent uuid; _status order_status;
  _new_shop uuid; _new_name text; _dist numeric;
BEGIN
  SELECT shop_id, user_id, delivery_lat, delivery_lng, assignment_attempts, parent_order_id, status
    INTO _shop_id, _cust, _lat, _lng, _attempts, _parent, _status
  FROM public.orders WHERE id = _order_id;

  -- Multi-shop child order: delegate to child-aware reject (replacement-shop re-routing)
  IF _parent IS NOT NULL THEN
    IF _status IN ('awaiting_shop'::order_status, 'accepted_by_shop'::order_status) THEN
      PERFORM public.shop_reject_child(_order_id, _reason);
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'Not your shop';
  END IF;

  INSERT INTO public.shop_assignment_history(order_id, shop_id, status, reason, attempt_number, responded_at)
  VALUES (_order_id, _shop_id, 'rejected', _reason, COALESCE(_attempts, 0) + 1, now());

  UPDATE public.orders
  SET shop_id = NULL, status = 'awaiting_shop'::order_status,
      assignment_attempts = assignment_attempts + 1,
      assignment_expires_at = NULL,
      rejected_shop_ids = array_append(rejected_shop_ids, _shop_id),
      updated_at = now()
  WHERE id = _order_id;

  SELECT o.shop_id, s.name, o.assignment_distance_km INTO _new_shop, _new_name, _dist
  FROM public.find_nearest_shop_for_order(_order_id) o
  JOIN public.shops s ON s.id = o.shop_id;

  IF _new_shop IS NOT NULL THEN
    UPDATE public.orders
    SET shop_id = _new_shop, assignment_expires_at = now() + interval '10 minutes',
        assignment_distance_km = _dist, updated_at = now()
    WHERE id = _order_id;
    INSERT INTO public.shop_assignment_history(order_id, shop_id, status, attempt_number)
    VALUES (_order_id, _new_shop, 'assigned', COALESCE(_attempts, 0) + 2);
    PERFORM public.notify_shop_owner_on_assignment(_order_id, _new_shop, NULL);
  ELSE
    UPDATE public.orders SET status = 'no_shop_available'::order_status, updated_at = now()
    WHERE id = _order_id;
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (_cust, 'Order delayed', 'We could not find a shop for your order. Our team will help.');
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.shop_set_team(_shop_id uuid, _partner_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(_uid,'admin'::app_role)
          OR EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_id = _uid)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Block removal of partners that currently have active orders for this shop
  IF EXISTS (
    SELECT 1 FROM public.shop_delivery_assignments a
    JOIN public.orders o ON o.partner_id = a.delivery_partner_id
    WHERE a.shop_id = _shop_id
      AND NOT (a.delivery_partner_id = ANY(COALESCE(_partner_ids,'{}'::uuid[])))
      AND o.shop_id = _shop_id
      AND o.status IN ('packed'::order_status,'out_for_delivery'::order_status)
  ) THEN
    RAISE EXCEPTION 'Cannot remove a partner with active orders';
  END IF;

  DELETE FROM public.shop_delivery_assignments
  WHERE shop_id = _shop_id
    AND NOT (delivery_partner_id = ANY(COALESCE(_partner_ids,'{}'::uuid[])));

  INSERT INTO public.shop_delivery_assignments (shop_id, delivery_partner_id, assigned_by)
  SELECT _shop_id, pid, _uid
  FROM unnest(COALESCE(_partner_ids,'{}'::uuid[])) AS pid
  ON CONFLICT (shop_id, delivery_partner_id) DO NOTHING;
END $function$;

CREATE OR REPLACE FUNCTION public.submit_role_request(_role app_role, _data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _role NOT IN ('shopkeeper','delivery') THEN RAISE EXCEPTION 'Only shopkeeper or delivery role can be requested'; END IF;
  IF public.has_role(_uid, _role) THEN RAISE EXCEPTION 'You already have this role'; END IF;
  IF EXISTS (SELECT 1 FROM public.role_requests WHERE user_id = _uid AND requested_role = _role AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending request for this role';
  END IF;
  INSERT INTO public.role_requests(user_id, requested_role, data)
  VALUES (_uid, _role, COALESCE(_data,'{}'::jsonb)) RETURNING id INTO _id;
  INSERT INTO public.notifications(user_id, title, body, category, data)
  SELECT ur.user_id, 'New role request',
    'A user requested ' || _role::text || ' access.', 'role_request',
    jsonb_build_object('request_id', _id, 'url','/admin/role-requests')
  FROM public.user_roles ur WHERE ur.role = 'admin'::app_role;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.support_list_complaints()
 RETURNS TABLE(id uuid, ticket_number text, title text, description text, category text, status text, role_at_creation text, created_at timestamp with time zone, assigned_to uuid, user_id uuid, full_name text, phone text, address_line text, city text, pincode text, shop_name text, shop_address text, shop_phone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'support'::app_role)
    OR EXISTS (SELECT 1 FROM public.support_agents sa WHERE sa.user_id = auth.uid() AND sa.is_active = true)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    t.id, t.ticket_number, t.title, t.description,
    t.category::text, t.status::text, t.role_at_creation,
    t.created_at, t.assigned_to, t.user_id,
    p.full_name, COALESCE(p.phone, a.phone) AS phone,
    CONCAT_WS(', ', a.line1, a.line2, a.landmark) AS address_line,
    a.city, a.pincode,
    s.name AS shop_name, s.address AS shop_address, s.phone AS shop_phone
  FROM public.support_tickets t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN LATERAL (
    SELECT addr.* FROM public.addresses addr
    WHERE addr.user_id = t.user_id
    ORDER BY addr.is_default DESC NULLS LAST, addr.updated_at DESC
    LIMIT 1
  ) a ON TRUE
  LEFT JOIN LATERAL (
    SELECT sh.* FROM public.shops sh
    WHERE sh.owner_id = t.user_id
    ORDER BY sh.created_at ASC
    LIMIT 1
  ) s ON TRUE
  ORDER BY t.created_at DESC
  LIMIT 500;
END;
$function$;

CREATE OR REPLACE FUNCTION public.support_ticket_context(_ticket_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _t record; _out jsonb;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO _t FROM public.support_tickets WHERE id = _ticket_id;
  IF _t IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;

  _out := jsonb_build_object(
    'ticket', to_jsonb(_t),
    'creator', (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'phone', p.phone, 'email', u.email, 'created_at', p.created_at)
                FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE p.id = _t.user_id),
    'addresses', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.addresses a WHERE a.user_id = _t.user_id), '[]'::jsonb),
    'recent_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total,'placed_at',o.placed_at))
                  FROM (SELECT * FROM public.orders WHERE user_id = _t.user_id ORDER BY placed_at DESC LIMIT 10) o), '[]'::jsonb),
    'current_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total))
                  FROM public.orders o WHERE o.user_id = _t.user_id
                    AND o.status NOT IN ('delivered'::order_status,'cancelled'::order_status)), '[]'::jsonb),
    'referenced_order', (SELECT to_jsonb(o) FROM public.orders o WHERE o.id = _t.order_id),
    'shop', (SELECT jsonb_build_object('shop',to_jsonb(s),'owner',to_jsonb(p),'product_count',
                  (SELECT COUNT(*) FROM public.shop_products sp WHERE sp.shop_id = s.id),
                  'recent_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total))
                    FROM (SELECT * FROM public.orders WHERE shop_id = s.id ORDER BY placed_at DESC LIMIT 10) o), '[]'::jsonb))
              FROM public.shops s LEFT JOIN public.profiles p ON p.id = s.owner_id
              WHERE s.id = COALESCE(_t.shop_id, (SELECT shop_id FROM public.orders WHERE id = _t.order_id))
                 OR s.owner_id = _t.user_id
              LIMIT 1),
    'partner', (SELECT jsonb_build_object('partner', to_jsonb(dp),
                  'assigned_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'total',o.total))
                    FROM public.orders o WHERE o.partner_id = dp.id
                      AND o.status IN ('packed'::order_status,'out_for_delivery'::order_status)), '[]'::jsonb))
              FROM public.delivery_partners dp
              WHERE dp.id = _t.partner_id OR dp.user_id = _t.user_id
              LIMIT 1),
    'attachments', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.ticket_attachments a WHERE a.ticket_id = _t.id), '[]'::jsonb)
  );
  RETURN _out;
END $function$;

CREATE OR REPLACE FUNCTION public.tg_addresses_single_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- first address for a user is always the default
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.addresses a WHERE a.user_id = NEW.user_id AND a.id <> NEW.id
  ) THEN
    NEW.is_default := true;
  END IF;

  IF NEW.is_default THEN
    UPDATE public.addresses
       SET is_default = false, updated_at = now()
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_locations_normalize()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.state := btrim(NEW.state);
  NEW.city := btrim(NEW.city);
  NEW.pincode := regexp_replace(NEW.pincode, '\s', '', 'g');
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_product_subcategory_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE parent uuid;
BEGIN
  IF NEW.subcategory_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT category_id INTO parent FROM public.subcategories WHERE id = NEW.subcategory_id;
  IF parent IS NULL THEN
    RAISE EXCEPTION 'Subcategory does not exist';
  END IF;
  IF NEW.category_id IS NULL THEN
    NEW.category_id := parent;
  ELSIF NEW.category_id <> parent THEN
    RAISE EXCEPTION 'Subcategory does not belong to the selected category';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_products_normalize_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE dup_id uuid;
BEGIN
  NEW.name_normalized := public.normalize_product_name(NEW.name);
  IF NEW.name_normalized = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.name_normalized IS DISTINCT FROM OLD.name_normalized THEN
    SELECT p.id INTO dup_id
      FROM public.products p
     WHERE p.name_normalized = NEW.name_normalized
       AND (TG_OP = 'INSERT' OR p.id <> NEW.id)
     LIMIT 1;
    IF dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'This product already exists in the FlashBasket catalog. Use "Add from Catalog" instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_shop_closed_reassign()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.is_open AND OLD.status = 'active') AND NOT (NEW.is_open AND NEW.status = 'active') THEN
    PERFORM public.reassign_orders_from_closed_shop(NEW.id);
  END IF;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_notifications_dispatch_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM public.send_onesignal_push(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Never block the insert
    INSERT INTO public.notification_dispatch_log(notification_id, user_id, status, error)
    VALUES (NEW.id, NEW.user_id, 'trigger_error', SQLERRM);
  END;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_orders_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, to_value, meta)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(), 'created', NEW.status::text,
      jsonb_build_object('shop_id', NEW.shop_id, 'total', NEW.total));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(), 'status_change', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, from_value, to_value, meta)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(),
      CASE WHEN OLD.partner_id IS NULL THEN 'partner_assigned'
           WHEN NEW.partner_id IS NULL THEN 'partner_unassigned'
           ELSE 'partner_reassigned' END,
      COALESCE(OLD.partner_id::text,''), COALESCE(NEW.partner_id::text,''),
      '{}'::jsonb);
  END IF;
  IF NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(), 'shop_change',
      COALESCE(OLD.shop_id::text,''), COALESCE(NEW.shop_id::text,''));
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.order_audit_log(order_id, actor_id, actor_role, event_type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), public.actor_role_label(), 'payment_status', OLD.payment_status::text, NEW.payment_status::text);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_orders_partner_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _active_states order_status[] := ARRAY['packed'::order_status,'out_for_delivery'::order_status];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.partner_id IS NOT NULL AND NEW.status = ANY(_active_states) THEN
      UPDATE public.delivery_partners SET active_order_count = active_order_count + 1 WHERE id = NEW.partner_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- old contribution
    IF OLD.partner_id IS NOT NULL AND OLD.status = ANY(_active_states) THEN
      UPDATE public.delivery_partners SET active_order_count = GREATEST(active_order_count - 1, 0) WHERE id = OLD.partner_id;
    END IF;
    -- new contribution
    IF NEW.partner_id IS NOT NULL AND NEW.status = ANY(_active_states) THEN
      UPDATE public.delivery_partners SET active_order_count = active_order_count + 1 WHERE id = NEW.partner_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.partner_id IS NOT NULL AND OLD.status = ANY(_active_states) THEN
      UPDATE public.delivery_partners SET active_order_count = GREATEST(active_order_count - 1, 0) WHERE id = OLD.partner_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.update_ticket_status(_ticket_id uuid, _status ticket_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _creator uuid; _num text;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.support_tickets
    SET status = _status,
        resolved_at = CASE WHEN _status = 'resolved' THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
        closed_at = CASE WHEN _status = 'closed' THEN COALESCE(closed_at, now()) ELSE closed_at END,
        updated_at = now()
    WHERE id = _ticket_id
    RETURNING user_id, ticket_number INTO _creator, _num;
  IF _creator IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, category, data)
    VALUES (_creator, 'Ticket ' || _status::text, 'Your ticket ' || COALESCE(_num,'') || ' is now ' || _status::text || '.', 'support',
      jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.update_ticket_status(_ticket_id uuid, _status ticket_status, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _creator uuid;
  _num text;
  _role text;
  _title text;
  _body text;
BEGIN
  IF NOT (has_role(_uid,'support'::app_role) OR has_role(_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.support_tickets
    SET status = _status,
        resolution_notes = CASE WHEN _status = 'resolved' AND _notes IS NOT NULL AND length(trim(_notes)) > 0 THEN _notes ELSE resolution_notes END,
        resolved_by = CASE WHEN _status = 'resolved' THEN COALESCE(resolved_by, _uid) ELSE resolved_by END,
        resolved_at = CASE WHEN _status = 'resolved' THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
        closed_at = CASE WHEN _status = 'closed' THEN COALESCE(closed_at, now()) ELSE closed_at END,
        updated_at = now()
    WHERE id = _ticket_id
    RETURNING user_id, ticket_number, role_at_creation INTO _creator, _num, _role;

  IF _creator IS NULL THEN RETURN; END IF;

  IF _status = 'resolved' THEN
    _title := 'Complaint resolved';
    IF _role = 'customer' THEN
      _body := 'Your complaint ' || COALESCE(_num,'') || ' has been resolved. Please check the Help & Support section for details.';
    ELSIF _role = 'shopkeeper' THEN
      _body := 'Your support request ' || COALESCE(_num,'') || ' has been resolved. Please check the Support Center for details.';
    ELSIF _role = 'delivery' THEN
      _body := 'Your complaint ' || COALESCE(_num,'') || ' has been resolved. Please check the Support Center for details.';
    ELSE
      _body := 'Your ticket ' || COALESCE(_num,'') || ' has been resolved.';
    END IF;
  ELSIF _status = 'closed' THEN
    _title := 'Ticket closed';
    _body := 'Your ticket ' || COALESCE(_num,'') || ' has been closed.';
  ELSIF _status = 'in_progress' THEN
    _title := 'Ticket update';
    _body := 'Your ticket ' || COALESCE(_num,'') || ' is now in progress.';
  ELSE
    _title := 'Ticket ' || _status::text;
    _body := 'Your ticket ' || COALESCE(_num,'') || ' is now ' || _status::text || '.';
  END IF;

  INSERT INTO public.notifications(user_id, title, body, category, data)
  VALUES (_creator, _title, _body, 'support',
    jsonb_build_object('ticket_id', _ticket_id, 'url', '/support/ticket/' || _ticket_id));
END $function$;

CREATE OR REPLACE FUNCTION public.user_owns_shop_for_order(_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = _order_id AND s.owner_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric)
 RETURNS TABLE(code text, description text, discount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.coupons%ROWTYPE;
  disc numeric := 0;
BEGIN
  SELECT * INTO c FROM public.coupons
   WHERE coupons.code = upper(trim(_code)) AND active = true
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid coupon code';
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RAISE EXCEPTION 'Coupon expired';
  END IF;
  IF c.usage_limit IS NOT NULL AND c.times_used >= c.usage_limit THEN
    RAISE EXCEPTION 'Coupon usage limit reached';
  END IF;
  IF _subtotal < c.min_order THEN
    RAISE EXCEPTION 'Minimum order of % required', c.min_order;
  END IF;
  IF c.type::text = 'flat' THEN
    disc := LEAST(c.value, _subtotal);
  ELSE
    disc := (_subtotal * c.value) / 100.0;
    IF c.max_discount IS NOT NULL THEN
      disc := LEAST(disc, c.max_discount);
    END IF;
  END IF;
  RETURN QUERY SELECT c.code, c.description, round(disc::numeric, 2);
END;
$function$;

-- ---------- 7. Triggers (public schema) ----------
DROP TRIGGER IF EXISTS "addresses_single_default" ON addresses;
CREATE TRIGGER addresses_single_default BEFORE INSERT OR UPDATE OF is_default ON public.addresses FOR EACH ROW EXECUTE FUNCTION tg_addresses_single_default();
DROP TRIGGER IF EXISTS "trg_addr_updated" ON addresses;
CREATE TRIGGER trg_addr_updated BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_cart_updated" ON cart_items;
CREATE TRIGGER trg_cart_updated BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "collections_set_updated_at" ON collections;
CREATE TRIGGER collections_set_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_dzs_updated" ON delivery_zone_settings;
CREATE TRIGGER trg_dzs_updated BEFORE UPDATE ON public.delivery_zone_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at_dzs();
DROP TRIGGER IF EXISTS "tg_locations_normalize" ON locations;
CREATE TRIGGER tg_locations_normalize BEFORE INSERT OR UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION tg_locations_normalize();
DROP TRIGGER IF EXISTS "trg_locations_updated" ON locations;
CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "notif_prefs_updated" ON notification_preferences;
CREATE TRIGGER notif_prefs_updated BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "notifications_dispatch_push" ON notifications;
CREATE TRIGGER notifications_dispatch_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION trg_notifications_dispatch_push();
DROP TRIGGER IF EXISTS "offers_set_updated_at" ON offers;
CREATE TRIGGER offers_set_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "orders_audit_ins" ON orders;
CREATE TRIGGER orders_audit_ins AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION trg_orders_audit();
DROP TRIGGER IF EXISTS "orders_audit_upd" ON orders;
CREATE TRIGGER orders_audit_upd AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION trg_orders_audit();
DROP TRIGGER IF EXISTS "orders_partner_count" ON orders;
CREATE TRIGGER orders_partner_count AFTER INSERT OR DELETE OR UPDATE OF partner_id, status ON public.orders FOR EACH ROW EXECUTE FUNCTION trg_orders_partner_count();
DROP TRIGGER IF EXISTS "trg_notify_riders_parent_ready" ON orders;
CREATE TRIGGER trg_notify_riders_parent_ready AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION notify_riders_on_parent_ready();
DROP TRIGGER IF EXISTS "trg_notify_shop_owner_on_assignment_ins" ON orders;
CREATE TRIGGER trg_notify_shop_owner_on_assignment_ins AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION notify_shop_owner_on_assignment();
DROP TRIGGER IF EXISTS "trg_notify_shop_owner_on_assignment_upd" ON orders;
CREATE TRIGGER trg_notify_shop_owner_on_assignment_upd AFTER UPDATE OF shop_id, status ON public.orders FOR EACH ROW EXECUTE FUNCTION notify_shop_owner_on_assignment();
DROP TRIGGER IF EXISTS "trg_orders_updated" ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "payments_updated" ON payments;
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_pv_updated_at" ON product_variants;
CREATE TRIGGER trg_pv_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "products_normalize_name" ON products;
CREATE TRIGGER products_normalize_name BEFORE INSERT OR UPDATE OF name ON public.products FOR EACH ROW EXECUTE FUNCTION tg_products_normalize_name();
DROP TRIGGER IF EXISTS "trg_prod_updated" ON products;
CREATE TRIGGER trg_prod_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_product_subcategory_guard" ON products;
CREATE TRIGGER trg_product_subcategory_guard BEFORE INSERT OR UPDATE OF subcategory_id, category_id ON public.products FOR EACH ROW EXECUTE FUNCTION tg_product_subcategory_guard();
DROP TRIGGER IF EXISTS "trg_profiles_updated" ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_role_requests_updated" ON role_requests;
CREATE TRIGGER trg_role_requests_updated BEFORE UPDATE ON public.role_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_shop_categories_updated" ON shop_categories;
CREATE TRIGGER trg_shop_categories_updated BEFORE UPDATE ON public.shop_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "sc_set_updated" ON shop_collections;
CREATE TRIGGER sc_set_updated BEFORE UPDATE ON public.shop_collections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "shop_closed_reassign" ON shops;
CREATE TRIGGER shop_closed_reassign AFTER UPDATE OF is_open, status ON public.shops FOR EACH ROW EXECUTE FUNCTION tg_shop_closed_reassign();
DROP TRIGGER IF EXISTS "trg_subcategories_updated_at" ON subcategories;
CREATE TRIGGER trg_subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_support_agents_updated" ON support_agents;
CREATE TRIGGER trg_support_agents_updated BEFORE UPDATE ON public.support_agents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_support_tickets_updated" ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- 8. Auth trigger (profile auto-creation on signup) ----------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- 9. Row Level Security ----------
ALTER TABLE public."addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."app_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cart_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."delivery_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."delivery_partners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."delivery_zone_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inventory_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_dispatch_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."onesignal_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order_routing_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pickup_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_subcategories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."role_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."security_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shop_assignment_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shop_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shop_category_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shop_collection_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shop_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shop_delivery_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shop_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."subcategories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."support_agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."support_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ticket_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ticket_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."wishlist_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addr_own_all" ON public."addresses";
CREATE POLICY "addr_own_all" ON public."addresses" FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "app_config_admin_all" ON public."app_config";
CREATE POLICY "app_config_admin_all" ON public."app_config" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "cart_own_all" ON public."cart_items";
CREATE POLICY "cart_own_all" ON public."cart_items" FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "cat_admin_all" ON public."categories";
CREATE POLICY "cat_admin_all" ON public."categories" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "cat_public_read" ON public."categories";
CREATE POLICY "cat_public_read" ON public."categories" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "collections_admin_all" ON public."collections";
CREATE POLICY "collections_admin_all" ON public."collections" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "collections_public_read" ON public."collections";
CREATE POLICY "collections_public_read" ON public."collections" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "coupon_admin_all" ON public."coupons";
CREATE POLICY "coupon_admin_all" ON public."coupons" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "coupons_admin_shopkeeper_read" ON public."coupons";
CREATE POLICY "coupons_admin_shopkeeper_read" ON public."coupons" FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'shopkeeper'::app_role)));

DROP POLICY IF EXISTS "dm_customer_read" ON public."delivery_messages";
CREATE POLICY "dm_customer_read" ON public."delivery_messages" FOR SELECT TO authenticated USING ((customer_id = auth.uid()));

DROP POLICY IF EXISTS "dm_partner_read" ON public."delivery_messages";
CREATE POLICY "dm_partner_read" ON public."delivery_messages" FOR SELECT TO authenticated USING ((delivery_partner_id = current_user_partner_id()));

DROP POLICY IF EXISTS "dp_scoped_read" ON public."delivery_partners";
CREATE POLICY "dp_scoped_read" ON public."delivery_partners" FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "dp_self_all" ON public."delivery_partners";
CREATE POLICY "dp_self_all" ON public."delivery_partners" FOR ALL TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "dp_shopkeeper_read" ON public."delivery_partners";
CREATE POLICY "dp_shopkeeper_read" ON public."delivery_partners" FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM (shop_delivery_assignments a
     JOIN shops s ON ((s.id = a.shop_id)))
  WHERE ((a.delivery_partner_id = delivery_partners.id) AND (s.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = delivery_partners.shop_id) AND (s.owner_id = auth.uid()))))));

DROP POLICY IF EXISTS "dzs_admin_all" ON public."delivery_zone_settings";
CREATE POLICY "dzs_admin_all" ON public."delivery_zone_settings" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "dzs_public_read_active" ON public."delivery_zone_settings";
CREATE POLICY "dzs_public_read_active" ON public."delivery_zone_settings" FOR SELECT TO anon, authenticated USING ((is_active = true));

DROP POLICY IF EXISTS "reservations_admin_read" ON public."inventory_reservations";
CREATE POLICY "reservations_admin_read" ON public."inventory_reservations" FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "reservations_customer_read" ON public."inventory_reservations";
CREATE POLICY "reservations_customer_read" ON public."inventory_reservations" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = inventory_reservations.parent_order_id) AND (o.user_id = auth.uid())))));

DROP POLICY IF EXISTS "locations_admin_write" ON public."locations";
CREATE POLICY "locations_admin_write" ON public."locations" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "locations_public_read" ON public."locations";
CREATE POLICY "locations_public_read" ON public."locations" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "dispatch_log_admin_select" ON public."notification_dispatch_log";
CREATE POLICY "dispatch_log_admin_select" ON public."notification_dispatch_log" FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR (user_id = auth.uid())));

DROP POLICY IF EXISTS "notif_prefs_self_all" ON public."notification_preferences";
CREATE POLICY "notif_prefs_self_all" ON public."notification_preferences" FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "notif_own_all" ON public."notifications";
CREATE POLICY "notif_own_all" ON public."notifications" FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "offers_admin_all" ON public."offers";
CREATE POLICY "offers_admin_all" ON public."offers" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "offers_public_read" ON public."offers";
CREATE POLICY "offers_public_read" ON public."offers" FOR SELECT TO anon, authenticated USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now()))));

DROP POLICY IF EXISTS "offers_shop_owner_all" ON public."offers";
CREATE POLICY "offers_shop_owner_all" ON public."offers" FOR ALL TO authenticated USING (((scope = 'shop'::offer_scope) AND (EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = offers.shop_id) AND (s.owner_id = auth.uid())))))) WITH CHECK (((scope = 'shop'::offer_scope) AND (EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = offers.shop_id) AND (s.owner_id = auth.uid()))))));

DROP POLICY IF EXISTS "os_subs_self_all" ON public."onesignal_subscriptions";
CREATE POLICY "os_subs_self_all" ON public."onesignal_subscriptions" FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "oal_read" ON public."order_audit_log";
CREATE POLICY "oal_read" ON public."order_audit_log" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_audit_log.order_id) AND ((o.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM shops s
          WHERE ((s.id = o.shop_id) AND (s.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM delivery_partners dp
          WHERE ((dp.id = o.partner_id) AND (dp.user_id = auth.uid())))))))));

DROP POLICY IF EXISTS "oi_partner_select" ON public."order_items";
CREATE POLICY "oi_partner_select" ON public."order_items" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((orders o
     JOIN orders p ON ((p.id = COALESCE(o.parent_order_id, o.id))))
     JOIN delivery_partners dp ON ((dp.id = p.partner_id)))
  WHERE ((o.id = order_items.order_id) AND (dp.user_id = auth.uid())))));

DROP POLICY IF EXISTS "oi_self_insert" ON public."order_items";
CREATE POLICY "oi_self_insert" ON public."order_items" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid())))));

DROP POLICY IF EXISTS "oi_self_select" ON public."order_items";
CREATE POLICY "oi_self_select" ON public."order_items" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM shops s
          WHERE ((s.id = o.shop_id) AND (s.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM delivery_partners dp
          WHERE ((dp.id = o.partner_id) AND (dp.user_id = auth.uid())))))))));

DROP POLICY IF EXISTS "oi_shop_owner_select" ON public."order_items";
CREATE POLICY "oi_shop_owner_select" ON public."order_items" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (orders o
     JOIN shops s ON ((s.id = o.shop_id)))
  WHERE ((o.id = order_items.order_id) AND (s.owner_id = auth.uid())))));

DROP POLICY IF EXISTS "routing_log_admin_read" ON public."order_routing_log";
CREATE POLICY "routing_log_admin_read" ON public."order_routing_log" FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "orders_admin_update" ON public."orders";
CREATE POLICY "orders_admin_update" ON public."orders" FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "orders_self_insert" ON public."orders";
CREATE POLICY "orders_self_insert" ON public."orders" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "orders_shop_select" ON public."orders";
CREATE POLICY "orders_shop_select" ON public."orders" FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = orders.shop_id) AND (s.owner_id = auth.uid())))) OR (partner_id = current_user_partner_id())));

DROP POLICY IF EXISTS "attendance_self_read" ON public."partner_attendance";
CREATE POLICY "attendance_self_read" ON public."partner_attendance" FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM delivery_partners dp
  WHERE ((dp.id = partner_attendance.partner_id) AND (dp.user_id = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "attendance_self_update" ON public."partner_attendance";
CREATE POLICY "attendance_self_update" ON public."partner_attendance" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM delivery_partners dp
  WHERE ((dp.id = partner_attendance.partner_id) AND (dp.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM delivery_partners dp
  WHERE ((dp.id = partner_attendance.partner_id) AND (dp.user_id = auth.uid())))));

DROP POLICY IF EXISTS "attendance_self_write" ON public."partner_attendance";
CREATE POLICY "attendance_self_write" ON public."partner_attendance" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM delivery_partners dp
  WHERE ((dp.id = partner_attendance.partner_id) AND (dp.user_id = auth.uid())))));

DROP POLICY IF EXISTS "pay_self_insert" ON public."payments";
CREATE POLICY "pay_self_insert" ON public."payments" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "pay_self_select" ON public."payments";
CREATE POLICY "pay_self_select" ON public."payments" FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "pay_self_update" ON public."payments";
CREATE POLICY "pay_self_update" ON public."payments" FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "pickup_events_admin_read" ON public."pickup_events";
CREATE POLICY "pickup_events_admin_read" ON public."pickup_events" FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "pickup_events_customer_read" ON public."pickup_events";
CREATE POLICY "pickup_events_customer_read" ON public."pickup_events" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = pickup_events.parent_order_id) AND (o.user_id = auth.uid())))));

DROP POLICY IF EXISTS "pickup_events_partner_read" ON public."pickup_events";
CREATE POLICY "pickup_events_partner_read" ON public."pickup_events" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (orders o
     JOIN delivery_partners dp ON ((dp.id = o.partner_id)))
  WHERE ((o.id = pickup_events.parent_order_id) AND (dp.user_id = auth.uid())))));

DROP POLICY IF EXISTS "pickup_events_shopkeeper_read" ON public."pickup_events";
CREATE POLICY "pickup_events_shopkeeper_read" ON public."pickup_events" FOR SELECT TO authenticated USING (((shop_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = pickup_events.shop_id) AND (s.owner_id = auth.uid()))))));

DROP POLICY IF EXISTS "pc_admin_all" ON public."product_categories";
CREATE POLICY "pc_admin_all" ON public."product_categories" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "pc_public_read" ON public."product_categories";
CREATE POLICY "pc_public_read" ON public."product_categories" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pc_shopkeeper_manage" ON public."product_categories";
CREATE POLICY "pc_shopkeeper_manage" ON public."product_categories" FOR ALL TO authenticated USING ((has_role(auth.uid(), 'shopkeeper'::app_role) AND (EXISTS ( SELECT 1
   FROM (shop_products sp
     JOIN shops s ON ((s.id = sp.shop_id)))
  WHERE ((sp.product_id = product_categories.product_id) AND (s.owner_id = auth.uid())))))) WITH CHECK ((has_role(auth.uid(), 'shopkeeper'::app_role) AND (EXISTS ( SELECT 1
   FROM shops s
  WHERE (s.owner_id = auth.uid())))));

DROP POLICY IF EXISTS "pc_admin_all" ON public."product_collections";
CREATE POLICY "pc_admin_all" ON public."product_collections" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "pc_public_read" ON public."product_collections";
CREATE POLICY "pc_public_read" ON public."product_collections" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "psub_manage_staff" ON public."product_subcategories";
CREATE POLICY "psub_manage_staff" ON public."product_subcategories" FOR ALL TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR (EXISTS ( SELECT 1
   FROM (shop_products sp
     JOIN shops sh ON ((sh.id = sp.shop_id)))
  WHERE ((sp.product_id = product_subcategories.product_id) AND (sh.owner_id = auth.uid())))) OR has_role(auth.uid(), 'shopkeeper'::app_role))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'shopkeeper'::app_role)));

DROP POLICY IF EXISTS "psub_public_read" ON public."product_subcategories";
CREATE POLICY "psub_public_read" ON public."product_subcategories" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pv_public_read" ON public."product_variants";
CREATE POLICY "pv_public_read" ON public."product_variants" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pv_shopkeeper_manage" ON public."product_variants";
CREATE POLICY "pv_shopkeeper_manage" ON public."product_variants" FOR ALL TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM (shop_products sp
     JOIN shops s ON ((s.id = sp.shop_id)))
  WHERE ((sp.product_id = product_variants.product_id) AND (s.owner_id = auth.uid())))))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM (shop_products sp
     JOIN shops s ON ((s.id = sp.shop_id)))
  WHERE ((sp.product_id = product_variants.product_id) AND (s.owner_id = auth.uid()))))));

DROP POLICY IF EXISTS "prod_admin_all" ON public."products";
CREATE POLICY "prod_admin_all" ON public."products" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "prod_public_read" ON public."products";
CREATE POLICY "prod_public_read" ON public."products" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "prod_shopkeeper_insert" ON public."products";
CREATE POLICY "prod_shopkeeper_insert" ON public."products" FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'shopkeeper'::app_role) AND (EXISTS ( SELECT 1
   FROM shops s
  WHERE (s.owner_id = auth.uid())))));

DROP POLICY IF EXISTS "prod_shopkeeper_update" ON public."products";
CREATE POLICY "prod_shopkeeper_update" ON public."products" FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'shopkeeper'::app_role) AND (EXISTS ( SELECT 1
   FROM (shop_products sp
     JOIN shops s ON ((s.id = sp.shop_id)))
  WHERE ((sp.product_id = products.id) AND (s.owner_id = auth.uid())))))) WITH CHECK ((has_role(auth.uid(), 'shopkeeper'::app_role) AND (EXISTS ( SELECT 1
   FROM (shop_products sp
     JOIN shops s ON ((s.id = sp.shop_id)))
  WHERE ((sp.product_id = products.id) AND (s.owner_id = auth.uid()))))));

DROP POLICY IF EXISTS "profiles_self_insert" ON public."profiles";
CREATE POLICY "profiles_self_insert" ON public."profiles" FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "profiles_self_select" ON public."profiles";
CREATE POLICY "profiles_self_select" ON public."profiles" FOR SELECT TO authenticated USING ((auth.uid() = id));

DROP POLICY IF EXISTS "profiles_self_update" ON public."profiles";
CREATE POLICY "profiles_self_update" ON public."profiles" FOR UPDATE TO authenticated USING ((auth.uid() = id));

DROP POLICY IF EXISTS "rev_public_read" ON public."reviews";
CREATE POLICY "rev_public_read" ON public."reviews" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rev_self_write" ON public."reviews";
CREATE POLICY "rev_self_write" ON public."reviews" FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "rr_admin_update" ON public."role_requests";
CREATE POLICY "rr_admin_update" ON public."role_requests" FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "rr_self_insert" ON public."role_requests";
CREATE POLICY "rr_self_insert" ON public."role_requests" FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "rr_self_read" ON public."role_requests";
CREATE POLICY "rr_self_read" ON public."role_requests" FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "sal_super_admin_read" ON public."security_audit_log";
CREATE POLICY "sal_super_admin_read" ON public."security_audit_log" FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "assignment_history_admin_read" ON public."shop_assignment_history";
CREATE POLICY "assignment_history_admin_read" ON public."shop_assignment_history" FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "assignment_history_shop_read" ON public."shop_assignment_history";
CREATE POLICY "assignment_history_shop_read" ON public."shop_assignment_history" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = shop_assignment_history.shop_id) AND (s.owner_id = auth.uid())))));

DROP POLICY IF EXISTS "shop_categories_admin_all" ON public."shop_categories";
CREATE POLICY "shop_categories_admin_all" ON public."shop_categories" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "shop_categories_public_read" ON public."shop_categories";
CREATE POLICY "shop_categories_public_read" ON public."shop_categories" FOR SELECT TO anon, authenticated USING ((is_active = true));

DROP POLICY IF EXISTS "shop_cat_items_admin_write" ON public."shop_category_items";
CREATE POLICY "shop_cat_items_admin_write" ON public."shop_category_items" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "shop_cat_items_public_read" ON public."shop_category_items";
CREATE POLICY "shop_cat_items_public_read" ON public."shop_category_items" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sci_owner_write" ON public."shop_collection_items";
CREATE POLICY "sci_owner_write" ON public."shop_collection_items" FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (shop_collections c
     JOIN shops s ON ((s.id = c.shop_id)))
  WHERE ((c.id = shop_collection_items.collection_id) AND ((s.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (shop_collections c
     JOIN shops s ON ((s.id = c.shop_id)))
  WHERE ((c.id = shop_collection_items.collection_id) AND ((s.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))))));

DROP POLICY IF EXISTS "sci_public_read" ON public."shop_collection_items";
CREATE POLICY "sci_public_read" ON public."shop_collection_items" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sc_owner_all" ON public."shop_collections";
CREATE POLICY "sc_owner_all" ON public."shop_collections" FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = shop_collections.shop_id) AND ((s.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = shop_collections.shop_id) AND ((s.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))))));

DROP POLICY IF EXISTS "sc_public_read" ON public."shop_collections";
CREATE POLICY "sc_public_read" ON public."shop_collections" FOR SELECT TO anon, authenticated USING ((is_active = true));

DROP POLICY IF EXISTS "sda_admin_all" ON public."shop_delivery_assignments";
CREATE POLICY "sda_admin_all" ON public."shop_delivery_assignments" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "sda_partner_read" ON public."shop_delivery_assignments";
CREATE POLICY "sda_partner_read" ON public."shop_delivery_assignments" FOR SELECT TO authenticated USING ((delivery_partner_id = current_user_partner_id()));

DROP POLICY IF EXISTS "sda_shopkeeper_read" ON public."shop_delivery_assignments";
CREATE POLICY "sda_shopkeeper_read" ON public."shop_delivery_assignments" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = shop_delivery_assignments.shop_id) AND (s.owner_id = auth.uid())))));

DROP POLICY IF EXISTS "sp_public_read" ON public."shop_products";
CREATE POLICY "sp_public_read" ON public."shop_products" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sp_shop_owner_write" ON public."shop_products";
CREATE POLICY "sp_shop_owner_write" ON public."shop_products" FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = shop_products.shop_id) AND ((s.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shops s
  WHERE ((s.id = shop_products.shop_id) AND ((s.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))))));

DROP POLICY IF EXISTS "shops_admin_delete" ON public."shops";
CREATE POLICY "shops_admin_delete" ON public."shops" FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "shops_admin_insert" ON public."shops";
CREATE POLICY "shops_admin_insert" ON public."shops" FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "shops_owner_write" ON public."shops";
CREATE POLICY "shops_owner_write" ON public."shops" FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "shops_public_read" ON public."shops";
CREATE POLICY "shops_public_read" ON public."shops" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sub_admin_all" ON public."subcategories";
CREATE POLICY "sub_admin_all" ON public."subcategories" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "sub_public_read" ON public."subcategories";
CREATE POLICY "sub_public_read" ON public."subcategories" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "agents_manage_admin" ON public."support_agents";
CREATE POLICY "agents_manage_admin" ON public."support_agents" FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "agents_select" ON public."support_agents";
CREATE POLICY "agents_select" ON public."support_agents" FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "messages_insert" ON public."support_messages";
CREATE POLICY "messages_insert" ON public."support_messages" FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND (t.user_id = auth.uid())))) OR has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role))));

DROP POLICY IF EXISTS "messages_select" ON public."support_messages";
CREATE POLICY "messages_select" ON public."support_messages" FOR SELECT TO authenticated USING ((((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND (t.user_id = auth.uid())))) AND (is_internal_note = false)) OR has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "tickets_insert_own" ON public."support_tickets";
CREATE POLICY "tickets_insert_own" ON public."support_tickets" FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "tickets_select_own_or_support" ON public."support_tickets";
CREATE POLICY "tickets_select_own_or_support" ON public."support_tickets" FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "tickets_update_support" ON public."support_tickets";
CREATE POLICY "tickets_update_support" ON public."support_tickets" FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "assign_all_support" ON public."ticket_assignments";
CREATE POLICY "assign_all_support" ON public."ticket_assignments" FOR ALL TO authenticated USING ((has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK ((has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "att_insert" ON public."ticket_attachments";
CREATE POLICY "att_insert" ON public."ticket_attachments" FOR INSERT TO authenticated WITH CHECK (((uploaded_by = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = ticket_attachments.ticket_id) AND (t.user_id = auth.uid())))) OR has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role))));

DROP POLICY IF EXISTS "att_select" ON public."ticket_attachments";
CREATE POLICY "att_select" ON public."ticket_attachments" FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = ticket_attachments.ticket_id) AND (t.user_id = auth.uid())))) OR has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "roles_self_select" ON public."user_roles";
CREATE POLICY "roles_self_select" ON public."user_roles" FOR SELECT TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "wish_own_all" ON public."wishlist_items";
CREATE POLICY "wish_own_all" ON public."wishlist_items" FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "image_buckets_admin_delete" ON storage."objects";
CREATE POLICY "image_buckets_admin_delete" ON storage."objects" FOR DELETE TO authenticated USING (((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "image_buckets_admin_update" ON storage."objects";
CREATE POLICY "image_buckets_admin_update" ON storage."objects" FOR UPDATE TO authenticated USING (((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])) AND has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "image_buckets_admin_write" ON storage."objects";
CREATE POLICY "image_buckets_admin_write" ON storage."objects" FOR INSERT TO authenticated WITH CHECK (((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])) AND has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "image_buckets_public_read" ON storage."objects";
CREATE POLICY "image_buckets_public_read" ON storage."objects" FOR SELECT TO anon, authenticated USING ((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])));

DROP POLICY IF EXISTS "image_buckets_shopkeeper_delete" ON storage."objects";
CREATE POLICY "image_buckets_shopkeeper_delete" ON storage."objects" FOR DELETE TO authenticated USING (((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])) AND has_role(auth.uid(), 'shopkeeper'::app_role) AND (owner = auth.uid())));

DROP POLICY IF EXISTS "image_buckets_shopkeeper_update" ON storage."objects";
CREATE POLICY "image_buckets_shopkeeper_update" ON storage."objects" FOR UPDATE TO authenticated USING (((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])) AND has_role(auth.uid(), 'shopkeeper'::app_role) AND (owner = auth.uid()))) WITH CHECK (((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])) AND has_role(auth.uid(), 'shopkeeper'::app_role) AND (owner = auth.uid())));

DROP POLICY IF EXISTS "image_buckets_shopkeeper_write" ON storage."objects";
CREATE POLICY "image_buckets_shopkeeper_write" ON storage."objects" FOR INSERT TO authenticated WITH CHECK (((bucket_id = ANY (ARRAY['products'::text, 'categories'::text, 'offers'::text, 'shop-collections'::text])) AND has_role(auth.uid(), 'shopkeeper'::app_role)));

DROP POLICY IF EXISTS "support_att_delete" ON storage."objects";
CREATE POLICY "support_att_delete" ON storage."objects" FOR DELETE TO authenticated USING (((bucket_id = 'support-attachments'::text) AND ((owner = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))));

DROP POLICY IF EXISTS "support_att_insert" ON storage."objects";
CREATE POLICY "support_att_insert" ON storage."objects" FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'support-attachments'::text) AND (owner = auth.uid())));

DROP POLICY IF EXISTS "support_att_select" ON storage."objects";
CREATE POLICY "support_att_select" ON storage."objects" FOR SELECT TO authenticated USING (((bucket_id = 'support-attachments'::text) AND ((owner = auth.uid()) OR has_role(auth.uid(), 'support'::app_role) OR has_role(auth.uid(), 'admin'::app_role))));

DROP POLICY IF EXISTS "support_att_update" ON storage."objects";
CREATE POLICY "support_att_update" ON storage."objects" FOR UPDATE TO authenticated USING (((bucket_id = 'support-attachments'::text) AND ((owner = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))) WITH CHECK (((bucket_id = 'support-attachments'::text) AND ((owner = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))));

-- ---------- 10. Grants ----------
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."addresses" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."addresses" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."addresses" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."app_config" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."app_config" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."app_config" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."cart_items" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."cart_items" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."cart_items" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."categories" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."categories" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."categories" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."collections" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."collections" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."collections" TO service_role;
GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."coupons" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."coupons" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."coupons" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_messages" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_messages" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_messages" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_partners" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_partners" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_partners" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_zone_settings" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_zone_settings" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."delivery_zone_settings" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."inventory_reservations" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."inventory_reservations" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."inventory_reservations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."locations" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."locations" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."locations" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notification_dispatch_log" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notification_dispatch_log" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notification_dispatch_log" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notification_preferences" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notification_preferences" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notification_preferences" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notifications" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notifications" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."notifications" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."offers" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."offers" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."offers" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."onesignal_subscriptions" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."onesignal_subscriptions" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."onesignal_subscriptions" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_audit_log" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_audit_log" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_audit_log" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_items" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_items" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_items" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_routing_log" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_routing_log" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."order_routing_log" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."orders" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."orders" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."orders" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."partner_attendance" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."partner_attendance" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."partner_attendance" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."payments" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."payments" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."payments" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."pickup_events" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."pickup_events" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."pickup_events" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_categories" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_categories" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_categories" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_collections" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_collections" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_collections" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_subcategories" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_subcategories" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_subcategories" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_variants" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_variants" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."product_variants" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."products" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."products" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."products" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."profiles" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."profiles" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."profiles" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."reviews" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."reviews" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."reviews" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."role_requests" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."role_requests" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."role_requests" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."security_audit_log" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."security_audit_log" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."security_audit_log" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_assignment_history" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_assignment_history" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_assignment_history" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_categories" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_categories" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_categories" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_category_items" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_category_items" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_category_items" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_collection_items" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_collection_items" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_collection_items" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_collections" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_collections" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_collections" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_delivery_assignments" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_delivery_assignments" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_delivery_assignments" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_products" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_products" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shop_products" TO service_role;
GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shops" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shops" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."shops" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."subcategories" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."subcategories" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."subcategories" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_agents" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_agents" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_agents" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_messages" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_messages" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_messages" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_tickets" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_tickets" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."support_tickets" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."ticket_assignments" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."ticket_assignments" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."ticket_assignments" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."ticket_attachments" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."ticket_attachments" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."ticket_attachments" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."user_roles" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."user_roles" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."user_roles" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."wishlist_items" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."wishlist_items" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public."wishlist_items" TO service_role;

-- ---------- 11. Realtime ----------
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."delivery_messages";
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."delivery_partners";
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."notifications";
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."orders";
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."pickup_events";
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."shop_products";
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."support_messages";
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."support_tickets";
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
ALTER TABLE public."delivery_partners" REPLICA IDENTITY FULL;
ALTER TABLE public."orders" REPLICA IDENTITY FULL;

-- ---------- 12. Storage buckets ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('categories', 'categories', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('offers', 'offers', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('products', 'products', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('shop-collections', 'shop-collections', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('support-attachments', 'support-attachments', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- ---------- 13. Scheduled jobs (requires pg_cron) ----------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flashbasket_reassign_stale') THEN
      PERFORM cron.schedule('flashbasket_reassign_stale', '30 seconds', 'SELECT public.reassign_stale_orders();');
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-expiring-products-daily') THEN
      PERFORM cron.schedule('notify-expiring-products-daily', '0 8 * * *', 'SELECT public.notify_expiring_products();');
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-notifications') THEN
      PERFORM cron.schedule('purge-old-notifications', '17 3 * * *', 'SELECT public.purge_old_notifications();');
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release_expired_reservations') THEN
      PERFORM cron.schedule('release_expired_reservations', '* * * * *', ' SELECT public.release_expired_reservations(); ');
    END IF;
  END IF;
END $$;
