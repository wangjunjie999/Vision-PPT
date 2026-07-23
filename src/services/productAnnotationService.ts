import { supabase } from '@/integrations/supabase/client';

export async function setPptDefaultAnnotation(assetId: string, annotationId: string): Promise<void> {
  const { error } = await supabase.rpc('set_product_annotation_default', {
    p_asset_id: assetId,
    p_annotation_id: annotationId,
  });
  if (error) throw error;
}
