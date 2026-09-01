import { beforeEach, describe, expect, it, vi } from 'vitest';

const slideMocks = vi.hoisted(() => ({
  basic: vi.fn(),
  product: vi.fn(),
  layout: vi.fn(),
  module: vi.fn(),
  lighting: vi.fn(),
  bom: vi.fn(),
}));

type CapturedSlide = {
  addText: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  addShape: ReturnType<typeof vi.fn>;
  addTable: ReturnType<typeof vi.fn>;
};

const presentationMocks = vi.hoisted(() => ({
  slides: [] as CapturedSlide[],
}));

vi.mock('./pptx/workstationSlides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pptx/workstationSlides')>();
  return {
    ...actual,
    generateBasicInfoAndRequirementsSlide: slideMocks.basic,
    generateProductSchematicSlide: slideMocks.product,
    generateLayoutAndOpticalSlide: slideMocks.layout,
    generateModuleOpticalSlide: slideMocks.module,
    generateLightingPhotosSlide: slideMocks.lighting,
    getLightingPhotoSlideCount: (photoCount: number) => Math.ceil(Math.max(0, photoCount) / 2),
    getBOMSlideCount: () => 1,
    generateBOMSlide: slideMocks.bom,
  };
});
vi.mock('./pptx/imagePreloader', () => ({
  fetchImageAsDataUri: vi.fn().mockResolvedValue(null),
  collectAllImageUrls: vi.fn(() => []),
  preloadImagesInBatches: vi.fn(),
}));
vi.mock('pptxgenjs', () => ({
  default: class MockPptxGen {
    author = '';
    title = '';
    subject = '';
    company = '';
    layout = '';
    defineSlideMaster = vi.fn();
    addSlide = vi.fn(() => {
      const slide = { addText: vi.fn(), addImage: vi.fn(), addShape: vi.fn(), addTable: vi.fn() };
      presentationMocks.slides.push(slide);
      return slide;
    });
    write = vi.fn(async () => new Blob(['pptx']));
  },
}));

import { buildModuleTocEntries, generatePPTX } from './pptxGenerator';
import { SLIDE_LAYOUT } from './pptx/slideLabels';

type CapturedCell = { text: string };
type CapturedTableRows = CapturedCell[][];
type CapturedTableOptions = { y: number; rowH: number[] };

function findSlidesByTitle(prefix: string): CapturedSlide[] {
  return presentationMocks.slides.filter(slide => slide.addText.mock.calls.some(
    ([text]) => typeof text === 'string' && text.startsWith(prefix),
  ));
}

function getCapturedTable(slide: CapturedSlide): {
  rows: CapturedTableRows;
  options: CapturedTableOptions;
} {
  expect(slide.addTable).toHaveBeenCalledTimes(1);
  const [rows, options] = slide.addTable.mock.calls[0];
  return {
    rows: rows as CapturedTableRows,
    options: options as CapturedTableOptions,
  };
}

describe('enterprise PPT module scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presentationMocks.slides.length = 0;
  });

  it('uses only the module slide branch and keeps the current module context across workstations', async () => {
    const workstations = [
      { id: 'ws-1', code: 'WS-1', name: 'Station A', type: 'line' },
      { id: 'ws-2', code: 'WS-2', name: 'Station B', type: 'line' },
    ];
    const modules = [
      { id: 'mod-2', workstation_id: 'ws-1', name: 'Module B', type: 'defect', lighting_photos: [] },
      { id: 'mod-3', workstation_id: 'ws-2', name: 'Module C', type: 'ocr', lighting_photos: [] },
    ];
    const layouts = [
      { workstation_id: 'ws-1' },
      { workstation_id: 'ws-2' },
    ];

    const blob = await generatePPTX(
      { id: 'project-1', code: 'PRJ', name: 'Project', responsible: 'Owner' } as never,
      workstations as never,
      layouts as never,
      modules as never,
      { language: 'en', quality: 'standard', mode: 'final', scope: 'modules' },
      vi.fn(),
      { cameras: [], lenses: [], lights: [], controllers: [] },
      undefined,
      [],
      [],
    );

    expect(blob.size).toBeGreaterThan(0);
    expect(slideMocks.module).toHaveBeenCalledTimes(2);
    expect(slideMocks.module.mock.calls[0][1].modules.map((module: { id: string }) => module.id)).toEqual(['mod-2']);
    expect(slideMocks.module.mock.calls[0][2]).toBe(0);
    expect(slideMocks.module.mock.calls[1][1].modules.map((module: { id: string }) => module.id)).toEqual(['mod-3']);
    expect(slideMocks.module.mock.calls[1][2]).toBe(0);
    expect(slideMocks.basic).not.toHaveBeenCalled();
    expect(slideMocks.product).not.toHaveBeenCalled();
    expect(slideMocks.layout).not.toHaveBeenCalled();
    expect(slideMocks.bom).not.toHaveBeenCalled();
  });

  it('advances later module TOC targets by every lighting-photo page', () => {
    const entries = buildModuleTocEntries(
      'PRJ',
      [{ id: 'ws-1', code: 'WS-1', name: 'Station A', type: 'line' }] as never,
      [
        {
          id: 'mod-1',
          workstation_id: 'ws-1',
          name: 'Module A',
          type: 'defect',
          lighting_photos: Array.from({ length: 5 }, (_, index) => ({ url: `photo-${index}` })),
        },
        {
          id: 'mod-2',
          workstation_id: 'ws-1',
          name: 'Module B',
          type: 'ocr',
          lighting_photos: [],
        },
      ] as never,
      [],
      10,
      false,
    );

    // No real products means no phantom product-schematic page.
    expect(entries.map(entry => entry.targetSlideNumber)).toEqual([12, 16]);
  });

  it('reserves a placeholder page for empty product records', () => {
    const entries = buildModuleTocEntries(
      'PRJ',
      [{ id: 'ws-1', code: 'WS-1', name: 'Station A', type: 'line' }] as never,
      [{ id: 'mod-1', workstation_id: 'ws-1', name: 'Module A', type: 'defect', lighting_photos: [] }] as never,
      [],
      10,
      false,
      [
	        { id: 'product-1', workstation_id: 'ws-1', scope_type: 'workstation', document_images_per_page: 2 },
        { id: 'product-2', workstation_id: 'ws-1', scope_type: 'workstation' },
      ] as never,
      [
        { id: 'media-1', asset_id: 'product-1', original_url: '1.png', file_name: '1.png', sort_order: 0 },
        { id: 'media-2', asset_id: 'product-1', original_url: '2.png', file_name: '2.png', sort_order: 1 },
        { id: 'media-3', asset_id: 'product-1', original_url: '3.png', file_name: '3.png', sort_order: 2 },
      ] as never,
    );

    expect(entries[0].targetSlideNumber).toBe(15);
  });

  it('paginates 14 hardware rows without crossing the safe bottom edge', async () => {
    const lights = Array.from({ length: 14 }, (_, index) => ({
      id: `light-${index + 1}`,
      brand: 'QA',
      model: `LIGHT-${String(index + 1).padStart(2, '0')}`,
    }));

    await generatePPTX(
      { id: 'project-hardware', code: 'PRJ', name: 'Hardware Pagination', responsible: 'Owner' } as never,
      [{ id: 'ws-1', code: 'WS-1', name: 'Station', type: 'line' }] as never,
      [{
        workstation_id: 'ws-1',
        selected_cameras: [],
        selected_lenses: [],
        selected_lights: lights,
        selected_controller: null,
      }] as never,
      [],
      { language: 'zh', quality: 'standard', mode: 'final', scope: 'full' },
      vi.fn(),
      { cameras: [], lenses: [], lights: [], controllers: [] },
      undefined,
      [],
      [],
    );

    const hardwareSlides = findSlidesByTitle('硬件清单汇总');
    expect(hardwareSlides).toHaveLength(2);
    expect(hardwareSlides.map(slide => slide.addText.mock.calls[0][0])).toEqual([
      '硬件清单汇总 (1/2)',
      '硬件清单汇总 (2/2)',
    ]);

    const tables = hardwareSlides.map(getCapturedTable);
    expect(tables.map(table => table.rows.length)).toEqual([8, 9]);
    expect([
      ...tables[0].rows.slice(1),
      ...tables[1].rows.slice(1, -1),
    ].map(tableRow => tableRow[0].text)).toEqual(
      Array.from({ length: 14 }, (_, index) => String(index + 1)),
    );
    expect(tables[0].rows.some(tableRow => tableRow[3]?.text === '总计')).toBe(false);
    expect(tables[1].rows.at(-1)?.[3].text).toBe('总计');
    expect(tables[1].rows.at(-1)?.[4].text).toBe('14台');

    tables.forEach(({ options }) => {
      const bottom = options.y + options.rowH.reduce((sum, height) => sum + height, 0);
      expect(bottom).toBeLessThanOrEqual(SLIDE_LAYOUT.contentBottom - 0.18 + 1e-9);
    });
  });

  it.each([
    { count: 15, expectedPageSizes: [8, 7] },
    { count: 28, expectedPageSizes: [14, 14] },
  ])('paginates $count revision rows with repeated headers and continuous numbering', async ({ count, expectedPageSizes }) => {
    await generatePPTX(
      {
        id: `project-revisions-${count}`,
        code: 'PRJ',
        name: 'Revision Pagination',
        responsible: 'Owner',
        revision_history: Array.from({ length: count }, (_, index) => ({
          version: `V${index + 1}`,
          date: '2026-08-22',
          author: 'Owner',
          content: `Revision ${index + 1}`,
        })),
      } as never,
      [],
      [],
      [],
      { language: 'zh', quality: 'standard', mode: 'final', scope: 'full' },
      vi.fn(),
      { cameras: [], lenses: [], lights: [], controllers: [] },
      undefined,
      [],
      [],
    );

    const revisionSlides = findSlidesByTitle('变更履历');
    expect(revisionSlides).toHaveLength(expectedPageSizes.length);
    expect(revisionSlides.map(slide => slide.addText.mock.calls[0][0])).toEqual(
      expectedPageSizes.map((_, index) => `变更履历 (${index + 1}/${expectedPageSizes.length})`),
    );

    const tables = revisionSlides.map(getCapturedTable);
    expect(tables.map(table => table.rows.length - 1)).toEqual(expectedPageSizes);
    expect(tables.every(table => table.rows[0][0].text === '编号')).toBe(true);
    expect(tables.flatMap(table => table.rows.slice(1).map(tableRow => tableRow[0].text))).toEqual(
      Array.from({ length: count }, (_, index) => String(index + 1)),
    );

    tables.forEach(({ options }) => {
      const bottom = options.y + options.rowH.reduce((sum, height) => sum + height, 0);
      expect(bottom).toBeLessThanOrEqual(SLIDE_LAYOUT.contentBottom - 0.1 + 1e-9);
    });
  });
});
