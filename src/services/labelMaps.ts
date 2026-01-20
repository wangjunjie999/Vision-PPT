/**
 * 统一的枚举值 Label 映射
 * 用于 PDF / Word / PPT 三种输出的一致性显示
 */

export const MODULE_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  positioning: { zh: '定位检测', en: 'Positioning' },
  defect: { zh: '缺陷检测', en: 'Defect Detection' },
  ocr: { zh: 'OCR识别', en: 'OCR Recognition' },
  deeplearning: { zh: '深度学习', en: 'Deep Learning' },
  measurement: { zh: '尺寸测量', en: 'Measurement' },
};

export const WS_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  line: { zh: '线体', en: 'Line' },
  turntable: { zh: '转盘', en: 'Turntable' },
  robot: { zh: '机械手', en: 'Robot' },
  platform: { zh: '平台', en: 'Platform' },
  manual: { zh: '手动工位', en: 'Manual' },
  conveyor: { zh: '输送线', en: 'Conveyor' },
};

export const TRIGGER_LABELS: Record<string, { zh: string; en: string }> = {
  io: { zh: 'IO触发', en: 'IO Trigger' },
  encoder: { zh: '编码器', en: 'Encoder' },
  software: { zh: '软触发', en: 'Software' },
  continuous: { zh: '连续采集', en: 'Continuous' },
  sensor: { zh: '传感器触发', en: 'Sensor Trigger' },
  plc: { zh: 'PLC触发', en: 'PLC Trigger' },
};

export const ROI_LABELS: Record<string, { zh: string; en: string }> = {
  full: { zh: '全画面', en: 'Full Frame' },
  fixed: { zh: '固定区域', en: 'Fixed Region' },
  dynamic: { zh: '动态区域', en: 'Dynamic Region' },
  multiple: { zh: '多区域', en: 'Multiple Regions' },
};

export const CONVEYOR_LABELS: Record<string, { zh: string; en: string }> = {
  belt: { zh: '皮带输送', en: 'Belt Conveyor' },
  roller: { zh: '滚筒输送', en: 'Roller Conveyor' },
  chain: { zh: '链条输送', en: 'Chain Conveyor' },
  none: { zh: '无', en: 'None' },
  static: { zh: '静态', en: 'Static' },
};

export const CAMERA_MOUNT_LABELS: Record<string, { zh: string; en: string }> = {
  top: { zh: '顶部安装', en: 'Top Mount' },
  side: { zh: '侧面安装', en: 'Side Mount' },
  bottom: { zh: '底部安装', en: 'Bottom Mount' },
  front: { zh: '正面安装', en: 'Front Mount' },
  back: { zh: '背面安装', en: 'Back Mount' },
  angle: { zh: '斜角安装', en: 'Angle Mount' },
  '45deg': { zh: '45°安装', en: '45° Mount' },
  overhead: { zh: '顶置安装', en: 'Overhead' },
};

export const MECHANISM_LABELS: Record<string, { zh: string; en: string }> = {
  conveyor: { zh: '输送带', en: 'Conveyor' },
  turntable: { zh: '转盘', en: 'Turntable' },
  lift: { zh: '升降台', en: 'Lift' },
  stop: { zh: '阻挡器', en: 'Stop' },
  gripper: { zh: '夹爪', en: 'Gripper' },
  cylinder: { zh: '气缸', en: 'Cylinder' },
  robot_arm: { zh: '机械手臂', en: 'Robot Arm' },
  camera_mount: { zh: '相机支架', en: 'Camera Mount' },
};

export const PROCESS_STAGE_LABELS: Record<string, { zh: string; en: string }> = {
  incoming: { zh: '来料', en: 'Incoming' },
  in_process: { zh: '过程', en: 'In-Process' },
  outgoing: { zh: '出货', en: 'Outgoing' },
  final: { zh: '终检', en: 'Final' },
  sorting: { zh: '分选', en: 'Sorting' },
  assembly: { zh: '装配', en: 'Assembly' },
  packaging: { zh: '包装', en: 'Packaging' },
};

export const ENVIRONMENT_LABELS: Record<string, { zh: string; en: string }> = {
  cleanroom: { zh: '洁净室', en: 'Cleanroom' },
  dusty: { zh: '多尘', en: 'Dusty' },
  humid: { zh: '潮湿', en: 'Humid' },
  oily: { zh: '油污', en: 'Oily' },
  high_temp: { zh: '高温', en: 'High Temperature' },
  low_temp: { zh: '低温', en: 'Low Temperature' },
  vibration: { zh: '振动', en: 'Vibration' },
  outdoor: { zh: '室外', en: 'Outdoor' },
  normal: { zh: '普通', en: 'Normal' },
};

export const JUDGMENT_STRATEGY_LABELS: Record<string, { zh: string; en: string }> = {
  strict: { zh: '严格', en: 'Strict' },
  balanced: { zh: '平衡', en: 'Balanced' },
  tolerant: { zh: '宽松', en: 'Tolerant' },
};

export const OUTPUT_ACTION_LABELS: Record<string, { zh: string; en: string }> = {
  alarm: { zh: '报警', en: 'Alarm' },
  reject: { zh: '剔除', en: 'Reject' },
  mark: { zh: '标记', en: 'Mark' },
  saveImage: { zh: '存图', en: 'Save Image' },
  saveData: { zh: '存数据', en: 'Save Data' },
  stopLine: { zh: '停线', en: 'Stop Line' },
  pass: { zh: '放行', en: 'Pass' },
};

export const COMMUNICATION_METHOD_LABELS: Record<string, { zh: string; en: string }> = {
  plc: { zh: 'PLC', en: 'PLC' },
  tcp: { zh: 'TCP/IP', en: 'TCP/IP' },
  serial: { zh: '串口', en: 'Serial' },
  modbus: { zh: 'Modbus', en: 'Modbus' },
  mqtt: { zh: 'MQTT', en: 'MQTT' },
  profinet: { zh: 'PROFINET', en: 'PROFINET' },
  ethercat: { zh: 'EtherCAT', en: 'EtherCAT' },
};

export const CHAR_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  laser: { zh: '激光打码', en: 'Laser Marking' },
  inkjet: { zh: '喷墨打印', en: 'Inkjet' },
  label: { zh: '标签', en: 'Label' },
  emboss: { zh: '压印', en: 'Emboss' },
  etch: { zh: '蚀刻', en: 'Etch' },
  printed: { zh: '印刷字符', en: 'Printed' },
  engraved: { zh: '雕刻字符', en: 'Engraved' },
  dotMatrix: { zh: '点阵字符', en: 'Dot Matrix' },
  handwritten: { zh: '手写字符', en: 'Handwritten' },
};

export const DL_TASK_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  classification: { zh: '分类', en: 'Classification' },
  detection: { zh: '检测', en: 'Detection' },
  segmentation: { zh: '分割', en: 'Segmentation' },
  anomaly: { zh: '异常检测', en: 'Anomaly Detection' },
  ocr: { zh: 'OCR识别', en: 'OCR' },
};

export const MEAS_DIM_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  length: { zh: '长度', en: 'Length' },
  width: { zh: '宽度', en: 'Width' },
  height: { zh: '高度', en: 'Height' },
  diameter: { zh: '直径', en: 'Diameter' },
  radius: { zh: '半径', en: 'Radius' },
  angle: { zh: '角度', en: 'Angle' },
  gap: { zh: '间隙', en: 'Gap' },
  flatness: { zh: '平面度', en: 'Flatness' },
  distance: { zh: '距离', en: 'Distance' },
};

export const GUIDING_MODE_LABELS: Record<string, { zh: string; en: string }> = {
  '2d': { zh: '2D定位', en: '2D' },
  '2.5d': { zh: '2.5D定位', en: '2.5D' },
  '3d': { zh: '3D定位', en: '3D' },
};

export const GUIDING_MECHANISM_LABELS: Record<string, { zh: string; en: string }> = {
  robot: { zh: '机器人', en: 'Robot' },
  gantry: { zh: '龙门架', en: 'Gantry' },
  scara: { zh: 'SCARA', en: 'SCARA' },
  delta: { zh: 'Delta', en: 'Delta' },
};

export const DEFECT_CONTRAST_LABELS: Record<string, { zh: string; en: string }> = {
  high: { zh: '高对比', en: 'High' },
  medium: { zh: '中对比', en: 'Medium' },
  low: { zh: '低对比', en: 'Low' },
};

export const MATERIAL_REFLECTION_LABELS: Record<string, { zh: string; en: string }> = {
  matte: { zh: '哑光', en: 'Matte' },
  semi: { zh: '半光泽', en: 'Semi-gloss' },
  glossy: { zh: '高光', en: 'Glossy' },
  mirror: { zh: '镜面', en: 'Mirror' },
};

export const MISS_TOLERANCE_LABELS: Record<string, { zh: string; en: string }> = {
  zero: { zh: '零容忍', en: 'Zero Tolerance' },
  low: { zh: '低容忍', en: 'Low' },
  medium: { zh: '中容忍', en: 'Medium' },
  high: { zh: '高容忍', en: 'High' },
};

export const CALIBRATION_METHOD_LABELS: Record<string, { zh: string; en: string }> = {
  plane: { zh: '平面标定', en: 'Plane' },
  multipoint: { zh: '多点标定', en: 'Multi-point' },
  ruler: { zh: '标尺标定', en: 'Ruler' },
};

export const CHAR_SET_LABELS: Record<string, { zh: string; en: string }> = {
  numeric: { zh: '纯数字', en: 'Numeric' },
  alpha: { zh: '纯字母', en: 'Alpha' },
  alphanumeric: { zh: '字母数字混合', en: 'Alphanumeric' },
  custom: { zh: '自定义', en: 'Custom' },
};

export const ALLOWED_DAMAGE_LABELS: Record<string, { zh: string; en: string }> = {
  none: { zh: '无损坏', en: 'None' },
  slight: { zh: '轻微', en: 'Slight' },
  moderate: { zh: '中等', en: 'Moderate' },
  severe: { zh: '严重', en: 'Severe' },
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * 获取标签值，如果找不到则返回原值
 */
export function getLabel(
  value: string | null | undefined,
  labelMap: Record<string, { zh: string; en: string }>,
  lang: 'zh' | 'en' = 'zh'
): string {
  if (!value) return '';
  const label = labelMap[value];
  return label ? label[lang] : value;
}

/**
 * 获取数组标签值
 */
export function getArrayLabels(
  values: string[] | null | undefined,
  labelMap: Record<string, { zh: string; en: string }>,
  lang: 'zh' | 'en' = 'zh',
  separator: string = '、'
): string {
  if (!values || values.length === 0) return '';
  return values.map(v => getLabel(v, labelMap, lang)).filter(Boolean).join(separator);
}

/**
 * 格式化布尔值
 */
export function formatBoolean(value: boolean | null | undefined, lang: 'zh' | 'en' = 'zh'): string {
  if (value === null || value === undefined) return '';
  return value ? (lang === 'zh' ? '是' : 'Yes') : (lang === 'zh' ? '否' : 'No');
}

/**
 * 格式化数字带单位
 */
export function formatNumberWithUnit(
  value: number | null | undefined,
  unit: string,
  precision: number = 0
): string {
  if (value === null || value === undefined) return '';
  return `${precision > 0 ? value.toFixed(precision) : value}${unit}`;
}

/**
 * 格式化尺寸 (length x width x height)
 */
export function formatDimensions(
  dims: { length?: number; width?: number; height?: number } | null | undefined,
  unit: string = 'mm'
): string {
  if (!dims) return '';
  const { length, width, height } = dims;
  if (length !== undefined && width !== undefined && height !== undefined) {
    return `${length} × ${width} × ${height} ${unit}`;
  }
  if (length !== undefined && width !== undefined) {
    return `${length} × ${width} ${unit}`;
  }
  return '';
}

/**
 * 格式化日期
 */
export function formatDate(
  date: string | null | undefined,
  lang: 'zh' | 'en' = 'zh'
): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (lang === 'zh') {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return date;
  }
}

/**
 * 安全地将对象/数组转换为显示字符串
 * 避免 [object Object] 输出
 */
export function safeStringify(
  value: unknown,
  labelMap?: Record<string, { zh: string; en: string }>,
  lang: 'zh' | 'en' = 'zh'
): string {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'string') {
    return labelMap ? getLabel(value, labelMap, lang) : value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    return value
      .map(v => safeStringify(v, labelMap, lang))
      .filter(Boolean)
      .join('、');
  }
  
  if (typeof value === 'object') {
    // 如果有 name 或 label 属性，优先使用
    const obj = value as Record<string, unknown>;
    if (obj.name) return String(obj.name);
    if (obj.label) return String(obj.label);
    if (obj.brand && obj.model) return `${obj.brand} ${obj.model}`;
    
    // 尝试转换为键值对列表
    const entries = Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined);
    if (entries.length <= 3) {
      return entries.map(([k, v]) => `${k}: ${safeStringify(v)}`).join(', ');
    }
    
    // 防止 [object Object]
    return JSON.stringify(value);
  }
  
  return String(value);
}

// ==================== FIELD DISPLAY NAME MAPPING ====================

/**
 * 字段显示名称映射（用于附录/额外字段显示）
 */
export const FIELD_DISPLAY_NAMES: Record<string, { zh: string; en: string }> = {
  // 项目字段
  code: { zh: '项目编号', en: 'Project Code' },
  name: { zh: '名称', en: 'Name' },
  customer: { zh: '客户', en: 'Customer' },
  date: { zh: '日期', en: 'Date' },
  responsible: { zh: '负责人', en: 'Responsible' },
  sales_responsible: { zh: '销售负责人', en: 'Sales Responsible' },
  vision_responsible: { zh: '视觉负责人', en: 'Vision Responsible' },
  product_process: { zh: '产品工艺', en: 'Product Process' },
  quality_strategy: { zh: '质量策略', en: 'Quality Strategy' },
  environment: { zh: '工作环境', en: 'Environment' },
  notes: { zh: '备注', en: 'Notes' },
  description: { zh: '描述', en: 'Description' },
  status: { zh: '状态', en: 'Status' },
  spec_version: { zh: '规格版本', en: 'Spec Version' },
  production_line: { zh: '产线', en: 'Production Line' },
  main_camera_brand: { zh: '主相机品牌', en: 'Main Camera Brand' },
  use_ai: { zh: '使用AI', en: 'Use AI' },
  use_3d: { zh: '使用3D', en: 'Use 3D' },
  cycle_time_target: { zh: '目标节拍', en: 'Target Cycle Time' },
  revision_history: { zh: '修订历史', en: 'Revision History' },
  template_id: { zh: '模板ID', en: 'Template ID' },
  
  // 工位字段
  type: { zh: '类型', en: 'Type' },
  cycle_time: { zh: '节拍', en: 'Cycle Time' },
  product_dimensions: { zh: '产品尺寸', en: 'Product Dimensions' },
  enclosed: { zh: '封闭环境', en: 'Enclosed' },
  process_stage: { zh: '工艺阶段', en: 'Process Stage' },
  observation_target: { zh: '观测目标', en: 'Observation Target' },
  motion_description: { zh: '运动描述', en: 'Motion Description' },
  risk_notes: { zh: '风险备注', en: 'Risk Notes' },
  shot_count: { zh: '拍照数量', en: 'Shot Count' },
  acceptance_criteria: { zh: '验收标准', en: 'Acceptance Criteria' },
  action_script: { zh: '动作脚本', en: 'Action Script' },
  install_space: { zh: '安装空间', en: 'Install Space' },
  
  // 布局字段
  conveyor_type: { zh: '输送类型', en: 'Conveyor Type' },
  camera_count: { zh: '相机数量', en: 'Camera Count' },
  lens_count: { zh: '镜头数量', en: 'Lens Count' },
  light_count: { zh: '光源数量', en: 'Light Count' },
  camera_mounts: { zh: '相机安装位置', en: 'Camera Mounts' },
  mechanisms: { zh: '机构配置', en: 'Mechanisms' },
  selected_cameras: { zh: '选用相机(布局)', en: 'Selected Cameras (Layout)' },
  selected_lenses: { zh: '选用镜头(布局)', en: 'Selected Lenses (Layout)' },
  selected_lights: { zh: '选用光源(布局)', en: 'Selected Lights (Layout)' },
  selected_controller: { zh: '选用控制器', en: 'Selected Controller' },
  width: { zh: '宽度', en: 'Width' },
  height: { zh: '高度', en: 'Height' },
  depth: { zh: '深度', en: 'Depth' },
  layout_type: { zh: '布局类型', en: 'Layout Type' },
  grid_enabled: { zh: '网格启用', en: 'Grid Enabled' },
  snap_enabled: { zh: '吸附启用', en: 'Snap Enabled' },
  show_distances: { zh: '显示距离', en: 'Show Distances' },
  machine_outline: { zh: '机器轮廓', en: 'Machine Outline' },
  layout_objects: { zh: '布局对象', en: 'Layout Objects' },
  
  // 模块字段
  trigger_type: { zh: '触发方式', en: 'Trigger Type' },
  roi_strategy: { zh: 'ROI策略', en: 'ROI Strategy' },
  processing_time_limit: { zh: '处理时限', en: 'Processing Time Limit' },
  output_types: { zh: '输出类型', en: 'Output Types' },
  selected_camera: { zh: '选用相机(模块)', en: 'Selected Camera (Module)' },
  selected_lens: { zh: '选用镜头(模块)', en: 'Selected Lens (Module)' },
  selected_light: { zh: '选用光源(模块)', en: 'Selected Light (Module)' },
  schematic_image_url: { zh: '示意图', en: 'Schematic Image' },
  positioning_config: { zh: '定位配置', en: 'Positioning Config' },
  defect_config: { zh: '缺陷配置', en: 'Defect Config' },
  ocr_config: { zh: 'OCR配置', en: 'OCR Config' },
  measurement_config: { zh: '测量配置', en: 'Measurement Config' },
  deep_learning_config: { zh: '深度学习配置', en: 'Deep Learning Config' },
  rotation: { zh: '旋转角度', en: 'Rotation' },
  x: { zh: 'X坐标', en: 'X Position' },
  y: { zh: 'Y坐标', en: 'Y Position' },
};

/**
 * 获取字段显示名称
 */
export function getFieldDisplayName(fieldKey: string, lang: 'zh' | 'en' = 'zh'): string {
  const display = FIELD_DISPLAY_NAMES[fieldKey];
  return display ? display[lang] : fieldKey;
}
