/**
 * Utility functions for image layout and aspect ratio handling
 * Ensures images are displayed with correct proportions (no stretching)
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ContainerDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface FitResult {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface TrimImageWhitespaceOptions {
  paddingPx?: number;
  threshold?: number;
  minContentRatio?: number;
  maxCropCoverage?: number;
}

export interface RasterImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface TrimBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_TRIM_OPTIONS = {
  paddingPx: 24,
  threshold: 24,
  minContentRatio: 0.05,
  maxCropCoverage: 0.98,
};

/**
 * Calculate image dimensions to fit within container while maintaining aspect ratio
 * Uses "contain" mode - image fits entirely within container with possible margins
 */
export function calculateContainFit(
  imageWidth: number,
  imageHeight: number,
  container: ContainerDimensions
): FitResult {
  const imageRatio = imageWidth / imageHeight;
  const containerRatio = container.width / container.height;
  
  let fitWidth: number;
  let fitHeight: number;
  
  if (imageRatio > containerRatio) {
    // Image is wider than container - fit to width
    fitWidth = container.width;
    fitHeight = container.width / imageRatio;
  } else {
    // Image is taller than container - fit to height
    fitHeight = container.height;
    fitWidth = container.height * imageRatio;
  }
  
  // Center the image within the container
  const x = container.x + (container.width - fitWidth) / 2;
  const y = container.y + (container.height - fitHeight) / 2;
  
  return { width: fitWidth, height: fitHeight, x, y };
}

/**
 * Get image dimensions from dataUri
 * Returns a promise that resolves with the image dimensions
 */
export function getImageDimensions(dataUri: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    if (!dataUri) {
      reject(new Error('No dataUri provided'));
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = dataUri;
  });
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number,
): number {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function estimateBackground(data: RasterImageData): { r: number; g: number; b: number } {
  const { width, height, data: pixels } = data;
  const sampleSize = Math.min(4, width, height);
  const samples: Array<{ x: number; y: number }> = [
    { x: 0, y: 0 },
    { x: Math.max(0, width - sampleSize), y: 0 },
    { x: 0, y: Math.max(0, height - sampleSize) },
    { x: Math.max(0, width - sampleSize), y: Math.max(0, height - sampleSize) },
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  samples.forEach(({ x, y }) => {
    for (let yy = y; yy < Math.min(height, y + sampleSize); yy += 1) {
      for (let xx = x; xx < Math.min(width, x + sampleSize); xx += 1) {
        const index = (yy * width + xx) * 4;
        r += pixels[index];
        g += pixels[index + 1];
        b += pixels[index + 2];
        count += 1;
      }
    }
  });

  return count > 0
    ? { r: r / count, g: g / count, b: b / count }
    : { r: 255, g: 255, b: 255 };
}

export function calculateWhitespaceTrimBounds(
  imageData: RasterImageData,
  options: TrimImageWhitespaceOptions = {},
): TrimBounds | null {
  const width = Math.max(0, Math.floor(imageData.width));
  const height = Math.max(0, Math.floor(imageData.height));
  if (width < 2 || height < 2 || imageData.data.length < width * height * 4) return null;

  const trimOptions = { ...DEFAULT_TRIM_OPTIONS, ...options };
  const paddingPx = Math.max(0, Math.floor(trimOptions.paddingPx));
  const threshold = Math.max(0, trimOptions.threshold);
  const bg = estimateBackground(imageData);
  const pixels = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let contentCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3];
      if (alpha <= 8) continue;
      const distance = colorDistance(
        pixels[index],
        pixels[index + 1],
        pixels[index + 2],
        bg.r,
        bg.g,
        bg.b,
      );
      if (distance <= threshold) continue;

      contentCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const totalPixels = width * height;
  if (contentCount === 0 || contentCount / totalPixels < trimOptions.minContentRatio) return null;

  const x0 = Math.max(0, minX - paddingPx);
  const y0 = Math.max(0, minY - paddingPx);
  const x1 = Math.min(width - 1, maxX + paddingPx);
  const y1 = Math.min(height - 1, maxY + paddingPx);
  const trimWidth = x1 - x0 + 1;
  const trimHeight = y1 - y0 + 1;
  const cropCoverage = (trimWidth * trimHeight) / totalPixels;

  if (cropCoverage >= trimOptions.maxCropCoverage) return null;
  if (trimWidth >= width && trimHeight >= height) return null;

  return { x: x0, y: y0, width: trimWidth, height: trimHeight };
}

/**
 * Trim near-background whitespace around a data URI image for PPT placement.
 * Returns the original data URI when trimming is unsafe or unavailable.
 */
export async function trimImageWhitespaceDataUri(
  dataUri: string,
  options: TrimImageWhitespaceOptions = {},
): Promise<string> {
  if (!dataUri || typeof document === 'undefined' || typeof Image === 'undefined') return dataUri;

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUri;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width < 2 || height < 2) return dataUri;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return dataUri;

    ctx.drawImage(image, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const bounds = calculateWhitespaceTrimBounds(imageData, options);
    if (!bounds) return dataUri;

    const output = document.createElement('canvas');
    output.width = bounds.width;
    output.height = bounds.height;
    const outCtx = output.getContext('2d');
    if (!outCtx) return dataUri;

    outCtx.drawImage(
      canvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height,
    );

    return output.toDataURL('image/png') || dataUri;
  } catch {
    return dataUri;
  }
}

/**
 * Layout three views (front, side, top) in a row with equal spacing
 * Maintains each image's aspect ratio within its designated slot
 */
export function calculateThreeViewLayout(
  containerY: number,
  containerHeight: number,
  containerLeft: number = 0.5,
  containerWidth: number = 9.0,
  gap: number = 0.15
): Array<ContainerDimensions> {
  const viewWidth = (containerWidth - gap * 2) / 3;
  
  return [
    { x: containerLeft, y: containerY, width: viewWidth, height: containerHeight },
    { x: containerLeft + viewWidth + gap, y: containerY, width: viewWidth, height: containerHeight },
    { x: containerLeft + (viewWidth + gap) * 2, y: containerY, width: viewWidth, height: containerHeight },
  ];
}

/**
 * Calculate layout for two columns (left content, right image)
 */
export function calculateTwoColumnLayout(
  startY: number,
  contentHeight: number,
  leftRatio: number = 0.5,
  containerLeft: number = 0.5,
  containerWidth: number = 9.0,
  gap: number = 0.2
): { left: ContainerDimensions; right: ContainerDimensions } {
  const leftWidth = (containerWidth - gap) * leftRatio;
  const rightWidth = containerWidth - gap - leftWidth;
  
  return {
    left: { 
      x: containerLeft, 
      y: startY, 
      width: leftWidth, 
      height: contentHeight 
    },
    right: { 
      x: containerLeft + leftWidth + gap, 
      y: startY, 
      width: rightWidth, 
      height: contentHeight 
    },
  };
}
