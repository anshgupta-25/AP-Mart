
-- Seed categories
INSERT INTO public.categories (slug, name, icon, color, display_order) VALUES
('fruits-vegetables','Fruits & Vegetables','🥬','#A3E635',1),
('dairy-bread-eggs','Dairy, Bread & Eggs','🥛','#FDE68A',2),
('snacks-munchies','Snacks & Munchies','🍿','#FCA5A5',3),
('cold-drinks-juices','Cold Drinks & Juices','🥤','#7DD3FC',4),
('instant-frozen','Instant & Frozen Food','🍜','#FDBA74',5),
('tea-coffee','Tea, Coffee & Drinks','☕','#D6BC8A',6),
('bakery-biscuits','Bakery & Biscuits','🍞','#FBCFE8',7),
('atta-rice-dal','Atta, Rice & Dal','🌾','#FEF08A',8),
('cleaning-essentials','Cleaning Essentials','🧴','#A7F3D0',9),
('personal-care','Personal Care','🧼','#C4B5FD',10)
ON CONFLICT (slug) DO NOTHING;

-- Seed products
WITH c AS (SELECT id, slug FROM public.categories)
INSERT INTO public.products (slug,name,description,unit,price,mrp,image_url,category_id,stock,delivery_minutes,is_bestseller,is_featured,brand,rating) VALUES
('banana-robusta','Banana Robusta','Fresh farm bananas, naturally ripened','1 dozen',59,79,'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',(SELECT id FROM c WHERE slug='fruits-vegetables'),120,10,true,true,'FlashFarm',4.5),
('apple-shimla','Shimla Apple','Crisp red apples from Himachal','1 kg',189,229,'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400',(SELECT id FROM c WHERE slug='fruits-vegetables'),80,12,true,true,'FlashFarm',4.6),
('tomato-hybrid','Hybrid Tomato','Juicy red tomatoes','500 g',24,35,'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=400',(SELECT id FROM c WHERE slug='fruits-vegetables'),200,10,false,false,'FlashFarm',4.3),
('onion','Onion','Premium quality onions','1 kg',39,49,'https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=400',(SELECT id FROM c WHERE slug='fruits-vegetables'),150,10,true,false,'FlashFarm',4.4),
('potato','Potato','Fresh potatoes','1 kg',32,45,'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400',(SELECT id FROM c WHERE slug='fruits-vegetables'),180,10,false,false,'FlashFarm',4.4),
('milk-amul','Amul Toned Milk','Fresh toned milk','500 ml',28,30,'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400',(SELECT id FROM c WHERE slug='dairy-bread-eggs'),200,8,true,true,'Amul',4.7),
('eggs-white','White Eggs','Farm fresh eggs','6 pcs',64,75,'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400',(SELECT id FROM c WHERE slug='dairy-bread-eggs'),100,10,true,true,'Eggoz',4.5),
('brown-bread','Whole Wheat Bread','Soft brown bread','400 g',45,55,'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400',(SELECT id FROM c WHERE slug='dairy-bread-eggs'),80,10,false,true,'Britannia',4.3),
('butter-amul','Amul Butter','Salted butter','100 g',58,60,'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400',(SELECT id FROM c WHERE slug='dairy-bread-eggs'),90,10,true,false,'Amul',4.8),
('paneer','Fresh Paneer','Soft paneer cubes','200 g',95,110,'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400',(SELECT id FROM c WHERE slug='dairy-bread-eggs'),60,12,false,true,'Mother Dairy',4.5),
('lays-classic','Lay''s Classic Salted','Crispy potato chips','52 g',20,20,'https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=400',(SELECT id FROM c WHERE slug='snacks-munchies'),300,8,true,true,'Lay''s',4.4),
('kurkure','Kurkure Masala Munch','Crunchy corn puffs','85 g',20,20,'https://images.unsplash.com/photo-1599629954294-14df9ec8bc03?w=400',(SELECT id FROM c WHERE slug='snacks-munchies'),250,8,true,false,'Kurkure',4.3),
('haldiram-bhujia','Haldiram Bhujia','Crispy gram flour snack','200 g',55,65,'https://images.unsplash.com/photo-1606471191009-63994c53433b?w=400',(SELECT id FROM c WHERE slug='snacks-munchies'),120,10,false,true,'Haldiram',4.5),
('oreo-cookies','Oreo Cookies','Chocolate sandwich cookies','120 g',35,40,'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400',(SELECT id FROM c WHERE slug='snacks-munchies'),200,8,true,false,'Cadbury',4.6),
('coke-can','Coca-Cola Can','Refreshing cola','300 ml',40,40,'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',(SELECT id FROM c WHERE slug='cold-drinks-juices'),300,8,true,true,'Coca-Cola',4.5),
('pepsi-bottle','Pepsi Bottle','Chilled cola','750 ml',40,45,'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400',(SELECT id FROM c WHERE slug='cold-drinks-juices'),200,8,false,false,'Pepsi',4.3),
('tropicana-orange','Tropicana Orange','100% orange juice','1 L',120,135,'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400',(SELECT id FROM c WHERE slug='cold-drinks-juices'),100,10,true,true,'Tropicana',4.5),
('redbull','Red Bull Energy','Energy drink','250 ml',125,125,'https://images.unsplash.com/photo-1613218439293-b8b30ed3fce8?w=400',(SELECT id FROM c WHERE slug='cold-drinks-juices'),80,8,false,false,'Red Bull',4.6),
('maggi-noodles','Maggi Masala Noodles','2-minute noodles','70 g',14,14,'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400',(SELECT id FROM c WHERE slug='instant-frozen'),400,8,true,true,'Maggi',4.7),
('frozen-fries','McCain French Fries','Crispy frozen fries','420 g',135,160,'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400',(SELECT id FROM c WHERE slug='instant-frozen'),60,12,false,true,'McCain',4.4),
('frozen-peas','Frozen Green Peas','Farm fresh frozen peas','500 g',75,85,'https://images.unsplash.com/photo-1535083252457-7bf12d7cfdf3?w=400',(SELECT id FROM c WHERE slug='instant-frozen'),90,12,false,false,'Safal',4.3),
('tata-tea','Tata Tea Premium','Strong assam tea','500 g',265,290,'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400',(SELECT id FROM c WHERE slug='tea-coffee'),100,10,true,true,'Tata',4.6),
('nescafe-classic','Nescafé Classic','Instant coffee','50 g',195,210,'https://images.unsplash.com/photo-1559525839-d9acfd02363a?w=400',(SELECT id FROM c WHERE slug='tea-coffee'),80,10,true,true,'Nescafé',4.5),
('green-tea','Lipton Green Tea','25 tea bags','37.5 g',135,165,'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',(SELECT id FROM c WHERE slug='tea-coffee'),120,10,false,false,'Lipton',4.4),
('parle-g','Parle-G Biscuits','Glucose biscuits','250 g',30,30,'https://images.unsplash.com/photo-1612203985729-70726954388c?w=400',(SELECT id FROM c WHERE slug='bakery-biscuits'),500,8,true,true,'Parle',4.7),
('marie-gold','Britannia Marie Gold','Light tea biscuits','250 g',40,45,'https://images.unsplash.com/photo-1599599810694-57a2ca8276a8?w=400',(SELECT id FROM c WHERE slug='bakery-biscuits'),200,8,false,false,'Britannia',4.4),
('croissant','Butter Croissant','Flaky french croissant','1 pc',45,55,'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',(SELECT id FROM c WHERE slug='bakery-biscuits'),40,12,false,true,'FlashBake',4.6),
('aashirvaad-atta','Aashirvaad Atta','Whole wheat flour','5 kg',285,330,'https://images.unsplash.com/photo-1610440042657-612c34d95e9f?w=400',(SELECT id FROM c WHERE slug='atta-rice-dal'),60,15,true,true,'Aashirvaad',4.7),
('basmati-rice','India Gate Basmati','Premium long-grain rice','1 kg',155,180,'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',(SELECT id FROM c WHERE slug='atta-rice-dal'),100,15,true,true,'India Gate',4.6),
('toor-dal','Toor Dal','Yellow split pigeon peas','1 kg',165,185,'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400',(SELECT id FROM c WHERE slug='atta-rice-dal'),80,15,false,false,'Tata Sampann',4.4),
('vim-bar','Vim Dishwash Bar','Lemon dishwash bar','300 g',45,55,'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400',(SELECT id FROM c WHERE slug='cleaning-essentials'),150,10,true,false,'Vim',4.5),
('surf-excel','Surf Excel Detergent','Liquid laundry detergent','1 L',225,260,'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400',(SELECT id FROM c WHERE slug='cleaning-essentials'),60,12,false,true,'Surf Excel',4.5),
('harpic','Harpic Toilet Cleaner','Power cleaner','1 L',145,175,'https://images.unsplash.com/photo-1585670337206-21ccff62e26b?w=400',(SELECT id FROM c WHERE slug='cleaning-essentials'),70,10,false,false,'Harpic',4.4),
('dove-soap','Dove Soap Bar','Moisturizing beauty bar','100 g',55,65,'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400',(SELECT id FROM c WHERE slug='personal-care'),200,8,true,true,'Dove',4.6),
('colgate-toothpaste','Colgate MaxFresh','Mint toothpaste','150 g',95,115,'https://images.unsplash.com/photo-1559591937-abc3a5fe7d1f?w=400',(SELECT id FROM c WHERE slug='personal-care'),150,8,false,false,'Colgate',4.5),
('head-shoulders','Head & Shoulders Shampoo','Anti-dandruff shampoo','340 ml',285,350,'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400',(SELECT id FROM c WHERE slug='personal-care'),80,10,false,true,'H&S',4.4),
('gillette-razor','Gillette Razor','Twin blade razor','1 pc',75,90,'https://images.unsplash.com/photo-1626383137804-fbe65fab9f87?w=400',(SELECT id FROM c WHERE slug='personal-care'),100,8,false,false,'Gillette',4.5),
('nivea-cream','Nivea Soft Cream','Moisturizing cream','100 ml',195,225,'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400',(SELECT id FROM c WHERE slug='personal-care'),60,10,false,false,'Nivea',4.6),
('chocolate-dairymilk','Dairy Milk Chocolate','Cadbury silk','60 g',85,90,'https://images.unsplash.com/photo-1623660053975-cf75a8be0908?w=400',(SELECT id FROM c WHERE slug='snacks-munchies'),250,8,true,true,'Cadbury',4.8),
('cucumber','Fresh Cucumber','Crunchy green cucumber','500 g',24,30,'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400',(SELECT id FROM c WHERE slug='fruits-vegetables'),200,10,false,false,'FlashFarm',4.3),
('curd-amul','Amul Dahi','Fresh curd','400 g',45,55,'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400',(SELECT id FROM c WHERE slug='dairy-bread-eggs'),120,10,true,false,'Amul',4.5),
('cheese-slices','Amul Cheese Slices','Processed cheese','200 g',135,150,'https://images.unsplash.com/photo-1632200004922-bc6602466b50?w=400',(SELECT id FROM c WHERE slug='dairy-bread-eggs'),80,10,false,true,'Amul',4.4)
ON CONFLICT (slug) DO NOTHING;

-- Seed a couple of demo coupons
INSERT INTO public.coupons (code, description, type, value, min_order, max_discount, active) VALUES
('FLASH50','Flat ₹50 off on orders above ₹299','flat',50,299,50,true),
('SAVE10','10% off up to ₹100','percent',10,199,100,true),
('WELCOME','15% off your first order','percent',15,99,150,true)
ON CONFLICT (code) DO NOTHING;
