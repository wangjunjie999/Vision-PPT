-- Store every uploaded product image as an independent media record.
-- preview_images remains on product_assets for one compatibility release, but new
-- workstation product uploads write product_media only.
CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.product_assets(id) ON DELETE CASCADE,
  workstation_id uuid REFERENCES public.workstations(id) ON DELETE CASCADE,
  original_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  legacy_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_media_asset_order
  ON public.product_media (asset_id, sort_order, created_at, id);

CREATE INDEX IF NOT EXISTS idx_product_media_workstation
  ON public.product_media (workstation_id);

CREATE UNIQUE INDEX IF NOT EXISTS product_media_legacy_key_unique
  ON public.product_media (asset_id, legacy_key)
  WHERE legacy_key IS NOT NULL;

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own product media" ON public.product_media;
CREATE POLICY "Users can view own product media"
  ON public.product_media FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own product media" ON public.product_media;
CREATE POLICY "Users can insert own product media"
  ON public.product_media FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.product_assets AS asset
      WHERE asset.id = asset_id
        AND asset.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own product media" ON public.product_media;
CREATE POLICY "Users can update own product media"
  ON public.product_media FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own product media" ON public.product_media;
CREATE POLICY "Users can delete own product media"
  ON public.product_media FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_product_media_updated_at ON public.product_media;
CREATE TRIGGER update_product_media_updated_at
  BEFORE UPDATE ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_annotations
  ADD COLUMN IF NOT EXISTS media_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Recreate the FK so the migration is safe to re-run after a partial deployment.
ALTER TABLE public.product_annotations
  DROP CONSTRAINT IF EXISTS product_annotations_media_id_fkey;

ALTER TABLE public.product_annotations
  ADD CONSTRAINT product_annotations_media_id_fkey
  FOREIGN KEY (media_id)
  REFERENCES public.product_media(id)
  ON DELETE CASCADE;

DROP TRIGGER IF EXISTS update_product_annotations_updated_at ON public.product_annotations;
CREATE TRIGGER update_product_annotations_updated_at
  BEFORE UPDATE ON public.product_annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1) Convert every legacy preview image into an independent media record. URL is
-- deliberately not unique: duplicate uploads remain distinct records.
WITH legacy_previews AS (
  SELECT
    asset.id AS asset_id,
    asset.user_id,
    asset.workstation_id,
    preview.ordinality::integer - 1 AS sort_order,
    CASE
      WHEN jsonb_typeof(preview.value) = 'string'
        THEN trim(both '"' FROM preview.value::text)
      ELSE trim(COALESCE(preview.value ->> 'url', ''))
    END AS original_url,
    CASE
      WHEN jsonb_typeof(preview.value) = 'object'
        THEN trim(COALESCE(preview.value ->> 'name', ''))
      ELSE ''
    END AS file_name,
    'preview:' || preview.ordinality::text AS legacy_key
  FROM public.product_assets AS asset
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(asset.preview_images, '[]'::jsonb)) = 'array'
        THEN COALESCE(asset.preview_images, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS preview(value, ordinality)
)
INSERT INTO public.product_media (
  user_id,
  asset_id,
  workstation_id,
  original_url,
  file_name,
  sort_order,
  legacy_key
)
SELECT
  user_id,
  asset_id,
  workstation_id,
  original_url,
  COALESCE(NULLIF(file_name, ''), '产品图片 ' || (sort_order + 1)::text),
  sort_order,
  legacy_key
FROM legacy_previews
WHERE original_url <> ''
ON CONFLICT (asset_id, legacy_key) WHERE legacy_key IS NOT NULL DO NOTHING;

-- 2) The first legacy annotation shares the first preview media for that product.
WITH ranked_annotations AS (
  SELECT
    annotation.id,
    annotation.asset_id,
    row_number() OVER (
      PARTITION BY annotation.asset_id
      ORDER BY annotation.created_at ASC, annotation.version ASC, annotation.id ASC
    ) AS annotation_rank
  FROM public.product_annotations AS annotation
  WHERE annotation.media_id IS NULL
),
first_preview AS (
  SELECT DISTINCT ON (media.asset_id)
    media.asset_id,
    media.id AS media_id
  FROM public.product_media AS media
  WHERE media.legacy_key LIKE 'preview:%'
  ORDER BY media.asset_id, media.sort_order ASC, media.created_at ASC, media.id ASC
)
UPDATE public.product_annotations AS annotation
SET media_id = first_preview.media_id,
    updated_at = now()
FROM ranked_annotations
JOIN first_preview ON first_preview.asset_id = ranked_annotations.asset_id
WHERE annotation.id = ranked_annotations.id
  AND ranked_annotations.annotation_rank = 1
  AND annotation.media_id IS NULL;

-- 3) Every remaining legacy annotation becomes its own media record so no saved
-- snapshot is lost. Annotation-only products follow the same path.
INSERT INTO public.product_media (
  user_id,
  asset_id,
  workstation_id,
  original_url,
  file_name,
  sort_order,
  legacy_key,
  created_at,
  updated_at
)
SELECT
  annotation.user_id,
  annotation.asset_id,
  COALESCE(annotation.workstation_id, asset.workstation_id),
  annotation.snapshot_url,
  COALESCE(NULLIF(annotation.remark, ''), '历史标注 ' || annotation.version::text),
  COALESCE((
    SELECT max(existing.sort_order) + 1
    FROM public.product_media AS existing
    WHERE existing.asset_id = annotation.asset_id
  ), 0) + row_number() OVER (
    PARTITION BY annotation.asset_id
    ORDER BY annotation.created_at ASC, annotation.version ASC, annotation.id ASC
  )::integer - 1,
  'annotation:' || annotation.id::text,
  annotation.created_at,
  COALESCE(annotation.updated_at, annotation.created_at)
FROM public.product_annotations AS annotation
JOIN public.product_assets AS asset ON asset.id = annotation.asset_id
WHERE annotation.media_id IS NULL
ON CONFLICT (asset_id, legacy_key) WHERE legacy_key IS NOT NULL DO NOTHING;

UPDATE public.product_annotations AS annotation
SET media_id = media.id,
    updated_at = now()
FROM public.product_media AS media
WHERE annotation.media_id IS NULL
  AND media.asset_id = annotation.asset_id
  AND media.legacy_key = 'annotation:' || annotation.id::text;

CREATE UNIQUE INDEX IF NOT EXISTS product_annotations_one_per_media
  ON public.product_annotations (media_id)
  WHERE media_id IS NOT NULL;

