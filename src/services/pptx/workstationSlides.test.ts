import { describe, expect, it } from 'vitest';
import { buildWorkstationTechnicalRequirementTables } from './workstationSlides';

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
      '工位类型',
      '工位节拍',
      '精度要求',
      '产品尺寸',
    ]);
    expect(tables.basicInfoRows[3]).toEqual(['工位节拍', '3~3.5 s/pcs']);
    expect(tables.basicInfoRows[4]).toEqual(['精度要求', '±0.1mm']);
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
