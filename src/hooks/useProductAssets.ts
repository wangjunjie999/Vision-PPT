import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductAsset, ProductAnnotation, Annotation, ViewMeta } from '@/types/product';
import { toast } from 'sonner';

export function useProductAssets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<ProductAsset[]>([]);
  const [annotations, setAnnotations] = useState<ProductAnnotation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_assets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAssets((data || []) as unknown as ProductAsset[]);
    } catch (error) {
      console.error('Failed to fetch product assets:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchAnnotations = useCallback(async (assetId?: string) => {
    if (!user) return;
    try {
      let query = supabase
        .from('product_annotations')
        .select('*')
        .order('version', { ascending: false });
      
      if (assetId) {
        query = query.eq('asset_id', assetId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setAnnotations((data || []) as unknown as ProductAnnotation[]);
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const getAssetByWorkstation = useCallback((workstationId: string): ProductAsset | undefined => {
    return assets.find(a => a.scope_type === 'workstation' && a.workstation_id === workstationId);
  }, [assets]);

  const getAssetByModule = useCallback((moduleId: string): ProductAsset | undefined => {
    return assets.find(a => a.scope_type === 'module' && a.module_id === moduleId);
  }, [assets]);

  const getAnnotationsByAsset = useCallback((assetId: string): ProductAnnotation[] => {
    return annotations.filter(a => a.asset_id === assetId);
  }, [annotations]);

  const createAsset = useCallback(async (data: {
    scope_type: 'workstation' | 'module';
    workstation_id?: string;
    module_id?: string;
    source_type: string;
    model_file_url?: string;
    preview_images?: string[];
  }): Promise<ProductAsset | null> => {
    if (!user) return null;
    try {
      const insertData = {
        scope_type: data.scope_type,
        workstation_id: data.workstation_id || null,
        module_id: data.module_id || null,
        user_id: user.id,
        source_type: data.source_type,
        model_file_url: data.model_file_url || null,
        preview_images: data.preview_images || [],
      };

      const { data: result, error } = await supabase
        .from('product_assets')
        .insert(insertData as any)
        .select()
        .single();
      
      if (error) throw error;
      const newAsset = result as unknown as ProductAsset;
      setAssets(prev => [newAsset, ...prev]);
      return newAsset;
    } catch (error) {
      console.error('Failed to create asset:', error);
      toast.error('创建资产失败');
      return null;
    }
  }, [user]);

  const updateAsset = useCallback(async (assetId: string, data: Partial<ProductAsset>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('product_assets')
        .update(data as any)
        .eq('id', assetId);
      
      if (error) throw error;
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, ...data } : a));
      return true;
    } catch (error) {
      console.error('Failed to update asset:', error);
      toast.error('更新资产失败');
      return false;
    }
  }, []);

  const createAnnotation = useCallback(async (data: {
    asset_id: string;
    snapshot_url: string;
    annotations_json: Annotation[];
    view_meta?: ViewMeta;
    remark?: string;
  }): Promise<ProductAnnotation | null> => {
    if (!user) return null;
    try {
      // Get current max version for this asset
      const existingAnnotations = annotations.filter(a => a.asset_id === data.asset_id);
      const maxVersion = existingAnnotations.length > 0 
        ? Math.max(...existingAnnotations.map(a => a.version))
        : 0;

      const insertData = {
        asset_id: data.asset_id,
        user_id: user.id,
        snapshot_url: data.snapshot_url,
        annotations_json: data.annotations_json,
        view_meta: data.view_meta || {},
        version: maxVersion + 1,
        remark: data.remark || null,
      };

      const { data: result, error } = await supabase
        .from('product_annotations')
        .insert(insertData as any)
        .select()
        .single();
      
      if (error) throw error;
      const newAnnotation = result as unknown as ProductAnnotation;
      setAnnotations(prev => [newAnnotation, ...prev]);
      toast.success('标注已保存');
      return newAnnotation;
    } catch (error) {
      console.error('Failed to create annotation:', error);
      toast.error('保存标注失败');
      return null;
    }
  }, [user, annotations]);

  const deleteAnnotation = useCallback(async (annotationId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('product_annotations')
        .delete()
        .eq('id', annotationId);
      
      if (error) throw error;
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      toast.success('标注已删除');
      return true;
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      toast.error('删除标注失败');
      return false;
    }
  }, []);

  const uploadFile = useCallback(async (file: File, bucket: 'product-models' | 'product-snapshots'): Promise<string | null> => {
    if (!user) return null;
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('上传失败');
      return null;
    }
  }, [user]);

  const uploadSnapshot = useCallback(async (blob: Blob): Promise<string | null> => {
    const file = new File([blob], 'snapshot.png', { type: 'image/png' });
    return uploadFile(file, 'product-snapshots');
  }, [uploadFile]);

  return {
    assets,
    annotations,
    loading,
    fetchAssets,
    fetchAnnotations,
    getAssetByWorkstation,
    getAssetByModule,
    getAnnotationsByAsset,
    createAsset,
    updateAsset,
    createAnnotation,
    deleteAnnotation,
    uploadFile,
    uploadSnapshot,
  };
}
