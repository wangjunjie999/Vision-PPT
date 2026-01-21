/**
 * useImageCache Hook
 * 用于在保存三视图/示意图时自动缓存到本地
 */

import { useCallback, useState, useEffect } from 'react';
import { 
  imageLocalCache, 
  blobToDataUri,
  fetchImageAsDataUriForCache,
  formatFileSize,
  type ImageCacheType,
  type CacheStats,
} from '@/services/imageLocalCache';
import { toast } from 'sonner';

export interface ImageCacheStatus {
  layoutFront: boolean;
  layoutSide: boolean;
  layoutTop: boolean;
  schematic: boolean;
}

/**
 * 用于管理单个工位的图片缓存
 */
export function useWorkstationImageCache(workstationId: string | null) {
  const [cacheStatus, setCacheStatus] = useState<ImageCacheStatus>({
    layoutFront: false,
    layoutSide: false,
    layoutTop: false,
    schematic: false,
  });

  // 检查缓存状态
  const checkCacheStatus = useCallback(async () => {
    if (!workstationId) return;
    
    const [front, side, top] = await Promise.all([
      imageLocalCache.exists('layout_front_view', workstationId),
      imageLocalCache.exists('layout_side_view', workstationId),
      imageLocalCache.exists('layout_top_view', workstationId),
    ]);

    setCacheStatus(prev => ({
      ...prev,
      layoutFront: front,
      layoutSide: side,
      layoutTop: top,
    }));
  }, [workstationId]);

  useEffect(() => {
    checkCacheStatus();
  }, [checkCacheStatus]);

  /**
   * 缓存三视图（保存后自动调用）
   */
  const cacheLayoutView = useCallback(async (
    view: 'front' | 'side' | 'top',
    blob: Blob,
    url: string
  ) => {
    if (!workstationId) return;
    
    const type: ImageCacheType = view === 'front' 
      ? 'layout_front_view' 
      : view === 'side' 
        ? 'layout_side_view' 
        : 'layout_top_view';

    try {
      const dataUri = await blobToDataUri(blob);
      await imageLocalCache.set(type, workstationId, url, dataUri);
      
      setCacheStatus(prev => ({
        ...prev,
        [`layout${view.charAt(0).toUpperCase() + view.slice(1)}`]: true,
      }));
      
      console.log(`[ImageCache] 已缓存 ${view} 视图: ${workstationId}`);
    } catch (error) {
      console.error(`[ImageCache] 缓存 ${view} 视图失败:`, error);
    }
  }, [workstationId]);

  /**
   * 从 URL 下载并缓存三视图
   */
  const downloadAndCacheLayoutView = useCallback(async (
    view: 'front' | 'side' | 'top',
    url: string
  ): Promise<boolean> => {
    if (!workstationId || !url) return false;
    
    const type: ImageCacheType = view === 'front' 
      ? 'layout_front_view' 
      : view === 'side' 
        ? 'layout_side_view' 
        : 'layout_top_view';

    try {
      const dataUri = await fetchImageAsDataUriForCache(url);
      if (!dataUri) return false;
      
      await imageLocalCache.set(type, workstationId, url, dataUri);
      
      setCacheStatus(prev => ({
        ...prev,
        [`layout${view.charAt(0).toUpperCase() + view.slice(1)}`]: true,
      }));
      
      return true;
    } catch (error) {
      console.error(`[ImageCache] 下载缓存 ${view} 视图失败:`, error);
      return false;
    }
  }, [workstationId]);

  /**
   * 获取缓存的三视图
   */
  const getCachedLayoutView = useCallback(async (
    view: 'front' | 'side' | 'top'
  ): Promise<string | null> => {
    if (!workstationId) return null;
    
    const type: ImageCacheType = view === 'front' 
      ? 'layout_front_view' 
      : view === 'side' 
        ? 'layout_side_view' 
        : 'layout_top_view';

    return imageLocalCache.get(type, workstationId);
  }, [workstationId]);

  return {
    cacheStatus,
    cacheLayoutView,
    downloadAndCacheLayoutView,
    getCachedLayoutView,
    refreshCacheStatus: checkCacheStatus,
  };
}

/**
 * 用于管理单个模块的示意图缓存
 */
export function useModuleImageCache(moduleId: string | null) {
  const [isCached, setIsCached] = useState(false);

  const checkCacheStatus = useCallback(async () => {
    if (!moduleId) return;
    const exists = await imageLocalCache.exists('module_schematic', moduleId);
    setIsCached(exists);
  }, [moduleId]);

  useEffect(() => {
    checkCacheStatus();
  }, [checkCacheStatus]);

  /**
   * 缓存示意图（保存后自动调用）
   */
  const cacheSchematic = useCallback(async (blob: Blob, url: string) => {
    if (!moduleId) return;
    
    try {
      const dataUri = await blobToDataUri(blob);
      await imageLocalCache.set('module_schematic', moduleId, url, dataUri);
      setIsCached(true);
      console.log(`[ImageCache] 已缓存示意图: ${moduleId}`);
    } catch (error) {
      console.error('[ImageCache] 缓存示意图失败:', error);
    }
  }, [moduleId]);

  /**
   * 从 URL 下载并缓存示意图
   */
  const downloadAndCacheSchematic = useCallback(async (url: string): Promise<boolean> => {
    if (!moduleId || !url) return false;
    
    try {
      const dataUri = await fetchImageAsDataUriForCache(url);
      if (!dataUri) return false;
      
      await imageLocalCache.set('module_schematic', moduleId, url, dataUri);
      setIsCached(true);
      return true;
    } catch (error) {
      console.error('[ImageCache] 下载缓存示意图失败:', error);
      return false;
    }
  }, [moduleId]);

  /**
   * 获取缓存的示意图
   */
  const getCachedSchematic = useCallback(async (): Promise<string | null> => {
    if (!moduleId) return null;
    return imageLocalCache.get('module_schematic', moduleId);
  }, [moduleId]);

  return {
    isCached,
    cacheSchematic,
    downloadAndCacheSchematic,
    getCachedSchematic,
    refreshCacheStatus: checkCacheStatus,
  };
}

/**
 * 用于 PPT 生成前批量下载缓存
 */
export function useBatchImageCache() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [stats, setStats] = useState<CacheStats | null>(null);

  /**
   * 刷新缓存统计
   */
  const refreshStats = useCallback(async () => {
    const s = await imageLocalCache.getStats();
    setStats(s);
    return s;
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  /**
   * 批量下载并缓存图片
   */
  const downloadAll = useCallback(async (
    items: Array<{
      type: ImageCacheType;
      relatedId: string;
      url: string;
      label?: string;
    }>
  ): Promise<{ success: number; failed: number }> => {
    if (items.length === 0) return { success: 0, failed: 0 };
    
    setIsDownloading(true);
    setProgress({ current: 0, total: items.length, message: '准备下载...' });
    
    let success = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setProgress({ 
        current: i + 1, 
        total: items.length, 
        message: item.label || `正在下载 ${item.type}...` 
      });

      try {
        // 先检查是否已缓存
        const exists = await imageLocalCache.exists(item.type, item.relatedId);
        if (exists) {
          success++;
          continue;
        }

        // 下载并缓存
        const dataUri = await fetchImageAsDataUriForCache(item.url);
        if (dataUri) {
          await imageLocalCache.set(item.type, item.relatedId, item.url, dataUri);
          success++;
        } else {
          failed++;
          console.warn(`[ImageCache] 下载失败: ${item.url}`);
        }
      } catch (error) {
        failed++;
        console.error(`[ImageCache] 下载出错: ${item.url}`, error);
      }
    }

    setIsDownloading(false);
    await refreshStats();

    return { success, failed };
  }, [refreshStats]);

  /**
   * 检查缺失的缓存
   */
  const findMissingCache = useCallback(async (
    items: Array<{
      type: ImageCacheType;
      relatedId: string;
      url: string;
      label?: string;
    }>
  ): Promise<typeof items> => {
    const missing: typeof items = [];
    
    for (const item of items) {
      if (!item.url) continue;
      const exists = await imageLocalCache.exists(item.type, item.relatedId);
      if (!exists) {
        missing.push(item);
      }
    }

    return missing;
  }, []);

  /**
   * 清理过期缓存
   */
  const cleanExpired = useCallback(async () => {
    const count = await imageLocalCache.clearExpired();
    await refreshStats();
    if (count > 0) {
      toast.success(`已清理 ${count} 个过期缓存`);
    }
    return count;
  }, [refreshStats]);

  /**
   * 清空所有缓存
   */
  const clearAll = useCallback(async () => {
    await imageLocalCache.clearAll();
    await refreshStats();
    toast.success('已清空所有图片缓存');
  }, [refreshStats]);

  return {
    isDownloading,
    progress,
    stats,
    downloadAll,
    findMissingCache,
    cleanExpired,
    clearAll,
    refreshStats,
    formatFileSize,
  };
}
