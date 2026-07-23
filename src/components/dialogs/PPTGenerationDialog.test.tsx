import { describe, expect, it } from 'vitest';
import {
  deriveScopedGenerationData,
  deriveScopedMedia,
  getAssetsMissingProductMedia,
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
    expect(scoped.layouts).toEqual([]);
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

  it('ignores stale workstation and module ids', () => {
    const scopedWorkstations = deriveScopedGenerationData({
      scope: 'workstations',
      projectWorkstations: workstations,
      projectModules: modules,
      layouts,
      selectedWorkstationIds: ['missing-ws', 'ws-2'],
      selectedModuleIds: [],
    });
    const scopedModules = deriveScopedGenerationData({
      scope: 'modules',
      projectWorkstations: workstations,
      projectModules: modules,
      layouts,
      selectedWorkstationIds: [],
      selectedModuleIds: ['missing-module', 'module-4'],
    });

    expect(scopedWorkstations.workstations.map(item => item.id)).toEqual(['ws-2']);
    expect(scopedWorkstations.modules.map(item => item.id)).toEqual(['module-3']);
    expect(scopedModules.workstations.map(item => item.id)).toEqual(['ws-3']);
    expect(scopedModules.modules.map(item => item.id)).toEqual(['module-4']);
  });

  it('excludes parent workstation media when only modules are exported', () => {
    const scoped = deriveScopedGenerationData({
      scope: 'modules',
      projectWorkstations: workstations,
      projectModules: modules,
      layouts,
      selectedWorkstationIds: [],
      selectedModuleIds: ['module-2', 'module-3'],
    });
    const productAssets = [
      { id: 'asset-ws-1', scope_type: 'workstation', workstation_id: 'ws-1' },
      { id: 'asset-mod-1', scope_type: 'module', module_id: 'module-1' },
      { id: 'asset-mod-2', scope_type: 'module', module_id: 'module-2' },
      { id: 'asset-mod-3', scope_type: 'module', module_id: 'module-3' },
    ];
    const annotations = [
      { id: 'annotation-ws-1', asset_id: 'asset-ws-1', scope_type: 'workstation', workstation_id: 'ws-1' },
      { id: 'annotation-mod-1', asset_id: 'asset-mod-1', scope_type: 'module', module_id: 'module-1' },
      { id: 'annotation-mod-2', asset_id: 'asset-mod-2', scope_type: 'module', module_id: 'module-2' },
      { id: 'annotation-mod-3', asset_id: 'asset-mod-3', scope_type: 'module', module_id: 'module-3' },
    ];

    const media = deriveScopedMedia({ scope: 'modules', scoped, productAssets, annotations });

    expect(media.productAssets.map(item => item.id)).toEqual(['asset-mod-2', 'asset-mod-3']);
    expect(media.annotations.map(item => item.id)).toEqual(['annotation-mod-2', 'annotation-mod-3']);
  });

  it('does not admit an annotation from another product in the same workstation', () => {
    const assets = [
      { id: 'product-1', scope_type: 'workstation', workstation_id: 'ws-1', preview_images: ['p1.png'] },
      { id: 'product-2', scope_type: 'workstation', workstation_id: 'ws-1', preview_images: [] },
    ];
    const annotations = [
      { id: 'annotation-1', asset_id: 'product-1', scope_type: 'workstation', workstation_id: 'ws-1', snapshot_url: 'p1-annotation.png' },
      { id: 'annotation-outside', asset_id: 'outside-product', scope_type: 'workstation', workstation_id: 'ws-1', snapshot_url: 'outside.png' },
    ];
    const scoped = { workstations: [workstations[0]], modules: [] };
    const media = deriveScopedMedia({ scope: 'workstations', scoped, productAssets: assets, annotations });

    expect(media.annotations.map(item => item.id)).toEqual(['annotation-1']);
    expect(getAssetsMissingProductMedia(media.productAssets, media.annotations).map(item => item.id)).toEqual(['product-2']);
  });
});
