/**
 * Hardware Image URL Mapping
 * Provides local bundled asset resolution for hardware images
 * Ensures PPT generation works across all environments (Lovable, local deploy, production)
 */

// Camera images
import cameraBasler from '@/assets/hardware/camera-basler.png';
import cameraCognex from '@/assets/hardware/camera-cognex.png';
import cameraDaheng from '@/assets/hardware/camera-daheng.png';
import cameraFlir from '@/assets/hardware/camera-flir.png';
import cameraHikvision from '@/assets/hardware/camera-hikvision.png';
import cameraIndustrial from '@/assets/hardware/camera-industrial.png';
import cameraKeyence from '@/assets/hardware/camera-keyence.png';

// Lens images
import lensComputar from '@/assets/hardware/lens-computar.png';
import lensFujinon from '@/assets/hardware/lens-fujinon.png';
import lensIndustrial from '@/assets/hardware/lens-industrial.png';
import lensKowa from '@/assets/hardware/lens-kowa.png';
import lensTamron from '@/assets/hardware/lens-tamron.png';

// Light images
import lightBacklight from '@/assets/hardware/light-backlight.png';
import lightCcs from '@/assets/hardware/light-ccs.png';
import lightMoritex from '@/assets/hardware/light-moritex.png';
import lightOpt from '@/assets/hardware/light-opt.png';
import lightRing from '@/assets/hardware/light-ring.png';

// Controller images
import controllerAdvantechImg from '@/assets/hardware/controller-advantech.png';
import controllerIpc from '@/assets/hardware/controller-ipc.png';
import controllerNeousys from '@/assets/hardware/controller-neousys.png';
import controllerNvidia from '@/assets/hardware/controller-nvidia.png';
import controllerSiemens from '@/assets/hardware/controller-siemens.png';

export interface HardwareImageSet {
  cameras: Record<string, string>;
  lenses: Record<string, string>;
  lights: Record<string, string>;
  controllers: Record<string, string>;
}

/**
 * Mapping from filename to bundled asset URL
 * These URLs are resolved at build time by Vite
 */
export const hardwareImages: HardwareImageSet = {
  cameras: {
    'camera-basler.png': cameraBasler,
    'camera-cognex.png': cameraCognex,
    'camera-daheng.png': cameraDaheng,
    'camera-flir.png': cameraFlir,
    'camera-hikvision.png': cameraHikvision,
    'camera-industrial.png': cameraIndustrial,
    'camera-keyence.png': cameraKeyence,
  },
  lenses: {
    'lens-computar.png': lensComputar,
    'lens-fujinon.png': lensFujinon,
    'lens-industrial.png': lensIndustrial,
    'lens-kowa.png': lensKowa,
    'lens-tamron.png': lensTamron,
  },
  lights: {
    'light-backlight.png': lightBacklight,
    'light-ccs.png': lightCcs,
    'light-moritex.png': lightMoritex,
    'light-opt.png': lightOpt,
    'light-ring.png': lightRing,
  },
  controllers: {
    'controller-advantech.png': controllerAdvantechImg,
    'controller-ipc.png': controllerIpc,
    'controller-neousys.png': controllerNeousys,
    'controller-nvidia.png': controllerNvidia,
    'controller-siemens.png': controllerSiemens,
  },
};

/**
 * Flat map of all hardware images by filename
 */
const allHardwareByFilename: Record<string, string> = {
  ...hardwareImages.cameras,
  ...hardwareImages.lenses,
  ...hardwareImages.lights,
  ...hardwareImages.controllers,
};

/**
 * Resolve a database hardware image URL to a local bundled asset
 * Priority: Local bundled asset > Original URL
 * 
 * @param dbUrl - URL from database (may be relative path like /hardware/xxx.png or absolute)
 * @returns Resolved URL (bundled asset or original)
 */
export function resolveHardwareImageUrl(dbUrl: string | null | undefined): string | null {
  if (!dbUrl) return null;
  
  // If it's already a data URI or absolute http(s) URL (likely Supabase Storage), use as-is
  if (dbUrl.startsWith('data:') || dbUrl.startsWith('http://') || dbUrl.startsWith('https://')) {
    return dbUrl;
  }
  
  // Extract filename from relative path like /hardware/camera-basler.png
  if (dbUrl.startsWith('/hardware/')) {
    const fileName = dbUrl.replace('/hardware/', '');
    const localAsset = allHardwareByFilename[fileName];
    if (localAsset) {
      console.log(`[HardwareImageUrls] Resolved local asset: ${dbUrl} -> ${localAsset.substring(0, 50)}...`);
      return localAsset;
    }
  }
  
  // Check if the URL matches any known filename pattern
  const fileName = dbUrl.split('/').pop();
  if (fileName && allHardwareByFilename[fileName]) {
    return allHardwareByFilename[fileName];
  }
  
  // Return original URL as fallback
  return dbUrl;
}

/**
 * Get a hardware image by type and key
 */
export function getHardwareImage(
  type: 'camera' | 'lens' | 'light' | 'controller',
  key: string
): string | null {
  const typeMap: Record<string, Record<string, string>> = {
    camera: hardwareImages.cameras,
    lens: hardwareImages.lenses,
    light: hardwareImages.lights,
    controller: hardwareImages.controllers,
  };
  
  const category = typeMap[type];
  if (!category) return null;
  
  // Try exact match first
  if (category[key]) return category[key];
  
  // Try with .png extension
  if (category[`${key}.png`]) return category[`${key}.png`];
  
  // Try partial match
  const matchingKey = Object.keys(category).find(k => k.includes(key));
  if (matchingKey) return category[matchingKey];
  
  return null;
}

/**
 * Get fallback emoji for hardware type
 */
export function getHardwareFallbackEmoji(type: 'camera' | 'lens' | 'light' | 'controller'): string {
  const emojiMap: Record<string, string> = {
    camera: '📷',
    lens: '🔭',
    light: '💡',
    controller: '🖥️',
  };
  return emojiMap[type] || '⚙️';
}

/**
 * Check if a URL is a relative hardware path that needs resolution
 */
export function isRelativeHardwarePath(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('/hardware/') || url.startsWith('/public/hardware/');
}
