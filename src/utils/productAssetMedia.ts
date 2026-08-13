export interface ProductPreviewImage {
  url: string;
  name?: string;
}

export interface ProductMediaRecord {
  id: string;
  asset_id: string;
  workstation_id?: string | null;
  original_url: string;
  file_name: string;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export type ProductImagesPerPage = 1 | 2;

export interface ProductAnnotationMedia {
  id?: string;
  asset_id?: string | null;
  media_id?: string | null;
  snapshot_url?: string | null;
  annotations_json?: unknown;
  remark?: string | null;
  is_ppt_default?: boolean | null;
  version?: number | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type ProductVisualCandidate<TAnnotation extends ProductAnnotationMedia = ProductAnnotationMedia> =
  | { kind: 'annotation'; url: string; annotation: TAnnotation }
  | { kind: 'preview'; url: string; image: ProductPreviewImage };

export interface ProductMediaOutputItem<
  TMedia extends ProductMediaRecord = ProductMediaRecord,
  TAnnotation extends ProductAnnotationMedia = ProductAnnotationMedia,
> {
  media: TMedia;
  annotation: TAnnotation | null;
}

export interface ProductMediaPage<
  TProduct extends { id: string } = { id: string },
  TMedia extends ProductMediaRecord = ProductMediaRecord,
  TAnnotation extends ProductAnnotationMedia = ProductAnnotationMedia,
> {
  product: TProduct;
  productIndex: number;
  effectiveProductCount: number;
  pageIndex: number;
  pageCount: number;
  imagesPerPage: ProductImagesPerPage;
  items: ProductMediaOutputItem<TMedia, TAnnotation>[];
}

export function resolveProductImagesPerPage(
  product: { document_images_per_page?: unknown } | null | undefined,
): ProductImagesPerPage {
  return Number(product?.document_images_per_page) === 2 ? 2 : 1;
}

export function normalizeProductPreviewImages(value: unknown): ProductPreviewImage[] {
  if (!Array.isArray(value)) return [];

  const images: ProductPreviewImage[] = [];
  for (const item of value) {
    const url = typeof item === 'string'
      ? item.trim()
      : item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string'
        ? (item as { url: string }).url.trim()
        : '';
    if (!url) continue;

    const name = item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string'
      ? (item as { name: string }).name.trim()
      : '';
    images.push(name ? { url, name } : { url });
  }
  return images;
}

export function getProductPreviewImageUrls(value: unknown): string[] {
  return normalizeProductPreviewImages(value).map(image => image.url);
}

export function sortProductAnnotationsForPpt<T extends ProductAnnotationMedia>(
  annotations: readonly T[] | null | undefined,
  assetId: string,
): T[] {
  return (annotations || [])
    .filter(annotation => annotation.asset_id === assetId && Boolean(annotation.snapshot_url?.trim()))
    .slice()
    .sort((left, right) => {
      const defaultOrder = Number(Boolean(right.is_ppt_default)) - Number(Boolean(left.is_ppt_default));
      if (defaultOrder !== 0) return defaultOrder;

      const sortOrder = Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
      if (sortOrder !== 0) return sortOrder;

      const versionOrder = Number(right.version ?? 0) - Number(left.version ?? 0);
      if (versionOrder !== 0) return versionOrder;

      const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
      const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
      if (rightTime !== leftTime) return rightTime - leftTime;
      return String(right.id || '').localeCompare(String(left.id || ''));
    });
}

export function buildProductVisualCandidates<T extends ProductAnnotationMedia>(
  assetId: string,
  annotations: readonly T[] | null | undefined,
  previewImages: unknown,
): ProductVisualCandidate<T>[] {
  const annotationCandidates: ProductVisualCandidate<T>[] = sortProductAnnotationsForPpt(annotations, assetId)
    .map(annotation => ({
      kind: 'annotation' as const,
      url: annotation.snapshot_url!.trim(),
      annotation,
    }));
  const previewCandidates: ProductVisualCandidate<T>[] = normalizeProductPreviewImages(previewImages)
    .map(image => ({ kind: 'preview' as const, url: image.url, image }));
  return [...annotationCandidates, ...previewCandidates];
}

export function hasProductVisualMedia(
  assetId: string,
  annotations: readonly ProductAnnotationMedia[] | null | undefined,
  previewImages: unknown,
): boolean {
  return buildProductVisualCandidates(assetId, annotations, previewImages).length > 0;
}

export function sortProductMedia<T extends ProductMediaRecord>(
  media: readonly T[] | null | undefined,
  assetId?: string,
): T[] {
  return (media || [])
    .filter(item => !assetId || item.asset_id === assetId)
    .slice()
    .sort((left, right) =>
      Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)
      || Date.parse(left.created_at || '') - Date.parse(right.created_at || '')
      || String(left.id).localeCompare(String(right.id))
    );
}

function sortLegacyAnnotations<T extends ProductAnnotationMedia>(
  annotations: readonly T[],
  assetId: string,
): T[] {
  return annotations
    .filter(annotation => annotation.asset_id === assetId && !annotation.media_id)
    .slice()
    .sort((left, right) =>
      Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)
      || Date.parse(left.created_at || '') - Date.parse(right.created_at || '')
      || Number(left.version ?? 0) - Number(right.version ?? 0)
      || String(left.id || '').localeCompare(String(right.id || ''))
    );
}

/**
 * Builds exactly one output item per uploaded product image. The compatibility
 * branch mirrors the SQL migration so old preview_images/annotation records are
 * still deterministic while a deployment is rolling forward.
 */
export function buildProductMediaItems<
  TMedia extends ProductMediaRecord,
  TAnnotation extends ProductAnnotationMedia,
>(
  assetId: string,
  media: readonly TMedia[] | null | undefined,
  annotations: readonly TAnnotation[] | null | undefined,
  legacyPreviewImages?: unknown,
): ProductMediaOutputItem<TMedia, TAnnotation>[] {
  const assetMedia = sortProductMedia(media, assetId);
  const annotationRows = annotations || [];

  if (assetMedia.length > 0) {
    const usedAnnotationIds = new Set<string>();
    const items = assetMedia.map(mediaItem => {
      const annotation = annotationRows.find(row =>
        row.asset_id === assetId && row.media_id === mediaItem.id
      ) || null;
      if (annotation?.id) usedAnnotationIds.add(annotation.id);
      return {
      media: mediaItem,
      annotation,
      };
    });

    sortLegacyAnnotations(annotationRows, assetId)
      .filter(annotation => !annotation.id || !usedAnnotationIds.has(annotation.id))
      .forEach((annotation, index) => {
        items.push({
          media: {
            id: `legacy-annotation:${annotation.id || index}`,
            asset_id: assetId,
            original_url: annotation.snapshot_url?.trim() || '',
            file_name: annotation.remark?.trim() || `历史标注 ${annotation.version ?? index + 1}`,
            sort_order: Number(annotation.sort_order ?? items.length),
          } as TMedia,
          annotation,
        });
      });

    return items.filter(item => Boolean(item.media.original_url));
  }

  const previews = normalizeProductPreviewImages(legacyPreviewImages);
  const legacyAnnotations = sortLegacyAnnotations(annotationRows, assetId);
  const fallback: ProductMediaOutputItem<TMedia, TAnnotation>[] = previews.map((image, index) => ({
    media: {
      id: `legacy-preview:${assetId}:${index}`,
      asset_id: assetId,
      original_url: image.url,
      file_name: image.name || `产品图片 ${index + 1}`,
      sort_order: index,
    } as TMedia,
    annotation: index === 0 ? legacyAnnotations[0] || null : null,
  }));

  const remainingAnnotations = previews.length > 0
    ? legacyAnnotations.slice(1)
    : legacyAnnotations;
  remainingAnnotations.forEach((annotation, index) => {
    fallback.push({
      media: {
        id: `legacy-annotation:${annotation.id || index}`,
        asset_id: assetId,
        original_url: annotation.snapshot_url?.trim() || '',
        file_name: annotation.remark?.trim() || `历史标注 ${annotation.version ?? index + 1}`,
        sort_order: fallback.length,
      } as TMedia,
      annotation,
    });
  });

  return fallback.filter(item => Boolean(item.media.original_url));
}

export function getProductMediaCandidateUrls(
  item: ProductMediaOutputItem,
): Array<{ kind: 'annotation' | 'original'; url: string }> {
  const candidates: Array<{ kind: 'annotation' | 'original'; url: string }> = [];
  const snapshotUrl = item.annotation?.snapshot_url?.trim();
  const originalUrl = item.media.original_url?.trim();
  if (snapshotUrl) candidates.push({ kind: 'annotation', url: snapshotUrl });
  if (originalUrl && originalUrl !== snapshotUrl) candidates.push({ kind: 'original', url: originalUrl });
  return candidates;
}

export function getProductMediaDisplayUrl(item: ProductMediaOutputItem): string {
  return getProductMediaCandidateUrls(item)[0]?.url || '';
}

export function getProductMediaAnnotationLabels(annotation: ProductAnnotationMedia | null): string[] {
  if (!annotation || !Array.isArray(annotation.annotations_json)) return [];
  return annotation.annotations_json
    .map(item => {
      if (!item || typeof item !== 'object') return '';
      const row = item as Record<string, unknown>;
      const number = row.labelNumber ?? row.number;
      const label = row.label ?? row.name ?? row.description;
      if (label == null || String(label).trim() === '') return '';
      return number == null ? String(label).trim() : `#${number} ${String(label).trim()}`;
    })
    .filter(Boolean);
}

export function formatProductMediaCaption(
  item: ProductMediaOutputItem,
  isZh = true,
): string {
  const status = item.annotation
    ? (isZh ? '已标注' : 'Annotated')
    : (isZh ? '未标注' : 'Unannotated');
  const lines = [`${item.media.file_name || (isZh ? '产品图片' : 'Product image')} · ${status}`];
  const remark = item.annotation?.remark?.trim();
  if (remark) lines.push(remark);
  const labels = getProductMediaAnnotationLabels(item.annotation);
  if (labels.length > 0) {
    const visible = labels.slice(0, 3).join('；');
    lines.push(labels.length > 3
      ? `${visible}${isZh ? `；另 ${labels.length - 3} 项` : `; +${labels.length - 3} more`}`
      : visible);
  }
  return lines.join('\n');
}

export function paginateProductMedia<
  TProduct extends {
    id: string;
    preview_images?: unknown;
    document_images_per_page?: unknown;
  },
  TMedia extends ProductMediaRecord,
  TAnnotation extends ProductAnnotationMedia,
>(
  products: readonly TProduct[] | null | undefined,
  media: readonly TMedia[] | null | undefined,
  annotations: readonly TAnnotation[] | null | undefined,
): ProductMediaPage<TProduct, TMedia, TAnnotation>[] {
  const entries = (products || []).map(product => ({
    product,
    imagesPerPage: resolveProductImagesPerPage(product),
    items: buildProductMediaItems(product.id, media, annotations, product.preview_images),
  }));

  const pages: ProductMediaPage<TProduct, TMedia, TAnnotation>[] = [];
  entries.forEach((entry, productIndex) => {
    const pageCount = Math.max(1, Math.ceil(entry.items.length / entry.imagesPerPage));
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      pages.push({
        product: entry.product,
        productIndex,
        effectiveProductCount: entries.length,
        pageIndex,
        pageCount,
        imagesPerPage: entry.imagesPerPage,
        items: entry.items.slice(
          pageIndex * entry.imagesPerPage,
          (pageIndex + 1) * entry.imagesPerPage,
        ),
      });
    }
  });
  return pages;
}

export function formatProductSchematicPageTitle(
  page: Pick<ProductMediaPage, 'productIndex' | 'effectiveProductCount' | 'pageIndex' | 'pageCount'>,
  isZh = true,
): string {
  const base = page.effectiveProductCount > 1
    ? isZh
      ? `产品示意图-产品${page.productIndex + 1}`
      : `Product Schematic-Product ${page.productIndex + 1}`
    : isZh
      ? '产品示意图'
      : 'Product Schematic';
  return `${base}${isZh ? '（' : ' ('}${page.pageIndex + 1}/${page.pageCount}${isZh ? '）' : ')'}`;
}
