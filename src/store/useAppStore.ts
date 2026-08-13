import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViewType, UserRole } from '@/types';
import type { ProductViewerDisplayMode } from '@/utils/productViewer';
import type { ModuleFormState } from '@/components/forms/module/types';

interface AnnotationExistingData {
  annotations?: Array<{ id: string; type: string; x: number; y: number; number?: number; name: string; category: string; description: string; width?: number; height?: number; radius?: number }>;
  remark?: string | null;
  recordId?: string;
  mediaId?: string;
}

interface LayoutFocusRequest {
  workstationId: string;
  objectId: string;
  requestId: number;
}

let nextLayoutFocusRequestId = 0;

// Note: All data CRUD has been moved to DataContext (projects/workstations/layouts/modules)
// and HardwareContext (cameras/lenses/lights/controllers).
// Templates are managed via usePPTTemplates hook.
// This store now only holds UI state.

interface Store {
  // App state
  currentRole: UserRole;
  selectedProjectId: string | null;
  selectedWorkstationId: string | null;
  selectedModuleId: string | null;
  selectedProductAssetId: string | null;
  layoutFocusRequest: LayoutFocusRequest | null;
  currentView: ViewType;
  isGeneratingPPT: boolean;
  pptProgress: number;
  pptImageQuality: 'standard' | 'high' | 'ultra';

  // Annotation mode
  annotationMode: boolean;
  annotationSnapshot: string | null;
  annotationAssetId: string | null;
  annotationScope: 'workstation' | 'module';
  annotationWorkstationId: string | null;
  annotationExistingData: AnnotationExistingData | null;

  // AI Form Fill from chat
  pendingAIFill: { targetType: 'project' | 'workstation' | 'module'; targetId: string; fields: Record<string, string> } | null;
  setPendingAIFill: (fill: { targetType: 'project' | 'workstation' | 'module'; targetId: string; fields: Record<string, string> } | null) => void;

  // Live module form mirror for canvas/form two-way preview.
  // This is intentionally transient and is not persisted by partialize().
  moduleLiveForms: Record<string, { form: ModuleFormState; source: 'form' | 'schematic'; revision: number }>;
  setModuleLiveForm: (moduleId: string, form: ModuleFormState) => void;
  patchModuleLiveForm: (moduleId: string, patch: Partial<ModuleFormState>) => void;
  clearModuleLiveForm: (moduleId: string) => void;

  enterAnnotationMode: (snapshot: string, assetId: string, scope: 'workstation' | 'module', workstationId?: string, existingData?: AnnotationExistingData) => void;
  /** Leaves 3D viewer and opens annotation UI in one update (avoids one frame with neither viewer nor annotation). */
  transitionViewerToAnnotation: (snapshot: string, assetId: string, scope: 'workstation' | 'module', workstationId?: string, existingData?: AnnotationExistingData) => void;
  exitAnnotationMode: () => void;

  // Viewer mode (3D/image in central canvas)
  viewerMode: boolean;
  viewerAssetData: {
    modelUrl: string | null;
    imageUrls: string[];
    assetId: string;
    scope: 'workstation' | 'module';
    preferredDisplayMode: ProductViewerDisplayMode;
  } | null;
  enterViewerMode: (
    modelUrl: string | null,
    imageUrls: string[],
    assetId: string,
    scope: 'workstation' | 'module',
    preferredDisplayMode?: ProductViewerDisplayMode
  ) => void;
  exitViewerMode: () => void;

  // Quality mapping helper
  getPixelRatio: () => number;

  // Actions
  setCurrentRole: (role: UserRole) => void;
  selectProject: (id: string | null) => void;
  selectWorkstation: (id: string | null) => void;
  selectModule: (id: string | null) => void;
  selectProductAsset: (id: string | null) => void;
  requestLayoutObjectFocus: (workstationId: string, objectId: string) => void;
  setCurrentView: (view: ViewType) => void;
  setPPTImageQuality: (quality: 'standard' | 'high' | 'ultra') => void;

  // PPT Generation
  startPPTGeneration: () => void;
  updatePPTProgress: (progress: number) => void;
  finishPPTGeneration: () => void;
}

const PERSISTED_STORE_VERSION = 2;

const DEFAULT_PERSISTED_STATE = {
  currentRole: 'user' as UserRole,
  selectedProjectId: null,
  selectedWorkstationId: null,
  selectedModuleId: null,
  currentView: 'front' as ViewType,
  pptImageQuality: 'high' as const,
  pendingAIFill: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readCurrentRole(value: unknown): UserRole {
  return value === 'admin' || value === 'user' ? value : DEFAULT_PERSISTED_STATE.currentRole;
}

function readCurrentView(value: unknown): ViewType {
  return value === 'front' || value === 'side' || value === 'top'
    ? value
    : DEFAULT_PERSISTED_STATE.currentView;
}

function readPPTImageQuality(value: unknown): 'standard' | 'high' | 'ultra' {
  return value === 'standard' || value === 'high' || value === 'ultra'
    ? value
    : DEFAULT_PERSISTED_STATE.pptImageQuality;
}

function readPendingAIFill(value: unknown): Store['pendingAIFill'] {
  if (!isRecord(value)) return null;
  const { targetType, targetId, fields } = value;
  const validTarget = targetType === 'project' || targetType === 'workstation' || targetType === 'module';
  if (!validTarget || typeof targetId !== 'string' || !isRecord(fields)) return null;

  return {
    targetType,
    targetId,
    fields: Object.fromEntries(
      Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    ),
  };
}

function normalizePersistedState(persistedState: unknown): Partial<Store> {
  const state = isRecord(persistedState) && isRecord(persistedState.state)
    ? persistedState.state
    : persistedState;

  if (!isRecord(state)) {
    return DEFAULT_PERSISTED_STATE;
  }

  return {
    currentRole: readCurrentRole(state.currentRole),
    selectedProjectId: readNullableString(state.selectedProjectId),
    selectedWorkstationId: readNullableString(state.selectedWorkstationId),
    selectedModuleId: readNullableString(state.selectedModuleId),
    currentView: readCurrentView(state.currentView),
    pptImageQuality: readPPTImageQuality(state.pptImageQuality),
    pendingAIFill: readPendingAIFill(state.pendingAIFill),
  };
}

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      // Initial state
      currentRole: 'user',
      selectedProjectId: null,
      selectedWorkstationId: null,
      selectedModuleId: null,
      selectedProductAssetId: null,
      layoutFocusRequest: null,
      currentView: 'front',
      isGeneratingPPT: false,
      pptProgress: 0,
      pptImageQuality: 'high',

      // Annotation mode
      annotationMode: false,
      annotationSnapshot: null,
      annotationAssetId: null,
      annotationScope: 'workstation',
      annotationWorkstationId: null,
      annotationExistingData: null,

      // AI Form Fill
      pendingAIFill: null,
      setPendingAIFill: (fill) => set({ pendingAIFill: fill }),

      // Live module form mirror
      moduleLiveForms: {},
      setModuleLiveForm: (moduleId, form) => set((state) => {
        const existing = state.moduleLiveForms[moduleId];
        return {
          moduleLiveForms: {
            ...state.moduleLiveForms,
            [moduleId]: {
              form,
              source: 'form',
              revision: existing?.revision ?? 0,
            },
          },
        };
      }),
      patchModuleLiveForm: (moduleId, patch) => set((state) => {
        const existing = state.moduleLiveForms[moduleId];
        if (!existing) return state;
        return {
          moduleLiveForms: {
            ...state.moduleLiveForms,
            [moduleId]: {
              form: { ...existing.form, ...patch },
              source: 'schematic',
              revision: existing.revision + 1,
            },
          },
        };
      }),
      clearModuleLiveForm: (moduleId) => set((state) => {
        if (!state.moduleLiveForms[moduleId]) return state;
        const next = { ...state.moduleLiveForms };
        delete next[moduleId];
        return { moduleLiveForms: next };
      }),

      enterAnnotationMode: (snapshot, assetId, scope, workstationId, existingData) => set({
        viewerMode: false,
        viewerAssetData: null,
        annotationMode: true,
        annotationSnapshot: snapshot,
        annotationAssetId: assetId,
        annotationScope: scope,
        annotationWorkstationId: workstationId || null,
        annotationExistingData: existingData || null,
      }),
      transitionViewerToAnnotation: (snapshot, assetId, scope, workstationId, existingData) => set({
        viewerMode: false,
        viewerAssetData: null,
        annotationMode: true,
        annotationSnapshot: snapshot,
        annotationAssetId: assetId,
        annotationScope: scope,
        annotationWorkstationId: workstationId || null,
        annotationExistingData: existingData || null,
      }),
      exitAnnotationMode: () => set({
        annotationMode: false,
        annotationSnapshot: null,
        annotationAssetId: null,
        annotationWorkstationId: null,
        annotationExistingData: null,
      }),

      // Viewer mode
      viewerMode: false,
      viewerAssetData: null,
      enterViewerMode: (modelUrl, imageUrls, assetId, scope, preferredDisplayMode = 'auto') => set({
        annotationMode: false,
        annotationSnapshot: null,
        annotationAssetId: null,
        annotationWorkstationId: null,
        annotationExistingData: null,
        viewerMode: true,
        viewerAssetData: { modelUrl, imageUrls: imageUrls.slice(0, 1), assetId, scope, preferredDisplayMode },
      }),
      exitViewerMode: () => set({
        viewerMode: false,
        viewerAssetData: null,
      }),

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

      // Actions
      setCurrentRole: (role) => set({ currentRole: role }),

      selectProject: (id) => set({
        selectedProjectId: id,
        selectedWorkstationId: null,
        selectedModuleId: null,
        selectedProductAssetId: null,
        layoutFocusRequest: null,
      }),

      selectWorkstation: (id) => set({
        selectedWorkstationId: id,
        selectedModuleId: null,
        selectedProductAssetId: null,
        layoutFocusRequest: null,
        currentView: 'front'
      }),

      selectModule: (id) => set({ selectedModuleId: id }),
      selectProductAsset: (id) => set({ selectedProductAssetId: id }),
      requestLayoutObjectFocus: (workstationId, objectId) => set(() => ({
        layoutFocusRequest: {
          workstationId,
          objectId,
          requestId: ++nextLayoutFocusRequestId,
        },
      })),

      setCurrentView: (view) => set({ currentView: view }),

      setPPTImageQuality: (quality) => set({ pptImageQuality: quality }),

      // PPT Generation
      startPPTGeneration: () => set({ isGeneratingPPT: true, pptProgress: 0 }),
      updatePPTProgress: (progress) => set({ pptProgress: progress }),
      finishPPTGeneration: () => set({ isGeneratingPPT: false, pptProgress: 100 }),
    }),
    {
      name: 'vision-config-storage',
      version: PERSISTED_STORE_VERSION,
      migrate: (persistedState) => ({
        ...DEFAULT_PERSISTED_STATE,
        ...normalizePersistedState(persistedState),
        selectedProjectId: null,
        selectedWorkstationId: null,
        selectedModuleId: null,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('[Store] Failed to rehydrate persisted UI state. Clearing stale storage.', error);
          localStorage.removeItem('vision-config-storage');
        }
      },
      partialize: (state) => ({
        currentRole: state.currentRole,
        selectedProjectId: state.selectedProjectId,
        selectedWorkstationId: state.selectedWorkstationId,
        selectedModuleId: state.selectedModuleId,
        currentView: state.currentView,
        pptImageQuality: state.pptImageQuality,
        pendingAIFill: state.pendingAIFill,
      }),
    }
  )
);
