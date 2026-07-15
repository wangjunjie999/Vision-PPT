import { describe, expect, it } from 'vitest';
import {
  deriveScopedGenerationData,
  getScopeSelectionPrompt,
  hasRequiredScopeSelection,
} from './pptGenerationScope';

const workstations = [
  { id: 'ws-1', name: 'Station A' },
  { id: 'ws-2', name: 'Station B' },
  { id: 'ws-3', name: 'Station C' },
];

const modules = [
  { id: 'module-1', workstation_id: 'ws-1', name: 'Module A' },
  { id: 'module-2', workstation_id: 'ws-1', name: 'Module B' },
  { id: 'module-3', workstation_id: 'ws-2', name: 'Module C' },
  { id: 'module-4', workstation_id: 'ws-3', name: 'Module D' },
];

const layouts = [
  { id: 'layout-1', workstation_id: 'ws-1' },
  { id: 'layout-2', workstation_id: 'ws-2' },
  { id: 'layout-3', workstation_id: 'ws-3' },
];

describe('PPTGenerationDialog scope derivation', () => {
  it('keeps the full project when scope is full', () => {
    const scoped = deriveScopedGenerationData({
      scope: 'full',
      projectWorkstations: workstations,
      projectModules: modules,
      layouts,
      selectedWorkstationIds: [],
      selectedModuleIds: [],
    });

    expect(scoped.workstations.map(ws => ws.id)).toEqual(['ws-1', 'ws-2', 'ws-3']);
    expect(scoped.modules.map(mod => mod.id)).toEqual(['module-1', 'module-2', 'module-3', 'module-4']);
    expect(scoped.layouts.map(layout => layout.id)).toEqual(['layout-1', 'layout-2', 'layout-3']);
    expect(hasRequiredScopeSelection('full', scoped)).toBe(true);
  });

  it('filters modules and layouts to selected workstations', () => {
    const scoped = deriveScopedGenerationData({
      scope: 'workstations',
      projectWorkstations: workstations,
      projectModules: modules,
      layouts,
      selectedWorkstationIds: ['ws-1', 'ws-3'],
      selectedModuleIds: [],
    });

    expect(scoped.workstations.map(ws => ws.id)).toEqual(['ws-1', 'ws-3']);
    expect(scoped.modules.map(mod => mod.id)).toEqual(['module-1', 'module-2', 'module-4']);
    expect(scoped.layouts.map(layout => layout.id)).toEqual(['layout-1', 'layout-3']);
    expect(hasRequiredScopeSelection('workstations', scoped)).toBe(true);
  });

  it('keeps only selected modules while carrying parent workstation context', () => {
    const scoped = deriveScopedGenerationData({
      scope: 'modules',
      projectWorkstations: workstations,
      projectModules: modules,
      layouts,
      selectedWorkstationIds: [],
      selectedModuleIds: ['module-2', 'module-3'],
    });

    expect(scoped.workstations.map(ws => ws.id)).toEqual(['ws-1', 'ws-2']);
    expect(scoped.modules.map(mod => mod.id)).toEqual(['module-2', 'module-3']);
    expect(scoped.layouts.map(layout => layout.id)).toEqual(['layout-1', 'layout-2']);
    expect(hasRequiredScopeSelection('modules', scoped)).toBe(true);
  });

  it('reports missing selection prompts for empty workstation and module scopes', () => {
    const emptyWorkstations = deriveScopedGenerationData({
      scope: 'workstations',
      projectWorkstations: workstations,
      projectModules: modules,
      layouts,
      selectedWorkstationIds: [],
      selectedModuleIds: [],
    });
    const emptyModules = deriveScopedGenerationData({
      scope: 'modules',
      projectWorkstations: workstations,
      projectModules: modules,
      layouts,
      selectedWorkstationIds: [],
      selectedModuleIds: [],
    });

    expect(hasRequiredScopeSelection('workstations', emptyWorkstations)).toBe(false);
    expect(hasRequiredScopeSelection('modules', emptyModules)).toBe(false);
    expect(getScopeSelectionPrompt('workstations')).toBe('请至少选择一个工位');
    expect(getScopeSelectionPrompt('modules')).toBe('请至少选择一个模块');
  });
});
