/**
 * Asset Registry Hook - React hook for unified asset management
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  uploadAsset,
  getCurrentAssets,
  getAssetVersions,
  cleanupOldVersions,
  getProjectAssets,
  type AssetType,
  type RelatedType,
  type AssetInfo,
  type AssetRecord
} from '@/services/assetService';

export function useAssetRegistry() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetRecord[]>([]);

  /**
   * Upload a new asset with standardized naming
   */
  const upload = useCallback(async (
    file: File,
    info: AssetInfo,
    metadata: Record<string, unknown> = {}
  ): Promise<AssetRecord | null> => {
    if (!user) {
      toast.error('请先登录');
      return null;
    }

    setLoading(true);
    try {
      const result = await uploadAsset(file, info, metadata);
      
      if ('error' in result) {
        toast.error(result.error);
        return null;
      }
      
      toast.success('资产上传成功');
      return result.record;
    } catch (error) {
      console.error('上传资产失败:', error);
      toast.error('上传资产失败');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Fetch current assets for a related entity
   */
  const fetchAssets = useCallback(async (
    relatedType: RelatedType,
    relatedId: string,
    assetType?: AssetType
  ): Promise<AssetRecord[]> => {
    setLoading(true);
    try {
      const data = await getCurrentAssets(relatedType, relatedId, assetType);
      setAssets(data);
      return data;
    } catch (error) {
      console.error('获取资产失败:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch all versions of a specific asset
   */
  const fetchVersions = useCallback(async (
    relatedId: string,
    assetType: AssetType
  ): Promise<AssetRecord[]> => {
    setLoading(true);
    try {
      return await getAssetVersions(relatedId, assetType);
    } catch (error) {
      console.error('获取资产版本失败:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete an asset
   */
  const deleteAsset = useCallback(async (assetId: string): Promise<boolean> => {
    if (!user) {
      toast.error('请先登录');
      return false;
    }

    setLoading(true);
    try {
      // Get asset info first
      const { data: asset, error: fetchError } = await supabase
        .from('asset_registry')
        .select('*')
        .eq('id', assetId)
        .single();

      if (fetchError || !asset) {
        toast.error('资产不存在');
        return false;
      }

      // Delete from storage
      await supabase.storage
        .from('project-assets')
        .remove([asset.file_path]);

      // Delete from registry
      const { error: deleteError } = await supabase
        .from('asset_registry')
        .delete()
        .eq('id', assetId);

      if (deleteError) {
        toast.error('删除资产失败');
        return false;
      }

      // Update local state
      setAssets(prev => prev.filter(a => a.id !== assetId));
      toast.success('资产已删除');
      return true;
    } catch (error) {
      console.error('删除资产失败:', error);
      toast.error('删除资产失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Cleanup old versions
   */
  const cleanup = useCallback(async (
    relatedId: string,
    assetType: AssetType,
    keepVersions: number = 3
  ): Promise<number> => {
    if (!user) return 0;

    setLoading(true);
    try {
      const deletedCount = await cleanupOldVersions(relatedId, assetType, keepVersions);
      if (deletedCount > 0) {
        toast.success(`已清理 ${deletedCount} 个旧版本`);
      }
      return deletedCount;
    } catch (error) {
      console.error('清理旧版本失败:', error);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Get all assets for a project (for PPT generation)
   */
  const getProjectAssetsForPPT = useCallback(async (projectId: string) => {
    if (!user) return null;

    setLoading(true);
    try {
      return await getProjectAssets(projectId);
    } catch (error) {
      console.error('获取项目资产失败:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Restore a previous version as current
   */
  const restoreVersion = useCallback(async (assetId: string): Promise<boolean> => {
    if (!user) {
      toast.error('请先登录');
      return false;
    }

    setLoading(true);
    try {
      // Get the asset to restore
      const { data: asset, error: fetchError } = await supabase
        .from('asset_registry')
        .select('*')
        .eq('id', assetId)
        .single();

      if (fetchError || !asset) {
        toast.error('资产不存在');
        return false;
      }

      // Mark all versions of this asset as not current
      await supabase
        .from('asset_registry')
        .update({ is_current: false })
        .eq('related_id', asset.related_id)
        .eq('asset_type', asset.asset_type);

      // Mark the selected version as current
      const { error: updateError } = await supabase
        .from('asset_registry')
        .update({ is_current: true })
        .eq('id', assetId);

      if (updateError) {
        toast.error('恢复版本失败');
        return false;
      }

      toast.success('已恢复到该版本');
      return true;
    } catch (error) {
      console.error('恢复版本失败:', error);
      toast.error('恢复版本失败');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    loading,
    assets,
    upload,
    fetchAssets,
    fetchVersions,
    deleteAsset,
    cleanup,
    getProjectAssetsForPPT,
    restoreVersion
  };
}

export type { AssetType, RelatedType, AssetInfo, AssetRecord };
