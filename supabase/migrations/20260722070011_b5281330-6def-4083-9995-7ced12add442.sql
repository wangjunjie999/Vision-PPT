ALTER TABLE public.product_assets
  ADD COLUMN IF NOT EXISTS length_mm numeric,
  ADD COLUMN IF NOT EXISTS width_mm  numeric,
  ADD COLUMN IF NOT EXISTS height_mm numeric,
  ADD COLUMN IF NOT EXISTS pos_x numeric,
  ADD COLUMN IF NOT EXISTS pos_y numeric,
  ADD COLUMN IF NOT EXISTS pos_z numeric;