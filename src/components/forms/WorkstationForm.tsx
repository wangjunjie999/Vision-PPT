import { useData } from '@/contexts/useData';
import { Textarea } from '@/components/ui/textarea';
import { useControllers } from '@/contexts/HardwareContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditableSelect } from '@/components/ui/editable-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Settings2, ImageIcon, Timer, CheckCircle2, XCircle, RotateCcw, Plus, Minus, Ruler, Link2 } from 'lucide-react';
import { calculateCycleTime } from '@/utils/visionCalcEngine';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { HardwareConfigPanel, HardwareItemData } from '@/components/hardware/HardwareConfigPanel';
import { toast } from 'sonner';
import { ProductAnnotationPanel } from '@/components/product/ProductAnnotationPanel';
import { ProductLayoutFormPanel } from './ProductLayoutFormPanel';
import { LayoutViewsPreview } from '@/components/canvas/LayoutViewsPreview';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Database } from '@/integrations/supabase/types';
import { FormStepWizard, FormStep } from './FormStepWizard';
import { useAIFormFill } from '@/hooks/useAIFormFill';
import { AIFillButton, getFieldHighlightClass } from './AIFillButton';
import { stringifyFormDraft, useEntityFormDraft } from '@/hooks/useEntityFormDraft';
import { safeController, safeHardwareArray } from '@/utils/safeDataAccess';
import { sanitizeController, sanitizeHardwareArray } from '@/utils/hardwareSerialization';
import { parseWorkstationCycleTimeSeconds } from '@/utils/cycleTimeDisplay';



type WorkstationType = 'line' | 'turntable' | 'robot' | 'platform';
type CameraMount = 'top' | 'side' | 'angled';
type Mechanism = 'stop' | 'cylinder' | 'gripper' | 'clamp' | 'flip' | 'lift' | 'indexing' | 'robot_pick';

// Constraint rules for execution mechanisms
interface MechanismConstraint {
  maxCameras?: number;
  forcedMounts?: CameraMount[];
  disabledMounts?: CameraMount[];
  reason: string;
}

const mechanismConstraints: Partial<Record<Mechanism, MechanismConstraint>> = {
  flip: {
    maxCameras: 1,
    forcedMounts: ['top'],
    disabledMounts: ['side', 'angled'],
    reason: '翻转机构运动范围大，仅支持单相机顶视安装'
  },
  robot_pick: {
    maxCameras: 2,
    disabledMounts: ['angled'],
    reason: '机械手取放需预留运动空间，最多2台相机，不支持斜视安装'
  },
  lift: {
    disabledMounts: ['side'],
    reason: '升降机构遮挡侧视视野，不支持侧视安装'
  },
  indexing: {
    forcedMounts: ['top'],
    disabledMounts: ['side'],
    reason: '分度盘旋转时侧视受遮挡，建议顶视安装'
  }
};

const createDefaultWorkstationForm = () => ({
  code: '',
  name: '',
  design_responsible: '',
  type: 'line' as WorkstationType,
  cycleTime: '',
  length: '',
  width: '',
  height: '',
  enclosed: false,
  process_stage: '',
  observation_target: '',
  environment_description: '',
  notes: '',
  acceptance_accuracy: '',
  acceptance_detection_content: '',
  acceptance_cycle_time: '',
  acceptance_compatible_sizes: '',
  motion_description: '',
  shot_count: '',
  action_script: '',
  risk_notes: '',
});

type WorkstationFormState = ReturnType<typeof createDefaultWorkstationForm>;

const createDefaultLayoutForm = () => ({
  conveyorType: '皮带输送线',
  cameraCount: 1,
  lensCount: 1,
  lightCount: 1,
  cameraMounts: ['top'] as CameraMount[],
  mountCounts: { top: 1, side: 0, angled: 0 } as Record<CameraMount, number>,
  mechanisms: [] as Mechanism[],
  selectedCameras: [] as (HardwareItemData | null)[],
  selectedLenses: [] as (HardwareItemData | null)[],
  selectedLights: [] as (HardwareItemData | null)[],
  selectedController: null as HardwareItemData | null,
  primaryView: 'front' as 'front' | 'side' | 'top',
  auxiliaryView: 'side' as 'front' | 'side' | 'top',
  layoutDescription: '',
});

type LayoutFormState = ReturnType<typeof createDefaultLayoutForm>;

interface WorkstationDraftPayload {
  wsForm: WorkstationFormState;
  layoutForm: LayoutFormState;
  currentStep: number;
}

interface WorkstationFormSource {
  code?: string | null;
  name?: string | null;
  design_responsible?: string | null;
  type?: WorkstationType | null;
  cycle_time?: number | null;
  product_dimensions?: { length?: number; width?: number; height?: number } | null;
  enclosed?: boolean | null;
  process_stage?: string | null;
  observation_target?: string | null;
  environment_description?: string | null;
  notes?: string | null;
  acceptance_criteria?: {
    accuracy?: string | null;
    detection_content?: string | null;
    cycle_time?: string | null;
    compatible_sizes?: string | null;
  } | null;
  motion_description?: string | null;
  shot_count?: number | null;
  action_script?: string | null;
  risk_notes?: string | null;
  updated_at?: string | null;
}

interface LayoutFormSource {
  conveyor_type?: string | null;
  camera_count?: number | null;
  lens_count?: number | null;
  light_count?: number | null;
  camera_mounts?: unknown;
  mechanisms?: unknown;
  selected_cameras?: unknown;
  selected_lenses?: unknown;
  selected_lights?: unknown;
  selected_controller?: HardwareItemData | null;
  primary_view?: 'front' | 'side' | 'top' | null;
  auxiliary_view?: 'front' | 'side' | 'top' | null;
  layout_description?: string | null;
}

const workstationToForm = (workstation: WorkstationFormSource): WorkstationFormState => {
  const dims = workstation.product_dimensions as { length: number; width: number; height: number } | null;
  const acceptanceCriteria = workstation.acceptance_criteria as {
    accuracy?: string;
    detection_content?: string;
    cycle_time?: string;
    compatible_sizes?: string;
  } | null;

  return {
    code: workstation.code || '',
    name: workstation.name || '',
    design_responsible: (workstation as any).design_responsible || '',
    type: workstation.type || 'line',
    cycleTime: workstation.cycle_time?.toString() || '',
    length: dims?.length?.toString() || '100',
    width: dims?.width?.toString() || '100',
    height: dims?.height?.toString() || '50',
    enclosed: workstation.enclosed || false,
    process_stage: workstation.process_stage || '',
    observation_target: workstation.observation_target || '',
    environment_description: workstation.environment_description || '',
    notes: workstation.notes || '',
    acceptance_accuracy: acceptanceCriteria?.accuracy || '',
    acceptance_detection_content: acceptanceCriteria?.detection_content || '',
    acceptance_cycle_time: acceptanceCriteria?.cycle_time || workstation.cycle_time?.toString() || '',
    acceptance_compatible_sizes: acceptanceCriteria?.compatible_sizes || '',
    motion_description: workstation.motion_description || '',
    shot_count: workstation.shot_count?.toString() || '',
    action_script: workstation.action_script || '',
    risk_notes: workstation.risk_notes || '',
  };
};

const layoutToForm = (
  layout: LayoutFormSource | null | undefined,
  controllers: Pick<HardwareItemData, 'id' | 'image_url'>[],
): LayoutFormState => {
  if (!layout) return createDefaultLayoutForm();

  const rawCameras = layout.selected_cameras;
  const rawLenses = layout.selected_lenses;
  const rawLights = layout.selected_lights;
  const selectedCameras = safeHardwareArray<HardwareItemData>(rawCameras);
  const selectedLenses = safeHardwareArray<HardwareItemData>(rawLenses);
  const selectedLights = safeHardwareArray<HardwareItemData>(rawLights);
  const clampSlotCount = (value: number) => Math.max(1, Math.round(value));
  const cameraCount = clampSlotCount(Math.max(layout.camera_count || 0, selectedCameras.length, 1));
  const lensCount = clampSlotCount(Math.max(layout.lens_count || 0, selectedLenses.length, 1));
  const lightCount = clampSlotCount(Math.max(layout.light_count || 0, selectedLights.length, 1));
  let selectedController = safeController<HardwareItemData>(layout.selected_controller);

  if (selectedController?.id && controllers.length > 0) {
    const latestController = controllers.find(c => c.id === selectedController.id);
    if (latestController) {
      selectedController = {
        ...selectedController,
        ...latestController,
      };
    }
  }

  const rawMounts = layout.camera_mounts;
  const mounts = (Array.isArray(rawMounts) ? rawMounts : ['top']) as CameraMount[];
  const mountCounts = { top: 0, side: 0, angled: 0 };
  mounts.forEach((mount: CameraMount) => {
    if (mountCounts[mount] !== undefined) mountCounts[mount]++;
  });

  if (mountCounts.top === 0 && mountCounts.side === 0 && mountCounts.angled === 0) {
    mountCounts.top = cameraCount;
  }

  return {
    conveyorType: layout.conveyor_type || '皮带输送线',
    cameraCount,
    lensCount,
    lightCount,
    cameraMounts: mounts,
    mountCounts,
    mechanisms: (Array.isArray(layout.mechanisms) ? layout.mechanisms : []) as Mechanism[],
    selectedCameras,
    selectedLenses,
    selectedLights,
    selectedController,
    primaryView: layout.primary_view || 'front',
    auxiliaryView: layout.auxiliary_view || 'side',
    layoutDescription: layout.layout_description || '',
  };
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return [
      record.message,
      record.details,
      record.hint,
      record.code,
    ].filter(value => typeof value === 'string').join(' ');
  }
  return String(error || '');
}

function isLegacyControllerColumnError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('selected_controller')
    && (
      message.includes('json')
      || message.includes('text')
      || message.includes('type')
      || message.includes('syntax')
    );
}

function isMissingLayoutSlotCountColumnError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (message.includes('lens_count') || message.includes('light_count'))
    && (
      message.includes('column')
      || message.includes('schema cache')
      || message.includes('could not find')
    );
}

function omitLayoutSlotCountColumns<T extends Record<string, unknown>>(payload: T) {
  const { lens_count, light_count, ...rest } = payload;
  return rest;
}

const createWorkstationDraftPayload = (
  wsForm: WorkstationFormState,
  layoutForm: LayoutFormState,
  currentStep: number,
): WorkstationDraftPayload => ({
  wsForm,
  layoutForm,
  currentStep,
});

const cameraMountOptions: { value: CameraMount; label: string }[] = [
  { value: 'top', label: '顶视' },
  { value: 'side', label: '侧视' },
  { value: 'angled', label: '斜视' },
];

const processStageOptions = [
  '上料',
  '装配',
  '检测',
  '下线',
  '焊接',
  '涂装',
  '其他'
];

const observationTargetOptions = [
  '电芯',
  '模组',
  '托盘',
  '箱体',
  'PCB',
  '壳体',
  '其他'
];

export function WorkstationForm() {
  const { 
    selectedWorkstationId, 
    workstations, 
    updateWorkstation, 
    layouts, 
    upsertLayout,
    getLayoutByWorkstation,
    getWorkstationModules,
  } = useData();
  
  const { controllers } = useControllers();

  const workstation = workstations.find(ws => ws.id === selectedWorkstationId);
  const layout = getLayoutByWorkstation(selectedWorkstationId || '');
  const wsModules = useMemo(
    () => selectedWorkstationId ? getWorkstationModules(selectedWorkstationId) : [],
    [selectedWorkstationId, getWorkstationModules]
  );

  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [wsForm, setWsForm] = useState<WorkstationFormState>(createDefaultWorkstationForm);
  const [layoutForm, setLayoutForm] = useState<LayoutFormState>(createDefaultLayoutForm);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const initializedWorkstationIdRef = useRef<string | null>(null);
  const baselineSnapshotRef = useRef(
    stringifyFormDraft(createWorkstationDraftPayload(createDefaultWorkstationForm(), createDefaultLayoutForm(), 0)),
  );

  const draftPayload = useMemo(
    () => createWorkstationDraftPayload(wsForm, layoutForm, currentStep),
    [currentStep, layoutForm, wsForm],
  );

  const { readDraft, clearDraft } = useEntityFormDraft<WorkstationDraftPayload>({
    entityType: 'workstation',
    entityId: selectedWorkstationId,
    value: draftPayload,
    isDirty: draftDirty,
    enabled: draftReady,
    entityUpdatedAt: workstation?.updated_at,
  });

  const getWsFormData = useCallback(() => wsForm, [wsForm]);
  const setWsFormField = useCallback((field: string, value: string) => {
    setWsForm(prev => {
      if (field === 'cycleTime') {
        return { ...prev, cycleTime: value, acceptance_cycle_time: value };
      }
      return { ...prev, [field]: value };
    });
  }, []);

  const aiFill = useAIFormFill({
    formType: 'workstation',
    getFormData: getWsFormData,
    setFormField: setWsFormField,
  });

  // Listen for pendingAIFill from chat
  const { pendingAIFill, setPendingAIFill } = useAppStore();
  useEffect(() => {
    if (pendingAIFill && pendingAIFill.targetType === 'workstation' && pendingAIFill.targetId === workstation?.id) {
      aiFill.fillWithSuggestions(pendingAIFill.fields);
      setPendingAIFill(null);
    }
  }, [pendingAIFill, workstation?.id]);

  useEffect(() => {
    if (!workstation) {
      initializedWorkstationIdRef.current = null;
      setDraftReady(false);
      setDraftDirty(false);
      return;
    }

    if (initializedWorkstationIdRef.current === workstation.id) return;

    const draft = readDraft();
    const nextPayload = draft?.payload || createWorkstationDraftPayload(
      workstationToForm(workstation as any),
      layoutToForm(layout as any, controllers),
      0,
    );

    setWsForm(nextPayload.wsForm);
    setLayoutForm(nextPayload.layoutForm);
    setCurrentStep(nextPayload.currentStep || 0);
    baselineSnapshotRef.current = stringifyFormDraft(nextPayload);
    setDraftDirty(Boolean(draft));
    setDraftReady(true);
    initializedWorkstationIdRef.current = workstation.id;

    if (draft) {
      toast.info('已恢复未保存草稿');
    }
  }, [controllers, layout, readDraft, workstation]);

  useEffect(() => {
    if (!draftReady || !workstation) return;
    if (stringifyFormDraft(draftPayload) !== baselineSnapshotRef.current) {
      setDraftDirty(true);
    }
  }, [draftPayload, draftReady, workstation]);

  // Calculate active constraints based on selected mechanisms
  const activeConstraints = useMemo(() => {
    const constraints: MechanismConstraint[] = [];
    layoutForm.mechanisms.forEach(mech => {
      const constraint = mechanismConstraints[mech];
      if (constraint) {
        constraints.push(constraint);
      }
    });
    
    // Add constraint for enclosed workstation
    if (wsForm.enclosed) {
      constraints.push({
        disabledMounts: ['side'],
        reason: '封闭罩体限制侧视可行性'
      });
    }
    
    return constraints;
  }, [layoutForm.mechanisms, wsForm.enclosed]);

  // Calculate effective limits
  const effectiveLimits = useMemo(() => {
    let maxCameras = Number.MAX_SAFE_INTEGER;
    const disabledMounts = new Set<CameraMount>();
    const forcedMounts = new Set<CameraMount>();
    const reasons: string[] = [];

    activeConstraints.forEach(constraint => {
      if (constraint.maxCameras && constraint.maxCameras < maxCameras) {
        maxCameras = constraint.maxCameras;
      }
      constraint.disabledMounts?.forEach(m => disabledMounts.add(m));
      constraint.forcedMounts?.forEach(m => forcedMounts.add(m));
      reasons.push(constraint.reason);
    });

    return { maxCameras, disabledMounts, forcedMounts, reasons };
  }, [activeConstraints]);

  // Auto-adjust camera count and mounts when constraints change
  useEffect(() => {
    let updated = false;
    const newLayoutForm = { ...layoutForm };

    // Adjust camera count if exceeds max
    if (layoutForm.cameraCount > effectiveLimits.maxCameras) {
      newLayoutForm.cameraCount = effectiveLimits.maxCameras;
      updated = true;
    }

    // Reset disabled mount counts to 0
    const newMountCounts = { ...layoutForm.mountCounts };
    effectiveLimits.disabledMounts.forEach(m => {
      if (newMountCounts[m] > 0) {
        newMountCounts[m] = 0;
        updated = true;
      }
    });

    // Rebuild cameraMounts array from mountCounts
    const newMounts: CameraMount[] = [];
    (['top', 'side', 'angled'] as CameraMount[]).forEach(mount => {
      for (let i = 0; i < newMountCounts[mount]; i++) {
        newMounts.push(mount);
      }
    });

    if (JSON.stringify(newMounts) !== JSON.stringify(layoutForm.cameraMounts)) {
      newLayoutForm.cameraMounts = newMounts.length > 0 ? newMounts : ['top'];
      newLayoutForm.mountCounts = newMountCounts;
      updated = true;
    }

    if (updated) {
      setLayoutForm(newLayoutForm);
    }
  }, [effectiveLimits, layoutForm.cameraCount, layoutForm.mountCounts]);

  // Step completion checks
  const isStep1Complete = useMemo(() => 
    Boolean(wsForm.code && wsForm.name && wsForm.acceptance_cycle_time),
    [wsForm.code, wsForm.name, wsForm.acceptance_cycle_time]
  );
  
  const isStep2Complete = useMemo(() => 
    Boolean(layoutForm.conveyorType && layoutForm.cameraCount > 0),
    [layoutForm.conveyorType, layoutForm.cameraCount]
  );
  
  const isStep3Complete = useMemo(() => 
    safeHardwareArray(layoutForm.selectedCameras).length > 0,
    [layoutForm.selectedCameras]
  );

  if (!workstation) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (!wsForm.design_responsible.trim()) {
        toast.error('请填写工位设计负责人');
        setSaving(false);
        return;
      }

      const defaultProductDimensions = [wsForm.length, wsForm.width, wsForm.height].map(Number);
      if (defaultProductDimensions.some(value => !Number.isFinite(value) || value <= 0)) {
        toast.error('默认产品长、宽、高必须大于 0');
        setSaving(false);
        setCurrentStep(0);
        return;
      }

      // Update workstation using DataContext to sync state
      await updateWorkstation(workstation.id, { 
        code: wsForm.code,
        name: wsForm.name,
        design_responsible: wsForm.design_responsible.trim(),
        type: wsForm.type,
        cycle_time: parseWorkstationCycleTimeSeconds(wsForm.acceptance_cycle_time), 
        product_dimensions: { 
          length: parseFloat(wsForm.length) || 0, 
          width: parseFloat(wsForm.width) || 0, 
          height: parseFloat(wsForm.height) || 0 
        },
        enclosed: wsForm.enclosed,
        // New SOP fields
        process_stage: wsForm.process_stage || null,
        observation_target: wsForm.observation_target || null,
        acceptance_criteria: {
          accuracy: wsForm.acceptance_accuracy || null,
          detection_content: wsForm.acceptance_detection_content || null,
          cycle_time: wsForm.acceptance_cycle_time || null,
          compatible_sizes: wsForm.acceptance_compatible_sizes || null,
        },
        motion_description: wsForm.motion_description || null,
        shot_count: wsForm.shot_count ? parseInt(wsForm.shot_count) : null,
        action_script: wsForm.action_script || null,
        risk_notes: wsForm.risk_notes || null,
        notes: wsForm.notes || null,
        status: 'incomplete' 
      } as any, { silent: true });
      
      const layoutFormForSave = layoutForm;
      const selectedCameras = sanitizeHardwareArray(layoutFormForSave.selectedCameras);
      const selectedLenses = sanitizeHardwareArray(layoutFormForSave.selectedLenses);
      const selectedLights = sanitizeHardwareArray(layoutFormForSave.selectedLights);
      const selectedController = sanitizeController(layoutFormForSave.selectedController);

      const layoutPayload: Record<string, unknown> = {
        name: wsForm.name || '布局',
        conveyor_type: layoutFormForSave.conveyorType,
        camera_count: layoutFormForSave.cameraCount,
        lens_count: layoutFormForSave.lensCount,
        light_count: layoutFormForSave.lightCount,
        camera_mounts: layoutFormForSave.cameraMounts,
        mechanisms: layoutFormForSave.mechanisms,
        selected_cameras: selectedCameras,
        selected_lenses: selectedLenses,
        selected_lights: selectedLights,
        selected_controller: selectedController,
        primary_view: layoutFormForSave.primaryView,
        auxiliary_view: layoutFormForSave.auxiliaryView,
        layout_description: layoutFormForSave.layoutDescription,
      };

      const upsertLayoutWithCompatibility = async () => {
        let payload = layoutPayload;
        let retriedWithoutSlotCounts = false;
        let retriedWithLegacyController = false;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await upsertLayout(workstation.id, payload as any);
            return;
          } catch (layoutError) {
            let nextPayload = payload;
            let canRetry = false;

            if (!retriedWithoutSlotCounts && isMissingLayoutSlotCountColumnError(layoutError)) {
              nextPayload = omitLayoutSlotCountColumns(nextPayload);
              retriedWithoutSlotCounts = true;
              canRetry = true;
            }

            if (!retriedWithLegacyController && selectedController?.id && isLegacyControllerColumnError(layoutError)) {
              nextPayload = {
                ...nextPayload,
                selected_controller: selectedController.id,
              };
              retriedWithLegacyController = true;
              canRetry = true;
            }

            if (!canRetry) {
              throw layoutError;
            }

            console.warn('Retrying layout save with legacy schema compatibility:', layoutError);
            payload = nextPayload;
          }
        }

        throw new Error('Layout save failed after compatibility retries');
      };

      // Upsert layout - this will update context state and trigger canvas re-render
      await upsertLayoutWithCompatibility();
      setLayoutForm(layoutFormForSave);
      clearDraft();
      baselineSnapshotRef.current = stringifyFormDraft(createWorkstationDraftPayload(wsForm, layoutFormForSave, currentStep));
      setDraftDirty(false);
      
      toast.success('工位配置已保存');
    } catch (error) {
      console.error('Failed to save workstation:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!workstation) return;

    const nextPayload = createWorkstationDraftPayload(
      workstationToForm(workstation as any),
      layoutToForm(layout as any, controllers),
      0,
    );
    clearDraft();
    setWsForm(nextPayload.wsForm);
    setLayoutForm(nextPayload.layoutForm);
    setCurrentStep(nextPayload.currentStep);
    baselineSnapshotRef.current = stringifyFormDraft(nextPayload);
    setDraftDirty(false);
  };

  const mechanisms: { value: Mechanism; label: string }[] = [
    { value: 'stop', label: '挡停' }, 
    { value: 'cylinder', label: '气缸' }, 
    { value: 'gripper', label: '夹爪' },
    { value: 'clamp', label: '压紧' }, 
    { value: 'flip', label: '翻转' }, 
    { value: 'lift', label: '升降' },
    { value: 'indexing', label: '分度盘' }, 
    { value: 'robot_pick', label: '机械手取放' }
  ];

  const isMountDisabled = (mount: CameraMount) => effectiveLimits.disabledMounts.has(mount);
  const isCameraCountDisabled = (count: number) => count > effectiveLimits.maxCameras;
  
  // Calculate total mount count
  const totalMountCount = layoutForm.mountCounts.top + layoutForm.mountCounts.side + layoutForm.mountCounts.angled;
  
  // Get max available for a mount type
  const getMaxForMount = (mount: CameraMount) => {
    const othersTotal = Object.entries(layoutForm.mountCounts)
      .filter(([key]) => key !== mount)
      .reduce((sum, [, val]) => sum + val, 0);
    return layoutForm.cameraCount - othersTotal;
  };

  const toggleMechanism = (mech: Mechanism) => {
    setLayoutForm(p => ({
      ...p,
      mechanisms: p.mechanisms.includes(mech) 
        ? p.mechanisms.filter(x => x !== mech) 
        : [...p.mechanisms, mech]
    }));
  };

  // Handle camera count change - auto-adjust mount counts
  const handleCameraCountChange = (newCount: number) => {
    if (isCameraCountDisabled(newCount)) return;
    const currentTotal = totalMountCount;
    let newMountCounts = { ...layoutForm.mountCounts };
    
    if (newCount > currentTotal) {
      // Add difference to first available non-disabled mount (prefer top)
      const diff = newCount - currentTotal;
      if (!isMountDisabled('top')) {
        newMountCounts.top += diff;
      } else if (!isMountDisabled('side')) {
        newMountCounts.side += diff;
      } else if (!isMountDisabled('angled')) {
        newMountCounts.angled += diff;
      }
    } else if (newCount < currentTotal) {
      // Reduce from mounts, starting from angled, then side, then top
      let toReduce = currentTotal - newCount;
      for (const mount of ['angled', 'side', 'top'] as CameraMount[]) {
        const reduce = Math.min(toReduce, newMountCounts[mount]);
        newMountCounts[mount] -= reduce;
        toReduce -= reduce;
        if (toReduce <= 0) break;
      }
    }
    
    // Rebuild cameraMounts array
    const newMounts: CameraMount[] = [];
    (['top', 'side', 'angled'] as CameraMount[]).forEach(m => {
      for (let i = 0; i < newMountCounts[m]; i++) {
        newMounts.push(m);
      }
    });
    
    setLayoutForm(p => ({
      ...p,
      cameraCount: newCount,
      mountCounts: newMountCounts,
      cameraMounts: newMounts.length > 0 ? newMounts : ['top'],
    }));
  };

  const updateMountCount = (mount: CameraMount, count: number) => {
    if (isMountDisabled(mount)) return;
    const nextCount = Math.max(0, Math.min(getMaxForMount(mount), Math.round(count)));
    
    const newMountCounts = { ...layoutForm.mountCounts, [mount]: nextCount };
    
    // Rebuild cameraMounts array
    const newMounts: CameraMount[] = [];
    (['top', 'side', 'angled'] as CameraMount[]).forEach(m => {
      for (let i = 0; i < newMountCounts[m]; i++) {
        newMounts.push(m);
      }
    });
    
    setLayoutForm(p => ({
      ...p,
      mountCounts: newMountCounts,
      cameraMounts: newMounts.length > 0 ? newMounts : ['top'],
    }));
  };

  const hasConstraintForMechanism = (mech: Mechanism) => !!mechanismConstraints[mech];
  const targetCycleTimeS = parseWorkstationCycleTimeSeconds(wsForm.acceptance_cycle_time);

  // Step content components
  const Step1WorkstationInfo = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">工位编号 <span className="text-destructive ml-0.5">*</span></Label>
        <Input 
          value={wsForm.code} 
          onChange={e => setWsForm(p => ({ ...p, code: e.target.value }))} 
          className="h-9"
          maxLength={20}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">工位名称 <span className="text-destructive ml-0.5">*</span></Label>
        <Input 
          value={wsForm.name} 
          onChange={e => setWsForm(p => ({ ...p, name: e.target.value }))} 
          className="h-9"
          maxLength={100}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">工位设计负责人 <span className="text-destructive ml-0.5">*</span></Label>
        <Input
          value={wsForm.design_responsible}
          onChange={e => setWsForm(p => ({ ...p, design_responsible: e.target.value }))}
          placeholder="请输入设计负责人姓名"
          className="h-9"
          maxLength={50}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">工位类型 <span className="text-destructive ml-0.5">*</span></Label>
        <Select value={wsForm.type} onValueChange={v => setWsForm(p => ({ ...p, type: v as WorkstationType }))}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="line">线体</SelectItem>
            <SelectItem value="turntable">转盘</SelectItem>
            <SelectItem value="robot">机械手</SelectItem>
            <SelectItem value="platform">平台</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/25 p-3">
        <div className="flex items-start gap-2">
          <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <Label className="text-xs font-semibold">默认产品尺寸 (mm)</Label>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
              用作新增产品的初始值，以及单个产品尺寸留空时的回落值；不会覆盖已填写的独立产品尺寸。
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">默认长 L</Label>
          <Input 
            type="number" 
            min="1"
            value={wsForm.length} 
            onChange={e => setWsForm(p => ({ ...p, length: e.target.value }))} 
            className="h-9" 
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">默认宽 W</Label>
          <Input 
            type="number" 
            min="1"
            value={wsForm.width} 
            onChange={e => setWsForm(p => ({ ...p, width: e.target.value }))} 
            className="h-9" 
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">默认高 H</Label>
          <Input 
            type="number" 
            min="1"
            value={wsForm.height} 
            onChange={e => setWsForm(p => ({ ...p, height: e.target.value }))} 
            className="h-9" 
          />
        </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Link2 className="h-3 w-3 text-emerald-500" />
          独立产品尺寸请在下一步“机械布局 → 布局产品”中维护
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox 
          id="enclosed" 
          checked={wsForm.enclosed} 
          onCheckedChange={(checked) => setWsForm(p => ({ ...p, enclosed: !!checked }))} 
        />
        <Label htmlFor="enclosed" className="text-xs cursor-pointer">封闭罩体</Label>
        {wsForm.enclosed && (
          <span className="text-xs text-warning ml-2">（限制侧视安装）</span>
        )}
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">工位技术要求</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">精度要求</Label>
            <Input
              value={wsForm.acceptance_accuracy}
              onChange={e => setWsForm(p => ({ ...p, acceptance_accuracy: e.target.value }))}
              placeholder="例如: ±0.1mm"
              className="h-9"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">工位节拍范围/要求 (s/pcs) <span className="text-destructive ml-0.5">*</span></Label>
            <Input
              value={wsForm.acceptance_cycle_time}
              onChange={e => setWsForm(p => ({ ...p, acceptance_cycle_time: e.target.value }))}
              placeholder="例如: 3~3.5 或 100"
              className="h-9"
              maxLength={80}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">检测内容</Label>
          <Textarea
            value={wsForm.acceptance_detection_content}
            onChange={e => setWsForm(p => ({ ...p, acceptance_detection_content: e.target.value }))}
            placeholder="例如: 四面尺寸精密测量"
            className="min-h-[72px] text-sm resize-none"
            maxLength={500}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">所属工艺段</Label>
          <EditableSelect
            value={wsForm.process_stage}
            onValueChange={v => setWsForm(p => ({ ...p, process_stage: v }))}
            options={processStageOptions}
            placeholder="请选择"
            inputPlaceholder="请输入工艺段"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">被观察对象</Label>
          <EditableSelect
            value={wsForm.observation_target}
            onValueChange={v => setWsForm(p => ({ ...p, observation_target: v }))}
            options={observationTargetOptions}
            placeholder="请选择"
            inputPlaceholder="请输入观察对象"
          />
        </div>
      </div>
      
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">现场环境说明</Label>
        <Input 
          value={wsForm.environment_description} 
          onChange={e => setWsForm(p => ({ ...p, environment_description: e.target.value }))} 
          placeholder="例如: 无尘车间、强环境光、有振动..."
          className="h-9"
          maxLength={200}
        />
      </div>
      
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">风险/待确认事项</Label>
        <textarea 
          value={wsForm.risk_notes} 
          onChange={e => setWsForm(p => ({ ...p, risk_notes: e.target.value }))} 
          placeholder="例如: 缺陷检测能力需以实际样品测试为准"
          className="w-full min-h-[60px] p-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={500}
        />
      </div>

      {/* Cycle Time Analysis Card */}
      {targetCycleTimeS !== null && wsModules.length > 0 && (() => {
        const processingTimes = wsModules.map((m: any) => m.processing_time_limit || 0);
        const maxExposureUs = Math.max(
          ...wsModules.map((m: any) => {
            const exp = m.extra_fields?.exposure || m.exposure;
            if (!exp) return 0;
            const s = String(exp).toLowerCase();
            if (s.includes('ms')) return parseFloat(s) * 1000;
            return parseFloat(s) || 0;
          }),
          0
        );
        const firstCam = safeHardwareArray((layout as any)?.selected_cameras)[0] as any;
        const camFrameRate = firstCam?.frame_rate || 0;

        const ctResult = calculateCycleTime({
          targetCycleTimeS,
          processingTimesMs: processingTimes,
          shotCount: parseInt(wsForm.shot_count) || 1,
          exposureTimeUs: maxExposureUs > 0 ? maxExposureUs : undefined,
          cameraFrameRate: camFrameRate > 0 ? camFrameRate : undefined,
        });
        return (
          <div className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">工位节拍分析</span>
              {ctResult.isFeasible ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive ml-auto" />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">目标:</span>{' '}
                <span className="font-mono">{ctResult.targetMs}ms</span>
              </div>
              <div>
                <span className="text-muted-foreground">预估耗时:</span>{' '}
                <span className="font-mono">{ctResult.totalEffectiveMs}ms</span>
              </div>
              <div>
                <span className="text-muted-foreground">裕量:</span>{' '}
                <span className={cn('font-mono', ctResult.marginMs < 0 ? 'text-destructive' : 'text-primary')}>
                  {ctResult.marginMs > 0 ? '+' : ''}{ctResult.marginMs}ms ({ctResult.marginPercent}%)
                </span>
              </div>
            </div>
            {ctResult.phases.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground">
                  瓶颈: <span className="font-medium text-foreground">{ctResult.bottleneck}</span>
                  {' · '}
                  产能: <span className="font-mono">{ctResult.actualThroughputPerHour}</span> 件/小时
                  {ctResult.actualThroughputPerHour !== ctResult.throughputPerHour && (
                    <span className="text-muted-foreground"> (目标 {ctResult.throughputPerHour})</span>
                  )}
                </div>
                <div className="space-y-1 pt-1 border-t border-border/30">
                  {ctResult.phases.map((phase, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px]">
                      <span className={cn(
                        'w-28 truncate shrink-0',
                        phase.name === ctResult.bottleneck ? 'font-medium text-foreground' : 'text-muted-foreground'
                      )}>
                        {phase.name}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            phase.name === ctResult.bottleneck ? 'bg-amber-500' : 'bg-primary/60'
                          )}
                          style={{ width: `${Math.max(phase.percent || 0, 2)}%` }}
                        />
                      </div>
                      <span className="font-mono w-16 text-right shrink-0 text-muted-foreground">
                        {phase.durationMs}ms
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}
      
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">备注</Label>
        <textarea 
          value={wsForm.notes} 
          onChange={e => setWsForm(p => ({ ...p, notes: e.target.value }))} 
          placeholder="其他说明..."
          className="w-full min-h-[60px] p-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={500}
        />
      </div>
    </div>
  );

  const Step2MechanicalLayout = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">输送/机台类型</Label>
        <Input 
          value={layoutForm.conveyorType} 
          onChange={e => setLayoutForm(p => ({ ...p, conveyorType: e.target.value }))} 
          className="h-9"
          maxLength={50}
        />
      </div>

      {/* Execution Mechanisms */}
      <div className="space-y-2">
        <Label className="text-xs">执行机构</Label>
        <div className="flex flex-wrap gap-2">
          {mechanisms.map(m => {
            const hasConstraint = hasConstraintForMechanism(m.value);
            const isSelected = layoutForm.mechanisms.includes(m.value);
            
            return (
              <TooltipProvider key={m.value}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label 
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 border rounded-md cursor-pointer transition-colors",
                        isSelected 
                          ? hasConstraint 
                            ? "bg-warning/20 border-warning" 
                            : "bg-primary/10 border-primary"
                          : "hover:bg-secondary",
                        hasConstraint && "relative"
                      )}
                    >
                      <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => toggleMechanism(m.value)} 
                      />
                      <span className="text-xs">{m.label}</span>
                      {hasConstraint && (
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      )}
                    </label>
                  </TooltipTrigger>
                  {hasConstraint && (
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">
                        <strong>约束提示:</strong>{mechanismConstraints[m.value]?.reason}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* Constraint Alert */}
      {effectiveLimits.reasons.length > 0 && (
        <Alert className="bg-warning/10 border-warning">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">
            <strong>当前约束:</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              {effectiveLimits.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Camera Count */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs">相机数量</Label>
          {effectiveLimits.maxCameras < Number.MAX_SAFE_INTEGER && (
            <span className="text-xs text-warning">
              (最多 {effectiveLimits.maxCameras} 台)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-background p-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            disabled={layoutForm.cameraCount <= 1}
            onClick={() => handleCameraCountChange(layoutForm.cameraCount - 1)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-14 text-center text-sm font-semibold">
            {layoutForm.cameraCount} 台
          </span>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            disabled={isCameraCountDisabled(layoutForm.cameraCount + 1)}
            onClick={() => handleCameraCountChange(layoutForm.cameraCount + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Camera Mounts with Quantity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">相机安装方式分配</Label>
          {totalMountCount !== layoutForm.cameraCount && (
            <span className="text-xs text-warning">
              已分配 {totalMountCount}/{layoutForm.cameraCount} 台
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {cameraMountOptions.map(mount => {
            const disabled = isMountDisabled(mount.value);
            const currentCount = layoutForm.mountCounts[mount.value];
            const maxCount = getMaxForMount(mount.value);
            
            return (
              <TooltipProvider key={mount.value}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "flex flex-col gap-2 p-3 border rounded-md transition-colors",
                        disabled 
                          ? "opacity-40 cursor-not-allowed bg-muted"
                          : currentCount > 0 
                            ? "bg-primary/10 border-primary"
                            : "bg-background"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{mount.label}</span>
                        {disabled && (
                          <AlertTriangle className="h-3 w-3 text-warning" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          disabled={disabled || currentCount <= 0}
                          onClick={() => !disabled && updateMountCount(mount.value, currentCount - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-8 text-center text-xs font-semibold">
                          {currentCount}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          disabled={disabled || currentCount >= maxCount}
                          onClick={() => !disabled && currentCount < maxCount && updateMountCount(mount.value, currentCount + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </TooltipTrigger>
                  {disabled && (
                    <TooltipContent>
                      <p className="text-xs">已禁用：受执行机构约束</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        {totalMountCount !== layoutForm.cameraCount && (
          <p className="text-xs text-muted-foreground">
            提示：各安装方式数量之和应等于相机总数 ({layoutForm.cameraCount})
          </p>
        )}
      </div>
      
      {/* Primary/Auxiliary View Selection */}
      <div className="mt-4 pt-4 border-t space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">主视图 / 辅视图选择</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">主视图</Label>
            <Select
              value={layoutForm.primaryView}
              onValueChange={(v) => setLayoutForm(p => ({ ...p, primaryView: v as any }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="front">正视图</SelectItem>
                <SelectItem value="side">侧视图</SelectItem>
                <SelectItem value="top">俯视图</SelectItem>
                <SelectItem value="isometric">等轴图</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">辅视图</Label>
            <Select
              value={layoutForm.auxiliaryView}
              onValueChange={(v) => setLayoutForm(p => ({ ...p, auxiliaryView: v as any }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="front">正视图</SelectItem>
                <SelectItem value="side">侧视图</SelectItem>
                <SelectItem value="top">俯视图</SelectItem>
                <SelectItem value="isometric">等轴图</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Layout Description */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">布局说明（相机位置、安装角度等）</Label>
          <Textarea
            value={layoutForm.layoutDescription}
            onChange={(e) => setLayoutForm(p => ({ ...p, layoutDescription: e.target.value }))}
            placeholder="描述相机安装位置、角度、工作距离等信息。例如：C1 相机顶视安装，工作距离 50mm，角度 0° 垂直拍摄..."
            rows={3}
            className="text-sm"
          />
        </div>
      </div>

      {/* Product assets are edited here because they are the source of truth for layout products. */}
      {selectedWorkstationId && (
        <ProductLayoutFormPanel
          workstationId={selectedWorkstationId}
          defaultDimensions={{
            length: Number(wsForm.length) || 100,
            width: Number(wsForm.width) || 100,
            height: Number(wsForm.height) || 100,
          }}
        />
      )}

      {/* Layout Views Preview */}
      {selectedWorkstationId && (
        <div className="mt-3">
          <LayoutViewsPreview workstationId={selectedWorkstationId} />
        </div>
      )}
    </div>
  );

  const Step3HardwareConfig = (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">硬件配置</span>
      </div>
      <HardwareConfigPanel 
        cameraCount={layoutForm.cameraCount}
        lensCount={layoutForm.lensCount}
        lightCount={layoutForm.lightCount}
        onCameraCountChange={(n) => setLayoutForm(p => ({ ...p, cameraCount: n }))}
        onLensCountChange={(n) => setLayoutForm(p => ({ ...p, lensCount: n }))}
        onLightCountChange={(n) => setLayoutForm(p => ({ ...p, lightCount: n }))}
        initialCameras={layoutForm.selectedCameras}
        initialLenses={layoutForm.selectedLenses}
        initialLights={layoutForm.selectedLights}
        initialController={layoutForm.selectedController}
        onHardwareChange={(config) => setLayoutForm(p => ({
          ...p,
          selectedCameras: config.cameras,
          selectedLenses: config.lenses,
          selectedLights: config.lights,
          selectedController: config.controller,
        }))}
      />
      
      {/* Product 3D & Annotation Section */}
      {selectedWorkstationId && (
        <div className="mt-6 pt-6 border-t">
          <ProductAnnotationPanel workstationId={selectedWorkstationId} />
        </div>
      )}
    </div>
  );

  const steps: FormStep[] = useMemo(() => [
    {
      id: 'info',
      title: '工位信息',
      shortTitle: '信息',
      description: '设置工位基本信息和产品尺寸',
      content: Step1WorkstationInfo,
      isComplete: isStep1Complete,
      nextHint: isStep1Complete 
        ? '工位信息已完成，点击“下一步”配置机械布局' 
        : '请填写工位编号、名称和工位节拍范围/要求后继续',
    },
    {
      id: 'layout',
      title: '机械布局',
      shortTitle: '布局',
      description: '配置输送类型、执行机构和相机安装',
      content: Step2MechanicalLayout,
      isComplete: isStep2Complete,
      nextHint: isStep2Complete 
        ? '机械布局已配置，下一步选择硬件' 
        : '请配置输送类型和相机数量',
    },
    {
      id: 'hardware',
      title: '硬件配置',
      shortTitle: '硬件',
      description: '选择相机、镜头、光源和控制器',
      content: Step3HardwareConfig,
      isComplete: isStep3Complete,
      nextHint: isStep3Complete 
        ? '配置完成，点击“保存完成”保存所有设置' 
        : '请至少选择一个相机',
    },
  ], [Step1WorkstationInfo, Step2MechanicalLayout, Step3HardwareConfig, isStep1Complete, isStep2Complete, isStep3Complete]);

  return (
    <FormStepWizard
      title="工位配置"
      headerActions={
        <>
          <AIFillButton
            status={aiFill.status}
            onStart={aiFill.startFill}
            onStop={aiFill.stopFill}
          />
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving || aiFill.isActive}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </>
      }
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onSave={handleSave}
      saving={saving}
    />
  );
}
