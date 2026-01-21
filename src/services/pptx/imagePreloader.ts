/**
 * Image Preloader for PPT Generation
 * Implements parallel batch loading with caching for optimal performance
 * 
 * Priority chain for image resolution:
 * 1. Local bundled assets (src/assets) - most reliable
 * 2. Supabase Storage URL - cloud resources (with CORS handling)
 * 3. Public directory relative path - legacy support
 * 4. Empty string (caller handles fallback) - prevents broken layout
 * 
 * Enhanced for local GitHub deployments with:
 * - Multi-strategy fetch attempts
 * - CORS error detection and recovery
 * - Detailed logging for debugging
 */

import { resolveHardwareImageUrl } from '@/utils/hardwareImageUrls';

// Image cache for dataUri conversion
const imageCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

// Track failed URLs to avoid repeated attempts
const failedUrls = new Set<string>();

/**
 * Fetch a single image and convert to dataUri with caching
 * Enhanced with local asset resolution and CORS handling
 */
export async function fetchImageAsDataUri(url: string): Promise<string> {
  if (!url || url.trim() === '') return '';
  
  // Check cache first (using original URL as key)
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  
  // Skip known failed URLs (with periodic retry)
  if (failedUrls.has(url)) {
    console.log(`[ImagePreloader] Skipping known failed URL: ${url}`);
    return '';
  }
  
  // If already a data URI, cache and return
  if (url.startsWith('data:')) {
    addToCache(url, url);
    return url;
  }
  
  // 🔧 Key fix: Resolve hardware image paths to local bundled assets
  const resolvedUrl = resolveHardwareImageUrl(url);
  
  // If resolved URL is different and is a bundled asset (contains hash), use it
  if (resolvedUrl && resolvedUrl !== url) {
    // Bundled assets from Vite have paths like /assets/camera-basler-abc123.png
    if (resolvedUrl.includes('/assets/') || resolvedUrl.startsWith('data:')) {
      try {
        const dataUri = await fetchFromUrl(resolvedUrl);
        if (dataUri) {
          addToCache(url, dataUri); // Cache with original URL as key
          return dataUri;
        }
      } catch (e) {
        console.warn(`[ImagePreloader] Failed to load bundled asset: ${resolvedUrl}`, e);
      }
    }
  }
  
  // Build absolute URL for relative paths
  let absoluteUrl = resolvedUrl || url;
  if (absoluteUrl.startsWith('/') && !absoluteUrl.startsWith('//')) {
    absoluteUrl = `${window.location.origin}${absoluteUrl}`;
    console.log(`[ImagePreloader] Converting relative URL: ${url} -> ${absoluteUrl}`);
  }
  
  // Multi-strategy fetch for Supabase Storage URLs
  const isSupabaseUrl = absoluteUrl.includes('supabase.co/storage');
  
  try {
    const dataUri = await fetchFromUrl(absoluteUrl);
    if (dataUri) {
      addToCache(url, dataUri);
      return dataUri;
    }
    
    // If direct fetch failed and it's a Supabase URL, try alternative strategies
    if (isSupabaseUrl) {
      console.log(`[ImagePreloader] Supabase URL failed, trying alternative strategies: ${url}`);
      const altDataUri = await fetchWithCorsProxy(absoluteUrl);
      if (altDataUri) {
        addToCache(url, altDataUri);
        return altDataUri;
      }
    }
    
    failedUrls.add(url);
    return '';
  } catch (error) {
    console.warn(`[ImagePreloader] Failed to fetch image as dataUri: ${absoluteUrl}`, error);
    failedUrls.add(url);
    return '';
  }
}

/**
 * Alternative fetch strategy using Image element for CORS-blocked resources
 * This works for public Supabase Storage buckets when direct fetch fails
 */
async function fetchWithCorsProxy(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      console.warn(`[ImagePreloader] Image element load timeout: ${url}`);
      resolve('');
    }, 10000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUri = canvas.toDataURL('image/png');
          console.log(`[ImagePreloader] Successfully loaded via Image element: ${url}`);
          resolve(dataUri);
        } else {
          resolve('');
        }
      } catch (e) {
        console.warn(`[ImagePreloader] Canvas conversion failed (CORS): ${url}`, e);
        resolve('');
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.warn(`[ImagePreloader] Image element load failed: ${url}`);
      resolve('');
    };
    
    img.src = url;
  });
}

/**
 * Clear failed URLs cache (call before each PPT generation)
 */
export function resetFailedUrlsCache(): void {
  failedUrls.clear();
}

/**
 * Add to cache with size management
 */
function addToCache(key: string, value: string): void {
  if (imageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }
  imageCache.set(key, value);
}

/**
 * Fetch image from URL and convert to dataUri
 */
async function fetchFromUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`[ImagePreloader] Failed to fetch image: ${url} (status: ${response.status})`);
      return '';
    }
    
    const blob = await response.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    return dataUri;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Collect all image URLs from the generation data
 */
export function collectAllImageUrls(
  layouts: Array<{
    front_view_image_url?: string | null;
    side_view_image_url?: string | null;
    top_view_image_url?: string | null;
    selected_cameras?: Array<{ image_url?: string | null }> | null;
    selected_lenses?: Array<{ image_url?: string | null }> | null;
    selected_lights?: Array<{ image_url?: string | null }> | null;
    selected_controller?: { image_url?: string | null } | null;
  }>,
  modules: Array<{ schematic_image_url?: string | null }>,
  annotations?: Array<{ snapshot_url?: string }>,
  productAssets?: Array<{ preview_images?: Array<{ url: string }> | null }>,
  hardware?: {
    cameras: Array<{ image_url: string | null }>;
    lenses: Array<{ image_url: string | null }>;
    lights: Array<{ image_url: string | null }>;
    controllers: Array<{ image_url: string | null }>;
  }
): string[] {
  const urls: string[] = [];
  
  // Layout three-views
  layouts.forEach(layout => {
    if (layout.front_view_image_url) urls.push(layout.front_view_image_url);
    if (layout.side_view_image_url) urls.push(layout.side_view_image_url);
    if (layout.top_view_image_url) urls.push(layout.top_view_image_url);
    
    // Selected hardware images from layout - with defensive array checks
    const selectedCameras = Array.isArray(layout.selected_cameras) ? layout.selected_cameras : [];
    const selectedLenses = Array.isArray(layout.selected_lenses) ? layout.selected_lenses : [];
    const selectedLights = Array.isArray(layout.selected_lights) ? layout.selected_lights : [];
    
    selectedCameras.forEach(cam => {
      if (cam?.image_url) urls.push(cam.image_url);
    });
    selectedLenses.forEach(lens => {
      if (lens?.image_url) urls.push(lens.image_url);
    });
    selectedLights.forEach(light => {
      if (light?.image_url) urls.push(light.image_url);
    });
    if (layout.selected_controller?.image_url) {
      urls.push(layout.selected_controller.image_url);
    }
  });
  
  // Module schematics
  modules.forEach(mod => {
    if (mod.schematic_image_url) urls.push(mod.schematic_image_url);
  });
  
  // Annotations
  annotations?.forEach(annot => {
    if (annot.snapshot_url) urls.push(annot.snapshot_url);
  });
  
  // Product assets
  productAssets?.forEach(asset => {
    asset.preview_images?.forEach(img => {
      if (img.url) urls.push(img.url);
    });
  });
  
  // Hardware images
  if (hardware) {
    hardware.cameras.forEach(cam => {
      if (cam.image_url) urls.push(cam.image_url);
    });
    hardware.lenses.forEach(lens => {
      if (lens.image_url) urls.push(lens.image_url);
    });
    hardware.lights.forEach(light => {
      if (light.image_url) urls.push(light.image_url);
    });
    hardware.controllers.forEach(ctrl => {
      if (ctrl.image_url) urls.push(ctrl.image_url);
    });
  }
  
  // Remove duplicates
  return [...new Set(urls.filter(Boolean))];
}

/**
 * Preload images in batches for better performance
 * @param urls Array of image URLs to preload
 * @param batchSize Number of images per batch (default 15)
 * @param onProgress Optional progress callback
 */
export async function preloadImagesInBatches(
  urls: string[],
  batchSize: number = 15,
  onProgress?: (loaded: number, total: number) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const failedUrls: string[] = [];
  const totalUrls = urls.length;
  
  if (totalUrls === 0) return results;
  
  console.log(`[ImagePreloader] Starting preload of ${totalUrls} images in batches of ${batchSize}`);
  const startTime = Date.now();
  
  for (let i = 0; i < totalUrls; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    // Load batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async url => {
        const dataUri = await fetchImageAsDataUri(url);
        return { url, dataUri };
      })
    );
    
    // Store successful results, track failures
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.dataUri) {
          results.set(result.value.url, result.value.dataUri);
        } else {
          failedUrls.push(result.value.url);
        }
      } else {
        // Promise rejected
        console.warn(`[ImagePreloader] Promise rejected for image in batch`);
      }
    });
    
    // Report progress
    const loaded = Math.min(i + batchSize, totalUrls);
    onProgress?.(loaded, totalUrls);
    
    // Small delay between batches to prevent memory pressure
    if (i + batchSize < totalUrls) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[ImagePreloader] Completed: ${results.size}/${totalUrls} images in ${elapsed}ms`);
  
  // Report failed images
  if (failedUrls.length > 0) {
    console.error(`[ImagePreloader] Failed to load ${failedUrls.length} images:`, failedUrls);
  }
  
  return results;
}

/**
 * Get cached image or fetch it
 */
export function getCachedImage(url: string): string {
  return imageCache.get(url) || '';
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}
