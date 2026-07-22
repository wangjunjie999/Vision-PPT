const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'loading chunk',
  'chunkloaderror',
];

export function isDynamicImportLoadError(error: Error | null): boolean {
  if (!error) return false;
  const message = `${error.name} ${error.message}`.toLowerCase();
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}
