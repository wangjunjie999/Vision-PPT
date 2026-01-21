/**
 * Image Preloader for PPT Generation
 * Implements parallel batch loading with caching for optimal performance
 */

// Image cache for dataUri conversion
const imageCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

/**
 * Fetch a single image and convert to dataUri with caching
 */
export async function fetchImageAsDataUri(url: string): Promise<string> {
  if (!url || url.trim() === '') return '';
  
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  
  if (url.startsWith('data:')) {
    if (imageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(url, url);
    return url;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('Failed to fetch image:', url, response.status);
      return '';
    }
    
    const blob = await response.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    if (imageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(url, dataUri);
    return dataUri;
  } catch (error) {
    console.warn('Failed to fetch image as dataUri:', url, error);
    return '';
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
    
    // Store successful results
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.dataUri) {
        results.set(result.value.url, result.value.dataUri);
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
