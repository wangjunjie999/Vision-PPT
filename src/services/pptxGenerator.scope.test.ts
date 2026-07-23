import { beforeEach, describe, expect, it, vi } from 'vitest';

const slideMocks = vi.hoisted(() => ({
  basic: vi.fn(),
  product: vi.fn(),
  layout: vi.fn(),
  module: vi.fn(),
  lighting: vi.fn(),
  bom: vi.fn(),
}));

vi.mock('./pptx/workstationSlides', () => ({
  generateBasicInfoAndRequirementsSlide: slideMocks.basic,
  generateProductSchematicSlide: slideMocks.product,
  generateLayoutAndOpticalSlide: slideMocks.layout,
  generateModuleOpticalSlide: slideMocks.module,
  generateLightingPhotosSlide: slideMocks.lighting,
  getLightingPhotoSlideCount: (photoCount: number) => Math.ceil(Math.max(0, photoCount) / 2),
  getBOMSlideCount: () => 1,
  generateBOMSlide: slideMocks.bom,
}));
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
    addSlide = vi.fn(() => ({ addText: vi.fn(), addImage: vi.fn(), addShape: vi.fn(), addTable: vi.fn() }));
    write = vi.fn(async () => new Blob(['pptx']));
  },
}));

import { buildModuleTocEntries, generatePPTX } from './pptxGenerator';

describe('enterprise PPT module scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('skips empty product records and reserves pages from media chunks only', () => {
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

    expect(entries[0].targetSlideNumber).toBe(14);
  });
});
