import type { GenerationScope } from '@/types/generation';
import {
  buildProductMediaItems,
  hasProductVisualMedia,
  type ProductAnnotationMedia,
  type ProductMediaRecord,
} from '@/utils/productAssetMedia';

export type { GenerationScope } from '@/types/generation';

type ScopedWorkstation = {
  id: string;
};

type ScopedModule = {
  id: string;
  workstation_id: string;
};

type ScopedLayout = {
  workstation_id: string;
};

type ScopedAsset = {
  id: string;
  scope_type?: string | null;
  workstation_id?: string | null;
  module_id?: string | null;
};

type ScopedAnnotation = {
  asset_id?: string | null;
  scope_type?: string | null;
  workstation_id?: string | null;
  module_id?: string | null;
};

type ScopedProductMedia = ProductMediaRecord;

export function deriveScopedGenerationData<
  TWorkstation extends ScopedWorkstation,
  TModule extends ScopedModule,
  TLayout extends ScopedLayout,
>({
  scope,
  projectWorkstations,
  projectModules,
  layouts,
  selectedWorkstationIds,
  selectedModuleIds,
}: {
  scope: GenerationScope;
  projectWorkstations: TWorkstation[];
  projectModules: TModule[];
  layouts: TLayout[];
  selectedWorkstationIds: string[];
  selectedModuleIds: string[];
}) {
  if (scope === 'full') {
    const workstationIds = new Set(projectWorkstations.map(ws => ws.id));
    return {
      workstations: projectWorkstations,
      modules: projectModules,
      layouts: layouts.filter(layout => workstationIds.has(layout.workstation_id)),
    };
  }

  if (scope === 'workstations') {
    const selectedWsIds = new Set(selectedWorkstationIds);
    const workstations = projectWorkstations.filter(ws => selectedWsIds.has(ws.id));
    const scopedWsIds = new Set(workstations.map(ws => ws.id));
    return {
      workstations,
      modules: projectModules.filter(mod => scopedWsIds.has(mod.workstation_id)),
      layouts: layouts.filter(layout => scopedWsIds.has(layout.workstation_id)),
    };
  }

  const selectedModIds = new Set(selectedModuleIds);
  const modules = projectModules.filter(mod => selectedModIds.has(mod.id));
  const parentWsIds = new Set(modules.map(mod => mod.workstation_id));
  return {
    workstations: projectWorkstations.filter(ws => parentWsIds.has(ws.id)),
    modules,
    // Parent workstations are naming/ownership context only in module scope.
    layouts: [],
  };
}

export function hasRequiredScopeSelection(
  scope: GenerationScope,
  scoped: { workstations: unknown[]; modules: unknown[] },
) {
  return scope === 'full'
    || (scope === 'workstations' && scoped.workstations.length > 0)
    || (scope === 'modules' && scoped.modules.length > 0);
}

export function deriveScopedMedia<
  TAsset extends ScopedAsset,
  TAnnotation extends ScopedAnnotation,
  TMedia extends ScopedProductMedia,
>({
  scope,
  scoped,
  productAssets,
  annotations,
  productMedia = [],
}: {
  scope: GenerationScope;
  scoped: { workstations: ScopedWorkstation[]; modules: ScopedModule[] };
  productAssets: TAsset[];
  annotations: TAnnotation[];
  productMedia?: TMedia[];
}) {
  const workstationIds = new Set(scoped.workstations.map(workstation => workstation.id));
  const moduleIds = new Set(scoped.modules.map(module => module.id));
  const assets = productAssets.filter(asset => {
    if (scope === 'modules') {
      return asset.scope_type === 'module'
        && Boolean(asset.module_id && moduleIds.has(asset.module_id));
    }
    if (asset.scope_type === 'module') {
      return Boolean(asset.module_id && moduleIds.has(asset.module_id));
    }
    return Boolean(asset.workstation_id && workstationIds.has(asset.workstation_id));
  });
  const assetIds = new Set(assets.map(asset => asset.id));
  const scopedAnnotations = annotations.filter(annotation => {
    if (annotation.asset_id) return assetIds.has(annotation.asset_id);
    if (scope === 'modules') {
      return annotation.scope_type === 'module'
        && Boolean(annotation.module_id && moduleIds.has(annotation.module_id));
    }
    if (annotation.scope_type === 'module') {
      return Boolean(annotation.module_id && moduleIds.has(annotation.module_id));
    }
    return Boolean(annotation.workstation_id && workstationIds.has(annotation.workstation_id));
  });

  const scopedProductMedia = productMedia.filter(media => assetIds.has(media.asset_id));
  return { productAssets: assets, annotations: scopedAnnotations, productMedia: scopedProductMedia };
}

export function getAssetsMissingProductMedia<
  TAsset extends ScopedAsset & { preview_images?: unknown },
  TAnnotation extends ScopedAnnotation & ProductAnnotationMedia,
  TMedia extends ProductMediaRecord,
>(
  assets: readonly TAsset[],
  annotations: readonly TAnnotation[],
  productMedia?: readonly TMedia[],
): TAsset[] {
  return assets.filter(asset => productMedia
    ? buildProductMediaItems(asset.id, productMedia, annotations, asset.preview_images).length === 0
    : !hasProductVisualMedia(asset.id, annotations, asset.preview_images)
  );
}

export function getScopeSelectionPrompt(scope: GenerationScope) {
  if (scope === 'workstations') return '请至少选择一个工位';
  if (scope === 'modules') return '请至少选择一个模块';
  return '';
}
