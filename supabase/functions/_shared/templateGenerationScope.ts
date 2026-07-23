export type TemplateGenerationScope = 'full' | 'workstations' | 'modules';

export interface TemplateModuleData extends Record<string, unknown> {
  id?: string;
  workstation_id?: string;
}

export interface TemplateWorkstationData extends Record<string, unknown> {
  id?: string;
  modules?: TemplateModuleData[];
  product_assets?: Array<Record<string, unknown>>;
}

export interface TemplateGenerationData extends Record<string, unknown> {
  workstations?: TemplateWorkstationData[];
  modules?: TemplateModuleData[];
  language?: 'zh' | 'en';
}

export interface TemplateSlideMapping {
  templateSlideIndex: number | string;
  slideType: string;
  enabled?: boolean;
}

export interface TemplateStructureMeta {
  layoutMapping?: {
    mappings?: TemplateSlideMapping[];
    duplicateForEachWorkstation?: boolean;
    preserveUnmappedSlides?: boolean;
  };
}

export interface TemplatePlanOptions {
  scope?: TemplateGenerationScope;
  duplicateWorkstationSlides?: boolean;
}

export interface TemplateGenerationContext extends Record<string, unknown> {
  workstations: TemplateWorkstationData[];
  workstation?: TemplateWorkstationData;
  workstationIndex: number;
  modules: TemplateModuleData[];
  module?: TemplateModuleData;
  moduleIndex: number;
  productAssets: Array<Record<string, unknown>>;
  productAsset?: Record<string, unknown>;
  productIndex: number;
  productMediaPage: Array<Record<string, unknown>>;
  productPageIndex: number;
  productPageCount: number;
  productImagesPerPage: 1 | 2;
  effectiveProductCount: number;
}

export interface TemplateSlidePlanItem {
  sourceIndex: number;
  slideType: string;
  context: TemplateGenerationContext;
}

export const MODULE_SCOPED_SLIDE_TYPES = new Set([
  'motion_method',
  'optical_solution',
  'vision_list',
]);

export function buildTemplateContext(
  data: TemplateGenerationData,
  workstation?: TemplateWorkstationData,
  workstationIndex = 0,
  module?: TemplateModuleData,
  moduleIndex = 0,
  productAsset?: Record<string, unknown>,
  productIndex = 0,
  productMediaPage: Array<Record<string, unknown>> = [],
  productPageIndex = 0,
  productPageCount = 0,
  effectiveProductCount = 0,
  productImagesPerPage: 1 | 2 = 1,
): TemplateGenerationContext {
  const modules = module
    ? [module]
    : workstation?.modules
      || data.modules?.filter(item => item.workstation_id === workstation?.id)
      || [];

  const productAssets = workstation?.product_assets || [];
  const activeProductAsset = productAsset
    || module?.product_asset as Record<string, unknown> | undefined
    || workstation?.product_asset as Record<string, unknown> | undefined
    || productAssets[0];

  return {
    project: data.project || {},
    workstations: data.workstations || [],
    workstation,
    workstationIndex,
    modules,
    module: module || modules[0],
    moduleIndex,
    productAssets,
    productAsset: activeProductAsset,
    productIndex,
    productMediaPage,
    productPageIndex,
    productPageCount,
    productImagesPerPage,
    effectiveProductCount,
    layout: workstation?.layout || null,
    hardware: data.hardware || {},
    productAnnotation: activeProductAsset?.product_annotation
      || module?.product_annotation
      || workstation?.product_annotation
      || null,
    language: data.language || 'zh',
    generatedAt: new Date(),
  };
}

export function buildTemplateSlidePlan(
  sourceSlides: string[],
  data: TemplateGenerationData,
  structureMeta: TemplateStructureMeta,
  options: TemplatePlanOptions,
): TemplateSlidePlanItem[] {
  const layoutMapping = structureMeta.layoutMapping || {};
  const mappings = Array.isArray(layoutMapping.mappings)
    ? layoutMapping.mappings.filter(mapping => mapping.enabled !== false)
    : [];
  const duplicate = options.duplicateWorkstationSlides
    ?? layoutMapping.duplicateForEachWorkstation
    ?? true;
  const preserveUnmapped = layoutMapping.preserveUnmappedSlides !== false;
  const mappedByIndex = new Map<number, TemplateSlideMapping>();
  mappings.forEach(mapping => mappedByIndex.set(Number(mapping.templateSlideIndex), mapping));

  const workstations = Array.isArray(data.workstations) ? data.workstations : [];
  const modules = Array.isArray(data.modules) ? data.modules : [];
  const scope = options.scope || 'full';
  const plan: TemplateSlidePlanItem[] = [];

  for (let sourceIndex = 0; sourceIndex < sourceSlides.length; sourceIndex++) {
    const mapping = mappedByIndex.get(sourceIndex);

    if (scope === 'modules') {
      if (mapping && MODULE_SCOPED_SLIDE_TYPES.has(mapping.slideType)) {
        modules.forEach((module, moduleIndex) => {
          const workstationIndex = workstations.findIndex(ws => ws.id === module.workstation_id);
          const workstation = workstationIndex >= 0 ? workstations[workstationIndex] : undefined;
          plan.push({
            sourceIndex,
            slideType: mapping.slideType,
            context: buildTemplateContext(data, workstation, Math.max(workstationIndex, 0), module, moduleIndex),
          });
        });
        continue;
      }

      if (mapping) continue;
      if (preserveUnmapped || mappings.length === 0) {
        plan.push({
          sourceIndex,
          slideType: 'unmapped',
          context: buildTemplateContext(data),
        });
      }
      continue;
    }

    if (mapping && duplicate && workstations.length > 0) {
      workstations.forEach((workstation, workstationIndex) => {
        const products = workstation.product_assets || [];
        if (mapping.slideType === 'product_schematic') {
          const populatedProducts = products
            .map(product => ({
              product,
              media: Array.isArray(product.product_media)
                ? [...product.product_media].sort((left: any, right: any) =>
                  Number(left?.sort_order || 0) - Number(right?.sort_order || 0)
                )
                : [],
            }))
            .filter(entry => entry.media.length > 0);
          populatedProducts.forEach((entry, productIndex) => {
            const imagesPerPage = resolveTemplateProductImagesPerPage(entry.product);
            const pageCount = Math.ceil(entry.media.length / imagesPerPage);
            for (let productPageIndex = 0; productPageIndex < pageCount; productPageIndex += 1) {
              plan.push({
                sourceIndex,
                slideType: mapping.slideType,
                context: buildTemplateContext(
                  data,
                  workstation,
                  workstationIndex,
                  undefined,
                  0,
                  entry.product,
                  productIndex,
                  entry.media.slice(
                    productPageIndex * imagesPerPage,
                    productPageIndex * imagesPerPage + imagesPerPage,
                  ),
                  productPageIndex,
                  pageCount,
                  populatedProducts.length,
                  imagesPerPage,
                ),
              });
            }
          });
        } else {
          plan.push({
            sourceIndex,
            slideType: mapping.slideType,
            context: buildTemplateContext(data, workstation, workstationIndex),
          });
        }
      });
      continue;
    }

    if (mapping && !duplicate) {
      plan.push({
        sourceIndex,
        slideType: mapping.slideType,
        context: buildTemplateContext(data, workstations[0], 0),
      });
      continue;
    }

    if (preserveUnmapped || mappings.length === 0) {
      plan.push({
        sourceIndex,
        slideType: 'unmapped',
        context: buildTemplateContext(data),
      });
    }
  }

  return plan.length > 0 ? plan : sourceSlides.map((_, sourceIndex) => ({
    sourceIndex,
    slideType: 'template',
    context: buildTemplateContext(data),
  }));
}

export function resolveTemplateProductImagesPerPage(
  product: Record<string, unknown> | null | undefined,
): 1 | 2 {
  return Number(product?.document_images_per_page) === 2 ? 2 : 1;
}
