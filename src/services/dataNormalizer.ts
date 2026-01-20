/**
 * 数据规范化服务
 * 在数据加载成功后、写入 store 之前统一调用，确保数据类型一致性
 * 避免因字段为空、类型不一致导致的渲染崩溃
 */

import type { Database } from '@/integrations/supabase/types';

type DbProject = Database['public']['Tables']['projects']['Row'];
type DbWorkstation = Database['public']['Tables']['workstations']['Row'];
type DbLayout = Database['public']['Tables']['mechanical_layouts']['Row'];
type DbModule = Database['public']['Tables']['function_modules']['Row'];

// ==================== UTILITY FUNCTIONS ====================

/**
 * 安全解析 JSON
 * 失败时返回 null 并记录警告
 */
export function safeParseJSON<T = unknown>(
  value: unknown,
  fieldName: string = 'unknown'
): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'object') {
    return value as T;
  }
  
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    try {
      return JSON.parse(value) as T;
    } catch (err) {
      console.warn(`[dataNormalizer] Failed to parse JSON for field "${fieldName}":`, value, err);
      return null;
    }
  }
  
  return null;
}

/**
 * 将各种输入转换为 string[]
 * 支持: string, string[], object[], null, undefined
 * 对于 object[]，提取 name/label/type 字段
 */
export function toStringArray(value: unknown, fieldName: string = 'unknown'): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  
  if (typeof value === 'string') {
    if (value.trim() === '') return [];
    // 尝试解析 JSON
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return toStringArray(parsed, fieldName);
      }
    } catch {
      // 不是 JSON，作为单个字符串处理
      return [value];
    }
    return [value];
  }
  
  if (Array.isArray(value)) {
    return value
      .map((item, idx) => {
        if (typeof item === 'string') {
          return item;
        }
        if (typeof item === 'number' || typeof item === 'boolean') {
          return String(item);
        }
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          // 优先提取常见字段
          if (typeof obj.name === 'string') return obj.name;
          if (typeof obj.label === 'string') return obj.label;
          if (typeof obj.type === 'string') return obj.type;
          if (typeof obj.id === 'string') return obj.id;
          if (typeof obj.value === 'string') return obj.value;
          // 如果有 brand + model，组合
          if (typeof obj.brand === 'string' && typeof obj.model === 'string') {
            return `${obj.brand} ${obj.model}`;
          }
          // 最后尝试 JSON 字符串
          console.warn(`[dataNormalizer] Cannot extract string from object at ${fieldName}[${idx}]:`, obj);
          return null;
        }
        return null;
      })
      .filter((s): s is string => s !== null && s !== '');
  }
  
  // 对于单个对象
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === 'string') return [obj.name];
    if (typeof obj.label === 'string') return [obj.label];
    if (typeof obj.type === 'string') return [obj.type];
    console.warn(`[dataNormalizer] Cannot convert object to string[] for field "${fieldName}":`, value);
    return [];
  }
  
  return [];
}

/**
 * 将各种输入转换为 number | null
 * 支持: string, number, null, undefined, ""
 */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

/**
 * 安全获取字符串值
 */
export function toSafeString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() === '' ? null : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

/**
 * 安全获取布尔值
 */
export function toBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    return defaultValue;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return defaultValue;
}

/**
 * 规范化 JSONB 对象字段
 * 确保返回 object 或 null，不会是字符串
 */
export function toJSONObject<T extends object = Record<string, unknown>>(
  value: unknown,
  fieldName: string = 'unknown'
): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch (err) {
      console.warn(`[dataNormalizer] Failed to parse JSON object for field "${fieldName}":`, value);
    }
  }
  
  return null;
}

/**
 * 规范化 JSONB 数组字段
 */
export function toJSONArray<T = unknown>(
  value: unknown,
  fieldName: string = 'unknown'
): T[] {
  if (value === null || value === undefined) {
    return [];
  }
  
  if (Array.isArray(value)) {
    return value as T[];
  }
  
  if (typeof value === 'string') {
    if (value.trim() === '') return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    } catch (err) {
      console.warn(`[dataNormalizer] Failed to parse JSON array for field "${fieldName}":`, value);
    }
  }
  
  return [];
}

// ==================== ENTITY NORMALIZERS ====================

/**
 * 规范化项目数据
 */
export function normalizeProject(raw: DbProject): DbProject {
  return {
    ...raw,
    // 字符串字段兜底
    code: toSafeString(raw.code),
    name: raw.name || '未命名项目',
    customer: toSafeString(raw.customer),
    date: toSafeString(raw.date),
    responsible: toSafeString(raw.responsible),
    sales_responsible: toSafeString(raw.sales_responsible),
    vision_responsible: toSafeString(raw.vision_responsible),
    product_process: toSafeString(raw.product_process),
    quality_strategy: toSafeString(raw.quality_strategy),
    environment: toSafeString(raw.environment),
    notes: toSafeString(raw.notes),
    description: toSafeString(raw.description),
    status: raw.status || 'draft',
    spec_version: toSafeString(raw.spec_version),
    production_line: toSafeString(raw.production_line),
    main_camera_brand: toSafeString(raw.main_camera_brand),
    template_id: toSafeString(raw.template_id),
    // 布尔字段
    use_ai: toBoolean(raw.use_ai, false),
    use_3d: toBoolean(raw.use_3d, false),
    // 数值字段
    cycle_time_target: toNumber(raw.cycle_time_target),
    // JSON 字段
    revision_history: toJSONArray(raw.revision_history, 'revision_history'),
  };
}

/**
 * 规范化工位数据
 */
export function normalizeWorkstation(raw: DbWorkstation): DbWorkstation {
  return {
    ...raw,
    // 字符串字段
    code: toSafeString(raw.code),
    name: raw.name || '未命名工位',
    type: raw.type || 'line',
    status: raw.status || 'draft',
    description: toSafeString(raw.description),
    motion_description: toSafeString(raw.motion_description),
    observation_target: toSafeString(raw.observation_target),
    process_stage: toSafeString(raw.process_stage),
    risk_notes: toSafeString(raw.risk_notes),
    action_script: toSafeString(raw.action_script),
    // 布尔字段
    enclosed: toBoolean(raw.enclosed, false),
    // 数值字段
    cycle_time: toNumber(raw.cycle_time),
    shot_count: toNumber(raw.shot_count) as number | null,
    // JSON 字段
    product_dimensions: toJSONObject(raw.product_dimensions, 'product_dimensions'),
    install_space: toJSONObject(raw.install_space, 'install_space'),
    acceptance_criteria: toJSONObject(raw.acceptance_criteria, 'acceptance_criteria'),
  };
}

/**
 * 规范化布局数据
 */
export function normalizeLayout(raw: DbLayout): DbLayout {
  return {
    ...raw,
    // 字符串字段
    name: raw.name || '默认布局',
    description: toSafeString(raw.description),
    layout_type: toSafeString(raw.layout_type),
    conveyor_type: toSafeString(raw.conveyor_type),
    front_view_image_url: toSafeString(raw.front_view_image_url),
    side_view_image_url: toSafeString(raw.side_view_image_url),
    top_view_image_url: toSafeString(raw.top_view_image_url),
    // 布尔字段
    grid_enabled: toBoolean(raw.grid_enabled, true),
    snap_enabled: toBoolean(raw.snap_enabled, true),
    show_distances: toBoolean(raw.show_distances, false),
    front_view_saved: toBoolean(raw.front_view_saved, false),
    side_view_saved: toBoolean(raw.side_view_saved, false),
    top_view_saved: toBoolean(raw.top_view_saved, false),
    // 数值字段
    width: toNumber(raw.width),
    height: toNumber(raw.height),
    depth: toNumber(raw.depth),
    camera_count: toNumber(raw.camera_count) as number | null,
    // JSON 数组字段 - 这些是最容易出问题的
    camera_mounts: toJSONArray(raw.camera_mounts, 'camera_mounts'),
    mechanisms: toJSONArray(raw.mechanisms, 'mechanisms'),
    layout_objects: toJSONArray(raw.layout_objects, 'layout_objects'),
    selected_cameras: toJSONArray(raw.selected_cameras, 'selected_cameras'),
    selected_lenses: toJSONArray(raw.selected_lenses, 'selected_lenses'),
    selected_lights: toJSONArray(raw.selected_lights, 'selected_lights'),
    // JSON 对象字段
    selected_controller: toJSONObject(raw.selected_controller, 'selected_controller'),
    machine_outline: toJSONObject(raw.machine_outline, 'machine_outline'),
  };
}

/**
 * 规范化模块数据
 */
export function normalizeModule(raw: DbModule): DbModule {
  return {
    ...raw,
    // 字符串字段
    name: raw.name || '未命名模块',
    type: raw.type || 'positioning',
    status: raw.status || 'incomplete',
    description: toSafeString(raw.description),
    trigger_type: toSafeString(raw.trigger_type),
    roi_strategy: raw.roi_strategy || 'full',
    selected_camera: toSafeString(raw.selected_camera),
    selected_lens: toSafeString(raw.selected_lens),
    selected_light: toSafeString(raw.selected_light),
    selected_controller: toSafeString(raw.selected_controller),
    schematic_image_url: toSafeString(raw.schematic_image_url),
    // 数值字段
    x: toNumber(raw.x),
    y: toNumber(raw.y),
    rotation: toNumber(raw.rotation),
    processing_time_limit: toNumber(raw.processing_time_limit) as number | null,
    // 数组字段 - 关键修复点
    output_types: toStringArray(raw.output_types, 'output_types'),
    // JSON 配置字段
    positioning_config: toJSONObject(raw.positioning_config, 'positioning_config'),
    defect_config: toJSONObject(raw.defect_config, 'defect_config'),
    ocr_config: toJSONObject(raw.ocr_config, 'ocr_config'),
    measurement_config: toJSONObject(raw.measurement_config, 'measurement_config'),
    deep_learning_config: toJSONObject(raw.deep_learning_config, 'deep_learning_config'),
  };
}

// ==================== BATCH NORMALIZERS ====================

/**
 * 批量规范化项目数据
 */
export function normalizeProjects(projects: DbProject[]): DbProject[] {
  return projects.map(p => {
    try {
      return normalizeProject(p);
    } catch (err) {
      console.error('[dataNormalizer] Failed to normalize project:', p.id, err);
      return p; // 返回原始数据，避免崩溃
    }
  });
}

/**
 * 批量规范化工位数据
 */
export function normalizeWorkstations(workstations: DbWorkstation[]): DbWorkstation[] {
  return workstations.map(ws => {
    try {
      return normalizeWorkstation(ws);
    } catch (err) {
      console.error('[dataNormalizer] Failed to normalize workstation:', ws.id, err);
      return ws;
    }
  });
}

/**
 * 批量规范化布局数据
 */
export function normalizeLayouts(layouts: DbLayout[]): DbLayout[] {
  return layouts.map(l => {
    try {
      return normalizeLayout(l);
    } catch (err) {
      console.error('[dataNormalizer] Failed to normalize layout:', l.id, err);
      return l;
    }
  });
}

/**
 * 批量规范化模块数据
 */
export function normalizeModules(modules: DbModule[]): DbModule[] {
  return modules.map(m => {
    try {
      return normalizeModule(m);
    } catch (err) {
      console.error('[dataNormalizer] Failed to normalize module:', m.id, err);
      return m;
    }
  });
}

// ==================== SAFE DISPLAY HELPERS ====================

/**
 * 安全的 map 操作
 * 避免 null/undefined.map() 崩溃
 */
export function safeMap<T, R>(
  arr: T[] | null | undefined,
  fn: (item: T, index: number) => R
): R[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(fn);
}

/**
 * 安全的 join 操作
 */
export function safeJoin(
  arr: unknown[] | null | undefined,
  separator: string = ', '
): string {
  if (!Array.isArray(arr)) return '';
  return arr.filter(v => v !== null && v !== undefined && v !== '').join(separator);
}

/**
 * 安全的 toFixed 操作
 */
export function safeToFixed(
  value: number | string | null | undefined,
  digits: number = 2
): string {
  const num = toNumber(value);
  if (num === null) return '';
  return num.toFixed(digits);
}

/**
 * 安全的日期格式化
 */
export function safeFormatDate(
  value: string | Date | null | undefined,
  format: 'short' | 'long' | 'iso' = 'short'
): string {
  if (!value) return '';
  
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    
    switch (format) {
      case 'iso':
        return date.toISOString().split('T')[0];
      case 'long':
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
      case 'short':
      default:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
  } catch {
    return '';
  }
}

/**
 * 安全的属性访问
 * 避免 undefined.property 崩溃
 */
export function safeGet<T>(
  obj: Record<string, unknown> | null | undefined,
  path: string,
  defaultValue: T
): T {
  if (!obj) return defaultValue;
  
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    if (typeof current !== 'object') {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return (current as T) ?? defaultValue;
}
