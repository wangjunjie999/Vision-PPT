import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCache } from '@/services/offlineCache';
import { sortByEntityOrder } from '@/utils/sortByCode';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Database types
type DbProject = Database['public']['Tables']['projects']['Row'];
type DbWorkstation = Database['public']['Tables']['workstations']['Row'];
type DbLayout = Database['public']['Tables']['mechanical_layouts']['Row'];
type DbModule = Database['public']['Tables']['function_modules']['Row'];
type DbProductAsset = Database['public']['Tables']['product_assets']['Row'];

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type WorkstationInsert = Database['public']['Tables']['workstations']['Insert'];
type LayoutInsert = Database['public']['Tables']['mechanical_layouts']['Insert'];
type ModuleInsert = Database['public']['Tables']['function_modules']['Insert'];
type ProductAssetInsert = Database['public']['Tables']['product_assets']['Insert'];

type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
type WorkstationUpdate = Database['public']['Tables']['workstations']['Update'];
type LayoutUpdate = Database['public']['Tables']['mechanical_layouts']['Update'];
type ModuleUpdate = Database['public']['Tables']['function_modules']['Update'];
type ProductAssetUpdate = Database['public']['Tables']['product_assets']['Update'];

interface MutationOptions {
  silent?: boolean;
}

interface DataContextType {
  // Data
  projects: DbProject[];
  workstations: DbWorkstation[];
  layouts: DbLayout[];
  modules: DbModule[];
  productAssets: DbProductAsset[];
  loading: boolean;
  
  // Selection state
  selectedProjectId: string | null;
  selectedWorkstationId: string | null;
  selectedModuleId: string | null;
  selectProject: (id: string | null) => void;
  selectWorkstation: (id: string | null) => void;
  selectModule: (id: string | null) => void;
  
  // Project CRUD
  addProject: (project: Omit<ProjectInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbProject>;
  updateProject: (id: string, updates: ProjectUpdate) => Promise<DbProject>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  reorderProjects: (orderedIds: string[]) => Promise<void>;
  
  // Workstation CRUD
  addWorkstation: (workstation: Omit<WorkstationInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbWorkstation>;
  updateWorkstation: (id: string, updates: WorkstationUpdate, options?: MutationOptions) => Promise<DbWorkstation>;
  deleteWorkstation: (id: string) => Promise<void>;
  duplicateWorkstation: (id: string) => Promise<DbWorkstation>;
  reorderWorkstations: (projectId: string, orderedIds: string[]) => Promise<void>;
  moveWorkstation: (id: string, targetProjectId: string, orderedIds: string[]) => Promise<void>;
  
  // Layout CRUD
  getLayoutByWorkstation: (workstationId: string) => DbLayout | undefined;
  addLayout: (layout: Omit<LayoutInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbLayout>;
  updateLayout: (id: string, updates: LayoutUpdate) => Promise<DbLayout>;
  upsertLayout: (workstationId: string, data: Omit<LayoutInsert, 'id' | 'created_at' | 'updated_at' | 'workstation_id' | 'user_id'>) => Promise<DbLayout>;
  
  // Module CRUD
  addModule: (module: Omit<ModuleInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbModule>;
  updateModule: (id: string, updates: ModuleUpdate & { measurement_config?: any; schematic_image_url?: string | null }) => Promise<DbModule>;
  deleteModule: (id: string) => Promise<void>;
  duplicateModule: (id: string) => Promise<DbModule>;
  reorderModules: (workstationId: string, orderedIds: string[]) => Promise<void>;
  moveModule: (id: string, targetWorkstationId: string, orderedIds: string[]) => Promise<void>;

  // Product asset CRUD. Workstation-scoped products are the canonical layout products.
  addProductAsset: (asset: Omit<ProductAssetInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbProductAsset>;
  updateProductAsset: (id: string, updates: ProductAssetUpdate, options?: MutationOptions) => Promise<DbProductAsset>;
  deleteProductAsset: (id: string) => Promise<void>;
  setPrimaryProductAsset: (workstationId: string, id: string) => Promise<void>;
  reorderProductAssets: (workstationId: string, orderedIds: string[]) => Promise<void>;
  
  // Helpers
  getProjectWorkstations: (projectId: string) => DbWorkstation[];
  getWorkstationModules: (workstationId: string) => DbModule[];
  getWorkstationProductAssets: (workstationId: string) => DbProductAsset[];
  getModuleProductAssets: (moduleId: string) => DbProductAsset[];
  refetch: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

const SELECTION_STORAGE_KEY = 'vision-ppt:selected-entity:v1';

interface StoredSelection {
  selectedProjectId: string | null;
  selectedWorkstationId: string | null;
  selectedModuleId: string | null;
}

const emptyStoredSelection: StoredSelection = {
  selectedProjectId: null,
  selectedWorkstationId: null,
  selectedModuleId: null,
};

function readStoredSelection(): StoredSelection {
  if (typeof window === 'undefined') return emptyStoredSelection;

  try {
    const raw = window.sessionStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return emptyStoredSelection;
    return { ...emptyStoredSelection, ...JSON.parse(raw) };
  } catch {
    return emptyStoredSelection;
  }
}

function writeStoredSelection(selection: StoredSelection) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Selection restore is best effort and should never interrupt editing.
  }
}

function getNextSortOrder<T extends { sort_order?: number | null }>(items: T[]) {
  const existing = items
    .map(item => item.sort_order)
    .filter((value): value is number => Number.isFinite(value));
  return existing.length > 0 ? Math.max(...existing) + 1 : items.length;
}

function sortProductAssets(items: DbProductAsset[]) {
  return [...items].sort((a, b) =>
    Number(b.is_primary) - Number(a.is_primary)
    || (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || a.created_at.localeCompare(b.created_at)
  );
}

function applySortOrder<T extends { id: string; sort_order?: number | null }>(
  items: T[],
  orderedIds: string[],
): T[] {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  return items.map(item => {
    const sortOrder = orderMap.get(item.id);
    return sortOrder === undefined ? item : { ...item, sort_order: sortOrder };
  });
}

async function assertNoSupabaseErrors(results: Array<{ error: unknown }>) {
  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const initialSelectionRef = useRef<StoredSelection | null>(null);
  if (!initialSelectionRef.current) {
    initialSelectionRef.current = readStoredSelection();
  }

  const [projects, setProjects] = useState<DbProject[]>([]);
  const [workstations, setWorkstations] = useState<DbWorkstation[]>([]);
  const [layouts, setLayouts] = useState<DbLayout[]>([]);
  const [modules, setModules] = useState<DbModule[]>([]);
  const [productAssets, setProductAssets] = useState<DbProductAsset[]>([]);
  const productAssetsRef = useRef(productAssets);
  productAssetsRef.current = productAssets;
  const productAssetMutationVersionRef = useRef<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialSelectionRef.current.selectedProjectId);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(initialSelectionRef.current.selectedWorkstationId);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(initialSelectionRef.current.selectedModuleId);

  // Track if initial cache load happened
  const cacheLoadedRef = useRef(false);

  // Load from cache first (instant display)
  const loadFromCache = useCallback(async () => {
    if (cacheLoadedRef.current) return;
    
    try {
      const [cachedProjects, cachedWorkstations, cachedLayouts, cachedModules, cachedProductAssets] = await Promise.all([
        offlineCache.get<DbProject[]>('projects'),
        offlineCache.get<DbWorkstation[]>('workstations'),
        offlineCache.get<DbLayout[]>('layouts'),
        offlineCache.get<DbModule[]>('modules'),
        offlineCache.get<DbProductAsset[]>('productAssets'),
      ]);

      if (cachedProjects) setProjects(sortByEntityOrder(cachedProjects, 'createdDesc'));
      if (cachedWorkstations) setWorkstations(sortByEntityOrder(cachedWorkstations, 'code'));
      if (cachedLayouts) setLayouts(cachedLayouts);
      if (cachedModules) setModules(sortByEntityOrder(cachedModules, 'createdAsc'));
      if (cachedProductAssets) setProductAssets(sortProductAssets(cachedProductAssets));
      
      // If we have cached data, don't show loading state
      if (cachedProjects || cachedWorkstations) {
        setLoading(false);
        cacheLoadedRef.current = true;
      }
    } catch (err) {
      console.error('Cache load error:', err);
    }
  }, []);

  // Fetch all data from server
  const fetchAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      // Only show loading if no cached data
      if (!cacheLoadedRef.current) {
        setLoading(true);
      }
      
      const [projectsRes, workstationsRes, layoutsRes, modulesRes, productAssetsRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('workstations').select('*').order('created_at', { ascending: true }),
        supabase.from('mechanical_layouts').select('*'),
        supabase.from('function_modules').select('*').order('created_at', { ascending: true }),
        supabase.from('product_assets').select('*').order('created_at', { ascending: true }),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (workstationsRes.error) throw workstationsRes.error;
      if (layoutsRes.error) throw layoutsRes.error;
      if (modulesRes.error) throw modulesRes.error;
      if (productAssetsRes.error) throw productAssetsRes.error;

      const projectsData = sortByEntityOrder(projectsRes.data || [], 'createdDesc');
      const workstationsData = sortByEntityOrder(workstationsRes.data || [], 'code');
      const layoutsData = layoutsRes.data || [];
      const modulesData = sortByEntityOrder(modulesRes.data || [], 'createdAsc');
      const productAssetsData = sortProductAssets(productAssetsRes.data || []);

      setProjects(projectsData);
      setWorkstations(workstationsData);
      setLayouts(layoutsData);
      setModules(modulesData);
      setProductAssets(productAssetsData);

      // Update cache in background
      Promise.all([
        offlineCache.set('projects', projectsData, CACHE_TTL),
        offlineCache.set('workstations', workstationsData, CACHE_TTL),
        offlineCache.set('layouts', layoutsData, CACHE_TTL),
        offlineCache.set('modules', modulesData, CACHE_TTL),
        offlineCache.set('productAssets', productAssetsData, CACHE_TTL),
      ]).catch(console.error);
      
    } catch (err) {
      console.error('Failed to fetch data:', err);
      // Only show error if we don't have cached data
      if (!cacheLoadedRef.current) {
        toast.error('数据加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load from cache first, then fetch fresh data
  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, user]);

  useEffect(() => {
    writeStoredSelection({
      selectedProjectId,
      selectedWorkstationId,
      selectedModuleId,
    });
  }, [selectedModuleId, selectedProjectId, selectedWorkstationId]);

  useEffect(() => {
    if (loading) return;

    if (selectedModuleId) {
      const selectedModule = modules.find(m => m.id === selectedModuleId);
      if (!selectedModule) {
        setSelectedModuleId(null);
      } else if (selectedWorkstationId !== selectedModule.workstation_id) {
        setSelectedWorkstationId(selectedModule.workstation_id);
      }
    }

    if (selectedWorkstationId) {
      const selectedWorkstation = workstations.find(w => w.id === selectedWorkstationId);
      if (!selectedWorkstation) {
        setSelectedWorkstationId(null);
        setSelectedModuleId(null);
      } else if (selectedProjectId !== selectedWorkstation.project_id) {
        setSelectedProjectId(selectedWorkstation.project_id);
      }
    }

    if (selectedProjectId && !projects.some(p => p.id === selectedProjectId)) {
      setSelectedProjectId(null);
      setSelectedWorkstationId(null);
      setSelectedModuleId(null);
    }
  }, [
    loading,
    modules,
    projects,
    selectedModuleId,
    selectedProjectId,
    selectedWorkstationId,
    workstations,
  ]);

  // Selection functions
  const selectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    setSelectedWorkstationId(null);
    setSelectedModuleId(null);
  }, []);

  const selectWorkstation = useCallback((id: string | null) => {
    if (id) {
      const ws = workstations.find(w => w.id === id);
      if (ws) {
        setSelectedProjectId(ws.project_id);
        setSelectedWorkstationId(id);
        setSelectedModuleId(null);
      }
    } else {
      setSelectedWorkstationId(null);
      setSelectedModuleId(null);
    }
  }, [workstations]);

  const selectModule = useCallback((id: string | null) => {
    if (id) {
      const mod = modules.find(m => m.id === id);
      if (mod) {
        const ws = workstations.find(w => w.id === mod.workstation_id);
        if (ws) {
          setSelectedProjectId(ws.project_id);
          setSelectedWorkstationId(mod.workstation_id);
          setSelectedModuleId(id);
        }
      }
    } else {
      setSelectedModuleId(null);
    }
  }, [modules, workstations]);

  // Project CRUD
  const addProject = async (project: Omit<ProjectInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('User not authenticated');
    const sort_order = project.sort_order ?? getNextSortOrder(projects);
    const { data, error } = await supabase.from('projects').insert({ ...project, sort_order, user_id: user.id }).select().single();
    if (error) throw error;
    setProjects(prev => sortByEntityOrder([...prev, data], 'createdDesc'));
    toast.success('项目创建成功');
    return data;
  };

  const updateProject = async (id: string, updates: ProjectUpdate) => {
    const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setProjects(prev => prev.map(p => p.id === id ? data : p));
    toast.success('项目更新成功');
    return data;
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProjectId === id) selectProject(null);
    toast.success('项目删除成功');
  };

  const duplicateProject = async (id: string) => {
    const original = projects.find(p => p.id === id);
    if (!original) return;
    
    const { id: _, created_at, updated_at, sort_order, ...rest } = original;
    const newProject = await addProject({
      ...rest,
      code: `${original.code}-copy`,
      name: `${original.name} (副本)`,
    });
    
    // Duplicate workstations and their layouts/modules
    const projectWorkstations = sortByEntityOrder(workstations.filter(ws => ws.project_id === id), 'code');
    for (let wsIndex = 0; wsIndex < projectWorkstations.length; wsIndex++) {
      const ws = projectWorkstations[wsIndex];
      const { id: wsId, created_at: wsCreated, updated_at: wsUpdated, sort_order: wsSortOrder, project_id, ...wsRest } = ws;
      const newWs = await addWorkstation({ ...wsRest, project_id: newProject.id, sort_order: wsIndex });
      
      await cloneWorkstationGraph(wsId, newWs.id);
    }
    
    toast.success('项目复制成功');
  };

  const reorderProjects = async (orderedIds: string[]) => {
    const previousProjects = projects;
    setProjects(prev => sortByEntityOrder(applySortOrder(prev, orderedIds), 'createdDesc'));

    try {
      const results = await Promise.all(
        orderedIds.map((id, index) => supabase.from('projects').update({ sort_order: index }).eq('id', id))
      );
      await assertNoSupabaseErrors(results);
    } catch (error) {
      setProjects(previousProjects);
      console.error('Failed to reorder projects:', error);
      toast.error('项目排序保存失败');
      throw error;
    }
  };

  // Workstation CRUD
  const addWorkstation = async (workstation: Omit<WorkstationInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('User not authenticated');
    const siblings = workstations.filter(ws => ws.project_id === workstation.project_id);
    const sort_order = workstation.sort_order ?? getNextSortOrder(siblings);
    const { data, error } = await supabase.from('workstations').insert({ ...workstation, sort_order, user_id: user.id }).select().single();
    if (error) throw error;
    setWorkstations(prev => sortByEntityOrder([...prev, data], 'code'));
    const { data: initializedAssets, error: assetsError } = await supabase
      .from('product_assets')
      .select('*')
      .eq('workstation_id', data.id)
      .eq('scope_type', 'workstation')
      .order('sort_order', { ascending: true });
    if (assetsError) throw assetsError;
    let createdAssets = initializedAssets || [];
    if (createdAssets.length === 0) {
      const dimensions = (workstation.product_dimensions || {}) as Record<string, unknown>;
      const { data: fallbackAsset, error: fallbackError } = await supabase
        .from('product_assets')
        .insert({
          user_id: user.id,
          scope_type: 'workstation',
          workstation_id: data.id,
          source_type: 'reference',
          product_name: '产品 1',
          sort_order: 0,
          is_primary: true,
          length_mm: Number(dimensions.length) || 100,
          width_mm: Number(dimensions.width) || 100,
          height_mm: Number(dimensions.height) || 50,
          pos_x: 0,
          pos_y: 0,
          pos_z: 0,
        })
        .select()
        .single();
      if (fallbackError) throw fallbackError;
      createdAssets = [fallbackAsset];
    }
    setProductAssets(prev => sortProductAssets([
      ...prev.filter(asset => asset.workstation_id !== data.id),
      ...createdAssets,
    ]));
    toast.success('工位创建成功');
    return data;
  };

  const cloneWorkstationGraph = async (sourceWorkstationId: string, targetWorkstationId: string) => {
    if (!user) throw new Error('User not authenticated');

    // New workstations receive an automatic default product. Remove it before cloning so
    // the copied workstation mirrors the source exactly, including an explicit zero state.
    const { error: clearDefaultError } = await supabase
      .from('product_assets')
      .delete()
      .eq('workstation_id', targetWorkstationId)
      .eq('scope_type', 'workstation');
    if (clearDefaultError) throw clearDefaultError;
    setProductAssets(current => current.filter(asset => asset.workstation_id !== targetWorkstationId));

    const moduleIdMap = new Map<string, string>();
    const sourceModules = sortByEntityOrder(
      modules.filter(module => module.workstation_id === sourceWorkstationId),
      'createdAsc',
    );
    for (let index = 0; index < sourceModules.length; index += 1) {
      const sourceModule = sourceModules[index];
      const {
        id: sourceModuleId,
        created_at,
        updated_at,
        sort_order,
        workstation_id,
        user_id,
        ...moduleFields
      } = sourceModule;
      const copiedModule = await addModule({
        ...moduleFields,
        workstation_id: targetWorkstationId,
        sort_order: index,
      });
      moduleIdMap.set(sourceModuleId, copiedModule.id);
    }

    const productIdMap = new Map<string, string>();
    const copiedAssets: DbProductAsset[] = [];
    const sourceWorkstationAssets = sortProductAssets(productAssets.filter(asset =>
      asset.scope_type === 'workstation' && asset.workstation_id === sourceWorkstationId
    ));

    for (const sourceAsset of sourceWorkstationAssets) {
      const {
        id: sourceAssetId,
        created_at,
        updated_at,
        user_id,
        workstation_id,
        module_id,
        parent_product_id,
        ...assetFields
      } = sourceAsset;
      const { data: copiedAsset, error } = await supabase
        .from('product_assets')
        .insert({
          ...assetFields,
          user_id: user.id,
          workstation_id: targetWorkstationId,
          module_id: null,
          parent_product_id: null,
        })
        .select()
        .single();
      if (error) throw error;
      productIdMap.set(sourceAssetId, copiedAsset.id);
      copiedAssets.push(copiedAsset);
    }

    const sourceModuleIds = new Set(sourceModules.map(module => module.id));
    const sourceModuleAssets = sortProductAssets(productAssets.filter(asset =>
      asset.scope_type === 'module' && !!asset.module_id && sourceModuleIds.has(asset.module_id)
    ));
    for (const sourceAsset of sourceModuleAssets) {
      const targetModuleId = sourceAsset.module_id ? moduleIdMap.get(sourceAsset.module_id) : undefined;
      if (!targetModuleId) continue;
      const {
        id: sourceAssetId,
        created_at,
        updated_at,
        user_id,
        workstation_id,
        module_id,
        parent_product_id,
        ...assetFields
      } = sourceAsset;
      const { data: copiedAsset, error } = await supabase
        .from('product_assets')
        .insert({
          ...assetFields,
          user_id: user.id,
          workstation_id: targetWorkstationId,
          module_id: targetModuleId,
          parent_product_id: parent_product_id ? productIdMap.get(parent_product_id) || null : null,
        })
        .select()
        .single();
      if (error) throw error;
      productIdMap.set(sourceAssetId, copiedAsset.id);
      copiedAssets.push(copiedAsset);
    }
    setProductAssets(current => sortProductAssets([...current, ...copiedAssets]));

    const sourceAssetIds = Array.from(productIdMap.keys());
    if (sourceAssetIds.length > 0) {
      const mediaIdMap = new Map<string, string>();
      const { data: sourceMedia, error: sourceMediaError } = await supabase
        .from('product_media')
        .select('*')
        .in('asset_id', sourceAssetIds)
        .order('sort_order', { ascending: true });
      if (sourceMediaError) throw sourceMediaError;
      for (const media of sourceMedia || []) {
        const targetAssetId = productIdMap.get(media.asset_id);
        if (!targetAssetId) continue;
        const {
          id: sourceMediaId,
          created_at,
          updated_at,
          user_id,
          asset_id,
          workstation_id,
          ...mediaFields
        } = media;
        const { data: copiedMedia, error: copiedMediaError } = await supabase
          .from('product_media')
          .insert({
            ...mediaFields,
            user_id: user.id,
            asset_id: targetAssetId,
            workstation_id: targetWorkstationId,
          })
          .select()
          .single();
        if (copiedMediaError) throw copiedMediaError;
        mediaIdMap.set(sourceMediaId, copiedMedia.id);
      }

      const { data: annotations, error: annotationsError } = await supabase
        .from('product_annotations')
        .select('*')
        .in('asset_id', sourceAssetIds);
      if (annotationsError) throw annotationsError;
      if (annotations?.length) {
        const annotationCopies = annotations
          .slice()
          .sort((left, right) => Number(right.is_ppt_default) - Number(left.is_ppt_default))
          .map(annotation => ({
          asset_id: productIdMap.get(annotation.asset_id)!,
          media_id: annotation.media_id ? mediaIdMap.get(annotation.media_id) || null : null,
          snapshot_url: annotation.snapshot_url,
          annotations_json: annotation.annotations_json,
          view_meta: annotation.view_meta,
          version: annotation.version,
          remark: annotation.remark,
          is_ppt_default: annotation.is_ppt_default,
          user_id: user.id,
          workstation_id: targetWorkstationId,
        }));
        const { error: copyAnnotationsError } = await supabase
          .from('product_annotations')
          .insert(annotationCopies);
        if (copyAnnotationsError) throw copyAnnotationsError;
      }
    }

    const sourceLayout = layouts.find(layout => layout.workstation_id === sourceWorkstationId);
    if (sourceLayout) {
      const {
        id,
        created_at,
        updated_at,
        workstation_id,
        user_id,
        layout_objects,
        ...layoutFields
      } = sourceLayout;
      const parsedObjects = typeof layout_objects === 'string'
        ? JSON.parse(layout_objects)
        : layout_objects;
      const rewrittenObjects = Array.isArray(parsedObjects)
        ? parsedObjects.flatMap((object: Record<string, unknown>) => {
            if (object.type !== 'product') return [object];
            const oldAssetId = typeof object.productAssetId === 'string' ? object.productAssetId : null;
            const newAssetId = oldAssetId ? productIdMap.get(oldAssetId) : undefined;
            if (!newAssetId) return [];
            return [{ ...object, id: `product-${newAssetId}`, productAssetId: newAssetId }];
          })
        : parsedObjects;
      await addLayout({
        ...layoutFields,
        layout_objects: rewrittenObjects,
        workstation_id: targetWorkstationId,
      });
    }
  };

  const updateWorkstation = async (id: string, updates: WorkstationUpdate, options?: MutationOptions) => {
    const { data, error } = await supabase.from('workstations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setWorkstations(prev => prev.map(w => w.id === id ? data : w));
    if (!options?.silent) {
      toast.success('工位更新成功');
    }
    return data;
  };

  const deleteWorkstation = async (id: string) => {
    const { error } = await supabase.from('workstations').delete().eq('id', id);
    if (error) throw error;
    setWorkstations(prev => prev.filter(w => w.id !== id));
    setLayouts(prev => prev.filter(l => l.workstation_id !== id));
    setModules(prev => prev.filter(m => m.workstation_id !== id));
    setProductAssets(prev => prev.filter(asset => asset.workstation_id !== id));
    await Promise.all([
      offlineCache.delete('workstations'),
      offlineCache.delete('layouts'),
      offlineCache.delete('modules'),
      offlineCache.delete('productAssets'),
    ]).catch(error => console.warn('Failed to invalidate workstation cache:', error));
    if (selectedWorkstationId === id) setSelectedWorkstationId(null);
    toast.success('工位删除成功');
  };

  const duplicateWorkstation = async (id: string) => {
    const original = workstations.find(w => w.id === id);
    if (!original) throw new Error('Workstation not found');
    
    const { id: _, created_at, updated_at, sort_order, ...rest } = original;
    const newWs = await addWorkstation({
      ...rest,
      code: `${original.code}-copy`,
      name: `${original.name} (副本)`,
    });
    
    await cloneWorkstationGraph(id, newWs.id);
    
    return newWs;
  };

  const reorderWorkstations = async (projectId: string, orderedIds: string[]) => {
    const validIds = orderedIds.filter(id => workstations.some(ws => ws.id === id && ws.project_id === projectId));
    if (validIds.length !== orderedIds.length) {
      throw new Error('只能调整同一项目下的工位顺序');
    }

    const previousWorkstations = workstations;
    setWorkstations(prev => sortByEntityOrder(applySortOrder(prev, validIds), 'code'));

    try {
      const results = await Promise.all(
        validIds.map((id, index) => supabase.from('workstations').update({ sort_order: index }).eq('id', id))
      );
      await assertNoSupabaseErrors(results);
    } catch (error) {
      setWorkstations(previousWorkstations);
      console.error('Failed to reorder workstations:', error);
      toast.error('工位排序保存失败');
      throw error;
    }
  };

  const moveWorkstation = async (id: string, targetProjectId: string, orderedIds: string[]) => {
    const original = workstations.find(ws => ws.id === id);
    if (!original) throw new Error('Workstation not found');
    if (original.project_id === targetProjectId) {
      return reorderWorkstations(targetProjectId, orderedIds);
    }

    const sourceProjectId = original.project_id;
    const sourceIds = sortByEntityOrder(
      workstations.filter(ws => ws.project_id === sourceProjectId && ws.id !== id),
      'code'
    ).map(ws => ws.id);
    const targetIdsWithoutSource = sortByEntityOrder(
      workstations.filter(ws => ws.project_id === targetProjectId && ws.id !== id),
      'code'
    ).map(ws => ws.id);

    const expectedTargetIds = [...targetIdsWithoutSource, id].sort().join('|');
    const actualTargetIds = [...new Set(orderedIds)].sort().join('|');
    if (expectedTargetIds !== actualTargetIds) {
      throw new Error('目标项目工位顺序无效');
    }

    const previousWorkstations = workstations;
    const sourceOrderMap = new Map(sourceIds.map((wsId, index) => [wsId, index]));
    const targetOrderMap = new Map(orderedIds.map((wsId, index) => [wsId, index]));

    setWorkstations(prev => sortByEntityOrder(prev.map(ws => {
      if (ws.id === id) {
        return {
          ...ws,
          project_id: targetProjectId,
          sort_order: targetOrderMap.get(id) ?? ws.sort_order ?? 0,
        };
      }
      if (ws.project_id === sourceProjectId) {
        const sortOrder = sourceOrderMap.get(ws.id);
        return sortOrder === undefined ? ws : { ...ws, sort_order: sortOrder };
      }
      if (ws.project_id === targetProjectId) {
        const sortOrder = targetOrderMap.get(ws.id);
        return sortOrder === undefined ? ws : { ...ws, sort_order: sortOrder };
      }
      return ws;
    }), 'code'));

    try {
      const movedResult = await supabase
        .from('workstations')
        .update({
          project_id: targetProjectId,
          sort_order: targetOrderMap.get(id) ?? orderedIds.length - 1,
        })
        .eq('id', id);

      const [sourceResults, targetResults] = await Promise.all([
        Promise.all(
          sourceIds.map((wsId, index) =>
            supabase.from('workstations').update({ sort_order: index }).eq('id', wsId)
          )
        ),
        Promise.all(
          orderedIds
            .filter(wsId => wsId !== id)
            .map((wsId, index) =>
              supabase.from('workstations').update({ sort_order: targetOrderMap.get(wsId) ?? index }).eq('id', wsId)
            )
        ),
      ]);

      await assertNoSupabaseErrors([movedResult, ...sourceResults, ...targetResults]);
    } catch (error) {
      setWorkstations(previousWorkstations);
      console.error('Failed to move workstation:', error);
      toast.error('工位移动保存失败');
      throw error;
    }
  };

  // Layout CRUD
  const getLayoutByWorkstation = useCallback((workstationId: string) => {
    return layouts.find(l => l.workstation_id === workstationId);
  }, [layouts]);

  const addLayout = async (layout: Omit<LayoutInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('User not authenticated');
    const { data, error } = await supabase.from('mechanical_layouts').insert({ ...layout, user_id: user.id }).select().single();
    if (error) throw error;
    setLayouts(prev => [...prev, data]);
    return data;
  };

  const updateLayout = async (id: string, updates: LayoutUpdate) => {
    const { data, error } = await supabase.from('mechanical_layouts').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setLayouts(prev => prev.map(l => l.id === id ? data : l));
    return data;
  };

  const upsertLayout = async (workstationId: string, layoutData: Omit<LayoutInsert, 'id' | 'created_at' | 'updated_at' | 'workstation_id' | 'user_id'>) => {
    const existing = layouts.find(l => l.workstation_id === workstationId);
    if (existing) {
      return updateLayout(existing.id, layoutData);
    } else {
      return addLayout({ ...layoutData, workstation_id: workstationId });
    }
  };

  // Module CRUD
  const addModule = async (module: Omit<ModuleInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('User not authenticated');
    const siblings = modules.filter(m => m.workstation_id === module.workstation_id);
    const sort_order = module.sort_order ?? getNextSortOrder(siblings);
    const { data, error } = await supabase.from('function_modules').insert({ ...module, sort_order, user_id: user.id }).select().single();
    if (error) throw error;
    setModules(prev => sortByEntityOrder([...prev, data], 'createdAsc'));
    toast.success('模块创建成功');
    return data;
  };

  const updateModule = async (id: string, updates: ModuleUpdate & { measurement_config?: any; schematic_image_url?: string | null }) => {
    const { data, error } = await supabase.from('function_modules').update(updates as ModuleUpdate).eq('id', id).select().single();
    if (error) throw error;
    setModules(prev => prev.map(m => m.id === id ? data : m));
    return data;
  };

  const deleteModule = async (id: string) => {
    const { error } = await supabase.from('function_modules').delete().eq('id', id);
    if (error) throw error;
    setModules(prev => prev.filter(m => m.id !== id));
    if (selectedModuleId === id) setSelectedModuleId(null);
    toast.success('模块删除成功');
  };

  const duplicateModule = async (id: string) => {
    const original = modules.find(m => m.id === id);
    if (!original) throw new Error('Module not found');
    
    const { id: _, created_at, updated_at, sort_order, ...rest } = original;
    return addModule({
      ...rest,
      name: `${original.name} (副本)`,
    });
  };

  const reorderModules = async (workstationId: string, orderedIds: string[]) => {
    const validIds = orderedIds.filter(id => modules.some(m => m.id === id && m.workstation_id === workstationId));
    if (validIds.length !== orderedIds.length) {
      throw new Error('只能调整同一工位下的模块顺序');
    }

    const previousModules = modules;
    setModules(prev => sortByEntityOrder(applySortOrder(prev, validIds), 'createdAsc'));

    try {
      const results = await Promise.all(
        validIds.map((id, index) => supabase.from('function_modules').update({ sort_order: index }).eq('id', id))
      );
      await assertNoSupabaseErrors(results);
    } catch (error) {
      setModules(previousModules);
      console.error('Failed to reorder modules:', error);
      toast.error('模块排序保存失败');
      throw error;
    }
  };

  const moveModule = async (id: string, targetWorkstationId: string, orderedIds: string[]) => {
    const original = modules.find(mod => mod.id === id);
    if (!original) throw new Error('Module not found');
    if (original.workstation_id === targetWorkstationId) {
      return reorderModules(targetWorkstationId, orderedIds);
    }

    const sourceWorkstationId = original.workstation_id;
    const sourceIds = sortByEntityOrder(
      modules.filter(mod => mod.workstation_id === sourceWorkstationId && mod.id !== id),
      'createdAsc'
    ).map(mod => mod.id);
    const targetIdsWithoutSource = sortByEntityOrder(
      modules.filter(mod => mod.workstation_id === targetWorkstationId && mod.id !== id),
      'createdAsc'
    ).map(mod => mod.id);

    const expectedTargetIds = [...targetIdsWithoutSource, id].sort().join('|');
    const actualTargetIds = [...new Set(orderedIds)].sort().join('|');
    if (expectedTargetIds !== actualTargetIds) {
      throw new Error('目标工位模块顺序无效');
    }

    const previousModules = modules;
    const sourceOrderMap = new Map(sourceIds.map((modId, index) => [modId, index]));
    const targetOrderMap = new Map(orderedIds.map((modId, index) => [modId, index]));

    setModules(prev => sortByEntityOrder(prev.map(mod => {
      if (mod.id === id) {
        return {
          ...mod,
          workstation_id: targetWorkstationId,
          sort_order: targetOrderMap.get(id) ?? mod.sort_order ?? 0,
        };
      }
      if (mod.workstation_id === sourceWorkstationId) {
        const sortOrder = sourceOrderMap.get(mod.id);
        return sortOrder === undefined ? mod : { ...mod, sort_order: sortOrder };
      }
      if (mod.workstation_id === targetWorkstationId) {
        const sortOrder = targetOrderMap.get(mod.id);
        return sortOrder === undefined ? mod : { ...mod, sort_order: sortOrder };
      }
      return mod;
    }), 'createdAsc'));

    try {
      const movedResult = await supabase
        .from('function_modules')
        .update({
          workstation_id: targetWorkstationId,
          sort_order: targetOrderMap.get(id) ?? orderedIds.length - 1,
        })
        .eq('id', id);

      const [sourceResults, targetResults] = await Promise.all([
        Promise.all(
          sourceIds.map((modId, index) =>
            supabase.from('function_modules').update({ sort_order: index }).eq('id', modId)
          )
        ),
        Promise.all(
          orderedIds
            .filter(modId => modId !== id)
            .map((modId, index) =>
              supabase.from('function_modules').update({ sort_order: targetOrderMap.get(modId) ?? index }).eq('id', modId)
            )
        ),
      ]);

      await assertNoSupabaseErrors([movedResult, ...sourceResults, ...targetResults]);
    } catch (error) {
      setModules(previousModules);
      console.error('Failed to move module:', error);
      toast.error('模块移动保存失败');
      throw error;
    }
  };

  // Product asset CRUD
  const addProductAsset = async (
    asset: Omit<ProductAssetInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>,
  ) => {
    if (!user) throw new Error('User not authenticated');
    const { data, error } = await supabase
      .from('product_assets')
      .insert({ ...asset, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    const nextAssets = sortProductAssets([...productAssetsRef.current, data]);
    productAssetsRef.current = nextAssets;
    setProductAssets(nextAssets);
    return data;
  };

  const updateProductAsset = async (
    id: string,
    updates: ProductAssetUpdate,
    options?: MutationOptions,
  ) => {
    const previousTarget = productAssetsRef.current.find(asset => asset.id === id);
    if (!previousTarget) throw new Error('产品已删除，已忽略过期更新');
    const mutationVersion = (productAssetMutationVersionRef.current[id] ?? 0) + 1;
    productAssetMutationVersionRef.current[id] = mutationVersion;
    const optimisticAssets = sortProductAssets(productAssetsRef.current.map(asset =>
      asset.id === id ? { ...asset, ...updates } : asset
    ));
    productAssetsRef.current = optimisticAssets;
    setProductAssets(optimisticAssets);
    const { data, error } = await supabase
      .from('product_assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (productAssetMutationVersionRef.current[id] === mutationVersion
        && productAssetsRef.current.some(asset => asset.id === id)) {
        const rolledBackAssets = sortProductAssets(productAssetsRef.current.map(asset =>
          asset.id === id ? previousTarget : asset
        ));
        productAssetsRef.current = rolledBackAssets;
        setProductAssets(rolledBackAssets);
      }
      throw error;
    }
    if (productAssetMutationVersionRef.current[id] === mutationVersion
      && productAssetsRef.current.some(asset => asset.id === id)) {
      const confirmedAssets = sortProductAssets(productAssetsRef.current.map(asset => asset.id === id ? data : asset));
      productAssetsRef.current = confirmedAssets;
      setProductAssets(confirmedAssets);
    }
    if (!options?.silent) toast.success('产品已更新');
    return data;
  };

  const deleteProductAsset = async (id: string) => {
    const target = productAssetsRef.current.find(asset => asset.id === id);
    if (!target) return;
    productAssetMutationVersionRef.current[id] = (productAssetMutationVersionRef.current[id] ?? 0) + 1;
    const remaining = productAssetsRef.current.filter(asset => asset.id !== id);
    productAssetsRef.current = remaining;
    setProductAssets(remaining);
    let deletedOnServer = false;
    try {
      const { error } = await supabase.from('product_assets').delete().eq('id', id);
      if (error) throw error;
      deletedOnServer = true;
      if (target.scope_type === 'workstation' && target.is_primary) {
        const replacement = sortProductAssets(remaining.filter(asset =>
          asset.scope_type === 'workstation' && asset.workstation_id === target.workstation_id
        ))[0];
        if (replacement) {
          const { data, error: promoteError } = await supabase
            .from('product_assets')
            .update({ is_primary: true })
            .eq('id', replacement.id)
            .select()
            .single();
          if (promoteError) throw promoteError;
          const promotedAssets = sortProductAssets(productAssetsRef.current.map(asset =>
            asset.id === replacement.id ? data : asset
          ));
          productAssetsRef.current = promotedAssets;
          setProductAssets(promotedAssets);
        }
      }
    } catch (error) {
      if (!deletedOnServer) {
        if (!productAssetsRef.current.some(asset => asset.id === id)) {
          const restoredAssets = sortProductAssets([...productAssetsRef.current, target]);
          productAssetsRef.current = restoredAssets;
          setProductAssets(restoredAssets);
        }
      } else {
        const { data: refreshedAssets, error: refreshError } = await supabase
          .from('product_assets')
          .select('*');
        if (!refreshError && refreshedAssets) {
          const nextAssets = sortProductAssets(refreshedAssets);
          productAssetsRef.current = nextAssets;
          setProductAssets(nextAssets);
        }
      }
      throw error;
    }
  };

  const setPrimaryProductAsset = async (workstationId: string, id: string) => {
    const previous = productAssets;
    setProductAssets(current => sortProductAssets(current.map(asset =>
      asset.scope_type === 'workstation' && asset.workstation_id === workstationId
        ? { ...asset, is_primary: asset.id === id }
        : asset
    )));
    try {
      const { error: clearError } = await supabase
        .from('product_assets')
        .update({ is_primary: false })
        .eq('workstation_id', workstationId)
        .eq('scope_type', 'workstation')
        .neq('id', id);
      if (clearError) throw clearError;
      const { error } = await supabase.from('product_assets').update({ is_primary: true }).eq('id', id);
      if (error) throw error;
    } catch (error) {
      setProductAssets(previous);
      throw error;
    }
  };

  const reorderProductAssets = async (workstationId: string, orderedIds: string[]) => {
    const previous = productAssets;
    const validIds = orderedIds.filter(id => productAssets.some(asset =>
      asset.id === id && asset.scope_type === 'workstation' && asset.workstation_id === workstationId
    ));
    if (validIds.length !== orderedIds.length) throw new Error('只能调整同一工位下的产品顺序');
    setProductAssets(current => sortProductAssets(applySortOrder(current, validIds)));
    try {
      const results = await Promise.all(validIds.map((id, index) =>
        supabase.from('product_assets').update({ sort_order: index }).eq('id', id)
      ));
      await assertNoSupabaseErrors(results);
    } catch (error) {
      setProductAssets(previous);
      throw error;
    }
  };

  // Helpers
  const getProjectWorkstations = useCallback((projectId: string) => {
    const filtered = workstations.filter(ws => ws.project_id === projectId);
    return sortByEntityOrder(filtered, 'code');
  }, [workstations]);

  const getWorkstationModules = useCallback((workstationId: string) => {
    return sortByEntityOrder(modules.filter(m => m.workstation_id === workstationId), 'createdAsc');
  }, [modules]);

  const getWorkstationProductAssets = useCallback((workstationId: string) => (
    sortProductAssets(productAssets.filter(asset =>
      asset.scope_type === 'workstation' && asset.workstation_id === workstationId
    ))
  ), [productAssets]);

  const getModuleProductAssets = useCallback((moduleId: string) => (
    sortProductAssets(productAssets.filter(asset =>
      asset.scope_type === 'module' && asset.module_id === moduleId
    ))
  ), [productAssets]);

  return (
    <DataContext.Provider value={{
      projects,
      workstations,
      layouts,
      modules,
      productAssets,
      loading,
      selectedProjectId,
      selectedWorkstationId,
      selectedModuleId,
      selectProject,
      selectWorkstation,
      selectModule,
      addProject,
      updateProject,
      deleteProject,
      duplicateProject,
      reorderProjects,
      addWorkstation,
      updateWorkstation,
      deleteWorkstation,
      duplicateWorkstation,
      reorderWorkstations,
      moveWorkstation,
      getLayoutByWorkstation,
      addLayout,
      updateLayout,
      upsertLayout,
      addModule,
      updateModule,
      deleteModule,
      duplicateModule,
      reorderModules,
      moveModule,
      addProductAsset,
      updateProductAsset,
      deleteProductAsset,
      setPrimaryProductAsset,
      reorderProductAssets,
      getProjectWorkstations,
      getWorkstationModules,
      getWorkstationProductAssets,
      getModuleProductAssets,
      refetch: fetchAll,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
