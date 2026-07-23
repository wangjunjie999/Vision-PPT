import { afterEach, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { generateDOCX } from './docxGenerator';
import { generatePDF } from './pdfGenerator';

const runQa = process.env.GENERATE_PRODUCT_DOCUMENT_QA === '1' ? it : it.skip;
const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

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

function solidPngDataUrl(color: string): string {
  const width = 600;
  const height = 400;
  const [red, green, blue] = color.replace('#', '').match(/.{2}/g)!
    .map(value => Number.parseInt(value, 16));
  const scanline = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 4;
    scanline[offset] = red;
    scanline[offset + 1] = green;
    scanline[offset + 2] = blue;
    scanline[offset + 3] = 255;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => scanline)))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

runQa('generates mixed one-image and two-image product pages in Word and PDF', async () => {
  const canvasContext = {
    font: '',
    fillStyle: '',
    textBaseline: '',
    measureText: (text: string) => ({ width: Math.max(10, text.length * 12) }),
    fillText: () => undefined,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(onePixelPng);

  const project = {
    id: 'qa-doc-project',
    code: 'QA-DOC',
    name: '产品分页模式文档验收',
    customer: 'QA',
    date: '2026-07-23',
    responsible: 'Codex QA',
    product_process: null,
    quality_strategy: null,
    environment: [],
    notes: null,
  };
  const workstations = [{
    id: 'qa-doc-ws',
    code: 'WS-DOC',
    name: '混合分页工位',
    type: 'inspection',
    cycle_time: 3,
    product_dimensions: { length: 100, width: 80, height: 40 },
    enclosed: false,
  }];
  const layouts = [{
    workstation_id: 'qa-doc-ws',
    conveyor_type: null,
    camera_count: 0,
    lens_count: 0,
    light_count: 0,
    camera_mounts: null,
    mechanisms: null,
    selected_cameras: [],
    selected_lenses: [],
    selected_lights: [],
    selected_controller: null,
  }];
  const products = [
    {
      id: 'qa-doc-product-a',
      workstation_id: 'qa-doc-ws',
      module_id: null,
      scope_type: 'workstation',
      preview_images: [],
      model_file_url: null,
      product_name: '产品 A（单页单图）',
      document_images_per_page: 1,
      is_primary: true,
      sort_order: 0,
    },
    {
      id: 'qa-doc-product-b',
      workstation_id: 'qa-doc-ws',
      module_id: null,
      scope_type: 'workstation',
      preview_images: [],
      model_file_url: null,
      product_name: '产品 B（单页双图）',
      document_images_per_page: 2,
      is_primary: false,
      sort_order: 1,
    },
  ];
  const colors = ['#174A7E', '#2F7D6D', '#724E91', '#D35435', '#D99C2B', '#457B9D'];
  const media = products.flatMap((product, productIndex) =>
    Array.from({ length: 3 }, (_, imageIndex) => ({
      id: `${product.id}-${imageIndex + 1}`,
      asset_id: product.id,
      workstation_id: 'qa-doc-ws',
      original_url: solidPngDataUrl(colors[productIndex * 3 + imageIndex]),
      file_name: `${productIndex === 0 ? 'single' : 'double'}-${imageIndex + 1}.png`,
      sort_order: imageIndex,
    }))
  );
  const hardware = { cameras: [], lenses: [], lights: [], controllers: [] };
  const options = { language: 'zh', includeImages: true, scope: 'full' } as const;

  const [docxBlob, pdfBlob] = await Promise.all([
    generateDOCX(project as never, workstations as never, layouts as never, [], hardware, options, undefined, products as never, [], media),
    generatePDF(project as never, workstations as never, layouts as never, [], hardware, options, undefined, products as never, [], media),
  ]);

  const outputDir = path.resolve('qa-output');
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, 'mixed-product-pagination-qa.docx'), new Uint8Array(await docxBlob.arrayBuffer())),
    writeFile(path.join(outputDir, 'mixed-product-pagination-qa.pdf'), new Uint8Array(await pdfBlob.arrayBuffer())),
  ]);

  expect(docxBlob.size).toBeGreaterThan(10_000);
  expect(pdfBlob.size).toBeGreaterThan(5_000);
});
