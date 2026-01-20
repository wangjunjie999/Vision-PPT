/**
 * 统一报告数据构建器
 * 为 PDF / Word / PPT 三种输出提供一致的数据结构
 * 
 * 核心功能：
 * 1. 全字段覆盖：确保所有非空字段都能被输出
 * 2. 枚举值转换：将枚举值转换为中英文 label
 * 3. 硬件信息补全：将 ID 转换为完整的硬件信息
 * 4. extra_fields 兜底：将未显式展示的字段收集到附录
 */

import type { Database } from '@/integrations/supabase/types';
import {
  MODULE_TYPE_LABELS,
  WS_TYPE_LABELS,
  TRIGGER_LABELS,
  ROI_LABELS,
  CONVEYOR_LABELS,
  CAMERA_MOUNT_LABELS,
  MECHANISM_LABELS,
  PROCESS_STAGE_LABELS,
  ENVIRONMENT_LABELS,
  OUTPUT_ACTION_LABELS,
  getLabel,
  getArrayLabels,
  formatBoolean,
  formatDimensions,
  safeStringify,
  FIELD_DISPLAY_NAMES,
} from './labelMaps';

// ==================== TYPE DEFINITIONS ====================

type DbProject = Database['public']['Tables']['projects']['Row'];
type DbWorkstation = Database['public']['Tables']['workstations']['Row'];
type DbLayout = Database['public']['Tables']['mechanical_layouts']['Row'];
type DbModule = Database['public']['Tables']['function_modules']['Row'];

// 硬件库类型
export interface HardwareLibrary {
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

// 产品资产和标注
export interface ProductAssetInput {
  id: string;
  workstation_id: string | null;
  module_id: string | null;
  scope_type: 'workstation' | 'module';
  model_file_url: string | null;
  preview_images: Array<{ url: string; name?: string }> | null;
  detection_method?: string | null;
  product_models?: Array<{ name: string; spec: string }> | null;
  detection_requirements?: Array<{ content: string; highlight?: string | null }> | null;
}

export interface AnnotationInput {
  id: string;
  asset_id: string;
  snapshot_url: string;
  remark: string | null;
  annotations_json: unknown;
  scope_type?: 'workstation' | 'module';
  workstation_id?: string | null;
  module_id?: string | null;
}

// 构建输入
export interface BuilderInput {
  project: DbProject;
  workstations: DbWorkstation[];
  layouts: DbLayout[];
  modules: DbModule[];
  hardware: HardwareLibrary;
  productAssets?: ProductAssetInput[];
  annotations?: AnnotationInput[];
  language?: 'zh' | 'en';
}

// ==================== OUTPUT TYPES ====================

export interface ReportProjectData {
  id: string;
  code: string;
  name: string;
  customer: string;
  date: string | null;
  responsible: string | null;
  sales_responsible: string | null;
  vision_responsible: string | null;
  product_process: string | null;
  quality_strategy: string | null;
  environment: string[] | null;
  environment_labels: string;
  notes: string | null;
  description: string | null;
  status: string | null;
  spec_version: string | null;
  production_line: string | null;
  main_camera_brand: string | null;
  use_ai: boolean | null;
  use_ai_label: string;
  use_3d: boolean | null;
  use_3d_label: string;
  cycle_time_target: number | null;
  revision_history: Array<{
    version: string;
    date: string;
    author: string;
    content: string;
  }> | null;
  template_id: string | null;
  extra_fields: Record<string, { key: string; label: string; value: string }>;
}

export interface ReportWorkstationData {
  id: string;
  code: string;
  name: string;
  type: string;
  type_label: string;
  cycle_time: number | null;
  product_dimensions: { length: number; width: number; height: number } | null;
  product_dimensions_label: string;
  enclosed: boolean | null;
  enclosed_label: string;
  process_stage: string | null;
  process_stage_label: string;
  observation_target: string | null;
  motion_description: string | null;
  risk_notes: string | null;
  shot_count: number | null;
  acceptance_criteria: {
    accuracy?: string;
    cycle_time?: string;
    compatible_sizes?: string;
  } | null;
  action_script: string | null;
  description: string | null;
  install_space: { length: number; width: number; height: number } | null;
  install_space_label: string;
  extra_fields: Record<string, { key: string; label: string; value: string }>;
}

export interface ReportHardwareItem {
  id: string;
  brand: string;
  model: string;
  display_name: string;
  image_url: string | null;
  specs: Record<string, string>;
}

export interface ReportLayoutData {
  workstation_id: string;
  name: string | null;
  conveyor_type: string | null;
  conveyor_type_label: string;
  camera_count: number | null;
  lens_count: number | null;
  light_count: number | null;
  camera_mounts: string[] | null;
  camera_mounts_labels: string;
  mechanisms: string[] | null;
  mechanisms_labels: string;
  width: number | null;
  height: number | null;
  depth: number | null;
  dimensions_label: string;
  selected_cameras: ReportHardwareItem[] | null;
  selected_lenses: ReportHardwareItem[] | null;
  selected_lights: ReportHardwareItem[] | null;
  selected_controller: ReportHardwareItem | null;
  front_view_image_url: string | null;
  side_view_image_url: string | null;
  top_view_image_url: string | null;
  front_view_saved: boolean | null;
  side_view_saved: boolean | null;
  top_view_saved: boolean | null;
  extra_fields: Record<string, { key: string; label: string; value: string }>;
}

export interface ReportModuleData {
  id: string;
  name: string;
  type: string;
  type_label: string;
  description: string | null;
  workstation_id: string;
  trigger_type: string | null;
  trigger_type_label: string;
  roi_strategy: string | null;
  roi_strategy_label: string;
  processing_time_limit: number | null;
  output_types: string[] | null;
  output_types_labels: string;
  selected_camera: string | null;
  selected_camera_info: ReportHardwareItem | null;
  selected_lens: string | null;
  selected_lens_info: ReportHardwareItem | null;
  selected_light: string | null;
  selected_light_info: ReportHardwareItem | null;
  selected_controller: string | null;
  selected_controller_info: ReportHardwareItem | null;
  schematic_image_url: string | null;
  rotation: number | null;
  x: number | null;
  y: number | null;
  status: string | null;
  positioning_config: Record<string, unknown> | null;
  defect_config: Record<string, unknown> | null;
  ocr_config: Record<string, unknown> | null;
  measurement_config: Record<string, unknown> | null;
  deep_learning_config: Record<string, unknown> | null;
  extra_fields: Record<string, { key: string; label: string; value: string }>;
}

export interface ReportProductAssetData {
  id: string;
  workstation_id: string | null;
  module_id: string | null;
  scope_type: 'workstation' | 'module';
  preview_images: Array<{ url: string; name?: string }> | null;
  model_file_url: string | null;
  detection_method: string | null;
  product_models: Array<{ name: string; spec: string }> | null;
  detection_requirements: Array<{ content: string; highlight?: string | null }> | null;
}

export interface ReportAnnotationData {
  id: string;
  asset_id: string;
  snapshot_url: string;
  remark: string | null;
  annotations_json: unknown;
  scope_type: 'workstation' | 'module';
  workstation_id: string | null;
  module_id: string | null;
}

export interface ReportData {
  project: ReportProjectData;
  workstations: ReportWorkstationData[];
  layouts: ReportLayoutData[];
  modules: ReportModuleData[];
  hardware: HardwareLibrary;
  productAssets: ReportProductAssetData[];
  annotations: ReportAnnotationData[];
  language: 'zh' | 'en';
  stats: {
    workstationCount: number;
    moduleCount: number;
    cameraCount: number;
    lensCount: number;
    lightCount: number;
    controllerCount: number;
  };
}

// ==================== HELPER FUNCTIONS ====================

// 系统字段（不应该出现在 extra_fields 中）
const SYSTEM_FIELDS = new Set([
  'id', 'user_id', 'created_at', 'updated_at', 
  'project_id', 'workstation_id', 'module_id', 'asset_id',
]);

// 已在主输出中显式展示的字段（按实体类型）
const PROJECT_DISPLAYED_FIELDS = new Set([
  'id', 'code', 'name', 'customer', 'date', 'responsible',
  'sales_responsible', 'vision_responsible', 'product_process',
  'quality_strategy', 'environment', 'notes', 'description', 'status',
  'spec_version', 'production_line', 'main_camera_brand',
  'use_ai', 'use_3d', 'cycle_time_target', 'revision_history', 'template_id',
]);

const WORKSTATION_DISPLAYED_FIELDS = new Set([
  'id', 'code', 'name', 'type', 'cycle_time', 'product_dimensions',
  'enclosed', 'process_stage', 'observation_target', 'motion_description',
  'risk_notes', 'shot_count', 'acceptance_criteria', 'action_script',
  'description', 'install_space', 'status',
]);

const LAYOUT_DISPLAYED_FIELDS = new Set([
  'id', 'workstation_id', 'name', 'conveyor_type', 'camera_count',
  'lens_count', 'light_count', 'camera_mounts', 'mechanisms',
  'width', 'height', 'depth', 'selected_cameras', 'selected_lenses',
  'selected_lights', 'selected_controller', 'front_view_image_url',
  'side_view_image_url', 'top_view_image_url', 'front_view_saved',
  'side_view_saved', 'top_view_saved', 'description', 'layout_type',
  'grid_enabled', 'snap_enabled', 'show_distances', 'machine_outline', 'layout_objects',
]);

const MODULE_DISPLAYED_FIELDS = new Set([
  'id', 'name', 'type', 'description', 'workstation_id', 'trigger_type',
  'roi_strategy', 'processing_time_limit', 'output_types',
  'selected_camera', 'selected_lens', 'selected_light', 'selected_controller',
  'schematic_image_url', 'positioning_config', 'defect_config',
  'ocr_config', 'measurement_config', 'deep_learning_config',
  'rotation', 'x', 'y', 'status', 'camera_id', 'lens_id', 'light_id', 'controller_id',
]);

/**
 * 收集未显式展示的额外字段
 */
function collectExtraFields(
  row: Record<string, unknown>,
  displayedFields: Set<string>,
  lang: 'zh' | 'en'
): Record<string, { key: string; label: string; value: string }> {
  const extra: Record<string, { key: string; label: string; value: string }> = {};
  
  for (const [key, value] of Object.entries(row)) {
    // 跳过系统字段和已显示字段
    if (SYSTEM_FIELDS.has(key) || displayedFields.has(key)) continue;
    
    // 跳过空值
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && Object.keys(value as object).length === 0) continue;
    
    // 获取字段显示名称
    const displayName = FIELD_DISPLAY_NAMES[key];
    const label = displayName ? displayName[lang] : key;
    
    // 转换值为字符串
    const stringValue = safeStringify(value, undefined, lang);
    if (stringValue && stringValue !== '{}' && stringValue !== '[]') {
      extra[key] = { key, label, value: stringValue };
    }
  }
  
  return extra;
}

/**
 * 从硬件库查找并构建硬件信息
 */
function buildCameraInfo(id: string | null, hardware: HardwareLibrary): ReportHardwareItem | null {
  if (!id) return null;
  const cam = hardware.cameras.find(c => c.id === id);
  if (!cam) return null;
  return {
    id: cam.id,
    brand: cam.brand,
    model: cam.model,
    display_name: `${cam.brand} ${cam.model} | ${cam.resolution} @ ${cam.frame_rate}fps | ${cam.interface}`,
    image_url: cam.image_url,
    specs: {
      resolution: cam.resolution,
      frame_rate: `${cam.frame_rate}fps`,
      interface: cam.interface,
      sensor_size: cam.sensor_size,
    },
  };
}

function buildLensInfo(id: string | null, hardware: HardwareLibrary): ReportHardwareItem | null {
  if (!id) return null;
  const lens = hardware.lenses.find(l => l.id === id);
  if (!lens) return null;
  return {
    id: lens.id,
    brand: lens.brand,
    model: lens.model,
    display_name: `${lens.brand} ${lens.model} | ${lens.focal_length} ${lens.aperture} | ${lens.mount}`,
    image_url: lens.image_url,
    specs: {
      focal_length: lens.focal_length,
      aperture: lens.aperture,
      mount: lens.mount,
    },
  };
}

function buildLightInfo(id: string | null, hardware: HardwareLibrary): ReportHardwareItem | null {
  if (!id) return null;
  const light = hardware.lights.find(l => l.id === id);
  if (!light) return null;
  return {
    id: light.id,
    brand: light.brand,
    model: light.model,
    display_name: `${light.brand} ${light.model} | ${light.type} ${light.color} | ${light.power}`,
    image_url: light.image_url,
    specs: {
      type: light.type,
      color: light.color,
      power: light.power,
    },
  };
}

function buildControllerInfo(id: string | null, hardware: HardwareLibrary): ReportHardwareItem | null {
  if (!id) return null;
  const ctrl = hardware.controllers.find(c => c.id === id);
  if (!ctrl) return null;
  return {
    id: ctrl.id,
    brand: ctrl.brand,
    model: ctrl.model,
    display_name: `${ctrl.brand} ${ctrl.model} | ${ctrl.cpu} | ${ctrl.memory}`,
    image_url: ctrl.image_url,
    specs: {
      cpu: ctrl.cpu,
      gpu: ctrl.gpu || '',
      memory: ctrl.memory,
      storage: ctrl.storage,
      performance: ctrl.performance,
    },
  };
}

/**
 * 将布局中的硬件选择转换为完整硬件信息
 */
function enrichLayoutHardware(
  selected: Array<{ id: string; brand?: string; model?: string; image_url?: string | null }> | null | undefined,
  hardware: HardwareLibrary,
  type: 'camera' | 'lens' | 'light'
): ReportHardwareItem[] | null {
  if (!selected || selected.length === 0) return null;
  
  const result: ReportHardwareItem[] = [];
  
  for (const item of selected) {
    let fullInfo: ReportHardwareItem | null = null;
    
    if (type === 'camera') {
      fullInfo = buildCameraInfo(item.id, hardware);
    } else if (type === 'lens') {
      fullInfo = buildLensInfo(item.id, hardware);
    } else if (type === 'light') {
      fullInfo = buildLightInfo(item.id, hardware);
    }
    
    if (fullInfo) {
      result.push(fullInfo);
    } else if (item.brand && item.model) {
      // 如果硬件库中找不到，但有 brand/model，使用这些信息
      result.push({
        id: item.id,
        brand: item.brand,
        model: item.model,
        display_name: `${item.brand} ${item.model}`,
        image_url: item.image_url || null,
        specs: {},
      });
    }
  }
  
  return result.length > 0 ? result : null;
}

function enrichLayoutController(
  selected: { id: string; brand?: string; model?: string; image_url?: string | null } | null | undefined,
  hardware: HardwareLibrary
): ReportHardwareItem | null {
  if (!selected) return null;
  
  const fullInfo = buildControllerInfo(selected.id, hardware);
  if (fullInfo) return fullInfo;
  
  if (selected.brand && selected.model) {
    return {
      id: selected.id,
      brand: selected.brand,
      model: selected.model,
      display_name: `${selected.brand} ${selected.model}`,
      image_url: selected.image_url || null,
      specs: {},
    };
  }
  
  return null;
}

// ==================== MAIN BUILD FUNCTION ====================

/**
 * 构建报告数据
 * 这是所有文档生成的唯一数据来源
 */
export function buildReportData(input: BuilderInput): ReportData {
  const { project, workstations, layouts, modules, hardware, productAssets = [], annotations = [], language = 'zh' } = input;
  const lang = language;
  
  // 转换环境数组
  const environmentArray = Array.isArray(project.environment) 
    ? project.environment 
    : typeof project.environment === 'string' 
      ? [project.environment] 
      : null;
  
  // 构建项目数据
  const reportProject: ReportProjectData = {
    id: project.id,
    code: project.code || '',
    name: project.name,
    customer: project.customer || '',
    date: project.date,
    responsible: project.responsible,
    sales_responsible: project.sales_responsible,
    vision_responsible: project.vision_responsible,
    product_process: project.product_process,
    quality_strategy: project.quality_strategy,
    environment: environmentArray,
    environment_labels: getArrayLabels(environmentArray, ENVIRONMENT_LABELS, lang),
    notes: project.notes,
    description: project.description,
    status: project.status,
    spec_version: project.spec_version,
    production_line: project.production_line,
    main_camera_brand: project.main_camera_brand,
    use_ai: project.use_ai,
    use_ai_label: formatBoolean(project.use_ai, lang),
    use_3d: project.use_3d,
    use_3d_label: formatBoolean(project.use_3d, lang),
    cycle_time_target: project.cycle_time_target,
    revision_history: project.revision_history as ReportProjectData['revision_history'],
    template_id: project.template_id,
    extra_fields: collectExtraFields(project as unknown as Record<string, unknown>, PROJECT_DISPLAYED_FIELDS, lang),
  };
  
  // 构建工位数据
  const reportWorkstations: ReportWorkstationData[] = workstations.map(ws => {
    const productDims = ws.product_dimensions as { length: number; width: number; height: number } | null;
    const installSpace = ws.install_space as { length: number; width: number; height: number } | null;
    const acceptanceCriteria = ws.acceptance_criteria as ReportWorkstationData['acceptance_criteria'];
    
    return {
      id: ws.id,
      code: ws.code || '',
      name: ws.name,
      type: ws.type || '',
      type_label: getLabel(ws.type, WS_TYPE_LABELS, lang),
      cycle_time: ws.cycle_time,
      product_dimensions: productDims,
      product_dimensions_label: formatDimensions(productDims),
      enclosed: ws.enclosed,
      enclosed_label: formatBoolean(ws.enclosed, lang),
      process_stage: ws.process_stage,
      process_stage_label: getLabel(ws.process_stage, PROCESS_STAGE_LABELS, lang),
      observation_target: ws.observation_target,
      motion_description: ws.motion_description,
      risk_notes: ws.risk_notes,
      shot_count: ws.shot_count,
      acceptance_criteria: acceptanceCriteria,
      action_script: ws.action_script,
      description: ws.description,
      install_space: installSpace,
      install_space_label: formatDimensions(installSpace),
      extra_fields: collectExtraFields(ws as unknown as Record<string, unknown>, WORKSTATION_DISPLAYED_FIELDS, lang),
    };
  });
  
  // 构建布局数据
  const reportLayouts: ReportLayoutData[] = layouts.map(layout => {
    // 解析 camera_mounts 和 mechanisms
    const cameraMounts = Array.isArray(layout.camera_mounts) 
      ? (layout.camera_mounts as string[])
      : typeof layout.camera_mounts === 'object' && layout.camera_mounts
        ? Object.keys(layout.camera_mounts as object)
        : null;
    
    const mechanisms = Array.isArray(layout.mechanisms)
      ? (layout.mechanisms as string[]).map(m => {
          if (typeof m === 'string') return m;
          if (typeof m === 'object' && m !== null) {
            return (m as { type?: string; name?: string }).type || (m as { name?: string }).name || '';
          }
          return '';
        }).filter(Boolean)
      : null;
    
    const selectedCameras = layout.selected_cameras as Array<{ id: string; brand?: string; model?: string; image_url?: string | null }> | null;
    const selectedLenses = layout.selected_lenses as Array<{ id: string; brand?: string; model?: string; image_url?: string | null }> | null;
    const selectedLights = layout.selected_lights as Array<{ id: string; brand?: string; model?: string; image_url?: string | null }> | null;
    const selectedController = layout.selected_controller as { id: string; brand?: string; model?: string; image_url?: string | null } | null;
    
    return {
      workstation_id: layout.workstation_id,
      name: layout.name,
      conveyor_type: layout.conveyor_type,
      conveyor_type_label: getLabel(layout.conveyor_type, CONVEYOR_LABELS, lang),
      camera_count: layout.camera_count,
      lens_count: (layout as any).lens_count ?? layout.camera_count ?? 1,
      light_count: (layout as any).light_count ?? 1,
      camera_mounts: cameraMounts,
      camera_mounts_labels: getArrayLabels(cameraMounts, CAMERA_MOUNT_LABELS, lang),
      mechanisms: mechanisms,
      mechanisms_labels: getArrayLabels(mechanisms, MECHANISM_LABELS, lang),
      width: layout.width,
      height: layout.height,
      depth: layout.depth,
      dimensions_label: formatDimensions({ length: layout.width ?? 0, width: layout.depth ?? 0, height: layout.height ?? 0 }),
      selected_cameras: enrichLayoutHardware(selectedCameras, hardware, 'camera'),
      selected_lenses: enrichLayoutHardware(selectedLenses, hardware, 'lens'),
      selected_lights: enrichLayoutHardware(selectedLights, hardware, 'light'),
      selected_controller: enrichLayoutController(selectedController, hardware),
      front_view_image_url: layout.front_view_image_url,
      side_view_image_url: layout.side_view_image_url,
      top_view_image_url: layout.top_view_image_url,
      front_view_saved: layout.front_view_saved,
      side_view_saved: layout.side_view_saved,
      top_view_saved: layout.top_view_saved,
      extra_fields: collectExtraFields(layout as unknown as Record<string, unknown>, LAYOUT_DISPLAYED_FIELDS, lang),
    };
  });
  
  // 构建模块数据
  const reportModules: ReportModuleData[] = modules.map(mod => {
    const outputTypes = mod.output_types as string[] | null;
    
    return {
      id: mod.id,
      name: mod.name,
      type: mod.type || '',
      type_label: getLabel(mod.type, MODULE_TYPE_LABELS, lang),
      description: mod.description,
      workstation_id: mod.workstation_id,
      trigger_type: mod.trigger_type,
      trigger_type_label: getLabel(mod.trigger_type, TRIGGER_LABELS, lang),
      roi_strategy: mod.roi_strategy,
      roi_strategy_label: getLabel(mod.roi_strategy, ROI_LABELS, lang),
      processing_time_limit: mod.processing_time_limit,
      output_types: outputTypes,
      output_types_labels: getArrayLabels(outputTypes, OUTPUT_ACTION_LABELS, lang),
      selected_camera: mod.selected_camera,
      selected_camera_info: buildCameraInfo(mod.selected_camera, hardware),
      selected_lens: mod.selected_lens,
      selected_lens_info: buildLensInfo(mod.selected_lens, hardware),
      selected_light: mod.selected_light,
      selected_light_info: buildLightInfo(mod.selected_light, hardware),
      selected_controller: mod.selected_controller,
      selected_controller_info: buildControllerInfo(mod.selected_controller, hardware),
      schematic_image_url: mod.schematic_image_url,
      rotation: mod.rotation,
      x: mod.x,
      y: mod.y,
      status: mod.status,
      positioning_config: mod.positioning_config as Record<string, unknown> | null,
      defect_config: mod.defect_config as Record<string, unknown> | null,
      ocr_config: mod.ocr_config as Record<string, unknown> | null,
      measurement_config: mod.measurement_config as Record<string, unknown> | null,
      deep_learning_config: mod.deep_learning_config as Record<string, unknown> | null,
      extra_fields: collectExtraFields(mod as unknown as Record<string, unknown>, MODULE_DISPLAYED_FIELDS, lang),
    };
  });
  
  // 转换产品资产
  const reportProductAssets: ReportProductAssetData[] = productAssets.map(asset => ({
    id: asset.id,
    workstation_id: asset.workstation_id,
    module_id: asset.module_id,
    scope_type: asset.scope_type,
    preview_images: asset.preview_images,
    model_file_url: asset.model_file_url,
    detection_method: asset.detection_method ?? null,
    product_models: asset.product_models ?? null,
    detection_requirements: asset.detection_requirements ?? null,
  }));
  
  // 转换标注
  const reportAnnotations: ReportAnnotationData[] = annotations.map(ann => ({
    id: ann.id,
    asset_id: ann.asset_id,
    snapshot_url: ann.snapshot_url,
    remark: ann.remark,
    annotations_json: ann.annotations_json,
    scope_type: ann.scope_type || 'workstation',
    workstation_id: ann.workstation_id ?? null,
    module_id: ann.module_id ?? null,
  }));
  
  // 统计信息
  const stats = {
    workstationCount: reportWorkstations.length,
    moduleCount: reportModules.length,
    cameraCount: hardware.cameras.length,
    lensCount: hardware.lenses.length,
    lightCount: hardware.lights.length,
    controllerCount: hardware.controllers.length,
  };
  
  return {
    project: reportProject,
    workstations: reportWorkstations,
    layouts: reportLayouts,
    modules: reportModules,
    hardware,
    productAssets: reportProductAssets,
    annotations: reportAnnotations,
    language: lang,
    stats,
  };
}
