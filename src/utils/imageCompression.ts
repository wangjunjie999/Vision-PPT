/**
 * Image Compression Utility
 * Provides efficient image compression before upload
 */

export interface CompressionOptions {
  quality: number; // 0-1, default 0.8
  maxWidth?: number;
  maxHeight?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Compress an image blob using Canvas API
 */
export async function compressImage(
  blob: Blob,
  options: CompressionOptions = { quality: 0.8 }
): Promise<Blob> {
  const { quality, maxWidth, maxHeight, format = 'image/jpeg' } = options;
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let { width, height } = img;
      
      // Scale down if needed
      if (maxWidth && width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (maxHeight && height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (compressedBlob) => {
          if (compressedBlob) {
            resolve(compressedBlob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        format,
        quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Convert data URL to Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([arrayBuffer], { type: mimeType });
}

/**
 * Compress a data URL image
 */
export async function compressDataUrl(
  dataUrl: string,
  options: CompressionOptions = { quality: 0.8 }
): Promise<Blob> {
  const blob = dataUrlToBlob(dataUrl);
  return compressImage(blob, options);
}

/**
 * Quality presets for different use cases
 */
export const QUALITY_PRESETS = {
  // Fast mode: Lower resolution, higher compression
  fast: {
    pixelRatio: 1,
    quality: 0.6,
    maxWidth: 1200,
    maxHeight: 800,
  },
  // Standard mode: Balanced quality and speed
  standard: {
    pixelRatio: 1.5,
    quality: 0.8,
    maxWidth: 1800,
    maxHeight: 1200,
  },
  // High quality mode: Full resolution
  high: {
    pixelRatio: 2,
    quality: 0.92,
    maxWidth: 2400,
    maxHeight: 1600,
  },
} as const;

export type QualityPreset = keyof typeof QUALITY_PRESETS;
