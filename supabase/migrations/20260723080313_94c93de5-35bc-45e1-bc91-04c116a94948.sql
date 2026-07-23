ALTER TABLE public.product_media ADD COLUMN IF NOT EXISTS workstation_id uuid;
CREATE INDEX IF NOT EXISTS product_media_workstation_id_idx ON public.product_media (workstation_id);

CREATE OR REPLACE FUNCTION public.set_product_annotation_default(p_asset_id uuid, p_annotation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.product_annotations
     SET is_ppt_default = false, updated_at = now()
   WHERE asset_id = p_asset_id
     AND id <> p_annotation_id
     AND is_ppt_default = true;
  UPDATE public.product_annotations
     SET is_ppt_default = true, updated_at = now()
   WHERE id = p_annotation_id
     AND asset_id = p_asset_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_annotation_default(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_product_annotation_default(uuid, uuid) TO authenticated;