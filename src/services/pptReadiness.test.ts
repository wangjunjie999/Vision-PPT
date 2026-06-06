import { describe, expect, it } from 'vitest';
import { createSchematicImageSignature } from '@/utils/schematicImageSignature';
import { checkPPTReadiness } from './pptReadiness';

const baseProject = {
  id: 'project-1',
  code: 'P001',
  name: 'project',
  customer: 'customer',
  responsible: 'owner',
  date: '2026-05-27',
};

const baseWorkstation = {
  id: 'workstation-1',
  project_id: 'project-1',
  name: 'workstation 1',
};

const baseLayout = {
  id: 'layout-1',
  workstation_id: 'workstation-1',
  primary_view: 'front',
  auxiliary_view: 'side',
  front_view_image_url: 'front.png',
  side_view_image_url: 'side.png',
  selected_cameras: [{ id: 'camera-1' }],
  selected_lenses: [{ id: 'lens-1' }],
  selected_lights: [{ id: 'light-1' }],
};

const completeThreeDConfig = {
  model: 'LJ-S080',
  detectionMethod: '3D相机垂直固定',
  referenceDistance: '160',
  xyPrecision: '0.025',
};

function readinessForModule(module: Record<string, unknown>) {
  return checkPPTReadiness({
    projects: [baseProject] as any,
    workstations: [baseWorkstation] as any,
    layouts: [baseLayout] as any,
    modules: [{
      id: 'module-1',
      workstation_id: 'workstation-1',
      name: 'module',
      type: 'defect',
      selected_camera: 'camera-1',
      selected_lens: 'lens-1',
      selected_light: 'light-1',
      processing_time_limit: 200,
      schematic_image_url: 'schematic.png',
      ...module,
    }] as any,
    selectedProjectId: 'project-1',
  });
}

function imagingWarnings(module: Record<string, unknown>) {
  return readinessForModule(module).warnings;
}

function currentSaved3DSignature() {
  return createSchematicImageSignature({
    cameraId: 'camera-1',
    lensId: 'legacy-lens',
    lightId: 'legacy-light',
    controllerId: 'controller-1',
    camera: { x: 275, y: 77 },
    light: { x: 275, y: 231 },
    product: { x: 275, y: 420 },
    cameraRotation: 0,
    lightRotation: 0,
    fovAngle: 45,
    lightDistance: 335,
    workingDistanceMm: 300,
    fovWidthMm: 100,
    is3DCamera: true,
    threeDConfig: completeThreeDConfig,
    distanceUnit: 'mm',
  });
}

function currentSaved2DSignature() {
  return createSchematicImageSignature({
    cameraId: 'camera-1',
    lensId: 'lens-1',
    lightId: 'light-1',
    controllerId: 'controller-1',
    camera: { x: 275, y: 77 },
    light: { x: 275, y: 231 },
    product: { x: 275, y: 420 },
    cameraRotation: 0,
    lightRotation: 0,
    fovAngle: 45,
    lightDistance: 180,
    workingDistanceMm: 300,
    fovWidthMm: 100,
    diagramLightDistanceMm: 180,
    lightDistanceHorizontalMm: 0,
    lightDistanceVerticalMm: 180,
    lightCount: 1,
    lightItems: [{
      id: 'light-item-1',
      hardwareId: 'light-1',
      position: { x: 275, y: 231 },
      rotation: 0,
      distanceMm: 180,
      horizontalMm: 0,
      verticalMm: 180,
      angle: '45',
    }],
    is3DCamera: false,
    distanceUnit: 'mm',
  });
}

function complete2DModule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'module-1',
    workstation_id: 'workstation-1',
    name: 'module',
    type: 'defect',
    selected_camera: 'camera-1',
    selected_lens: 'lens-1',
    selected_light: 'light-1',
    selected_controller: 'controller-1',
    processing_time_limit: 200,
    schematic_image_url: 'schematic.png',
    schematic_layout: { savedImageSignature: currentSaved2DSignature() },
    defect_config: {
      imaging: {
        fieldOfView: '200x150',
        workingDistance: '430',
        resolutionPerPixel: '0.0500',
      },
    },
    ...overrides,
  };
}

describe('pptReadiness imaging parameters', () => {
  it('accepts imaging parameters saved under nested config.imaging', () => {
    const warnings = imagingWarnings({
      defect_config: {
        imaging: {
          fieldOfView: '200x150',
          workingDistance: '430',
          resolutionPerPixel: '0.0500',
        },
      },
    });

    expect(warnings).toHaveLength(0);
  });

  it('keeps accepting legacy top-level imaging fields', () => {
    const warnings = imagingWarnings({
      positioning_config: {
        fieldOfView: '200x150',
        workingDistance: '430',
        resolutionPerPixel: '0.0500',
      },
    });

    expect(warnings).toHaveLength(0);
  });

  it('still warns when saved imaging parameters are incomplete', () => {
    const warnings = imagingWarnings({
      defect_config: {
        imaging: {
          workingDistance: '430',
        },
      },
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].warning).toContain('FOV');
  });

  it('does not require lens or light hardware for 3D projects', () => {
    const result = checkPPTReadiness({
      projects: [{ ...baseProject, use_3d: true }] as any,
      workstations: [baseWorkstation] as any,
      layouts: [{
        ...baseLayout,
        selected_lenses: [],
        selected_lights: [],
      }] as any,
      modules: [{
        id: 'module-1',
        workstation_id: 'workstation-1',
        name: 'module',
        type: 'defect',
        selected_camera: 'camera-1',
        selected_lens: null,
        selected_light: null,
        selected_controller: 'controller-1',
        processing_time_limit: 200,
        schematic_image_url: 'schematic.png',
        schematic_layout: { savedImageSignature: currentSaved3DSignature() },
        defect_config: {
          imaging: {
            is3DCamera: true,
            fieldOfView: '200x150',
            workingDistance: '430',
            resolutionPerPixel: '0.0500',
            lightItems: [],
          },
          three_d: completeThreeDConfig,
        },
      }] as any,
      selectedProjectId: 'project-1',
      mode: 'final',
    });

    expect(result.missing).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.finalReady).toBe(true);
  });

  it('treats an explicit module 2D flag as higher priority than project use_3d', () => {
    const result = checkPPTReadiness({
      projects: [{ ...baseProject, use_3d: true }] as any,
      workstations: [baseWorkstation] as any,
      layouts: [{
        ...baseLayout,
        selected_lenses: [],
        selected_lights: [],
      }] as any,
      modules: [{
        id: 'module-1',
        workstation_id: 'workstation-1',
        name: 'module',
        type: 'defect',
        selected_camera: 'camera-1',
        selected_lens: null,
        selected_light: null,
        processing_time_limit: 200,
        schematic_image_url: 'schematic.png',
        schematic_layout: { savedImageSignature: currentSaved3DSignature() },
        defect_config: {
          imaging: {
            is3DCamera: false,
            fieldOfView: '200x150',
            workingDistance: '430',
            resolutionPerPixel: '0.0500',
          },
        },
      }] as any,
      selectedProjectId: 'project-1',
      mode: 'final',
    });

    expect(result.finalReady).toBe(false);
    expect(result.missing.length + result.warnings.length).toBeGreaterThan(0);
  });

  it('checks only selected workstations for scoped workstation generation', () => {
    const skippedWorkstation = {
      ...baseWorkstation,
      id: 'workstation-2',
      name: 'unselected bad workstation',
    };
    const skippedModule = {
      ...complete2DModule({
        id: 'module-2',
        workstation_id: 'workstation-2',
        name: 'unselected bad module',
      }),
      selected_camera: null,
      schematic_image_url: null,
      schematic_layout: null,
      defect_config: {},
    };

    const result = checkPPTReadiness({
      projects: [baseProject] as any,
      workstations: [baseWorkstation, skippedWorkstation] as any,
      layouts: [baseLayout] as any,
      modules: [complete2DModule(), skippedModule] as any,
      selectedProjectId: 'project-1',
      mode: 'final',
      scope: 'workstations',
      selectedWorkstationIds: ['workstation-1'],
    });

    expect(result.finalReady).toBe(true);
    expect(result.stats.workstationCount).toBe(1);
    expect(result.stats.moduleCount).toBe(1);
    expect(result.missing).toHaveLength(0);
  });

  it('checks only selected modules and does not require workstation layout in module scope', () => {
    const result = checkPPTReadiness({
      projects: [baseProject] as any,
      workstations: [baseWorkstation] as any,
      layouts: [] as any,
      modules: [complete2DModule()] as any,
      selectedProjectId: 'project-1',
      mode: 'final',
      scope: 'modules',
      selectedModuleIds: ['module-1'],
    });

    expect(result.finalReady).toBe(true);
    expect(result.stats.workstationCount).toBe(1);
    expect(result.stats.moduleCount).toBe(1);
    expect(result.missing).toHaveLength(0);
  });

  it('blocks module scoped generation when no module is selected', () => {
    const result = checkPPTReadiness({
      projects: [baseProject] as any,
      workstations: [baseWorkstation] as any,
      layouts: [baseLayout] as any,
      modules: [complete2DModule()] as any,
      selectedProjectId: 'project-1',
      scope: 'modules',
      selectedModuleIds: [],
    });

    expect(result.draftReady).toBe(false);
    expect(result.missing.some(item => item.required)).toBe(true);
  });
});
