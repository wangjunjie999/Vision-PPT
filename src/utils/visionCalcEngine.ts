/**
 * Vision Calculation Engine — 统一计算入口
 *
 * 将光学参数、飞拍参数、工位节拍分解三大计算模块聚合为单一 facade，
 * 组件只需传入原始表单字符串字段，引擎内部完成解析与计算。
 */

import {
  calculateImagingParams,
  type ImagingCalculationInput,
  type ImagingCalculationResult,
} from './imagingCalculations';
import {
  calculateFlyingShotParams,
  evaluateFlyingShotSuitability,
  parseShutterType,
  type FlyingShotInput,
  type FlyingShotResult,
  type FlyingShotSuitability,
} from './flyingShotCalculations';
import {
  calculateCycleTime,
  quickCycleTimeCheck,
  type CycleTimeInput,
  type CycleTimeResult,
} from './cycleTimeCalculations';

// ===================== 通用解析工具 =====================

/**
 * 解析曝光时间字符串为微秒 (us)。
 * 支持格式: "10ms" → 10000, "500us" → 500, "500" → 500 (默认 us)
 */
export function parseExposureToUs(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const matchMs = trimmed.match(/^(\d+(?:\.\d+)?)\s*ms$/);
  if (matchMs) return parseFloat(matchMs[1]) * 1000;

  const matchUs = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:us|μs)$/);
  if (matchUs) return parseFloat(matchUs[1]);

  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * 解析光圈 F 值字符串: "F2.8" / "f/4" / "2.8" → 2.8
 */
export function parseFNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[Ff]\/?/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

/**
 * 安全 parseFloat，返回 null 而非 NaN
 */
function safeFloat(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ===================== 统一输入/输出接口 =====================

/** 接收原始表单字符串，无需调用方自行 parseFloat */
export interface VisionCalcRawInput {
  // —— 光学 ——
  cameraResolution?: string;
  sensorSize?: string;
  focalLengthStr?: string;
  fNumberStr?: string;
  fov?: string;
  workingDistance?: string;
  targetAccuracy?: string;
  lensResolvingPower?: string;
  lensMount?: string;
  lensMaxSensorSize?: string;
  // —— 精度 ——
  targetFeatureSizeMm?: string;
  redundancyStrategy?: string;
  customRequiredPixels?: string;
  // —— 飞拍 ——
  exposure?: string;
  lineSpeed?: string;
  triggerType?: string;
  encoderResolution?: string;
  triggerInterval?: string;
  fovOverlapRate?: string;
  cameraShutterType?: string;
  cameraTags?: string[];
  cameraFrameRate?: string;
  // —— 工位节拍 ——
  targetCycleTimeS?: string;
  shotCount?: string;
  shotInterval?: string;
  processingTimesMs?: number[];
  mechanismMoveTimeMs?: string;
  ioResponseTimeMs?: string;
  triggerDelayMs?: string;
  transferTimeMs?: string;
  productLoadUnloadMs?: string;
  parallelProcessing?: string;
}

/** 引擎解析后的中间数值，便于组件直接使用 */
export interface ParsedValues {
  exposureUs: number | null;
  lineSpeedMm: number | null;
  focalLength: number | null;
  fNumber: number | null;
  workingDistanceMm: number | null;
}

/** 一站式计算的完整输出 */
export interface VisionCalcFullResult {
  imaging: ImagingCalculationResult;
  flyingShot: FlyingShotSuitability | null;
  cycleTime: CycleTimeResult | null;
  parsed: ParsedValues;
}

// ===================== 一站式计算 =====================

export function computeVisionParams(input: VisionCalcRawInput): VisionCalcFullResult {
  const focalLength = safeFloat(input.focalLengthStr);
  const fNumber = parseFNumber(input.fNumberStr);
  const workingDistanceMm = safeFloat(input.workingDistance);
  const targetAccuracy = safeFloat(input.targetAccuracy);
  const exposureUs = parseExposureToUs(input.exposure);
  const lineSpeedMm = safeFloat(input.lineSpeed);

  const lensResolvingPower = safeFloat(input.lensResolvingPower);

  const targetFeatureSizeMm = safeFloat(input.targetFeatureSizeMm);
  const customRequiredPixels = safeFloat(input.customRequiredPixels);
  const redundancyStrategy = (['conservative', 'standard', 'high', 'custom'].includes(input.redundancyStrategy || '')
    ? input.redundancyStrategy
    : undefined) as ImagingCalculationInput['redundancyStrategy'];

  // 1) 成像参数
  const imagingInput: ImagingCalculationInput = {
    cameraResolution: input.cameraResolution,
    fov: input.fov,
    sensorSize: input.sensorSize,
    focalLength: focalLength ?? undefined,
    workingDistanceInput: workingDistanceMm ?? undefined,
    targetAccuracy: targetAccuracy ?? undefined,
    fNumber: fNumber ?? undefined,
    lensResolvingPower: lensResolvingPower ?? undefined,
    lensMount: input.lensMount,
    lensMaxSensorSize: input.lensMaxSensorSize,
    targetFeatureSizeMm: targetFeatureSizeMm ?? undefined,
    redundancyStrategy,
    customRequiredPixels: customRequiredPixels ?? undefined,
  };
  const imaging = calculateImagingParams(imagingInput);

  // 2) 飞拍参数（仅 encoder / continuous 且有足够数据时计算）
  let flyingShot: FlyingShotSuitability | null = null;
  const isFlyingTrigger = input.triggerType === 'encoder' || input.triggerType === 'continuous';
  if (isFlyingTrigger && exposureUs && exposureUs > 0 && lineSpeedMm && lineSpeedMm > 0 && imaging.resolutionPerPixelNum) {
    const shutterType = parseShutterType(input.cameraShutterType, input.cameraTags);
    const frameRate = safeFloat(input.cameraFrameRate);
    flyingShot = evaluateFlyingShotSuitability({
      lineSpeed: lineSpeedMm,
      exposureTimeUs: exposureUs,
      pixelSize: imaging.resolutionPerPixelNum,
      shutterType,
      frameRate: frameRate ?? undefined,
      fovWidth: imaging.fovEffective?.width ?? imaging.fovParsed?.width,
      encoderResolution: safeFloat(input.encoderResolution) ?? undefined,
      triggerInterval: safeFloat(input.triggerInterval) ?? undefined,
      overlapRate: safeFloat(input.fovOverlapRate) ?? undefined,
    });
  }

  // 3) 工位节拍分解（仅有目标工位节拍和处理时间时计算）
  let cycleTimeResult: CycleTimeResult | null = null;
  const targetCycleTimeS = safeFloat(input.targetCycleTimeS);
  if (targetCycleTimeS && targetCycleTimeS > 0 && input.processingTimesMs && input.processingTimesMs.length > 0) {
    const frameRate = safeFloat(input.cameraFrameRate);
    const ctInput: CycleTimeInput = {
      targetCycleTimeS,
      processingTimesMs: input.processingTimesMs,
      shotCount: safeFloat(input.shotCount) ? Math.max(1, Math.round(safeFloat(input.shotCount)!)) : 1,
      shotInterval: safeFloat(input.shotInterval) ?? undefined,
      exposureTimeUs: exposureUs ?? undefined,
      cameraFrameRate: frameRate ?? undefined,
      mechanismMoveTimeMs: safeFloat(input.mechanismMoveTimeMs) ?? undefined,
      ioResponseTimeMs: safeFloat(input.ioResponseTimeMs) ?? undefined,
      triggerDelayMs: safeFloat(input.triggerDelayMs) ?? undefined,
      transferTimeMs: safeFloat(input.transferTimeMs) ?? undefined,
      productLoadUnloadMs: safeFloat(input.productLoadUnloadMs) ?? undefined,
      parallelProcessing: input.parallelProcessing === 'true',
    };
    cycleTimeResult = calculateCycleTime(ctInput);
  }

  return {
    imaging,
    flyingShot,
    cycleTime: cycleTimeResult,
    parsed: {
      exposureUs,
      lineSpeedMm,
      focalLength,
      fNumber,
      workingDistanceMm,
    },
  };
}

// ===================== Re-export 所有底层 API（向后兼容） =====================

export {
  calculateImagingParams,
  parseResolution,
  parseFOV,
  parseSensorSize,
  calculateResolutionPerPixel,
  formatResolutionPerPixel,
  calculateRequiredResolution,
  calculateWorkingDistance,
  calculateMagnification,
  recommendFocalLength,
  calculateFOVFromSensor,
  calculateDepthOfField,
  checkLensCameraMatch,
  checkSensorCompatibility,
  calculatePrecisionAnalysis,
  reconcileFOV,
  SENSOR_WIDTH_MAP,
  MOUNT_MAX_SENSOR_MAP,
} from './imagingCalculations';

export type {
  ImagingCalculationInput,
  ImagingCalculationResult,
  LensCameraMatchStatus,
  LensCameraMatchResult,
  SensorCheckSeverity,
  SensorCheckItem,
  SensorCompatibilityResult,
  RedundancyStrategy,
  PrecisionStatus,
  PrecisionAnalysisResult,
  FOVReconciliation,
  FOVReconciliationMode,
} from './imagingCalculations';

export {
  calculateFlyingShotParams,
  calculateMotionBlur,
  calculateMaxExposure,
  calculateEncoderDivision,
  calculateLineFrequency,
  calculateTriggerFrequency,
  calculateRecommendedTriggerInterval,
  evaluateFlyingShotSuitability,
  parseShutterType,
} from './flyingShotCalculations';

export type {
  FlyingShotInput,
  FlyingShotResult,
  ShutterType,
  FlyingShotRisk,
  FlyingShotIssue,
  FlyingShotSuitability,
} from './flyingShotCalculations';

export {
  calculateCycleTime,
  quickCycleTimeCheck,
} from './cycleTimeCalculations';

export type {
  CycleTimeInput,
  CycleTimeResult,
  CycleTimePhase,
} from './cycleTimeCalculations';
