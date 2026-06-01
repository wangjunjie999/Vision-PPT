import { describe, expect, it } from 'vitest';
import {
  hasExplicitModule3DCameraFlag,
  isModule3DCamera,
  shouldRestoreDraftAs3DCamera,
  toBoolean3D,
} from './module3DCamera';

describe('module 3D camera detection', () => {
  it('uses project use_3d only as a legacy fallback when the module flag is absent', () => {
    const module = {
      defect_config: {
        imaging: {},
      },
    };

    expect(hasExplicitModule3DCameraFlag(module)).toBe(false);
    expect(isModule3DCamera(module, true)).toBe(true);
    expect(isModule3DCamera(module, false)).toBe(false);
  });

  it('lets the explicit module flag override the legacy project flag', () => {
    expect(isModule3DCamera({
      defect_config: {
        imaging: { is3DCamera: false },
      },
    }, true)).toBe(false);

    expect(isModule3DCamera({
      measurement_config: {
        imaging: { is3DCamera: 'true' },
      },
    }, false)).toBe(true);
  });

  it('normalizes common boolean-like values', () => {
    expect(toBoolean3D('yes')).toBe(true);
    expect(toBoolean3D('1')).toBe(true);
    expect(toBoolean3D(1)).toBe(true);
    expect(toBoolean3D('false')).toBe(false);
    expect(toBoolean3D(0)).toBe(false);
  });

  it('restores stale drafts as 3D when module or legacy project state is 3D', () => {
    const legacyModule = {
      defect_config: {
        imaging: {},
      },
    };
    const explicitModule = {
      defect_config: {
        imaging: { is3DCamera: true },
      },
    };

    expect(shouldRestoreDraftAs3DCamera(legacyModule, { is3DCamera: false }, true)).toBe(true);
    expect(shouldRestoreDraftAs3DCamera(explicitModule, { is3DCamera: false }, false)).toBe(true);
    expect(shouldRestoreDraftAs3DCamera(legacyModule, { is3DCamera: false }, false)).toBe(false);
  });
});
