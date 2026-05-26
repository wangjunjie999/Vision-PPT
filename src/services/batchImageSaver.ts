import { supabase } from '@/integrations/supabase/client';
import { toPng } from 'html-to-image';
import { compressImage, dataUrlToBlob, QUALITY_PRESETS, type QualityPreset } from '@/utils/imageCompression';
import { imageLocalCache, blobToDataUri, type ImageCacheType } from '@/services/imageLocalCache';
import { hasCurrentSchematicLayoutSignature } from '@/utils/schematicImageSignature';

export type ViewType = 'front' | 'side' | 'top';

export interface SaveProgress {
  current: number;
  total: number;
  message: string;
  type: 'layout' | 'schematic';
}

export interface MissingImages {
  layouts: Array<{
    workstationId: string;
    workstationName: string;
    missingViews: ViewType[];
  }>;
  schematics: Array<{
    moduleId: string;
    moduleName: string;
    workstationName: string;
  }>;
  total: number;
}

/**
 * Calculate missing images for a project (only primary + auxiliary views)
 */
export function calculateMissingImages(
  projectWorkstations: any[],
  layouts: any[],
  getWorkstationModules: (wsId: string) => any[]
): MissingImages {
  const missingLayouts: MissingImages['layouts'] = [];
  const missingSchematics: MissingImages['schematics'] = [];

  for (const ws of projectWorkstations) {
    const layout = layouts.find(l => l.workstation_id === ws.id);
    
    if (layout) {
      const primaryView: ViewType = layout.primary_view || 'front';
      const auxiliaryView: ViewType = layout.auxiliary_view || 'side';
      const missingViews: ViewType[] = [];
      
      if (!layout[`${primaryView}_view_image_url`]) missingViews.push(primaryView);
      if (!layout[`${auxiliaryView}_view_image_url`] && auxiliaryView !== primaryView) missingViews.push(auxiliaryView);
      
      if (missingViews.length > 0) {
        missingLayouts.push({
          workstationId: ws.id,
          workstationName: ws.name,
          missingViews,
        });
      }
    }
    
    // Check modules for missing schematics
    const modules = getWorkstationModules(ws.id);
    for (const m of modules) {
      if (!(m as any).schematic_image_url || !hasCurrentSchematicLayoutSignature((m as any).schematic_layout)) {
        missingSchematics.push({
          moduleId: m.id,
          moduleName: m.name,
          workstationName: ws.name,
        });
      }
    }
  }

  const total = missingLayouts.reduce((acc, l) => acc + l.missingViews.length, 0) + missingSchematics.length;

  return {
    layouts: missingLayouts,
    schematics: missingSchematics,
    total,
  };
}

/**
 * Save a single view image to storage and update layout
 */
export async function saveViewToStorage(
  workstationId: string,
  layoutId: string,
  view: ViewType,
  imageBlob: Blob,
  updateLayout: (id: string, data: any) => Promise<any>
): Promise<string> {
  const fileName = `${workstationId}/${view}-${Date.now()}.jpg`;
  
  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('workstation-views')
    .upload(fileName, imageBlob, { 
      upsert: true,
      contentType: 'image/jpeg',
    });
  
  if (uploadError) throw uploadError;
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('workstation-views')
    .getPublicUrl(fileName);
  
  // Update layout
  const updateField = `${view}_view_image_url`;
  const savedField = `${view}_view_saved`;
  
  await updateLayout(layoutId, {
    [updateField]: urlData.publicUrl,
    [savedField]: true,
  } as any);
  
  // 同时缓存到本地 IndexedDB
  try {
    const cacheType: ImageCacheType = view === 'front' 
      ? 'layout_front_view' 
      : view === 'side' 
        ? 'layout_side_view' 
        : 'layout_top_view';
    
    const dataUri = await blobToDataUri(imageBlob);
    await imageLocalCache.set(cacheType, workstationId, urlData.publicUrl, dataUri);
    console.log(`[ImageCache] 三视图已同步缓存: ${view} - ${workstationId}`);
  } catch (cacheError) {
    console.warn('[ImageCache] 本地缓存失败，不影响主流程:', cacheError);
  }
  
  return urlData.publicUrl;
}

/**
 * Save module schematic to storage and update module
 */
export async function saveSchematicToStorage(
  moduleId: string,
  imageBlob: Blob,
  updateModule: (id: string, data: any) => Promise<any>,
  moduleUpdates: Record<string, any> = {}
): Promise<string> {
  const fileName = `module-schematic-${moduleId}-${Date.now()}.png`;
  
  // 清理该模块所有旧文件（按前缀搜索）
  const { data: oldFiles } = await supabase.storage
    .from('module-schematics')
    .list('', { search: `module-schematic-${moduleId}` });
  if (oldFiles?.length) {
    await supabase.storage.from('module-schematics')
      .remove(oldFiles.map(f => f.name));
  }
  
  // Upload new file
  const { error: uploadError } = await supabase.storage
    .from('module-schematics')
    .upload(fileName, imageBlob, {
      contentType: 'image/png',
      upsert: true
    });
    
  if (uploadError) throw uploadError;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('module-schematics')
    .getPublicUrl(fileName);
  
  // Update module with schematic URL
  await updateModule(moduleId, { 
    ...moduleUpdates,
    schematic_image_url: publicUrl,
    status: 'complete'
  });
  
  // 同时缓存到本地 IndexedDB
  try {
    const dataUri = await blobToDataUri(imageBlob);
    await imageLocalCache.set('module_schematic', moduleId, publicUrl, dataUri);
    console.log(`[ImageCache] 示意图已同步缓存: ${moduleId}`);
  } catch (cacheError) {
    console.warn('[ImageCache] 本地缓存失败，不影响主流程:', cacheError);
  }
  
  return publicUrl;
}

/**
 * Generate image from an HTML element
 */
/**
 * Inject a <style> tag to force all text white for consistent screenshots
 */
function injectForceWhiteStyle(container: HTMLElement): HTMLStyleElement {
  const style = document.createElement('style');
  style.id = 'capture-force-white';
  style.textContent = `
    * { color: #ffffff !important; }
    p, span, div, text, label, h1, h2, h3, h4, h5, h6 { color: #ffffff !important; fill: #ffffff !important; }
    svg text, svg tspan { fill: #ffffff !important; }
  `;
  container.prepend(style);
  return style;
}

export async function generateImageFromElement(
  element: HTMLElement,
  options: {
    quality?: QualityPreset;
    backgroundColor?: string;
    format?: 'jpeg' | 'png';
    forceWhiteText?: boolean;
  } = {}
): Promise<Blob> {
  const { quality = 'fast', backgroundColor = '#1e293b', format = 'jpeg', forceWhiteText = false } = options;
  const preset = QUALITY_PRESETS[quality];
  
  // Inject force-white style if requested
  let injectedStyle: HTMLStyleElement | null = null;
  if (forceWhiteText) {
    injectedStyle = injectForceWhiteStyle(element);
  }

  // Wait for render
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
  
  // Use try-catch to handle memory issues with large images
  let dataUrl: string;
  try {
    dataUrl = await toPng(element, {
      quality: preset.quality,
      pixelRatio: Math.min(preset.pixelRatio, 2),
      backgroundColor,
      skipFonts: true,
      cacheBust: true,
    });
  } catch (error) {
    console.warn('First image capture attempt failed, retrying with lower quality:', error);
    dataUrl = await toPng(element, {
      quality: 0.6,
      pixelRatio: 1,
      backgroundColor,
      skipFonts: true,
      cacheBust: true,
    });
  } finally {
    // Always remove injected style
    if (injectedStyle) {
      injectedStyle.remove();
    }
  }
  
  const originalBlob = dataUrlToBlob(dataUrl);
  
  if (format === 'jpeg') {
    return await compressImage(originalBlob, {
      quality: preset.quality,
      maxWidth: preset.maxWidth,
      maxHeight: preset.maxHeight,
      format: 'image/jpeg',
    });
  }
  
  return originalBlob;
}

/**
 * Generate image specifically optimized for schematic / optical diagrams.
 * Uses fixed settings to avoid artifacts in PPT:
 * - Fixed dark background (no transparency)
 * - pixelRatio 2 (sharp but not excessive)
 * - PNG format without JPEG recompression
 * - No force-white injection (pure SVG export handles text color)
 */
export async function generateSchematicImage(
  element: HTMLElement,
): Promise<Blob> {
  const backgroundColor = '#ffffff';

  // Wait for render
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

  let dataUrl: string;
  try {
    dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor,
      skipFonts: true,
      cacheBust: true,
    });
  } catch (error) {
    console.warn('Schematic capture failed, retrying with lower pixelRatio:', error);
    dataUrl = await toPng(element, {
      pixelRatio: 1.5,
      backgroundColor,
      skipFonts: true,
      cacheBust: true,
    });
  }

  // Return PNG blob directly — no JPEG compression to avoid edge artifacts
  return dataUrlToBlob(dataUrl);
}

/**
 * View name in Chinese
 */
export function getViewLabel(view: ViewType): string {
  const labels: Record<ViewType, string> = {
    front: '正视图',
    side: '侧视图',
    top: '俯视图',
  };
  return labels[view];
}
