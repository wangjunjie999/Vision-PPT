const SUPPORTED_PRODUCT_MODEL_EXTENSIONS = new Set(['glb', 'gltf']);

export type ProductViewerDisplayMode = 'auto' | 'model' | 'image';

function normalizeSource(source: string | null | undefined): string {
  return (source || '').trim();
}

function normalizeForMatch(source: string | null | undefined): string {
  return normalizeSource(source).toLowerCase();
}

export function getProductModelExtension(source: string | null | undefined): string | null {
  const normalized = normalizeSource(source);
  if (!normalized) return null;

  const cleanSource = normalized.split('#')[0].split('?')[0];
  const lastSegment = cleanSource.split('/').pop() || cleanSource;
  const parts = lastSegment.split('.');

  if (parts.length < 2) return null;
  return (parts[parts.length - 1] || '').toLowerCase() || null;
}

export function isSupportedProductModelSource(source: string | null | undefined): boolean {
  const ext = getProductModelExtension(source);
  return !!ext && SUPPORTED_PRODUCT_MODEL_EXTENSIONS.has(ext);
}

export function isUsableAnnotationSnapshot(snapshot: string | null | undefined): boolean {
  const normalized = normalizeSource(snapshot);
  if (!normalized) return false;

  const lower = normalizeForMatch(snapshot);

  if (lower.startsWith('data:image/')) {
    return normalized.length > 2048;
  }

  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('blob:') ||
    normalized.startsWith('/')
  );
}

export async function validateAnnotationSnapshot(snapshot: string | null | undefined, timeoutMs = 3000): Promise<boolean> {
  const normalized = normalizeSource(snapshot);
  if (!isUsableAnnotationSnapshot(normalized)) return false;

  return await new Promise<boolean>((resolve) => {
    const img = new Image();
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);

    img.onload = () => {
      window.clearTimeout(timer);
      finish(img.naturalWidth > 8 && img.naturalHeight > 8);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      finish(false);
    };
    img.src = normalized;
  });
}

export function resolveAnnotationSnapshot(
  capturedSnapshot: string | null | undefined,
  fallbackImages: string[]
): string | null {
  if (isUsableAnnotationSnapshot(capturedSnapshot)) {
    return capturedSnapshot!;
  }

  return fallbackImages.find((imageUrl) => isUsableAnnotationSnapshot(imageUrl)) || null;
}

/**
 * For central canvas "截图并标注": when the viewer is in 3D model mode, do not fall back
 * to preview_images (wrong viewpoint). Image mode still uses resolveAnnotationSnapshot fallbacks.
 */
export function resolveViewerAnnotationSnapshot(
  capturedSnapshot: string | null | undefined,
  fallbackImages: string[],
  opts: {
    preferredDisplayMode: ProductViewerDisplayMode;
    modelUrl: string | null;
    imageUrls: string[];
  }
): string | null {
  const mode = resolveProductViewerDisplayMode(
    opts.preferredDisplayMode,
    opts.modelUrl,
    opts.imageUrls
  );
  const useModelCaptureOnly = mode === 'model' && isSupportedProductModelSource(opts.modelUrl);
  if (useModelCaptureOnly) {
    return isUsableAnnotationSnapshot(capturedSnapshot) ? capturedSnapshot! : null;
  }
  return resolveAnnotationSnapshot(capturedSnapshot, fallbackImages);
}

export function getSupportedProductModelHint(): string {
  return '当前仅支持 GLB / GLTF 模型预览与截图';
}

export function resolveProductViewerDisplayMode(
  preferredMode: ProductViewerDisplayMode | null | undefined,
  modelUrl: string | null | undefined,
  imageUrls: string[]
): ProductViewerDisplayMode {
  const hasUsableImages = imageUrls.some((imageUrl) => isUsableAnnotationSnapshot(imageUrl));
  const hasSupportedModel = isSupportedProductModelSource(modelUrl);

  if (preferredMode === 'image' && hasUsableImages) {
    return 'image';
  }

  if (preferredMode === 'model' && hasSupportedModel) {
    return 'model';
  }

  if (hasSupportedModel) {
    return 'model';
  }

  if (hasUsableImages) {
    return 'image';
  }

  return 'auto';
}
