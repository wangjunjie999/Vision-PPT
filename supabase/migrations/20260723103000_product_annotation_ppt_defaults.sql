-- Persist the per-product annotation selected for PPT output and make legacy
-- annotation ownership deterministic for multi-product workstations.
ALTER TABLE public.product_annotations
  ADD COLUMN IF NOT EXISTS is_ppt_default boolean NOT NULL DEFAULT false;

UPDATE public.product_annotations AS annotation
SET workstation_id = asset.workstation_id
FROM public.product_assets AS asset
WHERE annotation.asset_id = asset.id
  AND annotation.workstation_id IS DISTINCT FROM asset.workstation_id;

WITH ranked AS (
  SELECT
    id,
    count(*) FILTER (WHERE is_ppt_default) OVER (PARTITION BY asset_id) AS default_count,
    row_number() OVER (
      PARTITION BY asset_id
      ORDER BY version DESC, created_at DESC, id DESC
    ) AS rank
  FROM public.product_annotations
  WHERE asset_id IS NOT NULL
)
UPDATE public.product_annotations AS annotation
SET is_ppt_default = ranked.rank = 1
FROM ranked
WHERE annotation.id = ranked.id
  AND ranked.default_count <> 1;

CREATE UNIQUE INDEX IF NOT EXISTS product_annotations_one_ppt_default_per_asset
  ON public.product_annotations (asset_id)
  WHERE is_ppt_default;

CREATE OR REPLACE FUNCTION public.set_product_annotation_default(
  p_asset_id uuid,
  p_annotation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_annotations
    WHERE id = p_annotation_id
      AND asset_id = p_asset_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Annotation does not belong to the selected product';
  END IF;

  UPDATE public.product_annotations
  SET is_ppt_default = false
  WHERE asset_id = p_asset_id
    AND user_id = auth.uid()
    AND is_ppt_default;

  UPDATE public.product_annotations
  SET is_ppt_default = true
  WHERE id = p_annotation_id
    AND asset_id = p_asset_id
    AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_annotation_default(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_product_annotation_default(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_product_annotation_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.product_annotations
    WHERE asset_id = NEW.asset_id
      AND is_ppt_default
  ) THEN
    UPDATE public.product_annotations
    SET is_ppt_default = true
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_product_annotation_default_after_insert
  ON public.product_annotations;

CREATE TRIGGER ensure_product_annotation_default_after_insert
AFTER INSERT ON public.product_annotations
FOR EACH ROW
EXECUTE FUNCTION public.ensure_product_annotation_default();

CREATE OR REPLACE FUNCTION public.promote_product_annotation_default_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_ppt_default THEN
    UPDATE public.product_annotations
    SET is_ppt_default = true
    WHERE id = (
      SELECT id
      FROM public.product_annotations
      WHERE asset_id = OLD.asset_id
      ORDER BY version DESC, created_at DESC, id DESC
      LIMIT 1
    );
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS promote_product_annotation_default_after_delete
  ON public.product_annotations;

CREATE TRIGGER promote_product_annotation_default_after_delete
AFTER DELETE ON public.product_annotations
FOR EACH ROW
EXECUTE FUNCTION public.promote_product_annotation_default_after_delete();
