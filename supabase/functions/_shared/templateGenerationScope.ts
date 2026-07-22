export type TemplateGenerationScope = 'full' | 'workstations' | 'modules';

export interface TemplateModuleData extends Record<string, unknown> {
  id?: string;
  workstation_id?: string;
}

export interface TemplateWorkstationData extends Record<string, unknown> {
  id?: string;
  modules?: TemplateModuleData[];
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
): TemplateGenerationContext {
  const modules = module
    ? [module]
    : workstation?.modules
      || data.modules?.filter(item => item.workstation_id === workstation?.id)
      || [];

  return {
    project: data.project || {},
    workstations: data.workstations || [],
    workstation,
    workstationIndex,
    modules,
    module: module || modules[0],
    moduleIndex,
    layout: workstation?.layout || null,
    hardware: data.hardware || {},
    productAsset: module?.product_asset || workstation?.product_asset || null,
    productAnnotation: module?.product_annotation || workstation?.product_annotation || null,
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
        plan.push({
          sourceIndex,
          slideType: mapping.slideType,
          context: buildTemplateContext(data, workstation, workstationIndex),
        });
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
