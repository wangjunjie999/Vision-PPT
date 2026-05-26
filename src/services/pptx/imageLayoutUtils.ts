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
