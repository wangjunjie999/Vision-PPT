// Product 3D annotation types

export type ProductScopeType = 'workstation' | 'module';
export type SourceType = 'image' | 'glb' | 'gltf' | 'stl';

export interface ProductAsset {
  id: string;
  scope_type: ProductScopeType;
  workstation_id: string | null;
  module_id: string | null;
  user_id: string;
  source_type: SourceType;
  model_file_url: string | null;
  preview_images: string[];
  created_at: string;
  updated_at: string;
}

export interface Annotation {
  id: string;
  type: 'point' | 'rect' | 'arrow' | 'text' | 'number';
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  text?: string;
  number?: number;
  name: string;
  description?: string;
  color?: string;
}

export interface ViewMeta {
  cameraPosition?: [number, number, number];
  cameraRotation?: [number, number, number];
  zoom?: number;
}

export interface ProductAnnotation {
  id: string;
  asset_id: string;
  user_id: string;
  snapshot_url: string;
  annotations_json: Annotation[];
  view_meta: ViewMeta;
  version: number;
  remark: string | null;
  created_at: string;
}
