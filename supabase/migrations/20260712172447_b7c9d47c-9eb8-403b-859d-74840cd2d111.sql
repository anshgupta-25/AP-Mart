ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cover_image TEXT,
  ADD COLUMN IF NOT EXISTS image_gallery TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Backfill: copy image_url into cover_image and gallery when empty
UPDATE public.products
   SET cover_image = image_url
 WHERE cover_image IS NULL AND image_url IS NOT NULL;

UPDATE public.products
   SET image_gallery = ARRAY[image_url]
 WHERE (image_gallery IS NULL OR array_length(image_gallery, 1) IS NULL)
   AND image_url IS NOT NULL;