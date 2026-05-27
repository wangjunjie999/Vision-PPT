import { describe, expect, it } from 'vitest';
import { checkPPTReadiness } from './pptReadiness';

const baseProject = {
  id: 'project-1',
  code: 'P001',
  name: '测试项目',
  customer: '客户',
  responsible: '负责人',
  date: '2026-05-27',
};

const baseWorkstation = {
  id: 'workstation-1',
  project_id: 'project-1',
  name: '工位1',
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

function readinessForModule(module: Record<string, unknown>) {
  return checkPPTReadiness({
    projects: [baseProject] as any,
    workstations: [baseWorkstation] as any,
    layouts: [baseLayout] as any,
    modules: [{
      id: 'module-1',
      workstation_id: 'workstation-1',
      name: '检测模块',
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
  return readinessForModule(module).warnings.filter(item => item.warning.includes('成像参数'));
}

describe('pptReadiness imaging parameters', () => {
  it('accepts imaging parameters saved under nested config.imaging', () => {
    const warnings = imagingWarnings({
      defect_config: {
        imaging: {
          fieldOfView: '200×150',
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
        fieldOfView: '200×150',
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
    expect(warnings[0].warning).toContain('视野范围(FOV)');
    expect(warnings[0].warning).toContain('像素精度');
    expect(warnings[0].warning).not.toContain('工作距离');
  });
});
