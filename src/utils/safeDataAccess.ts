/**
 * 安全数据访问工具
 * 为 JSON 字段提供类型安全的访问和防御性检查
 * 
 * 用于处理来自数据库的 JSON 字段，这些字段可能是:
 * - null/undefined
 * - 期望类型（数组或对象）
 * - 遗留数据格式（如期望数组但实际是对象）
 */

/**
 * 安全获取数组，防止非数组值导致 .map/.forEach 等崩溃
 * @param value - 可能的数组值
 * @param defaultValue - 默认值，默认为空数组
 */
export function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return defaultValue;
}

/**
 * 安全获取数字
 * @param value - 可能的数字值
 * @param defaultValue - 默认值
 */
export function safeNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
}

/**
 * 安全获取字符串
 * @param value - 可能的字符串值
 * @param defaultValue - 默认值
 */
export function safeString(value: unknown, defaultValue = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return String(value);
}

/**
 * 安全获取对象
 * @param value - 可能的对象值
 * @param defaultValue - 默认值
 */
export function safeObject<T extends object>(value: unknown, defaultValue: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return defaultValue;
}

/**
 * 安全获取布局的 camera_mounts 字段
 * 处理遗留数据格式（对象）和正确格式（数组）
 */
export function safeCameraMounts(value: unknown, defaultValue: string[] = ['top']): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  // 处理遗留对象格式
  if (value && typeof value === 'object') {
    return Object.keys(value as object);
  }
  return defaultValue;
}

/**
 * 安全获取布局的 mechanisms 字段
 * 处理字符串数组和对象数组两种格式
 */
export function safeMechanisms(value: unknown, defaultValue: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return defaultValue;
  }
  
  return value.map(m => {
    if (typeof m === 'string') return m;
    if (typeof m === 'object' && m !== null) {
      return (m as { type?: string; name?: string }).type || (m as { name?: string }).name || '';
    }
    return '';
  }).filter(Boolean);
}

/**
 * 安全获取布局的硬件选择字段（selected_cameras, selected_lenses, selected_lights）
 */
export interface HardwareSelection {
  id: string;
  brand?: string;
  model?: string;
  image_url?: string | null;
}

export function safeHardwareArray(value: unknown, defaultValue: HardwareSelection[] = []): HardwareSelection[] {
  if (!Array.isArray(value)) {
    return defaultValue;
  }
  
  return value.filter((item): item is HardwareSelection => {
    return item && typeof item === 'object' && typeof (item as HardwareSelection).id === 'string';
  });
}

/**
 * 安全获取布局的 selected_controller 字段
 */
export function safeController(value: unknown): HardwareSelection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  
  const controller = value as HardwareSelection;
  if (typeof controller.id !== 'string') {
    return null;
  }
  
  return controller;
}

/**
 * 安全获取布局的 layout_objects 字段
 */
export function safeLayoutObjects(value: unknown): Array<Record<string, unknown>> {
  // 处理字符串格式（可能是 JSON 字符串）
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return [];
    }
  }
  
  if (Array.isArray(value)) {
    return value;
  }
  
  return [];
}

/**
 * 安全获取产品尺寸
 */
export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export function safeDimensions(value: unknown, defaultValue: Dimensions | null = null): Dimensions | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultValue;
  }
  
  const dims = value as Partial<Dimensions>;
  if (typeof dims.length !== 'number' || typeof dims.width !== 'number' || typeof dims.height !== 'number') {
    return defaultValue;
  }
  
  return {
    length: dims.length,
    width: dims.width,
    height: dims.height,
  };
}

/**
 * 安全遍历数组，即使输入不是数组也不会崩溃
 */
export function safeForEach<T>(
  value: unknown,
  callback: (item: T, index: number) => void
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => callback(item as T, index));
  }
}

/**
 * 安全映射数组，即使输入不是数组也不会崩溃
 */
export function safeMap<T, R>(
  value: unknown,
  callback: (item: T, index: number) => R,
  defaultValue: R[] = []
): R[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => callback(item as T, index));
  }
  return defaultValue;
}

/**
 * 安全过滤数组，即使输入不是数组也不会崩溃
 */
export function safeFilter<T>(
  value: unknown,
  predicate: (item: T, index: number) => boolean,
  defaultValue: T[] = []
): T[] {
  if (Array.isArray(value)) {
    return value.filter((item, index) => predicate(item as T, index)) as T[];
  }
  return defaultValue;
}

/**
 * 安全 reduce 数组，即使输入不是数组也不会崩溃
 */
export function safeReduce<T, R>(
  value: unknown,
  callback: (acc: R, item: T, index: number) => R,
  initialValue: R
): R {
  if (Array.isArray(value)) {
    return value.reduce((acc, item, index) => callback(acc, item as T, index), initialValue);
  }
  return initialValue;
}

/**
 * 安全 flatMap 数组
 */
export function safeFlatMap<T, R>(
  value: unknown,
  callback: (item: T, index: number) => R[],
  defaultValue: R[] = []
): R[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => callback(item as T, index));
  }
  return defaultValue;
}
