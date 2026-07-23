import { afterEach, expect, it, vi } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { generatePPTX } from '@/services/pptxGenerator';
import { resetFailedUrlsCache } from './imagePreloader';

const runQa = process.env.GENERATE_MULTI_PRODUCT_PPT_QA === '1' ? it : it.skip;
const onePixelPng = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
));

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function mediaPngDataUrl(_label: string, color: string): string {
  const width = 600;
  const height = 400;
  const [red, green, blue] = color
    .replace('#', '')
    .match(/.{2}/g)!
    .map(value => Number.parseInt(value, 16));
  const scanline = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 4;
    scanline[offset] = red;
    scanline[offset + 1] = green;
    scanline[offset + 2] = blue;
    scanline[offset + 3] = 255;
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => scanline));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const project = {
  id: 'qa-project',
  code: 'QA-001',
  name: '产品媒体与 BOM 分页验收',
  customer: 'QA',
  date: '2026-07-23',
  responsible: 'Codex QA',
  product_process: '产品图片分页',
  quality_strategy: '按产品隔离媒体',
  environment: [],
  notes: null,
};

const hardware = { cameras: [], lenses: [], lights: [], controllers: [] };
const generationOptions = { language: 'zh', quality: 'standard', mode: 'final', scope: 'full' } as const;

afterEach(() => {
  vi.unstubAllGlobals();
  resetFailedUrlsCache();
});

runQa('generates rendered QA decks for ten images, multiple products and 21 BOM records', async () => {
  class InstantImage {
    naturalWidth = 1200;
    naturalHeight = 800;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin = '';
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  const internalPageBackground = await readFile(path.resolve('public/ppt-covers/tech-shine-bg.png'));
  vi.stubGlobal('Image', InstantImage);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/ppt-covers/tech-shine-bg.png')
      ? internalPageBackground
      : onePixelPng;
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  }));

  const outputDir = path.resolve('qa-output');
  await mkdir(outputDir, { recursive: true });

  const singleWorkstationId = 'qa-single-workstation';
  const singleProductId = 'qa-single-product';
  const singleProductMedia = Array.from({ length: 10 }, (_, index) => ({
    id: `single-media-${index + 1}`,
    asset_id: singleProductId,
    workstation_id: singleWorkstationId,
    original_url: mediaPngDataUrl(`IMAGE ${index + 1}`, ['#174A7E', '#D35435', '#2F7D6D'][index % 3]),
    file_name: `single-product-${String(index + 1).padStart(2, '0')}.png`,
    sort_order: index,
  }));
  const singleBlob = await generatePPTX(
    project,
    [{
      id: singleWorkstationId,
      code: 'WS-10',
      name: '单产品十图与二十一条 BOM',
      type: 'inspection',
      cycle_time: 3,
      product_dimensions: { length: 100, width: 100, height: 50 },
      enclosed: false,
    }],
    [{
      workstation_id: singleWorkstationId,
      conveyor_type: null,
      camera_count: 0,
      lens_count: 0,
      light_count: 21,
      camera_mounts: null,
      mechanisms: null,
      selected_cameras: [],
      selected_lenses: [],
      selected_lights: Array.from({ length: 21 }, (_, index) => ({
        id: `light-${index + 1}`,
        brand: 'QA',
        model: `LIGHT-${String(index + 1).padStart(2, '0')}`,
      })),
      selected_controller: null,
    }],
    [],
    generationOptions,
    () => undefined,
    hardware,
    { missing: [], warnings: [] },
    [{
      id: 'single-annotation-1',
      asset_id: singleProductId,
      media_id: 'single-media-1',
      workstation_id: singleWorkstationId,
      scope_type: 'workstation',
      snapshot_url: mediaPngDataUrl('ANNOTATED 1', '#724E91'),
      annotations_json: [
        { labelNumber: 1, label: '检测区域' },
        { labelNumber: 2, label: '基准边' },
        { labelNumber: 3, label: '压合面' },
        { labelNumber: 4, label: '隐藏的第四项' },
      ],
      remark: '第一张图片已标注',
      version: 1,
      created_at: '2026-07-23T01:00:00Z',
    }],
    [{
      id: singleProductId,
      workstation_id: singleWorkstationId,
      module_id: null,
      scope_type: 'workstation',
      preview_images: [],
	      product_name: '产品 A',
	      is_primary: true,
	      sort_order: 0,
	      document_images_per_page: 1,
    }],
    singleProductMedia,
  );
  await writeFile(
    path.join(outputDir, 'single-product-10-images-21-bom-qa.pptx'),
    new Uint8Array(await singleBlob.arrayBuffer()),
  );

  const multiWorkstationId = 'qa-multi-workstation';
  const multiAssets = [
    {
      id: 'multi-product-a',
      workstation_id: multiWorkstationId,
      module_id: null,
      scope_type: 'workstation',
      preview_images: [],
	      product_name: '产品 Alpha',
	      is_primary: true,
	      sort_order: 0,
	      document_images_per_page: 1,
    },
    {
      id: 'multi-product-empty',
      workstation_id: multiWorkstationId,
      module_id: null,
      scope_type: 'workstation',
      preview_images: [],
      product_name: '空产品（应跳过）',
      is_primary: false,
      sort_order: 1,
    },
    {
      id: 'multi-product-b',
      workstation_id: multiWorkstationId,
      module_id: null,
      scope_type: 'workstation',
      preview_images: [],
	      product_name: '产品 Beta',
	      is_primary: false,
	      sort_order: 2,
	      document_images_per_page: 2,
    },
  ];
  const multiMedia = [
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `multi-a-media-${index + 1}`,
      asset_id: 'multi-product-a',
      workstation_id: multiWorkstationId,
      original_url: mediaPngDataUrl(`ALPHA ${index + 1}`, '#174A7E'),
      file_name: `alpha-${index + 1}.png`,
      sort_order: index,
    })),
	    ...Array.from({ length: 3 }, (_, index) => ({
	      id: `multi-b-media-${index + 1}`,
	      asset_id: 'multi-product-b',
	      workstation_id: multiWorkstationId,
	      original_url: mediaPngDataUrl(`BETA ${index + 1}`, '#D35435'),
	      file_name: `beta-${index + 1}.png`,
	      sort_order: index,
	    })),
  ];
  const multiBlob = await generatePPTX(
    { ...project, id: 'qa-multi-project', code: 'QA-002', name: '多产品媒体隔离验收' },
    [{
      id: multiWorkstationId,
      code: 'WS-MULTI',
      name: '多产品图片分页',
      type: 'inspection',
      cycle_time: 3,
      product_dimensions: { length: 100, width: 100, height: 50 },
      enclosed: false,
    }],
    [],
    [],
    generationOptions,
    () => undefined,
    hardware,
    { missing: [], warnings: [] },
    [],
    multiAssets as any,
    multiMedia,
  );
  await writeFile(
    path.join(outputDir, 'multi-product-media-qa.pptx'),
    new Uint8Array(await multiBlob.arrayBuffer()),
  );

  expect(singleBlob.size).toBeGreaterThan(20_000);
  expect(multiBlob.size).toBeGreaterThan(10_000);
  expect(singleBlob.slideCount).toBeGreaterThan(multiBlob.slideCount);
});
