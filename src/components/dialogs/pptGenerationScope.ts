export type GenerationScope = 'full' | 'workstations' | 'modules';

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
    layouts: layouts.filter(layout => parentWsIds.has(layout.workstation_id)),
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

export function getScopeSelectionPrompt(scope: GenerationScope) {
  if (scope === 'workstations') return '请至少选择一个工位';
  if (scope === 'modules') return '请至少选择一个模块';
  return '';
}
