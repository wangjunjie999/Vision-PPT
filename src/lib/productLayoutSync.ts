import type { Database } from '@/integrations/supabase/types';

export type WorkstationProductAsset = Database['public']['Tables']['product_assets']['Row'];

export interface LayoutObject {
  id: string;
  type: 'camera' | 'mechanism' | 'product';
  mechanismId?: string;
  mechanismType?: string;
  name: string;
  posX: number;
  posY: number;
  posZ: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  locked: boolean;
  cameraIndex?: number;
  mountedToMechanismId?: string;
  mountPointId?: string;
  mountOffsetX?: number;
  mountOffsetY?: number;
  mountOffsetZ?: number;
  model3dUrl?: string;
  productAssetId?: string;
  productLength?: number;
  productWidth?: number;
  productHeight?: number;
  productIsPrimary?: boolean;
}

export type ProductLayoutObject = LayoutObject & {
  type: 'product';
  productAssetId?: string;
};

export function isProductLayoutObject(object: LayoutObject): object is ProductLayoutObject {
  return object.type === 'product';
}

export function reconcileProductLayoutObjects(
  baseObjects: LayoutObject[],
  assets: WorkstationProductAsset[],
  defaults: { length: number; width: number; height: number },
  project: (posX: number, posY: number, posZ: number) => { x: number; y: number },
): LayoutObject[] {
  if (assets.length === 0) return baseObjects.filter(object => object.type !== 'product');

  const layoutProducts = baseObjects.filter(isProductLayoutObject);
  const linkedProducts = new Map(
    layoutProducts
      .filter(product => product.productAssetId)
      .map(product => [product.productAssetId!, product]),
  );
  const legacyProducts = layoutProducts.filter(product => !product.productAssetId);
  let legacyIndex = 0;

  const products = assets.map((asset, index): LayoutObject => {
    const linked = linkedProducts.get(asset.id);
    const existing = linked ?? legacyProducts[legacyIndex++];
    const fallbackY = index === 0
      ? 0
      : (index % 2 === 0 ? 1 : -1) * Math.ceil(index / 2) * (defaults.width + 100);
    const posX = asset.pos_x ?? existing?.posX ?? 0;
    const posY = asset.pos_y ?? existing?.posY ?? fallbackY;
    const posZ = asset.pos_z ?? existing?.posZ ?? 0;
    const canvasPosition = project(posX, posY, posZ);
    const length = asset.length_mm ?? existing?.productLength ?? defaults.length;
    const width = asset.width_mm ?? existing?.productWidth ?? defaults.width;
    const height = asset.height_mm ?? existing?.productHeight ?? defaults.height;

    return {
      ...(existing || {}),
      id: `product-${asset.id}`,
      type: 'product',
      productAssetId: asset.id,
      productIsPrimary: asset.is_primary,
      name: asset.product_name || existing?.name || `产品 ${index + 1}`,
      posX,
      posY,
      posZ,
      x: canvasPosition.x,
      y: canvasPosition.y,
      width: length,
      height,
      rotation: existing?.rotation ?? 0,
      locked: existing?.locked ?? false,
      productLength: length,
      productWidth: width,
      productHeight: height,
      model3dUrl: asset.model_file_url ?? (linked ? undefined : existing?.model3dUrl),
    };
  });

  return [...baseObjects.filter(object => object.type !== 'product'), ...products];
}
