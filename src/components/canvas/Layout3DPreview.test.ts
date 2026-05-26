import { describe, expect, it } from 'vitest';
import type { LayoutObject } from './ObjectPropertyPanel';
import { calculateIsometricFitCamera } from './Layout3DPreview';

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
});
