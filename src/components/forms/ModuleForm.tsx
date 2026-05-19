import { useData } from '@/contexts/DataContext';
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
  positioning: '引导定位',
  defect: '缺陷检测',
  ocr: 'OCR识别',
  deeplearning: '深度学习',
  measurement: '尺寸测量',
};

export function ModuleForm() {
  const { selectedModuleId, modules, updateModule, layouts, getLayoutByWorkstation } = useData();
  const { cameras } = useCameras();
  const { lenses } = useLenses();
  const { lights } = useLights();
  const { controllers } = useControllers();
  
  const module = modules.find(m => m.id === selectedModuleId);
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
      setForm(draft.payload.form);
      setCurrentStep(draft.payload.currentStep || 0);
      baselineSnapshotRef.current = stringifyFormDraft(draft.payload);
      setDraftDirty(true);
      setDraftReady(true);
      initializedModuleIdRef.current = module.id;
      toast.info('已恢复未保存草稿');
      return;
    }

      const defectCfg = module.defect_config;
      const posCfg = module.positioning_config;
      const ocrCfg = module.ocr_config;
      const dlCfg = module.deep_learning_config;
      const measureCfg = module.measurement_config;
      
      // Get common params and imaging params from any config (they should be the same across types)
      const cfg = defectCfg || posCfg || ocrCfg || dlCfg || measureCfg;
      const commonParams = cfg ? {
        detectionObject: cfg.detectionObject || '',
        judgmentStrategy: cfg.judgmentStrategy || 'balanced',
        outputAction: cfg.outputAction || [],
        communicationMethod: cfg.communicationMethod || '',
        signalDefinition: cfg.signalDefinition || '',
        dataRetentionDays: cfg.dataRetentionDays?.toString() || '',
      } : {};
      
      const imagingParams = cfg?.imaging ? {
        workingDistance: cfg.imaging.workingDistance || '',
        fieldOfViewCommon: cfg.imaging.fieldOfView || '',
        fieldOfViewWidth: (() => { const fov = cfg.imaging.fieldOfView || ''; const m = fov.match(/^(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)$/); return m ? m[1] : ''; })(),
        fieldOfViewHeight: (() => { const fov = cfg.imaging.fieldOfView || ''; const m = fov.match(/^(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)$/); return m ? m[2] : ''; })(),
        resolutionPerPixel: cfg.imaging.resolutionPerPixel || '',
        exposure: cfg.imaging.exposure || '',
        gain: cfg.imaging.gain?.toString() || '',
        triggerDelay: cfg.imaging.triggerDelay?.toString() || '',
        lightMode: cfg.imaging.lightMode || '',
        lightAngle: cfg.imaging.lightAngle || '',
        lightDistance: cfg.imaging.lightDistance || '',
        lightDistanceHorizontal: cfg.imaging.lightDistanceHorizontal || '',
        lightDistanceVertical: cfg.imaging.lightDistanceVertical || '',
        lensAperture: cfg.imaging.lensAperture || '',
        depthOfField: cfg.imaging.depthOfField?.toString() || '',
        workingDistanceTolerance: cfg.imaging.workingDistanceTolerance || '',
        cameraInstallNote: cfg.imaging.cameraInstallNote || '',
        lightNote: cfg.imaging.lightNote || '',
      } : {};
      
      const nextForm: ModuleFormState = {
        ...getDefaultFormState(),
        name: module.name,
        description: module.description || '',
        type: module.type,
        triggerType: module.trigger_type || 'io',
        selectedCamera: module.selected_camera || '',
        selectedLens: module.selected_lens || '',
        selectedLight: module.selected_light || '',
        selectedController: module.selected_controller || '',
        processingTimeLimit: module.processing_time_limit?.toString() || '200',
        ...commonParams,
        ...imagingParams,
        // Load defect config
        ...(defectCfg && {
          defectClasses: defectCfg.defectClasses || [],
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
          fieldOfViewWidth: (() => { const fov = posCfg.fieldOfView || ''; const m = fov.match(/^(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)$/); return m ? m[1] : ''; })(),
          fieldOfViewHeight: (() => { const fov = posCfg.fieldOfView || ''; const m = fov.match(/^(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)$/); return m ? m[2] : ''; })(),
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
      
      setForm(nextForm);
      setCurrentStep(0);
      baselineSnapshotRef.current = stringifyFormDraft(createModuleDraftPayload(nextForm, 0));
      setDraftDirty(false);
      setDraftReady(true);
      initializedModuleIdRef.current = module.id;
  }, [module, readDraft, resetVersion]);

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
        return form.defectClasses.length > 0;
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
  
  const isStep3Complete = useMemo(() => 
    Boolean(form.workingDistance || form.fieldOfView || form.fieldOfViewCommon),
    [form.workingDistance, form.fieldOfView, form.fieldOfViewCommon]
  );
  
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
      content: <ModuleStep1Basic form={form} setForm={setForm} />,
      isComplete: isStep1Complete,
      nextHint: isStep1Complete 
        ? '基本信息已完成，点击"下一步"配置检测参数' 
        : '请填写模块名称和选择类型后继续',
    },
    {
      id: 'detection',
      title: '检测参数',
      shortTitle: '检测',
      description: '配置模块专属的检测参数',
      content: <ModuleStep2Detection form={form} setForm={setForm} />,
      isComplete: isStep2Complete,
      nextHint: isStep2Complete 
        ? '检测参数已配置，下一步设置成像参数' 
        : '请至少配置一项关键检测参数',
    },
    {
      id: 'imaging',
      title: '成像配置',
      shortTitle: '成像',
      description: '设置工作距离、视场和光学参数',
      content: <ModuleStep3Imaging form={form} setForm={setForm} />,
      isComplete: isStep3Complete,
      nextHint: isStep3Complete 
        ? '成像参数已设置，最后配置输出和硬件' 
        : '请至少设置工作距离或视场',
    },
    {
      id: 'output',
      title: '输出与硬件',
      shortTitle: '输出',
      description: '配置输出动作、通讯方式和硬件选型',
      content: (
        <ModuleStep4Output 
          form={form} 
          setForm={setForm}
          cameras={cameras}
          lenses={lenses}
          lights={lights}
          controllers={controllers}
          workstationLayout={workstationLayout}
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
      
      const configs: any = {};
      
      // Common parameters (stored in all configs)
      const commonParams = {
        detectionObject: form.detectionObject || null,
        judgmentStrategy: form.judgmentStrategy,
        outputAction: form.outputAction,
        communicationMethod: form.communicationMethod || null,
        signalDefinition: form.signalDefinition || null,
        dataRetentionDays: form.dataRetentionDays ? parseInt(form.dataRetentionDays) : null,
      };
      
      // Imaging parameters (stored in all configs)
      const imagingParams = {
        workingDistance: form.workingDistance || null,
        fieldOfView: form.fieldOfViewCommon || form.fieldOfView || null,
        resolutionPerPixel: form.resolutionPerPixel || null,
        exposure: form.exposure || null,
        gain: form.gain ? parseFloat(form.gain) : null,
        triggerDelay: form.triggerDelay ? parseFloat(form.triggerDelay) : null,
        lightMode: form.lightMode || null,
        lightAngle: form.lightAngle || null,
        lightDistance: form.lightDistance || null,
        lightDistanceHorizontal: form.lightDistanceHorizontal || null,
        lightDistanceVertical: form.lightDistanceVertical || null,
        lensAperture: form.lensAperture || null,
        depthOfField: form.depthOfField ? parseFloat(form.depthOfField) : null,
        workingDistanceTolerance: form.workingDistanceTolerance || null,
        cameraInstallNote: form.cameraInstallNote || null,
        lightNote: form.lightNote || null,
      };
      
      if (form.type === 'defect') {
        configs.defect_config = {
          ...commonParams,
          imaging: imagingParams,
          defectClasses: form.defectClasses,
          minDefectSize: form.minDefectSize ? parseFloat(form.minDefectSize) : null,
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

      await updateModule(module.id, {
        name: form.name,
        description: form.description || null,
        type: form.type,
        trigger_type: form.triggerType as TriggerType,
        selected_camera: form.selectedCamera || null,
        selected_lens: form.selectedLens || null,
        selected_light: form.selectedLight || null,
        selected_controller: form.selectedController || null,
        processing_time_limit: parseFloat(form.processingTimeLimit) || null,
        ...configs,
        status: 'incomplete',
      });
      clearDraft();
      baselineSnapshotRef.current = stringifyFormDraft(draftPayload);
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
