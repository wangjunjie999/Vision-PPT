﻿﻿﻿﻿﻿import { useData } from '@/contexts/DataContext';
import { useCameras, useLenses, useLights, useControllers } from '@/hooks/useHardware';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { ModuleFormState, getDefaultFormState } from './module/types';
import { ModuleAnnotationPanel } from '@/components/product/ModuleAnnotationPanel';
import { useAppStore } from '@/store/useAppStore';
import { FormStepWizard, FormStep } from './FormStepWizard';
import { ModuleStep1Basic } from './module/ModuleStep1Basic';
import { ModuleStep2Detection } from './module/ModuleStep2Detection';
import { ModuleStep3Imaging } from './module/ModuleStep3Imaging';
import { ModuleStep4Output } from './module/ModuleStep4Output';
import { useAIFormFill } from '@/hooks/useAIFormFill';
import { AIFillButton } from './AIFillButton';
import { RotateCcw } from 'lucide-react';
import { stringifyFormDraft, useEntityFormDraft } from '@/hooks/useEntityFormDraft';
import { normalizeModuleHardwareSelection } from '@/utils/moduleHardwareSlots';
import { getMinimumDefectSize, normalizeDefectItems } from '@/utils/defectItems';
import { normalizeDistanceUnit } from '@/utils/distanceUnits';
import { getFirstModuleLightItem, normalizeModuleLightItems } from '@/utils/moduleLightItems';
import { deserializeThreeDConfig, serializeThreeDConfig, strip3DOpticsFromForm } from './module/threeDCamera';
import { isModule3DCamera, shouldRestoreDraftAs3DCamera } from '@/utils/module3DCamera';
import { stripCameraTaktTimeUnit } from '@/utils/cameraTaktTime';

type ModuleType = 'positioning' | 'defect' | 'ocr' | 'deeplearning' | 'measurement';
type TriggerType = 'io' | 'encoder' | 'software' | 'continuous';

interface ModuleDraftPayload {
  form: ModuleFormState;
  currentStep: number;
}

const createModuleDraftPayload = (
  form: ModuleFormState,
  currentStep: number,
): ModuleDraftPayload => ({
  form,
  currentStep,
});

const moduleTypeLabels: Record<string, string> = {
  ocr: '识别',
  measurement: '测量',
  positioning: '定位',
  defect: '检测',
  deeplearning: '深度学习（算法手段）',
};

export function ModuleForm() {
  const { selectedModuleId, modules, updateModule, layouts, getLayoutByWorkstation, workstations, projects } = useData();
  const { cameras } = useCameras();
  const { lenses } = useLenses();
  const { lights } = useLights();
  const { controllers } = useControllers();
  
  const module = modules.find(m => m.id === selectedModuleId);
  const workstation = module ? workstations.find(w => w.id === module.workstation_id) : null;
  const project = workstation ? projects.find(p => p.id === workstation.project_id) : null;
  const legacyProjectUses3D = Boolean(project?.use_3d);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ModuleFormState>(getDefaultFormState());
  const [currentStep, setCurrentStep] = useState(0);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const initializedModuleIdRef = useRef<string | null>(null);
  const baselineSnapshotRef = useRef(
    stringifyFormDraft(createModuleDraftPayload(getDefaultFormState(), 0)),
  );

  const draftPayload = useMemo(
    () => createModuleDraftPayload(form, currentStep),
    [currentStep, form],
  );

  const { readDraft, clearDraft } = useEntityFormDraft<ModuleDraftPayload>({
    entityType: 'module',
    entityId: selectedModuleId,
    value: draftPayload,
    isDirty: draftDirty,
    enabled: draftReady,
    entityUpdatedAt: module?.updated_at,
  });

  const getModuleFormData = useCallback(() => form as unknown as Record<string, any>, [form]);
  const setModuleFormField = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const aiFill = useAIFormFill({
    formType: 'module',
    getFormData: getModuleFormData,
    setFormField: setModuleFormField,
  });
  
  // Listen for pendingAIFill from chat
  const {
    pendingAIFill,
    setPendingAIFill,
    moduleLiveForms,
    setModuleLiveForm,
    clearModuleLiveForm,
  } = useAppStore();
  const liveFormSnapshot = selectedModuleId ? moduleLiveForms[selectedModuleId] : undefined;
  const appliedSchematicRevisionRef = useRef(0);
  useEffect(() => {
    if (pendingAIFill && pendingAIFill.targetType === 'module' && pendingAIFill.targetId === module?.id) {
      aiFill.fillWithSuggestions(pendingAIFill.fields);
      setPendingAIFill(null);
    }
  }, [pendingAIFill, module?.id]);

  useEffect(() => {
    appliedSchematicRevisionRef.current = 0;
  }, [module?.id]);

  useEffect(() => {
    if (!module || !draftReady) return;
    setModuleLiveForm(module.id, form);
  }, [draftReady, form, module?.id, setModuleLiveForm]);

  useEffect(() => {
    const moduleId = module?.id;
    return () => {
      if (moduleId) clearModuleLiveForm(moduleId);
    };
  }, [clearModuleLiveForm, module?.id]);

  useEffect(() => {
    if (!module || !draftReady || !liveFormSnapshot || liveFormSnapshot.source !== 'schematic') return;
    if (liveFormSnapshot.revision === appliedSchematicRevisionRef.current) return;

    appliedSchematicRevisionRef.current = liveFormSnapshot.revision;
    setForm(prev => ({ ...prev, ...liveFormSnapshot.form }));
  }, [draftReady, liveFormSnapshot, module?.id]);

  // Get workstation layout for hardware inheritance
  const workstationLayout = module ? getLayoutByWorkstation(module.workstation_id) : null;

  useEffect(() => {
    if (!module) {
      initializedModuleIdRef.current = null;
      setDraftReady(false);
      setDraftDirty(false);
      return;
    }

    if (initializedModuleIdRef.current === module.id) return;

    const draft = readDraft();
    if (draft) {
      const draftForm = draft.payload.form;
      const draftShouldUse3D = shouldRestoreDraftAs3DCamera(module, draftForm, legacyProjectUses3D);
      const normalizedDraftLightItems = draftShouldUse3D ? [] : normalizeModuleLightItems((draftForm as any).lightItems, {
        selectedLight: draftForm.selectedLight,
        lightMode: draftForm.lightMode,
        lightAngle: draftForm.lightAngle,
        lightDistance: draftForm.lightDistance,
        lightDistanceHorizontal: draftForm.lightDistanceHorizontal,
        lightDistanceVertical: draftForm.lightDistanceVertical,
        lightNote: draftForm.lightNote,
      }).map(item => ({
        ...item,
        selectedLight: normalizeModuleHardwareSelection(item.selectedLight, workstationLayout, 'light'),
      }));
      const firstDraftLightItem = getFirstModuleLightItem(normalizedDraftLightItems);
      const restoredForm = {
        ...getDefaultFormState(),
        ...draftForm,
        is3DCamera: draftShouldUse3D,
        selectedCamera: normalizeModuleHardwareSelection(draftForm.selectedCamera, workstationLayout, 'camera'),
        selectedLens: draftShouldUse3D ? '' : normalizeModuleHardwareSelection(draftForm.selectedLens, workstationLayout, 'lens'),
        selectedLight: firstDraftLightItem?.selectedLight || '',
        selectedController: normalizeModuleHardwareSelection(draftForm.selectedController, workstationLayout, 'controller'),
        lightItems: normalizedDraftLightItems,
      };
      const nextForm = draftShouldUse3D ? strip3DOpticsFromForm(restoredForm) : restoredForm;
      setForm(nextForm);
      setCurrentStep(draft.payload.currentStep || 0);
      baselineSnapshotRef.current = stringifyFormDraft(createModuleDraftPayload(nextForm, draft.payload.currentStep || 0));
      setDraftDirty(true);
      setDraftReady(true);
      initializedModuleIdRef.current = module.id;
      toast.info('已恢复未保存草稿');
      return;
    }

      const defectCfg = module.defect_config as any;
      const posCfg = module.positioning_config as any;
      const ocrCfg = module.ocr_config as any;
      const dlCfg = module.deep_learning_config as any;
      const measureCfg = module.measurement_config as any;
      
      // Get common params and imaging params from any config (they should be the same across types)
      const cfg = defectCfg || posCfg || ocrCfg || dlCfg || measureCfg;
      const commonParams = cfg ? {
        judgmentStrategy: cfg.judgmentStrategy || 'balanced',
        outputAction: cfg.outputAction || [],
        communicationMethod: cfg.communicationMethod || '',
        signalDefinition: cfg.signalDefinition || '',
        dataRetentionDays: cfg.dataRetentionDays?.toString() || '',
        cameraTaktTime: stripCameraTaktTimeUnit(cfg.cameraTaktTime),
      } : {};
      const isLoaded3DCamera = isModule3DCamera(module, legacyProjectUses3D);
      const loadedLightItems = isLoaded3DCamera ? [] : normalizeModuleLightItems(cfg?.imaging?.lightItems, {
        selectedLight: module.selected_light || module.light_id || '',
        lightMode: cfg?.imaging?.lightMode || '',
        lightAngle: cfg?.imaging?.lightAngle || '',
        lightDistance: cfg?.imaging?.lightDistance || '',
        lightDistanceHorizontal: cfg?.imaging?.lightDistanceHorizontal || '',
        lightDistanceVertical: cfg?.imaging?.lightDistanceVertical || '',
        lightNote: cfg?.imaging?.lightNote || '',
      }).map(item => ({
        ...item,
        selectedLight: normalizeModuleHardwareSelection(item.selectedLight, workstationLayout, 'light'),
      }));
      const firstLoadedLightItem = getFirstModuleLightItem(loadedLightItems);
      const selectedCamera = normalizeModuleHardwareSelection(module.selected_camera || module.camera_id, workstationLayout, 'camera');
      const selectedLens = isLoaded3DCamera
        ? ''
        : normalizeModuleHardwareSelection(module.selected_lens || module.lens_id, workstationLayout, 'lens');
      const selectedController = normalizeModuleHardwareSelection(module.selected_controller || module.controller_id, workstationLayout, 'controller');
      
      const imagingParams = cfg?.imaging ? {
        distanceUnit: normalizeDistanceUnit(cfg.imaging.distanceUnit),
        is3DCamera: isLoaded3DCamera,
        workingDistance: cfg.imaging.workingDistance || '',
        fieldOfViewCommon: cfg.imaging.fieldOfView || '',
        fieldOfViewWidth: cfg.imaging.fieldOfViewWidth || (() => { const fov = cfg.imaging.fieldOfView || ''; const m = fov.match(/^(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)$/); return m ? m[1] : ''; })(),
        fieldOfViewHeight: cfg.imaging.fieldOfViewHeight || (() => { const fov = cfg.imaging.fieldOfView || ''; const m = fov.match(/^(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)$/); return m ? m[2] : ''; })(),
        resolutionPerPixel: cfg.imaging.resolutionPerPixel || '',
        exposure: cfg.imaging.exposure || '',
        gain: cfg.imaging.gain?.toString() || '',
        triggerDelay: cfg.imaging.triggerDelay?.toString() || '',
        lightMode: cfg.imaging.lightMode || '',
        lightAngle: cfg.imaging.lightAngle || '',
        lightCount: cfg.imaging.lightCount?.toString() || '1',
        lightDistance: cfg.imaging.lightDistance || '',
        lightDistanceHorizontal: cfg.imaging.lightDistanceHorizontal || '',
        lightDistanceVertical: cfg.imaging.lightDistanceVertical || '',
        lightItems: loadedLightItems,
        lensAperture: cfg.imaging.lensAperture || '',
        depthOfField: cfg.imaging.depthOfField?.toString() || '',
        workingDistanceTolerance: cfg.imaging.workingDistanceTolerance || '',
        cameraInstallNote: cfg.imaging.cameraInstallNote || '',
        lightNote: cfg.imaging.lightNote || '',
      } : {};
      const legacyThreeD = cfg?.three_d && typeof cfg.three_d === 'object'
        ? cfg.three_d as Record<string, unknown>
        : null;
      const legacyThreeDSteps = Array.isArray(legacyThreeD?.detectionSteps)
        ? legacyThreeD.detectionSteps.map(step => String(step).trim()).filter(Boolean)
        : [];
      const legacyThreeDDescription = legacyThreeDSteps.length > 0
        ? legacyThreeDSteps.join('\n')
        : (typeof legacyThreeD?.detectionMethod === 'string' ? legacyThreeD.detectionMethod.trim() : '');
      
      const loadedForm: ModuleFormState = {
        ...getDefaultFormState(),
        name: module.name,
        description: module.description || legacyThreeDDescription || '',
        type: module.type as ModuleFormState['type'],
        triggerType: (module.trigger_type || 'io') as ModuleFormState['triggerType'],
        selectedCamera,
        selectedLens,
        selectedLight: firstLoadedLightItem?.selectedLight || '',
        selectedController,
        processingTimeLimit: module.processing_time_limit?.toString() || '200',
        ...commonParams,
        ...imagingParams,
        ...deserializeThreeDConfig(cfg?.three_d),
        lightItems: loadedLightItems,
        // Load defect config
        ...(defectCfg && {
          defectItems: normalizeDefectItems(defectCfg.defectItems, defectCfg.defectClasses, defectCfg.minDefectSize),
          defectClasses: normalizeDefectItems(defectCfg.defectItems, defectCfg.defectClasses, defectCfg.minDefectSize).map(item => item.name),
          minDefectSize: defectCfg.minDefectSize != null ? defectCfg.minDefectSize.toString() : '',
          detectionAreaLength: defectCfg.detectionAreaLength?.toString() || '',
          detectionAreaWidth: defectCfg.detectionAreaWidth?.toString() || '',
          conveyorType: defectCfg.conveyorType || 'belt',
          lineSpeed: defectCfg.lineSpeed?.toString() || '',
          defectCameraCount: defectCfg.cameraCount?.toString() || '1',
          missTolerance: defectCfg.missTolerance || 'none',
          defectContrast: defectCfg.defectContrast || '',
          materialReflectionLevel: defectCfg.materialReflectionLevel || '',
          allowedMissRate: defectCfg.allowedMissRate || '',
          allowedFalseRate: defectCfg.allowedFalseRate || '',
          confidenceThreshold: defectCfg.confidenceThreshold || '',
        }),
        // Load positioning config
        ...(posCfg && {
          guidingMode: posCfg.guidingMode || 'single_camera',
          guidingMechanism: posCfg.guidingMechanism || 'fixed',
          fieldOfView: posCfg.fieldOfView || '',
          fieldOfViewWidth: posCfg.fieldOfViewWidth || (() => { const fov = posCfg.fieldOfView || ''; const m = fov.match(/^(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)$/); return m ? m[1] : ''; })(),
          fieldOfViewHeight: posCfg.fieldOfViewHeight || (() => { const fov = posCfg.fieldOfView || ''; const m = fov.match(/^(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)$/); return m ? m[2] : ''; })(),
          workingDistance: posCfg.workingDistance || '',
          accuracyRequirement: posCfg.accuracyRequirement?.toString() || '0.1',
          repeatabilityRequirement: posCfg.repeatabilityRequirement?.toString() || '0.03',
          targetType: posCfg.targetType || 'edge',
          calibrationMethod: posCfg.calibrationMethod || 'plane',
          toleranceX: posCfg.toleranceX?.toString() || '0.1',
          toleranceY: posCfg.toleranceY?.toString() || '0.1',
          outputCoordinateSystem: posCfg.outputCoordinateSystem || '',
          calibrationCycle: posCfg.calibrationCycle || '',
          accuracyAcceptanceMethod: posCfg.accuracyAcceptanceMethod || '',
          targetFeatureType: posCfg.targetFeatureType || '',
          targetCount: posCfg.targetCount || '',
          occlusionTolerance: posCfg.occlusionTolerance || '',
        }),
        // Load OCR config
        ...(ocrCfg && {
          charType: ocrCfg.charType || 'laser',
          contentRule: ocrCfg.contentRule || '',
          minCharHeight: ocrCfg.minCharHeight?.toString() || '2',
          charset: ocrCfg.charset || 'mixed',
          charCount: ocrCfg.charCount?.toString() || '',
          ocrAreaWidth: ocrCfg.ocrAreaWidth?.toString() || '',
          ocrAreaHeight: ocrCfg.ocrAreaHeight?.toString() || '',
          ocrCameraFieldOfView: ocrCfg.ocrCameraFieldOfView?.toString() || '',
          charWidth: ocrCfg.charWidth || '',
          minStrokeWidth: ocrCfg.minStrokeWidth || '',
          allowedRotationAngle: ocrCfg.allowedRotationAngle || '',
          allowedDamageLevel: ocrCfg.allowedDamageLevel || '',
          charRuleExample: ocrCfg.charRuleExample || '',
        }),
        // Load deep learning config
        ...(dlCfg && {
          dlTaskType: dlCfg.taskType || 'classification',
          targetClasses: dlCfg.targetClasses || [],
          dlRoiWidth: dlCfg.dlRoiWidth?.toString() || '',
          dlRoiHeight: dlCfg.dlRoiHeight?.toString() || '',
          dlFieldOfView: dlCfg.dlFieldOfView?.toString() || '',
          deployTarget: dlCfg.deployTarget || 'gpu',
          inferenceTimeTarget: dlCfg.inferenceTimeTarget?.toString() || '50',
          sampleSize: dlCfg.sampleSize?.toString() || '',
        }),
        // Load measurement config
        ...(measureCfg && {
          measurementItems: measureCfg.measurementItems || [],
          measurementFieldOfView: measureCfg.measurementFieldOfView || '',
          measurementResolution: measureCfg.measurementResolution || '',
          targetAccuracy: measureCfg.targetAccuracy?.toString() || '',
          systemAccuracy: measureCfg.systemAccuracy?.toString() || '0.02',
          measurementCalibrationMethod: measureCfg.calibrationMethod || 'plane',
          grr: measureCfg.grr || '',
          calibrationCycleMeasurement: measureCfg.calibrationCycle || '',
          calibrationBlockType: measureCfg.calibrationBlockType || '',
          edgeExtractionMethod: measureCfg.edgeExtractionMethod || '',
        }),
      };
      
      const nextForm = isLoaded3DCamera ? strip3DOpticsFromForm(loadedForm) : loadedForm;
      setForm(nextForm);
      setCurrentStep(0);
      baselineSnapshotRef.current = stringifyFormDraft(createModuleDraftPayload(nextForm, 0));
      setDraftDirty(false);
      setDraftReady(true);
      initializedModuleIdRef.current = module.id;
  }, [module, readDraft, resetVersion, legacyProjectUses3D]);

  useEffect(() => {
    if (!draftReady || !module) return;
    if (stringifyFormDraft(draftPayload) !== baselineSnapshotRef.current) {
      setDraftDirty(true);
    }
  }, [draftPayload, draftReady, module]);

  // Step completion logic
  const isStep1Complete = useMemo(() => 
    Boolean(form.name && form.type), 
    [form.name, form.type]
  );
  
  const isStep2Complete = useMemo(() => {
    if (!form.type) return false;
    // Check type-specific required fields
    switch (form.type) {
      case 'positioning':
        return Boolean(form.accuracyRequirement);
      case 'defect':
        return (form.defectItems.length > 0 ? form.defectItems : form.defectClasses.map(name => ({ name })))
          .some(item => item.name.trim().length > 0);
      case 'ocr':
        return Boolean(form.minCharHeight);
      case 'measurement':
        return form.measurementItems.length > 0;
      case 'deeplearning':
        return form.targetClasses.length > 0;
      default:
        return false;
    }
  }, [form]);
  
  const isStep3Complete = useMemo(() => {
    if (form.is3DCamera) {
      return Boolean(
        form.workingDistance
        || form.workingDistanceTolerance
        || form.threeDModel
        || form.threeDReferenceDistance
        || form.threeDStandardRange
        || form.threeDScanLineWidth
        || form.threeDDataPoints,
      );
    }
    return Boolean(form.workingDistance || form.fieldOfView || form.fieldOfViewCommon);
  }, [
    form.fieldOfView,
    form.fieldOfViewCommon,
    form.is3DCamera,
    form.workingDistance,
    form.workingDistanceTolerance,
    form.threeDDataPoints,
    form.threeDModel,
    form.threeDReferenceDistance,
    form.threeDScanLineWidth,
    form.threeDStandardRange,
  ]);
  
  const isStep4Complete = useMemo(() => 
    form.outputAction.length > 0,
    [form.outputAction]
  );

  const steps: FormStep[] = useMemo(() => [
    {
      id: 'basic',
      title: '基本信息',
      shortTitle: '基本',
      description: '设置模块名称、类型和触发方式',
      content: (
        <ModuleStep1Basic
          form={form}
          setForm={setForm}
          cameras={cameras}
          lenses={lenses}
          lights={lights}
          controllers={controllers}
          workstationLayout={workstationLayout}
        />
      ),
      isComplete: isStep1Complete,
      nextHint: isStep1Complete 
        ? '基本信息已完成，点击"下一步"配置功能参数' 
        : '请填写模块名称和选择模块分类后继续',
    },
    {
      id: 'detection',
      title: '功能参数',
      shortTitle: '参数',
      description: '配置模块专属的功能参数',
      content: <ModuleStep2Detection form={form} setForm={setForm} />,
      isComplete: isStep2Complete,
      nextHint: isStep2Complete 
        ? '功能参数已配置，下一步设置成像参数' 
        : '请至少配置一项关键功能参数',
    },
    {
      id: 'imaging',
      title: '成像配置',
      shortTitle: '成像',
      description: '设置工作距离、视场和光学参数',
      content: <ModuleStep3Imaging form={form} setForm={setForm} workstationLayout={workstationLayout} />,
      isComplete: isStep3Complete,
      nextHint: isStep3Complete 
        ? '成像参数已设置，最后配置输出' 
        : '请至少设置工作距离或视场',
    },
    {
      id: 'output',
      title: '输出配置',
      shortTitle: '输出',
      description: '配置检测步骤、输出动作和通讯方式',
      content: (
        <ModuleStep4Output 
          form={form} 
          setForm={setForm}
        />
      ),
      isComplete: isStep4Complete,
      nextHint: isStep4Complete 
        ? '配置完成！点击"保存完成"保存所有设置' 
        : '请至少选择一个输出动作',
    },
  ], [form, setForm, cameras, lenses, lights, controllers, workstationLayout, isStep1Complete, isStep2Complete, isStep3Complete, isStep4Complete]);

  if (!module) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      const formForSave = form.is3DCamera
        ? strip3DOpticsFromForm(form)
        : form;
      
      const configs: any = {};
      
      // Common parameters (stored in all configs)
      const commonParams = {
        judgmentStrategy: formForSave.judgmentStrategy,
        outputAction: formForSave.outputAction,
        communicationMethod: formForSave.communicationMethod || null,
        signalDefinition: formForSave.signalDefinition || null,
        dataRetentionDays: formForSave.dataRetentionDays ? parseInt(formForSave.dataRetentionDays) : null,
        cameraTaktTime: stripCameraTaktTimeUnit(formForSave.cameraTaktTime) || null,
      };

      const normalizedLightItems = normalizeModuleLightItems(formForSave.lightItems, {
        selectedLight: formForSave.selectedLight,
        lightMode: formForSave.lightMode,
        lightAngle: formForSave.lightAngle,
        lightDistance: formForSave.lightDistance,
        lightDistanceHorizontal: formForSave.lightDistanceHorizontal,
        lightDistanceVertical: formForSave.lightDistanceVertical,
        lightNote: formForSave.lightNote,
      }).map(item => ({
        ...item,
        selectedLight: normalizeModuleHardwareSelection(item.selectedLight, workstationLayout, 'light'),
      }));
      const firstLightItem = getFirstModuleLightItem(normalizedLightItems);
      
      // Imaging parameters (stored in all configs)
      const imagingParams = {
        distanceUnit: formForSave.distanceUnit || 'mm',
        is3DCamera: Boolean(formForSave.is3DCamera),
        workingDistance: formForSave.workingDistance || null,
        fieldOfViewWidth: formForSave.fieldOfViewWidth || null,
        fieldOfViewHeight: formForSave.fieldOfViewHeight || null,
        fieldOfView: formForSave.fieldOfViewCommon || formForSave.fieldOfView || null,
        resolutionPerPixel: formForSave.resolutionPerPixel || null,
        exposure: formForSave.exposure || null,
        gain: formForSave.gain ? parseFloat(formForSave.gain) : null,
        triggerDelay: formForSave.triggerDelay ? parseFloat(formForSave.triggerDelay) : null,
        lightItems: normalizedLightItems,
        lightMode: firstLightItem?.lightMode || null,
        lightAngle: firstLightItem?.lightAngle || null,
        lightCount: normalizedLightItems.length || null,
        lightDistance: firstLightItem?.lightDistance || null,
        lightDistanceHorizontal: firstLightItem?.lightDistanceHorizontal || null,
        lightDistanceVertical: firstLightItem?.lightDistanceVertical || null,
        lensAperture: formForSave.lensAperture || null,
        depthOfField: formForSave.depthOfField || null,
        workingDistanceTolerance: formForSave.workingDistanceTolerance || null,
        cameraInstallNote: formForSave.cameraInstallNote || null,
        lightNote: firstLightItem?.lightNote || null,
      };
      const threeDConfig = serializeThreeDConfig(formForSave);
      
      if (form.type === 'defect') {
        const defectItems = (form.defectItems.length > 0
          ? form.defectItems
          : form.defectClasses.map(name => ({ name, minSize: form.minDefectSize }))
        )
          .map(item => ({
            name: item.name.trim(),
            minSize: (() => {
              const value = parseFloat(item.minSize);
              return Number.isFinite(value) && value > 0 ? value : null;
            })(),
          }))
          .filter(item => item.name);
        const minDefectSize = getMinimumDefectSize(
          defectItems.map(item => ({ name: item.name, minSize: item.minSize != null ? String(item.minSize) : '' })),
        );

        configs.defect_config = {
          ...commonParams,
          imaging: imagingParams,
          three_d: threeDConfig,
          defectItems,
          defectClasses: defectItems.map(item => item.name),
          minDefectSize,
          detectionAreaLength: parseFloat(form.detectionAreaLength) || null,
          detectionAreaWidth: parseFloat(form.detectionAreaWidth) || null,
          conveyorType: form.conveyorType,
          lineSpeed: parseFloat(form.lineSpeed) || null,
          cameraCount: parseInt(form.defectCameraCount) || 1,
          missTolerance: form.missTolerance,
          // Industrial defect parameters
          defectContrast: form.defectContrast || null,
          materialReflectionLevel: form.materialReflectionLevel || null,
          allowedMissRate: form.allowedMissRate || null,
          allowedFalseRate: form.allowedFalseRate || null,
          confidenceThreshold: form.confidenceThreshold || null,
        };
      } else if (form.type === 'positioning') {
        configs.positioning_config = {
          ...commonParams,
          imaging: imagingParams,
          three_d: threeDConfig,
          guidingMode: form.guidingMode,
          guidingMechanism: form.guidingMechanism,
          fieldOfView: form.fieldOfView,
          workingDistance: form.workingDistance,
          accuracyRequirement: parseFloat(form.accuracyRequirement) || 0.1,
          repeatabilityRequirement: parseFloat(form.repeatabilityRequirement) || 0.03,
          targetType: form.targetType,
          calibrationMethod: form.calibrationMethod,
          toleranceX: parseFloat(form.toleranceX) || 0.1,
          toleranceY: parseFloat(form.toleranceY) || 0.1,
          // Industrial positioning parameters
          outputCoordinateSystem: form.outputCoordinateSystem || null,
          calibrationCycle: form.calibrationCycle || null,
          accuracyAcceptanceMethod: form.accuracyAcceptanceMethod || null,
          targetFeatureType: form.targetFeatureType || null,
          targetCount: form.targetCount || null,
          occlusionTolerance: form.occlusionTolerance || null,
        };
      } else if (form.type === 'ocr') {
        configs.ocr_config = {
          ...commonParams,
          imaging: imagingParams,
          three_d: threeDConfig,
          charType: form.charType,
          contentRule: form.contentRule,
          minCharHeight: parseFloat(form.minCharHeight) || 2,
          charset: form.charset,
          charCount: parseInt(form.charCount) || null,
          ocrAreaWidth: parseFloat(form.ocrAreaWidth) || null,
          ocrAreaHeight: parseFloat(form.ocrAreaHeight) || null,
          ocrCameraFieldOfView: parseFloat(form.ocrCameraFieldOfView) || null,
          // Industrial OCR parameters
          charWidth: form.charWidth || null,
          minStrokeWidth: form.minStrokeWidth || null,
          allowedRotationAngle: form.allowedRotationAngle || null,
          allowedDamageLevel: form.allowedDamageLevel || null,
          charRuleExample: form.charRuleExample || null,
        };
      } else if (form.type === 'deeplearning') {
        configs.deep_learning_config = {
          ...commonParams,
          imaging: imagingParams,
          three_d: threeDConfig,
          taskType: form.dlTaskType,
          targetClasses: form.targetClasses,
          dlRoiWidth: parseFloat(form.dlRoiWidth) || null,
          dlRoiHeight: parseFloat(form.dlRoiHeight) || null,
          dlFieldOfView: parseFloat(form.dlFieldOfView) || null,
          deployTarget: form.deployTarget,
          inferenceTimeTarget: parseFloat(form.inferenceTimeTarget) || 50,
          sampleSize: parseInt(form.sampleSize) || null,
        };
      } else if (form.type === 'measurement') {
        configs.measurement_config = {
          ...commonParams,
          imaging: imagingParams,
          three_d: threeDConfig,
          measurementItems: form.measurementItems,
          measurementFieldOfView: form.measurementFieldOfView,
          measurementResolution: form.measurementResolution,
          targetAccuracy: parseFloat(form.targetAccuracy) || null,
          systemAccuracy: parseFloat(form.systemAccuracy) || 0.02,
          calibrationMethod: form.measurementCalibrationMethod,
          // Industrial measurement parameters
          grr: form.grr || null,
          calibrationCycle: form.calibrationCycleMeasurement || null,
          calibrationBlockType: form.calibrationBlockType || null,
          edgeExtractionMethod: form.edgeExtractionMethod || null,
        };
      }

      const selectedCamera = normalizeModuleHardwareSelection(formForSave.selectedCamera, workstationLayout, 'camera');
      const selectedLens = formForSave.is3DCamera ? '' : normalizeModuleHardwareSelection(formForSave.selectedLens, workstationLayout, 'lens');
      const selectedLight = firstLightItem?.selectedLight || '';
      const selectedController = normalizeModuleHardwareSelection(formForSave.selectedController, workstationLayout, 'controller');
      const savedForm = {
        ...formForSave,
        selectedCamera,
        selectedLens,
        selectedLight,
        selectedController,
        lightItems: normalizedLightItems,
        lightMode: firstLightItem?.lightMode || '',
        lightAngle: firstLightItem?.lightAngle || '',
        lightCount: normalizedLightItems.length ? String(normalizedLightItems.length) : '',
        lightDistance: firstLightItem?.lightDistance || '',
        lightDistanceHorizontal: firstLightItem?.lightDistanceHorizontal || '',
        lightDistanceVertical: firstLightItem?.lightDistanceVertical || '',
        lightNote: firstLightItem?.lightNote || '',
      };

      await updateModule(module.id, {
        name: formForSave.name,
        description: formForSave.description || null,
        type: formForSave.type,
        trigger_type: formForSave.triggerType as TriggerType,
        selected_camera: selectedCamera || null,
        selected_lens: selectedLens || null,
        selected_light: selectedLight || null,
        selected_controller: selectedController || null,
        processing_time_limit: parseFloat(formForSave.processingTimeLimit) || null,
        ...configs,
        status: 'incomplete',
      });
      setForm(savedForm);
      clearDraft();
      baselineSnapshotRef.current = stringifyFormDraft(createModuleDraftPayload(savedForm, currentStep));
      setDraftDirty(false);
      
      toast.success('模块配置已保存');
    } catch (error) {
      console.error('Failed to save module:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    clearDraft();
    initializedModuleIdRef.current = null;
    setDraftReady(false);
    setDraftDirty(false);
    setResetVersion(version => version + 1);
  };

  return (
    <FormStepWizard
      title="模块配置"
      badge={
        <Badge variant="outline" className="text-xs">
          {moduleTypeLabels[form.type]}
        </Badge>
      }
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
