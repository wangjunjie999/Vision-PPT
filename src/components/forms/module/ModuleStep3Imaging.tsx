import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditableSelect } from '@/components/ui/editable-select';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertCircle, CheckCircle2, Focus, Crosshair, Zap, ScanEye, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ModuleFormState } from './types';
import { useMemo, useEffect, useRef } from 'react';
import { calculateResolutionPerPixel, computeVisionParams, formatResolutionPerPixel } from '@/utils/visionCalcEngine';
import { useCameras, useLenses } from '@/hooks/useHardware';
import { resolveModuleHardwareSelection } from '@/utils/moduleHardwareSlots';
import { getLensImagingAutoFill, getLensImagingAutoFillKey } from '@/utils/lensImagingAutoFill';
import { getMinimumDefectSize } from '@/utils/defectItems';
import {
  getModuleLightGeometryPatch,
  type ModuleLightItem,
} from '@/utils/moduleLightItems';
import {
  DISTANCE_UNITS,
  convertDistanceInputUnit,
  type DistanceUnit,
  fromMillimeters,
  formatDistanceInput,
  normalizeDistanceUnit,
  toMillimeters,
} from '@/utils/distanceUnits';
import { ThreeDCameraForm } from './ThreeDCameraForm';
import { strip3DOpticsFromForm } from './threeDCamera';

interface ModuleStep3ImagingProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
  workstationLayout?: unknown;
}

function formatMmForCalc(value: string | undefined, unit: DistanceUnit): string | undefined {
  const mm = toMillimeters(value, unit);
  if (mm === null) return undefined;
  return String(Number(mm.toFixed(3)));
}

function formatFovInput(valueMm: number, unit: DistanceUnit): string {
  const converted = fromMillimeters(valueMm, unit);
  const precision = unit === 'm' ? 3 : 2;
  return String(Number(converted.toFixed(precision)));
}

function formatFovForCalc(
  rawFov: string,
  width: string,
  height: string,
  unit: DistanceUnit,
): string | undefined {
  const widthMm = toMillimeters(width, unit);
  const heightMm = toMillimeters(height, unit);
  if (widthMm !== null && heightMm !== null) {
    return `${Number(widthMm.toFixed(3))}×${Number(heightMm.toFixed(3))}`;
  }

  const trimmed = rawFov.trim();
  if (!trimmed) return undefined;
  const pair = trimmed.match(/^(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)$/);
  if (pair) {
    const pairWidthMm = toMillimeters(pair[1], unit);
    const pairHeightMm = toMillimeters(pair[2], unit);
    if (pairWidthMm !== null && pairHeightMm !== null) {
      return `${Number(pairWidthMm.toFixed(3))}×${Number(pairHeightMm.toFixed(3))}`;
    }
  }
  return formatMmForCalc(trimmed, unit);
}

function convertDistanceForUnit(
  value: string,
  fromUnit: DistanceUnit,
  toUnit: DistanceUnit,
  signed = false,
): string {
  return convertDistanceInputUnit(value, fromUnit, toUnit, signed);
}

const redundancyStrategyOptions = [
  { value: 'conservative', label: '保守 (≥3px)' },
  { value: 'standard', label: '标准 (≥5px)' },
  { value: 'high', label: '高冗余 (≥10px)' },
];

function parseCustomRequiredPixels(value: string | undefined): string | undefined {
  const trimmed = (value || '').trim();
  if (!trimmed || ['conservative', 'standard', 'high', 'custom'].includes(trimmed)) return undefined;
  const parsed = Number.parseFloat(trimmed.replace(/px/gi, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return String(parsed);
}

function getRedundancyStrategyForCalc(value: string | undefined): string {
  return parseCustomRequiredPixels(value) ? 'custom' : (value || 'standard');
}

export function ModuleStep3Imaging({ form, setForm, workstationLayout }: ModuleStep3ImagingProps) {
  const { cameras } = useCameras();
  const { lenses } = useLenses();
  const distanceUnit = normalizeDistanceUnit(form.distanceUnit);
  
  // 获取当前选中相机的属性
  const selectedCamera = useMemo(() => {
    if (!form.selectedCamera) return null;
    const resolved = resolveModuleHardwareSelection(form.selectedCamera, workstationLayout, 'camera', cameras);
    if (resolved?.item) return resolved.item;
    return cameras.find(c =>
      `${c.brand} ${c.model}` === form.selectedCamera || c.id === form.selectedCamera
    ) || null;
  }, [form.selectedCamera, cameras, workstationLayout]);

  const selectedCameraResolution = selectedCamera?.resolution || null;
  const selectedSensorSize = selectedCamera?.sensor_size || null;
  const selectedPixelSizeUm = (selectedCamera as { pixel_size_um?: number | null })?.pixel_size_um ?? null;
  const selectedSensorWidthMm = (selectedCamera as { sensor_width_mm?: number | null })?.sensor_width_mm ?? null;
  const selectedSensorHeightMm = (selectedCamera as { sensor_height_mm?: number | null })?.sensor_height_mm ?? null;

  // 获取选中镜头的属性
  const selectedLens = useMemo(() => {
    if (form.is3DCamera) return null;
    if (!form.selectedLens) return null;
    const resolved = resolveModuleHardwareSelection(form.selectedLens, workstationLayout, 'lens', lenses);
    if (resolved?.item) return resolved.item;
    return lenses.find(l =>
      `${l.brand} ${l.model}` === form.selectedLens || l.id === form.selectedLens
    ) || null;
  }, [form.is3DCamera, form.selectedLens, lenses, workstationLayout]);

  const hasInitializedLensAutoFillRef = useRef(false);
  const appliedLensAutoFillKeyRef = useRef('');
  const selectedLensAutoFillKey = getLensImagingAutoFillKey(selectedLens);

  useEffect(() => {
    if (!hasInitializedLensAutoFillRef.current) {
      hasInitializedLensAutoFillRef.current = true;
      appliedLensAutoFillKeyRef.current = selectedLensAutoFillKey;
      return;
    }

    if (form.is3DCamera || !selectedLens || !selectedLensAutoFillKey) {
      appliedLensAutoFillKeyRef.current = selectedLensAutoFillKey;
      return;
    }
    if (appliedLensAutoFillKeyRef.current === selectedLensAutoFillKey) return;

    const autoFill = getLensImagingAutoFill(selectedLens);
    appliedLensAutoFillKeyRef.current = selectedLensAutoFillKey;
    if (!autoFill.lensAperture && !autoFill.depthOfField) return;

    setForm(prev => {
      let changed = false;
      const next = { ...prev };

      if (autoFill.lensAperture && prev.lensAperture !== autoFill.lensAperture) {
        next.lensAperture = autoFill.lensAperture;
        changed = true;
      }

      if (autoFill.depthOfField && prev.depthOfField !== autoFill.depthOfField) {
        next.depthOfField = autoFill.depthOfField;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [form.is3DCamera, selectedLens, selectedLensAutoFillKey, setForm]);

  // 按模块分类映射目标特征尺寸
  const targetFeatureSizeMm = useMemo(() => {
    switch (form.type) {
      case 'defect': {
        const minSize = getMinimumDefectSize(form.defectItems);
        return minSize ? String(minSize) : form.minDefectSize || undefined;
      }
      case 'positioning': return form.accuracyRequirement || undefined;
      case 'measurement': return form.targetAccuracy || undefined;
      default: return form.accuracyRequirement || undefined;
    }
  }, [form.type, form.defectItems, form.minDefectSize, form.accuracyRequirement, form.targetAccuracy]);

  // 统一计算：成像参数 + 飞拍参数 + 精度分析
  const calcResult = useMemo(() => {
    const fov = form.type === 'positioning' ? form.fieldOfView : form.fieldOfViewCommon;
    const fovForCalc = formatFovForCalc(fov || '', form.fieldOfViewWidth, form.fieldOfViewHeight, distanceUnit);
    return computeVisionParams({
      cameraResolution: selectedCameraResolution || undefined,
      sensorSize: selectedSensorSize || undefined,
      pixelSizeUm: selectedPixelSizeUm ?? undefined,
      sensorWidthMm: selectedSensorWidthMm ?? undefined,
      sensorHeightMm: selectedSensorHeightMm ?? undefined,
      focalLengthStr: selectedLens?.focal_length || undefined,
      fNumberStr: form.lensAperture || undefined,
      fov: fovForCalc,
      workingDistance: formatMmForCalc(form.workingDistance, distanceUnit),
      targetAccuracy: form.accuracyRequirement || undefined,
      lensResolvingPower: selectedLens?.resolving_power?.toString() || undefined,
      lensMount: selectedLens?.mount || undefined,
      lensMaxSensorSize: selectedLens?.max_sensor_size || undefined,
      targetFeatureSizeMm,
      redundancyStrategy: getRedundancyStrategyForCalc(form.redundancyStrategy),
      customRequiredPixels: parseCustomRequiredPixels(form.redundancyStrategy),
      exposure: form.exposure || undefined,
      lineSpeed: form.lineSpeed || undefined,
      triggerType: form.triggerType,
      cameraShutterType: selectedCamera?.shutter_type || undefined,
      cameraTags: selectedCamera?.tags || undefined,
      cameraFrameRate: selectedCamera?.frame_rate?.toString() || undefined,
    });
  }, [
    form.fieldOfView, form.fieldOfViewCommon, form.type,
    selectedCameraResolution, form.accuracyRequirement,
    selectedSensorSize, selectedPixelSizeUm, selectedSensorWidthMm, selectedSensorHeightMm, selectedLens,
    form.workingDistance, form.lensAperture,
    targetFeatureSizeMm, form.redundancyStrategy,
    form.exposure, form.lineSpeed, form.triggerType,
    form.fieldOfViewWidth, form.fieldOfViewHeight, distanceUnit,
  ]);

  const calculationResult = calcResult.imaging;
  const selectedFocalLength = calcResult.parsed.focalLength;
  const oneClickCalculation = useMemo(() => {
    const cameraParsed = calculationResult.cameraParsed;
    if (!cameraParsed || cameraParsed.width <= 0 || cameraParsed.height <= 0) return null;

    const widthMm = toMillimeters(form.fieldOfViewWidth, distanceUnit);
    const heightMm = toMillimeters(form.fieldOfViewHeight, distanceUnit);

    if (widthMm !== null && heightMm !== null) {
      const resolutionPerPixel = formatResolutionPerPixel(
        calculateResolutionPerPixel({ width: widthMm, height: heightMm }, cameraParsed)
      );
      if (!resolutionPerPixel) return null;
      return {
        fieldOfViewWidth: form.fieldOfViewWidth,
        fieldOfViewHeight: form.fieldOfViewHeight,
        resolutionPerPixel,
      };
    }

    if (widthMm !== null) {
      const inferredHeightMm = widthMm * (cameraParsed.height / cameraParsed.width);
      const resolutionPerPixel = formatResolutionPerPixel(
        calculateResolutionPerPixel({ width: widthMm, height: inferredHeightMm }, cameraParsed)
      );
      if (!resolutionPerPixel) return null;
      return {
        fieldOfViewWidth: form.fieldOfViewWidth,
        fieldOfViewHeight: formatFovInput(inferredHeightMm, distanceUnit),
        resolutionPerPixel,
      };
    }

    if (heightMm !== null) {
      const inferredWidthMm = heightMm * (cameraParsed.width / cameraParsed.height);
      const resolutionPerPixel = formatResolutionPerPixel(
        calculateResolutionPerPixel({ width: inferredWidthMm, height: heightMm }, cameraParsed)
      );
      if (!resolutionPerPixel) return null;
      return {
        fieldOfViewWidth: formatFovInput(inferredWidthMm, distanceUnit),
        fieldOfViewHeight: form.fieldOfViewHeight,
        resolutionPerPixel,
      };
    }

    return null;
  }, [
    calculationResult.cameraParsed,
    distanceUnit,
    form.fieldOfViewHeight,
    form.fieldOfViewWidth,
  ]);

  const handleCalculateResolution = () => {
    if (!oneClickCalculation) return;
    const combined = `${oneClickCalculation.fieldOfViewWidth}×${oneClickCalculation.fieldOfViewHeight}`;
    setForm(p => ({
      ...p,
      fieldOfViewWidth: oneClickCalculation.fieldOfViewWidth,
      fieldOfViewHeight: oneClickCalculation.fieldOfViewHeight,
      fieldOfView: p.type === 'positioning' ? combined : p.fieldOfView,
      fieldOfViewCommon: p.type === 'positioning' ? p.fieldOfViewCommon : combined,
      resolutionPerPixel: oneClickCalculation.resolutionPerPixel || p.resolutionPerPixel,
    }));
  };

  const fovRecon = calculationResult.fovReconciliation;
  const handleApplySensorFov = () => {
    if (!calculationResult.fovFromSensor) return;
    const newW = formatFovInput(calculationResult.fovFromSensor.width, distanceUnit);
    const newH = formatFovInput(calculationResult.fovFromSensor.height, distanceUnit);
    const combined = `${newW}×${newH}`;
    const sensorPixelSize = formatResolutionPerPixel(
      calculateResolutionPerPixel(calculationResult.fovFromSensor, calculationResult.cameraParsed)
    );

    setForm(p => ({
      ...p,
      fieldOfViewWidth: newW,
      fieldOfViewHeight: newH,
      fieldOfView: p.type === 'positioning' ? combined : p.fieldOfView,
      fieldOfViewCommon: p.type === 'positioning' ? p.fieldOfViewCommon : combined,
      resolutionPerPixel: sensorPixelSize || p.resolutionPerPixel,
    }));
  };

  const applyLightItems = (prev: ModuleFormState, lightItems: ModuleLightItem[]): ModuleFormState => {
    const first = lightItems[0];
    return {
      ...prev,
      lightItems,
      selectedLight: first?.selectedLight || '',
      lightMode: first?.lightMode || '',
      lightAngle: first?.lightAngle || '',
      lightCount: lightItems.length ? String(lightItems.length) : '',
      lightDistance: first?.lightDistance || '',
      lightDistanceHorizontal: first?.lightDistanceHorizontal || '',
      lightDistanceVertical: first?.lightDistanceVertical || '',
      lightNote: first?.lightNote || '',
    };
  };

  const updateLightItem = (id: string, patch: Partial<ModuleLightItem>) => {
    setForm(prev => {
      const nextItems = prev.lightItems.map(item => item.id === id ? { ...item, ...patch } : item);
      return applyLightItems(prev, nextItems);
    });
  };

  const toggle3DCamera = () => {
    setForm(prev => (
      prev.is3DCamera
        ? { ...prev, is3DCamera: false }
        : strip3DOpticsFromForm(prev)
    ));
  };

  const threeDCameraToggle = (
    <div
      data-testid="imaging-3d-camera-toggle"
      className="rounded-lg border border-border/60 bg-muted/30 p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <ScanEye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <div className="text-sm font-semibold">是否使用 3D 相机</div>
            <p className="text-xs leading-5 text-muted-foreground">
              {form.is3DCamera
                ? '当前模块使用 3D 成像流程，可在下方填写 3D 光学方案和测量方法。'
                : '开启后将切换为 3D 专属表单，并清空镜头、光源和 2D 光学参数。'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={form.is3DCamera ? 'default' : 'outline'}
          onClick={toggle3DCamera}
          className="shrink-0"
        >
          {form.is3DCamera ? '已启用 3D 相机' : '是否使用 3D 相机'}
        </Button>
      </div>
    </div>
  );

  if (form.is3DCamera) {
    return (
      <div className="space-y-6">
        {threeDCameraToggle}
        <div data-testid="three-d-imaging-form">
          <ThreeDCameraForm form={form} setForm={setForm} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {threeDCameraToggle}

      {/* Auto-calculation status banner */}
      {selectedCameraResolution && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">已选相机:</span>
            <Badge variant="secondary" className="font-mono">
              {selectedCameraResolution}
            </Badge>
            {calculationResult.cameraParsed && (
              <span className="text-xs text-muted-foreground">
                ({calculationResult.cameraParsed.width}×{calculationResult.cameraParsed.height} px)
              </span>
            )}
          </div>
          
          {/* Precision analysis card */}
          {calculationResult.resolutionPerPixel && (
            <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">像素精度:</span>
                  <code className="px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono">
                    {calculationResult.resolutionPerPixel} mm/px
                  </code>
                </div>
                {calculationResult.precisionAnalysis && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">特征覆盖:</span>
                    <code className={`px-1.5 py-0.5 rounded font-mono ${
                      calculationResult.precisionAnalysis.status === 'sufficient'
                        ? 'bg-primary/10 text-primary'
                        : calculationResult.precisionAnalysis.status === 'marginal'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'bg-destructive/10 text-destructive'
                    }`}>
                      {calculationResult.precisionAnalysis.featurePixels} px
                    </code>
                  </div>
                )}
                {calculationResult.precisionAnalysis ? (
                  <div className="flex items-center gap-1">
                    {calculationResult.precisionAnalysis.status === 'sufficient' ? (
                      <><CheckCircle2 className="h-4 w-4 text-primary" /><span className="text-primary text-xs">精度充足</span></>
                    ) : calculationResult.precisionAnalysis.status === 'marginal' ? (
                      <><AlertCircle className="h-4 w-4 text-amber-500" /><span className="text-amber-600 dark:text-amber-400 text-xs">精度极限</span></>
                    ) : (
                      <><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-destructive text-xs">精度不足</span></>
                    )}
                  </div>
                ) : calculationResult.meetsAccuracy !== null && (
                  <div className="flex items-center gap-1">
                    {calculationResult.meetsAccuracy ? (
                      <><CheckCircle2 className="h-4 w-4 text-primary" /><span className="text-primary text-xs">满足精度要求</span></>
                    ) : (
                      <><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-destructive text-xs">精度可能不足</span></>
                    )}
                  </div>
                )}
              </div>
              {calculationResult.precisionAnalysis && (
                <div className="text-xs text-muted-foreground">
                  {calculationResult.precisionAnalysis.message}
                </div>
              )}
            </div>
          )}
          
          {/* Recommendation when accuracy not met */}
          {calculationResult.recommendedCamera && !calculationResult.meetsAccuracy && (
            <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
              建议使用更高分辨率相机: {calculationResult.recommendedCamera}
            </div>
          )}

          {/* Extended optical parameters */}
          {(calculationResult.magnification || calculationResult.depthOfField || calculationResult.recommendedFocalLength || calculationResult.fovFromSensor || calculationResult.fovParsed) && (
            <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {calculationResult.fovParsed && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">当前保存FOV:</span>
                  <code className="px-1 bg-primary/10 text-primary rounded font-mono">
                    {calculationResult.fovParsed.width}×{calculationResult.fovParsed.height}
                  </code>
                </div>
              )}
              {calculationResult.magnification !== null && (
                <div className="flex items-center gap-1">
                  <Focus className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">倍率:</span>
                  <code className="px-1 bg-muted rounded font-mono">
                    {calculationResult.magnification.toFixed(4)}×
                  </code>
                </div>
              )}
              {calculationResult.depthOfField !== null && (
                <div className="flex items-center gap-1">
                  <Crosshair className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">景深:</span>
                  <code className="px-1 bg-muted rounded font-mono">
                    {calculationResult.depthOfField} mm
                  </code>
                </div>
              )}
              {calculationResult.recommendedFocalLength !== null && !selectedFocalLength && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">推荐焦距:</span>
                  <code className="px-1 bg-primary/10 text-primary rounded font-mono">
                    {calculationResult.recommendedFocalLength} mm
                  </code>
                </div>
              )}
              {calculationResult.workingDistance !== null && selectedFocalLength && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">推算WD:</span>
                  <code className="px-1 bg-muted rounded font-mono">
                    {calculationResult.workingDistance} mm
                  </code>
                </div>
              )}
              {calculationResult.fovFromSensor && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">靶面推算FOV:</span>
                  <code className="px-1 bg-muted rounded font-mono">
                    {calculationResult.fovFromSensor.width}×{calculationResult.fovFromSensor.height}
                  </code>
                  {calculationResult.sensorSourceLabel && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary whitespace-nowrap shrink-0">
                      {calculationResult.sensorSourceLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lens-Camera match indicator */}
          {calculationResult.lensCameraMatch && (
            <div className={`mt-2 pt-2 border-t border-border/50 flex items-center gap-2 text-xs ${
              calculationResult.lensCameraMatch.status === 'lens_insufficient'
                ? 'text-destructive'
                : calculationResult.lensCameraMatch.status === 'camera_redundant'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-primary'
            }`}>
              <ScanEye className="h-3.5 w-3.5 shrink-0" />
              <span>{calculationResult.lensCameraMatch.message}</span>
              <code className="px-1 bg-muted text-muted-foreground rounded font-mono ml-auto shrink-0">
                {calculationResult.lensCameraMatch.ratio}:1
                {calculationResult.lensCameraMatch.lensIsEstimated ? ' (估)' : ''}
              </code>
            </div>
          )}
          {calculationResult.lensCameraMatch?.suggestion && (
            <div className={`text-xs px-2 py-1.5 rounded ${
              calculationResult.lensCameraMatch.status === 'lens_insufficient'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            }`}>
              {calculationResult.lensCameraMatch.suggestion}
            </div>
          )}

          {/* Sensor compatibility / tunnel effect checks */}
          {calculationResult.sensorCheck && calculationResult.sensorCheck.items.filter(i => i.severity !== 'ok').length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
              {calculationResult.sensorCheck.items.filter(i => i.severity !== 'ok').map(item => (
                <div key={item.id} className={`flex items-start gap-2 text-xs ${
                  item.severity === 'error'
                    ? 'text-destructive'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {item.severity === 'error'
                    ? <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    : <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-medium">{item.message}</span>
                    <span className="block text-muted-foreground">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {!selectedCameraResolution && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>请先在"基本"步骤中选择工位相机槽位，以启用自动计算功能</span>
          </div>
        </div>
      )}

      {/* Core optical parameters */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">核心参数</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">工作距离 WD ({distanceUnit})</Label>
              <Input 
                value={form.workingDistance || ''} 
                onChange={e => setForm(p => ({ ...p, workingDistance: e.target.value }))}
                placeholder="300"
                className="h-9" 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">视场 FOV ({distanceUnit})</Label>
              <div className="flex items-center gap-1.5">
                <Input 
                  value={form.fieldOfViewWidth || ''} 
                  onChange={e => {
                    const w = e.target.value;
                    const h = form.fieldOfViewHeight || '';
                    const combined = w && h ? `${w}×${h}` : '';
                    if (form.type === 'positioning') {
                      setForm(p => ({ ...p, fieldOfViewWidth: w, fieldOfView: combined }));
                    } else {
                      setForm(p => ({ ...p, fieldOfViewWidth: w, fieldOfViewCommon: combined }));
                    }
                  }}
                  placeholder="宽"
                  className="h-9 w-full" 
                  type="number"
                />
                <span className="text-muted-foreground text-sm shrink-0">×</span>
                <Input 
                  value={form.fieldOfViewHeight || ''} 
                  onChange={e => {
                    const h = e.target.value;
                    const w = form.fieldOfViewWidth || '';
                    const combined = w && h ? `${w}×${h}` : '';
                    if (form.type === 'positioning') {
                      setForm(p => ({ ...p, fieldOfViewHeight: h, fieldOfView: combined }));
                    } else {
                      setForm(p => ({ ...p, fieldOfViewHeight: h, fieldOfViewCommon: combined }));
                    }
                  }}
                  placeholder="高"
                  className="h-9 w-full" 
                  type="number"
                />
                {calculationResult.fovParsed && !fovRecon?.wasAdjusted && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                {fovRecon?.wasAdjusted && (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
              </div>
              {fovRecon?.wasAdjusted && fovRecon.message && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  {fovRecon.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[12rem] max-w-md space-y-1.5">
              <Label className="text-xs font-medium">分辨率 (mm/px)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.resolutionPerPixel || ''}
                  onChange={e => setForm(p => ({ ...p, resolutionPerPixel: e.target.value }))}
                  placeholder="0.1"
                  className="h-9 min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 px-3"
                  onClick={handleCalculateResolution}
                  disabled={!oneClickCalculation}
                >
                  <Calculator className="h-3.5 w-3.5" />
                  一键计算
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 px-3"
                  onClick={handleApplySensorFov}
                  disabled={!calculationResult.fovFromSensor}
                >
                  应用推算FOV
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 w-24 shrink-0">
              <Label className="text-xs font-medium">距离单位</Label>
              <Select
                value={distanceUnit}
                onValueChange={value => {
                  const nextUnit = normalizeDistanceUnit(value);
                  setForm(p => {
                    const currentUnit = normalizeDistanceUnit(p.distanceUnit);
                    if (currentUnit === nextUnit) return p;
                    const fieldOfViewWidth = convertDistanceForUnit(p.fieldOfViewWidth, currentUnit, nextUnit);
                    const fieldOfViewHeight = convertDistanceForUnit(p.fieldOfViewHeight, currentUnit, nextUnit);
                    const combinedFov = fieldOfViewWidth && fieldOfViewHeight ? `${fieldOfViewWidth}×${fieldOfViewHeight}` : '';
                    return {
                      ...p,
                      distanceUnit: nextUnit,
                      workingDistance: convertDistanceForUnit(p.workingDistance, currentUnit, nextUnit),
                      fieldOfViewWidth,
                      fieldOfViewHeight,
                      fieldOfView: p.type === 'positioning' && combinedFov ? combinedFov : p.fieldOfView,
                      fieldOfViewCommon: p.type !== 'positioning' && combinedFov ? combinedFov : p.fieldOfViewCommon,
                      lightDistance: convertDistanceForUnit(p.lightDistance, currentUnit, nextUnit),
                      lightDistanceHorizontal: convertDistanceForUnit(p.lightDistanceHorizontal, currentUnit, nextUnit, true),
                      lightDistanceVertical: convertDistanceForUnit(p.lightDistanceVertical, currentUnit, nextUnit, true),
                      lightItems: p.lightItems.map(item => ({
                        ...item,
                        lightDistance: convertDistanceForUnit(item.lightDistance, currentUnit, nextUnit),
                        lightDistanceHorizontal: convertDistanceForUnit(item.lightDistanceHorizontal, currentUnit, nextUnit, true),
                        lightDistanceVertical: convertDistanceForUnit(item.lightDistanceVertical, currentUnit, nextUnit, true),
                      })),
                      workingDistanceTolerance: convertDistanceForUnit(p.workingDistanceTolerance, currentUnit, nextUnit),
                    };
                  });
                }}
              >
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISTANCE_UNITS.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">像素冗余策略</Label>
              <EditableSelect
                value={form.redundancyStrategy}
                onValueChange={v => setForm(p => ({ ...p, redundancyStrategy: v }))}
                options={redundancyStrategyOptions}
                placeholder="选择策略"
                customLabel="自定义像素数..."
                inputPlaceholder="输入自定义像素数，例如 7 或 7px"
                inputHint="示例： 7 或 7px"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">工作距离公差 (±{distanceUnit})</Label>
              <Input
                value={form.workingDistanceTolerance || ''}
                onChange={e => setForm(p => ({ ...p, workingDistanceTolerance: e.target.value }))}
                placeholder="例如: 15"
                className="h-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Exposure and gain */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">曝光控制</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">曝光时间</Label>
            <Input 
              value={form.exposure || ''} 
              onChange={e => setForm(p => ({ ...p, exposure: e.target.value }))} 
              placeholder="10ms"
              className="h-9" 
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">增益 (dB)</Label>
            <Input 
              value={form.gain || ''} 
              onChange={e => setForm(p => ({ ...p, gain: e.target.value }))} 
              placeholder="0"
              className="h-9" 
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">触发延时</Label>
            <Input 
              value={form.triggerDelay || ''} 
              onChange={e => setForm(p => ({ ...p, triggerDelay: e.target.value }))} 
              placeholder="0ms"
              className="h-9" 
            />
          </div>
        </div>
      </div>

      {/* Flying shot analysis (visible for encoder/continuous trigger) */}
      {calcResult.flyingShot && (
        <div className={`p-3 rounded-lg border space-y-2 ${
          calcResult.flyingShot.overallRisk === 'critical'
            ? 'border-destructive/50 bg-destructive/5'
            : calcResult.flyingShot.overallRisk === 'high'
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-border/50 bg-muted/30'
        }`}>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">飞拍分析</span>
            {calcResult.flyingShot.suitable ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-destructive ml-auto" />
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">运动模糊:</span>{' '}
              <code className={`px-1 rounded font-mono ${calcResult.flyingShot.params.isBlurAcceptable ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                {calcResult.flyingShot.params.motionBlurPixels} px
              </code>
            </div>
            <div>
              <span className="text-muted-foreground">最大曝光:</span>{' '}
              <code className="px-1 bg-muted rounded font-mono">{calcResult.flyingShot.params.maxExposureUs} us</code>
            </div>
            <div>
              <span className="text-muted-foreground">最大速度:</span>{' '}
              <code className="px-1 bg-muted rounded font-mono">{calcResult.flyingShot.params.maxLineSpeed} mm/s</code>
            </div>
            {calcResult.flyingShot.params.triggerFrequencyHz !== null && (
              <div>
                <span className="text-muted-foreground">触发频率:</span>{' '}
                <code className="px-1 bg-muted rounded font-mono">{calcResult.flyingShot.params.triggerFrequencyHz} Hz</code>
              </div>
            )}
            {calcResult.flyingShot.params.lineFrequencyHz !== null && (
              <div>
                <span className="text-muted-foreground">行频:</span>{' '}
                <code className="px-1 bg-muted rounded font-mono">{calcResult.flyingShot.params.lineFrequencyHz} Hz</code>
              </div>
            )}
          </div>
          {calcResult.flyingShot.issues.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/30">
              {calcResult.flyingShot.issues.map(issue => (
                <div key={issue.id} className={`flex items-start gap-1.5 text-xs ${
                  issue.risk === 'critical' ? 'text-destructive' : issue.risk === 'high' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                }`}>
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!form.is3DCamera && (
        <>
          {/* Light source parameters */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">光源参数</h4>
            {form.lightItems.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
                暂未配置模块光源。请先在“基本信息”的光源型号区域添加 LIGHT。
              </div>
            ) : (
              <div className="space-y-3">
                {form.lightItems.map((item, index) => (
                  <div key={item.id} className="space-y-3 rounded-lg border bg-muted/10 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">LIGHT{index + 1} 参数</div>
                      <div className="text-xs text-muted-foreground">
                        {item.selectedLight || '未选择型号'}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">光源模式</Label>
                        <EditableSelect
                          value={item.lightMode}
                          onValueChange={v => updateLightItem(item.id, { lightMode: v })}
                          options={['常亮', '频闪', 'PWM']}
                          placeholder="选择"
                          inputPlaceholder="请输入工作模式"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">光源角度</Label>
                        <Input
                          value={item.lightAngle || ''}
                          onChange={e => updateLightItem(item.id, { lightAngle: e.target.value })}
                          placeholder="45°"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">空间距离 ({distanceUnit})</Label>
                        <Input
                          value={item.lightDistance || ''}
                          onChange={e => updateLightItem(item.id, getModuleLightGeometryPatch(item, { lightDistance: e.target.value }))}
                          placeholder="100"
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">水平距离 ({distanceUnit})</Label>
                        <Input
                          value={item.lightDistanceHorizontal || ''}
                          onChange={e => updateLightItem(item.id, getModuleLightGeometryPatch(item, { lightDistanceHorizontal: e.target.value }))}
                          placeholder="50-70"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">垂直距离 ({distanceUnit})</Label>
                        <Input
                          value={item.lightDistanceVertical || ''}
                          onChange={e => updateLightItem(item.id, getModuleLightGeometryPatch(item, { lightDistanceVertical: e.target.value }))}
                          placeholder="80-100"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">光源备注</Label>
                        <Input
                          value={item.lightNote || ''}
                          onChange={e => updateLightItem(item.id, { lightNote: e.target.value })}
                          placeholder="例如: 光源暂不下单"
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lens parameters */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">镜头参数</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">光圈 (F值)</Label>
                <Input 
                  value={form.lensAperture || ''} 
                  onChange={e => setForm(p => ({ ...p, lensAperture: e.target.value }))} 
                  placeholder="F2.8"
                  className="h-9" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">靶面尺寸</Label>
                <Input 
                  value={form.depthOfField || ''} 
                  onChange={e => setForm(p => ({ ...p, depthOfField: e.target.value }))} 
                  placeholder='例如: 2/3"'
                  className="h-9" 
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Camera installation notes */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">相机安装说明</h4>
        <div className="space-y-1.5">
          <Input 
            value={form.cameraInstallNote || ''} 
            onChange={e => setForm(p => ({ ...p, cameraInstallNote: e.target.value }))} 
            placeholder="例如: 相机芯片长边与产品长边方向平行"
            className="h-9" 
          />
        </div>
      </div>
    </div>
  );
}
