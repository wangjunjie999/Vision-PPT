import pptxgen from 'pptxgenjs';
// Type definitions for pptxgenjs
type TableCell = { text: string; options?: Record<string, unknown> };
type TableRow = TableCell[];

interface ProjectData {
  id: string;
  code: string;
  name: string;
  customer: string;
  date: string | null;
  responsible: string | null;
  product_process: string | null;
  quality_strategy: string | null;
  environment: string[] | null;
  notes: string | null;
}

interface WorkstationData {
  id: string;
  code: string;
  name: string;
  type: string;
  cycle_time: number | null;
  product_dimensions: { length: number; width: number; height: number } | null;
  enclosed: boolean | null;
}

interface LayoutData {
  workstation_id: string;
  conveyor_type: string | null;
  camera_count: number | null;
  lens_count: number | null;
  light_count: number | null;
  camera_mounts: string[] | null;
  mechanisms: string[] | null;
  selected_cameras: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_lenses: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_lights: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_controller: { id: string; brand: string; model: string; image_url?: string | null } | null;
  // Three-view image URLs
  front_view_image_url?: string | null;
  side_view_image_url?: string | null;
  top_view_image_url?: string | null;
  front_view_saved?: boolean | null;
  side_view_saved?: boolean | null;
  top_view_saved?: boolean | null;
  // Layout dimensions
  width?: number | null;
  height?: number | null;
  depth?: number | null;
}

interface ModuleData {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  workstation_id: string;
  trigger_type: string | null;
  roi_strategy: string | null;
  processing_time_limit: number | null;
  output_types: string[] | null;
  selected_camera: string | null;
  selected_lens: string | null;
  selected_light: string | null;
  selected_controller: string | null;
  schematic_image_url?: string | null;
  positioning_config?: Record<string, unknown> | null;
  defect_config?: Record<string, unknown> | null;
  ocr_config?: Record<string, unknown> | null;
  deep_learning_config?: Record<string, unknown> | null;
  measurement_config?: Record<string, unknown> | null;
}

interface HardwareData {
  cameras: Array<{
    id: string;
    brand: string;
    model: string;
    resolution: string;
    frame_rate: number;
    interface: string;
    sensor_size: string;
    image_url: string | null;
  }>;
  lenses: Array<{
    id: string;
    brand: string;
    model: string;
    focal_length: string;
    aperture: string;
    mount: string;
    image_url: string | null;
  }>;
  lights: Array<{
    id: string;
    brand: string;
    model: string;
    type: string;
    color: string;
    power: string;
    image_url: string | null;
  }>;
  controllers: Array<{
    id: string;
    brand: string;
    model: string;
    cpu: string;
    gpu: string | null;
    memory: string;
    storage: string;
    performance: string;
    image_url: string | null;
  }>;
}

// Annotation data types for PPT generation
interface AnnotationItem {
  id: string;
  type: 'rect' | 'circle' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  color?: string;
  labelNumber?: number;
  label?: string;
}

interface AnnotationData {
  id: string;
  snapshot_url: string;
  annotations_json: AnnotationItem[];
  remark?: string | null;
  scope_type: 'workstation' | 'module';
  workstation_id?: string;
  module_id?: string;
}

// Product asset data for PPT generation
interface ProductAssetData {
  id: string;
  workstation_id?: string | null;
  module_id?: string | null;
  scope_type: 'workstation' | 'module';
  preview_images: Array<{ url: string; name?: string }> | null;
  model_file_url?: string | null;
}

interface GenerationOptions {
  language: 'zh' | 'en';
  quality: 'standard' | 'high' | 'ultra';
  mode?: 'draft' | 'final';
}

type ProgressCallback = (progress: number, step: string, log: string) => void;

// Helper to create table cell
const cell = (text: string, opts?: Partial<TableCell>): TableCell => ({ text, options: opts });

// Helper to create table row from strings
const row = (cells: string[]): TableRow => cells.map(t => cell(t));

// Color scheme
const COLORS = {
  primary: '2563EB',
  secondary: '64748B',
  accent: '10B981',
  warning: 'F59E0B',
  destructive: 'EF4444',
  background: 'F8FAFC',
  dark: '1E293B',
  white: 'FFFFFF',
  border: 'E2E8F0',
};

// Module type translations
const MODULE_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  positioning: { zh: '定位检测', en: 'Positioning' },
  defect: { zh: '缺陷检测', en: 'Defect Detection' },
  ocr: { zh: 'OCR识别', en: 'OCR Recognition' },
  deeplearning: { zh: '深度学习', en: 'Deep Learning' },
  measurement: { zh: '尺寸测量', en: 'Measurement' },
};

// Workstation type translations
const WS_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  line: { zh: '线体', en: 'Line' },
  turntable: { zh: '转盘', en: 'Turntable' },
  robot: { zh: '机械手', en: 'Robot' },
  platform: { zh: '平台', en: 'Platform' },
};

// Trigger type translations
const TRIGGER_LABELS: Record<string, { zh: string; en: string }> = {
  io: { zh: 'IO触发', en: 'IO Trigger' },
  encoder: { zh: '编码器', en: 'Encoder' },
  software: { zh: '软触发', en: 'Software' },
  continuous: { zh: '连续采集', en: 'Continuous' },
};

// Company info constants
const COMPANY_NAME_ZH = '苏州德星云智能装备有限公司';
const COMPANY_NAME_EN = 'SuZhou DXY Intelligent Solution Co.,Ltd';

// Helper to get workstation code with index
const getWorkstationCode = (projectCode: string, wsIndex: number): string => {
  return `${projectCode}.${String(wsIndex + 1).padStart(2, '0')}`;
};

// Helper to get module display name
const getModuleDisplayName = (wsCode: string, moduleType: string, isZh: boolean): string => {
  const typeLabel = MODULE_TYPE_LABELS[moduleType]?.[isZh ? 'zh' : 'en'] || moduleType;
  return `${wsCode}-${typeLabel}`;
};

// Image cache for dataUri conversion
const imageCache = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

async function fetchImageAsDataUri(url: string): Promise<string> {
  if (!url || url.trim() === '') return '';
  
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  
  if (url.startsWith('data:')) {
    if (imageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }
    imageCache.set(url, url);
    return url;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Failed to fetch image:', url, response.status);
      return '';
    }
    
    const blob = await response.blob();
    const reader = new FileReader();
    const dataUri = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    if (imageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }
    imageCache.set(url, dataUri);
    return dataUri;
  } catch (error) {
    console.warn('Failed to fetch image as dataUri:', url, error);
    return '';
  }
}

// ==================== MODULE PARAMETER HELPERS ====================

// Get defect detection parameters
function getDefectParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.defectClasses && Array.isArray(config.defectClasses) && config.defectClasses.length > 0) {
    rows.push(row([isZh ? '缺陷类别' : 'Defect Classes', (config.defectClasses as string[]).join('、')]));
  }
  if (config.minDefectSize) {
    rows.push(row([isZh ? '最小缺陷尺寸' : 'Min Defect Size', `${config.minDefectSize} mm`]));
  }
  if (config.missTolerance) {
    const toleranceLabels: Record<string, Record<string, string>> = {
      zero: { zh: '零容忍', en: 'Zero Tolerance' },
      low: { zh: '低容忍', en: 'Low' },
      medium: { zh: '中容忍', en: 'Medium' },
      high: { zh: '高容忍', en: 'High' },
    };
    rows.push(row([isZh ? '漏检容忍度' : 'Miss Tolerance', toleranceLabels[config.missTolerance as string]?.[isZh ? 'zh' : 'en'] || String(config.missTolerance)]));
  }
  if (config.detectionAreaLength || config.detectionAreaWidth) {
    rows.push(row([isZh ? '检测区域' : 'Detection Area', `${config.detectionAreaLength || '-'} × ${config.detectionAreaWidth || '-'} mm`]));
  }
  if (config.conveyorType) {
    const conveyorLabels: Record<string, Record<string, string>> = {
      belt: { zh: '皮带线', en: 'Belt' },
      roller: { zh: '滚筒线', en: 'Roller' },
      chain: { zh: '链条线', en: 'Chain' },
      static: { zh: '静态', en: 'Static' },
    };
    rows.push(row([isZh ? '输送方式' : 'Conveyor Type', conveyorLabels[config.conveyorType as string]?.[isZh ? 'zh' : 'en'] || String(config.conveyorType)]));
  }
  if (config.lineSpeed) {
    rows.push(row([isZh ? '线速度' : 'Line Speed', `${config.lineSpeed} m/min`]));
  }
  if (config.cameraCount || config.defectCameraCount) {
    rows.push(row([isZh ? '相机数量' : 'Camera Count', `${config.cameraCount || config.defectCameraCount} ${isZh ? '台' : ''}`]));
  }
  if (config.defectContrast) {
    const contrastLabels: Record<string, Record<string, string>> = {
      high: { zh: '高对比', en: 'High' },
      medium: { zh: '中对比', en: 'Medium' },
      low: { zh: '低对比', en: 'Low' },
    };
    rows.push(row([isZh ? '缺陷对比度' : 'Defect Contrast', contrastLabels[config.defectContrast as string]?.[isZh ? 'zh' : 'en'] || String(config.defectContrast)]));
  }
  if (config.materialReflectionLevel) {
    const reflectionLabels: Record<string, Record<string, string>> = {
      matte: { zh: '哑光', en: 'Matte' },
      semi: { zh: '半光泽', en: 'Semi-gloss' },
      glossy: { zh: '高光', en: 'Glossy' },
      mirror: { zh: '镜面', en: 'Mirror' },
    };
    rows.push(row([isZh ? '材质反光等级' : 'Reflection Level', reflectionLabels[config.materialReflectionLevel as string]?.[isZh ? 'zh' : 'en'] || String(config.materialReflectionLevel)]));
  }
  if (config.allowedMissRate !== undefined) {
    rows.push(row([isZh ? '允许漏检率' : 'Allowed Miss Rate', `${config.allowedMissRate}%`]));
  }
  if (config.allowedFalseRate !== undefined) {
    rows.push(row([isZh ? '允许误检率' : 'Allowed False Rate', `${config.allowedFalseRate}%`]));
  }
  if (config.confidenceThreshold !== undefined) {
    rows.push(row([isZh ? '置信度阈值' : 'Confidence Threshold', `${config.confidenceThreshold}%`]));
  }
  
  return rows;
}

// Get measurement parameters
function getMeasurementParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  // Measurement items
  if (config.measurementItems && Array.isArray(config.measurementItems) && config.measurementItems.length > 0) {
    rows.push(row([isZh ? '【测量项目】' : '[Measurement Items]', '']));
    (config.measurementItems as Array<{ name: string; dimType: string; nominal: number; upperTol: number; lowerTol: number; unit: string }>).forEach((item, idx) => {
      const dimTypeLabels: Record<string, string> = {
        length: isZh ? '长度' : 'Length',
        diameter: isZh ? '直径' : 'Diameter',
        radius: isZh ? '半径' : 'Radius',
        angle: isZh ? '角度' : 'Angle',
        distance: isZh ? '距离' : 'Distance',
        gap: isZh ? '间隙' : 'Gap',
      };
      rows.push(row([
        `${idx + 1}. ${item.name || (isZh ? '测量项' : 'Item')}`,
        `${dimTypeLabels[item.dimType] || item.dimType}: ${item.nominal} (+${item.upperTol}/-${item.lowerTol}) ${item.unit || 'mm'}`
      ]));
    });
  }
  
  if (config.measurementFieldOfView) {
    rows.push(row([isZh ? '视野大小' : 'Field of View', `${config.measurementFieldOfView} mm`]));
  }
  if (config.measurementResolution) {
    rows.push(row([isZh ? '分辨率' : 'Resolution', `${config.measurementResolution} mm/pixel`]));
  }
  if (config.targetAccuracy) {
    rows.push(row([isZh ? '目标精度' : 'Target Accuracy', `±${config.targetAccuracy} mm`]));
  }
  if (config.systemAccuracy) {
    rows.push(row([isZh ? '系统精度' : 'System Accuracy', `±${config.systemAccuracy} mm`]));
  }
  if (config.calibrationMethod) {
    const calibrationLabels: Record<string, Record<string, string>> = {
      plane: { zh: '平面标定', en: 'Plane' },
      multipoint: { zh: '多点标定', en: 'Multi-point' },
      ruler: { zh: '标尺标定', en: 'Ruler' },
    };
    rows.push(row([isZh ? '标定方式' : 'Calibration Method', calibrationLabels[config.calibrationMethod as string]?.[isZh ? 'zh' : 'en'] || String(config.calibrationMethod)]));
  }
  if (config.grr) {
    rows.push(row(['GR&R', `${config.grr}%`]));
  }
  
  return rows;
}

// Get OCR parameters
function getOCRParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.charTypes && Array.isArray(config.charTypes)) {
    const typeLabels: Record<string, string> = {
      printed: isZh ? '印刷字符' : 'Printed',
      engraved: isZh ? '雕刻字符' : 'Engraved',
      dotMatrix: isZh ? '点阵字符' : 'Dot Matrix',
      handwritten: isZh ? '手写字符' : 'Handwritten',
    };
    rows.push(row([isZh ? '字符类型' : 'Char Types', (config.charTypes as string[]).map(t => typeLabels[t] || t).join('、')]));
  }
  if (config.charType) {
    const typeLabels: Record<string, string> = {
      printed: isZh ? '印刷字符' : 'Printed',
      engraved: isZh ? '雕刻字符' : 'Engraved',
      dotMatrix: isZh ? '点阵字符' : 'Dot Matrix',
      handwritten: isZh ? '手写字符' : 'Handwritten',
    };
    rows.push(row([isZh ? '字符类型' : 'Char Type', typeLabels[config.charType as string] || String(config.charType)]));
  }
  if (config.minCharHeight) {
    rows.push(row([isZh ? '最小字符高度' : 'Min Char Height', `${config.minCharHeight} mm`]));
  }
  if (config.charWidth) {
    rows.push(row([isZh ? '字符宽度' : 'Char Width', `${config.charWidth} mm`]));
  }
  if (config.expectedCharCount || config.charCount) {
    rows.push(row([isZh ? '预期字符数' : 'Expected Char Count', String(config.expectedCharCount || config.charCount)]));
  }
  if (config.charSet) {
    const charSetLabels: Record<string, string> = {
      numeric: isZh ? '纯数字' : 'Numeric',
      alpha: isZh ? '纯字母' : 'Alpha',
      alphanumeric: isZh ? '字母数字混合' : 'Alphanumeric',
      custom: isZh ? '自定义' : 'Custom',
    };
    rows.push(row([isZh ? '字符集' : 'Char Set', charSetLabels[config.charSet as string] || String(config.charSet)]));
  }
  if (config.contentRule) {
    rows.push(row([isZh ? '内容规则' : 'Content Rule', String(config.contentRule)]));
  }
  if (config.charContrast) {
    rows.push(row([isZh ? '字符对比度' : 'Char Contrast', String(config.charContrast)]));
  }
  if (config.charFormat) {
    rows.push(row([isZh ? '字符格式' : 'Char Format', String(config.charFormat)]));
  }
  if (config.validationRules) {
    rows.push(row([isZh ? '校验规则' : 'Validation Rules', String(config.validationRules)]));
  }
  if (config.charAreaWidth || config.charAreaHeight) {
    rows.push(row([isZh ? '字符区域' : 'Char Area', `${config.charAreaWidth || '-'} × ${config.charAreaHeight || '-'} mm`]));
  }
  if (config.minStrokeWidth) {
    rows.push(row([isZh ? '最小笔画宽度' : 'Min Stroke Width', `${config.minStrokeWidth} mm`]));
  }
  if (config.allowedRotation) {
    rows.push(row([isZh ? '允许旋转角度' : 'Allowed Rotation', `±${config.allowedRotation}°`]));
  }
  if (config.allowedDamage) {
    const damageLabels: Record<string, string> = {
      none: isZh ? '无损坏' : 'None',
      slight: isZh ? '轻微' : 'Slight',
      moderate: isZh ? '中等' : 'Moderate',
      severe: isZh ? '严重' : 'Severe',
    };
    rows.push(row([isZh ? '允许损坏程度' : 'Allowed Damage', damageLabels[config.allowedDamage as string] || String(config.allowedDamage)]));
  }
  
  return rows;
}

// Get positioning parameters
function getPositioningParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.guidingMode) {
    const modeLabels: Record<string, string> = {
      '2d': isZh ? '2D定位' : '2D',
      '2.5d': isZh ? '2.5D定位' : '2.5D',
      '3d': isZh ? '3D定位' : '3D',
    };
    rows.push(row([isZh ? '引导模式' : 'Guiding Mode', modeLabels[config.guidingMode as string] || String(config.guidingMode)]));
  }
  if (config.guidingMechanism) {
    const mechLabels: Record<string, string> = {
      robot: isZh ? '机器人' : 'Robot',
      gantry: isZh ? '龙门架' : 'Gantry',
      scara: isZh ? 'SCARA' : 'SCARA',
      delta: isZh ? 'Delta' : 'Delta',
    };
    rows.push(row([isZh ? '引导机构' : 'Guiding Mechanism', mechLabels[config.guidingMechanism as string] || String(config.guidingMechanism)]));
  }
  if (config.targetType) {
    const typeLabels: Record<string, string> = {
      edge: isZh ? '边缘' : 'Edge',
      corner: isZh ? '角点' : 'Corner',
      center: isZh ? '中心' : 'Center',
      hole: isZh ? '孔' : 'Hole',
      pattern: isZh ? '图案' : 'Pattern',
    };
    rows.push(row([isZh ? '定位目标类型' : 'Target Type', typeLabels[config.targetType as string] || String(config.targetType)]));
  }
  if (config.accuracyRequirement) {
    rows.push(row([isZh ? '定位精度要求' : 'Accuracy Requirement', `±${config.accuracyRequirement} mm`]));
  }
  if (config.repeatability) {
    rows.push(row([isZh ? '重复精度' : 'Repeatability', `±${config.repeatability} mm`]));
  }
  if (config.errorToleranceX || config.errorToleranceY) {
    rows.push(row([isZh ? '误差容忍(X/Y)' : 'Error Tolerance (X/Y)', `±${config.errorToleranceX || '-'} / ±${config.errorToleranceY || '-'} mm`]));
  }
  if (config.calibrationMethod) {
    const calibLabels: Record<string, string> = {
      '9point': isZh ? '九点标定' : '9-Point',
      '4point': isZh ? '四点标定' : '4-Point',
      handeye: isZh ? '手眼标定' : 'Hand-Eye',
    };
    rows.push(row([isZh ? '标定方式' : 'Calibration Method', calibLabels[config.calibrationMethod as string] || String(config.calibrationMethod)]));
  }
  if (config.outputCoordinate) {
    rows.push(row([isZh ? '输出坐标系' : 'Output Coordinate', String(config.outputCoordinate)]));
  }
  if (config.calibrationCycle) {
    rows.push(row([isZh ? '标定周期' : 'Calibration Cycle', String(config.calibrationCycle)]));
  }
  if (config.accuracyAcceptance) {
    rows.push(row([isZh ? '精度验收标准' : 'Accuracy Acceptance', String(config.accuracyAcceptance)]));
  }
  if (config.targetFeatures) {
    rows.push(row([isZh ? '目标特征' : 'Target Features', String(config.targetFeatures)]));
  }
  if (config.targetCount) {
    rows.push(row([isZh ? '目标数量' : 'Target Count', String(config.targetCount)]));
  }
  if (config.occlusionTolerance) {
    rows.push(row([isZh ? '遮挡容忍' : 'Occlusion Tolerance', `${config.occlusionTolerance}%`]));
  }
  
  return rows;
}

// Get deep learning parameters
function getDeepLearningParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.taskType) {
    const taskLabels: Record<string, string> = {
      classification: isZh ? '分类' : 'Classification',
      detection: isZh ? '目标检测' : 'Detection',
      segmentation: isZh ? '语义分割' : 'Segmentation',
      instance: isZh ? '实例分割' : 'Instance Segmentation',
      anomaly: isZh ? '异常检测' : 'Anomaly Detection',
    };
    rows.push(row([isZh ? '任务类型' : 'Task Type', taskLabels[config.taskType as string] || String(config.taskType)]));
  }
  if (config.targetClasses && Array.isArray(config.targetClasses) && config.targetClasses.length > 0) {
    rows.push(row([isZh ? '目标类别' : 'Target Classes', (config.targetClasses as string[]).join('、')]));
  }
  if (config.detectionClasses && Array.isArray(config.detectionClasses)) {
    rows.push(row([isZh ? '检测类别' : 'Detection Classes', (config.detectionClasses as string[]).join('、')]));
  }
  if (config.modelType) {
    rows.push(row([isZh ? '模型类型' : 'Model Type', String(config.modelType)]));
  }
  if (config.roiWidth || config.roiHeight) {
    rows.push(row([isZh ? 'ROI尺寸' : 'ROI Size', `${config.roiWidth || '-'} × ${config.roiHeight || '-'} px`]));
  }
  if (config.deployTarget) {
    const targetLabels: Record<string, string> = {
      cpu: 'CPU',
      gpu: 'GPU',
      edge: isZh ? '边缘设备' : 'Edge Device',
    };
    rows.push(row([isZh ? '部署目标' : 'Deploy Target', targetLabels[config.deployTarget as string] || String(config.deployTarget)]));
  }
  if (config.inferenceTimeLimit) {
    rows.push(row([isZh ? '推理时限' : 'Inference Time Limit', `${config.inferenceTimeLimit} ms`]));
  }
  if (config.confidenceThreshold !== undefined) {
    rows.push(row([isZh ? '置信度阈值' : 'Confidence Threshold', `${config.confidenceThreshold}%`]));
  }
  if (config.trainingSampleCount || config.sampleEstimate) {
    rows.push(row([isZh ? '训练样本量' : 'Training Samples', String(config.trainingSampleCount || config.sampleEstimate)]));
  }
  
  return rows;
}

// Get imaging parameters (common to all module types)
function getImagingParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.workingDistance) {
    rows.push(row([isZh ? '工作距离' : 'Working Distance', `${config.workingDistance} mm`]));
  }
  if (config.fieldOfView) {
    rows.push(row([isZh ? '视场范围' : 'Field of View', `${config.fieldOfView} mm`]));
  }
  if (config.fieldOfViewWidth && config.fieldOfViewHeight) {
    rows.push(row([isZh ? '视场范围(宽×高)' : 'FOV (W×H)', `${config.fieldOfViewWidth} × ${config.fieldOfViewHeight} mm`]));
  }
  if (config.resolutionPerPixel) {
    rows.push(row([isZh ? '分辨率' : 'Resolution', `${config.resolutionPerPixel} mm/pixel`]));
  }
  if (config.depthOfField) {
    rows.push(row([isZh ? '景深' : 'Depth of Field', `${config.depthOfField} mm`]));
  }
  if (config.exposure) {
    rows.push(row([isZh ? '曝光时间' : 'Exposure', `${config.exposure} μs`]));
  }
  if (config.gain) {
    rows.push(row([isZh ? '增益' : 'Gain', `${config.gain} dB`]));
  }
  if (config.triggerDelay) {
    rows.push(row([isZh ? '触发延迟' : 'Trigger Delay', `${config.triggerDelay} ms`]));
  }
  if (config.lightAngle) {
    rows.push(row([isZh ? '光源角度' : 'Light Angle', `${config.lightAngle}°`]));
  }
  if (config.lightDistance) {
    rows.push(row([isZh ? '光源距离' : 'Light Distance', `${config.lightDistance} mm`]));
  }
  if (config.lightMode) {
    const modeLabels: Record<string, string> = {
      continuous: isZh ? '常亮' : 'Continuous',
      strobe: isZh ? '频闪' : 'Strobe',
    };
    rows.push(row([isZh ? '光源模式' : 'Light Mode', modeLabels[config.lightMode as string] || String(config.lightMode)]));
  }
  if (config.lensAperture) {
    rows.push(row([isZh ? '镜头光圈' : 'Lens Aperture', `F${config.lensAperture}`]));
  }
  
  return rows;
}

export async function generatePPTX(
  project: ProjectData,
  workstations: WorkstationData[],
  layouts: LayoutData[],
  modules: ModuleData[],
  options: GenerationOptions,
  onProgress: ProgressCallback,
  hardware?: HardwareData,
  readinessResult?: { missing: Array<{ level: string; name: string; missing: string[] }>; warnings: Array<{ level: string; name: string; warning: string }> },
  annotations?: AnnotationData[],
  productAssets?: ProductAssetData[]
): Promise<Blob> {
  const pptx = new pptxgen();
  const isZh = options.language === 'zh';

  // Set presentation properties
  pptx.author = project.responsible || 'Vision System';
  pptx.title = `${project.name} - ${isZh ? '视觉系统方案' : 'Vision System Proposal'}`;
  pptx.subject = isZh ? '机器视觉系统技术方案' : 'Machine Vision System Technical Proposal';
  pptx.company = isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN;

  // Define master slide
  pptx.defineSlideMaster({
    title: 'MASTER_SLIDE',
    background: { color: COLORS.background },
    objects: [
      { rect: { x: 0, y: 0, w: '100%', h: 0.5, fill: { color: COLORS.primary } } },
      { rect: { x: 0, y: 5.2, w: '100%', h: 0.3, fill: { color: COLORS.dark } } },
      { text: { text: isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN, options: { x: 0.3, y: 5.25, w: 5, h: 0.2, fontSize: 8, color: COLORS.white } } },
      { text: { text: project.customer, options: { x: 8, y: 5.25, w: 2, h: 0.2, fontSize: 8, color: COLORS.white, align: 'right' } } },
    ],
  });

  let progress = 5;
  onProgress(progress, isZh ? '初始化生成器...' : 'Initializing generator...', isZh ? '开始PPT生成' : 'Starting PPT generation');

  // ========== SLIDE 1: Cover ==========
  progress = 10;
  onProgress(progress, isZh ? '生成封面页...' : 'Generating cover slide...', isZh ? '生成封面页' : 'Cover slide');
  
  const coverSlide = pptx.addSlide();
  
  coverSlide.addShape('rect', {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: COLORS.primary },
  });
  coverSlide.addShape('rect', {
    x: 0, y: 3.5, w: '100%', h: 2,
    fill: { color: COLORS.dark },
  });

  coverSlide.addText(isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN, {
    x: 0.5, y: 0.8, w: 9, h: 0.4,
    fontSize: 14, color: COLORS.white, align: 'center',
  });

  coverSlide.addText(project.name, {
    x: 0.5, y: 1.8, w: 9, h: 1,
    fontSize: 36, color: COLORS.white, bold: true, align: 'center',
  });

  coverSlide.addText(isZh ? '机器视觉系统技术方案' : 'Machine Vision System Technical Proposal', {
    x: 0.5, y: 2.7, w: 9, h: 0.5,
    fontSize: 18, color: COLORS.white, align: 'center',
  });

  const infoRows: TableRow[] = [
    row([isZh ? '项目编号' : 'Project Code', project.code]),
    row([isZh ? '客户' : 'Customer', project.customer]),
    row([isZh ? '日期' : 'Date', project.date || '-']),
    row([isZh ? '负责人' : 'Responsible', project.responsible || '-']),
  ];

  coverSlide.addTable(infoRows, {
    x: 2.5, y: 3.7, w: 5, h: 1.2,
    fontFace: 'Arial',
    fontSize: 11,
    color: COLORS.white,
    fill: { color: COLORS.dark },
    border: { type: 'none' },
    colW: [1.5, 3.5],
  });

  // ========== SLIDE 2: Missing Items (Draft Mode Only) ==========
  if (options.mode === 'draft' && readinessResult && (readinessResult.missing.length > 0 || readinessResult.warnings.length > 0)) {
    progress = 15;
    onProgress(progress, isZh ? '生成缺失项清单页...' : 'Generating missing items slide...', isZh ? '缺失项清单页' : 'Missing items');
    
    const missingSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    
    missingSlide.addText(isZh ? '缺失项与风险提示' : 'Missing Items & Risk Warnings', {
      x: 0.5, y: 0.6, w: 9, h: 0.6,
      fontSize: 24, color: COLORS.dark, bold: true,
    });
    
    missingSlide.addText(isZh ? '本PPT为草案版本，以下项目缺失或需要完善' : 'This is a draft version. The following items are missing or need improvement', {
      x: 0.5, y: 1.2, w: 9, h: 0.4,
      fontSize: 12, color: COLORS.secondary,
    });
    
    let yPos = 1.8;
    
    if (readinessResult.missing.length > 0) {
      missingSlide.addText(isZh ? '缺失项（必须补齐）' : 'Missing Items (Must Complete)', {
        x: 0.5, y: yPos, w: 9, h: 0.3,
        fontSize: 14, color: COLORS.destructive, bold: true,
      });
      yPos += 0.4;
      
      const missingRows: TableRow[] = [];
      readinessResult.missing.forEach((item) => {
        const levelLabel = item.level === 'project' ? (isZh ? '项目' : 'Project') :
                          item.level === 'workstation' ? (isZh ? '工位' : 'Workstation') :
                          (isZh ? '模块' : 'Module');
        missingRows.push(row([
          `${levelLabel}: ${item.name}`,
          item.missing.join('、')
        ]));
      });
      
      missingSlide.addTable(missingRows, {
        x: 0.5, y: yPos, w: 9, h: Math.min(2.5, missingRows.length * 0.15),
        fontFace: 'Arial',
        fontSize: 9,
        colW: [2.5, 6.5],
        border: { pt: 0.5, color: COLORS.border },
        fill: { color: COLORS.white },
        valign: 'middle',
      });
      
      yPos += Math.min(2.5, missingRows.length * 0.15) + 0.2;
    }
    
    if (readinessResult.warnings.length > 0 && yPos < 4.5) {
      missingSlide.addText(isZh ? '警告项（建议补齐）' : 'Warnings (Recommended)', {
        x: 0.5, y: yPos, w: 9, h: 0.3,
        fontSize: 14, color: COLORS.warning, bold: true,
      });
      yPos += 0.4;
      
      const warningRows: TableRow[] = [];
      readinessResult.warnings.slice(0, Math.floor((4.5 - yPos) / 0.15)).forEach((item) => {
        const levelLabel = item.level === 'project' ? (isZh ? '项目' : 'Project') :
                          item.level === 'workstation' ? (isZh ? '工位' : 'Workstation') :
                          (isZh ? '模块' : 'Module');
        warningRows.push(row([
          `${levelLabel}: ${item.name}`,
          item.warning
        ]));
      });
      
      if (warningRows.length > 0) {
        missingSlide.addTable(warningRows, {
          x: 0.5, y: yPos, w: 9, h: Math.min(4.5 - yPos, warningRows.length * 0.15),
          fontFace: 'Arial',
          fontSize: 9,
          colW: [2.5, 6.5],
          border: { pt: 0.5, color: COLORS.border },
          fill: { color: COLORS.white },
          valign: 'middle',
        });
      }
    }
  }

  // ========== SLIDE: Project Overview ==========
  progress = 20;
  onProgress(progress, isZh ? '生成项目概览页...' : 'Generating project overview...', isZh ? '生成项目概览页' : 'Project overview');

  const overviewSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  
  overviewSlide.addText(isZh ? '项目概览' : 'Project Overview', {
    x: 0.5, y: 0.6, w: 9, h: 0.6,
    fontSize: 24, color: COLORS.dark, bold: true,
  });

  const stats = [
    { label: isZh ? '工位数量' : 'Workstations', value: workstations.length.toString(), icon: '🔧' },
    { label: isZh ? '功能模块' : 'Modules', value: modules.length.toString(), icon: '📦' },
    { label: isZh ? '检测工艺' : 'Process', value: project.product_process || '-', icon: '⚙️' },
    { label: isZh ? '质量策略' : 'Quality', value: project.quality_strategy || 'balanced', icon: '✅' },
  ];

  stats.forEach((stat, i) => {
    const x = 0.5 + i * 2.3;
    overviewSlide.addShape('rect', {
      x, y: 1.4, w: 2.1, h: 1.2,
      fill: { color: COLORS.white },
      shadow: { type: 'outer', blur: 3, offset: 2, angle: 45, opacity: 0.2 },
    });
    overviewSlide.addText(stat.icon, { x, y: 1.5, w: 2.1, h: 0.4, fontSize: 20, align: 'center' });
    overviewSlide.addText(stat.value, { x, y: 1.9, w: 2.1, h: 0.4, fontSize: 18, bold: true, color: COLORS.primary, align: 'center' });
    overviewSlide.addText(stat.label, { x, y: 2.3, w: 2.1, h: 0.3, fontSize: 10, color: COLORS.secondary, align: 'center' });
  });

  overviewSlide.addText(isZh ? '工位清单' : 'Workstation List', {
    x: 0.5, y: 2.8, w: 9, h: 0.4,
    fontSize: 14, color: COLORS.dark, bold: true,
  });

  const wsTableHeader: TableRow = row([
    isZh ? '编号' : 'Code',
    isZh ? '名称' : 'Name',
    isZh ? '类型' : 'Type',
    isZh ? '节拍(s)' : 'Cycle(s)',
    isZh ? '模块数' : 'Modules',
  ]);

  const wsTableRows: TableRow[] = workstations.map((ws, index) => row([
    getWorkstationCode(project.code, index),
    ws.name,
    WS_TYPE_LABELS[ws.type]?.[options.language] || ws.type,
    ws.cycle_time?.toString() || '-',
    modules.filter(m => m.workstation_id === ws.id).length.toString(),
  ]));

  overviewSlide.addTable([wsTableHeader, ...wsTableRows], {
    x: 0.5, y: 3.2, w: 9, h: 1.8,
    fontFace: 'Arial',
    fontSize: 10,
    colW: [1.2, 3, 1.5, 1.2, 1.2],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle',
    align: 'center',
  });

  // ========== WORKSTATION SLIDES ==========
  const totalWsProgress = 65;
  const progressPerWs = totalWsProgress / Math.max(workstations.length, 1);
  
  for (let i = 0; i < workstations.length; i++) {
    const ws = workstations[i];
    const wsLayout = layouts.find(l => l.workstation_id === ws.id);
    const wsModules = modules.filter(m => m.workstation_id === ws.id);
    const wsCode = getWorkstationCode(project.code, i);

    // Find workstation-level annotation
    const wsAnnotation = annotations?.find(a => a.scope_type === 'workstation' && a.workstation_id === ws.id);
    
    // Find workstation-level product assets
    const wsProductAsset = productAssets?.find(a => a.scope_type === 'workstation' && a.workstation_id === ws.id);

    progress = 25 + i * progressPerWs;
    onProgress(progress, `${isZh ? '处理工位' : 'Processing workstation'}: ${ws.name}...`, `${isZh ? '生成工位页' : 'Workstation slide'}: ${ws.name}`);

    // ========== 1. Workstation Overview Slide ==========
    const wsSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    
    wsSlide.addText(`${isZh ? '工位' : 'Workstation'}: ${ws.name}`, {
      x: 0.5, y: 0.6, w: 9, h: 0.6,
      fontSize: 22, color: COLORS.dark, bold: true,
    });

    wsSlide.addText(wsCode, {
      x: 8, y: 0.7, w: 1.5, h: 0.3,
      fontSize: 12, color: COLORS.secondary, align: 'right',
    });

    const dims = ws.product_dimensions;
    const wsInfoRows: TableRow[] = [
      row([isZh ? '工位类型' : 'Type', WS_TYPE_LABELS[ws.type]?.[options.language] || ws.type]),
      row([isZh ? '节拍' : 'Cycle Time', `${ws.cycle_time || '-'} s/pcs`]),
      row([isZh ? '产品尺寸' : 'Product Size', dims ? `${dims.length}×${dims.width}×${dims.height} mm` : '-']),
      row([isZh ? '输送类型' : 'Conveyor', wsLayout?.conveyor_type || '-']),
      row([isZh ? '相机数量' : 'Cameras', `${wsLayout?.camera_count || '-'} ${isZh ? '台' : ''}`]),
      row([isZh ? '封闭罩体' : 'Enclosed', ws.enclosed ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No')]),
    ];

    wsSlide.addTable(wsInfoRows, {
      x: 0.5, y: 1.3, w: 4, h: 2,
      fontFace: 'Arial',
      fontSize: 10,
      colW: [1.5, 2.5],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    });

    if (wsLayout?.camera_mounts && wsLayout.camera_mounts.length > 0) {
      wsSlide.addText(isZh ? '相机安装方式' : 'Camera Mounts', {
        x: 5, y: 1.3, w: 4.5, h: 0.3,
        fontSize: 11, color: COLORS.dark, bold: true,
      });
      wsSlide.addText(wsLayout.camera_mounts.join(', '), {
        x: 5, y: 1.6, w: 4.5, h: 0.3,
        fontSize: 10, color: COLORS.secondary,
      });
    }

    if (wsLayout?.mechanisms && wsLayout.mechanisms.length > 0) {
      wsSlide.addText(isZh ? '执行机构' : 'Mechanisms', {
        x: 5, y: 2, w: 4.5, h: 0.3,
        fontSize: 11, color: COLORS.dark, bold: true,
      });
      wsSlide.addText(wsLayout.mechanisms.join(', '), {
        x: 5, y: 2.3, w: 4.5, h: 0.3,
        fontSize: 10, color: COLORS.secondary,
      });
    }

    const layoutCameras = wsLayout?.selected_cameras?.filter(c => c) || [];
    const layoutLenses = wsLayout?.selected_lenses?.filter(l => l) || [];
    const layoutLights = wsLayout?.selected_lights?.filter(l => l) || [];
    const layoutController = wsLayout?.selected_controller;
    
    if (layoutCameras.length > 0 || layoutLenses.length > 0 || layoutLights.length > 0 || layoutController) {
      wsSlide.addText(isZh ? '硬件配置' : 'Hardware Config', {
        x: 5, y: 2.6, w: 4.5, h: 0.3,
        fontSize: 11, color: COLORS.dark, bold: true,
      });
      
      const hwItems: string[] = [];
      if (layoutCameras.length > 0) {
        hwItems.push(`${isZh ? '相机' : 'Cam'}: ${layoutCameras.map(c => c.model).join(', ')}`);
      }
      if (layoutLenses.length > 0) {
        hwItems.push(`${isZh ? '镜头' : 'Lens'}: ${layoutLenses.map(l => l.model).join(', ')}`);
      }
      if (layoutLights.length > 0) {
        hwItems.push(`${isZh ? '光源' : 'Light'}: ${layoutLights.map(l => l.model).join(', ')}`);
      }
      if (layoutController) {
        hwItems.push(`${isZh ? '工控机' : 'IPC'}: ${layoutController.model}`);
      }
      
      wsSlide.addText(hwItems.join('\n'), {
        x: 5, y: 2.9, w: 4.5, h: 0.5,
        fontSize: 9, color: COLORS.secondary,
      });
    }

    if (wsModules.length > 0) {
      wsSlide.addText(isZh ? '功能模块' : 'Function Modules', {
        x: 0.5, y: 3.5, w: 9, h: 0.4,
        fontSize: 14, color: COLORS.dark, bold: true,
      });

      const modTableHeader: TableRow = row([
        isZh ? '模块编号' : 'Module Code',
        isZh ? '类型' : 'Type',
        isZh ? '触发方式' : 'Trigger',
        isZh ? '处理时限' : 'Time Limit',
      ]);

      const modTableRows: TableRow[] = wsModules.map(mod => row([
        getModuleDisplayName(wsCode, mod.type, isZh),
        MODULE_TYPE_LABELS[mod.type]?.[options.language] || mod.type,
        TRIGGER_LABELS[mod.trigger_type || 'io']?.[options.language] || mod.trigger_type || '-',
        mod.processing_time_limit ? `${mod.processing_time_limit}ms` : '-',
      ]));

      wsSlide.addTable([modTableHeader, ...modTableRows], {
        x: 0.5, y: 3.9, w: 9, h: 1,
        fontFace: 'Arial',
        fontSize: 10,
        colW: [3, 2, 2, 2],
        border: { pt: 0.5, color: COLORS.border },
        fill: { color: COLORS.white },
        valign: 'middle',
        align: 'center',
      });
    }

    // ========== 2. Layout Three-View Slide (NEW) ==========
    const hasThreeViews = wsLayout && (
      wsLayout.front_view_image_url || 
      wsLayout.side_view_image_url || 
      wsLayout.top_view_image_url
    );
    
    if (hasThreeViews) {
      onProgress(progress, `${isZh ? '添加布局三视图页' : 'Adding layout three-view'}: ${ws.name}...`, `${isZh ? '布局三视图页' : 'Layout Three-View'}`);
      
      const threeViewSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
      
      threeViewSlide.addText(`${wsCode} ${ws.name} - ${isZh ? '布局三视图' : 'Layout Three-View'}`, {
        x: 0.5, y: 0.6, w: 9, h: 0.5,
        fontSize: 20, color: COLORS.dark, bold: true,
      });

      threeViewSlide.addText(`${isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN} | ${project.customer}`, {
        x: 0.5, y: 1.05, w: 9, h: 0.25,
        fontSize: 10, color: COLORS.secondary,
      });

      // Three views layout: Front | Side | Top
      const viewWidth = 2.9;
      const viewHeight = 2.2;
      const viewY = 1.4;
      const views = [
        { label: isZh ? '正视图' : 'Front View', url: wsLayout.front_view_image_url, saved: wsLayout.front_view_saved, x: 0.5 },
        { label: isZh ? '侧视图' : 'Side View', url: wsLayout.side_view_image_url, saved: wsLayout.side_view_saved, x: 3.55 },
        { label: isZh ? '俯视图' : 'Top View', url: wsLayout.top_view_image_url, saved: wsLayout.top_view_saved, x: 6.6 },
      ];

      for (const view of views) {
        // View label
        threeViewSlide.addText(view.label, {
          x: view.x, y: viewY, w: viewWidth, h: 0.25,
          fontSize: 10, color: COLORS.dark, bold: true, align: 'center',
        });

        if (view.url) {
          try {
            const dataUri = await fetchImageAsDataUri(view.url);
            if (dataUri) {
              threeViewSlide.addImage({
                data: dataUri,
                x: view.x, y: viewY + 0.3, w: viewWidth, h: viewHeight - 0.3,
                sizing: { type: 'contain', w: viewWidth, h: viewHeight - 0.3 },
              });
            } else {
              throw new Error('Failed to fetch image');
            }
          } catch (e) {
            threeViewSlide.addShape('rect', {
              x: view.x, y: viewY + 0.3, w: viewWidth, h: viewHeight - 0.3,
              fill: { color: COLORS.border },
              line: { color: COLORS.secondary, width: 1 },
            });
            threeViewSlide.addText(isZh ? '加载失败' : 'Load Failed', {
              x: view.x, y: viewY + 1.2, w: viewWidth, h: 0.3,
              fontSize: 10, color: COLORS.secondary, align: 'center',
            });
          }
        } else {
          threeViewSlide.addShape('rect', {
            x: view.x, y: viewY + 0.3, w: viewWidth, h: viewHeight - 0.3,
            fill: { color: COLORS.border },
            line: { color: COLORS.secondary, width: 1 },
          });
          threeViewSlide.addText(isZh ? '未保存' : 'Not Saved', {
            x: view.x, y: viewY + 1.2, w: viewWidth, h: 0.3,
            fontSize: 10, color: COLORS.secondary, align: 'center',
          });
        }
      }

      // Layout info section
      threeViewSlide.addText(isZh ? '布局信息' : 'Layout Info', {
        x: 0.5, y: 3.8, w: 9, h: 0.3,
        fontSize: 12, color: COLORS.dark, bold: true,
      });

      const layoutInfoRows: TableRow[] = [];
      if (wsLayout.width || wsLayout.height || wsLayout.depth) {
        layoutInfoRows.push(row([isZh ? '布局尺寸(宽×高×深)' : 'Layout Size (W×H×D)', `${wsLayout.width || '-'} × ${wsLayout.height || '-'} × ${wsLayout.depth || '-'} mm`]));
      }
      if (wsLayout.mechanisms && wsLayout.mechanisms.length > 0) {
        layoutInfoRows.push(row([isZh ? '执行机构' : 'Mechanisms', wsLayout.mechanisms.join('、')]));
      }
      if (wsLayout.camera_mounts && wsLayout.camera_mounts.length > 0) {
        layoutInfoRows.push(row([isZh ? '相机安装点' : 'Camera Mounts', wsLayout.camera_mounts.join('、')]));
      }
      if (wsLayout.camera_count) {
        layoutInfoRows.push(row([isZh ? '相机数量' : 'Camera Count', `${wsLayout.camera_count} ${isZh ? '台' : ''}`]));
      }
      if (wsLayout.conveyor_type) {
        layoutInfoRows.push(row([isZh ? '输送类型' : 'Conveyor Type', wsLayout.conveyor_type]));
      }

      if (layoutInfoRows.length > 0) {
        threeViewSlide.addTable(layoutInfoRows, {
          x: 0.5, y: 4.15, w: 9, h: Math.min(layoutInfoRows.length * 0.28, 0.9),
          fontFace: 'Arial',
          fontSize: 9,
          colW: [2.5, 6.5],
          border: { pt: 0.5, color: COLORS.border },
          fill: { color: COLORS.white },
          valign: 'middle',
        });
      }
    }

    // ========== 3. Workstation Product Overview Slide (NEW) ==========
    if (wsProductAsset && wsProductAsset.preview_images && wsProductAsset.preview_images.length > 0) {
      onProgress(progress, `${isZh ? '添加产品特征概览页' : 'Adding product overview'}: ${ws.name}...`, `${isZh ? '产品特征概览页' : 'Product Overview'}`);
      
      const productSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
      
      productSlide.addText(`${wsCode} ${ws.name} - ${isZh ? '产品特征概览' : 'Product Feature Overview'}`, {
        x: 0.5, y: 0.6, w: 9, h: 0.5,
        fontSize: 20, color: COLORS.dark, bold: true,
      });

      productSlide.addText(`${isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN} | ${project.customer}`, {
        x: 0.5, y: 1.05, w: 9, h: 0.25,
        fontSize: 10, color: COLORS.secondary,
      });

      // Display preview images (up to 4)
      const previewImages = wsProductAsset.preview_images.slice(0, 4);
      const imgCount = previewImages.length;
      
      if (imgCount === 1) {
        // Single large image
        const imgUrl = previewImages[0].url;
        if (imgUrl) {
          try {
            const dataUri = await fetchImageAsDataUri(imgUrl);
            if (dataUri) {
              productSlide.addImage({
                data: dataUri,
                x: 1.5, y: 1.4, w: 7, h: 3.6,
                sizing: { type: 'contain', w: 7, h: 3.6 },
              });
            }
          } catch (e) {
            productSlide.addShape('rect', {
              x: 1.5, y: 1.4, w: 7, h: 3.6,
              fill: { color: COLORS.border },
              line: { color: COLORS.secondary, width: 1 },
            });
          }
        }
      } else {
        // Grid layout for multiple images
        const cols = imgCount <= 2 ? 2 : 2;
        const rows = Math.ceil(imgCount / cols);
        const imgW = 4.2;
        const imgH = imgCount <= 2 ? 3.4 : 1.65;
        
        previewImages.forEach(async (img, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const x = 0.5 + col * 4.5;
          const y = 1.4 + row * 1.8;
          
          if (img.url) {
            try {
              const dataUri = await fetchImageAsDataUri(img.url);
              if (dataUri) {
                productSlide.addImage({
                  data: dataUri,
                  x, y, w: imgW, h: imgH,
                  sizing: { type: 'contain', w: imgW, h: imgH },
                });
              }
            } catch (e) {
              productSlide.addShape('rect', {
                x, y, w: imgW, h: imgH,
                fill: { color: COLORS.border },
              });
            }
          }
        });
      }

      // Module detection features summary
      if (wsModules.length > 0) {
        productSlide.addText(isZh ? '检测项目' : 'Detection Items', {
          x: 0.5, y: 4.3, w: 9, h: 0.25,
          fontSize: 10, color: COLORS.dark, bold: true,
        });
        
        const featureItems = wsModules.map(mod => {
          const typeLabel = MODULE_TYPE_LABELS[mod.type]?.[isZh ? 'zh' : 'en'] || mod.type;
          return `• ${typeLabel}: ${mod.name}`;
        }).join('   ');
        
        productSlide.addText(featureItems, {
          x: 0.5, y: 4.55, w: 9, h: 0.4,
          fontSize: 9, color: COLORS.secondary,
        });
      }
    }

    // ========== 4. Workstation Product Annotation Slide ==========
    if (wsAnnotation && wsAnnotation.snapshot_url) {
      onProgress(progress, `${isZh ? '添加工位产品标注页' : 'Adding workstation annotation'}: ${ws.name}...`, `${isZh ? '工位产品标注页' : 'Workstation Annotation'}`);
      
      const annotationSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
      
      annotationSlide.addText(`${wsCode} ${ws.name} - ${isZh ? '产品标注' : 'Product Annotation'}`, {
        x: 0.5, y: 0.6, w: 9, h: 0.5,
        fontSize: 20, color: COLORS.dark, bold: true,
      });

      annotationSlide.addText(`${isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN} | ${project.customer}`, {
        x: 0.5, y: 1.05, w: 9, h: 0.25,
        fontSize: 10, color: COLORS.secondary,
      });

      // Left: Annotated image
      try {
        const dataUri = await fetchImageAsDataUri(wsAnnotation.snapshot_url);
        if (dataUri) {
          annotationSlide.addImage({
            data: dataUri,
            x: 0.5, y: 1.4, w: 5.5, h: 3.6,
            sizing: { type: 'contain', w: 5.5, h: 3.6 },
          });
        } else {
          throw new Error('Failed to fetch annotation image');
        }
      } catch (e) {
        console.warn('Failed to add annotation image:', e);
        annotationSlide.addShape('rect', {
          x: 0.5, y: 1.4, w: 5.5, h: 3.6,
          fill: { color: COLORS.border },
          line: { color: COLORS.secondary, width: 1 },
        });
        annotationSlide.addText(isZh ? '标注图片加载失败' : 'Annotation image failed', {
          x: 0.5, y: 3, w: 5.5, h: 0.4,
          fontSize: 12, color: COLORS.secondary, align: 'center',
        });
      }

      // Right: Annotation legend
      annotationSlide.addText(isZh ? '标注说明' : 'Annotation Legend', {
        x: 6.2, y: 1.4, w: 3.3, h: 0.3,
        fontSize: 12, color: COLORS.dark, bold: true,
      });

      const annotationItems = wsAnnotation.annotations_json || [];
      const legendRows: TableRow[] = annotationItems
        .filter(item => item.labelNumber && item.label)
        .map(item => row([`#${item.labelNumber}`, item.label || '']));

      if (legendRows.length > 0) {
        annotationSlide.addTable(legendRows, {
          x: 6.2, y: 1.8, w: 3.3, h: Math.min(legendRows.length * 0.35 + 0.1, 2.8),
          fontFace: 'Arial',
          fontSize: 9,
          colW: [0.6, 2.7],
          border: { pt: 0.5, color: COLORS.border },
          fill: { color: COLORS.white },
          valign: 'middle',
        });
      }

      // Remark
      if (wsAnnotation.remark) {
        annotationSlide.addText(isZh ? '备注' : 'Remark', {
          x: 6.2, y: 4.2, w: 3.3, h: 0.25,
          fontSize: 10, color: COLORS.dark, bold: true,
        });
        annotationSlide.addText(wsAnnotation.remark, {
          x: 6.2, y: 4.5, w: 3.3, h: 0.5,
          fontSize: 9, color: COLORS.secondary,
        });
      }
    }

    // ========== 5. Module Detail Slides ==========
    for (let j = 0; j < wsModules.length; j++) {
      const mod = wsModules[j];
      const moduleCode = getModuleDisplayName(wsCode, mod.type, isZh);
      
      // Find module-level annotation
      const modAnnotation = annotations?.find(a => a.scope_type === 'module' && a.module_id === mod.id);
      
      onProgress(progress + (j / wsModules.length) * (progressPerWs * 0.5), 
        `${isZh ? '处理模块' : 'Processing module'}: ${moduleCode}...`, 
        `${isZh ? '生成模块页' : 'Module slide'}: ${moduleCode}`);

      const modSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });

      modSlide.addText(`${isZh ? '模块' : 'Module'}: ${moduleCode}`, {
        x: 0.5, y: 0.6, w: 9, h: 0.5,
        fontSize: 20, color: COLORS.dark, bold: true,
      });

      modSlide.addText(`${isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN} | ${project.customer}`, {
        x: 0.5, y: 1.05, w: 9, h: 0.3,
        fontSize: 10, color: COLORS.secondary,
      });

      // Left: Vision System Diagram
      modSlide.addText(isZh ? '视觉系统示意图' : 'Vision System Diagram', {
        x: 0.5, y: 1.35, w: 4.5, h: 0.3,
        fontSize: 12, color: COLORS.dark, bold: true,
      });

      const schematicUrl = mod.schematic_image_url;
      
      if (schematicUrl) {
        try {
          const dataUri = await fetchImageAsDataUri(schematicUrl);
          if (dataUri) {
            modSlide.addImage({
              data: dataUri,
              x: 0.5, y: 1.7, w: 4.5, h: 3.3,
              sizing: { type: 'contain', w: 4.5, h: 3.3 },
            });
          } else {
            throw new Error('Failed to fetch image');
          }
        } catch (e) {
          console.warn('Failed to add schematic image:', e);
          modSlide.addShape('rect', {
            x: 0.5, y: 1.7, w: 4.5, h: 3.3,
            fill: { color: COLORS.border },
            line: { color: COLORS.secondary, width: 1 },
          });
          modSlide.addText(isZh ? '未保存示意图' : 'No Diagram Saved', {
            x: 0.5, y: 3.2, w: 4.5, h: 0.4,
            fontSize: 12, color: COLORS.secondary, align: 'center',
          });
        }
      } else {
        modSlide.addShape('rect', {
          x: 0.5, y: 1.7, w: 4.5, h: 3.3,
          fill: { color: COLORS.border },
          line: { color: COLORS.secondary, width: 1 },
        });
        modSlide.addText(isZh ? '请先保存视觉系统示意图' : 'Please save diagram first', {
          x: 0.5, y: 3.2, w: 4.5, h: 0.4,
          fontSize: 11, color: COLORS.secondary, align: 'center',
        });
      }

      // Right: Module Configuration Parameters (ENHANCED)
      modSlide.addText(isZh ? '模块配置参数' : 'Module Configuration', {
        x: 5.2, y: 1.35, w: 4.3, h: 0.3,
        fontSize: 12, color: COLORS.dark, bold: true,
      });

      const selectedCamera = hardware?.cameras.find(c => c.id === mod.selected_camera);
      const selectedLens = hardware?.lenses.find(l => l.id === mod.selected_lens);
      const selectedLight = hardware?.lights.find(l => l.id === mod.selected_light);
      const selectedController = hardware?.controllers.find(c => c.id === mod.selected_controller);

      const paramRows: TableRow[] = [
        row([isZh ? '模块类型' : 'Type', MODULE_TYPE_LABELS[mod.type]?.[options.language] || mod.type]),
        row([isZh ? '触发方式' : 'Trigger', TRIGGER_LABELS[mod.trigger_type || 'io']?.[options.language] || mod.trigger_type || '-']),
        row([isZh ? '处理时限' : 'Time Limit', mod.processing_time_limit ? `${mod.processing_time_limit}ms` : '-']),
      ];
      
      // Add module-type specific parameters
      if (mod.type === 'defect' && mod.defect_config) {
        paramRows.push(row(['', '']));
        paramRows.push(row([isZh ? '【缺陷检测配置】' : '[Defect Config]', '']));
        paramRows.push(...getDefectParams(mod.defect_config as Record<string, unknown>, isZh));
      } else if (mod.type === 'measurement' && mod.measurement_config) {
        paramRows.push(row(['', '']));
        paramRows.push(row([isZh ? '【尺寸测量配置】' : '[Measurement Config]', '']));
        paramRows.push(...getMeasurementParams(mod.measurement_config as Record<string, unknown>, isZh));
      } else if (mod.type === 'ocr' && mod.ocr_config) {
        paramRows.push(row(['', '']));
        paramRows.push(row([isZh ? '【OCR配置】' : '[OCR Config]', '']));
        paramRows.push(...getOCRParams(mod.ocr_config as Record<string, unknown>, isZh));
      } else if (mod.type === 'positioning' && mod.positioning_config) {
        paramRows.push(row(['', '']));
        paramRows.push(row([isZh ? '【定位配置】' : '[Positioning Config]', '']));
        paramRows.push(...getPositioningParams(mod.positioning_config as Record<string, unknown>, isZh));
      } else if (mod.type === 'deeplearning' && mod.deep_learning_config) {
        paramRows.push(row(['', '']));
        paramRows.push(row([isZh ? '【深度学习配置】' : '[Deep Learning Config]', '']));
        paramRows.push(...getDeepLearningParams(mod.deep_learning_config as Record<string, unknown>, isZh));
      }

      // Hardware section
      paramRows.push(row(['', '']));
      paramRows.push(row([isZh ? '【硬件配置】' : '[Hardware]', '']));
      
      if (selectedCamera) {
        paramRows.push(row([isZh ? '相机' : 'Camera', `${selectedCamera.brand} ${selectedCamera.model}`]));
      }
      if (selectedLens) {
        paramRows.push(row([isZh ? '镜头' : 'Lens', `${selectedLens.brand} ${selectedLens.model}`]));
      }
      if (selectedLight) {
        paramRows.push(row([isZh ? '光源' : 'Light', `${selectedLight.brand} ${selectedLight.model}`]));
      }
      if (selectedController) {
        paramRows.push(row([isZh ? '工控机' : 'IPC', `${selectedController.brand} ${selectedController.model}`]));
      }

      const filteredRows = paramRows.filter(r => r[0].text || r[1].text);
      
      // Limit rows to fit on slide
      const displayRows = filteredRows.slice(0, 18);
      
      modSlide.addTable(displayRows, {
        x: 5.2, y: 1.7, w: 4.3, h: 3.3,
        fontFace: 'Arial',
        fontSize: 7,
        colW: [1.5, 2.8],
        border: { pt: 0.5, color: COLORS.border },
        fill: { color: COLORS.white },
        valign: 'middle',
      });

      // ========== 6. Module Imaging Parameters Slide (If more parameters exist) ==========
      const cfg = (mod.defect_config || mod.positioning_config || mod.ocr_config || mod.deep_learning_config || mod.measurement_config) as Record<string, unknown> | null;
      const imagingParams = cfg ? getImagingParams(cfg, isZh) : [];
      
      if (imagingParams.length > 0) {
        const imagingSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        
        imagingSlide.addText(`${moduleCode} - ${isZh ? '成像参数' : 'Imaging Parameters'}`, {
          x: 0.5, y: 0.6, w: 9, h: 0.5,
          fontSize: 20, color: COLORS.dark, bold: true,
        });

        imagingSlide.addText(`${isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN} | ${project.customer}`, {
          x: 0.5, y: 1.05, w: 9, h: 0.25,
          fontSize: 10, color: COLORS.secondary,
        });

        imagingSlide.addText(isZh ? '光学与成像配置' : 'Optical & Imaging Configuration', {
          x: 0.5, y: 1.4, w: 4.5, h: 0.3,
          fontSize: 12, color: COLORS.dark, bold: true,
        });

        imagingSlide.addTable(imagingParams, {
          x: 0.5, y: 1.8, w: 4.5, h: Math.min(imagingParams.length * 0.35, 3.2),
          fontFace: 'Arial',
          fontSize: 9,
          colW: [1.8, 2.7],
          border: { pt: 0.5, color: COLORS.border },
          fill: { color: COLORS.white },
          valign: 'middle',
        });

        // Hardware specs on right side
        imagingSlide.addText(isZh ? '硬件规格' : 'Hardware Specifications', {
          x: 5.2, y: 1.4, w: 4.3, h: 0.3,
          fontSize: 12, color: COLORS.dark, bold: true,
        });

        const hwSpecRows: TableRow[] = [];
        if (selectedCamera) {
          hwSpecRows.push(row([isZh ? '相机型号' : 'Camera Model', `${selectedCamera.brand} ${selectedCamera.model}`]));
          hwSpecRows.push(row([isZh ? '分辨率' : 'Resolution', selectedCamera.resolution]));
          hwSpecRows.push(row([isZh ? '帧率' : 'Frame Rate', `${selectedCamera.frame_rate} fps`]));
          hwSpecRows.push(row([isZh ? '传感器尺寸' : 'Sensor Size', selectedCamera.sensor_size]));
        }
        if (selectedLens) {
          hwSpecRows.push(row([isZh ? '镜头型号' : 'Lens Model', `${selectedLens.brand} ${selectedLens.model}`]));
          hwSpecRows.push(row([isZh ? '焦距' : 'Focal Length', selectedLens.focal_length]));
          hwSpecRows.push(row([isZh ? '光圈' : 'Aperture', selectedLens.aperture]));
        }
        if (selectedLight) {
          hwSpecRows.push(row([isZh ? '光源型号' : 'Light Model', `${selectedLight.brand} ${selectedLight.model}`]));
          hwSpecRows.push(row([isZh ? '光源类型' : 'Light Type', selectedLight.type]));
          hwSpecRows.push(row([isZh ? '颜色' : 'Color', selectedLight.color]));
          hwSpecRows.push(row([isZh ? '功率' : 'Power', selectedLight.power]));
        }

        if (hwSpecRows.length > 0) {
          imagingSlide.addTable(hwSpecRows, {
            x: 5.2, y: 1.8, w: 4.3, h: Math.min(hwSpecRows.length * 0.3, 3.2),
            fontFace: 'Arial',
            fontSize: 9,
            colW: [1.5, 2.8],
            border: { pt: 0.5, color: COLORS.border },
            fill: { color: COLORS.white },
            valign: 'middle',
          });
        }
      }

      // ========== 7. Module Local Annotation Slide ==========
      if (modAnnotation && modAnnotation.snapshot_url) {
        onProgress(progress, `${isZh ? '添加模块局部标注页' : 'Adding module annotation'}: ${moduleCode}...`, `${isZh ? '模块局部标注页' : 'Module Annotation'}`);
        
        const modAnnotationSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        
        modAnnotationSlide.addText(`${moduleCode} - ${isZh ? '产品局部标注' : 'Local Annotation'}`, {
          x: 0.5, y: 0.6, w: 9, h: 0.5,
          fontSize: 20, color: COLORS.dark, bold: true,
        });

        modAnnotationSlide.addText(`${isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN} | ${project.customer}`, {
          x: 0.5, y: 1.05, w: 9, h: 0.25,
          fontSize: 10, color: COLORS.secondary,
        });

        // Left: Annotated image
        try {
          const dataUri = await fetchImageAsDataUri(modAnnotation.snapshot_url);
          if (dataUri) {
            modAnnotationSlide.addImage({
              data: dataUri,
              x: 0.5, y: 1.4, w: 5.5, h: 3.6,
              sizing: { type: 'contain', w: 5.5, h: 3.6 },
            });
          } else {
            throw new Error('Failed to fetch annotation image');
          }
        } catch (e) {
          console.warn('Failed to add module annotation image:', e);
          modAnnotationSlide.addShape('rect', {
            x: 0.5, y: 1.4, w: 5.5, h: 3.6,
            fill: { color: COLORS.border },
            line: { color: COLORS.secondary, width: 1 },
          });
          modAnnotationSlide.addText(isZh ? '标注图片加载失败' : 'Annotation image failed', {
            x: 0.5, y: 3, w: 5.5, h: 0.4,
            fontSize: 12, color: COLORS.secondary, align: 'center',
          });
        }

        // Right: Annotation legend
        modAnnotationSlide.addText(isZh ? '标注说明' : 'Annotation Legend', {
          x: 6.2, y: 1.4, w: 3.3, h: 0.3,
          fontSize: 12, color: COLORS.dark, bold: true,
        });

        const modAnnotationItems = modAnnotation.annotations_json || [];
        const modLegendRows: TableRow[] = modAnnotationItems
          .filter(item => item.labelNumber && item.label)
          .map(item => row([`#${item.labelNumber}`, item.label || '']));

        if (modLegendRows.length > 0) {
          modAnnotationSlide.addTable(modLegendRows, {
            x: 6.2, y: 1.8, w: 3.3, h: Math.min(modLegendRows.length * 0.35 + 0.1, 2.8),
            fontFace: 'Arial',
            fontSize: 9,
            colW: [0.6, 2.7],
            border: { pt: 0.5, color: COLORS.border },
            fill: { color: COLORS.white },
            valign: 'middle',
          });
        }

        // Remark
        if (modAnnotation.remark) {
          modAnnotationSlide.addText(isZh ? '备注' : 'Remark', {
            x: 6.2, y: 4.2, w: 3.3, h: 0.25,
            fontSize: 10, color: COLORS.dark, bold: true,
          });
          modAnnotationSlide.addText(modAnnotation.remark, {
            x: 6.2, y: 4.5, w: 3.3, h: 0.5,
            fontSize: 9, color: COLORS.secondary,
          });
        }
      }
    }
  }

  // ========== HARDWARE DETAIL SLIDES ==========
  if (hardware) {
    progress = 88;
    onProgress(progress, isZh ? '生成硬件详情...' : 'Generating hardware details...', isZh ? '硬件详情页' : 'Hardware details');

    const usedCameraIds = new Set(modules.filter(m => m.selected_camera).map(m => m.selected_camera));
    const usedLensIds = new Set(modules.filter(m => m.selected_lens).map(m => m.selected_lens));
    const usedLightIds = new Set(modules.filter(m => m.selected_light).map(m => m.selected_light));
    const usedControllerIds = new Set(modules.filter(m => m.selected_controller).map(m => m.selected_controller));

    const usedCameras = hardware.cameras.filter(c => usedCameraIds.has(c.id));
    const usedLenses = hardware.lenses.filter(l => usedLensIds.has(l.id));
    const usedLights = hardware.lights.filter(l => usedLightIds.has(l.id));
    const usedControllers = hardware.controllers.filter(c => usedControllerIds.has(c.id));

    const addHardwareDetailSlide = async (
      title: string,
      subtitle: string,
      imageUrl: string | null,
      infoRows: TableRow[]
    ) => {
      const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
      
      slide.addText(title, {
        x: 0.5, y: 0.6, w: 9, h: 0.5,
        fontSize: 22, color: COLORS.dark, bold: true,
      });

      slide.addText(subtitle, {
        x: 0.5, y: 1.05, w: 9, h: 0.3,
        fontSize: 12, color: COLORS.secondary,
      });

      if (imageUrl) {
        try {
          const dataUri = await fetchImageAsDataUri(imageUrl);
          if (dataUri) {
            slide.addImage({
              data: dataUri,
              x: 0.5, y: 1.5, w: 4, h: 3.5,
              sizing: { type: 'contain', w: 4, h: 3.5 },
            });
          } else {
            throw new Error('Failed to fetch image');
          }
        } catch (e) {
          slide.addShape('rect', {
            x: 0.5, y: 1.5, w: 4, h: 3.5,
            fill: { color: COLORS.border },
            line: { color: COLORS.secondary, width: 1 },
          });
          slide.addText(isZh ? '产品图片' : 'Product Image', {
            x: 0.5, y: 3, w: 4, h: 0.5,
            fontSize: 14, color: COLORS.secondary, align: 'center',
          });
        }
      } else {
        slide.addShape('rect', {
          x: 0.5, y: 1.5, w: 4, h: 3.5,
          fill: { color: COLORS.border },
          line: { color: COLORS.secondary, width: 1 },
        });
        slide.addText(isZh ? '产品图片' : 'Product Image', {
          x: 0.5, y: 3, w: 4, h: 0.5,
          fontSize: 14, color: COLORS.secondary, align: 'center',
        });
      }

      slide.addText(isZh ? '规格参数' : 'Specifications', {
        x: 5, y: 1.5, w: 4.5, h: 0.4,
        fontSize: 14, color: COLORS.dark, bold: true,
      });

      slide.addTable(infoRows, {
        x: 5, y: 1.95, w: 4.5, h: Math.min(infoRows.length * 0.45 + 0.1, 3),
        fontFace: 'Arial',
        fontSize: 10,
        colW: [1.8, 2.7],
        border: { pt: 0.5, color: COLORS.border },
        fill: { color: COLORS.white },
        valign: 'middle',
      });
    };

    for (const camera of usedCameras) {
      const cameraInfoRows: TableRow[] = [
        row([isZh ? '品牌' : 'Brand', camera.brand]),
        row([isZh ? '型号' : 'Model', camera.model]),
        row([isZh ? '分辨率' : 'Resolution', camera.resolution]),
        row([isZh ? '帧率' : 'Frame Rate', `${camera.frame_rate} fps`]),
        row([isZh ? '接口' : 'Interface', camera.interface]),
        row([isZh ? '传感器尺寸' : 'Sensor Size', camera.sensor_size]),
      ];
      await addHardwareDetailSlide(
        `${isZh ? '相机' : 'Camera'}: ${camera.model}`,
        `${camera.brand} | ${isZh ? '工业相机' : 'Industrial Camera'}`,
        camera.image_url,
        cameraInfoRows
      );
    }

    for (const lens of usedLenses) {
      const lensInfoRows: TableRow[] = [
        row([isZh ? '品牌' : 'Brand', lens.brand]),
        row([isZh ? '型号' : 'Model', lens.model]),
        row([isZh ? '焦距' : 'Focal Length', lens.focal_length]),
        row([isZh ? '光圈' : 'Aperture', lens.aperture]),
        row([isZh ? '接口' : 'Mount', lens.mount]),
      ];
      await addHardwareDetailSlide(
        `${isZh ? '镜头' : 'Lens'}: ${lens.model}`,
        `${lens.brand} | ${isZh ? '工业镜头' : 'Industrial Lens'}`,
        lens.image_url,
        lensInfoRows
      );
    }

    for (const light of usedLights) {
      const lightInfoRows: TableRow[] = [
        row([isZh ? '品牌' : 'Brand', light.brand]),
        row([isZh ? '型号' : 'Model', light.model]),
        row([isZh ? '类型' : 'Type', light.type]),
        row([isZh ? '颜色' : 'Color', light.color]),
        row([isZh ? '功率' : 'Power', light.power]),
      ];
      await addHardwareDetailSlide(
        `${isZh ? '光源' : 'Light'}: ${light.model}`,
        `${light.brand} | ${isZh ? '机器视觉光源' : 'Machine Vision Light'}`,
        light.image_url,
        lightInfoRows
      );
    }

    for (const controller of usedControllers) {
      const controllerInfoRows: TableRow[] = [
        row([isZh ? '品牌' : 'Brand', controller.brand]),
        row([isZh ? '型号' : 'Model', controller.model]),
        row(['CPU', controller.cpu]),
        row([isZh ? '内存' : 'Memory', controller.memory]),
        row([isZh ? '存储' : 'Storage', controller.storage]),
        row([isZh ? '性能等级' : 'Performance', controller.performance]),
      ];
      if (controller.gpu) {
        controllerInfoRows.splice(3, 0, row(['GPU', controller.gpu]));
      }
      await addHardwareDetailSlide(
        `${isZh ? '工控机' : 'Controller'}: ${controller.model}`,
        `${controller.brand} | ${isZh ? '工业控制器' : 'Industrial Controller'}`,
        controller.image_url,
        controllerInfoRows
      );
    }
  }

  // ========== HARDWARE SUMMARY SLIDE ==========
  progress = 92;
  onProgress(progress, isZh ? '生成硬件清单...' : 'Generating hardware list...', isZh ? '硬件清单汇总' : 'Hardware summary');

  const hwSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  
  hwSlide.addText(isZh ? '硬件清单汇总' : 'Hardware Summary', {
    x: 0.5, y: 0.6, w: 9, h: 0.6,
    fontSize: 24, color: COLORS.dark, bold: true,
  });

  const moduleCameraCount = modules.filter(m => m.selected_camera).length;
  const moduleLensCount = modules.filter(m => m.selected_lens).length;
  const moduleLightCount = modules.filter(m => m.selected_light).length;
  const moduleControllerIds = new Set(modules.filter(m => m.selected_controller).map(m => m.selected_controller));
  
  const layoutCameraCount = layouts.reduce((sum, l) => sum + (l.selected_cameras?.filter(c => c)?.length || 0), 0);
  const layoutLensCount = layouts.reduce((sum, l) => sum + (l.selected_lenses?.filter(c => c)?.length || 0), 0);
  const layoutLightCount = layouts.reduce((sum, l) => sum + (l.selected_lights?.filter(c => c)?.length || 0), 0);
  const layoutControllerCount = layouts.filter(l => l.selected_controller).length;
  
  const totalCameraCount = layoutCameraCount > 0 ? layoutCameraCount : moduleCameraCount;
  const totalLensCount = layoutLensCount > 0 ? layoutLensCount : moduleLensCount;
  const totalLightCount = layoutLightCount > 0 ? layoutLightCount : moduleLightCount;
  const totalControllerCount = layoutControllerCount > 0 ? layoutControllerCount : moduleControllerIds.size;

  const hwSummary: TableRow[] = [
    row([isZh ? '设备类型' : 'Device Type', isZh ? '数量' : 'Quantity', isZh ? '备注' : 'Notes']),
    row([isZh ? '工业相机' : 'Industrial Camera', totalCameraCount.toString(), isZh ? '按工位配置' : 'Per workstation']),
    row([isZh ? '工业镜头' : 'Industrial Lens', totalLensCount.toString(), isZh ? '按工位配置' : 'Per workstation']),
    row([isZh ? '光源' : 'Light Source', totalLightCount.toString(), isZh ? '按工位配置' : 'Per workstation']),
    row([isZh ? '工控机' : 'Industrial PC', totalControllerCount.toString(), isZh ? '可多工位共享' : 'Shared']),
  ];

  hwSlide.addTable(hwSummary, {
    x: 0.5, y: 1.4, w: 9, h: 2,
    fontFace: 'Arial',
    fontSize: 11,
    colW: [3, 2, 4],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle',
    align: 'center',
  });

  // ========== END SLIDE ==========
  progress = 98;
  onProgress(progress, isZh ? '生成结束页...' : 'Generating end slide...', isZh ? '生成结束页' : 'End slide');

  const endSlide = pptx.addSlide();
  
  endSlide.addShape('rect', {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: COLORS.dark },
  });

  endSlide.addText(isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN, {
    x: 0.5, y: 1.5, w: 9, h: 0.5,
    fontSize: 16, color: COLORS.white, align: 'center',
  });

  endSlide.addText(isZh ? '感谢您的关注' : 'Thank You', {
    x: 0.5, y: 2.2, w: 9, h: 1,
    fontSize: 36, color: COLORS.white, bold: true, align: 'center',
  });

  endSlide.addText(project.customer, {
    x: 0.5, y: 3.2, w: 9, h: 0.5,
    fontSize: 18, color: COLORS.white, align: 'center',
  });

  endSlide.addText(`${project.responsible || ''} | ${project.date || ''}`, {
    x: 0.5, y: 3.7, w: 9, h: 0.4,
    fontSize: 12, color: COLORS.secondary, align: 'center',
  });

  // Generate blob
  progress = 100;
  onProgress(progress, isZh ? '完成' : 'Complete', isZh ? 'PPT生成完成' : 'PPT generation complete');

  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  return blob;
}
