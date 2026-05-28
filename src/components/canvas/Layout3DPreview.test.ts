import { describe, expect, it } from 'vitest';
import type { LayoutObject } from './ObjectPropertyPanel';
import {
  calculateIsometricFitCamera,
  DEFAULT_ISOMETRIC_FIT_PADDING,
  deriveIsometricSceneStatus,
  getIsometricModelLoadKey,
  isIsometricCaptureReady,
  ISOMETRIC_CAPTURE_PADDING,
} from './Layout3DPreview';

function makeMechanism(patch: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 'mech-1',
    type: 'mechanism',
    name: 'mechanism',
    mechanismType: 'camera_mount',
    posX: 0,
    posY: 0,
    posZ: 0,
    x: 0,
    y: 0,
    width: 120,
    height: 800,
    rotation: 0,
    locked: false,
    ...patch,
  };
}

function cameraDistance(action: ReturnType<typeof calculateIsometricFitCamera>) {
  const dx = action.position[0] - action.target[0];
  const dy = action.position[1] - action.target[1];
  const dz = action.position[2] - action.target[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

describe('calculateIsometricFitCamera', () => {
  const productDimensions = { length: 200, width: 120, height: 50 };
  const productPosition = { posX: 0, posY: 0, posZ: 0 };

  it('keeps tall mechanisms inside the fit target', () => {
    const action = calculateIsometricFitCamera({
      objects: [makeMechanism()],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
    });

    expect(action.target[1]).toBeGreaterThan(4);
    expect(cameraDistance(action)).toBeGreaterThan(8);
  });

  it('accounts for rotated object bounds', () => {
    const base = calculateIsometricFitCamera({
      objects: [makeMechanism({ width: 100, height: 900, rotX: 0 })],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
    });
    const rotated = calculateIsometricFitCamera({
      objects: [makeMechanism({ width: 100, height: 900, rotX: 90 })],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
    });

    expect(Math.abs(cameraDistance(rotated) - cameraDistance(base))).toBeGreaterThan(0.1);
  });

  it('moves the camera farther away when padding increases', () => {
    const base = calculateIsometricFitCamera({
      objects: [makeMechanism()],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
      padding: 1.2,
    });
    const padded = calculateIsometricFitCamera({
      objects: [makeMechanism()],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
      padding: 1.9,
    });

    expect(cameraDistance(padded)).toBeGreaterThan(cameraDistance(base) * 1.4);
  });

  it('uses a tighter camera distance for screenshot capture padding', () => {
    const interactive = calculateIsometricFitCamera({
      objects: [makeMechanism()],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
      padding: DEFAULT_ISOMETRIC_FIT_PADDING,
    });
    const capture = calculateIsometricFitCamera({
      objects: [makeMechanism()],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
      padding: ISOMETRIC_CAPTURE_PADDING,
    });

    expect(cameraDistance(capture)).toBeLessThan(cameraDistance(interactive) * 0.85);
  });

  it('adapts camera distance for wide multi-object layouts', () => {
    const compact = calculateIsometricFitCamera({
      objects: [makeMechanism()],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
    });
    const wide = calculateIsometricFitCamera({
      objects: [
        makeMechanism({ id: 'mech-left', posX: -1500, width: 500, height: 400 }),
        makeMechanism({ id: 'mech-right', posX: 1500, width: 500, height: 400 }),
      ],
      productDimensions,
      productPosition,
      fov: 50,
      aspect: 16 / 9,
    });

    expect(cameraDistance(wide)).toBeGreaterThan(cameraDistance(compact) * 1.5);
  });
});

describe('isometric model readiness helpers', () => {
  const modelObject = makeMechanism({
    id: 'mech-glb',
    model3dUrl: 'https://example.com/model.glb',
  });
  const modelKey = getIsometricModelLoadKey(modelObject)!;

  it('marks custom GLB models as pending until loaded', () => {
    expect(deriveIsometricSceneStatus([modelObject], [], [])).toEqual({
      ready: false,
      pendingModelCount: 1,
      failedModelCount: 0,
    });

    expect(isIsometricCaptureReady(
      deriveIsometricSceneStatus([modelObject], [], []),
      true,
      true,
    )).toBe(false);
  });

  it('allows capture when all custom GLB models are loaded', () => {
    const status = deriveIsometricSceneStatus([modelObject], [modelKey], []);

    expect(status).toEqual({
      ready: true,
      pendingModelCount: 0,
      failedModelCount: 0,
    });
    expect(isIsometricCaptureReady(status, true, true)).toBe(true);
  });

  it('blocks capture when a custom GLB model failed', () => {
    const status = deriveIsometricSceneStatus([modelObject], [], [modelKey]);

    expect(status).toEqual({
      ready: false,
      pendingModelCount: 0,
      failedModelCount: 1,
    });
    expect(isIsometricCaptureReady(status, true, true)).toBe(false);
  });

  it('requires screenshot and fit functions before capture', () => {
    const status = deriveIsometricSceneStatus([], [], []);

    expect(isIsometricCaptureReady(status, false, true)).toBe(false);
    expect(isIsometricCaptureReady(status, true, false)).toBe(false);
    expect(isIsometricCaptureReady(status, true, true)).toBe(true);
  });
});
