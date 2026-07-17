import { describe, expect, it } from 'vitest';
import { getDefaultFormState } from './types';
import {
  buildThreeDMeasurementChecklist,
  deserializeThreeDConfig,
  getThreeDDisplayInfo,
  needs3DOpticsStrip,
  serializeThreeDConfig,
  strip3DOpticsFromForm,
} from './threeDCamera';

describe('strip3DOpticsFromForm', () => {
  it('enables 3D mode and clears lens and light fields', () => {
    const form = {
      ...getDefaultFormState(),
      selectedLens: 'lens-1',
      selectedLight: 'light-1',
      lightItems: [{
        id: 'item-1',
        selectedLight: 'light-1',
        lightMode: 'constant',
        lightAngle: '45',
        lightDistance: '120',
        lightDistanceHorizontal: '20',
        lightDistanceVertical: '100',
        lightNote: 'legacy',
      }],
      lightMode: 'constant',
      lightAngle: '45',
      lightCount: '1',
      lightDistance: '120',
      lightDistanceHorizontal: '20',
      lightDistanceVertical: '100',
      workingDistance: '700',
      fieldOfView: '358x239',
      fieldOfViewCommon: '358x239',
      fieldOfViewWidth: '358',
      fieldOfViewHeight: '239',
      resolutionPerPixel: '0.0655',
      twoDCameraType: 'line_scan' as const,
      lineScan: {
        fieldOfView: '50',
        resolutionPerPixel: '0.0122',
        scanSpeed: '500',
      },
      exposure: '1000',
      gain: '6',
      triggerDelay: '20',
      lensAperture: 'F2.8',
      depthOfField: '10',
      workingDistanceTolerance: '2',
      lightNote: 'legacy',
      threeDModel: 'LJ-S080',
      threeDOrderModel: '3D-APS-280-N',
    };

    const stripped = strip3DOpticsFromForm(form);

    expect(stripped.is3DCamera).toBe(true);
    expect(stripped.selectedLens).toBe('');
    expect(stripped.selectedLight).toBe('');
    expect(stripped.lightItems).toEqual([]);
    expect(stripped.lightMode).toBe('');
    expect(stripped.lightAngle).toBe('');
    expect(stripped.lightCount).toBe('');
    expect(stripped.lightDistance).toBe('');
    expect(stripped.lightDistanceHorizontal).toBe('');
    expect(stripped.lightDistanceVertical).toBe('');
    expect(stripped.workingDistance).toBe('700');
    expect(stripped.fieldOfView).toBe('');
    expect(stripped.fieldOfViewCommon).toBe('');
    expect(stripped.fieldOfViewWidth).toBe('');
    expect(stripped.fieldOfViewHeight).toBe('');
    expect(stripped.resolutionPerPixel).toBe('');
    expect(stripped.twoDCameraType).toBe('line_scan');
    expect(stripped.lineScan).toEqual({
      fieldOfView: '',
      resolutionPerPixel: '',
      scanSpeed: '',
    });
    expect(stripped.exposure).toBe('');
    expect(stripped.gain).toBe('');
    expect(stripped.triggerDelay).toBe('');
    expect(stripped.lensAperture).toBe('');
    expect(stripped.depthOfField).toBe('');
    expect(stripped.workingDistanceTolerance).toBe('2');
    expect(stripped.lightNote).toBe('');
    expect(stripped.threeDModel).toBe('LJ-S080');
    expect(stripped.threeDOrderModel).toBe('3D-APS-280-N');
    expect(needs3DOpticsStrip(stripped)).toBe(false);
  });
});

describe('3D camera config helpers', () => {
  it('serializes and deserializes the dedicated 3D fields', () => {
    const form = {
      ...getDefaultFormState(),
      is3DCamera: true,
      threeDModel: 'LJ-S080',
      threeDOrderModel: '3D-APS-280-N',
      threeDReferenceDistance: '160',
      threeDZRange: 'FS±23mm',
      threeDXRange: '66-78mm',
      threeDYRange: '160mm',
      threeDStandardRange: '280x233.8mm',
      threeDNearRange: '226x189mm',
      threeDFarRange: '333x278mm',
      threeDXYPrecision: '0.025',
      threeDZPrecision: '±0.025mm',
      threeDScanLineWidth: '35',
      threeDDataPoints: '3200x6400',
      threeDScanTime: '2-3S/次',
      threeDShotsPerSide: '2次/面',
      threeDShotsPerProduct: '4次/产品',
    };

    const serialized = serializeThreeDConfig(form);
    expect(serialized).toMatchObject({
      model: 'LJ-S080',
      orderModel: '3D-APS-280-N',
      standardRange: '280x233.8mm',
      nearRange: '226x189mm',
      farRange: '333x278mm',
    });
    expect(deserializeThreeDConfig(serialized)).toMatchObject({
      threeDModel: 'LJ-S080',
      threeDOrderModel: '3D-APS-280-N',
      threeDStandardRange: '280x233.8mm',
      threeDNearRange: '226x189mm',
      threeDFarRange: '333x278mm',
    });
  });

  it('builds PPT checklist lines for both reference-distance and range examples', () => {
    const example1 = getThreeDDisplayInfo({
      workingDistance: '160',
      workingDistanceTolerance: '15',
      referenceDistance: '160',
      zRange: 'FS±23mm',
      xRange: '66-78mm',
      yRange: '160mm',
      xyPrecision: '0.025',
      zPrecision: '±0.025mm',
      scanTime: '2-3S/次',
      shotsPerSide: '2次/面',
      shotsPerProduct: '4次/产品',
    });
    expect(buildThreeDMeasurementChecklist(example1)).toEqual([
      '工作距离： 160mm，工作距离公差： ±15mm',
      '基准距离： 160mm，FS/Z量程： FS±23mm，X范围： 66-78mm，Y范围： 160mm',
      'XY像素精度： 0.025mm，Z线性精度/重复精度： ±0.025mm',
      '拍照时间/节拍： 2-3S/次',
      '拍照次数： 2次/面，4次/产品',
    ]);

    const example2 = getThreeDDisplayInfo({
      mountType: '三轴移动',
      standardRange: '280x233.8mm',
      nearRange: '226x189mm',
      farRange: '333x278mm',
      xyPrecision: '0.11mm',
      zPrecision: '0.6um',
      scanTime: '3S左右',
    });
    expect(buildThreeDMeasurementChecklist(example2)).toEqual([
      '安装方式： 三轴移动',
      '标准范围： 280x233.8mm，近端范围： 226x189mm，远端范围： 333x278mm',
      'XY像素精度： 0.11mm，Z线性精度/重复精度： 0.6um',
      '拍照时间/节拍： 3S左右',
    ]);
  });
});
