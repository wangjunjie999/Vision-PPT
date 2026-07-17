import { describe, expect, it } from 'vitest';
import {
  buildModuleOpticalSlideTextContent,
  buildWorkstationTechnicalRequirementTables,
  type WorkstationSlideData,
} from './workstationSlides';

const baseWorkstation = {
  id: 'ws-1',
  name: '旋转台尺寸测量工位',
  type: 'turntable',
  cycle_time: 5,
  product_dimensions: { length: 300, width: 200, height: 50 },
  enclosed: false,
  notes: '',
  acceptance_criteria: {
    accuracy: '±0.1mm',
    detection_content: '四面尺寸精密测量',
    cycle_time: '3~3.5',
  },
};

const measurementModule = {
  id: 'mod-1',
  name: '尺寸测量',
  type: 'measurement',
  trigger_type: null,
  processing_time_limit: null,
  measurement_config: {
    systemAccuracy: '0.02',
  },
};

describe('buildWorkstationTechnicalRequirementTables', () => {
  it('builds the workstation technical requirement page from manual workstation fields', () => {
    const tables = buildWorkstationTechnicalRequirementTables({
      isZh: true,
      wsCode: 'DB260101.803',
      wsName: '旋转台尺寸测量工位',
      ws: baseWorkstation as any,
      modules: [measurementModule] as any,
    });

    expect(tables.basicInfoRows.map(row => row[0])).toEqual([
      '工位编号',
      '工位名称',
      '设计负责人',
      '工位类型',
      '工位节拍',
      '精度要求',
      '产品尺寸',
    ]);
    expect(tables.basicInfoRows[2]).toEqual(['设计负责人', '-']);
    expect(tables.basicInfoRows[4]).toEqual(['工位节拍', '3~3.5 s/pcs']);
    expect(tables.basicInfoRows[5]).toEqual(['精度要求', '±0.1mm']);
    expect(tables.moduleRows).toEqual([['尺寸测量']]);
    expect(tables.detectionContentRows).toEqual([['四面尺寸精密测量']]);
    expect(JSON.stringify(tables)).not.toContain('系统精度');
    expect(JSON.stringify(tables)).not.toContain('配置参数');
  });

  it('lists workstation module names in order', () => {
    const tables = buildWorkstationTechnicalRequirementTables({
      isZh: true,
      wsCode: 'DB260101.803',
      wsName: '旋转台尺寸测量工位',
      ws: baseWorkstation as any,
      modules: [
        measurementModule,
        { ...measurementModule, id: 'mod-2', name: '外观检测' },
      ] as any,
    });

    expect(tables.moduleRows).toEqual([
      ['尺寸测量'],
      ['外观检测'],
    ]);
  });

  it('uses workstation remarks for the right-side note panel', () => {
    const tables = buildWorkstationTechnicalRequirementTables({
      isZh: true,
      wsCode: 'DB260101.803',
      wsName: '旋转台尺寸测量工位',
      ws: {
        ...baseWorkstation,
        notes: 'CD1:兼容三款产品，尺寸如下',
      } as any,
      modules: [measurementModule] as any,
    });

    expect(tables.noteText).toBe('CD1:兼容三款产品，尺寸如下');
  });

  it('does not invent default precision or detection content values when manual fields are empty', () => {
    const tables = buildWorkstationTechnicalRequirementTables({
      isZh: true,
      wsCode: 'DB260101.803',
      wsName: '旋转台尺寸测量工位',
      ws: {
        ...baseWorkstation,
        acceptance_criteria: {},
      } as any,
      modules: [] as any,
    });

    expect(tables.basicInfoRows.find(row => row[0] === '精度要求')).toEqual(['精度要求', '-']);
    expect(tables.basicInfoRows.find(row => row[0] === '工位节拍')).toEqual(['工位节拍', '5 s/pcs']);
    expect(tables.moduleRows).toEqual([['-']]);
    expect(tables.detectionContentRows).toEqual([['-']]);
    expect(JSON.stringify(tables)).not.toContain('±0.1mm');
  });
});

describe('buildModuleOpticalSlideTextContent', () => {
  const baseData: Pick<WorkstationSlideData, 'ws' | 'layout' | 'hardware'> = {
    ws: {
      ...baseWorkstation,
      motion_description: null,
      action_script: null,
    },
    layout: {
      workstation_id: 'ws-1',
      conveyor_type: null,
      camera_count: 1,
      camera_mounts: null,
      mechanisms: null,
      layout_description: '相机芯片长边与扫描方向垂直',
    },
    hardware: {
      cameras: [{ id: 'line-camera', brand: '海康', model: 'MV-CL', resolution: '4096×2' }],
      lenses: [],
      lights: [],
      controllers: [],
    },
  };

  it('renders exactly five native PPT rows for line scan and omits area-scan rows', () => {
    const content = buildModuleOpticalSlideTextContent({
      module: {
        ...measurementModule,
        description: null,
        selected_camera: 'line-camera',
        measurement_config: {
          imaging: {
            twoDCameraType: 'line_scan',
            lineScan: {
              fieldOfView: '50',
              resolutionPerPixel: '0.0122',
              scanSpeed: '500',
            },
          },
        },
      } as WorkstationSlideData['modules'][number],
      data: baseData,
      isZh: true,
    });

    expect(content.checklistItems).toEqual([
      '1. 检测方式: 2D线扫相机*1',
      '2. 视野范围: 50mm',
      '3. 像素精度: 0.0122mm/pixel',
      '4. 相机安装: 相机芯片长边与扫描方向垂直',
      '5. 扫描速度: 500mm/s',
    ]);
    expect(content.checklistItems.join('\n')).not.toContain('拍照次数');
    expect(content.checklistItems.join('\n')).not.toContain('节拍');
    expect(content.methodDescription).toContain('线扫相机');
    expect(content.methodDescription).toContain('视觉任务');
    expect(content.methodDescription).not.toContain('缺陷检测');
  });

  it('keeps a custom line-scan measurement description verbatim', () => {
    const description = '1. 编码器触发连续扫描\n2. 检测焊缝缺陷';
    const content = buildModuleOpticalSlideTextContent({
      module: {
        ...measurementModule,
        description,
        measurement_config: {
          imaging: {
            twoDCameraType: 'line_scan',
            lineScan: { fieldOfView: '50', scanSpeed: '500' },
          },
        },
      } as WorkstationSlideData['modules'][number],
      data: baseData,
      isZh: true,
    });

    expect(content.methodDescription).toBe(description);
  });

  it('keeps the legacy six-row area-scan checklist when subtype is missing', () => {
    const content = buildModuleOpticalSlideTextContent({
      module: {
        ...measurementModule,
        measurement_config: {
          imaging: {
            fieldOfView: '100*80',
            resolutionPerPixel: '0.02',
          },
        },
      } as WorkstationSlideData['modules'][number],
      data: baseData,
      isZh: true,
    });

    expect(content.checklist.cameraType).toBe('area_scan');
    expect(content.checklistItems).toHaveLength(6);
    expect(content.checklistItems[4]).toContain('拍照次数');
    expect(content.checklistItems[5]).toContain('节拍');
  });
});
