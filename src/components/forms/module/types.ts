// Local type definitions to avoid dependency on auto-generated Supabase types
import type { ModuleLightItem } from '@/utils/moduleLightItems';

export type ModuleType = 'positioning' | 'defect' | 'ocr' | 'deeplearning' | 'measurement';
export type TriggerType = 'io' | 'encoder' | 'software' | 'continuous';
export type QualityStrategy = 'no_miss' | 'balanced' | 'allow_pass';
export type DistanceUnit = 'mm' | 'cm' | 'm';

// Common enums
export type InspectionSurface = 'top' | 'side' | 'bottom' | 'hole' | 'edge';
export type MissTolerance = 'none' | 'low' | 'acceptable';
export type FalseRejectTolerance = 'acceptable' | 'low' | 'strict';
export type JudgmentRule = 'any' | 'area_threshold' | 'count_threshold' | 'grade';
export type MaterialProperty = 'high_reflection' | 'low_contrast' | 'complex_texture' | 'oily' | 'dust' | 'scratch_sensitive';
export type ROIStrategy = 'full' | 'custom';
export type ROIDefinition = 'draw' | 'numeric';
export type DataRetention = 'none' | 'ng_only' | 'all' | 'sampled';
export type OutputType = 'ok_ng' | 'coordinates' | 'defect_class' | 'dimensions' | 'string' | 'confidence' | 'screenshot';
export type FailureHandling = 'retry' | 'alarm' | 'pass';
export type CalibrationMethod = 'plane' | 'multipoint' | 'fixture' | 'hand_eye' | 'none';
export type ConveyorType = 'belt' | 'roller' | 'step' | 'other';

// Positioning module types
export type PositionTargetType = 'hole' | 'edge' | 'corner' | 'qrcode' | 'feature' | 'mark';
export type OutputCoordinate = 'pixel' | 'mechanical' | 'robot';
export type PostureChange = 'translation' | 'rotation' | 'height';
export type GuidingMode = 'single_camera' | 'dual_camera';
export type GuidingMechanism = 'fixed' | 'robot' | 'three_axis' | 'cylinder' | 'gantry';
export type CameraLayout = 'center' | 'offset';

// Camera config for positioning
export interface PositioningCameraConfig {
  workingDistance: string;
  fieldOfView: string;
  layout: CameraLayout;
  offsetX: string;
  offsetY: string;
}

// Camera config for defect detection
export interface DefectCameraConfig {
  workingDistance: string;
  fieldOfView: string;
  overlapRate: string;
  resolution: string;
}

export interface DefectItem {
  name: string;
  minSize: string;
}

// OCR module types
export type CharType = 'inkjet' | 'laser' | 'silkscreen' | 'label' | 'qrcode' | 'barcode' | 'dot_matrix';
export type Charset = 'numeric' | 'alpha' | 'mixed' | 'custom';
export type CharDirection = 'fixed' | 'rotatable' | 'any';
export type QualificationStrategy = 'match_rule' | 'whitelist' | 'blacklist';
export type UnclearHandling = 'strict_ng' | 'retry' | 'manual_review';

// Deep learning types
export type DLTaskType = 'classification' | 'detection' | 'segmentation' | 'anomaly';
export type DeployTarget = 'cpu' | 'gpu' | 'edge';
export type UpdateStrategy = 'fixed' | 'periodic' | 'batch';
export type AnnotationMethod = 'box' | 'mask' | 'classification' | 'unsupervised';
export type ColdStartStrategy = 'anomaly_detection' | 'few_shot' | 'synthetic';

// Measurement types
export type MeasurementDimType = 'length' | 'diameter' | 'angle' | 'distance' | 'radius' | 'height' | 'area' | 'concentricity';
export type MeasurementJudgment = 'tolerance_ng' | 'grade';
export type SamplingStrategy = 'single' | 'average_3' | 'average_5' | 'median';

export interface MeasurementItem {
  id: string;
  name: string;
  dimType: MeasurementDimType;
  nominalValue: number;
  upperTolerance: number;
  lowerTolerance: number;
  unit: 'mm' | 'deg';
  judgment: MeasurementJudgment;
}

export interface ROIRect {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: 'px' | 'percent';
}

// Config interfaces
export interface CommonConfig {
  roiStrategy: ROIStrategy;
  roiDefinition?: ROIDefinition;
  roiRect?: ROIRect;
  inspectionSurfaces: InspectionSurface[];
  showFieldOfView: boolean;
  qualityStrategy: QualityStrategy;
  dataRetention: DataRetention;
  outputTypes: OutputType[];
  remarks: string;
}

export interface DefectConfig {
  defectClasses: string[];
  defectItems?: Array<{ name: string; minSize?: number | null }>;
  minDefectSize?: number | null;
  missTolerance: MissTolerance;
  falseRejectTolerance: FalseRejectTolerance;
  inspectionSurfaces: InspectionSurface[];
  judgmentRule: JudgmentRule;
  materialProperties: MaterialProperty[];
  defectGrading: boolean;
  defectGradingRules?: string;
  recheckStrategy: boolean;
  recheckCount?: number;
  ngRetentionType: 'full' | 'roi' | 'both';
  allowedContamination?: string;
  areaDescription?: string;
}

export interface PositioningConfig {
  targetType: PositionTargetType;
  outputCoordinate: OutputCoordinate;
  accuracyRequirement: number;
  repeatabilityRequirement: number;
  coordinateDescription: string;
  postureChanges: PostureChange[];
  calibrationMethod: CalibrationMethod;
  failureHandling: FailureHandling;
  retryCount?: number;
  regionRestriction: boolean;
  restrictedROI?: ROIRect;
}

export interface OCRConfig {
  charType: CharType;
  contentRule: string;
  minCharHeight: number;
  charset: Charset;
  customCharset?: string;
  charCount?: number;
  codeCount?: number;
  charDirection: CharDirection;
  qualificationStrategy: QualificationStrategy;
  unclearHandling: UnclearHandling;
  multiROI: boolean;
  outputFields: ('string' | 'confidence' | 'screenshot')[];
}

export interface MeasurementConfig {
  measurementItems: MeasurementItem[];
  systemAccuracy: number;
  calibrationMethod: CalibrationMethod;
  outputFormat: ('value' | 'ok_ng' | 'statistics')[];
  measurementDatum?: string;
  samplingStrategy: SamplingStrategy;
  repeatabilityRequirement?: number;
  environmentRisks: ('vibration' | 'temperature' | 'dust')[];
  traceabilityField?: string;
}

export interface DeepLearningConfig {
  taskType: DLTaskType;
  targetClasses: string[];
  inferenceTimeTarget: number;
  deployTarget: DeployTarget;
  updateStrategy: UpdateStrategy;
  dataSource: string;
  sampleSize: number;
  annotationMethod: AnnotationMethod;
  evaluationMetrics: ('recall' | 'miss_rate' | 'false_reject_rate' | 'precision')[];
  noMissStrategy: string;
  coldStartStrategy?: ColdStartStrategy;
}

export interface OtherConfig {
  purposeDescription: string;
  inputDescription: string;
  outputDefinition: string;
  customParameters: { name: string; value: string; unit: string }[];
  risksAndLimitations?: string;
  customAcceptanceCriteria?: string;
}

// Form state type
export interface ModuleFormState {
  // Basic info
  name: string;
  description: string;
  type: ModuleType;
  triggerType: TriggerType;
  processingTimeLimit: string;
  
  // Hardware
  selectedCamera: string;
  selectedLens: string;
  selectedLight: string;
  selectedController: string;
  lightItems: ModuleLightItem[];
  
  // Common fields
  roiStrategy: ROIStrategy;
  roiDefinition: ROIDefinition;
  roiRect: ROIRect;
  inspectionSurfaces: InspectionSurface[];
  showFieldOfView: boolean;
  qualityStrategy: QualityStrategy;
  dataRetention: DataRetention;
  outputTypes: OutputType[];
  remarks: string;
  
  // Industrial common parameters
  detectionObject: string; // 检测对象/检测内容描述
  judgmentStrategy: 'no_miss' | 'balanced' | 'allow_pass'; // 判定策略
  outputAction: string[]; // 输出动作：报警/停机/剔除/标记/上传MES/存图
  communicationMethod: string; // 通讯方式：IO/PLC/TCP/串口
  signalDefinition: string; // 信号定义
  dataRetentionDays: string; // 数据留存天数
  
  // Imaging and optical parameters
  distanceUnit: DistanceUnit; // 距离单位，默认 mm；内部计算统一换算为 mm
  is3DCamera: boolean; // 3D相机无需镜头
  workingDistance: string; // 工作距离WD (mm) - 通用字段，各类型可能覆盖
  fieldOfViewCommon: string; // 视野FOV (mm×mm) - 通用字段
  fieldOfViewWidth: string; // FOV 宽 (mm)
  fieldOfViewHeight: string; // FOV 高 (mm)
  resolutionPerPixel: string; // 分辨率换算 (mm/px)
  exposure: string; // 曝光 (us/ms)
  gain: string; // 增益 (dB)
  triggerDelay: string; // 触发延时 (ms)
  lightMode: string; // 光源模式：常亮/频闪/PWM
  lightAngle: string; // 光源角度
  lightCount: string; // 光源数量
  lightDistance: string; // 光源距离
  lightDistanceHorizontal: string; // 光源水平距离 (mm)
  lightDistanceVertical: string; // 光源垂直距离 (mm)
  lensAperture: string; // 镜头光圈 (F值)
  depthOfField: string; // 靶面尺寸要求（历史字段名沿用 depthOfField）
  workingDistanceTolerance: string; // 工作距离公差 (±mm)
  cameraInstallNote: string; // 相机安装说明
  lightNote: string; // 光源备注
  
  // Defect config
  defectClasses: string[];
  defectItems: DefectItem[];
  minDefectSize: string;
  missTolerance: MissTolerance;
  falseRejectTolerance: FalseRejectTolerance;
  judgmentRule: JudgmentRule;
  materialProperties: MaterialProperty[];
  defectGrading: boolean;
  defectGradingRules: string;
  recheckStrategy: boolean;
  recheckCount: string;
  ngRetentionType: 'full' | 'roi' | 'both';
  allowedContamination: string;
  areaDescription: string;
  // New defect detection fields
  detectionAreaLength: string;
  detectionAreaWidth: string;
  conveyorType: ConveyorType;
  lineSpeed: string;
  defectCameraCount: '1' | '2' | '3';
  defectCamera1Config: DefectCameraConfig;
  defectCamera2Config: DefectCameraConfig;
  defectCamera3Config: DefectCameraConfig;
  // Industrial defect parameters
  defectContrast: string; // 缺陷对比度
  materialReflectionLevel: string; // 材质反光等级
  allowedMissRate: string; // 允许漏检率 (ppm或%)
  allowedFalseRate: string; // 允许误检率 (ppm或%)
  confidenceThreshold: string; // 置信度阈值/NG判定阈值
  
  // Positioning config
  targetType: PositionTargetType;
  outputCoordinate: OutputCoordinate;
  accuracyRequirement: string;
  repeatabilityRequirement: string;
  coordinateDescription: string;
  postureChanges: PostureChange[];
  calibrationMethod: CalibrationMethod;
  failureHandling: FailureHandling;
  retryCount: string;
  regionRestriction: boolean;
  // New positioning fields
  guidingMode: GuidingMode;
  guidingMechanism: GuidingMechanism;
  fieldOfView: string; // positioning专用视野范围
  // Note: workingDistance already defined above in imaging section
  grabOffsetX: string;
  grabOffsetY: string;
  toleranceX: string;
  toleranceY: string;
  cameraCount: '1' | '2';
  camera1Config: PositioningCameraConfig;
  camera2Config: PositioningCameraConfig;
  coordinateSystem: string;
  shotCountAndTakt: string;
  toleranceRange: string;
  siteConstraints: string;
  // Industrial positioning parameters
  outputCoordinateSystem: string; // 输出坐标系：相机/工位/机器人
  calibrationCycle: string; // 标定周期
  accuracyAcceptanceMethod: string; // 精度验收方法
  targetFeatureType: string; // 目标特征类型
  targetCount: string; // 目标数量
  occlusionTolerance: string; // 遮挡容忍
  
  // OCR config
  charType: CharType;
  contentRule: string;
  minCharHeight: string;
  charset: Charset;
  customCharset: string;
  charCount: string;
  codeCount: string;
  charDirection: CharDirection;
  qualificationStrategy: QualificationStrategy;
  unclearHandling: UnclearHandling;
  multiROI: boolean;
  ocrOutputFields: ('string' | 'confidence' | 'screenshot')[];
  // New OCR fields
  ocrAreaWidth: string;
  ocrAreaHeight: string;
  singleCharHeight: string;
  ocrCameraFieldOfView: string;
  ocrWorkingDistance: string;
  ocrResolution: string;
  // Industrial OCR parameters
  charWidth: string; // 字符宽度
  minStrokeWidth: string; // 最小笔画
  allowedRotationAngle: string; // 允许旋转角度
  allowedDamageLevel: string; // 允许污损等级
  charRuleExample: string; // 字符规则示例
  
  // Measurement config
  measurementItems: MeasurementItem[];
  measurementObjectDescription: string;
  measurementFieldOfView: string;
  measurementResolution: string;
  measurementCalibrationMethod: CalibrationMethod;
  calibrationPlateSpec: string;
  targetAccuracy: string;
  systemAccuracy: string;
  measurementOutputFormat: ('value' | 'ok_ng' | 'statistics')[];
  measurementDatum: string;
  samplingStrategy: SamplingStrategy;
  measurementRepeatability: string;
  environmentRisks: ('vibration' | 'temperature' | 'dust')[];
  traceabilityField: string;
  // Industrial measurement parameters
  grr: string; // GRR
  calibrationCycleMeasurement: string; // 标定周期
  calibrationBlockType: string; // 量块或标定板类型
  edgeExtractionMethod: string; // 边缘提取方式：亚像素/阈值/拟合
  
  // Deep learning config
  dlTaskType: DLTaskType;
  targetClasses: string[];
  inferenceTimeTarget: string;
  deployTarget: DeployTarget;
  updateStrategy: UpdateStrategy;
  dataSource: string;
  sampleSize: string;
  annotationMethod: AnnotationMethod;
  evaluationMetrics: ('recall' | 'miss_rate' | 'false_reject_rate' | 'precision')[];
  noMissStrategy: string;
  coldStartStrategy: ColdStartStrategy | '';
  // New deep learning fields
  dlRoiWidth: string;
  dlRoiHeight: string;
  dlRoiCount: string;
  dlClassCount: string;
  dlFieldOfView: string;
  
  // Precision strategy
  redundancyStrategy: string;
  
  // Other config
  purposeDescription: string;
  inputDescription: string;
  outputDefinition: string;
  customParameters: { name: string; value: string; unit: string }[];
  risksAndLimitations: string;
  customAcceptanceCriteria: string;

  // ============ 3D 相机检测专属字段（is3DCamera === true 时启用） ============
  threeDModel: string;                   // 3D 相机型号，如 "LJ-S080"
  threeDDetectionMethod: string;         // 检测方式，如 "3D 相机垂直固定"
  threeDMountType: string;               // 安装方式
  threeDReferenceDistance: string;       // 基准距离 (mm)
  threeDZRange: string;                  // Z 量程，如 "FS±23mm"
  threeDXRange: string;                  // X 测量范围，如 "66–78mm"
  threeDYRange: string;                  // Y 扫描范围，如 "160mm"
  threeDXYPrecision: string;             // XY 像素精度 (mm)
  threeDZPrecision: string;              // Z 线性精度 (mm)
  threeDScanLineWidth: string;           // 扫描线宽 (mm)
  threeDDataPoints: string;              // 数据点数量，如 "3200×6400"
  threeDScanTime: string;                // 拍照/扫描时间，如 "2-3s/次"
  threeDShotsPerSide: string;            // 单面检测次数
  threeDShotsPerProduct: string;         // 单产品检测次数
  threeDNeedFlip: boolean;               // 是否需要翻面
  threeDNeedRobot: boolean;              // 是否需要机械手
  threeDNeedFixture: boolean;            // 是否需要治具定位
  threeDDetectionSteps: string[];        // 检测步骤（可编辑）
}

export const DEFAULT_THREE_D_DETECTION_STEPS: string[] = [
  '3D 相机垂直固定在支架上，从下往上或由上往下对产品进行扫描',
  '机械手抓取产品移动到相机检测区域',
  '相机完成产品正面检测',
  '机械手翻转产品',
  '相机继续完成反面检测',
  '每个产品正面检测 2 次、反面检测 2 次，共 4 次',
  '系统生成高度图或点云数据',
  '系统分析尺寸、轮廓、高度差、凹陷、缺料、多料等特征',
  '输出 OK/NG 结果，并保存检测图像、点云数据、测量结果和检测报告',
];

export const getDefaultFormState = (): ModuleFormState => ({
  name: '',
  description: '',
  type: 'defect',
  triggerType: 'io',
  processingTimeLimit: '200',
  
  selectedCamera: '',
  selectedLens: '',
  selectedLight: '',
  selectedController: '',
  lightItems: [],
  
  roiStrategy: 'full',
  roiDefinition: 'draw',
  roiRect: { x: 0, y: 0, width: 100, height: 100, unit: 'percent' },
  inspectionSurfaces: ['top'],
  showFieldOfView: true,
  qualityStrategy: 'balanced',
  dataRetention: 'ng_only',
  outputTypes: ['ok_ng'],
  remarks: '',
  
  // Industrial common parameters defaults
  detectionObject: '',
  judgmentStrategy: 'balanced',
  outputAction: [],
  communicationMethod: '',
  signalDefinition: '',
  dataRetentionDays: '',
  
  // Imaging and optical parameters defaults
  distanceUnit: 'mm',
  is3DCamera: false,
  workingDistance: '',
  fieldOfViewCommon: '',
  fieldOfViewWidth: '',
  fieldOfViewHeight: '',
  resolutionPerPixel: '',
  exposure: '',
  gain: '',
  triggerDelay: '',
  lightMode: '',
  lightAngle: '',
  lightCount: '1',
  lightDistance: '',
  lightDistanceHorizontal: '',
  lightDistanceVertical: '',
  lensAperture: '',
  depthOfField: '',
  workingDistanceTolerance: '',
  cameraInstallNote: '',
  lightNote: '',
  
  defectClasses: [],
  defectItems: [],
  minDefectSize: '',
  missTolerance: 'none',
  falseRejectTolerance: 'acceptable',
  judgmentRule: 'any',
  materialProperties: [],
  defectGrading: false,
  defectGradingRules: '',
  recheckStrategy: false,
  recheckCount: '1',
  ngRetentionType: 'both',
  allowedContamination: '',
  areaDescription: '',
  // New defect detection defaults
  detectionAreaLength: '',
  detectionAreaWidth: '',
  conveyorType: 'belt',
  lineSpeed: '',
  defectCameraCount: '1',
  defectCamera1Config: { workingDistance: '', fieldOfView: '', overlapRate: '10', resolution: '' },
  defectCamera2Config: { workingDistance: '', fieldOfView: '', overlapRate: '10', resolution: '' },
  defectCamera3Config: { workingDistance: '', fieldOfView: '', overlapRate: '10', resolution: '' },
  // Industrial defect parameters defaults
  defectContrast: '',
  materialReflectionLevel: '',
  allowedMissRate: '',
  allowedFalseRate: '',
  confidenceThreshold: '',
  
  targetType: 'edge',
  outputCoordinate: 'pixel',
  accuracyRequirement: '0.1',
  repeatabilityRequirement: '0.03',
  coordinateDescription: '',
  postureChanges: [],
  calibrationMethod: 'plane',
  failureHandling: 'alarm',
  retryCount: '3',
  regionRestriction: false,
  // New positioning defaults
  guidingMode: 'single_camera',
  guidingMechanism: 'fixed',
  fieldOfView: '',
  // workingDistance already has default above
  grabOffsetX: '0',
  grabOffsetY: '0',
  toleranceX: '0.1',
  toleranceY: '0.1',
  cameraCount: '1',
  camera1Config: { workingDistance: '', fieldOfView: '', layout: 'center', offsetX: '0', offsetY: '0' },
  camera2Config: { workingDistance: '', fieldOfView: '', layout: 'center', offsetX: '0', offsetY: '0' },
  coordinateSystem: '',
  shotCountAndTakt: '',
  toleranceRange: '',
  siteConstraints: '',
  // Industrial positioning parameters defaults
  outputCoordinateSystem: '',
  calibrationCycle: '',
  accuracyAcceptanceMethod: '',
  targetFeatureType: '',
  targetCount: '',
  occlusionTolerance: '',
  
  charType: 'laser',
  contentRule: '',
  minCharHeight: '2',
  charset: 'mixed',
  customCharset: '',
  charCount: '',
  codeCount: '',
  charDirection: 'fixed',
  qualificationStrategy: 'match_rule',
  unclearHandling: 'strict_ng',
  multiROI: false,
  ocrOutputFields: ['string'],
  // New OCR defaults
  ocrAreaWidth: '',
  ocrAreaHeight: '',
  singleCharHeight: '',
  ocrCameraFieldOfView: '',
  ocrWorkingDistance: '',
  ocrResolution: '',
  // Industrial OCR parameters defaults
  charWidth: '',
  minStrokeWidth: '',
  allowedRotationAngle: '',
  allowedDamageLevel: '',
  charRuleExample: '',
  
  measurementItems: [],
  measurementObjectDescription: '',
  measurementFieldOfView: '',
  measurementResolution: '',
  measurementCalibrationMethod: 'plane',
  calibrationPlateSpec: '',
  targetAccuracy: '',
  systemAccuracy: '0.02',
  measurementOutputFormat: ['value', 'ok_ng'],
  measurementDatum: '',
  samplingStrategy: 'single',
  measurementRepeatability: '',
  environmentRisks: [],
  traceabilityField: '',
  // Industrial measurement parameters defaults
  grr: '',
  calibrationCycleMeasurement: '',
  calibrationBlockType: '',
  edgeExtractionMethod: '',
  
  dlTaskType: 'classification',
  targetClasses: [],
  inferenceTimeTarget: '50',
  deployTarget: 'gpu',
  updateStrategy: 'periodic',
  dataSource: '',
  sampleSize: '',
  annotationMethod: 'box',
  evaluationMetrics: ['recall'],
  noMissStrategy: '',
  coldStartStrategy: '',
  // New deep learning defaults
  dlRoiWidth: '',
  dlRoiHeight: '',
  dlRoiCount: '1',
  dlClassCount: '',
  dlFieldOfView: '',
  
  redundancyStrategy: 'standard',
  
  purposeDescription: '',
  inputDescription: '',
  outputDefinition: '',
  customParameters: [],
  risksAndLimitations: '',
  customAcceptanceCriteria: '',
});
