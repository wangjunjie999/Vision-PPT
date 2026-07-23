import { supabase } from '@/integrations/supabase/client';

export async function setPptDefaultAnnotation(assetId: string, annotationId: string): Promise<void> {
  const { error } = await supabase.rpc('set_product_annotation_default', {
    p_asset_id: assetId,
    p_annotation_id: annotationId,
  });
  if (error) throw error;
}

export async function reorderProductAnnotations(assetId: string, orderedIds: string[]): Promise<void> {
  if (!assetId || orderedIds.length === 0) return;
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('product_annotations')
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('asset_id', assetId)
  );
  const results = await Promise.all(updates);
  const firstError = results.find(r => r.error)?.error;
  if (firstError) throw firstError;
}
