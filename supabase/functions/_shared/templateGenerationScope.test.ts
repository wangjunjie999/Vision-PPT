import { describe, expect, it } from 'vitest';
import {
  buildTemplateSlidePlan,
  hasEnabledProductSchematicMapping,
} from './templateGenerationScope';

const sourceSlides = ['cover', 'station', 'optics', 'vision', 'closing'];
const structureMeta = {
  layoutMapping: {
    mappings: [
      { templateSlideIndex: 1, slideType: 'basic_info', enabled: true },
      { templateSlideIndex: 2, slideType: 'optical_solution', enabled: true },
      { templateSlideIndex: 3, slideType: 'vision_list', enabled: true },
    ],
    duplicateForEachWorkstation: true,
    preserveUnmappedSlides: true,
  },
};
const workstations = [
  { id: 'ws-1', name: 'Station A' },
  { id: 'ws-2', name: 'Station B' },
];
const modules = [
  { id: 'mod-1', workstation_id: 'ws-1', name: 'Module A' },
  { id: 'mod-2', workstation_id: 'ws-1', name: 'Module B' },
  { id: 'mod-3', workstation_id: 'ws-2', name: 'Module C' },
];

describe('uploaded template scope plan', () => {
  it('treats legacy product mappings without an enabled flag as enabled', () => {
    expect(hasEnabledProductSchematicMapping({
      layoutMapping: {
        mappings: [{ templateSlideIndex: 1, slideType: 'product_schematic' }],
      },
    })).toBe(true);
    expect(hasEnabledProductSchematicMapping({
      layoutMapping: {
        mappings: [{ templateSlideIndex: 1, slideType: 'product_schematic', enabled: false }],
      },
    })).toBe(false);
  });

  it('keeps global slides once and maps module slides to the current module', () => {
    const plan = buildTemplateSlidePlan(
      sourceSlides,
      { project: { id: 'project-1' }, workstations, modules },
      structureMeta,
      { scope: 'modules' },
    );

    expect(plan.filter(item => item.slideType === 'unmapped').map(item => item.sourceIndex)).toEqual([0, 4]);
    expect(plan.some(item => item.slideType === 'basic_info')).toBe(false);

    const optics = plan.filter(item => item.slideType === 'optical_solution');
    const vision = plan.filter(item => item.slideType === 'vision_list');
    expect(optics.map(item => item.context.module?.id)).toEqual(['mod-1', 'mod-2', 'mod-3']);
    expect(vision.map(item => item.context.module?.id)).toEqual(['mod-1', 'mod-2', 'mod-3']);
    expect(optics[1].context.modules.map(module => module.id)).toEqual(['mod-2']);
    expect(optics[1].context.workstation?.id).toBe('ws-1');
  });

  it('duplicates mapped station slides only for the filtered workstation data', () => {
    const plan = buildTemplateSlidePlan(
      sourceSlides,
      { project: { id: 'project-1' }, workstations: [workstations[1]], modules: [modules[2]] },
      structureMeta,
      { scope: 'workstations' },
    );

    const mapped = plan.filter(item => item.slideType !== 'unmapped');
    expect(mapped).toHaveLength(3);
    expect(mapped.every(item => item.context.workstation?.id === 'ws-2')).toBe(true);
    expect(mapped.every(item => item.context.modules.map(module => module.id).join(',') === 'mod-3')).toBe(true);
  });

  it('emits no module-mapped slides for an empty module selection', () => {
    const plan = buildTemplateSlidePlan(
      sourceSlides,
      { project: { id: 'project-1' }, workstations, modules: [] },
      structureMeta,
      { scope: 'modules' },
    );

    expect(plan.map(item => item.sourceIndex)).toEqual([0, 4]);
  });

  it('expands product schematic mappings per product and keeps an empty placeholder page', () => {
    const plan = buildTemplateSlidePlan(
      ['cover', 'product', 'closing'],
      {
        project: { id: 'project-1' },
        workstations: [{
          id: 'ws-1',
          product_assets: [
            {
              id: 'product-1',
              document_images_per_page: 2,
              product_media: [
                { id: 'm1', sort_order: 0 },
                { id: 'm2', sort_order: 1 },
                { id: 'm3', sort_order: 2 },
              ],
            },
            { id: 'product-2', product_media: [] },
          ],
        }],
        modules: [],
      },
      {
        layoutMapping: {
          mappings: [{ templateSlideIndex: 1, slideType: 'product_schematic', enabled: true }],
          duplicateForEachWorkstation: false,
          preserveUnmappedSlides: true,
        },
      },
      { scope: 'workstations' },
    );

    const products = plan.filter(item => item.slideType === 'product_schematic');
    expect(products).toHaveLength(3);
    expect(products.map(item => item.context.productAsset?.id)).toEqual(['product-1', 'product-1', 'product-2']);
    expect(products.map(item => item.context.productIndex)).toEqual([0, 0, 1]);
    expect(products.map(item => item.context.productMediaPage.length)).toEqual([2, 1, 0]);
    expect(products.map(item => item.context.productPageIndex)).toEqual([0, 1, 0]);
    expect(products.every(item => item.context.effectiveProductCount === 2)).toBe(true);
    expect(products.map(item => item.context.productImagesPerPage)).toEqual([2, 2, 1]);
  });

  it('uses each product pagination mode independently and defaults to one image per page', () => {
    const plan = buildTemplateSlidePlan(
      ['product'],
      {
        workstations: [{
          id: 'ws-1',
          product_assets: [
            {
              id: 'product-a',
              product_media: [
                { id: 'a1', sort_order: 0 },
                { id: 'a2', sort_order: 1 },
                { id: 'a3', sort_order: 2 },
              ],
            },
            {
              id: 'product-b',
              document_images_per_page: 2,
              product_media: [
                { id: 'b1', sort_order: 0 },
                { id: 'b2', sort_order: 1 },
                { id: 'b3', sort_order: 2 },
              ],
            },
          ],
        }],
      },
      {
        layoutMapping: {
          mappings: [{ templateSlideIndex: 0, slideType: 'product_schematic', enabled: true }],
          duplicateForEachWorkstation: true,
        },
      },
      { scope: 'workstations' },
    );

    const productPages = plan.filter(item => item.slideType === 'product_schematic');
    expect(productPages.filter(item => item.context.productAsset?.id === 'product-a')).toHaveLength(3);
    expect(productPages.filter(item => item.context.productAsset?.id === 'product-b')).toHaveLength(2);
    expect(productPages.filter(item => item.context.productAsset?.id === 'product-a')
      .every(item => item.context.productImagesPerPage === 1)).toBe(true);
    expect(productPages.filter(item => item.context.productAsset?.id === 'product-b')
      .every(item => item.context.productImagesPerPage === 2)).toBe(true);
  });
});
