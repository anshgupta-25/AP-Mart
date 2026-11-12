# AP Mart

Hyperlocal quick-commerce grocery marketplace for India. Customers order from nearby independent shops; shopkeepers manage stock and orders; delivery partners carry orders; admins, support and a super admin run the platform.

**Stack:** React + TypeScript (TanStack Start/Router, Vite), Tailwind + shadcn/ui, Supabase (Auth, Postgres + RLS, Storage, Realtime), Razorpay (payments), Capacitor (Android).

## Portals

| Portal | Path | Roles |
|---|---|---|
| Customer | `/customer/*` | customer |
| Shopkeeper | `/shopkeeper/*` | shopkeeper |
| Delivery partner | `/delivery/*` | delivery |
| Admin | `/admin/*` | admin |
| Super Admin | `/super-admin/*` (alias `/superadmin/dashboard`) | super_admin |
| Support | `/support/*` | support |

After sign-in, `/dashboard` sends each user to the portal for their role. Roles live in the `user_roles` table and are enforced by Postgres RLS — never in user metadata.

---

## 1. Prerequisites

- **Node.js 22+** and **npm** (Capacitor 8's CLI requires Node 22)
- **Git**
- A **Supabase account** (free tier is fine)
- Optional: Supabase CLI (`npm i -g supabase`), Android Studio (mobile build)

## 2. Get the code and install

```bash
git clone <repo-url> ap-mart
cd ap-mart
npm install
```

## 3. Create your own Supabase project

Each developer should use their **own** Supabase project (or a shared team dev project — ask the lead). Never develop against production.

1. supabase.com → **New project**. Save the database password.
2. **Project Settings → API**: note the **Project URL**, the **publishable (anon) key**, and (for scripts only) the **service_role / secret key**.

## 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in the five Supabase values and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (server code needs it for payments and admin actions). Optional keys are listed in `.env.example`; the app runs without them but those features are disabled:

| Feature | Variables | Google / provider setup |
|---|---|---|
| Maps, address search | `VITE_GOOGLE_MAPS_BROWSER_KEY` | Enable **Maps JavaScript API** + **Places API**; restrict the key by HTTP referrer |
| Pin to address, ETA, routes | `GOOGLE_MAPS_API_KEY` | Enable **Geocoding API** + **Routes API** |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay dashboard (test mode for dev) |
| Push notifications | `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase console: web app config, Cloud Messaging VAPID key, service account key |

All variables in `.env` (not just `VITE_*`) are loaded into the server's `process.env` by `vite.config.ts` in dev, and by `npm start` in production.

> `.env` is git-ignored. **Never commit keys.** The service-role key must never be put in a `VITE_*` variable or any frontend code.

## 5. Create the database

The schema is in `supabase/migrations/` (apply in filename order).

**Option A — Supabase CLI (recommended)**
```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B — SQL Editor**
Run `supabase-export/01_schema.sql` as one query (it is idempotent), then `supabase-export/02_core_catalog_data.sql` for starter catalogue data (categories, products, locations, delivery zones).

Then in **Database → Extensions** make sure `pg_net`, `pg_trgm`, `pgcrypto`, `uuid-ossp` (and `pg_cron` if you want scheduled jobs) are enabled.

## 6. Storage buckets

Five **private** buckets are created by the schema: `products`, `categories`, `offers`, `shop-collections`, `support-attachments`. Check **Storage** in the dashboard. Do **not** make them public — the app serves images through signed URLs.

Images are stored in the database as `storage://<bucket>/<path>`; upload only through the app (it uses one shared upload service).

## 7. Configure Authentication

In **Authentication**:

- **URL Configuration** → Site URL: your site URL (`http://localhost:8080` for local). Redirect URLs: add `http://localhost:8080/**` (and your deployed URL).
- **Providers → Email**: enabled, *Confirm email* on.
- **Emails → SMTP Settings**: set up a **custom SMTP provider** (Resend, Brevo, SendGrid, …). The built-in Supabase mailer only delivers to your own team members and is heavily rate-limited — without custom SMTP, sign-ups fail with *"Error sending confirmation email"*. Use a verified sender address.
- **Providers → Google** (optional): create an OAuth client in Google Cloud Console and add `https://<your-project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.

## 8. Run the app

```bash
npm run dev
```

Open **http://localhost:8080**. Other commands:

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build (`.output/`, Node server) |
| `npm start` | Run the production build (reads `.env`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |

## 9. Test accounts for the six portals (development only)

Creates confirmed users for every role through the Supabase Auth Admin API (idempotent — safe to re-run).

```bash
cp .env.migration.example .env.migration     # then paste your service_role key
node scripts/seed-test-accounts.mjs --yes
```

| Role | Email | Password |
|---|---|---|
| Customer | customer.test@example.com | FlashTest@2026! |
| Delivery partner | delivery.test@example.com | FlashTest@2026! |
| Support | support.test@example.com | FlashTest@2026! |
| Shopkeeper | shopkeeper.test@example.com | FlashTest@2026! |
| Admin | admin.test@example.com | FlashTest@2026! |
| Super Admin | superadmin.test@example.com | FlashTest@2026! |

While running `npm run dev`, the **/login** page shows "Login as …" buttons for these. That panel is compiled out of production builds. **Never run the seed script against production.**

## 10. Optional: Android app (Capacitor)

```bash
npm run build
npx cap sync android
npx cap open android      # opens Android Studio
```
`android/app/src/main/assets/public` is generated and git-ignored.

## 11. Push notifications (OneSignal, optional)

The OneSignal **REST API key** is a secret and is not in the repo. After running the migrations, add it once in the SQL Editor:
```sql
INSERT INTO public.app_config (key, value) VALUES ('onesignal_rest_api_key', '<your key>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

## 12. Moving images from an old project

`scripts/storage-dry-run.mjs` is a read-only report of image references in a data export; it copies nothing. Copying objects between projects is a separate, approved step — ask the lead before doing it.

---

## Project layout

```
src/routes/        one file per screen (file-based routing, per portal)
src/components/    shared UI (ProductCard, StorageImg, ImageInput, …)
src/hooks/         auth, cart, delivery context, catalog queries
src/lib/           storage service, auth error messages, helpers
src/integrations/  Supabase client and generated types
supabase/migrations/  database schema + RLS history
supabase-export/   01_schema.sql, 02_core_catalog_data.sql (starter data)
scripts/           dev-only helper scripts (never run in production)
android/           Capacitor Android project
```

## Team rules

- Never commit `.env`, `.env.migration`, keys, or exports containing customer/shop data (the ignore rules block the common ones).
- Never put a service-role key in frontend code or a `VITE_*` variable.
- Schema changes go in a **new** file in `supabase/migrations/` — do not edit old ones, and keep RLS enabled.
- Roles are assigned by admins/super admins (or the seed script in dev), never via public sign-up.
- Run `npx tsc --noEmit` and `npm run build` before opening a PR.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Error sending confirmation email" on sign-up | Configure custom SMTP (step 7). |
| Google sign-in fails | Add the Supabase callback URL in Google Cloud and your site to Supabase Redirect URLs (step 7). |
| Product images show a cart icon | The image file isn't in this project's Storage bucket (see step 11), or the bucket policy isn't applied. |
| "Missing Supabase environment variable(s)" | `.env` missing or not filled; restart `npm run dev`. |
| Products/categories empty | Run `02_core_catalog_data.sql` and make sure the customer has a saved address in a serviceable PIN code. |
