import { describe, expect, it } from 'vitest';
import {
  buildModuleVisionChecklist,
  buildModuleVisionChecklistTemplateFields,
} from './moduleVisionChecklist';

describe('moduleVisionChecklist', () => {
  it('uses nested imaging fields for the six PPT checklist rows', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        selected_camera: 'cam_1',
        processing_time_limit: 120,
        defect_config: {
          cameraCount: 1,
          imaging: {
            is3DCamera: false,
            fieldOfView: '380×253',
            resolutionPerPixel: '0.07',
            cameraInstallNote: '相机中心和铁芯中心对齐',
          },
        },
      },
      workstation: {
        shot_count: 1,
        cycle_time: 1.5,
      },
      language: 'zh',
    });

    expect(checklist).toEqual({
      detectionMethod: '2D*1',
      fieldOfView: '380*253mm',
      pixelAccuracy: '0.07mm/pixel',
      cameraInstall: '相机中心和铁芯中心对齐',
      shotCount: '1次',
      taktTime: '1.5S/次',
    });
  });

  it('calculates pixel accuracy from FOV and selected camera resolution when not filled', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        selected_camera: 'cam_1',
        measurement_config: {
          imaging: {
            fieldOfView: '380*253',
          },
        },
      },
      layout: {
        selected_cameras: [{ id: 'camera-a', brand: 'Hikvision', model: 'MV-CA' }],
        camera_mounts: ['top'],
      },
      hardware: {
        cameras: [{ id: 'camera-a', brand: 'Hikvision', model: 'MV-CA', resolution: '5472×3648' }],
      },
      language: 'zh',
    });

    expect(checklist.pixelAccuracy).toBe('0.07mm/pixel');
    expect(checklist.cameraInstall).toBe('顶部安装');
  });

  it('builds upload-template module placeholder fields', () => {
    const fields = buildModuleVisionChecklistTemplateFields({
      module: {
        selected_camera_info: { id: 'camera-a', resolution: '5472×3648' },
        measurement_config: {
          imaging: { is3DCamera: false, fieldOfView: '380×253' },
        },
      },
      workstation: {
        shot_count: 1,
        cycle_time: 1.5,
      },
      layout: {
        layout_description: '相机中心和铁芯中心对齐',
      },
      language: 'zh',
    });

    expect(fields).toMatchObject({
      mod_detection_method: '2D*1',
      mod_field_of_view: '380*253mm',
      mod_pixel_accuracy: '0.07mm/pixel',
      mod_camera_install: '相机中心和铁芯中心对齐',
      mod_shot_count: '1次',
      mod_takt_time: '1.5S/次',
    });
  });
});
