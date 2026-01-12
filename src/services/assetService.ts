/**
 * Asset Service - Unified asset management with standardized naming
 */
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';

export type AssetType = 
  | 'workstation_product'
  | 'module_annotation'
  | 'layout_front_view'
  | 'layout_side_view'
  | 'layout_top_view'
  | 'module_schematic'
  | 'hardware_image'
  | 'mechanism_view'
  | 'ppt_template';

export type RelatedType = 'project' | 'workstation' | 'module' | 'hardware' | 'mechanism' | 'template';

export interface AssetInfo {
  assetType: AssetType;
  relatedType: RelatedType;
  relatedId: string;
  projectCode?: string;
  workstationCode?: string;
  moduleName?: string;
  hardwareType?: string;
  hardwareBrand?: string;
  hardwareModel?: string;
}

export interface AssetRecord {
  id: string;
  user_id: string;
  asset_type: AssetType;
  related_type: string;
  related_id: string;
  file_path: string;
  file_url: string;
  standard_name: string;
  original_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  version: number;
  is_current: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Generate standardized file name based on asset info
 * Format: {ProjectCode}_{WorkstationCode}_{Type}_{Version}.{ext}
 */
export function generateStandardName(info: AssetInfo, version: number, extension: string): string {
  const parts: string[] = [];
  
  // Add project code if available
  if (info.projectCode) {
    parts.push(sanitizeName(info.projectCode));
  }
  
  // Add workstation code if available
  if (info.workstationCode) {
    parts.push(sanitizeName(info.workstationCode));
  }
  
  // Add module name if available
  if (info.moduleName) {
    parts.push(sanitizeName(info.moduleName));
  }
  
  // Add hardware info if available
  if (info.hardwareType) {
    parts.push(sanitizeName(info.hardwareType));
  }
  if (info.hardwareBrand) {
    parts.push(sanitizeName(info.hardwareBrand));
  }
  if (info.hardwareModel) {
    parts.push(sanitizeName(info.hardwareModel));
  }
  
  // Add asset type suffix
  const typeSuffix = getAssetTypeSuffix(info.assetType);
  parts.push(typeSuffix);
  
  // Add version
  parts.push(`V${version}`);
  
  // Join with underscore and add extension
  return `${parts.join('_')}.${extension}`;
}

/**
 * Get storage path for asset
 */
export function getStoragePath(info: AssetInfo, fileName: string): string {
  const basePath = getAssetTypeFolder(info.assetType);
  const relatedPath = `${info.relatedType}/${info.relatedId}`;
  return `${basePath}/${relatedPath}/${fileName}`;
}

/**
 * Upload asset with standardized naming and registry
 */
export async function uploadAsset(
  file: File,
  info: AssetInfo,
  metadata: Record<string, unknown> = {}
): Promise<{ url: string; record: AssetRecord } | { error: string }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: '用户未登录' };
  }
  
  const userId = userData.user.id;
  const extension = getFileExtension(file.name);
  
  // Get current version for this asset
  const currentVersion = await getCurrentVersion(userId, info.assetType, info.relatedId);
  const newVersion = currentVersion + 1;
  
  // Generate standardized name
  const standardName = generateStandardName(info, newVersion, extension);
  const storagePath = getStoragePath(info, standardName);
  
  // Mark previous versions as not current
  if (currentVersion > 0) {
    await supabase
      .from('asset_registry')
      .update({ is_current: false })
      .eq('user_id', userId)
      .eq('asset_type', info.assetType)
      .eq('related_id', info.relatedId);
  }
  
  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('project-assets')
    .upload(storagePath, file, { upsert: true });
  
  if (uploadError) {
    return { error: `上传失败: ${uploadError.message}` };
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('project-assets')
    .getPublicUrl(storagePath);
  
  const fileUrl = urlData.publicUrl;
  
  // Register in asset registry
  const { data: record, error: registryError } = await supabase
    .from('asset_registry')
    .insert({
      user_id: userId,
      asset_type: info.assetType as Database["public"]["Enums"]["asset_type"],
      related_type: info.relatedType,
      related_id: info.relatedId,
      file_path: storagePath,
      file_url: fileUrl,
      standard_name: standardName,
      original_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      version: newVersion,
      is_current: true,
      metadata: metadata as Json
    })
    .select()
    .single();
  
  if (registryError) {
    return { error: `注册资产失败: ${registryError.message}` };
  }
  
  return { url: fileUrl, record: record as AssetRecord };
}

/**
 * Get current assets for a related entity
 */
export async function getCurrentAssets(
  relatedType: RelatedType,
  relatedId: string,
  assetType?: AssetType
): Promise<AssetRecord[]> {
  let query = supabase
    .from('asset_registry')
    .select('*')
    .eq('related_type', relatedType)
    .eq('related_id', relatedId)
    .eq('is_current', true);
  
  if (assetType) {
    query = query.eq('asset_type', assetType);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取资产失败:', error);
    return [];
  }
  
  return data as AssetRecord[];
}

/**
 * Get all versions of an asset
 */
export async function getAssetVersions(
  relatedId: string,
  assetType: AssetType
): Promise<AssetRecord[]> {
  const { data, error } = await supabase
    .from('asset_registry')
    .select('*')
    .eq('related_id', relatedId)
    .eq('asset_type', assetType)
    .order('version', { ascending: false });
  
  if (error) {
    console.error('获取资产版本失败:', error);
    return [];
  }
  
  return data as AssetRecord[];
}

/**
 * Delete old versions of assets (cleanup)
 */
export async function cleanupOldVersions(
  relatedId: string,
  assetType: AssetType,
  keepVersions: number = 3
): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;
  
  const versions = await getAssetVersions(relatedId, assetType);
  
  if (versions.length <= keepVersions) return 0;
  
  const toDelete = versions.slice(keepVersions);
  let deletedCount = 0;
  
  for (const asset of toDelete) {
    // Delete from storage
    await supabase.storage
      .from('project-assets')
      .remove([asset.file_path]);
    
    // Delete from registry
    const { error } = await supabase
      .from('asset_registry')
      .delete()
      .eq('id', asset.id);
    
    if (!error) {
      deletedCount++;
    }
  }
  
  return deletedCount;
}

/**
 * Get assets for PPT generation
 */
export async function getProjectAssets(projectId: string): Promise<{
  workstationAssets: Map<string, AssetRecord[]>;
  moduleAssets: Map<string, AssetRecord[]>;
  layoutAssets: Map<string, AssetRecord[]>;
}> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      workstationAssets: new Map(),
      moduleAssets: new Map(),
      layoutAssets: new Map()
    };
  }
  
  // Get all workstations for this project
  const { data: workstations } = await supabase
    .from('workstations')
    .select('id')
    .eq('project_id', projectId);
  
  const workstationIds = workstations?.map(w => w.id) || [];
  
  // Get all modules for these workstations
  const { data: modules } = await supabase
    .from('function_modules')
    .select('id')
    .in('workstation_id', workstationIds);
  
  const moduleIds = modules?.map(m => m.id) || [];
  
  // Fetch all relevant assets
  const { data: assets } = await supabase
    .from('asset_registry')
    .select('*')
    .eq('is_current', true)
    .or(`related_id.in.(${[...workstationIds, ...moduleIds].join(',')})`);
  
  const workstationAssets = new Map<string, AssetRecord[]>();
  const moduleAssets = new Map<string, AssetRecord[]>();
  const layoutAssets = new Map<string, AssetRecord[]>();
  
  for (const asset of (assets || []) as AssetRecord[]) {
    if (asset.related_type === 'workstation') {
      const existing = workstationAssets.get(asset.related_id) || [];
      existing.push(asset);
      workstationAssets.set(asset.related_id, existing);
    } else if (asset.related_type === 'module') {
      const existing = moduleAssets.get(asset.related_id) || [];
      existing.push(asset);
      moduleAssets.set(asset.related_id, existing);
    }
    
    // Layout views
    if (asset.asset_type.includes('layout_')) {
      const existing = layoutAssets.get(asset.related_id) || [];
      existing.push(asset);
      layoutAssets.set(asset.related_id, existing);
    }
  }
  
  return { workstationAssets, moduleAssets, layoutAssets };
}

// Helper functions

async function getCurrentVersion(
  userId: string,
  assetType: AssetType,
  relatedId: string
): Promise<number> {
  const { data } = await supabase
    .from('asset_registry')
    .select('version')
    .eq('user_id', userId)
    .eq('asset_type', assetType)
    .eq('related_id', relatedId)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  
  return data?.version || 0;
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    .substring(0, 20);
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin';
}

function getAssetTypeSuffix(type: AssetType): string {
  const suffixMap: Record<AssetType, string> = {
    workstation_product: 'PROD',
    module_annotation: 'ANNO',
    layout_front_view: 'FRONT',
    layout_side_view: 'SIDE',
    layout_top_view: 'TOP',
    module_schematic: 'SCHEM',
    hardware_image: 'HW',
    mechanism_view: 'MECH',
    ppt_template: 'TPL'
  };
  return suffixMap[type];
}

function getAssetTypeFolder(type: AssetType): string {
  const folderMap: Record<AssetType, string> = {
    workstation_product: 'products',
    module_annotation: 'annotations',
    layout_front_view: 'layouts',
    layout_side_view: 'layouts',
    layout_top_view: 'layouts',
    module_schematic: 'schematics',
    hardware_image: 'hardware',
    mechanism_view: 'mechanisms',
    ppt_template: 'templates'
  };
  return folderMap[type];
}
