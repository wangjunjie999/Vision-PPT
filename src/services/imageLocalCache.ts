/**
 * Image Local Cache Service
 * 专用于三视图和示意图的本地缓存
 * 使用 IndexedDB 存储图片 Blob，确保离线/本地部署时可用
 */

const DB_NAME = 'vision-image-cache';
const DB_VERSION = 2;
const STORE_NAME = 'images';

// 24小时过期
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type ImageCacheType = 
  | 'layout_front_view' 
  | 'layout_side_view' 
  | 'layout_top_view' 
  | 'module_schematic'
  | 'hardware'
  | 'product'
  | 'annotation';

export interface ImageCacheEntry {
  key: string; // 格式: {type}:{id} 如 "layout_front_view:ws-123"
  url: string; // 原始 Supabase URL
  dataUri: string; // Base64 数据
  type: ImageCacheType;
  relatedId: string; // workstation_id 或 module_id
  timestamp: number;
  expiresAt: number;
  fileSize: number;
}

export interface CacheStats {
  totalCount: number;
  totalSize: number;
  byType: Record<ImageCacheType, { count: number; size: number }>;
}

class ImageLocalCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[ImageCache] IndexedDB 初始化失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[ImageCache] IndexedDB 初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 删除旧版 store（如果存在）
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }

        // 创建新 store
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('relatedId', 'relatedId', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
        store.createIndex('url', 'url', { unique: false });
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('[ImageCache] 数据库未初始化');
    return this.db;
  }

  /**
   * 生成缓存键
   */
  static generateKey(type: ImageCacheType, relatedId: string): string {
    return `${type}:${relatedId}`;
  }

  /**
   * 保存图片到缓存
   */
  async set(
    type: ImageCacheType,
    relatedId: string,
    url: string,
    dataUri: string,
    ttlMs: number = DEFAULT_TTL_MS
  ): Promise<void> {
    const db = await this.ensureDb();
    const key = ImageLocalCacheService.generateKey(type, relatedId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const entry: ImageCacheEntry = {
        key,
        url,
        dataUri,
        type,
        relatedId,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlMs,
        fileSize: dataUri.length,
      };

      const request = store.put(entry);

      request.onsuccess = () => {
        console.log(`[ImageCache] 已缓存: ${key}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通过键获取缓存
   */
  async getByKey(key: string): Promise<string | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as ImageCacheEntry | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        // 检查是否过期
        if (Date.now() > entry.expiresAt) {
          this.deleteByKey(key).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.dataUri);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通过类型和关联 ID 获取缓存
   */
  async get(type: ImageCacheType, relatedId: string): Promise<string | null> {
    const key = ImageLocalCacheService.generateKey(type, relatedId);
    return this.getByKey(key);
  }

  /**
   * 通过原始 URL 查找缓存（用于 PPT 生成时根据 URL 匹配）
   */
  async getByUrl(url: string): Promise<string | null> {
    if (!url) return null;
    
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('url');
      const request = index.get(url);

      request.onsuccess = () => {
        const entry = request.result as ImageCacheEntry | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        // 检查是否过期
        if (Date.now() > entry.expiresAt) {
          this.deleteByKey(entry.key).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.dataUri);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 批量获取多个缓存
   */
  async getMultiple(items: Array<{ type: ImageCacheType; relatedId: string }>): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    
    await Promise.all(
      items.map(async ({ type, relatedId }) => {
        const key = ImageLocalCacheService.generateKey(type, relatedId);
        const dataUri = await this.getByKey(key);
        if (dataUri) {
          result.set(key, dataUri);
        }
      })
    );

    return result;
  }

  /**
   * 检查缓存是否存在且未过期
   */
  async exists(type: ImageCacheType, relatedId: string): Promise<boolean> {
    const data = await this.get(type, relatedId);
    return data !== null;
  }

  /**
   * 删除单个缓存
   */
  async deleteByKey(key: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 删除关联实体的所有缓存（如删除工位时清理相关缓存）
   */
  async deleteByRelatedId(relatedId: string): Promise<number> {
    const db = await this.ensureDb();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('relatedId');
      const request = index.openCursor(IDBKeyRange.only(relatedId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`[ImageCache] 已删除 ${deletedCount} 个缓存 (relatedId: ${relatedId})`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清理过期缓存
   */
  async clearExpired(): Promise<number> {
    const db = await this.ensureDb();
    const now = Date.now();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`[ImageCache] 已清理 ${deletedCount} 个过期缓存`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取缓存统计
   */
  async getStats(): Promise<CacheStats> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as ImageCacheEntry[];
        
        const stats: CacheStats = {
          totalCount: entries.length,
          totalSize: 0,
          byType: {
            layout_front_view: { count: 0, size: 0 },
            layout_side_view: { count: 0, size: 0 },
            layout_top_view: { count: 0, size: 0 },
            module_schematic: { count: 0, size: 0 },
            hardware: { count: 0, size: 0 },
            product: { count: 0, size: 0 },
            annotation: { count: 0, size: 0 },
          },
        };

        entries.forEach(entry => {
          stats.totalSize += entry.fileSize;
          if (stats.byType[entry.type]) {
            stats.byType[entry.type].count++;
            stats.byType[entry.type].size += entry.fileSize;
          }
        });

        resolve(stats);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空所有缓存
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[ImageCache] 已清空所有缓存');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取所有缓存条目（用于调试）
   */
  async getAllEntries(): Promise<ImageCacheEntry[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// 单例实例
export const imageLocalCache = new ImageLocalCacheService();

// 模块加载时初始化
imageLocalCache.init().catch(console.error);

// ================= Utility Functions =================

/**
 * 将 Blob 转为 Data URI
 */
export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 从 URL 下载图片并转为 Data URI
 */
export async function fetchImageAsDataUriForCache(url: string): Promise<string | null> {
  if (!url) return null;
  
  try {
    // 尝试使用 fetch
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    return await blobToDataUri(blob);
  } catch (fetchError) {
    // Fetch 失败，尝试使用 Image 元素（处理 CORS）
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUri = canvas.toDataURL('image/jpeg', 0.9);
            resolve(dataUri);
          } else {
            resolve(null);
          }
        } catch (e) {
          console.warn('[ImageCache] Canvas 转换失败:', e);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        console.warn('[ImageCache] 图片加载失败:', url);
        resolve(null);
      };
      
      img.src = url;
    });
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
