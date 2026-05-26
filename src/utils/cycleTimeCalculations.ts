/**
 * 工位节拍 (Station Cycle Time) 分解与计算工具
 * 将工位节拍拆分为各阶段耗时，评估可行性
 */

export interface CycleTimePhase {
  name: string;        // 阶段名称
  durationMs: number;  // 耗时 (ms)
  parallel?: boolean;  // 是否与上一阶段并行
  percent?: number;    // 占总耗时百分比
}

export interface CycleTimeInput {
  targetCycleTimeS: number;           // 目标工位节拍 (s/pcs)
  mechanismMoveTimeMs?: number;       // 机构运动时间 (ms): 到位/翻转/升降等
  ioResponseTimeMs?: number;          // IO 响应延时 (ms)
  triggerDelayMs?: number;            // 触发延时 (ms)
  exposureTimeUs?: number;            // 曝光时间 (us)
  transferTimeMs?: number;            // 图像传输时间 (ms)
  processingTimesMs: number[];        // 各模块处理时间 (ms)
  parallelProcessing?: boolean;       // 多模块是否并行处理
  shotCount?: number;                 // 每件产品/每个工位循环拍照次数
  shotInterval?: number;              // 多次拍照间隔 (ms)
  productLoadUnloadMs?: number;       // 上下料时间 (ms)
  cameraFrameRate?: number;           // 相机帧率 (fps), 用于约束最小拍照间隔
}

export interface CycleTimeResult {
  phases: CycleTimePhase[];           // 各阶段明细（含 percent）
  totalSerialMs: number;              // 串行总耗时 (ms)
  totalEffectiveMs: number;           // 考虑并行后的有效耗时 (ms)
  targetMs: number;                   // 目标工位节拍 (ms)
  marginMs: number;                   // 裕量 (ms)
  marginPercent: number;              // 裕量百分比
  isFeasible: boolean;                // 是否可行
  throughputPerHour: number;          // 基于目标工位节拍的理论产能 (件/小时)
  actualThroughputPerHour: number;    // 基于实际耗时的产能 (件/小时)
  bottleneck: string;                 // 瓶颈环节
}

/**
 * 综合节拍分解计算
 */
export function calculateCycleTime(input: CycleTimeInput): CycleTimeResult {
  const {
    targetCycleTimeS,
    mechanismMoveTimeMs = 0,
    ioResponseTimeMs = 5,
    triggerDelayMs = 0,
    exposureTimeUs = 0,
    transferTimeMs = 0,
    processingTimesMs,
    parallelProcessing = false,
    shotCount = 1,
    shotInterval = 0,
    productLoadUnloadMs = 0,
    cameraFrameRate,
  } = input;

  const phases: CycleTimePhase[] = [];
  const targetMs = targetCycleTimeS * 1000;

  if (productLoadUnloadMs > 0) {
    phases.push({ name: '上下料', durationMs: productLoadUnloadMs });
  }

  if (mechanismMoveTimeMs > 0) {
    phases.push({ name: '机构运动/到位', durationMs: mechanismMoveTimeMs });
  }

  if (ioResponseTimeMs > 0) {
    phases.push({ name: 'IO响应', durationMs: ioResponseTimeMs });
  }

  if (triggerDelayMs > 0) {
    phases.push({ name: '触发延时', durationMs: triggerDelayMs });
  }

  // 拍照阶段：考虑帧率约束
  const exposureMs = exposureTimeUs / 1000;
  const minFrameIntervalMs = (cameraFrameRate && cameraFrameRate > 0)
    ? 1000 / cameraFrameRate
    : 0;
  const effectiveShotInterval = Math.max(shotInterval, minFrameIntervalMs);

  const totalShotMs = shotCount > 1
    ? exposureMs * shotCount + effectiveShotInterval * (shotCount - 1)
    : exposureMs;

  if (totalShotMs > 0) {
    let shotName = shotCount > 1 ? `拍照×${shotCount}` : '拍照/曝光';
    if (shotCount > 1 && minFrameIntervalMs > shotInterval && minFrameIntervalMs > 0) {
      shotName += ` (帧率${cameraFrameRate}fps约束)`;
    }
    phases.push({
      name: shotName,
      durationMs: Math.round(totalShotMs * 100) / 100,
    });
  }

  if (transferTimeMs > 0) {
    phases.push({ name: '图像传输', durationMs: transferTimeMs });
  }

  const maxProcessing = Math.max(...processingTimesMs, 0);
  const sumProcessing = processingTimesMs.reduce((a, b) => a + b, 0);
  const effectiveProcessingMs = parallelProcessing ? maxProcessing : sumProcessing;

  if (effectiveProcessingMs > 0) {
    phases.push({
      name: parallelProcessing
        ? `图像处理(并行, ${processingTimesMs.length}模块)`
        : `图像处理(串行, ${processingTimesMs.length}模块)`,
      durationMs: effectiveProcessingMs,
      parallel: false,
    });
  }

  const totalSerialMs = phases.reduce((acc, p) => acc + p.durationMs, 0);

  // Parallel phase compression: a parallel phase overlaps with its predecessor
  let totalEffectiveMs = 0;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (phase.parallel && i > 0) {
      const prev = phases[i - 1];
      totalEffectiveMs += Math.max(0, phase.durationMs - prev.durationMs);
    } else {
      totalEffectiveMs += phase.durationMs;
    }
  }

  // 给每个 phase 计算占比
  if (totalEffectiveMs > 0) {
    for (const p of phases) {
      p.percent = Math.round((p.durationMs / totalEffectiveMs) * 1000) / 10;
    }
  }

  const marginMs = targetMs - totalEffectiveMs;
  const marginPercent = targetMs > 0 ? (marginMs / targetMs) * 100 : 0;
  const isFeasible = marginMs >= 0;

  let bottleneck = '无';
  if (phases.length > 0) {
    const sorted = [...phases].sort((a, b) => b.durationMs - a.durationMs);
    bottleneck = sorted[0].name;
  }

  const throughputPerHour = targetCycleTimeS > 0
    ? Math.floor(3600 / targetCycleTimeS)
    : 0;

  const actualCycleTimeS = totalEffectiveMs / 1000;
  const actualThroughputPerHour = actualCycleTimeS > 0
    ? Math.floor(3600 / actualCycleTimeS)
    : 0;

  return {
    phases,
    totalSerialMs: Math.round(totalSerialMs * 100) / 100,
    totalEffectiveMs: Math.round(totalEffectiveMs * 100) / 100,
    targetMs,
    marginMs: Math.round(marginMs * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
    isFeasible,
    throughputPerHour,
    actualThroughputPerHour,
    bottleneck,
  };
}

/**
 * 快速检查：模块处理时间总和 vs 工位节拍（兼容原有逻辑）
 */
export function quickCycleTimeCheck(
  cycleTimeS: number,
  processingTimesMs: number[]
): { ok: boolean; totalMs: number; targetMs: number; overMs: number } {
  const totalMs = processingTimesMs.reduce((a, b) => a + b, 0);
  const targetMs = cycleTimeS * 1000;
  return {
    ok: totalMs <= targetMs,
    totalMs,
    targetMs,
    overMs: Math.max(0, totalMs - targetMs),
  };
}
