import type { ModuleFormState } from './types';

export function strip3DOpticsFromForm<T extends ModuleFormState>(state: T): T {
  return {
    ...state,
    is3DCamera: true,
    selectedLens: '',
    selectedLight: '',
    lightItems: [],
    fieldOfView: '',
    fieldOfViewCommon: '',
    fieldOfViewWidth: '',
    fieldOfViewHeight: '',
    resolutionPerPixel: '',
    lineScan: {
      fieldOfView: '',
      resolutionPerPixel: '',
      scanSpeed: '',
    },
    exposure: '',
    gain: '',
    triggerDelay: '',
    lightMode: '',
    lightAngle: '',
    lightCount: '',
    lightDistance: '',
    lightDistanceHorizontal: '',
    lightDistanceVertical: '',
    lensAperture: '',
    depthOfField: '',
    lightNote: '',
  };
}

const cleanStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

function compactStrings(values: unknown[]): string[] {
  return values
    .map(value => cleanStr(value))
    .filter((value): value is string => Boolean(value));
}

function withUnit(value: string | null, unit: string): string | null {
  if (!value) return null;
  return /^[-+]?\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}${unit}` : value.trim();
}

function withShotUnit(value: string | null, unit: '面' | '产品'): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.includes(unit) ? trimmed : `${trimmed}/${unit}`;
}

export function serializeThreeDConfig(state: ModuleFormState): Record<string, unknown> | null {
  if (!state.is3DCamera) return null;
  const data = {
    model: cleanStr(state.threeDModel),
    name: cleanStr(state.threeDName),
    profilePoints: cleanStr(state.threeDProfilePoints),
    scanFrameRate: cleanStr(state.threeDScanFrameRate),
    scanSpeed: cleanStr(state.threeDScanSpeed),
    zResolution: cleanStr(state.threeDZResolution),
    zRepeatability: cleanStr(state.threeDZRepeatability),
    zLinearity: cleanStr(state.threeDZLinearity),
    orderModel: cleanStr(state.threeDOrderModel),
    mountType: cleanStr(state.threeDMountType),
    referenceDistance: cleanStr(state.threeDReferenceDistance),
    zRange: cleanStr(state.threeDZRange),
    xRange: cleanStr(state.threeDXRange),
    yRange: cleanStr(state.threeDYRange),
    standardRange: cleanStr(state.threeDStandardRange),
    nearRange: cleanStr(state.threeDNearRange),
    farRange: cleanStr(state.threeDFarRange),
    xyPrecision: cleanStr(state.threeDXYPrecision),
    zPrecision: cleanStr(state.threeDZPrecision),
    scanLineWidth: cleanStr(state.threeDScanLineWidth),
    dataPoints: cleanStr(state.threeDDataPoints),
    scanTime: cleanStr(state.threeDScanTime),
    shotsPerSide: cleanStr(state.threeDShotsPerSide),
    shotsPerProduct: cleanStr(state.threeDShotsPerProduct),
    needFlip: Boolean(state.threeDNeedFlip),
    needRobot: Boolean(state.threeDNeedRobot),
    needFixture: Boolean(state.threeDNeedFixture),
  };
  const hasAny = Object.entries(data).some(([key, value]) => {
    if (typeof value === 'boolean') return value;
    return value !== null && value !== '';
  });
  return hasAny ? data : null;
}

export function deserializeThreeDConfig(raw: unknown): Partial<ModuleFormState> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    threeDModel: str(r.model),
    threeDName: str(r.name),
    threeDProfilePoints: str(r.profilePoints),
    threeDScanFrameRate: str(r.scanFrameRate),
    threeDScanSpeed: str(r.scanSpeed),
    threeDZResolution: str(r.zResolution),
    threeDZRepeatability: str(r.zRepeatability),
    threeDZLinearity: str(r.zLinearity),
    threeDOrderModel: str(r.orderModel),
    threeDDetectionMethod: str(r.detectionMethod),
    threeDMountType: str(r.mountType),
    threeDReferenceDistance: str(r.referenceDistance),
    threeDZRange: str(r.zRange),
    threeDXRange: str(r.xRange),
    threeDYRange: str(r.yRange),
    threeDStandardRange: str(r.standardRange),
    threeDNearRange: str(r.nearRange),
    threeDFarRange: str(r.farRange),
    threeDXYPrecision: str(r.xyPrecision),
    threeDZPrecision: str(r.zPrecision),
    threeDScanLineWidth: str(r.scanLineWidth),
    threeDDataPoints: str(r.dataPoints),
    threeDScanTime: str(r.scanTime),
    threeDShotsPerSide: str(r.shotsPerSide),
    threeDShotsPerProduct: str(r.shotsPerProduct),
    threeDNeedFlip: Boolean(r.needFlip),
    threeDNeedRobot: Boolean(r.needRobot),
    threeDNeedFixture: Boolean(r.needFixture),
    threeDDetectionSteps: Array.isArray(r.detectionSteps)
      ? (r.detectionSteps as unknown[]).map(s => String(s))
      : [],
  };
}

export interface ThreeDDisplayInfo {
  model: string | null;
  name: string | null;
  profilePoints: string | null;
  scanFrameRate: string | null;
  scanSpeed: string | null;
  zResolution: string | null;
  zRepeatability: string | null;
  zLinearity: string | null;
  orderModel: string | null;
  scanLineWidth: string | null;
  dataPoints: string | null;
  workingDistance: string | null;
  workingDistanceTolerance: string | null;
  referenceDistance: string | null;
  zRange: string | null;
  xRange: string | null;
  yRange: string | null;
  standardRange: string | null;
  nearRange: string | null;
  farRange: string | null;
  xyPrecision: string | null;
  zPrecision: string | null;
  mountType: string | null;
  scanTime: string | null;
  shotsPerSide: string | null;
  shotsPerProduct: string | null;
  detectionSteps: string[];
  hasAny: boolean;
}

export function getThreeDDisplayInfo(source: unknown): ThreeDDisplayInfo {
  const r = (source && typeof source === 'object') ? (source as Record<string, unknown>) : {};
  const info: ThreeDDisplayInfo = {
    model: cleanStr(r.model),
    name: cleanStr(r.name),
    profilePoints: cleanStr(r.profilePoints),
    scanFrameRate: cleanStr(r.scanFrameRate),
    scanSpeed: cleanStr(r.scanSpeed),
    zResolution: cleanStr(r.zResolution),
    zRepeatability: cleanStr(r.zRepeatability),
    zLinearity: cleanStr(r.zLinearity),
    orderModel: cleanStr(r.orderModel),
    scanLineWidth: withUnit(cleanStr(r.scanLineWidth), 'mm'),
    dataPoints: cleanStr(r.dataPoints),
    workingDistance: withUnit(cleanStr(r.workingDistance), 'mm'),
    workingDistanceTolerance: withUnit(cleanStr(r.workingDistanceTolerance), 'mm'),
    referenceDistance: withUnit(cleanStr(r.referenceDistance), 'mm'),
    zRange: cleanStr(r.zRange),
    xRange: cleanStr(r.xRange),
    yRange: cleanStr(r.yRange),
    standardRange: cleanStr(r.standardRange),
    nearRange: cleanStr(r.nearRange),
    farRange: cleanStr(r.farRange),
    xyPrecision: withUnit(cleanStr(r.xyPrecision), 'mm'),
    zPrecision: withUnit(cleanStr(r.zPrecision), 'mm'),
    mountType: cleanStr(r.mountType),
    scanTime: cleanStr(r.scanTime),
    shotsPerSide: cleanStr(r.shotsPerSide),
    shotsPerProduct: cleanStr(r.shotsPerProduct),
    detectionSteps: Array.isArray(r.detectionSteps)
      ? (r.detectionSteps as unknown[]).map(s => String(s).trim()).filter(Boolean)
      : [],
    hasAny: false,
  };
  info.hasAny = Boolean(
    info.name || info.profilePoints || info.scanFrameRate || info.scanSpeed
    || info.zResolution || info.zRepeatability || info.zLinearity
    || info.model || info.orderModel || info.scanLineWidth || info.dataPoints || info.workingDistance || info.workingDistanceTolerance || info.referenceDistance
    || info.zRange || info.xRange || info.yRange || info.standardRange || info.nearRange || info.farRange
    || info.xyPrecision || info.zPrecision || info.mountType || info.scanTime
    || info.shotsPerSide || info.shotsPerProduct || info.detectionSteps.length > 0,
  );
  return info;
}

export function getThreeDDisplayInfoFromForm(form: ModuleFormState): ThreeDDisplayInfo {
  return getThreeDDisplayInfo({
    ...(serializeThreeDConfig(form) || {}),
    workingDistance: form.workingDistance,
    workingDistanceTolerance: form.workingDistanceTolerance,
  });
}

export function buildThreeDMeasurementChecklist(info: ThreeDDisplayInfo): string[] {
  const lines: string[] = [];
  if (info.mountType) {
    lines.push(`安装方式： ${info.mountType}`);
  }
  const workingDistanceParts = compactStrings([
    info.workingDistance ? `工作距离： ${info.workingDistance}` : '',
    info.workingDistanceTolerance ? `工作距离公差： ±${info.workingDistanceTolerance}` : '',
  ]);
  if (workingDistanceParts.length > 0) {
    lines.push(workingDistanceParts.join('，'));
  }
  const standardParts = compactStrings([
    info.standardRange ? `标准范围： ${info.standardRange}` : '',
    info.nearRange ? `近端范围： ${info.nearRange}` : '',
    info.farRange ? `远端范围： ${info.farRange}` : '',
  ]);
  const referenceParts = compactStrings([
    info.referenceDistance ? `工作距离： ${info.referenceDistance}` : '',
    info.zRange ? `FS/Z量程： ${info.zRange}` : '',
    info.xRange ? `X范围： ${info.xRange}` : '',
    info.yRange ? `Y范围： ${info.yRange}` : '',
  ]);
  if (standardParts.length > 0) {
    lines.push(standardParts.join('，'));
  } else if (referenceParts.length > 0) {
    lines.push(referenceParts.join('，'));
  }

  const precisionParts = compactStrings([
    info.xyPrecision ? `XY像素精度： ${info.xyPrecision}` : '',
    info.zPrecision ? `Z线性精度/重复精度： ${info.zPrecision}` : '',
  ]);
  if (precisionParts.length > 0) lines.push(precisionParts.join('，'));
  const scanParts = compactStrings([
    info.profilePoints ? `单轮廓点数： ${info.profilePoints}` : '',
    info.scanFrameRate ? `扫描帧率： ${info.scanFrameRate}` : '',
    info.scanSpeed ? `扫描速度： ${info.scanSpeed}` : '',
  ]);
  if (scanParts.length > 0) lines.push(scanParts.join('，'));

  const zParts = compactStrings([
    info.zResolution ? `Z轴分辨率： ${info.zResolution}` : '',
    info.zRepeatability ? `Z轴重复精度： ${info.zRepeatability}` : '',
    info.zLinearity ? `Z轴线性度： ${info.zLinearity}` : '',
  ]);
  if (zParts.length > 0) lines.push(zParts.join('，'));

  if (info.scanTime) lines.push(`拍照时间/节拍： ${info.scanTime}`);

  const shotParts = compactStrings([
    withShotUnit(info.shotsPerSide, '面'),
    withShotUnit(info.shotsPerProduct, '产品'),
  ]);
  if (shotParts.length > 0) lines.push(`拍照次数： ${shotParts.join('，')}`);

  if (lines.length === 0) {
    lines.push('测量范围： 待维护');
  }

  return lines;
}

export function needs3DOpticsStrip(state: ModuleFormState) {
  return !state.is3DCamera
    || Boolean(
      state.selectedLens
      || state.selectedLight
      || state.lightItems.length > 0
      || state.fieldOfViewCommon
      || state.fieldOfViewWidth
      || state.fieldOfViewHeight
      || state.resolutionPerPixel
      || state.lineScan.fieldOfView
      || state.lineScan.resolutionPerPixel
      || state.lineScan.scanSpeed
      || state.exposure
      || state.gain
      || state.triggerDelay
      || state.lightMode
      || state.lightAngle
      || state.lightCount
      || state.lightDistance
      || state.lightDistanceHorizontal
      || state.lightDistanceVertical
      || state.lensAperture
      || state.depthOfField
      || state.lightNote,
    );
}
