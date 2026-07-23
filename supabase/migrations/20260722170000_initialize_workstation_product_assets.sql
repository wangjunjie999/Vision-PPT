-- Make product_assets the durable source of truth for workstation products.
-- The initialization marker is deliberately separate from product count so a user can
-- delete every product without a later migration or application reload recreating one.
ALTER TABLE public.workstations
  ADD COLUMN IF NOT EXISTS product_assets_initialized boolean NOT NULL DEFAULT false;

WITH legacy_layout_product AS (
  SELECT DISTINCT ON (layout.workstation_id)
    layout.workstation_id,
    item
  FROM public.mechanical_layouts AS layout
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(layout.layout_objects) = 'array' THEN layout.layout_objects
      ELSE '[]'::jsonb
    END
  ) AS item
  WHERE item ->> 'type' = 'product'
  ORDER BY
    layout.workstation_id,
    CASE WHEN item ->> 'productIsPrimary' = 'true' THEN 0 ELSE 1 END,
    item ->> 'id'
), workstations_to_initialize AS (
  SELECT workstation.*,
         legacy.item AS legacy_product
  FROM public.workstations AS workstation
  LEFT JOIN legacy_layout_product AS legacy
    ON legacy.workstation_id = workstation.id
  WHERE workstation.product_assets_initialized IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_assets AS asset
      WHERE asset.scope_type = 'workstation'
        AND asset.workstation_id = workstation.id
    )
)
INSERT INTO public.product_assets (
  user_id,
  scope_type,
  workstation_id,
  source_type,
  product_name,
  sort_order,
  is_primary,
  length_mm,
  width_mm,
  height_mm,
  pos_x,
  pos_y,
  pos_z
)
SELECT
  workstation.user_id,
  'workstation'::public.product_scope_type,
  workstation.id,
  'reference',
  COALESCE(NULLIF(workstation.legacy_product ->> 'name', ''), '产品 1'),
  0,
  true,
  COALESCE(
    CASE WHEN workstation.legacy_product ->> 'productLength' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.legacy_product ->> 'productLength')::numeric END,
    CASE WHEN workstation.product_dimensions ->> 'length' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.product_dimensions ->> 'length')::numeric END,
    100
  ),
  COALESCE(
    CASE WHEN workstation.legacy_product ->> 'productWidth' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.legacy_product ->> 'productWidth')::numeric END,
    CASE WHEN workstation.product_dimensions ->> 'width' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.product_dimensions ->> 'width')::numeric END,
    100
  ),
  COALESCE(
    CASE WHEN workstation.legacy_product ->> 'productHeight' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.legacy_product ->> 'productHeight')::numeric END,
    CASE WHEN workstation.product_dimensions ->> 'height' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.product_dimensions ->> 'height')::numeric END,
    50
  ),
  COALESCE(
    CASE WHEN workstation.legacy_product ->> 'posX' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.legacy_product ->> 'posX')::numeric END,
    CASE WHEN workstation.product_position ->> 'posX' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.product_position ->> 'posX')::numeric END,
    0
  ),
  COALESCE(
    CASE WHEN workstation.legacy_product ->> 'posY' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.legacy_product ->> 'posY')::numeric END,
    CASE WHEN workstation.product_position ->> 'posY' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.product_position ->> 'posY')::numeric END,
    0
  ),
  COALESCE(
    CASE WHEN workstation.legacy_product ->> 'posZ' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.legacy_product ->> 'posZ')::numeric END,
    CASE WHEN workstation.product_position ->> 'posZ' ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN (workstation.product_position ->> 'posZ')::numeric END,
    0
  )
FROM workstations_to_initialize AS workstation;

-- Mark every pre-existing workstation as handled, including ones that already had
-- products. This makes the backfill safely repeatable and preserves an explicit zero.
UPDATE public.workstations
SET product_assets_initialized = true
WHERE product_assets_initialized IS NOT TRUE;

CREATE OR REPLACE FUNCTION public.initialize_workstation_product_asset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dimensions jsonb := COALESCE(NEW.product_dimensions, '{}'::jsonb);
BEGIN
  IF NEW.product_assets_initialized IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.product_assets (
    user_id, scope_type, workstation_id, source_type, product_name,
    sort_order, is_primary, length_mm, width_mm, height_mm, pos_x, pos_y, pos_z
  ) VALUES (
    NEW.user_id, 'workstation', NEW.id, 'reference', '产品 1',
    0, true,
    CASE WHEN dimensions ->> 'length' ~ '^[0-9]+([.][0-9]+)?$' THEN (dimensions ->> 'length')::numeric ELSE 100 END,
    CASE WHEN dimensions ->> 'width' ~ '^[0-9]+([.][0-9]+)?$' THEN (dimensions ->> 'width')::numeric ELSE 100 END,
    CASE WHEN dimensions ->> 'height' ~ '^[0-9]+([.][0-9]+)?$' THEN (dimensions ->> 'height')::numeric ELSE 50 END,
    0, 0, 0
  );

  UPDATE public.workstations
  SET product_assets_initialized = true
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS initialize_workstation_product_asset_after_insert
  ON public.workstations;

CREATE TRIGGER initialize_workstation_product_asset_after_insert
AFTER INSERT ON public.workstations
FOR EACH ROW
EXECUTE FUNCTION public.initialize_workstation_product_asset();
