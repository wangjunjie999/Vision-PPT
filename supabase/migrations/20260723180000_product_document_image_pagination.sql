-- Persist product document image pagination independently for every product.
-- Existing and newly created products default to one image per document page.
ALTER TABLE public.product_assets
  ADD COLUMN IF NOT EXISTS document_images_per_page smallint;

UPDATE public.product_assets
SET document_images_per_page = 1
WHERE document_images_per_page IS NULL
   OR document_images_per_page NOT IN (1, 2);

ALTER TABLE public.product_assets
  ALTER COLUMN document_images_per_page SET DEFAULT 1,
  ALTER COLUMN document_images_per_page SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.product_assets'::regclass
      AND conname = 'product_assets_document_images_per_page_check'
  ) THEN
    ALTER TABLE public.product_assets
      ADD CONSTRAINT product_assets_document_images_per_page_check
      CHECK (document_images_per_page IN (1, 2));
  END IF;
END
$$;

COMMENT ON COLUMN public.product_assets.document_images_per_page IS
  'Number of product media images rendered on each product document page; allowed values are 1 and 2.';
