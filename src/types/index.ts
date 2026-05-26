// Core entity types for the Vision Configuration System

export type UserRole = 'user' | 'admin';

export type ModuleType = 'positioning' | 'defect' | 'ocr' | 'deeplearning' | 'measurement';

export type WorkstationType = 'line' | 'turntable' | 'robot' | 'platform';

export type CameraMount = 'top' | 'side' | 'angled';

export type TriggerType = 'io' | 'encoder' | 'software' | 'continuous';

export type ViewType = 'front' | 'side' | 'top';

export type OutputType = 'okng' | 'coordinate' | 'defect_class' | 'text' | 'confidence';

// Environment conditions
export type EnvironmentCondition = 'high_reflection' | 'dust' | 'vibration' | 'low_light' | 'strong_ambient';

// Quality strategy
export type QualityStrategy = 'no_miss' | 'balanced' | 'allow_pass';

// Execution mechanisms
export type Mechanism = 'stop' | 'cylinder' | 'gripper' | 'clamp' | 'flip' | 'lift' | 'indexing' | 'robot_pick';

// Status types
export type EntityStatus = 'draft' | 'incomplete' | 'complete';

// Hardware types
export interface Camera {
  id: string;
  brand: string;
  model: string;
  resolution: string;
  frameRate: number;
  interface: string;
  sensorSize: string;
  shutterType?: string;
  tags: string[];
  imageUrl?: string;
  enabled: boolean;
}

export interface Lens {
  id: string;
  brand: string;
  model: string;
  focalLength: string;
  aperture: string;
  mount: string;
  compatibleCameras: string[];
  tags: string[];
  imageUrl?: string;
  enabled: boolean;
  resolvingPower?: number;
  maxSensorSize?: string;
}

export interface LightSource {
  id: string;
  brand: string;
  model: string;
  type: string;
  color: string;
  power: string;
  tags: string[];
  recommendedCameras: string[];
  imageUrl?: string;
  enabled: boolean;
}

export interface Controller {
  id: string;
  brand: string;
  model: string;
  cpu: string;
  gpu?: string;
  memory: string;
  storage: string;
  performance: 'entry' | 'standard' | 'high' | 'ultra';
  tags: string[];
  imageUrl?: string;
  enabled: boolean;
}

export interface PPTTemplate {
  id: string;
  name: string;
  description: string;
  scope: string;
  isDefault: boolean;
  createdAt: string;
}

// Project entity
export interface Project {
  id: string;
  code: string;
  name: string;
  customer: string;
  productProcess: string;
  date: string;
  responsible: string;
  templateId?: string;
  cycleTimeTarget?: number;
  environment?: EnvironmentCondition[];
  qualityStrategy?: QualityStrategy;
  specVersion?: string;
  notes?: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

// Workstation entity
export interface Workstation {
  id: string;
  projectId: string;
  code: string;
  name: string;
  type: WorkstationType;
  cycleTime: number;
  productDimensions: { length: number; width: number; height: number };
  installSpace?: { length: number; width: number; height: number };
  inOutDirection?: string;
  enclosed?: boolean;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

// Mechanical layout for workstation
export interface MechanicalLayout {
  id: string;
  workstationId: string;
  conveyorType: string;
  cameraCount: number;
  cameraMounts: CameraMount[];
  mechanisms: Mechanism[];
  motionRange?: { length: number; width: number; height: number };
  machineOutline?: { length: number; width: number; height: number };
  frontViewSaved: boolean;
  sideViewSaved: boolean;
  topViewSaved: boolean;
  status: EntityStatus;
}

// ROI definition for module
export interface ROIRect {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

// Function module entity
export interface FunctionModule {
  id: string;
  workstationId: string;
  name: string;
  type: ModuleType;
  cameraId?: string;
  triggerType: TriggerType;
  outputTypes: OutputType[];
  roiStrategy?: 'full' | 'custom';
  roiRect?: ROIRect; // Custom ROI coordinates
  processingTimeLimit?: number;
  misjudgmentStrategy?: QualityStrategy;
  
  // Type-specific fields
  positioningConfig?: PositioningConfig;
  defectConfig?: DefectConfig;
  ocrConfig?: OCRConfig;
  deepLearningConfig?: DeepLearningConfig;
  
  // Hardware selection
  selectedCamera?: string;
  selectedLens?: string;
  selectedLight?: string;
  selectedController?: string;
  
  flowchartSaved: boolean;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PositioningConfig {
  targetType: 'hole' | 'edge' | 'corner' | 'qrcode' | 'feature';
  outputCoordinate: 'pixel' | 'mechanical' | 'robot';
  accuracyRequirement: number;
}

export interface DefectConfig {
  defectClasses: string[];
  defectItems?: Array<{ name: string; minSize?: number | null }>;
  minDefectSize?: number | null;
  missTolerance: 'none' | 'low' | 'acceptable';
  inspectionSurfaces: ('top' | 'side' | 'bottom' | 'hole' | 'edge')[];
  judgmentRule?: 'any' | 'area_threshold' | 'count_threshold' | 'grade';
  materialProperties?: ('high_reflection' | 'low_contrast' | 'complex_texture' | 'oily')[];
}

export interface OCRConfig {
  charType: 'inkjet' | 'laser' | 'silkscreen' | 'label' | 'qrcode' | 'barcode';
  charset: 'numeric' | 'alpha' | 'mixed' | 'custom';
  minCharHeight: number;
  contentRule?: string;
}

export interface DeepLearningConfig {
  taskType: 'classification' | 'detection' | 'segmentation' | 'anomaly';
  deployTarget: 'cpu' | 'gpu' | 'edge';
  inferenceTimeTarget: number;
  updateStrategy: 'fixed' | 'periodic' | 'batch';
  dataSource?: string;
  sampleSize?: number;
  annotationType?: string;
  metrics?: string[];
}

// Application state
export interface AppState {
  currentRole: UserRole;
  selectedProjectId: string | null;
  selectedWorkstationId: string | null;
  selectedModuleId: string | null;
  currentView: ViewType;
  isGeneratingPPT: boolean;
  pptProgress: number;
}

// Store interfaces
export interface HardwareStore {
  cameras: Camera[];
  lenses: Lens[];
  lights: LightSource[];
  controllers: Controller[];
}

export interface TemplateStore {
  templates: PPTTemplate[];
}

export interface ProjectStore {
  projects: Project[];
  workstations: Workstation[];
  layouts: MechanicalLayout[];
  modules: FunctionModule[];
}
