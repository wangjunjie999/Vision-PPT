import { createContext } from 'react';
import type { Database } from '@/integrations/supabase/types';

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

export interface MutationOptions {
  silent?: boolean;
}

export interface DataContextType {
  projects: DbProject[];
  workstations: DbWorkstation[];
  layouts: DbLayout[];
  modules: DbModule[];
  loading: boolean;
  selectedProjectId: string | null;
  selectedWorkstationId: string | null;
  selectedModuleId: string | null;
  selectProject: (id: string | null) => void;
  selectWorkstation: (id: string | null) => void;
  selectModule: (id: string | null) => void;
  addProject: (project: Omit<ProjectInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbProject>;
  updateProject: (id: string, updates: ProjectUpdate) => Promise<DbProject>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  reorderProjects: (orderedIds: string[]) => Promise<void>;
  addWorkstation: (workstation: Omit<WorkstationInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbWorkstation>;
  updateWorkstation: (id: string, updates: WorkstationUpdate, options?: MutationOptions) => Promise<DbWorkstation>;
  deleteWorkstation: (id: string) => Promise<void>;
  duplicateWorkstation: (id: string) => Promise<DbWorkstation>;
  reorderWorkstations: (projectId: string, orderedIds: string[]) => Promise<void>;
  moveWorkstation: (id: string, targetProjectId: string, orderedIds: string[]) => Promise<void>;
  getLayoutByWorkstation: (workstationId: string) => DbLayout | undefined;
  addLayout: (layout: Omit<LayoutInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbLayout>;
  updateLayout: (id: string, updates: LayoutUpdate) => Promise<DbLayout>;
  upsertLayout: (workstationId: string, data: Omit<LayoutInsert, 'id' | 'created_at' | 'updated_at' | 'workstation_id' | 'user_id'>) => Promise<DbLayout>;
  addModule: (module: Omit<ModuleInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<DbModule>;
  updateModule: (id: string, updates: ModuleUpdate & { measurement_config?: any; schematic_image_url?: string | null }) => Promise<DbModule>;
  deleteModule: (id: string) => Promise<void>;
  duplicateModule: (id: string) => Promise<DbModule>;
  reorderModules: (workstationId: string, orderedIds: string[]) => Promise<void>;
  moveModule: (id: string, targetWorkstationId: string, orderedIds: string[]) => Promise<void>;
  getProjectWorkstations: (projectId: string) => DbWorkstation[];
  getWorkstationModules: (workstationId: string) => DbModule[];
  refetch: () => Promise<void>;
}

export const DataContext = createContext<DataContextType | null>(null);
