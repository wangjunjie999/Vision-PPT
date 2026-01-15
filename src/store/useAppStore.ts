import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  AppState, 
  Project, 
  Workstation, 
  MechanicalLayout, 
  FunctionModule,
  Camera,
  Lens,
  LightSource,
  Controller,
  PPTTemplate,
  ViewType,
  UserRole
} from '@/types';

// Note: All sample data has been removed.
// - Projects, workstations, layouts, modules are loaded from database via DataContext
// - Hardware (cameras, lenses, lights, controllers) are loaded via HardwareContext
// - PPT Templates are loaded via usePPTTemplates hook
// The store now starts with empty arrays and data is populated from the database.

interface Store {
  // App state
  currentRole: UserRole;
  selectedProjectId: string | null;
  selectedWorkstationId: string | null;
  selectedModuleId: string | null;
  currentView: ViewType;
  isGeneratingPPT: boolean;
  pptProgress: number;
  pptImageQuality: 'standard' | 'high' | 'ultra';
  
  // Quality mapping helper
  getPixelRatio: () => number;
  
  // Data
  projects: Project[];
  workstations: Workstation[];
  layouts: MechanicalLayout[];
  modules: FunctionModule[];
  cameras: Camera[];
  lenses: Lens[];
  lights: LightSource[];
  controllers: Controller[];
  templates: PPTTemplate[];
  
  // Actions
  setCurrentRole: (role: UserRole) => void;
  selectProject: (id: string | null) => void;
  selectWorkstation: (id: string | null) => void;
  selectModule: (id: string | null) => void;
  setCurrentView: (view: ViewType) => void;
  setPPTImageQuality: (quality: 'standard' | 'high' | 'ultra') => void;
  
  // Project CRUD
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  
  // Workstation CRUD
  addWorkstation: (workstation: Omit<Workstation, 'id' | 'createdAt' | 'updatedAt'>) => Workstation;
  updateWorkstation: (id: string, updates: Partial<Workstation>) => void;
  deleteWorkstation: (id: string) => void;
  duplicateWorkstation: (id: string) => Workstation;
  
  // Layout CRUD
  addLayout: (layout: Omit<MechanicalLayout, 'id'>) => MechanicalLayout;
  updateLayout: (id: string, updates: Partial<MechanicalLayout>) => void;
  getLayoutByWorkstation: (workstationId: string) => MechanicalLayout | undefined;
  
  // Module CRUD
  addModule: (module: Omit<FunctionModule, 'id' | 'createdAt' | 'updatedAt'>) => FunctionModule;
  updateModule: (id: string, updates: Partial<FunctionModule>) => void;
  deleteModule: (id: string) => void;
  duplicateModule: (id: string) => FunctionModule;
  
  // Hardware CRUD (admin only)
  addCamera: (camera: Omit<Camera, 'id'>) => void;
  updateCamera: (id: string, updates: Partial<Camera>) => void;
  deleteCamera: (id: string) => void;
  
  addLens: (lens: Omit<Lens, 'id'>) => void;
  updateLens: (id: string, updates: Partial<Lens>) => void;
  deleteLens: (id: string) => void;
  
  addLight: (light: Omit<LightSource, 'id'>) => void;
  updateLight: (id: string, updates: Partial<LightSource>) => void;
  deleteLight: (id: string) => void;
  
  addController: (controller: Omit<Controller, 'id'>) => void;
  updateController: (id: string, updates: Partial<Controller>) => void;
  deleteController: (id: string) => void;
  
  // Template CRUD (admin only)
  addTemplate: (template: Omit<PPTTemplate, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: string, updates: Partial<PPTTemplate>) => void;
  deleteTemplate: (id: string) => void;
  setDefaultTemplate: (id: string) => void;
  
  // PPT Generation
  startPPTGeneration: () => void;
  updatePPTProgress: (progress: number) => void;
  finishPPTGeneration: () => void;
  canGeneratePPT: () => { canGenerate: boolean; missingItems: string[] };
  
  // Helpers
  getProjectWorkstations: (projectId: string) => Workstation[];
  getWorkstationModules: (workstationId: string) => FunctionModule[];
  getProjectStats: (projectId: string) => {
    workstationCount: number;
    moduleCount: number;
    layoutsComplete: number;
    flowchartsComplete: number;
  };
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      // Initial state
      currentRole: 'user',
      selectedProjectId: null,
      selectedWorkstationId: null,
      selectedModuleId: null,
      currentView: 'front',
      isGeneratingPPT: false,
      pptProgress: 0,
      pptImageQuality: 'high',
      
      // Quality mapping helper
      getPixelRatio: () => {
        const quality = get().pptImageQuality;
        switch (quality) {
          case 'standard': return 1.5;
          case 'high': return 2;
          case 'ultra': return 3;
          default: return 2;
        }
      },
      
      // Initial data - empty arrays since data is loaded from database
      // Projects, workstations, layouts, modules loaded via DataContext
      // Hardware loaded via HardwareContext
      // Templates loaded via usePPTTemplates hook
      projects: [],
      workstations: [],
      layouts: [],
      modules: [],
      cameras: [],
      lenses: [],
      lights: [],
      controllers: [],
      templates: [],
      
      // Actions
      setCurrentRole: (role) => set({ currentRole: role }),
      
      selectProject: (id) => set({ 
        selectedProjectId: id, 
        selectedWorkstationId: null, 
        selectedModuleId: null 
      }),
      
      selectWorkstation: (id) => set({ 
        selectedWorkstationId: id, 
        selectedModuleId: null,
        currentView: 'front'
      }),
      
      selectModule: (id) => set({ selectedModuleId: id }),
      
      setCurrentView: (view) => set({ currentView: view }),
      
      setPPTImageQuality: (quality) => set({ pptImageQuality: quality }),
      
      // Project CRUD
      addProject: (project) => {
        const newProject: Project = {
          ...project,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ projects: [...state.projects, newProject] }));
        return newProject;
      },
      
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ),
      })),
      
      deleteProject: (id) => set((state) => {
        const wsIds = state.workstations.filter(ws => ws.projectId === id).map(ws => ws.id);
        return {
          projects: state.projects.filter((p) => p.id !== id),
          workstations: state.workstations.filter((ws) => ws.projectId !== id),
          layouts: state.layouts.filter((l) => !wsIds.includes(l.workstationId)),
          modules: state.modules.filter((m) => !wsIds.includes(m.workstationId)),
          selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
        };
      }),
      
      duplicateProject: (id) => {
        const state = get();
        const project = state.projects.find(p => p.id === id);
        if (!project) return;
        
        const newProjectId = generateId();
        const newProject: Project = {
          ...project,
          id: newProjectId,
          code: `${project.code}-COPY`,
          name: `${project.name} (副本)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // Duplicate workstations, layouts, and modules
        const wsMap = new Map<string, string>();
        const newWorkstations = state.workstations
          .filter(ws => ws.projectId === id)
          .map(ws => {
            const newWsId = generateId();
            wsMap.set(ws.id, newWsId);
            return { ...ws, id: newWsId, projectId: newProjectId };
          });
        
        const newLayouts = state.layouts
          .filter(l => wsMap.has(l.workstationId))
          .map(l => ({
            ...l,
            id: generateId(),
            workstationId: wsMap.get(l.workstationId)!,
          }));
        
        const newModules = state.modules
          .filter(m => wsMap.has(m.workstationId))
          .map(m => ({
            ...m,
            id: generateId(),
            workstationId: wsMap.get(m.workstationId)!,
          }));
        
        set({
          projects: [...state.projects, newProject],
          workstations: [...state.workstations, ...newWorkstations],
          layouts: [...state.layouts, ...newLayouts],
          modules: [...state.modules, ...newModules],
        });
      },
      
      // Workstation CRUD
      addWorkstation: (workstation) => {
        const newWorkstation: Workstation = {
          ...workstation,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ workstations: [...state.workstations, newWorkstation] }));
        return newWorkstation;
      },
      
      updateWorkstation: (id, updates) => set((state) => ({
        workstations: state.workstations.map((ws) =>
          ws.id === id ? { ...ws, ...updates, updatedAt: new Date().toISOString() } : ws
        ),
      })),
      
      deleteWorkstation: (id) => set((state) => ({
        workstations: state.workstations.filter((ws) => ws.id !== id),
        layouts: state.layouts.filter((l) => l.workstationId !== id),
        modules: state.modules.filter((m) => m.workstationId !== id),
        selectedWorkstationId: state.selectedWorkstationId === id ? null : state.selectedWorkstationId,
      })),
      
      duplicateWorkstation: (id) => {
        const state = get();
        const ws = state.workstations.find(w => w.id === id);
        if (!ws) throw new Error('Workstation not found');
        
        const newWsId = generateId();
        const newWorkstation: Workstation = {
          ...ws,
          id: newWsId,
          code: `${ws.code}-COPY`,
          name: `${ws.name} (副本)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        const layout = state.layouts.find(l => l.workstationId === id);
        const newLayout = layout ? {
          ...layout,
          id: generateId(),
          workstationId: newWsId,
        } : null;
        
        const newModules = state.modules
          .filter(m => m.workstationId === id)
          .map(m => ({
            ...m,
            id: generateId(),
            workstationId: newWsId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
        
        set({
          workstations: [...state.workstations, newWorkstation],
          layouts: newLayout ? [...state.layouts, newLayout] : state.layouts,
          modules: [...state.modules, ...newModules],
        });
        
        return newWorkstation;
      },
      
      // Layout CRUD
      addLayout: (layout) => {
        const newLayout: MechanicalLayout = {
          ...layout,
          id: generateId(),
        };
        set((state) => ({ layouts: [...state.layouts, newLayout] }));
        return newLayout;
      },
      
      updateLayout: (id, updates) => set((state) => ({
        layouts: state.layouts.map((l) =>
          l.id === id ? { ...l, ...updates } : l
        ),
      })),
      
      getLayoutByWorkstation: (workstationId) => {
        return get().layouts.find(l => l.workstationId === workstationId);
      },
      
      // Module CRUD
      addModule: (module) => {
        const newModule: FunctionModule = {
          ...module,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ modules: [...state.modules, newModule] }));
        return newModule;
      },
      
      updateModule: (id, updates) => set((state) => ({
        modules: state.modules.map((m) =>
          m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
        ),
      })),
      
      deleteModule: (id) => set((state) => ({
        modules: state.modules.filter((m) => m.id !== id),
        selectedModuleId: state.selectedModuleId === id ? null : state.selectedModuleId,
      })),
      
      duplicateModule: (id) => {
        const state = get();
        const mod = state.modules.find(m => m.id === id);
        if (!mod) throw new Error('Module not found');
        
        const newModule: FunctionModule = {
          ...mod,
          id: generateId(),
          name: `${mod.name} (副本)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        set({ modules: [...state.modules, newModule] });
        return newModule;
      },
      
      // Hardware CRUD
      addCamera: (camera) => set((state) => ({
        cameras: [...state.cameras, { ...camera, id: generateId() }],
      })),
      updateCamera: (id, updates) => set((state) => ({
        cameras: state.cameras.map((c) => c.id === id ? { ...c, ...updates } : c),
      })),
      deleteCamera: (id) => set((state) => ({
        cameras: state.cameras.filter((c) => c.id !== id),
      })),
      
      addLens: (lens) => set((state) => ({
        lenses: [...state.lenses, { ...lens, id: generateId() }],
      })),
      updateLens: (id, updates) => set((state) => ({
        lenses: state.lenses.map((l) => l.id === id ? { ...l, ...updates } : l),
      })),
      deleteLens: (id) => set((state) => ({
        lenses: state.lenses.filter((l) => l.id !== id),
      })),
      
      addLight: (light) => set((state) => ({
        lights: [...state.lights, { ...light, id: generateId() }],
      })),
      updateLight: (id, updates) => set((state) => ({
        lights: state.lights.map((l) => l.id === id ? { ...l, ...updates } : l),
      })),
      deleteLight: (id) => set((state) => ({
        lights: state.lights.filter((l) => l.id !== id),
      })),
      
      addController: (controller) => set((state) => ({
        controllers: [...state.controllers, { ...controller, id: generateId() }],
      })),
      updateController: (id, updates) => set((state) => ({
        controllers: state.controllers.map((c) => c.id === id ? { ...c, ...updates } : c),
      })),
      deleteController: (id) => set((state) => ({
        controllers: state.controllers.filter((c) => c.id !== id),
      })),
      
      // Template CRUD
      addTemplate: (template) => set((state) => ({
        templates: [...state.templates, { 
          ...template, 
          id: generateId(), 
          createdAt: new Date().toISOString() 
        }],
      })),
      updateTemplate: (id, updates) => set((state) => ({
        templates: state.templates.map((t) => t.id === id ? { ...t, ...updates } : t),
      })),
      deleteTemplate: (id) => set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
      })),
      setDefaultTemplate: (id) => set((state) => ({
        templates: state.templates.map((t) => ({
          ...t,
          isDefault: t.id === id,
        })),
      })),
      
      // PPT Generation
      startPPTGeneration: () => set({ isGeneratingPPT: true, pptProgress: 0 }),
      updatePPTProgress: (progress) => set({ pptProgress: progress }),
      finishPPTGeneration: () => set({ isGeneratingPPT: false, pptProgress: 100 }),
      
      canGeneratePPT: () => {
        const state = get();
        const project = state.projects.find(p => p.id === state.selectedProjectId);
        const missingItems: string[] = [];
        
        if (!project) {
          return { canGenerate: false, missingItems: ['未选择项目'] };
        }
        
        // Check for workstations using snake_case property names (from Supabase)
        const workstations = state.workstations.filter(ws => 
          ws.projectId === project.id || (ws as any).project_id === project.id
        );
        if (workstations.length === 0) {
          missingItems.push('至少需要1个工位');
        }
        
        // Check required fields
        if (!project.code || !project.name || !project.customer) {
          missingItems.push('项目关键字段未填写完整');
        }
        
        return { 
          canGenerate: missingItems.length === 0, 
          missingItems 
        };
      },
      
      // Helpers
      getProjectWorkstations: (projectId) => {
        return get().workstations.filter(ws => ws.projectId === projectId);
      },
      
      getWorkstationModules: (workstationId) => {
        return get().modules.filter(m => m.workstationId === workstationId);
      },
      
      getProjectStats: (projectId) => {
        const state = get();
        const workstations = state.workstations.filter(ws => ws.projectId === projectId);
        const wsIds = workstations.map(ws => ws.id);
        const modules = state.modules.filter(m => wsIds.includes(m.workstationId));
        
        const layoutsComplete = workstations.filter(ws => {
          const layout = state.layouts.find(l => l.workstationId === ws.id);
          return layout && layout.frontViewSaved && layout.sideViewSaved && layout.topViewSaved;
        }).length;
        
        const flowchartsComplete = modules.filter(m => m.flowchartSaved).length;
        
        return {
          workstationCount: workstations.length,
          moduleCount: modules.length,
          layoutsComplete,
          flowchartsComplete,
        };
      },
    }),
    {
      name: 'vision-config-storage',
    }
  )
);
