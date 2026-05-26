/**
 * Image Accessibility Check Utility
 * Pre-validates image URLs before PPT generation to provide early warnings
 * and enable fallback strategies for local deployments
 */

export interface ImageCheckResult {
  url: string;
  accessible: boolean;
  type: 'three_view' | 'schematic' | 'hardware' | 'product' | 'annotation';
  label: string;
  error?: string;
}

export interface AccessibilityReport {
  totalChecked: number;
  accessible: number;
  failed: number;
  results: ImageCheckResult[];
  failedByType: Record<string, number>;
}

/**
 * Check if a single image URL is accessible
 * Uses HEAD request for efficiency, falls back to GET on error
 */
export async function checkImageAccessibility(
  url: string,
  type: ImageCheckResult['type'],
  label: string,
  timeout: number = 5000
): Promise<ImageCheckResult> {
  if (!url || url.trim() === '') {
    return { url, accessible: false, type, label, error: 'Empty URL' };
  }

  // Data URIs are always accessible
  if (url.startsWith('data:')) {
    return { url, accessible: true, type, label };
  }

  // Build absolute URL for relative paths
  let absoluteUrl = url;
  if (url.startsWith('/') && !url.startsWith('//')) {
    absoluteUrl = `${window.location.origin}${url}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Try HEAD first (faster)
    const response = await fetch(absoluteUrl, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'cors',
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      return { url, accessible: true, type, label };
    } else {
      return { 
        url, 
        accessible: false, 
        type, 
        label, 
        error: `HTTP ${response.status}` 
      };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    // For CORS errors, try with no-cors mode to at least check if resource exists
    try {
      const noCorsController = new AbortController();
      const noCorsTimeoutId = setTimeout(() => noCorsController.abort(), 3000);
      
      const noCorsResponse = await fetch(absoluteUrl, {
        method: 'GET',
        signal: noCorsController.signal,
        mode: 'no-cors', // This will return opaque response
      });
      clearTimeout(noCorsTimeoutId);
      
      // If we get here without error, resource likely exists (just CORS blocked)
      // For Supabase public buckets, this usually means the image is accessible
      if (noCorsResponse.type === 'opaque') {
        console.log(`[ImageCheck] ${url} - CORS blocked but resource exists`);
        return { url, accessible: true, type, label };
      }
      
      return { url, accessible: true, type, label };
    } catch {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        url, 
        accessible: false, 
        type, 
        label, 
        error: errorMessage.includes('abort') ? 'Timeout' : errorMessage 
      };
    }
  }
}

/**
 * Batch check multiple image URLs
 */
export async function checkMultipleImages(
  images: Array<{ url: string; type: ImageCheckResult['type']; label: string }>,
  concurrency: number = 5
): Promise<AccessibilityReport> {
  const results: ImageCheckResult[] = [];
  const failedByType: Record<string, number> = {};

  // Process in batches for concurrency control
  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(img => checkImageAccessibility(img.url, img.type, img.label))
    );
    results.push(...batchResults);
  }

  // Calculate statistics
  const accessible = results.filter(r => r.accessible).length;
  const failed = results.filter(r => !r.accessible).length;

  results.forEach(r => {
    if (!r.accessible) {
      failedByType[r.type] = (failedByType[r.type] || 0) + 1;
    }
  });

  return {
    totalChecked: results.length,
    accessible,
    failed,
    results,
    failedByType,
  };
}

/**
 * Collect image URLs from workstation data for pre-check
 */
export function collectWorkstationImageUrls(
  layouts: Array<{
    name?: string;
    front_view_image_url?: string | null;
    side_view_image_url?: string | null;
    top_view_image_url?: string | null;
  }>,
  modules: Array<{
    name: string;
    schematic_image_url?: string | null;
  }>,
  annotations?: Array<{
    snapshot_url?: string;
  }>,
  productAssets?: Array<{
    preview_images?: Array<{ url: string; name?: string }> | null;
  }>
): Array<{ url: string; type: ImageCheckResult['type']; label: string }> {
  const images: Array<{ url: string; type: ImageCheckResult['type']; label: string }> = [];

  // Layout three-views
  layouts.forEach((layout, index) => {
    const layoutName = layout.name || `布局 ${index + 1}`;
    if (layout.front_view_image_url) {
      images.push({ 
        url: layout.front_view_image_url, 
        type: 'three_view', 
        label: `${layoutName} - 正视图` 
      });
    }
    if (layout.side_view_image_url) {
      images.push({ 
        url: layout.side_view_image_url, 
        type: 'three_view', 
        label: `${layoutName} - 侧视图` 
      });
    }
    if (layout.top_view_image_url) {
      images.push({ 
        url: layout.top_view_image_url, 
        type: 'three_view', 
        label: `${layoutName} - 俯视图` 
      });
    }
  });

  // Module schematics
  modules.forEach(mod => {
    if (mod.schematic_image_url) {
      images.push({ 
        url: mod.schematic_image_url, 
        type: 'schematic', 
        label: `${mod.name} - 视觉系统示意图` 
      });
    }
  });

  // Annotations
  annotations?.forEach((annot, index) => {
    if (annot.snapshot_url) {
      images.push({ 
        url: annot.snapshot_url, 
        type: 'annotation', 
        label: `标注截图 ${index + 1}` 
      });
    }
  });

  // Product assets
  productAssets?.forEach((asset, index) => {
    asset.preview_images?.forEach((img, imgIndex) => {
      images.push({ 
        url: img.url, 
        type: 'product', 
        label: img.name || `产品图片 ${index + 1}-${imgIndex + 1}` 
      });
    });
  });

  return images;
}

/**
 * Format accessibility report for display
 */
export function formatAccessibilityReport(report: AccessibilityReport): string {
  if (report.failed === 0) {
    return `✅ 所有 ${report.totalChecked} 张图片均可访问`;
  }

  const lines = [
    `⚠️ ${report.failed}/${report.totalChecked} 张图片无法访问:`,
  ];

  // Group by type
  if (report.failedByType.three_view) {
    lines.push(`  • 三视图: ${report.failedByType.three_view} 张`);
  }
  if (report.failedByType.schematic) {
    lines.push(`  • 视觉系统示意图: ${report.failedByType.schematic} 张`);
  }
  if (report.failedByType.hardware) {
    lines.push(`  • 硬件图片: ${report.failedByType.hardware} 张`);
  }
  if (report.failedByType.product) {
    lines.push(`  • 产品图片: ${report.failedByType.product} 张`);
  }
  if (report.failedByType.annotation) {
    lines.push(`  • 标注截图: ${report.failedByType.annotation} 张`);
  }

  return lines.join('\n');
}
