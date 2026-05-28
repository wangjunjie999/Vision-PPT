import type { ModuleFormState } from './types';

export function strip3DOpticsFromForm<T extends ModuleFormState>(state: T): T {
  return {
    ...state,
    is3DCamera: true,
    selectedLens: '',
    selectedLight: '',
    lightItems: [],
    lightMode: '',
    lightAngle: '',
    lightCount: '',
    lightDistance: '',
    lightDistanceHorizontal: '',
    lightDistanceVertical: '',
    lensAperture: '',
    depthOfField: '',
    workingDistanceTolerance: '',
    lightNote: '',
  };
}

/** 序列化 form 中的 3D 字段为可持久化对象（存放于 measurement_config.three_d） */
export function serializeThreeDConfig(state: ModuleFormState): Record<string, unknown> | null {
  if (!state.is3DCamera) return null;
  const data = {
    model: state.threeDModel || null,
    detectionMethod: state.threeDDetectionMethod || null,
    mountType: state.threeDMountType || null,
    referenceDistance: state.threeDReferenceDistance || null,
    zRange: state.threeDZRange || null,
    xRange: state.threeDXRange || null,
    yRange: state.threeDYRange || null,
    xyPrecision: state.threeDXYPrecision || null,
    zPrecision: state.threeDZPrecision || null,
    scanLineWidth: state.threeDScanLineWidth || null,
    dataPoints: state.threeDDataPoints || null,
    scanTime: state.threeDScanTime || null,
    shotsPerSide: state.threeDShotsPerSide || null,
    shotsPerProduct: state.threeDShotsPerProduct || null,
    needFlip: Boolean(state.threeDNeedFlip),
    needRobot: Boolean(state.threeDNeedRobot),
    needFixture: Boolean(state.threeDNeedFixture),
    detectionSteps: Array.isArray(state.threeDDetectionSteps)
      ? state.threeDDetectionSteps.filter(s => s && s.trim())
      : [],
  };
  // 全部为空时返回 null
  const hasAny = Object.entries(data).some(([k, v]) => {
    if (k === 'detectionSteps') return Array.isArray(v) && v.length > 0;
    if (typeof v === 'boolean') return v;
    return v !== null && v !== '';
  });
  return hasAny ? data : null;
}

/** 从持久化对象反序列化到 form 字段 patch */
export function deserializeThreeDConfig(raw: unknown): Partial<ModuleFormState> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    threeDModel: str(r.model),
    threeDDetectionMethod: str(r.detectionMethod),
    threeDMountType: str(r.mountType),
    threeDReferenceDistance: str(r.referenceDistance),
    threeDZRange: str(r.zRange),
    threeDXRange: str(r.xRange),
    threeDYRange: str(r.yRange),
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

/** UI 展示文本统一收敛 —— 缺失返回 null 由调用方决定隐藏或显示「待维护」 */
export interface ThreeDDisplayInfo {
  model: string | null;
  scanLineWidth: string | null;
  dataPoints: string | null;
  referenceDistance: string | null;
  zRange: string | null;
  xRange: string | null;
  yRange: string | null;
  xyPrecision: string | null;
  zPrecision: string | null;
  detectionMethod: string | null;
  mountType: string | null;
  scanTime: string | null;
  shotsPerSide: string | null;
  shotsPerProduct: string | null;
  detectionSteps: string[];
  hasAny: boolean;
}

const cleanStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

/** Append unit if not already present and value is purely numeric */
function withUnit(value: string | null, unit: string): string | null {
  if (!value) return null;
  if (/[a-zA-Z°µμ%±\d\s\-–~]+$/.test(value) && !/^\s*[-+]?\d+(\.\d+)?\s*$/.test(value)) return value;
  if (/^\s*[-+]?\d+(\.\d+)?\s*$/.test(value)) return `${value.trim()} ${unit}`;
  return value;
}

export function getThreeDDisplayInfo(source: unknown): ThreeDDisplayInfo {
  const r = (source && typeof source === 'object') ? (source as Record<string, unknown>) : {};
  const info: ThreeDDisplayInfo = {
    model: cleanStr(r.model),
    scanLineWidth: withUnit(cleanStr(r.scanLineWidth), 'mm'),
    dataPoints: cleanStr(r.dataPoints),
    referenceDistance: withUnit(cleanStr(r.referenceDistance), 'mm'),
    zRange: cleanStr(r.zRange),
    xRange: cleanStr(r.xRange),
    yRange: cleanStr(r.yRange),
    xyPrecision: withUnit(cleanStr(r.xyPrecision), 'mm'),
    zPrecision: withUnit(cleanStr(r.zPrecision), 'mm'),
    detectionMethod: cleanStr(r.detectionMethod),
    mountType: cleanStr(r.mountType),
    scanTime: cleanStr(r.scanTime),
    shotsPerSide: cleanStr(r.shotsPerSide),
    shotsPerProduct: cleanStr(r.shotsPerProduct),
    detectionSteps: Array.isArray(r.detectionSteps)
      ? (r.detectionSteps as unknown[]).map(s => String(s)).filter(s => s.trim())
      : [],
    hasAny: false,
  };
  info.hasAny = Boolean(
    info.model || info.scanLineWidth || info.dataPoints || info.referenceDistance
    || info.zRange || info.xRange || info.yRange || info.xyPrecision || info.zPrecision
    || info.detectionMethod || info.mountType || info.scanTime
    || info.detectionSteps.length > 0,
  );
  return info;
}

/** 从 form 提取 3D 显示信息（用于实时预览） */
export function getThreeDDisplayInfoFromForm(form: ModuleFormState): ThreeDDisplayInfo {
  return getThreeDDisplayInfo(serializeThreeDConfig(form) || {});
}

export function needs3DOpticsStrip(state: ModuleFormState) {
  return !state.is3DCamera
    || Boolean(
      state.selectedLens
      || state.selectedLight
      || state.lightItems.length > 0
      || state.lightMode
      || state.lightAngle
      || state.lightCount
      || state.lightDistance
      || state.lightDistanceHorizontal
      || state.lightDistanceVertical
      || state.lensAperture
      || state.depthOfField
      || state.workingDistanceTolerance
      || state.lightNote,
    );
}
