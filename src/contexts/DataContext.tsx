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

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type WorkstationInsert = Database['public']['Tables']['workstations']['Insert'];
type LayoutInsert = Database['public']['Tables']['mechanical_layouts']['Insert'];
type ModuleInsert = Database['public']['Tables']['function_modules']['Insert'];

type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
type WorkstationUpdate = Database['public']['Tables']['workstations']['Update'];
type LayoutUpdate = Database['public']['Tables']['mechanical_layouts']['Update'];
type ModuleUpdate = Database['public']['Tables']['function_modules']['Update'];

interface MutationOptions {
  silent?: boolean;
}

interface DataContextType {
  // Data
  projects: DbProject[];
  workstations: DbWorkstation[];
  layouts: DbLayout[];
  modules: DbModule[];
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
  
  // Helpers
  getProjectWorkstations: (projectId: string) => DbWorkstation[];
  getWorkstationModules: (workstationId: string) => DbModule[];
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
      const [cachedProjects, cachedWorkstations, cachedLayouts, cachedModules] = await Promise.all([
        offlineCache.get<DbProject[]>('projects'),
        offlineCache.get<DbWorkstation[]>('workstations'),
        offlineCache.get<DbLayout[]>('layouts'),
        offlineCache.get<DbModule[]>('modules'),
      ]);

      if (cachedProjects) setProjects(sortByEntityOrder(cachedProjects, 'createdDesc'));
      if (cachedWorkstations) setWorkstations(sortByEntityOrder(cachedWorkstations, 'code'));
      if (cachedLayouts) setLayouts(cachedLayouts);
      if (cachedModules) setModules(sortByEntityOrder(cachedModules, 'createdAsc'));
      
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
      
      const [projectsRes, workstationsRes, layoutsRes, modulesRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('workstations').select('*').order('created_at', { ascending: true }),
        supabase.from('mechanical_layouts').select('*'),
        supabase.from('function_modules').select('*').order('created_at', { ascending: true }),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (workstationsRes.error) throw workstationsRes.error;
      if (layoutsRes.error) throw layoutsRes.error;
      if (modulesRes.error) throw modulesRes.error;

      const projectsData = sortByEntityOrder(projectsRes.data || [], 'createdDesc');
      const workstationsData = sortByEntityOrder(workstationsRes.data || [], 'code');
      const layoutsData = layoutsRes.data || [];
      const modulesData = sortByEntityOrder(modulesRes.data || [], 'createdAsc');

      setProjects(projectsData);
      setWorkstations(workstationsData);
      setLayouts(layoutsData);
      setModules(modulesData);

      // Update cache in background
      Promise.all([
        offlineCache.set('projects', projectsData, CACHE_TTL),
        offlineCache.set('workstations', workstationsData, CACHE_TTL),
        offlineCache.set('layouts', layoutsData, CACHE_TTL),
        offlineCache.set('modules', modulesData, CACHE_TTL),
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
      
      // Duplicate layout
      const layout = layouts.find(l => l.workstation_id === wsId);
      if (layout) {
        const { id: layoutId, created_at: lCreated, updated_at: lUpdated, workstation_id, ...layoutRest } = layout;
        await addLayout({ ...layoutRest, workstation_id: newWs.id });
      }
      
      // Duplicate modules
      const wsModules = sortByEntityOrder(modules.filter(m => m.workstation_id === wsId), 'createdAsc');
      for (let modIndex = 0; modIndex < wsModules.length; modIndex++) {
        const mod = wsModules[modIndex];
        const { id: modId, created_at: mCreated, updated_at: mUpdated, sort_order: modSortOrder, workstation_id: modWsId, ...modRest } = mod;
        await addModule({ ...modRest, workstation_id: newWs.id, sort_order: modIndex });
      }
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
    toast.success('工位创建成功');
    return data;
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
    
    // Duplicate layout
    const layout = layouts.find(l => l.workstation_id === id);
    if (layout) {
      const { id: layoutId, created_at: lCreated, updated_at: lUpdated, workstation_id, ...layoutRest } = layout;
      await addLayout({ ...layoutRest, workstation_id: newWs.id });
    }
    
    // Duplicate modules
    const wsModules = sortByEntityOrder(modules.filter(m => m.workstation_id === id), 'createdAsc');
    for (let modIndex = 0; modIndex < wsModules.length; modIndex++) {
      const mod = wsModules[modIndex];
      const { id: modId, created_at: mCreated, updated_at: mUpdated, sort_order: modSortOrder, workstation_id: modWsId, ...modRest } = mod;
      await addModule({ ...modRest, workstation_id: newWs.id, sort_order: modIndex });
    }
    
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

  // Helpers
  const getProjectWorkstations = useCallback((projectId: string) => {
    const filtered = workstations.filter(ws => ws.project_id === projectId);
    return sortByEntityOrder(filtered, 'code');
  }, [workstations]);

  const getWorkstationModules = useCallback((workstationId: string) => {
    return sortByEntityOrder(modules.filter(m => m.workstation_id === workstationId), 'createdAsc');
  }, [modules]);

  return (
    <DataContext.Provider value={{
      projects,
      workstations,
      layouts,
      modules,
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
      getProjectWorkstations,
      getWorkstationModules,
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
