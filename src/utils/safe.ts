/**
 * Safe utility functions to prevent runtime crashes from null/undefined/malformed data
 * These helpers should be used in UI rendering to avoid white-screen crashes
 */

import { format, isValid, parseISO } from 'date-fns';

/**
 * Safely convert any value to an array
 * Handles: null, undefined, string, object, array
 */
export function safeArray<T = unknown>(value: unknown): T[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'string') {
    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    } catch {
      // If it's a comma-separated string, split it
      if (value.includes(',')) {
        return value.split(',').map(s => s.trim()).filter(Boolean) as T[];
      }
      // Return as single-element array if non-empty
      return value.trim() ? [value.trim() as T] : [];
    }
  }
  if (typeof value === 'object') {
    // If it's an object with values, return as array
    return [value as T];
  }
  return [];
}

/**
 * Safely join array values with separator
 * Handles: null, undefined, non-array values
 */
export function safeJoin(value: unknown, separator: string = ', '): string {
  const arr = safeArray<unknown>(value);
  return arr
    .map(item => {
      if (item === null || item === undefined) return '';
      if (typeof item === 'object') {
        // Extract displayable value from object
        const obj = item as Record<string, unknown>;
        return obj.name || obj.label || obj.title || obj.value || obj.id || '';
      }
      return String(item);
    })
    .filter(Boolean)
    .join(separator);
}

/**
 * Safely convert value to number or null
 * Handles: null, undefined, empty string, non-numeric strings
 */
export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Safely convert value to displayable text
 * Handles: null, undefined, objects, arrays
 */
export function safeText(value: unknown, fallback: string = '—'): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? fallback : String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (Array.isArray(value)) {
    const joined = safeJoin(value);
    return joined || fallback;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Try to extract displayable value
    const displayValue = obj.name || obj.label || obj.title || obj.value;
    if (displayValue) {
      return String(displayValue);
    }
    // For dimensions or ranges
    if ('width' in obj && 'height' in obj) {
      return `${obj.width} × ${obj.height}`;
    }
    if ('min' in obj && 'max' in obj) {
      return `${obj.min} - ${obj.max}`;
    }
    return fallback;
  }
  return fallback;
}

/**
 * Safely format date value
 * Handles: null, undefined, invalid dates, various date formats
 */
export function safeDate(value: unknown, fallback: string = '—', formatStr: string = 'yyyy-MM-dd'): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  try {
    let date: Date;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      // Try ISO format first
      date = parseISO(value);
      if (!isValid(date)) {
        // Try native Date parsing as fallback
        date = new Date(value);
      }
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else {
      return fallback;
    }

    if (!isValid(date)) {
      return fallback;
    }

    return format(date, formatStr);
  } catch (error) {
    console.warn('[safeDate] Failed to parse date:', value, error);
    return fallback;
  }
}

/**
 * Safely format number with toFixed
 * Handles: null, undefined, NaN
 */
export function safeToFixed(value: unknown, digits: number = 2, fallback: string = '—'): string {
  const num = safeNumber(value);
  if (num === null) {
    return fallback;
  }
  return num.toFixed(digits);
}

/**
 * Safely access nested object property
 * Handles: null, undefined at any level
 */
export function safeGet<T = unknown>(
  obj: unknown, 
  path: string, 
  fallback: T | null = null
): T | null {
  if (obj === null || obj === undefined) {
    return fallback;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return fallback;
    }
    if (typeof current !== 'object') {
      return fallback;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return (current ?? fallback) as T;
}

/**
 * Safely map over an array with error handling per item
 * If an item's mapper throws, it's skipped with a warning
 */
export function safeMap<T, R>(
  value: unknown,
  mapper: (item: T, index: number) => R
): R[] {
  const arr = safeArray<T>(value);
  const results: R[] = [];

  arr.forEach((item, index) => {
    try {
      results.push(mapper(item, index));
    } catch (error) {
      console.warn(`[safeMap] Error mapping item at index ${index}:`, error);
    }
  });

  return results;
}

/**
 * Safely get array length
 */
export function safeLength(value: unknown): number {
  return safeArray(value).length;
}

/**
 * Safely check if array is empty
 */
export function safeIsEmpty(value: unknown): boolean {
  return safeLength(value) === 0;
}

/**
 * Safely get first element of array
 */
export function safeFirst<T = unknown>(value: unknown, fallback: T | null = null): T | null {
  const arr = safeArray<T>(value);
  return arr.length > 0 ? arr[0] : fallback;
}

/**
 * Safely filter an array
 */
export function safeFilter<T>(
  value: unknown,
  predicate: (item: T, index: number) => boolean
): T[] {
  const arr = safeArray<T>(value);
  return arr.filter((item, index) => {
    try {
      return predicate(item, index);
    } catch {
      return false;
    }
  });
}
