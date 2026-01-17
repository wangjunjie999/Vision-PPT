import { supabase } from '@/integrations/supabase/client';
import { toPng } from 'html-to-image';
import { compressImage, dataUrlToBlob, QUALITY_PRESETS, type QualityPreset } from '@/utils/imageCompression';

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
 * Calculate missing images for a project
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
      const missingViews: ViewType[] = [];
      if (!layout.front_view_image_url) missingViews.push('front');
      if (!layout.side_view_image_url) missingViews.push('side');
      if (!layout.top_view_image_url) missingViews.push('top');
      
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
      if (!(m as any).schematic_image_url) {
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
  
  return urlData.publicUrl;
}

/**
 * Save module schematic to storage and update module
 */
export async function saveSchematicToStorage(
  moduleId: string,
  imageBlob: Blob,
  updateModule: (id: string, data: any) => Promise<any>
): Promise<string> {
  const fileName = `module-schematic-${moduleId}-${Date.now()}.png`;
  
  // Remove old file if exists (ignore errors)
  await supabase.storage.from('module-schematics').remove([`module-schematic-${moduleId}.png`]);
  
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
    schematic_image_url: publicUrl,
    status: 'complete'
  });
  
  return publicUrl;
}

/**
 * Generate image from an HTML element
 */
export async function generateImageFromElement(
  element: HTMLElement,
  options: {
    quality?: QualityPreset;
    backgroundColor?: string;
    format?: 'jpeg' | 'png';
  } = {}
): Promise<Blob> {
  const { quality = 'fast', backgroundColor = '#1e293b', format = 'jpeg' } = options;
  const preset = QUALITY_PRESETS[quality];
  
  // Wait for render
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
  
  const dataUrl = await toPng(element, {
    quality: preset.quality,
    pixelRatio: preset.pixelRatio,
    backgroundColor,
    skipFonts: true,
  });
  
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
