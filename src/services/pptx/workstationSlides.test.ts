import { describe, expect, it } from 'vitest';
import {
  aggregateBOMHardwareItems,
  buildModuleOpticalSlideTextContent,
  buildWorkstationTechnicalRequirementTables,
  formatControllerGpuNote,
  generateBOMSlide,
  generateProductSchematicSlide,
  getBOMSlideCount,
  type WorkstationSlideData,
} from './workstationSlides';

describe('BOM aggregation', () => {
  it('merges case-insensitive trimmed matches while keeping type and model boundaries', () => {
    expect(aggregateBOMHardwareItems([
      { type: 'light', brand: ' OPT ', model: ' LI-100 ' },
      { type: 'light', brand: 'opt', model: 'li-100', note: ' 备用库存 ' },
      { type: 'light', brand: 'OPT', model: 'LI-200' },
      { type: 'lens', brand: 'OPT', model: 'LI-100' },
    ])).toEqual([
      { type: 'light', brand: 'OPT', model: 'LI-100', note: '备用库存', count: 2 },
      { type: 'light', brand: 'OPT', model: 'LI-200', note: '', count: 1 },
      { type: 'lens', brand: 'OPT', model: 'LI-100', note: '', count: 1 },
    ]);
  });
});

describe('formatControllerGpuNote', () => {
  it('keeps the BOM note blank when GPU is not filled in the hardware library', () => {
    expect(formatControllerGpuNote({ gpu: null }, true)).toBe('');
    expect(formatControllerGpuNote({ gpu: '' }, true)).toBe('');
    expect(formatControllerGpuNote({ gpu: '   ' }, false)).toBe('');
  });

  it('shows the actual GPU information when it is filled', () => {
    expect(formatControllerGpuNote({ gpu: ' RTX 3060 ' }, true)).toBe('GPU：RTX 3060');
    expect(formatControllerGpuNote({ gpu: 'RTX 3060' }, false)).toBe('GPU: RTX 3060');
  });
});

describe('BOM pagination', () => {
  it.each([
    [0, 1],
    [1, 1],
    [11, 2],
    [21, 3],
  ])('uses %i records to create %i consistently titled page(s)', (recordCount, expectedPages) => {
    const lights = Array.from({ length: recordCount }, (_, index) => ({
      brand: 'Brand',
      model: `L-${index + 1}`,
    }));
    expect(getBOMSlideCount({
      workstation_id: 'ws-1',
      conveyor_type: null,
      camera_count: 0,
      camera_mounts: null,
      mechanisms: null,
      selected_lights: lights,
    } as any)).toBe(expectedPages);
  });

  it('uses merged quantities and merged row counts for workstation pagination', () => {
    const slides: Array<{
      texts: string[];
      tables: Array<Array<Array<{ text: string }>>>;
    }> = [];
    const pptx = {
      addSlide: () => {
        const record = { texts: [] as string[], tables: [] as Array<Array<Array<{ text: string }>>> };
        slides.push(record);
        return {
          addText: (text: string) => record.texts.push(text),
          addTable: (rows: Array<Array<{ text: string }>>) => record.tables.push(rows as any),
          addShape: () => undefined,
          addImage: () => undefined,
        };
      },
    };
    const lights = Array.from({ length: 11 }, (_, index) => ({
      brand: index === 0 ? ' OPT ' : 'opt',
      model: index === 0 ? ' LI-100 ' : 'li-100',
    }));
    const layout = {
      workstation_id: 'ws-1',
      conveyor_type: null,
      camera_count: 0,
      camera_mounts: null,
      mechanisms: null,
      selected_lights: lights,
    } as any;

    expect(getBOMSlideCount(layout)).toBe(1);
    generateBOMSlide({
      pptx,
      isZh: true,
      wsCode: 'WS-1',
      wsName: '测试工位',
      responsible: null,
    } as any, { layout } as any);

    expect(slides).toHaveLength(1);
    expect(slides[0].tables[0][1].map(cell => cell.text)).toEqual([
      '1', 'LED光源', 'OPT LI-100', '11', '',
    ]);
  });

  it('repeats the same header, keeps serial numbers continuous and uses total-page titles', () => {
    const slides: Array<{
      texts: string[];
      tables: Array<Array<Array<{ text: string }>>>;
    }> = [];
    const pptx = {
      addSlide: () => {
        const record = { texts: [] as string[], tables: [] as Array<Array<Array<{ text: string }>>> };
        slides.push(record);
        return {
          addText: (text: string) => record.texts.push(text),
          addTable: (rows: Array<Array<{ text: string }>>) => record.tables.push(rows as any),
          addShape: () => undefined,
          addImage: () => undefined,
        };
      },
    };

    generateBOMSlide({
      pptx,
      isZh: true,
      wsCode: 'WS-1',
      wsName: '测试工位',
      responsible: null,
    } as any, {
      layout: {
        workstation_id: 'ws-1',
        conveyor_type: null,
        camera_count: 0,
        camera_mounts: null,
        mechanisms: null,
        selected_lights: Array.from({ length: 21 }, (_, index) => ({
          brand: 'Brand',
          model: `L-${index + 1}`,
        })),
      },
    } as any);

    expect(slides.map(slide => slide.texts[1])).toEqual([
      'BOM清单 (1/3)',
      'BOM清单 (2/3)',
      'BOM清单 (3/3)',
    ]);
    expect(slides.map(slide => slide.tables[0][0].map(cell => cell.text))).toEqual([
      ['序号', '设备名称', '型号', '数量', '备注'],
      ['序号', '设备名称', '型号', '数量', '备注'],
      ['序号', '设备名称', '型号', '数量', '备注'],
    ]);
    expect(slides.flatMap(slide => slide.tables[0]).every(row => row.length === 5)).toBe(true);
    expect(JSON.stringify(slides)).not.toContain('TBD');
    expect(slides.flatMap(slide => slide.tables[0].slice(1).map(row => row[0].text))).toEqual(
      Array.from({ length: 21 }, (_, index) => String(index + 1)),
    );
  });
});

describe('product schematic placeholders', () => {
  it('keeps a product page and its metadata when no image has been uploaded', async () => {
    const slides: Array<{ texts: string[] }> = [];
    const pptx = {
      addSlide: () => {
        const record = { texts: [] as string[] };
        slides.push(record);
        return {
          addText: (text: string) => record.texts.push(text),
          addShape: () => undefined,
          addImage: () => undefined,
        };
      },
    };

    await generateProductSchematicSlide({
      pptx,
      isZh: true,
      wsCode: 'WS-1',
      wsName: '测试工位',
      responsible: null,
    } as unknown as Parameters<typeof generateProductSchematicSlide>[0], {
      ws: {
        id: 'ws-1',
        name: '测试工位',
        type: 'inspection',
        product_dimensions: null,
      },
      productAssets: [{
        id: 'product-1',
        product_name: '无图产品',
        product_code: 'P-001',
        length_mm: 120,
        width_mm: 80,
        height_mm: 30,
        document_images_per_page: 2,
      }],
      productMedia: [],
      annotations: [],
    } as unknown as Parameters<typeof generateProductSchematicSlide>[1]);

    expect(slides).toHaveLength(1);
    expect(slides[0].texts).toContain('无图产品');
    expect(slides[0].texts.join(' ')).toContain('未上传产品图片');
    expect(slides[0].texts.join(' ')).toContain('P-001');
    expect(slides[0].texts.join(' ')).toContain('120 × 80 × 30 mm');
  });
});

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

  it('uses each linked product dimension instead of the workstation fallback', () => {
    const tables = buildWorkstationTechnicalRequirementTables({
      isZh: true,
      wsCode: 'DB260101.803',
      wsName: 'Station',
      ws: baseWorkstation as any,
      modules: [measurementModule] as any,
      productAssets: [
        { id: 'p1', product_name: 'Product A', length_mm: 120, width_mm: 80, height_mm: 12, preview_images: [] },
        { id: 'p2', product_name: 'Product B', length_mm: 200, width_mm: 90, height_mm: 30, preview_images: [] },
      ],
    });

    expect(tables.basicInfoRows[6][0]).toContain('2');
    expect(tables.basicInfoRows[6][1]).toContain('Product A: 120 × 80 × 12 mm');
    expect(tables.basicInfoRows[6][1]).toContain('Product B: 200 × 90 × 30 mm');
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
