import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCache } from '@/services/offlineCache';

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
  
  // Workstation CRUD
  addWorkstation: (workstation: Omit<WorkstationInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbWorkstation>;
  updateWorkstation: (id: string, updates: WorkstationUpdate) => Promise<DbWorkstation>;
  deleteWorkstation: (id: string) => Promise<void>;
  duplicateWorkstation: (id: string) => Promise<DbWorkstation>;
  
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
  
  // Helpers
  getProjectWorkstations: (projectId: string) => DbWorkstation[];
  getWorkstationModules: (workstationId: string) => DbModule[];
  refetch: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [workstations, setWorkstations] = useState<DbWorkstation[]>([]);
  const [layouts, setLayouts] = useState<DbLayout[]>([]);
  const [modules, setModules] = useState<DbModule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // Claim orphan projects (projects with null user_id) for the current user
  const claimOrphanProjects = useCallback(async () => {
    if (!user) return;
    try {
      // Update projects with null user_id to be owned by current user
      await supabase
        .from('projects')
        .update({ user_id: user.id })
        .is('user_id', null);
    } catch (err) {
      console.error('Failed to claim orphan projects:', err);
    }
  }, [user]);

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

      if (cachedProjects) setProjects(cachedProjects);
      if (cachedWorkstations) setWorkstations(cachedWorkstations);
      if (cachedLayouts) setLayouts(cachedLayouts);
      if (cachedModules) setModules(cachedModules);
      
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
      
      // First claim any orphan projects
      await claimOrphanProjects();
      
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

      const projectsData = projectsRes.data || [];
      const workstationsData = workstationsRes.data || [];
      const layoutsData = layoutsRes.data || [];
      const modulesData = modulesRes.data || [];

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
  }, [user, claimOrphanProjects]);

  // Load from cache first, then fetch fresh data
  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, user]);

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
    const { data, error } = await supabase.from('projects').insert({ ...project, user_id: user.id }).select().single();
    if (error) throw error;
    setProjects(prev => [data, ...prev]);
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
    
    const { id: _, created_at, updated_at, ...rest } = original;
    const newProject = await addProject({
      ...rest,
      code: `${original.code}-copy`,
      name: `${original.name} (副本)`,
    });
    
    // Duplicate workstations and their layouts/modules
    const projectWorkstations = workstations.filter(ws => ws.project_id === id);
    for (const ws of projectWorkstations) {
      const { id: wsId, created_at: wsCreated, updated_at: wsUpdated, project_id, ...wsRest } = ws;
      const newWs = await addWorkstation({ ...wsRest, project_id: newProject.id });
      
      // Duplicate layout
      const layout = layouts.find(l => l.workstation_id === wsId);
      if (layout) {
        const { id: layoutId, created_at: lCreated, updated_at: lUpdated, workstation_id, ...layoutRest } = layout;
        await addLayout({ ...layoutRest, workstation_id: newWs.id });
      }
      
      // Duplicate modules
      const wsModules = modules.filter(m => m.workstation_id === wsId);
      for (const mod of wsModules) {
        const { id: modId, created_at: mCreated, updated_at: mUpdated, workstation_id: modWsId, ...modRest } = mod;
        await addModule({ ...modRest, workstation_id: newWs.id });
      }
    }
    
    toast.success('项目复制成功');
  };

  // Workstation CRUD
  const addWorkstation = async (workstation: Omit<WorkstationInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) throw new Error('User not authenticated');
    const { data, error } = await supabase.from('workstations').insert({ ...workstation, user_id: user.id }).select().single();
    if (error) throw error;
    setWorkstations(prev => [...prev, data]);
    toast.success('工位创建成功');
    return data;
  };

  const updateWorkstation = async (id: string, updates: WorkstationUpdate) => {
    const { data, error } = await supabase.from('workstations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setWorkstations(prev => prev.map(w => w.id === id ? data : w));
    toast.success('工位更新成功');
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
    
    const { id: _, created_at, updated_at, ...rest } = original;
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
    const wsModules = modules.filter(m => m.workstation_id === id);
    for (const mod of wsModules) {
      const { id: modId, created_at: mCreated, updated_at: mUpdated, workstation_id: modWsId, ...modRest } = mod;
      await addModule({ ...modRest, workstation_id: newWs.id });
    }
    
    return newWs;
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
    const { data, error } = await supabase.from('function_modules').insert({ ...module, user_id: user.id }).select().single();
    if (error) throw error;
    setModules(prev => [...prev, data]);
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
    
    const { id: _, created_at, updated_at, ...rest } = original;
    return addModule({
      ...rest,
      name: `${original.name} (副本)`,
    });
  };

  // Helpers
  const getProjectWorkstations = useCallback((projectId: string) => {
    return workstations.filter(ws => ws.project_id === projectId);
  }, [workstations]);

  const getWorkstationModules = useCallback((workstationId: string) => {
    return modules.filter(m => m.workstation_id === workstationId);
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
      addWorkstation,
      updateWorkstation,
      deleteWorkstation,
      duplicateWorkstation,
      getLayoutByWorkstation,
      addLayout,
      updateLayout,
      upsertLayout,
      addModule,
      updateModule,
      deleteModule,
      duplicateModule,
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
