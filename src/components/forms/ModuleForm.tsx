import { useData } from '@/contexts/DataContext';
import { useCameras, useLenses, useLights, useControllers } from '@/hooks/useHardware';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Copy } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { HardwareSelector } from '@/components/hardware/HardwareSelector';
import { PositioningForm } from './module/PositioningForm';
import { DefectForm } from './module/DefectForm';
import { OCRForm } from './module/OCRForm';
import { MeasurementForm } from './module/MeasurementForm';
import { DeepLearningForm } from './module/DeepLearningForm';
import { ModuleFormState, getDefaultFormState } from './module/types';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

type ModuleType = 'positioning' | 'defect' | 'ocr' | 'deeplearning' | 'measurement';
type TriggerType = 'io' | 'encoder' | 'software' | 'continuous';

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
  
  const module = modules.find(m => m.id === selectedModuleId) as any;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ModuleFormState>(getDefaultFormState());
  
  // Get workstation layout for hardware inheritance
  const workstationLayout = module ? getLayoutByWorkstation(module.workstation_id) : null;

  useEffect(() => {
    if (module) {
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
        resolutionPerPixel: cfg.imaging.resolutionPerPixel || '',
        exposure: cfg.imaging.exposure || '',
        gain: cfg.imaging.gain?.toString() || '',
        triggerDelay: cfg.imaging.triggerDelay?.toString() || '',
        lightMode: cfg.imaging.lightMode || '',
        lightAngle: cfg.imaging.lightAngle || '',
        lightDistance: cfg.imaging.lightDistance || '',
        lensAperture: cfg.imaging.lensAperture || '',
        depthOfField: cfg.imaging.depthOfField?.toString() || '',
      } : {};
      
      setForm({
        ...getDefaultFormState(),
        name: module.name,
        description: (module as any).description || '',
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
          minDefectSize: defectCfg.minDefectSize?.toString() || '0.5',
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
      });
    }
  }, [module]);

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
        lensAperture: form.lensAperture || null,
        depthOfField: form.depthOfField ? parseFloat(form.depthOfField) : null,
      };
      
      if (form.type === 'defect') {
        configs.defect_config = {
          ...commonParams,
          imaging: imagingParams,
          defectClasses: form.defectClasses,
          minDefectSize: parseFloat(form.minDefectSize) || 0.5,
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
      
      toast.success('模块配置已保存');
    } catch (error) {
      console.error('Failed to save module:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">模块配置</span>
          <Badge variant="outline" className="text-xs">
            {moduleTypeLabels[form.type]}
          </Badge>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          保存
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* 第一部分：基本信息 */}
        <div className="form-section">
          <h3 className="form-section-title">
            <span className="w-1 h-4 bg-destructive rounded-full" />
            基本信息
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">模块名称 *</Label>
                <Input 
                  value={form.name} 
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
                  className="h-9" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">模块类型</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as ModuleType }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positioning">引导定位</SelectItem>
                    <SelectItem value="defect">缺陷检测</SelectItem>
                    <SelectItem value="ocr">OCR识别</SelectItem>
                    <SelectItem value="measurement">尺寸测量</SelectItem>
                    <SelectItem value="deeplearning">深度学习</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">功能说明</Label>
              <Textarea 
                value={form.description} 
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
                placeholder="描述该模块的检测目的、关键要求等..."
                className="min-h-[50px] text-sm resize-none" 
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">触发方式</Label>
                <Select value={form.triggerType} onValueChange={v => setForm(p => ({ ...p, triggerType: v as TriggerType }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="io">IO触发</SelectItem>
                    <SelectItem value="encoder">编码器</SelectItem>
                    <SelectItem value="software">软件触发</SelectItem>
                    <SelectItem value="continuous">连续采集</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">处理时限 (ms)</Label>
                <Input 
                  type="number"
                  value={form.processingTimeLimit} 
                  onChange={e => setForm(p => ({ ...p, processingTimeLimit: e.target.value }))} 
                  placeholder="200"
                  className="h-9" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* 共通参数区块 */}
        <div className="form-section">
          <h3 className="form-section-title">
            <span className="w-1 h-4 bg-accent rounded-full" />
            共通参数
          </h3>
          <div className="space-y-4">
            {/* 检测对象描述 */}
            <div className="space-y-1">
              <Label className="text-xs">检测对象/检测内容描述</Label>
              <Textarea 
                value={form.detectionObject} 
                onChange={e => setForm(p => ({ ...p, detectionObject: e.target.value }))} 
                placeholder="描述该模块的检测对象、关键要求等..."
                className="min-h-[60px] text-sm resize-none" 
              />
            </div>
            
            {/* 判定策略 */}
            <div className="space-y-1">
              <Label className="text-xs">判定策略</Label>
              <Select 
                value={form.judgmentStrategy} 
                onValueChange={v => setForm(p => ({ ...p, judgmentStrategy: v as 'no_miss' | 'balanced' | 'allow_pass' }))}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_miss">宁可误杀不可漏检</SelectItem>
                  <SelectItem value="balanced">平衡</SelectItem>
                  <SelectItem value="allow_pass">宁可放行</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* 输出动作 */}
            <div className="space-y-2">
              <Label className="text-xs">输出动作</Label>
              <div className="grid grid-cols-2 gap-2">
                {['报警', '停机', '剔除', '标记', '上传MES', '存图'].map(action => (
                  <label key={action} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted">
                    <Checkbox
                      checked={form.outputAction.includes(action)}
                      onCheckedChange={(checked) => {
                        setForm(p => ({
                          ...p,
                          outputAction: checked 
                            ? [...p.outputAction, action]
                            : p.outputAction.filter(a => a !== action)
                        }));
                      }}
                    />
                    <span className="text-xs">{action}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* 通讯方式和信号定义 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">通讯方式</Label>
                <Select 
                  value={form.communicationMethod} 
                  onValueChange={v => setForm(p => ({ ...p, communicationMethod: v }))}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="请选择" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IO">IO</SelectItem>
                    <SelectItem value="PLC">PLC</SelectItem>
                    <SelectItem value="TCP">TCP</SelectItem>
                    <SelectItem value="串口">串口</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">信号定义</Label>
                <Input 
                  value={form.signalDefinition} 
                  onChange={e => setForm(p => ({ ...p, signalDefinition: e.target.value }))} 
                  placeholder="简要说明"
                  className="h-9" 
                />
              </div>
            </div>
            
            {/* 数据留存策略 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">数据留存策略</Label>
                <Select 
                  value={form.dataRetention} 
                  onValueChange={v => setForm(p => ({ ...p, dataRetention: v as any }))}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不保存</SelectItem>
                    <SelectItem value="ng_only">NG存图</SelectItem>
                    <SelectItem value="all">全存</SelectItem>
                    <SelectItem value="sampled">抽检比例</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">保存天数</Label>
                <Input 
                  type="number"
                  value={form.dataRetentionDays} 
                  onChange={e => setForm(p => ({ ...p, dataRetentionDays: e.target.value }))} 
                  placeholder="30"
                  className="h-9" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* 成像与光学参数 */}
        <div className="form-section">
          <h3 className="form-section-title">
            <span className="w-1 h-4 bg-primary rounded-full" />
            成像与光学参数
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">工作距离 WD (mm)</Label>
                <Textarea 
                  value={form.workingDistance || form.fieldOfView ? (form.type === 'positioning' ? form.workingDistance : '') : ''} 
                  onChange={e => {
                    if (form.type === 'positioning') {
                      setForm(p => ({ ...p, workingDistance: e.target.value }));
                    } else {
                      setForm(p => ({ ...p, workingDistance: e.target.value }));
                    }
                  }}
                  placeholder="例如: 300"
                  className="min-h-[60px] resize-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">视野 FOV (mm×mm)</Label>
                <Textarea 
                  value={form.fieldOfViewCommon || (form.type === 'positioning' ? form.fieldOfView : '')} 
                  onChange={e => {
                    if (form.type === 'positioning') {
                      setForm(p => ({ ...p, fieldOfView: e.target.value }));
                    } else {
                      setForm(p => ({ ...p, fieldOfViewCommon: e.target.value }));
                    }
                  }}
                  placeholder="例如: 100×80"
                  className="min-h-[60px] resize-none" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">分辨率换算 (mm/px)</Label>
                <Textarea 
                  value={form.resolutionPerPixel} 
                  onChange={e => setForm(p => ({ ...p, resolutionPerPixel: e.target.value }))} 
                  placeholder="例如: 0.1"
                  className="min-h-[60px] resize-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">曝光 (us/ms)</Label>
                <Textarea 
                  value={form.exposure} 
                  onChange={e => setForm(p => ({ ...p, exposure: e.target.value }))} 
                  placeholder="例如: 10ms"
                  className="min-h-[60px] resize-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">增益 (dB)</Label>
                <Textarea 
                  value={form.gain} 
                  onChange={e => setForm(p => ({ ...p, gain: e.target.value }))} 
                  placeholder="例如: 0"
                  className="min-h-[60px] resize-none" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">触发延时 (ms)</Label>
                <Textarea 
                  value={form.triggerDelay} 
                  onChange={e => setForm(p => ({ ...p, triggerDelay: e.target.value }))} 
                  placeholder="例如: 0"
                  className="min-h-[60px] resize-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">光源模式</Label>
                <Select 
                  value={form.lightMode} 
                  onValueChange={v => setForm(p => ({ ...p, lightMode: v }))}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="请选择" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="常亮">常亮</SelectItem>
                    <SelectItem value="频闪">频闪</SelectItem>
                    <SelectItem value="PWM">PWM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">光源角度</Label>
                <Textarea 
                  value={form.lightAngle} 
                  onChange={e => setForm(p => ({ ...p, lightAngle: e.target.value }))} 
                  placeholder="例如: 45°"
                  className="min-h-[60px] resize-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">光源距离 (mm)</Label>
                <Textarea 
                  value={form.lightDistance} 
                  onChange={e => setForm(p => ({ ...p, lightDistance: e.target.value }))} 
                  placeholder="例如: 100"
                  className="min-h-[60px] resize-none" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">镜头光圈 (F值)</Label>
                <Textarea 
                  value={form.lensAperture} 
                  onChange={e => setForm(p => ({ ...p, lensAperture: e.target.value }))} 
                  placeholder="例如: F2.8"
                  className="min-h-[60px] resize-none" 
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">景深要求 (mm)</Label>
              <Input 
                type="number"
                value={form.depthOfField} 
                onChange={e => setForm(p => ({ ...p, depthOfField: e.target.value }))} 
                placeholder="例如: 5"
                className="h-9" 
              />
            </div>
          </div>
        </div>

        {/* 第二部分：类型专属配置 */}
        {form.type === 'positioning' && <PositioningForm form={form} setForm={setForm} />}
        {form.type === 'defect' && <DefectForm form={form} setForm={setForm} />}
        {form.type === 'ocr' && <OCRForm form={form} setForm={setForm} />}
        {form.type === 'measurement' && <MeasurementForm form={form} setForm={setForm} />}
        {form.type === 'deeplearning' && <DeepLearningForm form={form} setForm={setForm} />}

        {/* 第三部分：硬件选型 */}
        <div className="form-section">
          <div className="flex items-center justify-between mb-3">
            <h3 className="form-section-title">
              <span className="w-1 h-4 bg-primary rounded-full" />
              硬件选型
            </h3>
            {workstationLayout && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => {
                  const selectedCameras = (workstationLayout as any)?.selected_cameras || [];
                  const selectedLenses = (workstationLayout as any)?.selected_lenses || [];
                  const selectedLights = (workstationLayout as any)?.selected_lights || [];
                  const selectedController = (workstationLayout as any)?.selected_controller;
                  
                  setForm(p => ({
                    ...p,
                    selectedCamera: selectedCameras.length > 0 ? selectedCameras[0].id : '',
                    selectedLens: selectedLenses.length > 0 ? selectedLenses[0].id : '',
                    selectedLight: selectedLights.length > 0 ? selectedLights[0].id : '',
                    selectedController: selectedController ? selectedController.id : '',
                  }));
                  toast.success('已套用工位硬件配置');
                }}
              >
                <Copy className="h-3 w-3" />
                一键套用工位硬件
              </Button>
            )}
          </div>
          {workstationLayout && (
            <div className="mb-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              提示：通常模块硬件继承工位配置，只有特殊模块才需要覆盖
            </div>
          )}
          <div className="space-y-4">
            <HardwareSelector
              type="camera"
              items={cameras}
              selectedId={form.selectedCamera}
              onSelect={(id) => setForm(p => ({ ...p, selectedCamera: id }))}
            />
            <HardwareSelector
              type="lens"
              items={lenses}
              selectedId={form.selectedLens}
              onSelect={(id) => setForm(p => ({ ...p, selectedLens: id }))}
            />
            <HardwareSelector
              type="light"
              items={lights}
              selectedId={form.selectedLight}
              onSelect={(id) => setForm(p => ({ ...p, selectedLight: id }))}
              recommendation={
                form.type === 'ocr' && form.charType === 'laser' ? '同轴/条形光' : undefined
              }
            />
            <HardwareSelector
              type="controller"
              items={controllers}
              selectedId={form.selectedController}
              onSelect={(id) => setForm(p => ({ ...p, selectedController: id }))}
              recommendation={
                form.type === 'deeplearning' && form.deployTarget === 'gpu' ? '带GPU配置' : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
