import { describe, expect, it } from 'vitest';
import { isDynamicImportLoadError } from './dynamicImportError';

describe('isDynamicImportLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: /src/components/canvas/ProjectDashboard.tsx',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Loading chunk 42 failed.',
  ])('recognizes a recoverable module loading error: %s', message => {
    expect(isDynamicImportLoadError(new Error(message))).toBe(true);
  });

  it('keeps ordinary render errors on the in-place reset path', () => {
    expect(isDynamicImportLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isDynamicImportLoadError(null)).toBe(false);
  });
});
