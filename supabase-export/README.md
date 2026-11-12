# AP Mart — Database Migration Package

Everything needed to move the app to **your own Supabase project** as the single source of truth.

## Package contents

| File | What it contains | Required? |
|---|---|---|
| `01_schema.sql` | Extensions, enum types, 48 tables, all foreign keys, indexes, 133 database functions, 30 triggers, all 112 RLS policies, grants, realtime publication, storage buckets, scheduled jobs | Yes — run first |
| `02_core_catalog_data.sql` | Categories, subcategories, locations, products, variants, collections, coupons, offers, delivery zones, app config (273 rows) | Yes |
| `03_shops_inventory_data.sql` | Shops and their inventory/categories (163 rows) | Yes |
| `04_user_linked_data.sql` | Profiles, roles, addresses, orders, payments, notifications, support tickets, etc. (860 rows) | Optional — only if you migrate auth users with the **same IDs** |

All statements are **idempotent and non-destructive**: `IF NOT EXISTS` / `OR REPLACE` / `ON CONFLICT DO NOTHING`. Nothing in your project is ever overwritten or deleted; re-running is safe.

## Steps

### 1. Create your Supabase project
supabase.com → New project. Note the Project URL, publishable key, and service-role key (Project Settings → API).

### 2. Run the SQL files
In your project's **SQL Editor**, run in this order, each as one query:
1. `01_schema.sql`
2. `02_core_catalog_data.sql`
3. `03_shops_inventory_data.sql`
4. `04_user_linked_data.sql` — **only** if you will migrate user accounts with identical IDs (step 5). Otherwise skip it; new signups will start fresh.

### 3. Enable extensions
Dashboard → Database → Extensions: ensure `pg_net`, `pg_trgm`, `pgcrypto`, `uuid-ossp`, and (for scheduled jobs) `pg_cron` are enabled. The schema file creates what it can automatically.

### 4. Configure Auth
- **Authentication → URL Configuration**: set Site URL to your app's URL; add redirect URLs for your domain(s) and `http://localhost:5173/**` for local dev.
- **Google sign-in**: create OAuth credentials in Google Cloud Console (redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`), then enable the Google provider in Authentication → Providers with those credentials. The app code tries the managed broker first and automatically falls back to your project's native Google OAuth.
- **Phone OTP** (if used): configure an SMS provider under Authentication → Providers → Phone.

### 5. Migrating existing users (optional)
Lovable Cloud does not expose the auth user store, so accounts cannot be bulk-exported with passwords. To keep orders/profiles linked, create users in your project via the Auth Admin API reusing the same user IDs, then run `04_user_linked_data.sql`. Otherwise skip the file and have users sign up again.

### 6. Environment variables
Copy `.env.example` (repo root) to `.env` and fill in your project's keys. Redeploy/restart after changing.

### 7. Secrets that live in the database
- OneSignal REST API key is intentionally **not** exported. Re-add it: `INSERT INTO public.app_config (key, value) VALUES ('onesignal_rest_api_key', 'YOUR_KEY') ON CONFLICT (key) DO UPDATE SET value = excluded.value;`

### 8. Storage
The 5 private buckets (`categories`, `offers`, `products`, `shop-collections`, `support-attachments`) are created by `01_schema.sql` along with their access policies. Existing files are not copied — re-upload product/category images via the admin UI, or copy objects between projects with the Supabase Storage API.

### 9. Post-migration checklist
- Sign up a Super Admin and grant the role (see `SUPER_ADMIN_*` env vars / provisioning flow).
- Add your shop's Razorpay keys if you accept online payments.
- Verify: browse catalog → add to cart → place order → shopkeeper sees it → rider flow. Realtime updates require the tables added to the `supabase_realtime` publication (handled by `01_schema.sql`).

## Notes
- Table-level grants are intentionally broad; **RLS policies enforce all actual access control** — identical to the current production setup.
- The `orders` table uses `REPLICA IDENTITY FULL` (needed for live order tracking) — already included.
