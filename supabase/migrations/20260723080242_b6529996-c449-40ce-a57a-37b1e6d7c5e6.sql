ALTER TABLE public.product_assets ADD COLUMN IF NOT EXISTS document_images_per_page smallint NOT NULL DEFAULT 1;
ALTER TABLE public.product_annotations ADD COLUMN IF NOT EXISTS is_ppt_default boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS product_annotations_one_default_per_asset ON public.product_annotations (asset_id) WHERE is_ppt_default;