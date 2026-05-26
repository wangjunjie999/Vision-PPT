/**
 * Imaging Parameter Auto-Calculation Utilities
 * 根据相机分辨率和视野自动计算成像参数
 */

// 常见传感器尺寸对应的实际宽度 (mm)
export const SENSOR_WIDTH_MAP: Record<string, number> = {
  '1/4': 3.6,
  '1/3': 4.8,
  '1/2.5': 5.76,
  '1/2.3': 6.17,
  '1/2': 6.4,
  '1/1.8': 7.18,
  '2/3': 8.8,
  '1': 12.8,
  '1.1': 14.0,
  '4/3': 17.3,
  'APS-C': 23.6,
  '35mm': 36,
};

// 靶面宽高比近似（用于从宽度推算高度）
const SENSOR_ASPECT: Record<string, number> = {
  '1/4': 3 / 4,
  '1/3': 3 / 4,
  '1/2.5': 3 / 4,
  '1/2.3': 3 / 4,
  '1/2': 3 / 4,
  '1/1.8': 3 / 4,
  '2/3': 3 / 4,
  '1': 3 / 4,
  '1.1': 3 / 4,
  '4/3': 3 / 4,
  'APS-C': 2 / 3,
  '35mm': 2 / 3,
};

/**
 * 解析传感器尺寸字符串，返回宽x高 (mm)
 */
export function parseSensorSize(sensorSize: string): { width: number; height: number } | null {
  if (!sensorSize) return null;
  const w = SENSOR_WIDTH_MAP[sensorSize];
  if (!w) return null;
  const ratio = SENSOR_ASPECT[sensorSize] ?? 3 / 4;
  return { width: w, height: w * ratio };
}

/**
 * 解析相机分辨率字符串，返回宽x高像素
 * @param resolution 分辨率字符串，如 "2448x2048", "500万像素", "12MP"
 * @returns { width: number, height: number } 或 null
 */
export function parseResolution(resolution: string): { width: number; height: number } | null {
  if (!resolution) return null;
  
  // 格式1: "2448x2048" 或 "2448*2048"
  const matchWH = resolution.match(/(\d+)\s*[x×*]\s*(\d+)/i);
  if (matchWH) {
    return { width: parseInt(matchWH[1]), height: parseInt(matchWH[2]) };
  }
  
  // 格式2: "500万像素" 或 "5MP" 或 "12MP"
  const matchMP = resolution.match(/(\d+(?:\.\d+)?)\s*(?:万像素|MP|M|百万)/i);
  if (matchMP) {
    const megapixels = parseFloat(matchMP[1]);
    // 假设 4:3 比例
    const totalPixels = megapixels * 1000000;
    const width = Math.round(Math.sqrt(totalPixels * 4 / 3));
    const height = Math.round(width * 3 / 4);
    return { width, height };
  }
  
  // 格式3: 纯数字像素数 "5000000"
  const matchPure = resolution.match(/^(\d{6,})$/);
  if (matchPure) {
    const totalPixels = parseInt(matchPure[1]);
    const width = Math.round(Math.sqrt(totalPixels * 4 / 3));
    const height = Math.round(width * 3 / 4);
    return { width, height };
  }
  
  return null;
}

/**
 * 解析视野 FOV 字符串，返回宽x高毫米
 * @param fov FOV字符串，如 "100x80", "100×80mm", "100*80"
 * @returns { width: number, height: number } 或 null
 */
export function parseFOV(fov: string): { width: number; height: number } | null {
  if (!fov) return null;
  
  // 去除单位
  const cleaned = fov.replace(/mm|毫米/gi, '').trim();
  
  // 格式: "100x80" 或 "100×80" 或 "100*80"
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
  if (match) {
    return { width: parseFloat(match[1]), height: parseFloat(match[2]) };
  }
  
  // 单值格式: "100" (假设正方形)
  const matchSingle = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (matchSingle) {
    const size = parseFloat(matchSingle[1]);
    return { width: size, height: size };
  }
  
  return null;
}

/**
 * 计算像素精度 (分辨率换算)
 * @param fov 视野范围 (mm)
 * @param resolution 相机分辨率
 * @returns 像素精度 (mm/px) 或 null
 */
export function calculateResolutionPerPixel(
  fov: { width: number; height: number } | null,
  resolution: { width: number; height: number } | null
): number | null {
  if (!fov || !resolution) return null;
  if (resolution.width <= 0 || resolution.height <= 0) return null;
  
  // 取较小的精度值（更保守）
  const resX = fov.width / resolution.width;
  const resY = fov.height / resolution.height;
  
  return Math.max(resX, resY); // 取较大值作为实际精度
}

/**
 * 格式化像素精度为字符串
 * @param value 像素精度值
 * @param decimals 小数位数
 * @returns 格式化字符串
 */
export function formatResolutionPerPixel(value: number | null, decimals: number = 4): string {
  if (value === null || isNaN(value)) return '';
  
  // 根据值的大小自动调整小数位数
  if (value < 0.001) {
    return value.toFixed(6);
  } else if (value < 0.01) {
    return value.toFixed(5);
  } else if (value < 0.1) {
    return value.toFixed(4);
  } else {
    return value.toFixed(3);
  }
}

/**
 * 根据精度要求反推所需相机分辨率
 * @param fov 视野范围 (mm)
 * @param targetResolution 目标精度 (mm/px)
 * @returns 推荐的最小分辨率
 */
export function calculateRequiredResolution(
  fov: { width: number; height: number },
  targetResolution: number
): { width: number; height: number; megapixels: number } {
  const width = Math.ceil(fov.width / targetResolution);
  const height = Math.ceil(fov.height / targetResolution);
  const megapixels = (width * height) / 1000000;
  
  return { width, height, megapixels };
}

/**
 * 根据相机传感器尺寸和镜头焦距计算工作距离
 * WD = f * (FOV / sensor_width)  薄透镜近似
 */
export function calculateWorkingDistance(
  sensorSize: string,
  focalLength: number,
  fovWidth: number
): number | null {
  const sensorWidth = SENSOR_WIDTH_MAP[sensorSize];
  if (!sensorWidth || focalLength <= 0) return null;
  const wd = focalLength * (fovWidth / sensorWidth);
  return Math.round(wd);
}

/**
 * 计算光学倍率 magnification = sensor_width / FOV_width
 */
export function calculateMagnification(
  sensorSize: string,
  fovWidth: number
): number | null {
  const sensor = parseSensorSize(sensorSize);
  if (!sensor || fovWidth <= 0) return null;
  return sensor.width / fovWidth;
}

/**
 * 根据 WD 和 FOV 推荐焦距
 * f = WD * sensor_width / FOV_width
 */
export function recommendFocalLength(
  sensorSize: string,
  workingDistance: number,
  fovWidth: number
): number | null {
  const sensorWidth = SENSOR_WIDTH_MAP[sensorSize];
  if (!sensorWidth || workingDistance <= 0 || fovWidth <= 0) return null;
  return Math.round(sensorWidth * workingDistance / fovWidth);
}

/**
 * 根据传感器尺寸和焦距/WD 反推 FOV
 * FOV_width = sensor_width * WD / f
 */
export function calculateFOVFromSensor(
  sensorSize: string,
  focalLength: number,
  workingDistance: number
): { width: number; height: number } | null {
  const sensor = parseSensorSize(sensorSize);
  if (!sensor || focalLength <= 0 || workingDistance <= 0) return null;
  const w = sensor.width * workingDistance / focalLength;
  const h = sensor.height * workingDistance / focalLength;
  return { width: Math.round(w * 100) / 100, height: Math.round(h * 100) / 100 };
}

/**
 * 景深计算 (经典公式)
 * DoF ≈ 2 * N * C * (m+1) / m²
 * 其中 N=光圈 F 值, C=弥散圆直径, m=倍率
 * 弥散圆取像素尺寸的 2 倍作为默认
 */
export function calculateDepthOfField(params: {
  fNumber: number;         // 光圈 F 值
  magnification: number;   // 光学倍率
  circleOfConfusion?: number; // 弥散圆 (mm), 默认 0.01
}): number | null {
  const { fNumber, magnification, circleOfConfusion = 0.01 } = params;
  if (fNumber <= 0 || magnification <= 0) return null;
  const dof = 2 * fNumber * circleOfConfusion * (magnification + 1) / (magnification * magnification);
  return Math.round(dof * 100) / 100;
}

// ===================== 镜头-相机匹配判断 =====================

export type LensCameraMatchStatus = 'matched' | 'lens_insufficient' | 'camera_redundant';

export interface LensCameraMatchResult {
  status: LensCameraMatchStatus;
  cameraNyquistLpMm: number;
  lensResolvingLpMm: number;
  lensIsEstimated: boolean;
  ratio: number;
  message: string;
  suggestion: string | null;
}

/**
 * 判断镜头解析力是否能"带得动"相机。
 *
 * 原理：
 *   pixelPitch = sensorWidth / cameraResWidth  (mm)
 *   cameraNyquist = 1 / (2 * pixelPitch)       (lp/mm, 像面)
 *   lensDiffractionLimit ≈ 1490 / fNumber       (lp/mm, 550nm Rayleigh)
 *
 * 当有手工录入的 lensResolvingPower 时优先使用，否则用衍射极限估算。
 */
export function checkLensCameraMatch(params: {
  sensorSize: string;
  cameraResolutionWidth: number;
  fNumber: number;
  lensResolvingPower?: number;
}): LensCameraMatchResult | null {
  const sensorWidth = SENSOR_WIDTH_MAP[params.sensorSize];
  if (!sensorWidth || params.cameraResolutionWidth <= 0 || params.fNumber <= 0) return null;

  const pixelPitch = sensorWidth / params.cameraResolutionWidth;
  const cameraNyquist = 1 / (2 * pixelPitch);

  let lensLpMm: number;
  let estimated: boolean;
  if (params.lensResolvingPower && params.lensResolvingPower > 0) {
    lensLpMm = params.lensResolvingPower;
    estimated = false;
  } else {
    lensLpMm = 1490 / params.fNumber;
    estimated = true;
  }

  const ratio = lensLpMm / cameraNyquist;
  const ratioRounded = Math.round(ratio * 100) / 100;

  let status: LensCameraMatchStatus;
  let message: string;
  let suggestion: string | null;

  if (ratio < 1.0) {
    status = 'lens_insufficient';
    message = '镜头分辨力不足，无法发挥相机全部像素';
    suggestion = '建议更换更高分辨力的镜头，或降低相机分辨率';
  } else if (ratio > 2.0) {
    status = 'camera_redundant';
    message = '镜头分辨力充足，相机像素密度偏高';
    suggestion = '当前配置可行，但相机存在一定冗余';
  } else {
    status = 'matched';
    message = '镜头与相机匹配良好';
    suggestion = null;
  }

  return {
    status,
    cameraNyquistLpMm: Math.round(cameraNyquist * 10) / 10,
    lensResolvingLpMm: Math.round(lensLpMm * 10) / 10,
    lensIsEstimated: estimated,
    ratio: ratioRounded,
    message,
    suggestion,
  };
}

// ===================== 靶面兼容性与隧道效应校验 =====================

export type SensorCheckSeverity = 'ok' | 'warning' | 'error';

export interface SensorCheckItem {
  id: string;
  severity: SensorCheckSeverity;
  message: string;
  detail: string;
}

export interface SensorCompatibilityResult {
  overallSeverity: SensorCheckSeverity;
  items: SensorCheckItem[];
  sensorDiagonalMm: number | null;
  lensMaxDiagonalMm: number | null;
  lensMaxIsEstimated: boolean;
}

/** 卡口 → 最大覆盖靶面代号 */
export const MOUNT_MAX_SENSOR_MAP: Record<string, string> = {
  'C':        '2/3',
  'C-mount':  '2/3',
  'CS':       '1/2',
  'CS-mount': '1/2',
  'F':        '35mm',
  'F-mount':  '35mm',
  'M42':      '35mm',
  'M12':      '1/3',
  'S-mount':  '1/3',
  'S':        '1/3',
};

function sensorDiagonal(sensorSize: string): number | null {
  const s = parseSensorSize(sensorSize);
  if (!s) return null;
  return Math.sqrt(s.width * s.width + s.height * s.height);
}

/**
 * 靶面兼容性与隧道效应综合校验。
 *
 * 检查项：
 *   1. tunnel_effect — 镜头像圈 vs 相机靶面对角线
 *   2. fov_mismatch  — 用户输入 FOV vs 靶面反推 FOV 偏差
 *   3. high_magnification — 倍率 > 1 的微距提醒
 */
export function checkSensorCompatibility(params: {
  sensorSize: string;
  lensMount?: string;
  lensMaxSensorSize?: string;
  fovParsed?: { width: number; height: number } | null;
  fovFromSensor?: { width: number; height: number } | null;
  magnification?: number | null;
}): SensorCompatibilityResult {
  const items: SensorCheckItem[] = [];
  const sensorDiag = sensorDiagonal(params.sensorSize);
  let lensMaxDiag: number | null = null;
  let estimated = true;

  // --- 1. Tunnel effect ---
  const maxSensorKey = params.lensMaxSensorSize
    || (params.lensMount ? MOUNT_MAX_SENSOR_MAP[params.lensMount] || MOUNT_MAX_SENSOR_MAP[params.lensMount.replace(/-?mount$/i, '')] : undefined);

  if (maxSensorKey) {
    estimated = !params.lensMaxSensorSize;
    lensMaxDiag = sensorDiagonal(maxSensorKey);
  }

  if (sensorDiag && lensMaxDiag) {
    const overRatio = sensorDiag / lensMaxDiag;
    const overPct = Math.round((overRatio - 1) * 100);
    const sensorDiagR = Math.round(sensorDiag * 10) / 10;
    const lensMaxDiagR = Math.round(lensMaxDiag * 10) / 10;
    const source = estimated ? `${params.lensMount} 卡口推算` : '手工指定';

    if (overRatio <= 1.0) {
      items.push({
        id: 'tunnel_effect',
        severity: 'ok',
        message: '靶面与镜头像圈匹配',
        detail: `靶面对角线 ${sensorDiagR}mm，镜头覆盖 ${lensMaxDiagR}mm（${source}）`,
      });
    } else if (overRatio <= 1.2) {
      items.push({
        id: 'tunnel_effect',
        severity: 'warning',
        message: '靶面接近镜头像圈边缘，可能出现轻微暗角',
        detail: `靶面对角线 ${sensorDiagR}mm 超出镜头覆盖 ${lensMaxDiagR}mm（${source}），超出 ${overPct}%`,
      });
    } else {
      items.push({
        id: 'tunnel_effect',
        severity: 'error',
        message: '镜头像圈不足，将产生隧道效应（暗角/四角无像）',
        detail: `靶面对角线 ${sensorDiagR}mm 超出镜头覆盖 ${lensMaxDiagR}mm（${source}），超出 ${overPct}%`,
      });
    }
  }

  // --- 2. FOV mismatch ---
  if (params.fovParsed && params.fovFromSensor) {
    const inputW = params.fovParsed.width;
    const calcW = params.fovFromSensor.width;
    if (inputW > 0 && calcW > 0) {
      const deviation = Math.abs(inputW - calcW) / calcW;
      const devPct = Math.round(deviation * 100);
      if (deviation <= 0.15) {
        items.push({
          id: 'fov_mismatch',
          severity: 'ok',
          message: 'FOV 与光学参数一致',
          detail: `输入 FOV 宽 ${inputW}mm，靶面推算 ${calcW}mm，偏差 ${devPct}%`,
        });
      } else if (deviation <= 0.4) {
        items.push({
          id: 'fov_mismatch',
          severity: 'warning',
          message: '输入 FOV 与靶面/焦距/WD 推算值偏差较大，请核实',
          detail: `输入 FOV 宽 ${inputW}mm，靶面推算 ${calcW}mm，偏差 ${devPct}%`,
        });
      } else {
        items.push({
          id: 'fov_mismatch',
          severity: 'error',
          message: 'FOV 与当前镜头/靶面/WD 组合严重不匹配',
          detail: `输入 FOV 宽 ${inputW}mm，靶面推算 ${calcW}mm，偏差 ${devPct}%`,
        });
      }
    }
  }

  // --- 3. High magnification ---
  if (params.magnification && params.magnification > 1.0) {
    items.push({
      id: 'high_magnification',
      severity: 'warning',
      message: `光学倍率 ${params.magnification.toFixed(3)}× 大于 1，属于微距/近摄范围`,
      detail: '请确认是否为微距应用，普通工业镜头在高倍率下成像质量可能下降',
    });
  }

  // Overall severity
  let overallSeverity: SensorCheckSeverity = 'ok';
  for (const item of items) {
    if (item.severity === 'error') { overallSeverity = 'error'; break; }
    if (item.severity === 'warning') overallSeverity = 'warning';
  }

  return {
    overallSeverity,
    items,
    sensorDiagonalMm: sensorDiag ? Math.round(sensorDiag * 10) / 10 : null,
    lensMaxDiagonalMm: lensMaxDiag ? Math.round(lensMaxDiag * 10) / 10 : null,
    lensMaxIsEstimated: estimated,
  };
}

// ===================== 精度分析与像素冗余策略 =====================

export type RedundancyStrategy = 'conservative' | 'standard' | 'high' | 'custom';
export type PrecisionStatus = 'sufficient' | 'marginal' | 'insufficient';

const STRATEGY_REQUIRED_PIXELS: Record<Exclude<RedundancyStrategy, 'custom'>, number> = {
  conservative: 3,
  standard: 5,
  high: 10,
};

export interface PrecisionAnalysisResult {
  pixelSizeMm: number;
  targetFeatureSizeMm: number;
  featurePixels: number;
  strategy: RedundancyStrategy;
  requiredPixels: number;
  status: PrecisionStatus;
  engineeringAccuracy: number;
  meetsRequirement: boolean;
  message: string;
  suggestion: string | null;
}

/**
 * 精度分析：理论像素精度 → 特征覆盖像素数 → 冗余策略判断。
 *
 * featurePixels = targetFeatureSize / pixelSize
 * 阈值: <2 不可行, 2-requiredPixels 极限/不足, >=requiredPixels 满足
 */
export function calculatePrecisionAnalysis(params: {
  pixelSizeMm: number;
  targetFeatureSizeMm: number;
  strategy?: RedundancyStrategy;
  customRequiredPixels?: number;
}): PrecisionAnalysisResult {
  const { pixelSizeMm, targetFeatureSizeMm, strategy = 'standard' } = params;

  const requiredPixels = strategy === 'custom'
    ? (params.customRequiredPixels ?? 5)
    : STRATEGY_REQUIRED_PIXELS[strategy];

  const featurePixels = pixelSizeMm > 0 ? targetFeatureSizeMm / pixelSizeMm : 0;
  const featurePixelsR = Math.round(featurePixels * 10) / 10;
  const engineeringAccuracy = Math.round(pixelSizeMm * requiredPixels * 10000) / 10000;

  let status: PrecisionStatus;
  let message: string;
  let suggestion: string | null = null;

  const strategyLabel = strategy === 'conservative' ? '保守' : strategy === 'standard' ? '标准' : strategy === 'high' ? '高冗余' : `自定义(${requiredPixels}px)`;

  if (featurePixels >= requiredPixels) {
    status = 'sufficient';
    message = `目标特征 ${targetFeatureSizeMm}mm 覆盖 ${featurePixelsR} 像素，满足${strategyLabel}冗余要求(≥${requiredPixels}px)`;
  } else if (featurePixels >= 2) {
    status = 'marginal';
    message = `目标特征 ${targetFeatureSizeMm}mm 覆盖 ${featurePixelsR} 像素，低于${strategyLabel}要求(≥${requiredPixels}px)，但超过奈奎斯特极限(2px)`;
    suggestion = '当前精度处于极限范围，建议提高分辨率或缩小视野';
  } else {
    status = 'insufficient';
    message = `目标特征 ${targetFeatureSizeMm}mm 仅覆盖 ${featurePixelsR} 像素，低于奈奎斯特极限(2px)`;
    suggestion = '需要更高分辨率相机或缩小视野以提升像素精度';
  }

  return {
    pixelSizeMm,
    targetFeatureSizeMm,
    featurePixels: featurePixelsR,
    strategy,
    requiredPixels,
    status,
    engineeringAccuracy,
    meetsRequirement: featurePixels >= requiredPixels,
    message,
    suggestion,
  };
}

// ===================== FOV 靶面联动修正 =====================

export interface FOVReconciliation {
  inputFov: { width: number; height: number };
  effectiveFov: { width: number; height: number };
  sensorFov: { width: number; height: number } | null;
  wasAdjusted: boolean;
  adjustedAxis: 'width' | 'height' | 'both' | null;
  message: string | null;
}

/**
 * FOV 向上修正：当用户输入 FOV 小于靶面推算 FOV 时，
 * 自动扩大到靶面理论最小值（物理约束）。
 * 只会放大，不会缩小，天然避免循环联动。
 */
export function reconcileFOV(params: {
  inputFov: { width: number; height: number } | null;
  sensorFov: { width: number; height: number } | null;
}): FOVReconciliation | null {
  if (!params.inputFov) return null;
  if (!params.sensorFov) {
    return {
      inputFov: params.inputFov,
      effectiveFov: params.inputFov,
      sensorFov: null,
      wasAdjusted: false,
      adjustedAxis: null,
      message: null,
    };
  }

  const ceil1 = (v: number) => Math.ceil(v * 10) / 10;
  const sW = ceil1(params.sensorFov.width);
  const sH = ceil1(params.sensorFov.height);

  const effW = Math.max(params.inputFov.width, sW);
  const effH = Math.max(params.inputFov.height, sH);

  const wAdj = effW > params.inputFov.width;
  const hAdj = effH > params.inputFov.height;
  const wasAdjusted = wAdj || hAdj;
  const adjustedAxis: FOVReconciliation['adjustedAxis'] = wAdj && hAdj ? 'both' : wAdj ? 'width' : hAdj ? 'height' : null;

  let message: string | null = null;
  if (wasAdjusted) {
    const parts: string[] = [];
    if (wAdj) parts.push(`宽度 ${params.inputFov.width}→${effW}mm`);
    if (hAdj) parts.push(`高度 ${params.inputFov.height}→${effH}mm`);
    message = `FOV ${parts.join('、')} 已修正为靶面理论最小视野（靶面+焦距+WD 约束）`;
  }

  return {
    inputFov: params.inputFov,
    effectiveFov: { width: effW, height: effH },
    sensorFov: params.sensorFov,
    wasAdjusted,
    adjustedAxis,
    message,
  };
}

// ===================== 综合计算 =====================

export interface ImagingCalculationInput {
  cameraResolution?: string;
  fov?: string;
  targetAccuracy?: number;
  sensorSize?: string;
  focalLength?: number;
  workingDistanceInput?: number;
  fNumber?: number;
  lensResolvingPower?: number;
  lensMount?: string;
  lensMaxSensorSize?: string;
  targetFeatureSizeMm?: number;
  redundancyStrategy?: RedundancyStrategy;
  customRequiredPixels?: number;
}

export interface ImagingCalculationResult {
  resolutionPerPixel: string | null;
  resolutionPerPixelNum: number | null;
  fovParsed: { width: number; height: number } | null;
  fovEffective: { width: number; height: number } | null;
  cameraParsed: { width: number; height: number } | null;
  workingDistance: number | null;
  meetsAccuracy: boolean | null;
  recommendedCamera: string | null;
  magnification: number | null;
  recommendedFocalLength: number | null;
  depthOfField: number | null;
  fovFromSensor: { width: number; height: number } | null;
  fovReconciliation: FOVReconciliation | null;
  lensCameraMatch: LensCameraMatchResult | null;
  sensorCheck: SensorCompatibilityResult | null;
  precisionAnalysis: PrecisionAnalysisResult | null;
}

export function calculateImagingParams(input: ImagingCalculationInput): ImagingCalculationResult {
  const cameraParsed = parseResolution(input.cameraResolution || '');
  const fovParsed = parseFOV(input.fov || '');

  // 靶面反推 FOV（需要在 reconcile 之前计算）
  let fovFromSensor: { width: number; height: number } | null = null;
  if (input.sensorSize && input.focalLength && input.workingDistanceInput) {
    fovFromSensor = calculateFOVFromSensor(input.sensorSize, input.focalLength, input.workingDistanceInput);
  }

  // FOV 靶面联动修正：用户输入 < 靶面推算 → 向上修正
  const fovReconciliation = reconcileFOV({ inputFov: fovParsed, sensorFov: fovFromSensor });
  const fovEffective = fovReconciliation?.effectiveFov ?? fovParsed;

  // 用修正后的 FOV 计算像素精度（核心下游依赖）
  const resolutionPerPixelNum = calculateResolutionPerPixel(fovEffective, cameraParsed);
  const resolutionPerPixel = formatResolutionPerPixel(resolutionPerPixelNum);
  
  // 精度分析
  let precisionAnalysis: PrecisionAnalysisResult | null = null;
  let meetsAccuracy: boolean | null = null;
  let recommendedCamera: string | null = null;

  const featureSize = input.targetFeatureSizeMm ?? input.targetAccuracy;
  if (featureSize && featureSize > 0 && resolutionPerPixelNum !== null) {
    precisionAnalysis = calculatePrecisionAnalysis({
      pixelSizeMm: resolutionPerPixelNum,
      targetFeatureSizeMm: featureSize,
      strategy: input.redundancyStrategy,
      customRequiredPixels: input.customRequiredPixels,
    });
    meetsAccuracy = precisionAnalysis.meetsRequirement;

    if (!meetsAccuracy && fovEffective) {
      const requiredRes = featureSize / (input.redundancyStrategy === 'conservative' ? 3 : input.redundancyStrategy === 'high' ? 10 : 5);
      const required = calculateRequiredResolution(fovEffective, requiredRes);
      recommendedCamera = `${required.width}x${required.height} (${required.megapixels.toFixed(1)}MP)`;
    }
  }
  
  // 用修正后的 FOV 计算工作距离
  let workingDistance: number | null = null;
  if (input.sensorSize && input.focalLength && fovEffective) {
    workingDistance = calculateWorkingDistance(input.sensorSize, input.focalLength, fovEffective.width);
  }
  
  // 用修正后的 FOV 计算倍率
  let magnification: number | null = null;
  if (input.sensorSize && fovEffective) {
    magnification = calculateMagnification(input.sensorSize, fovEffective.width);
  }
  
  // 推荐焦距
  let recommendedFocalLength: number | null = null;
  if (input.sensorSize && input.workingDistanceInput && fovEffective) {
    recommendedFocalLength = recommendFocalLength(input.sensorSize, input.workingDistanceInput, fovEffective.width);
  }
  
  // 景深
  let depthOfField: number | null = null;
  if (input.fNumber && magnification && magnification > 0) {
    const pixelSize = (resolutionPerPixelNum && magnification)
      ? resolutionPerPixelNum * magnification
      : undefined;
    const coc = pixelSize ? pixelSize * 2 : 0.01;
    depthOfField = calculateDepthOfField({
      fNumber: input.fNumber,
      magnification,
      circleOfConfusion: coc,
    });
  }

  // 镜头-相机匹配判断
  let lensCameraMatch: LensCameraMatchResult | null = null;
  if (input.sensorSize && cameraParsed && input.fNumber) {
    lensCameraMatch = checkLensCameraMatch({
      sensorSize: input.sensorSize,
      cameraResolutionWidth: cameraParsed.width,
      fNumber: input.fNumber,
      lensResolvingPower: input.lensResolvingPower,
    });
  }

  // 靶面兼容性与隧道效应校验
  let sensorCheck: SensorCompatibilityResult | null = null;
  if (input.sensorSize && (input.lensMount || input.lensMaxSensorSize)) {
    sensorCheck = checkSensorCompatibility({
      sensorSize: input.sensorSize,
      lensMount: input.lensMount,
      lensMaxSensorSize: input.lensMaxSensorSize,
      fovParsed: fovEffective,
      fovFromSensor,
      magnification,
    });
  }
  
  return {
    resolutionPerPixel,
    resolutionPerPixelNum,
    fovParsed,
    fovEffective,
    cameraParsed,
    workingDistance,
    meetsAccuracy,
    recommendedCamera,
    magnification,
    recommendedFocalLength,
    depthOfField,
    fovFromSensor,
    fovReconciliation,
    lensCameraMatch,
    sensorCheck,
    precisionAnalysis,
  };
}
