/**
 * Imaging Parameter Auto-Calculation Utilities
 * 根据相机分辨率和视野自动计算成像参数
 */

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
 * @param sensorSize 传感器尺寸 (mm)，如 "1/2.3", "2/3", "1"
 * @param focalLength 焦距 (mm)
 * @param fov 目标视野 (mm)
 * @returns 工作距离 (mm) 或 null
 */
export function calculateWorkingDistance(
  sensorSize: string,
  focalLength: number,
  fovWidth: number
): number | null {
  // 常见传感器尺寸对应的实际宽度 (mm)
  const sensorWidths: Record<string, number> = {
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
  
  const sensorWidth = sensorWidths[sensorSize];
  if (!sensorWidth || focalLength <= 0) return null;
  
  // 工作距离公式: WD = f * (FOV / sensor_width)
  // 这是薄透镜近似，实际可能需要修正
  const wd = focalLength * (fovWidth / sensorWidth);
  
  return Math.round(wd);
}

/**
 * 综合计算成像参数
 * @param input 输入参数
 * @returns 计算结果
 */
export interface ImagingCalculationInput {
  cameraResolution?: string;  // 相机分辨率字符串
  fov?: string;               // 视野字符串
  targetAccuracy?: number;    // 目标精度 (mm)
  sensorSize?: string;        // 传感器尺寸
  focalLength?: number;       // 焦距 (mm)
}

export interface ImagingCalculationResult {
  resolutionPerPixel: string | null;     // 像素精度 (mm/px)
  resolutionPerPixelNum: number | null;  // 像素精度数值
  fovParsed: { width: number; height: number } | null;
  cameraParsed: { width: number; height: number } | null;
  workingDistance: number | null;        // 推算的工作距离
  meetsAccuracy: boolean | null;         // 是否满足精度要求
  recommendedCamera: string | null;      // 推荐的相机分辨率
}

export function calculateImagingParams(input: ImagingCalculationInput): ImagingCalculationResult {
  const cameraParsed = parseResolution(input.cameraResolution || '');
  const fovParsed = parseFOV(input.fov || '');
  
  const resolutionPerPixelNum = calculateResolutionPerPixel(fovParsed, cameraParsed);
  const resolutionPerPixel = formatResolutionPerPixel(resolutionPerPixelNum);
  
  // 计算是否满足精度要求
  let meetsAccuracy: boolean | null = null;
  let recommendedCamera: string | null = null;
  
  if (input.targetAccuracy && resolutionPerPixelNum !== null) {
    // 通常需要 3-5 倍过采样
    const requiredResolution = input.targetAccuracy / 3;
    meetsAccuracy = resolutionPerPixelNum <= requiredResolution;
    
    if (!meetsAccuracy && fovParsed) {
      const required = calculateRequiredResolution(fovParsed, requiredResolution);
      recommendedCamera = `${required.width}x${required.height} (${required.megapixels.toFixed(1)}MP)`;
    }
  }
  
  // 计算工作距离
  let workingDistance: number | null = null;
  if (input.sensorSize && input.focalLength && fovParsed) {
    workingDistance = calculateWorkingDistance(input.sensorSize, input.focalLength, fovParsed.width);
  }
  
  return {
    resolutionPerPixel,
    resolutionPerPixelNum,
    fovParsed,
    cameraParsed,
    workingDistance,
    meetsAccuracy,
    recommendedCamera,
  };
}
