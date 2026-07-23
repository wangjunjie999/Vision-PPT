import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ProductMediaRow = Database['public']['Tables']['product_media']['Row'];
export type ProductMediaInsert = Database['public']['Tables']['product_media']['Insert'];

export async function loadProductMedia(assetIds: readonly string[]): Promise<ProductMediaRow[]> {
  if (assetIds.length === 0) return [];
  const { data, error } = await supabase
    .from('product_media')
    .select('*')
    .in('asset_id', [...assetIds])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createProductMedia(rows: ProductMediaInsert[]): Promise<ProductMediaRow[]> {
  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from('product_media')
    .insert(rows)
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function deleteProductMedia(mediaId: string): Promise<void> {
  const { error } = await supabase.from('product_media').delete().eq('id', mediaId);
  if (error) throw error;
}

export async function reorderProductMedia(assetId: string, orderedIds: readonly string[]): Promise<void> {
  const results = await Promise.all(orderedIds.map((id, sortOrder) =>
    supabase
      .from('product_media')
      .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('asset_id', assetId)
  ));
  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
}
