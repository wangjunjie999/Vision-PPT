import { describe, expect, it } from 'vitest';
import { buildTemplateSlidePlan } from './templateGenerationScope';

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
});
