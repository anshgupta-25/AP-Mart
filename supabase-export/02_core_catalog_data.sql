-- ============================================================================
-- AP MART DATA — core catalog (no user accounts needed)
-- INSERT ... ON CONFLICT DO NOTHING: existing rows in YOUR project are never overwritten.

-- ============================================================================

-- categories: 14 rows
INSERT INTO public."categories"
SELECT * FROM jsonb_populate_recordset(NULL::public."categories", $EXPORT$
[
 {
  "color": "#A3E635",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 1,
  "icon": "🥬",
  "id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Fruits & Vegetables",
  "slug": "fruits-vegetables"
 },
 {
  "color": "#FDE68A",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 2,
  "icon": "🥛",
  "id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Dairy, Bread & Eggs",
  "slug": "dairy-bread-eggs"
 },
 {
  "color": "#FCA5A5",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 3,
  "icon": "🍿",
  "id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Snacks & Munchies",
  "slug": "snacks-munchies"
 },
 {
  "color": "#7DD3FC",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 4,
  "icon": "🥤",
  "id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Cold Drinks & Juices",
  "slug": "cold-drinks-juices"
 },
 {
  "color": "#FDBA74",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 5,
  "icon": "🍜",
  "id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Instant & Frozen Food",
  "slug": "instant-frozen"
 },
 {
  "color": "#D6BC8A",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 6,
  "icon": "☕",
  "id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Tea, Coffee & Drinks",
  "slug": "tea-coffee"
 },
 {
  "color": "#FBCFE8",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 7,
  "icon": "🍞",
  "id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Bakery & Biscuits",
  "slug": "bakery-biscuits"
 },
 {
  "color": "#FEF08A",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 8,
  "icon": "🌾",
  "id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Atta, Rice & Dal",
  "slug": "atta-rice-dal"
 },
 {
  "color": "#A7F3D0",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 9,
  "icon": "🧴",
  "id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Cleaning Essentials",
  "slug": "cleaning-essentials"
 },
 {
  "color": "#C4B5FD",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "display_order": 10,
  "icon": "🧼",
  "id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Personal Care",
  "slug": "personal-care"
 },
 {
  "color": "#ffffff",
  "created_at": "2026-07-15T10:30:24.418053+00:00",
  "display_order": 2,
  "icon": "😋",
  "id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Food oil ",
  "slug": "food-oil"
 },
 {
  "color": "#dcfce7",
  "created_at": "2026-08-06T08:43:07.835522+00:00",
  "display_order": 5,
  "icon": "🛒😋",
  "id": "34b34b83-d6cb-45a7-8469-7388bff82acd",
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/categories/346f97f5-c6e4-4034-8e4b-c2191cac8056.jpeg?token=[REDACTED]",
  "is_active": true,
  "is_featured": false,
  "name": "Loose product",
  "slug": "loose-product"
 },
 {
  "color": "#dcfce7",
  "created_at": "2026-08-24T15:29:17.675416+00:00",
  "display_order": 111,
  "icon": "🛒",
  "id": "89bcbe5a-c4a0-4434-87ea-7aa8ddbce2c8",
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/categories/ff2f14c8-7a36-4206-be36-22386a9f997d.png?token=[REDACTED]",
  "is_active": true,
  "is_featured": false,
  "name": "cake",
  "slug": "cake"
 },
 {
  "color": "#dcfce7",
  "created_at": "2026-08-03T22:24:11.98004+00:00",
  "display_order": 0,
  "icon": "🪔",
  "id": "5bfc14a5-d44b-4280-bde0-1687262b9e78",
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/categories/4fc67da0-62a8-4ee7-8d36-b0365606d2ed.jpg?token=[REDACTED]",
  "is_active": true,
  "is_featured": false,
  "name": "Pujan samagry",
  "slug": "pujan-samagry"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- subcategories: 54 rows
INSERT INTO public."subcategories"
SELECT * FROM jsonb_populate_recordset(NULL::public."subcategories", $EXPORT$
[
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-06T06:49:22.651761+00:00",
  "display_order": 1,
  "icon": null,
  "id": "2eea9c14-d0bd-43f6-b025-3786d5ac3dac",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Milk",
  "slug": "milk",
  "updated_at": "2026-08-06T06:49:22.651761+00:00"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-06T06:49:22.651761+00:00",
  "display_order": 2,
  "icon": null,
  "id": "f87e506d-26f1-40ef-8ddd-508919345973",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Butter",
  "slug": "butter",
  "updated_at": "2026-08-06T06:49:22.651761+00:00"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-06T06:49:22.651761+00:00",
  "display_order": 3,
  "icon": null,
  "id": "82722bad-dcaf-4690-b0e3-6f7885d4f5e7",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Cheese",
  "slug": "cheese",
  "updated_at": "2026-08-06T06:49:22.651761+00:00"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-06T06:49:22.651761+00:00",
  "display_order": 4,
  "icon": null,
  "id": "230f29c3-7870-4ebe-8e02-f19bbef3139e",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Paneer",
  "slug": "paneer",
  "updated_at": "2026-08-06T06:49:22.651761+00:00"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-06T06:49:22.651761+00:00",
  "display_order": 5,
  "icon": null,
  "id": "ad350830-283c-4225-b50c-d15c1074fe99",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Curd",
  "slug": "curd",
  "updated_at": "2026-08-06T06:49:22.651761+00:00"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "a5fc3bb0-f6f2-4b49-a3fd-be586f62219f",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Exotic",
  "slug": "exotic",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "c73259a8-4d24-4eea-aeee-0817463c3cde",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Herbs & Seasonings",
  "slug": "herbs-seasonings",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "8279afb7-682b-4560-8504-187b84515fff",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Fresh Vegetables",
  "slug": "fresh-vegetables",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "01044f64-0e19-4d13-88df-fd92355c4e8f",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Fresh Fruits",
  "slug": "fresh-fruits",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "96c8b08c-4a98-4dcc-98e0-17773cd8750f",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Popcorn",
  "slug": "popcorn",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "86973cb3-64f1-4044-86dc-317346c94fc4",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Chocolates",
  "slug": "chocolates",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "109db8ba-7956-42fb-885b-9e5b90daf075",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Namkeen",
  "slug": "namkeen",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "17db706e-5ba2-4708-afa9-13cf0bd7ab28",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Chips",
  "slug": "chips",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "ef0a4518-c4dc-475a-8dd3-d9b6a6f385e4",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Energy Drinks",
  "slug": "energy-drinks",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "7fc59268-d1d6-4521-83fb-69440d5c6a25",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Water",
  "slug": "water",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "951ffb59-0a61-4334-a9cd-eb1569bf0933",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Juices",
  "slug": "juices",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "174c9985-74fc-4e36-8147-adcc292bc362",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Soft Drinks",
  "slug": "soft-drinks",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "5848dbe0-c21b-4436-a2cf-fe78eae64c34",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Soups",
  "slug": "soups",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "03399479-7961-420d-85d4-5375d5450c05",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Ready to Eat",
  "slug": "ready-to-eat",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "16080f03-d925-4170-9c1f-e77ece07ade7",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Frozen Snacks",
  "slug": "frozen-snacks",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "7b2253f2-e2f8-43fa-b20d-80bfc5d8a22c",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Noodles",
  "slug": "noodles",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "6820840d-f87f-419d-be83-cef4104bc1cb",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Milk Mixes",
  "slug": "milk-mixes",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "0dc3f3b8-9c46-4a81-99b2-7f497d391977",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Health Drinks",
  "slug": "health-drinks",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "f144d53a-debc-448e-85a7-d5c0e3ffac98",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Coffee",
  "slug": "coffee",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "e239a79b-0b21-4f91-87e4-a376ef661594",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Tea",
  "slug": "tea",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "6da153fb-69d2-46f8-a90f-3ba4ff807c57",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Rusk",
  "slug": "rusk",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "f93f7bc8-21b0-4e33-8a78-7aae4d5c9d45",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Cookies",
  "slug": "cookies",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "97607328-afe3-48ac-a220-c91101922af9",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Biscuits",
  "slug": "biscuits",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "acdfa082-9f7c-4aa3-9026-d4a0dd896478",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Bread",
  "slug": "bread",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 5,
  "icon": null,
  "id": "3ae97e69-dfca-4e77-9152-8ed1379d4f21",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Salt",
  "slug": "salt",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "1d877c33-c334-4e91-a463-96336b68f35d",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Sugar",
  "slug": "sugar",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "14374436-5a3c-416c-90d5-5ee348234263",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Atta & Flour",
  "slug": "atta-flour",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "9372996a-fbce-422d-af1c-4c127182a0a4",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Dal",
  "slug": "dal",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "293a7de9-9db5-4214-a6a1-0baed979a84c",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Rice",
  "slug": "rice",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "507fc826-5fb3-454b-a1a6-f27a2264b073",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Fresheners",
  "slug": "fresheners",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "b5e95586-9d4e-4fa5-9de5-bf506cb001ca",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Floor Cleaners",
  "slug": "floor-cleaners",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "f387f361-9161-45b7-93eb-22604b73166a",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Dishwash",
  "slug": "dishwash",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "2f6ddf41-c135-43cc-ad92-59a7a2eed260",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Detergents",
  "slug": "detergents",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "0f8db444-e4e8-4516-b7dd-04a9e88a4240",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Skin Care",
  "slug": "skin-care",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "449cf4c2-dd76-4180-bff7-28f139e4045c",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Oral Care",
  "slug": "oral-care",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "3fe51cbe-58e4-46d4-a37b-d0ea3d50c6b3",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Hair Care",
  "slug": "hair-care",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "dbeb86ba-bd4f-4088-9032-73d4cd93c6a2",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Bath & Body",
  "slug": "bath-body",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "fbec38cc-ad48-4d2d-aa7a-47636bd619c4",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Ghee",
  "slug": "ghee",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "0b895ed6-2c84-44e6-8bfe-08cefea4b0fb",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Sunflower Oil",
  "slug": "sunflower-oil",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "c12bd3e5-5f8f-45b3-80ec-95f871c12abb",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Mustard Oil",
  "slug": "mustard-oil",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "54c87501-ce24-4829-a1c7-3c0769e91c07",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Cooking Oil",
  "slug": "cooking-oil",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "5bfc14a5-d44b-4280-bde0-1687262b9e78",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 4,
  "icon": null,
  "id": "e6289a96-3558-4035-bd0e-954ba54bf398",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Flowers",
  "slug": "flowers",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "5bfc14a5-d44b-4280-bde0-1687262b9e78",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 3,
  "icon": null,
  "id": "51c484ae-c5e9-455a-8dd9-0d7428ebe015",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Camphor",
  "slug": "camphor",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "5bfc14a5-d44b-4280-bde0-1687262b9e78",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 2,
  "icon": null,
  "id": "989b8a80-7f3f-416d-b377-5297bb7a8568",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Diya",
  "slug": "diya",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "5bfc14a5-d44b-4280-bde0-1687262b9e78",
  "created_at": "2026-08-06T06:55:01.117654+00:00",
  "display_order": 1,
  "icon": null,
  "id": "15a4a5e0-ae0f-4028-9c26-63988f6f67bf",
  "image_url": null,
  "is_active": true,
  "is_featured": false,
  "name": "Agarbatti",
  "slug": "agarbatti",
  "updated_at": "2026-08-06T06:55:01.117654+00:00"
 },
 {
  "category_id": "5bfc14a5-d44b-4280-bde0-1687262b9e78",
  "created_at": "2026-08-06T07:02:04.032442+00:00",
  "display_order": 5,
  "icon": null,
  "id": "58ebe0a6-e887-4360-a27a-9ee6e4075201",
  "image_url": null,
  "is_active": true,
  "is_featured": true,
  "name": "oil",
  "slug": "oil",
  "updated_at": "2026-08-06T07:02:04.032442+00:00"
 },
 {
  "category_id": "34b34b83-d6cb-45a7-8469-7388bff82acd",
  "created_at": "2026-08-06T08:43:59.040934+00:00",
  "display_order": 0,
  "icon": null,
  "id": "bfd01f31-8076-46fd-a197-c485f3263f7a",
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/categories/0d95ce3e-221e-45c6-9244-f5cb1336715e.jpeg?token=[REDACTED]",
  "is_active": true,
  "is_featured": false,
  "name": "Dal",
  "slug": "dal",
  "updated_at": "2026-08-06T08:43:59.040934+00:00"
 },
 {
  "category_id": "34b34b83-d6cb-45a7-8469-7388bff82acd",
  "created_at": "2026-08-06T08:49:57.277275+00:00",
  "display_order": 0,
  "icon": null,
  "id": "0ea25cd6-98c2-4e6f-ae95-5b0c3e1c5067",
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/categories/d32bfe1e-9e32-4f33-b98f-ff50262a1965.jpeg?token=[REDACTED]",
  "is_active": true,
  "is_featured": false,
  "name": "Seeds",
  "slug": "seeds",
  "updated_at": "2026-08-06T08:49:57.277275+00:00"
 },
 {
  "category_id": "89bcbe5a-c4a0-4434-87ea-7aa8ddbce2c8",
  "created_at": "2026-08-24T15:30:52.162256+00:00",
  "display_order": 0,
  "icon": null,
  "id": "2184116c-f7c6-41eb-a7df-f555341b3d45",
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/categories/daab79ab-e90b-48a2-9baf-ebafbb868ec0.png?token=[REDACTED]",
  "is_active": true,
  "is_featured": false,
  "name": "cream for cake",
  "slug": "cream-for-cake",
  "updated_at": "2026-08-24T15:30:55.951008+00:00"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- locations: 44 rows
INSERT INTO public."locations"
SELECT * FROM jsonb_populate_recordset(NULL::public."locations", $EXPORT$
[
 {
  "city": "Noida",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "437826c2-4a0e-4285-a0b4-98147d1fa7c7",
  "is_active": true,
  "pincode": "201301",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Noida",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "02d62f5e-1a47-4e74-96fc-aa47fd41fc6a",
  "is_active": true,
  "pincode": "201302",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Noida",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "93ad78c2-2327-4029-8bf1-9f687ced0da6",
  "is_active": true,
  "pincode": "201303",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Noida",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "c8773b67-c6d8-4d9f-8924-ec332a696e31",
  "is_active": true,
  "pincode": "201304",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Noida",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "ac08595e-1194-40a9-a146-8d4866989ceb",
  "is_active": true,
  "pincode": "201305",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Lucknow",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "9658b02c-6e16-4661-83f0-85c1dbc5bb84",
  "is_active": true,
  "pincode": "226001",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Lucknow",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "0342ea43-11e6-4be0-a820-cc3ca913855f",
  "is_active": true,
  "pincode": "226010",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Lucknow",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "fd3b8832-cd91-4aba-80de-c4d71211ff63",
  "is_active": true,
  "pincode": "226016",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Kanpur",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "aefea17e-6622-47d3-b574-edfebf8e1486",
  "is_active": true,
  "pincode": "208001",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Kanpur",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "332dbb28-5124-4827-9367-09f33f0a103c",
  "is_active": true,
  "pincode": "208012",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Agra",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "b0e97618-0224-43ff-bf6a-ae4238798970",
  "is_active": true,
  "pincode": "282001",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Agra",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "4bec1cba-c002-4a53-b83e-7422e7c8f663",
  "is_active": true,
  "pincode": "282005",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Varanasi",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "abd8a36b-6ef3-459a-a0c8-44f1c2e3441d",
  "is_active": true,
  "pincode": "221001",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Varanasi",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "a437c26b-a678-4c3a-b680-1c569ce112b0",
  "is_active": true,
  "pincode": "221005",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Prayagraj",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "5a203878-0e43-4de7-a067-c85ef9619a3d",
  "is_active": true,
  "pincode": "211001",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Prayagraj",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "9fe07e36-4d63-461c-ad95-cb5d74a6f6f4",
  "is_active": true,
  "pincode": "211003",
  "state": "Uttar Pradesh",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Patna",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "f5894deb-a29f-4af6-bcab-2e99a1731bd5",
  "is_active": true,
  "pincode": "800001",
  "state": "Bihar",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Patna",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "a447a8dd-ea37-4a3c-bb62-82ce2418fb69",
  "is_active": true,
  "pincode": "800013",
  "state": "Bihar",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Patna",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "4c6870b9-cf5a-4dd9-a8d8-b2388b2b8fdd",
  "is_active": true,
  "pincode": "800020",
  "state": "Bihar",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Gaya",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "d4d37b39-b3fc-45fe-b233-12757b58a2f4",
  "is_active": true,
  "pincode": "823001",
  "state": "Bihar",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Muzaffarpur",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "436356d3-6b1b-4ea4-98fd-8546e57eefce",
  "is_active": true,
  "pincode": "842001",
  "state": "Bihar",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Bhagalpur",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "f311a6e3-f424-433e-a992-2eb0a8f95650",
  "is_active": true,
  "pincode": "812001",
  "state": "Bihar",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "New Delhi",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "226f9c06-75c7-4c0b-bb4f-51d5110ebabe",
  "is_active": true,
  "pincode": "110001",
  "state": "Delhi",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "New Delhi",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "01b4ccf0-2298-44ce-80d9-740a9cfb33fa",
  "is_active": true,
  "pincode": "110003",
  "state": "Delhi",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "New Delhi",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "4ff1793d-5f5a-4a94-bd7d-90e0e723f7a5",
  "is_active": true,
  "pincode": "110016",
  "state": "Delhi",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Dwarka",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "820898de-4986-4153-86c0-6994f54162d0",
  "is_active": true,
  "pincode": "110075",
  "state": "Delhi",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Rohini",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "d4308615-5a5c-4268-b318-6fa69ba3a07e",
  "is_active": true,
  "pincode": "110085",
  "state": "Delhi",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Saket",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "5f38862e-5a9b-450d-b2a6-617d3b47a075",
  "is_active": true,
  "pincode": "110017",
  "state": "Delhi",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Gurugram",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "d88bde02-ada6-48c8-b20a-0496f095dc40",
  "is_active": true,
  "pincode": "122001",
  "state": "Haryana",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Gurugram",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "e70a9e33-56ae-427f-affb-9d8e2d3df668",
  "is_active": true,
  "pincode": "122002",
  "state": "Haryana",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Gurugram",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "a2e67c65-0db1-45db-81d1-a06e5a33a7b2",
  "is_active": true,
  "pincode": "122018",
  "state": "Haryana",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Faridabad",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "fdc25a1d-f217-4910-8439-85645c372683",
  "is_active": true,
  "pincode": "121001",
  "state": "Haryana",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Faridabad",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "9e7223c3-ce3b-4bf6-8693-224f55c831cb",
  "is_active": true,
  "pincode": "121003",
  "state": "Haryana",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Panipat",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "f488531d-2ff4-48f3-bdaf-5a714dde7152",
  "is_active": true,
  "pincode": "132103",
  "state": "Haryana",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Karnal",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "b2a0c5fb-7a34-4ca8-9f76-c35720398e4c",
  "is_active": true,
  "pincode": "132001",
  "state": "Haryana",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Ludhiana",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "cd0a46be-6dc1-47d4-8aaa-5e366275406b",
  "is_active": true,
  "pincode": "141001",
  "state": "Punjab",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Ludhiana",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "6d5db5d7-3bd3-4693-a904-fe3057102fea",
  "is_active": true,
  "pincode": "141002",
  "state": "Punjab",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Amritsar",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "3ec64420-7d55-41bf-ae31-bb97c0587e3c",
  "is_active": true,
  "pincode": "143001",
  "state": "Punjab",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Amritsar",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "4e5e2e55-7763-49f8-98e2-1cdc1b8eb188",
  "is_active": true,
  "pincode": "143005",
  "state": "Punjab",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Jalandhar",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "ccd6f5ef-308d-4e90-b425-5fa924663116",
  "is_active": true,
  "pincode": "144001",
  "state": "Punjab",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Patiala",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "8cd90ac4-1f32-4fd3-b4cc-8f912472a5a8",
  "is_active": true,
  "pincode": "147001",
  "state": "Punjab",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "Mohali",
  "created_at": "2026-07-17T10:33:20.504505+00:00",
  "id": "87df94e8-3dcc-4129-aa12-6310b83c7583",
  "is_active": true,
  "pincode": "160055",
  "state": "Punjab",
  "updated_at": "2026-07-17T10:33:20.504505+00:00"
 },
 {
  "city": "phagwara",
  "created_at": "2026-08-08T07:12:42.337084+00:00",
  "id": "fea0a966-66af-4dc5-bc35-bed77eee1ef3",
  "is_active": true,
  "pincode": "144411",
  "state": "Punjab",
  "updated_at": "2026-08-08T07:12:42.337084+00:00"
 },
 {
  "city": "Kanpur",
  "created_at": "2026-08-08T07:28:02.360535+00:00",
  "id": "9eb42d81-2dd7-43ce-9a0f-fbf1156650db",
  "is_active": true,
  "pincode": "208020",
  "state": "Uttar Pradesh",
  "updated_at": "2026-08-08T07:28:02.360535+00:00"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- products: 57 rows
INSERT INTO public."products"
SELECT * FROM jsonb_populate_recordset(NULL::public."products", $EXPORT$
[
 {
  "brand": "Adani ",
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/aa836f9a-a2a0-4b31-b498-60e75bb3a765.jpeg?token=[REDACTED]",
  "created_at": "2026-08-19T06:16:25.458163+00:00",
  "delivery_minutes": 12,
  "description": "",
  "id": "9edb5ff1-4f89-4a8b-aa41-a33a77a1b9c7",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/aa836f9a-a2a0-4b31-b498-60e75bb3a765.jpeg?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/aa836f9a-a2a0-4b31-b498-60e75bb3a765.jpeg?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 185,
  "name": "Fortune refined ",
  "name_normalized": "fortunerefined",
  "price": 150,
  "rating": 4.2,
  "slug": "fortune-refined-v00t3",
  "stock": 0,
  "subcategory_id": "54c87501-ce24-4829-a1c7-3c0769e91c07",
  "unit": "1L",
  "updated_at": "2026-08-20T03:42:58.625157+00:00"
 },
 {
  "brand": "xxx",
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b029ea7d-f658-4a0e-b128-815e5719bb40.png?token=[REDACTED]",
  "created_at": "2026-07-12T17:30:59.720937+00:00",
  "delivery_minutes": 12,
  "description": "xxx",
  "id": "a158ed41-d448-4f33-bf17-a4c3d843ebce",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b029ea7d-f658-4a0e-b128-815e5719bb40.png?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b39e179a-abac-489d-9cde-dc764cda3ce7.png?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/ab20ef39-ee7a-421f-b4dc-4623dd43e312.png?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b029ea7d-f658-4a0e-b128-815e5719bb40.png?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 5000,
  "name": "gold",
  "name_normalized": "gold",
  "price": 5000,
  "rating": 4.2,
  "slug": "gold-xivms",
  "stock": 0,
  "subcategory_id": null,
  "unit": "1pc",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "k",
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/03cdb9a0-97b8-4c48-a931-677689ccdfa7.png?token=[REDACTED]",
  "created_at": "2026-07-24T12:46:28.122805+00:00",
  "delivery_minutes": 12,
  "description": "nice",
  "id": "bc3a106f-5138-4a95-9797-0fbaa01f7603",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/03cdb9a0-97b8-4c48-a931-677689ccdfa7.png?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/03cdb9a0-97b8-4c48-a931-677689ccdfa7.png?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 43,
  "name": "cake",
  "name_normalized": "cake",
  "price": 32,
  "rating": 4.2,
  "slug": "cake-3aisc",
  "stock": 0,
  "subcategory_id": "acdfa082-9f7c-4aa3-9026-d4a0dd896478",
  "unit": "pc",
  "updated_at": "2026-08-20T03:41:24.869982+00:00"
 },
 {
  "brand": "",
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "cover_image": null,
  "created_at": "2026-08-24T16:46:13.2071+00:00",
  "delivery_minutes": 12,
  "description": "",
  "id": "2f25c65e-7da7-44b1-b6f6-b81a9712551e",
  "image_gallery": [],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/fcaa9c7b-2a3f-4133-9515-474b459a8067.webp?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 40,
  "name": "Banana",
  "name_normalized": "banana",
  "price": 35,
  "rating": 4.2,
  "slug": "banana",
  "stock": 10,
  "subcategory_id": null,
  "unit": "1 pc",
  "updated_at": "2026-08-24T16:46:13.2071+00:00"
 },
 {
  "brand": "coke",
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/1f68cb9c-2e54-4490-a8d3-87b89693e372.png?token=[REDACTED]",
  "created_at": "2026-07-23T13:31:31.500738+00:00",
  "delivery_minutes": 12,
  "description": "nice",
  "id": "217e6c08-8101-4a77-a917-7fa00b1a63c9",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/1f68cb9c-2e54-4490-a8d3-87b89693e372.png?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/1f68cb9c-2e54-4490-a8d3-87b89693e372.png?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 20,
  "name": "coke",
  "name_normalized": "coke",
  "price": 20,
  "rating": 4.2,
  "slug": "coke-ikwv4",
  "stock": 0,
  "subcategory_id": null,
  "unit": "1 pc",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "FlashFarm",
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "cover_image": "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Premium quality onions",
  "id": "5ef9708e-c84d-4a80-927e-c52ee592c675",
  "image_gallery": [
   "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": false,
  "mrp": 49,
  "name": "Onion",
  "name_normalized": "onion",
  "price": 39,
  "rating": 4.4,
  "slug": "onion",
  "stock": 150,
  "subcategory_id": null,
  "unit": "1 kg",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "FlashFarm",
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "cover_image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Fresh potatoes",
  "id": "ec4fb524-0fe5-452e-a782-933a1f6e6401",
  "image_gallery": [
   "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 45,
  "name": "Potato",
  "name_normalized": "potato",
  "price": 32,
  "rating": 4.4,
  "slug": "potato",
  "stock": 180,
  "subcategory_id": null,
  "unit": "1 kg",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Namaste india ",
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/d9dd70f6-8cd0-4397-a75f-a6665e20e737.jpeg?token=[REDACTED]",
  "created_at": "2026-07-15T10:19:00.539472+00:00",
  "delivery_minutes": 12,
  "description": "Namaste India Ghee - Pure Goodness for Your Kitchen\nWelcome to ApMarts-apna Mart 😃😃, where quality meets tradition! Introducing Namaste India Ghee – a must-have for every household that values authentic taste and wholesome ingredients. From the trusted brand Namaste India, this premium ghee is crafted to bring the richness of purity and health to your meals.\n\nWhy Choose Namaste India Ghee?\n\nPure Quality: Made with the finest ingredients, ensuring unmatched purity and natural taste.\nVersatile Use: Perfect for cooking, baking, frying, or simply adding that delightful aroma to your favorite dishes.\nRich in Nutrition: Packed with essential nutrients like healthy fats and vitamins to keep you energized.\nAuthentic Taste: Brings the traditional, homemade flavor to every spoonful.\nWhether you're preparing a comforting bowl of dal, drizzling it over hot rotis, or making festive sweets, Namaste India Ghee is your go-to choice for enhancing every culinary creation. Loved by families across the country, this ghee is a symbol of trust and uncompromising quality.\n\nReady to transform your cooking? Add Namaste India Ghee to your pantry today and experience the magic of pure, delicious ghee in every meal!\n\nShop now at ApMarts-apna Mart 😃😃 and elevate your cooking to the next level!",
  "id": "66b9ede6-c189-4873-80da-1dfc05df6140",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/d9dd70f6-8cd0-4397-a75f-a6665e20e737.jpeg?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/d9dd70f6-8cd0-4397-a75f-a6665e20e737.jpeg?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 250,
  "name": "Namaste india ghee ",
  "name_normalized": "namasteindiaghee",
  "price": 235,
  "rating": 4.2,
  "slug": "namaste-india-ghee",
  "stock": 1,
  "subcategory_id": "fbec38cc-ad48-4d2d-aa7a-47636bd619c4",
  "unit": "1 pak",
  "updated_at": "2026-08-20T03:40:39.727084+00:00"
 },
 {
  "brand": "amul",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/02392897-4c4c-4887-ba1d-06ef92031fc8.png?token=[REDACTED]",
  "created_at": "2026-07-17T11:02:21.72592+00:00",
  "delivery_minutes": 12,
  "description": "amul dairy",
  "id": "33c7479d-d171-43fc-8293-6b0627c658a3",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/02392897-4c4c-4887-ba1d-06ef92031fc8.png?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/02392897-4c4c-4887-ba1d-06ef92031fc8.png?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 25,
  "name": "very samll  milk",
  "name_normalized": "verysamllmilk",
  "price": 20,
  "rating": 4.2,
  "slug": "very-samll-milk-90zqw",
  "stock": 0,
  "subcategory_id": null,
  "unit": "100 pc",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Maggi",
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "cover_image": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "2-minute noodles",
  "id": "8aa16eb3-46ca-4f3c-8bb7-26ef375ad601",
  "image_gallery": [
   "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 14,
  "name": "Maggi Masala Noodles",
  "name_normalized": "maggimasalanoodles",
  "price": 14,
  "rating": 4.7,
  "slug": "maggi-noodles",
  "stock": 400,
  "subcategory_id": null,
  "unit": "70 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Mx",
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "cover_image": null,
  "created_at": "2026-07-28T08:27:24.834693+00:00",
  "delivery_minutes": 12,
  "description": "Gun",
  "id": "fcb0ea7b-945e-4513-b160-8b2035bcfac2",
  "image_gallery": [],
  "image_url": null,
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 6,
  "name": "Gun",
  "name_normalized": "gun",
  "price": 68,
  "rating": 4.2,
  "slug": "gun-c3i5k",
  "stock": 0,
  "subcategory_id": null,
  "unit": "Pcs",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Loose product",
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "cover_image": null,
  "created_at": "2026-08-03T22:14:08.960448+00:00",
  "delivery_minutes": 12,
  "description": "100% natural",
  "id": "1e838830-5343-43cb-a56a-3784939ab3a3",
  "image_gallery": [],
  "image_url": null,
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 180,
  "name": "Elaichi",
  "name_normalized": "elaichi",
  "price": 180,
  "rating": 4.2,
  "slug": "elaichi-mpwp1",
  "stock": 0,
  "subcategory_id": null,
  "unit": "1",
  "updated_at": "2026-08-03T22:14:08.960448+00:00"
 },
 {
  "brand": "FlashFarm",
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "cover_image": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Fresh farm bananas, naturally ripened",
  "id": "76ebd853-9544-4a5a-87e1-f9dc6dfbe955",
  "image_gallery": [
   "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 79,
  "name": "Banana Robusta",
  "name_normalized": "bananarobusta",
  "price": 59,
  "rating": 4.5,
  "slug": "banana-robusta",
  "stock": 120,
  "subcategory_id": "01044f64-0e19-4d13-88df-fd92355c4e8f",
  "unit": "1 dozen",
  "updated_at": "2026-08-20T03:41:54.610417+00:00"
 },
 {
  "brand": "FlashFarm",
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "cover_image": "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Juicy red tomatoes",
  "id": "27b5ab8c-1c86-4c14-b6f5-7eb843031b71",
  "image_gallery": [
   "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 35,
  "name": "Hybrid Tomato",
  "name_normalized": "hybridtomato",
  "price": 24,
  "rating": 4.3,
  "slug": "tomato-hybrid",
  "stock": 200,
  "subcategory_id": null,
  "unit": "500 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "amul",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/02392897-4c4c-4887-ba1d-06ef92031fc8.png?token=[REDACTED]",
  "created_at": "2026-07-17T11:02:38.874344+00:00",
  "delivery_minutes": 12,
  "description": "amul dairy",
  "id": "6caf792e-af86-47dc-ab86-968d5f34e05a",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/02392897-4c4c-4887-ba1d-06ef92031fc8.png?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/02392897-4c4c-4887-ba1d-06ef92031fc8.png?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 25,
  "name": " milk",
  "name_normalized": "milk",
  "price": 20,
  "rating": 4.2,
  "slug": "very-samll-milk-kvovp",
  "stock": 0,
  "subcategory_id": "2eea9c14-d0bd-43f6-b025-3786d5ac3dac",
  "unit": "100 pc",
  "updated_at": "2026-08-20T03:20:04.30457+00:00"
 },
 {
  "brand": "Amul",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Fresh toned milk",
  "id": "9141d7b6-d328-403c-a2d7-946934eca930",
  "image_gallery": [
   "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 30,
  "name": "Amul Toned Milk",
  "name_normalized": "amultonedmilk",
  "price": 28,
  "rating": 4.7,
  "slug": "milk-amul",
  "stock": 200,
  "subcategory_id": null,
  "unit": "500 ml",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Eggoz",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Farm fresh eggs",
  "id": "aa602e24-cecc-4caa-8ff8-20a410178011",
  "image_gallery": [
   "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 75,
  "name": "White Eggs",
  "name_normalized": "whiteeggs",
  "price": 64,
  "rating": 4.5,
  "slug": "eggs-white",
  "stock": 100,
  "subcategory_id": null,
  "unit": "6 pcs",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Amul",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Salted butter",
  "id": "db729496-1676-4f8d-b5ba-1fdb49f05c10",
  "image_gallery": [
   "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": false,
  "mrp": 60,
  "name": "Amul Butter",
  "name_normalized": "amulbutter",
  "price": 58,
  "rating": 4.8,
  "slug": "butter-amul",
  "stock": 90,
  "subcategory_id": null,
  "unit": "100 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Mother Dairy",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 12,
  "description": "Soft paneer cubes",
  "id": "66a93437-9748-4d42-ac3b-4a076aa0c2ce",
  "image_gallery": [
   "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": true,
  "mrp": 110,
  "name": "Fresh Paneer",
  "name_normalized": "freshpaneer",
  "price": 95,
  "rating": 4.5,
  "slug": "paneer",
  "stock": 60,
  "subcategory_id": null,
  "unit": "200 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Lay's",
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "cover_image": "https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Crispy potato chips",
  "id": "193220e1-0bc1-4999-a7df-48c9be7f50f4",
  "image_gallery": [
   "https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 20,
  "name": "Lay's Classic Salted",
  "name_normalized": "laysclassicsalted",
  "price": 20,
  "rating": 4.4,
  "slug": "lays-classic",
  "stock": 300,
  "subcategory_id": null,
  "unit": "52 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Kurkure",
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "cover_image": "https://images.unsplash.com/photo-1599629954294-14df9ec8bc03?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Crunchy corn puffs",
  "id": "a264675e-90cc-4c72-91ab-406157a07f41",
  "image_gallery": [
   "https://images.unsplash.com/photo-1599629954294-14df9ec8bc03?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1599629954294-14df9ec8bc03?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": false,
  "mrp": 20,
  "name": "Kurkure Masala Munch",
  "name_normalized": "kurkuremasalamunch",
  "price": 20,
  "rating": 4.3,
  "slug": "kurkure",
  "stock": 250,
  "subcategory_id": null,
  "unit": "85 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Haldiram",
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "cover_image": "https://images.unsplash.com/photo-1606471191009-63994c53433b?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Crispy gram flour snack",
  "id": "ecac5bdb-b9cd-4b7d-8f8d-082dcab152c7",
  "image_gallery": [
   "https://images.unsplash.com/photo-1606471191009-63994c53433b?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1606471191009-63994c53433b?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": true,
  "mrp": 65,
  "name": "Haldiram Bhujia",
  "name_normalized": "haldirambhujia",
  "price": 55,
  "rating": 4.5,
  "slug": "haldiram-bhujia",
  "stock": 120,
  "subcategory_id": null,
  "unit": "200 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Cadbury",
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "cover_image": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Chocolate sandwich cookies",
  "id": "82adfd19-c90f-42ca-bcf0-27ae05af317b",
  "image_gallery": [
   "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": false,
  "mrp": 40,
  "name": "Oreo Cookies",
  "name_normalized": "oreocookies",
  "price": 35,
  "rating": 4.6,
  "slug": "oreo-cookies",
  "stock": 200,
  "subcategory_id": null,
  "unit": "120 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Pepsi",
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "cover_image": "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Chilled cola",
  "id": "f71e415e-1d1c-40df-8d9b-a35476020ac6",
  "image_gallery": [
   "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 45,
  "name": "Pepsi Bottle",
  "name_normalized": "pepsibottle",
  "price": 40,
  "rating": 4.3,
  "slug": "pepsi-bottle",
  "stock": 200,
  "subcategory_id": null,
  "unit": "750 ml",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Tropicana",
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "cover_image": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "100% orange juice",
  "id": "e472e5f3-14d3-420b-b66d-c7fc3ddb10a4",
  "image_gallery": [
   "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 135,
  "name": "Tropicana Orange",
  "name_normalized": "tropicanaorange",
  "price": 120,
  "rating": 4.5,
  "slug": "tropicana-orange",
  "stock": 100,
  "subcategory_id": null,
  "unit": "1 L",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Red Bull",
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "cover_image": "https://images.unsplash.com/photo-1613218439293-b8b30ed3fce8?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Energy drink",
  "id": "04f43037-d141-4db1-9fbd-eaaa89d62db5",
  "image_gallery": [
   "https://images.unsplash.com/photo-1613218439293-b8b30ed3fce8?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1613218439293-b8b30ed3fce8?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 125,
  "name": "Red Bull Energy",
  "name_normalized": "redbullenergy",
  "price": 125,
  "rating": 4.6,
  "slug": "redbull",
  "stock": 80,
  "subcategory_id": null,
  "unit": "250 ml",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Colgate",
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "cover_image": "https://images.unsplash.com/photo-1559591937-abc3a5fe7d1f?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Mint toothpaste",
  "id": "87be28ee-0082-4177-ba42-9d7f500e76b7",
  "image_gallery": [
   "https://images.unsplash.com/photo-1559591937-abc3a5fe7d1f?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1559591937-abc3a5fe7d1f?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 115,
  "name": "Colgate MaxFresh",
  "name_normalized": "colgatemaxfresh",
  "price": 95,
  "rating": 4.5,
  "slug": "colgate-toothpaste",
  "stock": 150,
  "subcategory_id": null,
  "unit": "150 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "H&S",
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "cover_image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Anti-dandruff shampoo",
  "id": "8f5d7800-d89d-4b59-8fba-deea2f8896f8",
  "image_gallery": [
   "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": true,
  "mrp": 350,
  "name": "Head & Shoulders Shampoo",
  "name_normalized": "headshouldersshampoo",
  "price": 285,
  "rating": 4.4,
  "slug": "head-shoulders",
  "stock": 80,
  "subcategory_id": null,
  "unit": "340 ml",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Gillette",
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "cover_image": "https://images.unsplash.com/photo-1626383137804-fbe65fab9f87?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Twin blade razor",
  "id": "fc872b54-d867-44c8-8728-540499921c05",
  "image_gallery": [
   "https://images.unsplash.com/photo-1626383137804-fbe65fab9f87?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1626383137804-fbe65fab9f87?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 90,
  "name": "Gillette Razor",
  "name_normalized": "gilletterazor",
  "price": 75,
  "rating": 4.5,
  "slug": "gillette-razor",
  "stock": 100,
  "subcategory_id": null,
  "unit": "1 pc",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "McCain",
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "cover_image": "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 12,
  "description": "Crispy frozen fries",
  "id": "11c256ef-8b66-48f4-9f09-f540b91e45f8",
  "image_gallery": [
   "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": true,
  "mrp": 160,
  "name": "McCain French Fries",
  "name_normalized": "mccainfrenchfries",
  "price": 135,
  "rating": 4.4,
  "slug": "frozen-fries",
  "stock": 60,
  "subcategory_id": null,
  "unit": "420 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Safal",
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "cover_image": "https://images.unsplash.com/photo-1535083252457-7bf12d7cfdf3?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 12,
  "description": "Farm fresh frozen peas",
  "id": "b683a7e6-b4c3-44f8-8216-8bd609e679ec",
  "image_gallery": [
   "https://images.unsplash.com/photo-1535083252457-7bf12d7cfdf3?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1535083252457-7bf12d7cfdf3?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 85,
  "name": "Frozen Green Peas",
  "name_normalized": "frozengreenpeas",
  "price": 75,
  "rating": 4.3,
  "slug": "frozen-peas",
  "stock": 90,
  "subcategory_id": null,
  "unit": "500 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Tata",
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "cover_image": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Strong assam tea",
  "id": "65bbc9bf-473b-4e22-89f3-52e1ff4bd3c1",
  "image_gallery": [
   "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 290,
  "name": "Tata Tea Premium",
  "name_normalized": "tatateapremium",
  "price": 265,
  "rating": 4.6,
  "slug": "tata-tea",
  "stock": 100,
  "subcategory_id": null,
  "unit": "500 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Nescafé",
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "cover_image": "https://images.unsplash.com/photo-1559525839-d9acfd02363a?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Instant coffee",
  "id": "55e3aa0e-aa66-4dc7-95ea-7cec79903b4e",
  "image_gallery": [
   "https://images.unsplash.com/photo-1559525839-d9acfd02363a?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1559525839-d9acfd02363a?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 210,
  "name": "Nescafé Classic",
  "name_normalized": "nescafclassic",
  "price": 195,
  "rating": 4.5,
  "slug": "nescafe-classic",
  "stock": 80,
  "subcategory_id": null,
  "unit": "50 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Lipton",
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "cover_image": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "25 tea bags",
  "id": "83de9f39-909e-4437-995e-79b972d092a9",
  "image_gallery": [
   "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 165,
  "name": "Lipton Green Tea",
  "name_normalized": "liptongreentea",
  "price": 135,
  "rating": 4.4,
  "slug": "green-tea",
  "stock": 120,
  "subcategory_id": null,
  "unit": "37.5 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Parle",
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "cover_image": "https://images.unsplash.com/photo-1612203985729-70726954388c?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Glucose biscuits",
  "id": "54dc131d-9c0a-4d40-95dd-66a1c7f33b18",
  "image_gallery": [
   "https://images.unsplash.com/photo-1612203985729-70726954388c?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1612203985729-70726954388c?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 30,
  "name": "Parle-G Biscuits",
  "name_normalized": "parlegbiscuits",
  "price": 30,
  "rating": 4.7,
  "slug": "parle-g",
  "stock": 500,
  "subcategory_id": null,
  "unit": "250 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Britannia",
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "cover_image": "https://images.unsplash.com/photo-1599599810694-57a2ca8276a8?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Light tea biscuits",
  "id": "2d0d1e4a-6865-42e1-8f59-cf8fb95f7e17",
  "image_gallery": [
   "https://images.unsplash.com/photo-1599599810694-57a2ca8276a8?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1599599810694-57a2ca8276a8?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 45,
  "name": "Britannia Marie Gold",
  "name_normalized": "britanniamariegold",
  "price": 40,
  "rating": 4.4,
  "slug": "marie-gold",
  "stock": 200,
  "subcategory_id": null,
  "unit": "250 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "FlashBake",
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "cover_image": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 12,
  "description": "Flaky french croissant",
  "id": "15636523-69fa-478c-9c5a-b316fbb77267",
  "image_gallery": [
   "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": true,
  "mrp": 55,
  "name": "Butter Croissant",
  "name_normalized": "buttercroissant",
  "price": 45,
  "rating": 4.6,
  "slug": "croissant",
  "stock": 40,
  "subcategory_id": null,
  "unit": "1 pc",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Aashirvaad",
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "cover_image": "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 15,
  "description": "Whole wheat flour",
  "id": "7f9bb6fe-8305-4afe-93d7-2a79e6b88e5d",
  "image_gallery": [
   "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 330,
  "name": "Aashirvaad Atta",
  "name_normalized": "aashirvaadatta",
  "price": 285,
  "rating": 4.7,
  "slug": "aashirvaad-atta",
  "stock": 60,
  "subcategory_id": null,
  "unit": "5 kg",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "India Gate",
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "cover_image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 15,
  "description": "Premium long-grain rice",
  "id": "72938b74-8bb6-4741-97fd-934837c7eaaa",
  "image_gallery": [
   "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 180,
  "name": "India Gate Basmati",
  "name_normalized": "indiagatebasmati",
  "price": 155,
  "rating": 4.6,
  "slug": "basmati-rice",
  "stock": 100,
  "subcategory_id": null,
  "unit": "1 kg",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Tata Sampann",
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "cover_image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 15,
  "description": "Yellow split pigeon peas",
  "id": "c7825d6a-4f0c-4245-8205-323e6e67d6f0",
  "image_gallery": [
   "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 185,
  "name": "Toor Dal",
  "name_normalized": "toordal",
  "price": 165,
  "rating": 4.4,
  "slug": "toor-dal",
  "stock": 80,
  "subcategory_id": null,
  "unit": "1 kg",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Vim",
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "cover_image": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Lemon dishwash bar",
  "id": "480bfe70-5c0a-401d-9d6e-e9a1c041bd00",
  "image_gallery": [
   "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": false,
  "mrp": 55,
  "name": "Vim Dishwash Bar",
  "name_normalized": "vimdishwashbar",
  "price": 45,
  "rating": 4.5,
  "slug": "vim-bar",
  "stock": 150,
  "subcategory_id": null,
  "unit": "300 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Surf Excel",
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "cover_image": "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 12,
  "description": "Liquid laundry detergent",
  "id": "f03a728a-473c-4eaa-aa6b-3ee4c6e3cb53",
  "image_gallery": [
   "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": true,
  "mrp": 260,
  "name": "Surf Excel Detergent",
  "name_normalized": "surfexceldetergent",
  "price": 225,
  "rating": 4.5,
  "slug": "surf-excel",
  "stock": 60,
  "subcategory_id": null,
  "unit": "1 L",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Harpic",
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "cover_image": "https://images.unsplash.com/photo-1585670337206-21ccff62e26b?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Power cleaner",
  "id": "032ef861-319e-478e-b740-ff9c670da322",
  "image_gallery": [
   "https://images.unsplash.com/photo-1585670337206-21ccff62e26b?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1585670337206-21ccff62e26b?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 175,
  "name": "Harpic Toilet Cleaner",
  "name_normalized": "harpictoiletcleaner",
  "price": 145,
  "rating": 4.4,
  "slug": "harpic",
  "stock": 70,
  "subcategory_id": null,
  "unit": "1 L",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Dove",
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "cover_image": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Moisturizing beauty bar",
  "id": "75cf1bc7-f16b-47ef-9b21-2c927ec39aa6",
  "image_gallery": [
   "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 65,
  "name": "Dove Soap Bar",
  "name_normalized": "dovesoapbar",
  "price": 55,
  "rating": 4.6,
  "slug": "dove-soap",
  "stock": 200,
  "subcategory_id": null,
  "unit": "100 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Britannia",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Soft brown bread",
  "id": "5e3e45b6-f7a7-43eb-bf4d-e95666621413",
  "image_gallery": [
   "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": true,
  "mrp": 55,
  "name": "Whole Wheat Bread",
  "name_normalized": "wholewheatbread",
  "price": 45,
  "rating": 4.3,
  "slug": "brown-bread",
  "stock": 80,
  "subcategory_id": null,
  "unit": "400 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Coca-Cola",
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "cover_image": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Refreshing cola",
  "id": "958093b1-8147-4702-9b09-02853e1b3ac6",
  "image_gallery": [
   "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 40,
  "name": "Coca-Cola Can",
  "name_normalized": "cocacolacan",
  "price": 40,
  "rating": 4.5,
  "slug": "coke-can",
  "stock": 300,
  "subcategory_id": null,
  "unit": "300 ml",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Nivea",
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "cover_image": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Moisturizing cream",
  "id": "f5a9bdaf-6df7-4b76-a567-7bd6e74c0e71",
  "image_gallery": [
   "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 225,
  "name": "Nivea Soft Cream",
  "name_normalized": "niveasoftcream",
  "price": 195,
  "rating": 4.6,
  "slug": "nivea-cream",
  "stock": 60,
  "subcategory_id": null,
  "unit": "100 ml",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Cadbury",
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "cover_image": "https://images.unsplash.com/photo-1623660053975-cf75a8be0908?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 8,
  "description": "Cadbury silk",
  "id": "a4c47cb2-637e-49a8-a63d-3a93fb8d0293",
  "image_gallery": [
   "https://images.unsplash.com/photo-1623660053975-cf75a8be0908?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1623660053975-cf75a8be0908?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 90,
  "name": "Dairy Milk Chocolate",
  "name_normalized": "dairymilkchocolate",
  "price": 85,
  "rating": 4.8,
  "slug": "chocolate-dairymilk",
  "stock": 250,
  "subcategory_id": null,
  "unit": "60 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "FlashFarm",
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "cover_image": "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Crunchy green cucumber",
  "id": "ca0f8191-cf58-4638-a369-e368ed698688",
  "image_gallery": [
   "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 30,
  "name": "Fresh Cucumber",
  "name_normalized": "freshcucumber",
  "price": 24,
  "rating": 4.3,
  "slug": "cucumber",
  "stock": 200,
  "subcategory_id": null,
  "unit": "500 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Amul",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Fresh curd",
  "id": "81bdf9ad-e06e-4abc-b99e-e1c1926d1262",
  "image_gallery": [
   "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": false,
  "mrp": 55,
  "name": "Amul Dahi",
  "name_normalized": "amuldahi",
  "price": 45,
  "rating": 4.5,
  "slug": "curd-amul",
  "stock": 120,
  "subcategory_id": null,
  "unit": "400 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Amul",
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "cover_image": "https://images.unsplash.com/photo-1632200004922-bc6602466b50?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 10,
  "description": "Processed cheese",
  "id": "fce1570e-9029-46ae-9f90-0d9c38203c7b",
  "image_gallery": [
   "https://images.unsplash.com/photo-1632200004922-bc6602466b50?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1632200004922-bc6602466b50?w=400",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": true,
  "mrp": 150,
  "name": "Amul Cheese Slices",
  "name_normalized": "amulcheeseslices",
  "price": 135,
  "rating": 4.4,
  "slug": "cheese-slices",
  "stock": 80,
  "subcategory_id": null,
  "unit": "200 g",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "FlashFarm",
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "cover_image": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "delivery_minutes": 12,
  "description": "Crisp red apples from Himachal",
  "id": "af6d5144-04ce-40dd-a0ff-9bae26e7d0b3",
  "image_gallery": [
   "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400"
  ],
  "image_url": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 229,
  "name": "Shimla Apple",
  "name_normalized": "shimlaapple",
  "price": 189,
  "rating": 4.6,
  "slug": "apple-shimla",
  "stock": 80,
  "subcategory_id": null,
  "unit": "1 kg",
  "updated_at": "2026-08-03T08:34:53.483799+00:00"
 },
 {
  "brand": "Tide ",
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b021e22b-ca30-42d2-bf04-372f28ad2984.jpeg?token=[REDACTED]",
  "created_at": "2026-08-19T06:00:02.724106+00:00",
  "delivery_minutes": 12,
  "description": "",
  "id": "3ccbfa6e-cf83-4f80-860c-3a168ac4a347",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b021e22b-ca30-42d2-bf04-372f28ad2984.jpeg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/45569c90-5ee9-458d-b1ca-22220e71d34b.jpeg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/c5f3044b-640f-4fed-8b7a-848733506a61.jpeg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/91d2fb9e-4eca-4f42-99f1-fcf1ff6a6d02.jpeg?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b021e22b-ca30-42d2-bf04-372f28ad2984.jpeg?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 88,
  "name": "Tide natural leman and chandan ",
  "name_normalized": "tidenaturallemanandchandan",
  "price": 85,
  "rating": 4.2,
  "slug": "tide-natural-leman-and-chandan-rcrkf",
  "stock": 0,
  "subcategory_id": "2f6ddf41-c135-43cc-ad92-59a7a2eed260",
  "unit": "1 pc",
  "updated_at": "2026-08-20T03:42:17.823782+00:00"
 },
 {
  "brand": "Adani ",
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/6b053d3c-8361-463a-91a6-647619d74161.jpeg?token=[REDACTED]",
  "created_at": "2026-08-19T06:12:00.268177+00:00",
  "delivery_minutes": 12,
  "description": "",
  "id": "afdeadd3-a64d-45ae-9943-055f6de21022",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/6b053d3c-8361-463a-91a6-647619d74161.jpeg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/8e704ebd-e144-4f50-bf9e-1c135cf98cdb.jpeg?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/6b053d3c-8361-463a-91a6-647619d74161.jpeg?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 885,
  "name": "Fortune refind ",
  "name_normalized": "fortunerefind",
  "price": 800,
  "rating": 4.2,
  "slug": "fortune-refind-jsyex",
  "stock": 0,
  "subcategory_id": "54c87501-ce24-4829-a1c7-3c0769e91c07",
  "unit": "1 pc",
  "updated_at": "2026-08-20T03:42:49.554361+00:00"
 },
 {
  "brand": "string",
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/d3800439-00a0-4523-b895-a60b2efb2916.png?token=[REDACTED]",
  "created_at": "2026-06-12T09:58:52.06348+00:00",
  "delivery_minutes": 12,
  "description": "nice",
  "id": "616b61f7-7893-4648-b3e9-8e557c4a7a2d",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/d3800439-00a0-4523-b895-a60b2efb2916.png?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/d3800439-00a0-4523-b895-a60b2efb2916.png?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": true,
  "is_featured": true,
  "mrp": 20,
  "name": "string",
  "name_normalized": "string",
  "price": 20,
  "rating": 4.2,
  "slug": "cock",
  "stock": 11,
  "subcategory_id": "174c9985-74fc-4e36-8147-adcc292bc362",
  "unit": "1 pc",
  "updated_at": "2026-08-06T08:43:24.613148+00:00"
 },
 {
  "brand": "",
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/490203f7-a6d9-4c82-90ff-a65a1be6cffe.jpeg?token=[REDACTED]",
  "created_at": "2026-08-19T06:19:29.121868+00:00",
  "delivery_minutes": 12,
  "description": "",
  "id": "075c6903-957d-48fb-97c5-8bca786341d1",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/490203f7-a6d9-4c82-90ff-a65a1be6cffe.jpeg?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/490203f7-a6d9-4c82-90ff-a65a1be6cffe.jpeg?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 5,
  "name": "Maggi masala ",
  "name_normalized": "maggimasala",
  "price": 5,
  "rating": 4.2,
  "slug": "maggi-masala-fyfeo",
  "stock": 0,
  "subcategory_id": "7b2253f2-e2f8-43fa-b20d-80bfc5d8a22c",
  "unit": "10gm",
  "updated_at": "2026-08-19T06:19:29.121868+00:00"
 },
 {
  "brand": "Ghadi ",
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "cover_image": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b1414508-f3a0-4b43-bbec-d34c04e85fd0.jpeg?token=[REDACTED]",
  "created_at": "2026-08-19T06:07:57.949685+00:00",
  "delivery_minutes": 12,
  "description": "",
  "id": "9c0fdac6-c340-4c25-bd91-fc57b48a08ae",
  "image_gallery": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b1414508-f3a0-4b43-bbec-d34c04e85fd0.jpeg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/3acc0433-5346-4fe5-b964-a862a9c6fbd8.jpeg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/3397012e-0568-44e1-8036-6194ab995b87.jpeg?token=[REDACTED]"
  ],
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b1414508-f3a0-4b43-bbec-d34c04e85fd0.jpeg?token=[REDACTED]",
  "is_available": true,
  "is_bestseller": false,
  "is_featured": false,
  "mrp": 74,
  "name": "Ghadi ditergent powder ",
  "name_normalized": "ghadiditergentpowder",
  "price": 70,
  "rating": 4.2,
  "slug": "ghadi-ditergent-powder-bm9p9",
  "stock": 0,
  "subcategory_id": "2f6ddf41-c135-43cc-ad92-59a7a2eed260",
  "unit": "1 pc",
  "updated_at": "2026-08-20T03:42:29.584983+00:00"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- product_variants: 15 rows
INSERT INTO public."product_variants"
SELECT * FROM jsonb_populate_recordset(NULL::public."product_variants", $EXPORT$
[
 {
  "barcode": null,
  "created_at": "2026-07-28T08:27:25.785853+00:00",
  "display_order": 0,
  "id": "3aa6db85-ba3b-446d-879a-45c3ed73d268",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/38ec8300-af6e-4514-811b-d4e31764f1ac.jpg?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": true,
  "mrp": 6,
  "name": null,
  "product_id": "fcb0ea7b-945e-4513-b160-8b2035bcfac2",
  "retail_price": 55,
  "selling_price": 68,
  "size": "500",
  "sku": null,
  "stock": 888,
  "unit": "Pcs",
  "updated_at": "2026-07-28T08:27:25.785853+00:00",
  "weight": "5kg"
 },
 {
  "barcode": null,
  "created_at": "2026-07-28T08:27:25.785853+00:00",
  "display_order": 1,
  "id": "b2874d4b-502c-4f6d-9ba4-03e3f4dd72d7",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/99cb67db-b229-43fc-82e6-52fd596c7f8a.jpg?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": false,
  "mrp": 6666966,
  "name": null,
  "product_id": "fcb0ea7b-945e-4513-b160-8b2035bcfac2",
  "retail_price": 98866,
  "selling_price": 6888,
  "size": "400",
  "sku": null,
  "stock": 9996,
  "unit": "Pcs",
  "updated_at": "2026-07-28T08:27:25.785853+00:00",
  "weight": "5kg"
 },
 {
  "barcode": null,
  "created_at": "2026-07-23T13:33:04.950868+00:00",
  "display_order": 0,
  "id": "42c4cf74-a890-4ced-b48d-240bfe274723",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/7f3c6e13-52d2-461d-957c-65382e5f6ef8.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": true,
  "mrp": 78,
  "name": null,
  "product_id": "217e6c08-8101-4a77-a917-7fa00b1a63c9",
  "retail_price": 56,
  "selling_price": 51,
  "size": "200",
  "sku": null,
  "stock": 29,
  "unit": "ml",
  "updated_at": "2026-08-03T08:40:09.564042+00:00",
  "weight": null
 },
 {
  "barcode": null,
  "created_at": "2026-07-17T11:02:39.601154+00:00",
  "display_order": 0,
  "id": "9f5b469e-9a98-463c-b1db-ba287da810cc",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/92136c89-9d3b-4c41-969f-d1eb4c9ae9e5.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": true,
  "mrp": 25,
  "name": null,
  "product_id": "6caf792e-af86-47dc-ab86-968d5f34e05a",
  "retail_price": 15,
  "selling_price": 20,
  "size": "50",
  "sku": null,
  "stock": 36,
  "unit": "ml",
  "updated_at": "2026-08-20T03:20:06.333715+00:00",
  "weight": "50 g"
 },
 {
  "barcode": null,
  "created_at": "2026-07-17T11:02:39.601154+00:00",
  "display_order": 1,
  "id": "4cbe86ab-7896-4731-a47b-b5626cef5ba8",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/2de37d46-e336-4379-bc94-69926d4095c1.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": false,
  "mrp": 40,
  "name": null,
  "product_id": "6caf792e-af86-47dc-ab86-968d5f34e05a",
  "retail_price": 25,
  "selling_price": 30,
  "size": "100",
  "sku": null,
  "stock": 14,
  "unit": "ml",
  "updated_at": "2026-08-20T03:20:06.333715+00:00",
  "weight": "100g"
 },
 {
  "barcode": null,
  "created_at": "2026-07-24T19:40:44.906485+00:00",
  "display_order": 0,
  "id": "da00fac2-bd25-4cfe-b36d-299ac1fc9555",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/15b8f2c0-dfec-4a0b-a80c-198072b25bae.jpeg?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": true,
  "mrp": 235,
  "name": "Namaste india ghee cartun pack ",
  "product_id": "66b9ede6-c189-4873-80da-1dfc05df6140",
  "retail_price": 230,
  "selling_price": 250,
  "size": "500ml",
  "sku": null,
  "stock": 10,
  "unit": "1 pack ",
  "updated_at": "2026-08-20T03:40:40.540027+00:00",
  "weight": "350gm"
 },
 {
  "barcode": "2",
  "created_at": "2026-07-24T12:46:28.987204+00:00",
  "display_order": 0,
  "id": "93359c98-6ab8-4fbb-b20b-72443d980547",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/1ec78ad1-bcbb-4616-9151-7029d1375158.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": true,
  "mrp": 43,
  "name": null,
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603",
  "retail_price": 14,
  "selling_price": 32,
  "size": "200",
  "sku": "2",
  "stock": 35,
  "unit": "pc",
  "updated_at": "2026-08-20T03:41:27.034223+00:00",
  "weight": "200"
 },
 {
  "barcode": null,
  "created_at": "2026-07-28T08:27:25.785853+00:00",
  "display_order": 2,
  "id": "c6ad95d6-5952-428c-9798-75a310d110a2",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/494f9c91-c8b9-4bb4-810f-e14a43883516.jpg?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": false,
  "mrp": 66666666385,
  "name": null,
  "product_id": "fcb0ea7b-945e-4513-b160-8b2035bcfac2",
  "retail_price": 6658856,
  "selling_price": 9666856,
  "size": "600",
  "sku": null,
  "stock": 966,
  "unit": "Pcs",
  "updated_at": "2026-07-28T08:27:25.785853+00:00",
  "weight": "6kg"
 },
 {
  "barcode": null,
  "created_at": "2026-07-23T13:33:04.950868+00:00",
  "display_order": 1,
  "id": "2ffb8ca9-ddff-41f8-a530-e4c97dcdb246",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/a09b8f4e-cc8a-4b21-9943-924c009182ab.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": false,
  "mrp": 69,
  "name": null,
  "product_id": "217e6c08-8101-4a77-a917-7fa00b1a63c9",
  "retail_price": 43,
  "selling_price": 56,
  "size": "100",
  "sku": null,
  "stock": 25,
  "unit": "ml",
  "updated_at": "2026-08-03T08:40:09.564042+00:00",
  "weight": null
 },
 {
  "barcode": null,
  "created_at": "2026-07-23T13:42:56.562847+00:00",
  "display_order": 2,
  "id": "9f1a4140-43fc-4867-92f1-028cfd2ad21d",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/c4bacce1-6f64-4ff4-b780-a4d295e1d198.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": false,
  "mrp": 28,
  "name": "m",
  "product_id": "217e6c08-8101-4a77-a917-7fa00b1a63c9",
  "retail_price": 26,
  "selling_price": 20,
  "size": "10",
  "sku": null,
  "stock": 22,
  "unit": "ml",
  "updated_at": "2026-08-03T08:40:09.564042+00:00",
  "weight": null
 },
 {
  "barcode": null,
  "created_at": "2026-08-03T22:14:10.952344+00:00",
  "display_order": 0,
  "id": "8adc4124-223d-4d80-844a-507b37cd6080",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/477d9c49-1d73-4a31-9662-175b20bc82d3.png?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/a33eaefa-264c-44fb-b122-046429b96414.png?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/459fe2de-428c-44b4-b62c-90f96a9813b4.jpg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/8bf18285-d129-4066-b484-5f5c919e9b1a.jpg?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": true,
  "mrp": 0,
  "name": null,
  "product_id": "1e838830-5343-43cb-a56a-3784939ab3a3",
  "retail_price": 0,
  "selling_price": 180,
  "size": "50gm",
  "sku": null,
  "stock": 5,
  "unit": "1",
  "updated_at": "2026-08-03T22:14:10.952344+00:00",
  "weight": null
 },
 {
  "barcode": null,
  "created_at": "2026-07-29T01:06:47.297934+00:00",
  "display_order": 1,
  "id": "1f505676-daa7-42dd-82f2-0d8b43efadf3",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/dfb24a9a-c6c4-4a46-b2f1-e28da7e8e198.jpeg?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": false,
  "mrp": 650,
  "name": null,
  "product_id": "66b9ede6-c189-4873-80da-1dfc05df6140",
  "retail_price": 630,
  "selling_price": 635,
  "size": "1L",
  "sku": null,
  "stock": 10,
  "unit": "1 pack ",
  "updated_at": "2026-08-20T03:40:40.540027+00:00",
  "weight": "750gm"
 },
 {
  "barcode": null,
  "created_at": "2026-07-24T12:56:41.689696+00:00",
  "display_order": 1,
  "id": "81adda50-a486-43b1-ad62-6bc058c37cb1",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b2dd3e1c-4b80-4fb4-8b67-a77f71de0673.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": false,
  "mrp": 53,
  "name": null,
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603",
  "retail_price": 35,
  "selling_price": 31,
  "size": "200",
  "sku": null,
  "stock": 38,
  "unit": "pcs",
  "updated_at": "2026-08-20T03:41:27.034223+00:00",
  "weight": "200"
 },
 {
  "barcode": null,
  "created_at": "2026-08-03T22:14:10.952344+00:00",
  "display_order": 1,
  "id": "0a16d492-4f66-4cfc-a60c-7bcab9a97741",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/16b7352e-9614-4303-ad8c-70fa1c4ea97e.png?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/8356a7d6-aeef-4404-bd87-a583107e59d7.jpg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/cf1b24e8-3274-44eb-9f2d-894eeadd6387.jpg?token=[REDACTED]",
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/272fe518-4ef6-454e-957a-1e5c126b1c81.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": false,
  "mrp": 0,
  "name": null,
  "product_id": "1e838830-5343-43cb-a56a-3784939ab3a3",
  "retail_price": 0,
  "selling_price": 20,
  "size": "10gm",
  "sku": null,
  "stock": 5,
  "unit": "1",
  "updated_at": "2026-08-03T22:14:10.952344+00:00",
  "weight": null
 },
 {
  "barcode": null,
  "created_at": "2026-07-24T12:56:41.689696+00:00",
  "display_order": 0,
  "id": "6aa719f3-2a16-46a3-bdf3-a3e35e42dc5c",
  "images": [
   "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/products/b4f46a57-db44-4690-88f9-54b2e052e192.png?token=[REDACTED]"
  ],
  "is_available": true,
  "is_default": true,
  "mrp": 17,
  "name": null,
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603",
  "retail_price": 37,
  "selling_price": 29,
  "size": "100",
  "sku": null,
  "stock": 35,
  "unit": "pcs",
  "updated_at": "2026-08-20T03:41:27.034223+00:00",
  "weight": "100"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- product_categories: 64 rows
INSERT INTO public."product_categories"
SELECT * FROM jsonb_populate_recordset(NULL::public."product_categories", $EXPORT$
[
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "f717e3ff-0648-42cd-a2d7-4d6f2ffd286a",
  "product_id": "a158ed41-d448-4f33-bf17-a4c3d843ebce"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "99ad9a63-5676-498a-be5e-481dfcecc990",
  "product_id": "6caf792e-af86-47dc-ab86-968d5f34e05a"
 },
 {
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "f98d4353-2289-4a18-923c-66e8b1339b4c",
  "product_id": "217e6c08-8101-4a77-a917-7fa00b1a63c9"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "5de51440-fd8b-4a8d-9333-ab43144ab14c",
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603"
 },
 {
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "64e0de94-93bf-499c-9dad-c4a627fa4d78",
  "product_id": "66b9ede6-c189-4873-80da-1dfc05df6140"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "4b7c3104-d13a-42f4-b5ca-5210fc5e5f41",
  "product_id": "33c7479d-d171-43fc-8293-6b0627c658a3"
 },
 {
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "012e105e-98de-423c-a9bc-a436476f1218",
  "product_id": "8aa16eb3-46ca-4f3c-8bb7-26ef375ad601"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "58d96ca4-23bc-4aca-9617-9be45a2bd875",
  "product_id": "fcb0ea7b-945e-4513-b160-8b2035bcfac2"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "cdac259f-f3ad-4de1-98a5-e43da0a14301",
  "product_id": "76ebd853-9544-4a5a-87e1-f9dc6dfbe955"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "6d8d76c3-93b9-42e0-98b6-dbeece9fb0c2",
  "product_id": "27b5ab8c-1c86-4c14-b6f5-7eb843031b71"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "4ce9c0f9-6644-4da0-8930-8cd33026420a",
  "product_id": "5ef9708e-c84d-4a80-927e-c52ee592c675"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "6e4c3d72-e6f1-4abb-a553-136f3845fef6",
  "product_id": "ec4fb524-0fe5-452e-a782-933a1f6e6401"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "6ac28446-46bc-44ca-a047-0c3fb4db29ec",
  "product_id": "9141d7b6-d328-403c-a2d7-946934eca930"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "f377b6d3-c092-4d34-bf70-bc0c6b2b508b",
  "product_id": "aa602e24-cecc-4caa-8ff8-20a410178011"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "333ed645-e8b2-4cd7-82cf-b96074186e04",
  "product_id": "db729496-1676-4f8d-b5ba-1fdb49f05c10"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "45173a78-865d-4b4a-8a52-7a1ce4a2bf3b",
  "product_id": "66a93437-9748-4d42-ac3b-4a076aa0c2ce"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "4d6496bf-def1-4888-983f-35730ab33a59",
  "product_id": "193220e1-0bc1-4999-a7df-48c9be7f50f4"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "491eafd5-76d0-400c-bf8e-b1fc4324b697",
  "product_id": "a264675e-90cc-4c72-91ab-406157a07f41"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "7a48bf64-4e9e-4591-94f3-f5eed23ed8df",
  "product_id": "ecac5bdb-b9cd-4b7d-8f8d-082dcab152c7"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "c3f19704-f5d1-4692-804b-47aed8e31b92",
  "product_id": "82adfd19-c90f-42ca-bcf0-27ae05af317b"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "66bbafd7-0766-4173-9434-3bcd93d1ee75",
  "product_id": "f71e415e-1d1c-40df-8d9b-a35476020ac6"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "64b14925-448f-4bc0-bf5f-8eee5ba23107",
  "product_id": "e472e5f3-14d3-420b-b66d-c7fc3ddb10a4"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "d0b6559c-66b0-4e60-9159-09eea55728c8",
  "product_id": "04f43037-d141-4db1-9fbd-eaaa89d62db5"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "8ffe54f5-ade7-4a04-81c0-6b01c73d50fc",
  "product_id": "87be28ee-0082-4177-ba42-9d7f500e76b7"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "c2458887-7a59-46e3-8749-ca5395ddd558",
  "product_id": "8f5d7800-d89d-4b59-8fba-deea2f8896f8"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "0cf04fb2-298a-4d5a-8784-4311bee73d0d",
  "product_id": "fc872b54-d867-44c8-8728-540499921c05"
 },
 {
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "9b389522-4b62-40e7-9f48-ab353ef02843",
  "product_id": "11c256ef-8b66-48f4-9f09-f540b91e45f8"
 },
 {
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "1f5ddb47-c99b-4a9e-b4e5-ea3f57975d50",
  "product_id": "b683a7e6-b4c3-44f8-8216-8bd609e679ec"
 },
 {
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "608a617f-dd70-4ef3-90eb-51372831eec1",
  "product_id": "65bbc9bf-473b-4e22-89f3-52e1ff4bd3c1"
 },
 {
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "8ba96f0c-cf0d-490f-914a-4dca344bfd25",
  "product_id": "55e3aa0e-aa66-4dc7-95ea-7cec79903b4e"
 },
 {
  "category_id": "c19e1d75-bac0-4ed5-9806-8d7579ff77c4",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "e2754b93-7caa-43c6-bbf5-7e2904ce316e",
  "product_id": "83de9f39-909e-4437-995e-79b972d092a9"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "fc27e9bc-a1b7-4a9d-9528-b59c97c3cb22",
  "product_id": "54dc131d-9c0a-4d40-95dd-66a1c7f33b18"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "004581ff-41c0-4fe1-b921-82b487b8001f",
  "product_id": "2d0d1e4a-6865-42e1-8f59-cf8fb95f7e17"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "0dc732b2-3b02-4dc5-8a4a-85197826b359",
  "product_id": "15636523-69fa-478c-9c5a-b316fbb77267"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "ab74cad1-7a3d-477e-b0dc-6040f8d45f24",
  "product_id": "7f9bb6fe-8305-4afe-93d7-2a79e6b88e5d"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "bc7ffd55-4dcf-405b-a4b0-0974e985a647",
  "product_id": "72938b74-8bb6-4741-97fd-934837c7eaaa"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "32946988-9541-42ba-aff7-71bcc23eab6b",
  "product_id": "c7825d6a-4f0c-4245-8205-323e6e67d6f0"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "890b1bda-720c-4151-81f2-b62ea1cb9dbd",
  "product_id": "480bfe70-5c0a-401d-9d6e-e9a1c041bd00"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "7ca7cbbf-ae9a-4473-bdda-44b1af0f1ae6",
  "product_id": "f03a728a-473c-4eaa-aa6b-3ee4c6e3cb53"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "96fca2af-c52f-4742-a8b1-ddbcb8681990",
  "product_id": "032ef861-319e-478e-b740-ff9c670da322"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "aa587778-d079-4d01-a7cd-d4a1a594ca49",
  "product_id": "75cf1bc7-f16b-47ef-9b21-2c927ec39aa6"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "dbccb475-0dfd-42a3-a347-8f16e47ad9f3",
  "product_id": "5e3e45b6-f7a7-43eb-bf4d-e95666621413"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "69962d0c-4eb9-4920-b98f-107fe9a0e30a",
  "product_id": "958093b1-8147-4702-9b09-02853e1b3ac6"
 },
 {
  "category_id": "05622072-178b-41f1-a18d-1e5671ea196e",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "03398103-b745-462b-84bb-1ceca6e8e765",
  "product_id": "f5a9bdaf-6df7-4b76-a567-7bd6e74c0e71"
 },
 {
  "category_id": "c48834f0-16e3-4085-92a3-c2e7f1bc3975",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "9e1f39ab-7b95-4da2-a346-2a4b057dba03",
  "product_id": "a4c47cb2-637e-49a8-a63d-3a93fb8d0293"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "2e551cc4-107c-4b08-becf-1ff7d461eb14",
  "product_id": "ca0f8191-cf58-4638-a369-e368ed698688"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "551bf25c-8cab-47e0-93be-56ff419e939c",
  "product_id": "81bdf9ad-e06e-4abc-b99e-e1c1926d1262"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "284af0f0-b626-4bbc-a30d-02ad540a2960",
  "product_id": "fce1570e-9029-46ae-9f90-0d9c38203c7b"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "e9088385-a74a-424c-aa40-b2fd0ecc4628",
  "product_id": "af6d5144-04ce-40dd-a0ff-9bae26e7d0b3"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-03T08:20:37.915855+00:00",
  "id": "52e367ba-11db-49a2-a622-1031af0647e3",
  "product_id": "616b61f7-7893-4648-b3e9-8e557c4a7a2d"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-03T16:07:17.792357+00:00",
  "id": "9d118fad-a135-4497-a1e8-071ef0eb8647",
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-03T16:07:17.792357+00:00",
  "id": "f8ccf02e-374f-4688-8d50-564d74216e1d",
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603"
 },
 {
  "category_id": "8435f5e6-48f6-426e-97c9-e134a704e148",
  "created_at": "2026-08-03T16:07:17.792357+00:00",
  "id": "0f9aea24-3cb6-4e13-b299-2370b3c86d95",
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603"
 },
 {
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "created_at": "2026-08-03T16:07:17.792357+00:00",
  "id": "82e66b0b-0070-44f3-9e78-91ebe3cd9cf4",
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603"
 },
 {
  "category_id": "23b4527e-d152-42da-a7df-8bf36aa6f309",
  "created_at": "2026-08-03T22:14:09.798703+00:00",
  "id": "c853a938-e69d-4266-9b93-6562f1de2059",
  "product_id": "1e838830-5343-43cb-a56a-3784939ab3a3"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-03T22:14:09.798703+00:00",
  "id": "8e854a1d-cc07-4f85-9d6c-85f4c2ed0563",
  "product_id": "1e838830-5343-43cb-a56a-3784939ab3a3"
 },
 {
  "category_id": "05ef654a-7ec1-4200-a111-fdf7b1e54d94",
  "created_at": "2026-08-03T22:14:09.798703+00:00",
  "id": "4a7ebcca-1128-4ae8-b486-5fc4dee2efa1",
  "product_id": "1e838830-5343-43cb-a56a-3784939ab3a3"
 },
 {
  "category_id": "84ba0a0e-7089-4467-9ae8-d9da8d46d46a",
  "created_at": "2026-08-03T22:14:09.798703+00:00",
  "id": "a37b00b9-68f5-49f0-b791-28ad069894bd",
  "product_id": "1e838830-5343-43cb-a56a-3784939ab3a3"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-19T06:00:03.61805+00:00",
  "id": "afef8e82-eb0b-4b75-a29c-0eb40455f730",
  "product_id": "3ccbfa6e-cf83-4f80-860c-3a168ac4a347"
 },
 {
  "category_id": "ef9cffa4-e07b-4107-b09f-a2d3053c6549",
  "created_at": "2026-08-19T06:07:58.731528+00:00",
  "id": "16759073-f2dd-49df-b9b4-8e1619c17686",
  "product_id": "9c0fdac6-c340-4c25-bd91-fc57b48a08ae"
 },
 {
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "created_at": "2026-08-19T06:12:01.316547+00:00",
  "id": "40cd36a0-beb8-4c7e-93cd-d9967b50d224",
  "product_id": "afdeadd3-a64d-45ae-9943-055f6de21022"
 },
 {
  "category_id": "aca6134b-e84d-46a0-b455-89c8fc18eb42",
  "created_at": "2026-08-19T06:16:26.600992+00:00",
  "id": "b795c33d-f9a9-4c92-bfd6-df50abb7ebf2",
  "product_id": "9edb5ff1-4f89-4a8b-aa41-a33a77a1b9c7"
 },
 {
  "category_id": "caceb266-3b00-4679-8cb2-20ff764d0c62",
  "created_at": "2026-08-19T06:19:29.86269+00:00",
  "id": "1d38d123-6f53-4b62-8d99-e305b59ed2c4",
  "product_id": "075c6903-957d-48fb-97c5-8bca786341d1"
 },
 {
  "category_id": "9ebb6df0-dfab-46ab-9a47-2c7ebc2e228c",
  "created_at": "2026-08-24T16:46:13.821044+00:00",
  "id": "47cfcdf6-09fe-4553-bb23-7c36296b83ac",
  "product_id": "2f25c65e-7da7-44b1-b6f6-b81a9712551e"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- product_subcategories: 12 rows
INSERT INTO public."product_subcategories"
SELECT * FROM jsonb_populate_recordset(NULL::public."product_subcategories", $EXPORT$
[
 {
  "created_at": "2026-08-06T08:43:25.795669+00:00",
  "product_id": "616b61f7-7893-4648-b3e9-8e557c4a7a2d",
  "subcategory_id": "174c9985-74fc-4e36-8147-adcc292bc362"
 },
 {
  "created_at": "2026-08-06T08:43:25.795669+00:00",
  "product_id": "616b61f7-7893-4648-b3e9-8e557c4a7a2d",
  "subcategory_id": "951ffb59-0a61-4334-a9cd-eb1569bf0933"
 },
 {
  "created_at": "2026-08-06T08:43:25.795669+00:00",
  "product_id": "616b61f7-7893-4648-b3e9-8e557c4a7a2d",
  "subcategory_id": "ef0a4518-c4dc-475a-8dd3-d9b6a6f385e4"
 },
 {
  "created_at": "2026-08-16T08:08:30.002673+00:00",
  "product_id": "66b9ede6-c189-4873-80da-1dfc05df6140",
  "subcategory_id": "fbec38cc-ad48-4d2d-aa7a-47636bd619c4"
 },
 {
  "created_at": "2026-08-19T06:00:04.41749+00:00",
  "product_id": "3ccbfa6e-cf83-4f80-860c-3a168ac4a347",
  "subcategory_id": "2f6ddf41-c135-43cc-ad92-59a7a2eed260"
 },
 {
  "created_at": "2026-08-19T06:07:59.602311+00:00",
  "product_id": "9c0fdac6-c340-4c25-bd91-fc57b48a08ae",
  "subcategory_id": "2f6ddf41-c135-43cc-ad92-59a7a2eed260"
 },
 {
  "created_at": "2026-08-19T06:12:02.581573+00:00",
  "product_id": "afdeadd3-a64d-45ae-9943-055f6de21022",
  "subcategory_id": "54c87501-ce24-4829-a1c7-3c0769e91c07"
 },
 {
  "created_at": "2026-08-19T06:16:27.239814+00:00",
  "product_id": "9edb5ff1-4f89-4a8b-aa41-a33a77a1b9c7",
  "subcategory_id": "54c87501-ce24-4829-a1c7-3c0769e91c07"
 },
 {
  "created_at": "2026-08-19T06:19:30.534149+00:00",
  "product_id": "075c6903-957d-48fb-97c5-8bca786341d1",
  "subcategory_id": "7b2253f2-e2f8-43fa-b20d-80bfc5d8a22c"
 },
 {
  "created_at": "2026-08-20T03:20:05.846563+00:00",
  "product_id": "6caf792e-af86-47dc-ab86-968d5f34e05a",
  "subcategory_id": "2eea9c14-d0bd-43f6-b025-3786d5ac3dac"
 },
 {
  "created_at": "2026-08-20T03:41:26.511772+00:00",
  "product_id": "bc3a106f-5138-4a95-9797-0fbaa01f7603",
  "subcategory_id": "acdfa082-9f7c-4aa3-9026-d4a0dd896478"
 },
 {
  "created_at": "2026-08-20T03:41:56.040844+00:00",
  "product_id": "76ebd853-9544-4a5a-87e1-f9dc6dfbe955",
  "subcategory_id": "01044f64-0e19-4d13-88df-fd92355c4e8f"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- collections: 0 rows (skipped)
-- product_collections: 0 rows (skipped)
-- coupons: 3 rows
INSERT INTO public."coupons"
SELECT * FROM jsonb_populate_recordset(NULL::public."coupons", $EXPORT$
[
 {
  "active": true,
  "code": "SAVE10",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "description": "10% off up to ₹100",
  "expires_at": null,
  "id": "83c6ee6c-e06c-4892-8069-8c636a09203d",
  "max_discount": 100,
  "min_order": 199,
  "times_used": 0,
  "type": "percent",
  "usage_limit": null,
  "value": 10
 },
 {
  "active": true,
  "code": "WELCOME",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "description": "15% off your first order",
  "expires_at": null,
  "id": "53761f78-4db5-4e14-b197-b4fabe593f5c",
  "max_discount": 150,
  "min_order": 99,
  "times_used": 0,
  "type": "percent",
  "usage_limit": null,
  "value": 15
 },
 {
  "active": true,
  "code": "FLASH50",
  "created_at": "2026-05-27T18:27:35.695329+00:00",
  "description": "Flat ₹50 off on orders above ₹50",
  "expires_at": "2026-07-30T00:25:00+00:00",
  "id": "45610eb0-ac69-4b28-b2e4-04c1e75398d7",
  "max_discount": 50,
  "min_order": 500,
  "times_used": 0,
  "type": "percent",
  "usage_limit": null,
  "value": 10
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- offers: 6 rows
INSERT INTO public."offers"
SELECT * FROM jsonb_populate_recordset(NULL::public."offers", $EXPORT$
[
 {
  "badge": null,
  "created_at": "2026-06-04T14:27:42.919843+00:00",
  "created_by": null,
  "display_order": 1,
  "ends_at": null,
  "id": "039eeb3a-58c0-4526-900a-54d6fd8ea6a3",
  "image_url": "https://cdn.lovable.dev/projects/10138c73-9a20-4df9-9ef9-cb7c5e7e2934/assets/banner1.jpg",
  "is_active": true,
  "link_url": "/category/fruits-vegetables",
  "scope": "global",
  "shop_id": null,
  "starts_at": null,
  "subtitle": "Limited time deal",
  "title": "50% off fresh fruits",
  "updated_at": "2026-06-04T14:27:42.919843+00:00"
 },
 {
  "badge": null,
  "created_at": "2026-06-04T14:27:42.919843+00:00",
  "created_by": null,
  "display_order": 2,
  "ends_at": null,
  "id": "4a72c8c4-0222-4c64-8200-3c044cd65e08",
  "image_url": "https://cdn.lovable.dev/projects/10138c73-9a20-4df9-9ef9-cb7c5e7e2934/assets/banner2.jpg",
  "is_active": true,
  "link_url": "/",
  "scope": "global",
  "shop_id": null,
  "starts_at": null,
  "subtitle": "On orders above ₹199",
  "title": "Free delivery",
  "updated_at": "2026-06-04T14:27:42.919843+00:00"
 },
 {
  "badge": null,
  "created_at": "2026-06-04T14:27:42.919843+00:00",
  "created_by": null,
  "display_order": 3,
  "ends_at": null,
  "id": "961fc850-4bc6-41e6-9962-37f8f5273613",
  "image_url": "https://cdn.lovable.dev/projects/10138c73-9a20-4df9-9ef9-cb7c5e7e2934/assets/banner3.jpg",
  "is_active": true,
  "link_url": "/category/dairy",
  "scope": "global",
  "shop_id": null,
  "starts_at": null,
  "subtitle": "Today only",
  "title": "Buy 1 Get 1 on dairy",
  "updated_at": "2026-06-04T14:27:42.919843+00:00"
 },
 {
  "badge": null,
  "created_at": "2026-06-04T14:27:42.919843+00:00",
  "created_by": null,
  "display_order": 4,
  "ends_at": null,
  "id": "532b9c6e-57ae-4201-9a38-7fcbb623d02d",
  "image_url": "https://cdn.lovable.dev/projects/10138c73-9a20-4df9-9ef9-cb7c5e7e2934/assets/banner4.jpg",
  "is_active": true,
  "link_url": "/",
  "scope": "global",
  "shop_id": null,
  "starts_at": null,
  "subtitle": "All categories",
  "title": "Weekend sale up to 70% off",
  "updated_at": "2026-06-04T14:27:42.919843+00:00"
 },
 {
  "badge": "234",
  "created_at": "2026-07-21T10:16:35.824094+00:00",
  "created_by": null,
  "display_order": 30,
  "ends_at": null,
  "id": "1d471c15-6c73-4c46-8873-aa89b08d6837",
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/offers/e2e3690c-4232-407b-9c2f-1442b49f8a22.jpeg?token=[REDACTED]",
  "is_active": true,
  "link_url": "Namaste india ghee ",
  "scope": "shop",
  "shop_id": "33333333-3333-3333-3333-333333333333",
  "starts_at": null,
  "subtitle": "Happy diwali 🎇🪔🪔",
  "title": "Diwali offer ",
  "updated_at": "2026-07-21T10:16:35.824094+00:00"
 },
 {
  "badge": "50",
  "created_at": "2026-07-29T00:22:33.899787+00:00",
  "created_by": null,
  "display_order": 100,
  "ends_at": null,
  "id": "ac8e0ab2-1e4f-4b41-bca2-93cf1689b4ea",
  "image_url": "https://mthwplppwnsoyjvdrsdu.supabase.co/storage/v1/object/sign/offers/a66e1f5b-5171-4b3c-81a9-11e106597e3e.png?token=[REDACTED]",
  "is_active": true,
  "link_url": "Food oil ",
  "scope": "shop",
  "shop_id": "33333333-3333-3333-3333-333333333333",
  "starts_at": null,
  "subtitle": "Happy holi ",
  "title": "Holi offer ",
  "updated_at": "2026-07-29T00:22:33.899787+00:00"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- delivery_zone_settings: 2 rows
INSERT INTO public."delivery_zone_settings"
SELECT * FROM jsonb_populate_recordset(NULL::public."delivery_zone_settings", $EXPORT$
[
 {
  "city": "Kanpur ",
  "created_at": "2026-07-24T19:49:27.200183+00:00",
  "default_handling_fee": 2,
  "delivery_radius_km": 3,
  "express_enabled": true,
  "express_eta_minutes": "10-15",
  "express_fee": 99,
  "express_handling_fee": null,
  "fast_enabled": true,
  "fast_eta_minutes": "20-30",
  "fast_fee": 50,
  "fast_handling_fee": null,
  "free_handling_above": null,
  "handling_enabled": true,
  "handling_percentage": 0,
  "handling_type": "fixed",
  "id": "da68c6cc-09db-4e63-af0e-1c8ccbcc54fc",
  "is_active": true,
  "minimum_order_express": null,
  "minimum_order_fast": null,
  "minimum_order_standard": 100,
  "pin_code": "208020",
  "standard_enabled": true,
  "standard_eta_minutes": "Within 12 hours ",
  "standard_fee": 0,
  "standard_handling_fee": 2,
  "state": "Uttar Pradesh ",
  "updated_at": "2026-07-29T00:11:44.95319+00:00"
 },
 {
  "city": "Pathankot",
  "created_at": "2026-07-24T12:09:51.843671+00:00",
  "default_handling_fee": 2,
  "delivery_radius_km": 5,
  "express_enabled": true,
  "express_eta_minutes": "10-15 min",
  "express_fee": 99,
  "express_handling_fee": null,
  "fast_enabled": true,
  "fast_eta_minutes": "1 hour ",
  "fast_fee": 50,
  "fast_handling_fee": null,
  "free_handling_above": 2,
  "handling_enabled": true,
  "handling_percentage": 0,
  "handling_type": "fixed",
  "id": "12e6dc43-d5f5-400a-968b-3bbf155330d1",
  "is_active": true,
  "minimum_order_express": null,
  "minimum_order_fast": null,
  "minimum_order_standard": 100,
  "pin_code": "145001",
  "standard_enabled": true,
  "standard_eta_minutes": "Within 12 hours ",
  "standard_fee": 10,
  "standard_handling_fee": 2,
  "state": "Punjab",
  "updated_at": "2026-07-29T00:14:35.434246+00:00"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;

-- app_config: 2 rows
INSERT INTO public."app_config"
SELECT * FROM jsonb_populate_recordset(NULL::public."app_config", $EXPORT$
[
 {
  "key": "onesignal_app_id",
  "updated_at": "2026-05-31T14:39:18.992674+00:00",
  "value": "0179c4bc-1662-45b2-8be2-0826d8f3dc2b"
 },
 {
  "key": "enable_customer_shop_selection",
  "updated_at": "2026-07-17T10:26:08.293383+00:00",
  "value": "true"
 }
]
$EXPORT$::jsonb)
ON CONFLICT DO NOTHING;
