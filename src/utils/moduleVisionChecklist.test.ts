import { describe, expect, it } from 'vitest';
import {
  buildModuleVisionChecklist,
  buildModuleVisionChecklistLines,
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
      cameraType: 'area_scan',
      detectionMethod: '2D*1',
      fieldOfView: '380*253mm',
      pixelAccuracy: '0.07mm/pixel',
      cameraInstall: '相机中心和铁芯中心对齐',
      shotCount: '1次',
      taktTime: '1.5S/次',
      scanSpeed: '',
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

  it('keeps saved manual FOV fields and rounds saved pixel accuracy for PPT display', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        selected_camera: 'cam_1',
        measurement_config: {
          imaging: {
            fieldOfViewWidth: '380',
            fieldOfViewHeight: '253',
            fieldOfView: '373.76*249.17',
            resolutionPerPixel: '0.0694',
          },
        },
      },
      hardware: {
        cameras: [{ id: 'cam_1', brand: 'Hikvision', model: 'MV-CA', resolution: '5472×3648' }],
      },
      language: 'zh',
    });

    expect(checklist.fieldOfView).toBe('380*253mm');
    expect(checklist.pixelAccuracy).toBe('0.07mm/pixel');
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
      mod_scan_speed: '',
      mod_vision_checklist: [
        '1. 检测方式: 2D*1',
        '2. 视野范围: 380*253mm',
        '3. 像素精度: 0.07mm/pixel',
        '4. 相机安装: 相机中心和铁芯中心对齐',
        '5. 拍照次数: 1次',
        '6. 节拍: 1.5S/次',
      ].join('\n'),
    });
  });

  it('builds the five line-scan rows from scalar FOV, long resolution axis, and scan speed', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        type: 'defect',
        selected_camera_info: { id: 'line-camera', resolution: '2×4096' },
        defect_config: {
          cameraCount: 2,
          shotCount: 9,
          cameraTaktTime: '4',
          imaging: {
            is3DCamera: false,
            twoDCameraType: 'line_scan',
            cameraInstallNote: '相机芯片长边与扫描方向垂直',
            fieldOfViewWidth: '999',
            fieldOfViewHeight: '888',
            lineScan: {
              fieldOfView: '50',
              scanSpeed: '500',
            },
          },
        },
      },
      workstation: { shot_count: 7, cycle_time: 4 },
      language: 'zh',
    });

    expect(checklist).toMatchObject({
      cameraType: 'line_scan',
      detectionMethod: '2D线扫相机*2',
      fieldOfView: '50mm',
      pixelAccuracy: '0.0122mm/pixel',
      cameraInstall: '相机芯片长边与扫描方向垂直',
      scanSpeed: '500mm/s',
    });
    expect(buildModuleVisionChecklistLines(checklist, 'zh')).toEqual([
      '1. 检测方式: 2D线扫相机*2',
      '2. 视野范围: 50mm',
      '3. 像素精度: 0.0122mm/pixel',
      '4. 相机安装: 相机芯片长边与扫描方向垂直',
      '5. 扫描速度: 500mm/s',
    ]);

    const fields = buildModuleVisionChecklistTemplateFields({
      module: {
        type: 'defect',
        selected_camera_info: { resolution: '4096×2' },
        defect_config: {
          cameraCount: 2,
          imaging: {
            twoDCameraType: 'line_scan',
            cameraInstallNote: '相机芯片长边与扫描方向垂直',
            lineScan: { fieldOfView: '50', scanSpeed: '500' },
          },
        },
      },
      language: 'zh',
    });
    expect(fields.mod_shot_count).toBe('');
    expect(fields.mod_takt_time).toBe('');
    expect(fields.mod_scan_speed).toBe('500mm/s');
    expect(fields.mod_vision_checklist.split('\n')).toHaveLength(5);
    expect(fields.mod_vision_checklist).not.toContain('拍照次数');
    expect(fields.mod_vision_checklist).not.toContain('节拍');
  });

  it('treats legacy 2D imaging without a subtype as area scan', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        type: 'measurement',
        measurement_config: { imaging: { fieldOfView: '100*80' } },
      },
      language: 'zh',
    });

    expect(checklist.cameraType).toBe('area_scan');
    expect(buildModuleVisionChecklistLines(checklist, 'zh')).toHaveLength(6);
  });

  it('uses the configured distance unit for line-scan FOV while keeping precision in mm/pixel', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        type: 'measurement',
        selected_camera_info: { resolution: '4096×2' },
        measurement_config: {
          imaging: {
            twoDCameraType: 'line_scan',
            distanceUnit: 'cm',
            lineScan: { fieldOfView: '5', scanSpeed: '500' },
          },
        },
      },
      language: 'zh',
    });

    expect(checklist.fieldOfView).toBe('5cm');
    expect(checklist.pixelAccuracy).toBe('0.0122mm/pixel');
  });

  it('uses the config matching the current module type before stale config columns', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        type: 'measurement',
        defect_config: {
          imaging: {
            twoDCameraType: 'line_scan',
            lineScan: { fieldOfView: '999', scanSpeed: '999' },
          },
        },
        measurement_config: {
          imaging: { fieldOfView: '120*60' },
        },
      },
      language: 'zh',
    });

    expect(checklist.cameraType).toBe('area_scan');
    expect(checklist.fieldOfView).toBe('120*60mm');
  });

  it('prefers workstation acceptance cycle time ranges for module takt display', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        selected_camera: 'cam_1',
        processing_time_limit: 120,
      },
      workstation: {
        cycle_time: 3,
        acceptance_criteria: {
          cycle_time: '3~3.5',
        },
      },
      language: 'zh',
    });

    expect(checklist.taktTime).toBe('3~3.5S/次');
  });

  it('prefers module camera takt time over workstation cycle time', () => {
    const checklist = buildModuleVisionChecklist({
      module: {
        selected_camera: 'cam_1',
        defect_config: {
          cameraTaktTime: '1~1.5S/次',
        },
      },
      workstation: {
        cycle_time: 3,
        acceptance_criteria: {
          cycle_time: '3~3.5',
        },
      },
      language: 'zh',
    });

    expect(checklist.taktTime).toBe('1~1.5S/次');
  });
});
