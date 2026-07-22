
ALTER TABLE public.product_assets
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_code text,
  ADD COLUMN IF NOT EXISTS product_spec text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES public.product_assets(id) ON DELETE CASCADE;

UPDATE public.product_assets
SET product_name = COALESCE(NULLIF(product_name, ''), '产品 1'),
    is_primary = true
WHERE scope_type = 'workstation'
  AND (is_primary IS NOT TRUE OR product_name IS NULL OR product_name = '');

WITH ws_primary AS (
  SELECT DISTINCT ON (workstation_id)
    workstation_id, id AS product_id
  FROM public.product_assets
  WHERE scope_type = 'workstation'
  ORDER BY workstation_id, created_at ASC, id ASC
),
ws_counts AS (
  SELECT workstation_id, COUNT(*) AS cnt
  FROM public.product_assets
  WHERE scope_type = 'workstation'
  GROUP BY workstation_id
)
UPDATE public.product_assets pa
SET parent_product_id = wp.product_id
FROM public.function_modules fm
JOIN ws_primary wp ON wp.workstation_id = fm.workstation_id
JOIN ws_counts wc ON wc.workstation_id = fm.workstation_id
WHERE pa.scope_type = 'module'
  AND pa.module_id = fm.id
  AND pa.parent_product_id IS NULL
  AND wc.cnt = 1;

CREATE UNIQUE INDEX IF NOT EXISTS product_assets_one_primary_per_workstation
  ON public.product_assets (workstation_id)
  WHERE scope_type = 'workstation' AND is_primary;

CREATE INDEX IF NOT EXISTS idx_product_assets_workstation_scope
  ON public.product_assets (workstation_id, scope_type, sort_order);

CREATE INDEX IF NOT EXISTS idx_product_assets_parent_product
  ON public.product_assets (parent_product_id);
