ALTER TABLE public.product_annotations
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS product_annotations_asset_sort_idx
  ON public.product_annotations(asset_id, sort_order);