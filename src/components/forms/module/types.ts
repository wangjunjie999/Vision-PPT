// Local type definitions to avoid dependency on auto-generated Supabase types
export type ModuleType = 'positioning' | 'defect' | 'ocr' | 'deeplearning' | 'measurement';
export type TriggerType = 'io' | 'encoder' | 'software' | 'continuous';
export type QualityStrategy = 'no_miss' | 'balanced' | 'allow_pass';

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
  minDefectSize: number;
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
  workingDistance: string; // 工作距离WD (mm) - 通用字段，各类型可能覆盖
  fieldOfViewCommon: string; // 视野FOV (mm×mm) - 通用字段
  resolutionPerPixel: string; // 分辨率换算 (mm/px)
  exposure: string; // 曝光 (us/ms)
  gain: string; // 增益 (dB)
  triggerDelay: string; // 触发延时 (ms)
  lightMode: string; // 光源模式：常亮/频闪/PWM
  lightAngle: string; // 光源角度
  lightDistance: string; // 光源距离
  lightDistanceHorizontal: string; // 光源水平距离 (mm)
  lightDistanceVertical: string; // 光源垂直距离 (mm)
  lensAperture: string; // 镜头光圈 (F值)
  depthOfField: string; // 景深要求
  workingDistanceTolerance: string; // 工作距离公差 (±mm)
  cameraInstallNote: string; // 相机安装说明
  lightNote: string; // 光源备注
  
  // Defect config
  defectClasses: string[];
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
  
  // Other config
  purposeDescription: string;
  inputDescription: string;
  outputDefinition: string;
  customParameters: { name: string; value: string; unit: string }[];
  risksAndLimitations: string;
  customAcceptanceCriteria: string;
}

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
  workingDistance: '',
  fieldOfViewCommon: '',
  resolutionPerPixel: '',
  exposure: '',
  gain: '',
  triggerDelay: '',
  lightMode: '',
  lightAngle: '',
  lightDistance: '',
  lightDistanceHorizontal: '',
  lightDistanceVertical: '',
  lensAperture: '',
  depthOfField: '',
  workingDistanceTolerance: '',
  cameraInstallNote: '',
  lightNote: '',
  
  defectClasses: [],
  minDefectSize: '0.5',
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
  
  purposeDescription: '',
  inputDescription: '',
  outputDefinition: '',
  customParameters: [],
  risksAndLimitations: '',
  customAcceptanceCriteria: '',
});
