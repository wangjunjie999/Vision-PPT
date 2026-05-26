/**
 * 飞拍 (Flying Shot) 参数计算工具
 * 用于线阵/面阵飞拍场景下的运动模糊、编码器分频、最大曝光等工程计算
 */

// ===================== 快门类型与飞拍适用性 =====================

export type ShutterType = 'global' | 'global_reset' | 'rolling' | 'unknown';
export type FlyingShotRisk = 'none' | 'low' | 'high' | 'critical';

export interface FlyingShotIssue {
  id: string;
  risk: FlyingShotRisk;
  message: string;
  detail: string;
}

export interface FlyingShotSuitability {
  suitable: boolean;
  overallRisk: FlyingShotRisk;
  issues: FlyingShotIssue[];
  shutterType: ShutterType;
  params: FlyingShotResult;
}

const GLOBAL_KEYWORDS = ['global shutter', 'global_shutter', '全局快门', 'gs'];
const GLOBAL_RESET_KEYWORDS = ['global reset', 'global_reset', '全局复位'];

/**
 * 从字符串或 tags 数组推断快门类型。
 * 优先使用 raw（Camera.shutter_type），fallback 到 tags 关键词匹配。
 */
export function parseShutterType(raw?: string | null, tags?: string[] | null): ShutterType {
  if (raw) {
    const lower = raw.trim().toLowerCase();
    if (lower === 'global' || lower === 'global_shutter' || lower === 'global shutter') return 'global';
    if (lower === 'global_reset' || lower === 'global reset') return 'global_reset';
    if (lower === 'rolling' || lower === 'rolling_shutter' || lower === 'rolling shutter') return 'rolling';
  }
  if (tags && tags.length > 0) {
    const joined = tags.join(' ').toLowerCase();
    if (GLOBAL_RESET_KEYWORDS.some(k => joined.includes(k))) return 'global_reset';
    if (GLOBAL_KEYWORDS.some(k => joined.includes(k))) return 'global';
    if (joined.includes('rolling')) return 'rolling';
  }
  return 'unknown';
}

const RISK_ORDER: Record<FlyingShotRisk, number> = { none: 0, low: 1, high: 2, critical: 3 };

function maxRisk(risks: FlyingShotRisk[]): FlyingShotRisk {
  let max: FlyingShotRisk = 'none';
  for (const r of risks) {
    if (RISK_ORDER[r] > RISK_ORDER[max]) max = r;
  }
  return max;
}

/**
 * 飞拍综合适用性评估：快门校验 + 拖影校验 + 帧率校验。
 * 内部调用 calculateFlyingShotParams 获取基础运动参数，再叠加风险判断。
 */
export function evaluateFlyingShotSuitability(input: {
  lineSpeed: number;
  exposureTimeUs: number;
  pixelSize: number;
  shutterType: ShutterType;
  frameRate?: number;
  fovWidth?: number;
  allowedBlurPixels?: number;
  encoderResolution?: number;
  triggerInterval?: number;
  overlapRate?: number;
}): FlyingShotSuitability {
  const { allowedBlurPixels = 0.5 } = input;

  const params = calculateFlyingShotParams({
    lineSpeed: input.lineSpeed,
    exposureTime: input.exposureTimeUs,
    pixelSize: input.pixelSize,
    fovWidth: input.fovWidth,
    allowedBlurPixels,
    encoderResolution: input.encoderResolution,
    triggerInterval: input.triggerInterval,
    overlapRate: input.overlapRate,
  });

  const issues: FlyingShotIssue[] = [];

  // 1) Shutter type
  if (input.shutterType === 'rolling') {
    issues.push({
      id: 'shutter',
      risk: 'critical',
      message: '卷帘快门不适合飞拍，将产生果冻效应/行间形变',
      detail: '飞拍场景需要全局快门相机，当前为卷帘快门',
    });
  } else if (input.shutterType === 'global_reset') {
    issues.push({
      id: 'shutter',
      risk: 'low',
      message: '全局复位快门，高速飞拍时可能有轻微果冻效应',
      detail: '全局复位(Global Reset)并非真正同步曝光，建议在高速场景下测试验证',
    });
  } else if (input.shutterType === 'unknown') {
    issues.push({
      id: 'shutter',
      risk: 'low',
      message: '快门类型未知，建议确认是否为全局快门',
      detail: '飞拍场景推荐全局快门相机，请在相机参数中确认快门类型',
    });
  }

  // 2) Motion blur
  if (params.motionBlurPixels > 1.0) {
    issues.push({
      id: 'blur',
      risk: 'high',
      message: `拖影 ${params.motionBlurPixels}px 严重超标（允许 ${allowedBlurPixels}px）`,
      detail: `当前速度 ${input.lineSpeed}mm/s + 曝光 ${input.exposureTimeUs}us 导致拖影过大，建议缩短曝光或降低速度`,
    });
  } else if (params.motionBlurPixels > allowedBlurPixels) {
    issues.push({
      id: 'blur',
      risk: 'low',
      message: `拖影 ${params.motionBlurPixels}px 接近极限（允许 ${allowedBlurPixels}px）`,
      detail: `最大允许曝光 ${params.maxExposureUs}us，建议适当缩短曝光时间`,
    });
  }

  // 3) Frame rate
  if (input.frameRate && input.frameRate > 0 && params.triggerFrequencyHz !== null) {
    if (params.triggerFrequencyHz > input.frameRate * 0.9) {
      issues.push({
        id: 'framerate',
        risk: 'high',
        message: `触发频率 ${params.triggerFrequencyHz}Hz 接近相机帧率上限 ${input.frameRate}fps`,
        detail: '相机可能无法在每个触发周期内完成曝光和传输，建议降低线速或增大触发间距',
      });
    }
  }

  const overallRisk = maxRisk(issues.map(i => i.risk));

  return {
    suitable: overallRisk !== 'critical',
    overallRisk,
    issues,
    shutterType: input.shutterType,
    params,
  };
}

export interface FlyingShotInput {
  lineSpeed: number;          // 线体速度 (mm/s)
  exposureTime: number;       // 曝光时间 (us)
  pixelSize: number;          // 像素精度 (mm/px), 即 FOV/分辨率
  encoderResolution?: number; // 编码器分辨率 (脉冲/mm)
  allowedBlurPixels?: number; // 允许的模糊像素数, 默认 0.5
  triggerInterval?: number;   // 触发间隔 (mm), 面阵飞拍时每次拍照的间距
  fovWidth?: number;          // 视野宽度 (mm), 运动方向
  overlapRate?: number;       // 重叠率 (0-1), 默认 0.1
}

export interface FlyingShotResult {
  motionBlurMm: number;              // 运动模糊量 (mm)
  motionBlurPixels: number;          // 运动模糊量 (px)
  isBlurAcceptable: boolean;         // 模糊是否在允许范围内
  maxExposureUs: number;             // 最大允许曝光时间 (us)
  encoderDivision: number | null;    // 编码器分频系数
  lineFrequencyHz: number | null;    // 行频 (Hz), 线阵场景
  triggerFrequencyHz: number | null; // 触发频率 (Hz), 面阵飞拍
  maxLineSpeed: number;              // 在当前曝光下的最大速度 (mm/s)
  recommendedTriggerInterval: number | null; // 推荐触发间距 (mm)
}

/**
 * 运动模糊量 = 线速度 * 曝光时间
 */
export function calculateMotionBlur(lineSpeed: number, exposureTimeUs: number): number {
  return lineSpeed * (exposureTimeUs / 1e6);
}

/**
 * 最大允许曝光时间 = 允许模糊像素 * 像素精度 / 线速度
 */
export function calculateMaxExposure(
  lineSpeed: number,
  pixelSize: number,
  allowedBlurPixels: number = 0.5
): number {
  if (lineSpeed <= 0) return 999999;
  return (allowedBlurPixels * pixelSize / lineSpeed) * 1e6;
}

/**
 * 编码器分频 = 像素精度 * 编码器分辨率
 * 每前进一个像素所需的编码器脉冲数
 */
export function calculateEncoderDivision(
  pixelSize: number,
  encoderResolution: number
): number {
  return Math.round(pixelSize * encoderResolution);
}

/**
 * 线阵行频 = 线速度 / 像素精度
 */
export function calculateLineFrequency(lineSpeed: number, pixelSize: number): number {
  if (pixelSize <= 0) return 0;
  return lineSpeed / pixelSize;
}

/**
 * 面阵飞拍触发频率 = 线速度 / 触发间距
 */
export function calculateTriggerFrequency(lineSpeed: number, triggerInterval: number): number {
  if (triggerInterval <= 0) return 0;
  return lineSpeed / triggerInterval;
}

/**
 * 推荐触发间距 = FOV * (1 - overlapRate)
 */
export function calculateRecommendedTriggerInterval(
  fovWidth: number,
  overlapRate: number = 0.1
): number {
  return fovWidth * (1 - overlapRate);
}

/**
 * 综合飞拍参数计算
 */
export function calculateFlyingShotParams(input: FlyingShotInput): FlyingShotResult {
  const { allowedBlurPixels = 0.5, overlapRate = 0.1 } = input;

  const motionBlurMm = calculateMotionBlur(input.lineSpeed, input.exposureTime);
  const motionBlurPixels = input.pixelSize > 0 ? motionBlurMm / input.pixelSize : 0;
  const isBlurAcceptable = motionBlurPixels <= allowedBlurPixels;

  const maxExposureUs = calculateMaxExposure(input.lineSpeed, input.pixelSize, allowedBlurPixels);

  const encoderDivision = input.encoderResolution
    ? calculateEncoderDivision(input.pixelSize, input.encoderResolution)
    : null;

  const lineFrequencyHz = calculateLineFrequency(input.lineSpeed, input.pixelSize);

  let triggerFrequencyHz: number | null = null;
  let recommendedTriggerInterval: number | null = null;
  if (input.fovWidth && input.fovWidth > 0) {
    recommendedTriggerInterval = calculateRecommendedTriggerInterval(input.fovWidth, overlapRate);
    const interval = input.triggerInterval || recommendedTriggerInterval;
    triggerFrequencyHz = calculateTriggerFrequency(input.lineSpeed, interval);
  }

  const maxLineSpeed = input.pixelSize > 0 && input.exposureTime > 0
    ? (allowedBlurPixels * input.pixelSize) / (input.exposureTime / 1e6)
    : 0;

  return {
    motionBlurMm: Math.round(motionBlurMm * 10000) / 10000,
    motionBlurPixels: Math.round(motionBlurPixels * 100) / 100,
    isBlurAcceptable,
    maxExposureUs: Math.round(maxExposureUs * 10) / 10,
    encoderDivision,
    lineFrequencyHz: Math.round(lineFrequencyHz),
    triggerFrequencyHz: triggerFrequencyHz !== null ? Math.round(triggerFrequencyHz * 10) / 10 : null,
    maxLineSpeed: Math.round(maxLineSpeed),
    recommendedTriggerInterval: recommendedTriggerInterval !== null
      ? Math.round(recommendedTriggerInterval * 100) / 100
      : null,
  };
}
