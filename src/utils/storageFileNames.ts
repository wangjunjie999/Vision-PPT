export interface SafeStorageObjectNameOptions {
  fallbackBase?: string;
  fallbackExtension?: string;
  includeTimestamp?: boolean;
  includeRandom?: boolean;
  maxBaseLength?: number;
  prefix?: string;
  randomSuffix?: string;
  timestamp?: number;
}

function stripPath(fileName: string): string {
  return fileName.split(/[\\/]/).pop() || fileName;
}

function stripExtension(fileName: string): string {
  const name = stripPath(fileName).trim();
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
}

export function sanitizeStorageSegment(value: string, fallback = 'file'): string {
  const fallbackValue = fallback || 'file';
  const safe = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 100);

  if (safe) return safe;
  if (fallbackValue === value) return 'file';
  return sanitizeStorageSegment(fallbackValue, 'file');
}

export function getSafeFileExtension(fileName: string, fallback = 'bin'): string {
  const name = stripPath(fileName).trim();
  const dotIndex = name.lastIndexOf('.');
  const rawExt = dotIndex >= 0 && dotIndex < name.length - 1 ? name.slice(dotIndex + 1) : fallback;
  return sanitizeStorageSegment(rawExt.toLowerCase(), fallback.toLowerCase())
    .replace(/\./g, '')
    .slice(0, 16) || sanitizeStorageSegment(fallback.toLowerCase(), 'bin');
}

export function createSafeStorageObjectName(
  fileName: string,
  options: SafeStorageObjectNameOptions = {},
): string {
  const {
    fallbackBase = 'file',
    fallbackExtension = 'bin',
    includeTimestamp = true,
    includeRandom = true,
    maxBaseLength = 60,
    prefix,
    randomSuffix,
    timestamp,
  } = options;

  const base = sanitizeStorageSegment(stripExtension(fileName), fallbackBase).slice(0, maxBaseLength);
  const ext = getSafeFileExtension(fileName, fallbackExtension);
  const parts: string[] = [];

  if (prefix) {
    parts.push(sanitizeStorageSegment(prefix, 'upload'));
  }
  if (includeTimestamp) {
    parts.push(String(timestamp ?? Date.now()));
  }
  if (includeRandom) {
    parts.push(randomSuffix ?? Math.random().toString(36).slice(2, 8));
  }
  parts.push(base || sanitizeStorageSegment(fallbackBase, 'file'));

  return `${parts.filter(Boolean).join('-')}.${ext}`;
}
