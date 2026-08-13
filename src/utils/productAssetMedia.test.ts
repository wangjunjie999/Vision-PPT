import { describe, expect, it } from 'vitest';
import {
  buildProductVisualCandidates,
  formatProductSchematicPageTitle,
  hasProductVisualMedia,
  normalizeProductPreviewImages,
  paginateProductMedia,
  resolveProductImagesPerPage,
  sortProductAnnotationsForPpt,
} from './productAssetMedia';

describe('product asset media normalization and selection', () => {
  it('normalizes both legacy string arrays and object arrays', () => {
    expect(normalizeProductPreviewImages([
      ' https://cdn.test/one.png ',
      { url: 'https://cdn.test/two.png', name: '正面' },
      { url: 'https://cdn.test/one.png', name: '重复上传' },
      { name: '缺少地址' },
      null,
    ])).toEqual([
      { url: 'https://cdn.test/one.png' },
      { url: 'https://cdn.test/two.png', name: '正面' },
      { url: 'https://cdn.test/one.png', name: '重复上传' },
    ]);
  });

  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [10, 5],
  ])('paginates %i independent product images into %i page(s)', (imageCount, pageCount) => {
    const media = Array.from({ length: imageCount }, (_, index) => ({
      id: `media-${index}`,
      asset_id: 'product-1',
      original_url: `image-${index}.png`,
      file_name: `image-${index}.png`,
      sort_order: index,
    }));
    const pages = paginateProductMedia([{ id: 'product-1', document_images_per_page: 2 }], media, []);
    expect(pages).toHaveLength(pageCount);
    expect(pages.every(page => page.items.length <= 2)).toBe(true);
    expect(pages.map(page => formatProductSchematicPageTitle(page))).toEqual(
      Array.from({ length: pageCount }, (_, index) => `产品示意图（${index + 1}/${pageCount}）`),
    );
  });

  it('keeps one placeholder page for empty products and numbers all products', () => {
    const products = [
      { id: 'empty', document_images_per_page: 1 },
      { id: 'with-3', document_images_per_page: 2 },
      { id: 'with-1', document_images_per_page: 1 },
    ];
    const media = [
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `a-${index}`, asset_id: 'with-3', original_url: `a-${index}.png`, file_name: `a-${index}.png`, sort_order: index,
      })),
      { id: 'b-0', asset_id: 'with-1', original_url: 'b.png', file_name: 'b.png', sort_order: 0 },
    ];
    const pages = paginateProductMedia(products, media, []);
    expect(pages).toHaveLength(4);
    expect(pages.map(page => page.product.id)).toEqual(['empty', 'with-3', 'with-3', 'with-1']);
    expect(pages[0].items).toEqual([]);
    expect(pages.map(page => formatProductSchematicPageTitle(page))).toEqual([
      '产品示意图-产品1（1/1）',
      '产品示意图-产品2（1/2）',
      '产品示意图-产品2（2/2）',
      '产品示意图-产品3（1/1）',
    ]);
  });

  it('defaults invalid or missing pagination modes to one image per page', () => {
    expect(resolveProductImagesPerPage(undefined)).toBe(1);
    expect(resolveProductImagesPerPage({})).toBe(1);
    expect(resolveProductImagesPerPage({ document_images_per_page: 3 })).toBe(1);
    expect(resolveProductImagesPerPage({ document_images_per_page: 2 })).toBe(2);

    const media = Array.from({ length: 3 }, (_, index) => ({
      id: `default-${index}`,
      asset_id: 'product-default',
      original_url: `${index}.png`,
      file_name: `${index}.png`,
      sort_order: index,
    }));
    const pages = paginateProductMedia([{ id: 'product-default' }], media, []);
    expect(pages).toHaveLength(3);
    expect(pages.every(page => page.imagesPerPage === 1 && page.items.length === 1)).toBe(true);
  });

  it('keeps pagination modes independent between products in one workstation', () => {
    const products = [
      { id: 'product-a', document_images_per_page: 1 },
      { id: 'product-b', document_images_per_page: 2 },
    ];
    const media = products.flatMap(product =>
      Array.from({ length: 3 }, (_, index) => ({
        id: `${product.id}-${index}`,
        asset_id: product.id,
        original_url: `${product.id}-${index}.png`,
        file_name: `${product.id}-${index}.png`,
        sort_order: index,
      }))
    );
    const pages = paginateProductMedia(products, media, []);
    expect(pages.filter(page => page.product.id === 'product-a')).toHaveLength(3);
    expect(pages.filter(page => page.product.id === 'product-b')).toHaveLength(2);
    expect(pages.filter(page => page.product.id === 'product-a').every(page => page.imagesPerPage === 1)).toBe(true);
    expect(pages.filter(page => page.product.id === 'product-b').every(page => page.imagesPerPage === 2)).toBe(true);
  });

  it('uses one editable annotation for its media and never duplicates the image', () => {
    const pages = paginateProductMedia(
      [{ id: 'product-1', document_images_per_page: 2 }],
      [{ id: 'media-1', asset_id: 'product-1', original_url: 'original.png', file_name: 'same.png', sort_order: 0 }],
      [{ id: 'annotation-1', asset_id: 'product-1', media_id: 'media-1', snapshot_url: 'annotated.png' }],
    );
    expect(pages).toHaveLength(1);
    expect(pages[0].items).toHaveLength(1);
    expect(pages[0].items[0].annotation?.id).toBe('annotation-1');
  });

  it('keeps duplicate uploads of the same URL as independent media records', () => {
    const pages = paginateProductMedia(
      [{ id: 'product-1', document_images_per_page: 2 }],
      [
        { id: 'media-1', asset_id: 'product-1', original_url: 'same.png', file_name: 'same.png', sort_order: 0 },
        { id: 'media-2', asset_id: 'product-1', original_url: 'same.png', file_name: 'same.png', sort_order: 1 },
      ],
      [],
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].items.map(item => item.media.id)).toEqual(['media-1', 'media-2']);
  });

  it('keeps annotations isolated by asset id and orders PPT default first', () => {
    const annotations = [
      { id: 'p1-v3', asset_id: 'product-1', snapshot_url: 'p1-v3.png', version: 3, is_ppt_default: false },
      { id: 'p2-v8', asset_id: 'product-2', snapshot_url: 'p2-v8.png', version: 8, is_ppt_default: true },
      { id: 'p1-v1', asset_id: 'product-1', snapshot_url: 'p1-v1.png', version: 1, is_ppt_default: true },
      { id: 'p1-v2', asset_id: 'product-1', snapshot_url: 'p1-v2.png', version: 2, is_ppt_default: false },
    ];

    expect(sortProductAnnotationsForPpt(annotations, 'product-1').map(item => item.id)).toEqual([
      'p1-v1',
      'p1-v3',
      'p1-v2',
    ]);
  });

  it('builds the required fallback chain without borrowing another product image', () => {
    const annotations = [
      { id: 'default', asset_id: 'product-1', snapshot_url: 'default.png', version: 1, is_ppt_default: true },
      { id: 'latest', asset_id: 'product-1', snapshot_url: 'latest.png', version: 2, is_ppt_default: false },
      { id: 'other-product', asset_id: 'product-2', snapshot_url: 'wrong.png', version: 9, is_ppt_default: true },
    ];
    const candidates = buildProductVisualCandidates('product-1', annotations, [
      'preview-1.png',
      { url: 'preview-2.png', name: '侧面' },
    ]);

    expect(candidates.map(candidate => candidate.url)).toEqual([
      'default.png',
      'latest.png',
      'preview-1.png',
      'preview-2.png',
    ]);
    expect(hasProductVisualMedia('product-2', [], [])).toBe(false);
  });
});
