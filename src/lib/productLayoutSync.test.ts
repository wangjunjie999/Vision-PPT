import { describe, expect, it } from 'vitest';
import {
  reconcileProductLayoutObjects,
  type LayoutObject,
  type WorkstationProductAsset,
} from './productLayoutSync';

const defaults = { length: 100, width: 80, height: 40 };
const project = (posX: number, posY: number, posZ: number) => ({ x: posX + 500, y: posY - posZ + 300 });

function makeAsset(id: string, overrides: Partial<WorkstationProductAsset> = {}): WorkstationProductAsset {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    detection_method: null,
    detection_requirements: null,
    document_images_per_page: 1,
    height_mm: null,
    id,
    is_primary: false,
    length_mm: null,
    model_file_url: null,
    module_id: null,
    parent_product_id: null,
    pos_x: null,
    pos_y: null,
    pos_z: null,
    preview_images: null,
    product_code: null,
    product_models: null,
    product_name: `产品 ${id}`,
    product_spec: null,
    scope_type: 'workstation',
    sort_order: 0,
    source_type: 'manual',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_id: 'user-1',
    width_mm: null,
    workstation_id: 'ws-1',
    ...overrides,
  };
}

function makeProduct(id: string, overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id,
    type: 'product',
    name: id,
    posX: 1,
    posY: 2,
    posZ: 3,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    rotation: 0,
    locked: false,
    ...overrides,
  };
}

describe('reconcileProductLayoutObjects', () => {
  it('matches linked products by asset id and consumes legacy products only for unlinked assets', () => {
    const linkedB = makeProduct('old-linked-b', {
      productAssetId: 'b',
      rotation: 22,
      locked: true,
      posX: 20,
    });
    const legacyA = makeProduct('legacy-a', { rotation: 11, posX: 10 });
    const legacyC = makeProduct('legacy-c', { rotation: 33, posX: 30 });
    const camera: LayoutObject = {
      ...makeProduct('camera-1'),
      type: 'camera',
      name: 'CAM1',
    };

    const result = reconcileProductLayoutObjects(
      [camera, linkedB, legacyA, legacyC],
      [makeAsset('a'), makeAsset('b'), makeAsset('c')],
      defaults,
      project,
    );
    const products = result.filter(object => object.type === 'product');

    expect(result[0]).toBe(camera);
    expect(products.map(product => product.id)).toEqual(['product-a', 'product-b', 'product-c']);
    expect(products.map(product => product.rotation)).toEqual([11, 22, 33]);
    expect(products[1].locked).toBe(true);
  });

  it('removes deleted products and lets linked asset data override stale layout coordinates', () => {
    const staleA = makeProduct('product-a', {
      productAssetId: 'a',
      posX: 999,
      posY: 999,
      posZ: 999,
      model3dUrl: 'old.glb',
    });
    const deletedB = makeProduct('product-b', { productAssetId: 'b' });

    const result = reconcileProductLayoutObjects(
      [staleA, deletedB],
      [makeAsset('a', { pos_x: 1.5, pos_y: 2.25, pos_z: 3.75, model_file_url: null })],
      defaults,
      project,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'product-a',
      posX: 1.5,
      posY: 2.25,
      posZ: 3.75,
      x: 501.5,
      y: 298.5,
    });
    expect(result[0].model3dUrl).toBeUndefined();
  });
});
