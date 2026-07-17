import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, Calculator, CheckCircle2, ScanLine, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditableSelect } from '@/components/ui/editable-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCameras, useLenses } from '@/hooks/useHardware';
import { resolveModuleHardwareSelection } from '@/utils/moduleHardwareSlots';
import { getModuleLightGeometryPatch, type ModuleLightItem } from '@/utils/moduleLightItems';
import {
  DISTANCE_UNITS,
  convertDistanceInputUnit,
  fromMillimeters,
  normalizeDistanceUnit,
  toMillimeters,
  type DistanceUnit,
} from '@/utils/distanceUnits';
import { computeVisionParams, formatResolutionPerPixel } from '@/utils/visionCalcEngine';
import type { ModuleFormState } from './types';

interface LineScanCameraFormProps {
  form: ModuleFormState;
  setForm: Dispatch<SetStateAction<ModuleFormState>>;
  workstationLayout?: unknown;
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getLineScanPixelCount(resolution: string | null | undefined): number | null {
  const values = String(resolution || '')
    .match(/\d+(?:\.\d+)?/g)
    ?.map(value => Number.parseFloat(value))
    .filter(value => Number.isFinite(value) && value > 0) || [];
  return values.length > 0 ? Math.max(...values) : null;
}

export function calculateLineScanResolutionPerPixel(
  fieldOfView: string,
  distanceUnit: DistanceUnit,
  cameraResolution: string | null | undefined,
): string {
  const fieldOfViewMm = toMillimeters(fieldOfView, distanceUnit);
  const pixels = getLineScanPixelCount(cameraResolution);
  if (fieldOfViewMm === null || fieldOfViewMm <= 0 || pixels === null) return '';
  return formatResolutionPerPixel(fieldOfViewMm / pixels);
}

function formatFovInput(valueMm: number, unit: DistanceUnit): string {
  const converted = fromMillimeters(valueMm, unit);
  return String(Number(converted.toFixed(unit === 'm' ? 3 : 2)));
}

function convertDistance(
  value: string,
  fromUnit: DistanceUnit,
  toUnit: DistanceUnit,
  signed = false,
): string {
  return convertDistanceInputUnit(value, fromUnit, toUnit, signed);
}

export function convertLineScanDistanceUnit(
  prev: ModuleFormState,
  nextUnitValue: string,
): ModuleFormState {
  const nextUnit = normalizeDistanceUnit(nextUnitValue);
  const currentUnit = normalizeDistanceUnit(prev.distanceUnit);
  if (currentUnit === nextUnit) return prev;
  const fieldOfViewWidth = convertDistance(prev.fieldOfViewWidth, currentUnit, nextUnit);
  const fieldOfViewHeight = convertDistance(prev.fieldOfViewHeight, currentUnit, nextUnit);
  const combinedFov = fieldOfViewWidth && fieldOfViewHeight
    ? `${fieldOfViewWidth}×${fieldOfViewHeight}`
    : '';
  return {
    ...prev,
    distanceUnit: nextUnit,
    workingDistance: convertDistance(prev.workingDistance, currentUnit, nextUnit),
    fieldOfViewWidth,
    fieldOfViewHeight,
    fieldOfView: prev.type === 'positioning' && combinedFov ? combinedFov : prev.fieldOfView,
    fieldOfViewCommon: prev.type !== 'positioning' && combinedFov ? combinedFov : prev.fieldOfViewCommon,
    lineScan: {
      ...prev.lineScan,
      fieldOfView: convertDistance(prev.lineScan.fieldOfView, currentUnit, nextUnit),
    },
    lightDistance: convertDistance(prev.lightDistance, currentUnit, nextUnit),
    lightDistanceHorizontal: convertDistance(prev.lightDistanceHorizontal, currentUnit, nextUnit, true),
    lightDistanceVertical: convertDistance(prev.lightDistanceVertical, currentUnit, nextUnit, true),
    lightItems: prev.lightItems.map(item => ({
      ...item,
      lightDistance: convertDistance(item.lightDistance, currentUnit, nextUnit),
      lightDistanceHorizontal: convertDistance(item.lightDistanceHorizontal, currentUnit, nextUnit, true),
      lightDistanceVertical: convertDistance(item.lightDistanceVertical, currentUnit, nextUnit, true),
    })),
    workingDistanceTolerance: convertDistance(prev.workingDistanceTolerance, currentUnit, nextUnit),
  };
}

export function LineScanCameraForm({ form, setForm, workstationLayout }: LineScanCameraFormProps) {
  const { cameras } = useCameras();
  const { lenses } = useLenses();
  const distanceUnit = normalizeDistanceUnit(form.distanceUnit);

  const selectedCamera = useMemo(() => {
    if (!form.selectedCamera) return null;
    const resolved = resolveModuleHardwareSelection(form.selectedCamera, workstationLayout, 'camera', cameras);
    if (resolved?.item) return resolved.item;
    return cameras.find(camera =>
      camera.id === form.selectedCamera || `${camera.brand} ${camera.model}` === form.selectedCamera
    ) || null;
  }, [cameras, form.selectedCamera, workstationLayout]);

  const selectedLens = useMemo(() => {
    if (!form.selectedLens) return null;
    const resolved = resolveModuleHardwareSelection(form.selectedLens, workstationLayout, 'lens', lenses);
    if (resolved?.item) return resolved.item;
    return lenses.find(lens =>
      lens.id === form.selectedLens || `${lens.brand} ${lens.model}` === form.selectedLens
    ) || null;
  }, [form.selectedLens, lenses, workstationLayout]);

  const cameraResolution = selectedCamera?.resolution || null;
  const pixelCount = getLineScanPixelCount(cameraResolution);
  const calculatedResolution = useMemo(
    () => calculateLineScanResolutionPerPixel(form.lineScan.fieldOfView, distanceUnit, cameraResolution),
    [cameraResolution, distanceUnit, form.lineScan.fieldOfView],
  );

  const opticalCalculation = useMemo(() => computeVisionParams({
    cameraResolution: cameraResolution || undefined,
    sensorSize: selectedCamera?.sensor_size || undefined,
    pixelSizeUm: (selectedCamera as { pixel_size_um?: number | null } | null)?.pixel_size_um ?? undefined,
    sensorWidthMm: (selectedCamera as { sensor_width_mm?: number | null } | null)?.sensor_width_mm ?? undefined,
    sensorHeightMm: (selectedCamera as { sensor_height_mm?: number | null } | null)?.sensor_height_mm ?? undefined,
    focalLengthStr: selectedLens?.focal_length || undefined,
    fNumberStr: form.lensAperture || undefined,
    workingDistance: (() => {
      const value = toMillimeters(form.workingDistance, distanceUnit);
      return value === null ? undefined : String(value);
    })(),
    lensResolvingPower: selectedLens?.resolving_power?.toString() || undefined,
    lensMount: selectedLens?.mount || undefined,
    lensMaxSensorSize: selectedLens?.max_sensor_size || undefined,
  }), [
    cameraResolution,
    distanceUnit,
    form.lensAperture,
    form.workingDistance,
    selectedCamera,
    selectedLens,
  ]);

  const sensorFovMm = useMemo(() => {
    const fov = opticalCalculation.imaging.fovFromSensor;
    const parsed = opticalCalculation.imaging.cameraParsed;
    if (!fov || !parsed) return null;
    return parsed.width >= parsed.height ? fov.width : fov.height;
  }, [opticalCalculation.imaging.cameraParsed, opticalCalculation.imaging.fovFromSensor]);

  const storedResolution = parsePositiveNumber(form.lineScan.resolutionPerPixel);
  const scanSpeed = parsePositiveNumber(form.lineScan.scanSpeed);
  const lineFrequencyHz = storedResolution && scanSpeed ? scanSpeed / storedResolution : null;
  const linePeriodUs = lineFrequencyHz ? 1_000_000 / lineFrequencyHz : null;

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
    setForm(prev => applyLightItems(
      prev,
      prev.lightItems.map(item => item.id === id ? { ...item, ...patch } : item),
    ));
  };

  const handleCalculateResolution = () => {
    if (!calculatedResolution) return;
    setForm(prev => ({
      ...prev,
      lineScan: { ...prev.lineScan, resolutionPerPixel: calculatedResolution },
    }));
  };

  const handleApplySensorFov = () => {
    if (sensorFovMm === null || pixelCount === null) return;
    const fieldOfView = formatFovInput(sensorFovMm, distanceUnit);
    setForm(prev => ({
      ...prev,
      lineScan: {
        ...prev.lineScan,
        fieldOfView,
        resolutionPerPixel: formatResolutionPerPixel(sensorFovMm / pixelCount),
      },
    }));
  };

  const handleDistanceUnitChange = (value: string) => {
    setForm(prev => convertLineScanDistanceUnit(prev, value));
  };

  return (
    <div data-testid="line-scan-imaging-form" className="space-y-6">
      {cameraResolution ? (
        <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ScanLine className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">已选线扫相机:</span>
            <Badge variant="secondary" className="font-mono">{cameraResolution}</Badge>
            {pixelCount && <span className="text-xs text-muted-foreground">按较长轴 {pixelCount} px 计算</span>}
          </div>
          {calculatedResolution && (
            <div className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
              当前视野推算像素精度：
              <code className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary">
                {calculatedResolution} mm/px
              </code>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          请先在“基本信息”步骤中选择相机，以启用线扫计算。
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">线扫核心参数</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">工作距离 WD ({distanceUnit})</Label>
            <Input
              value={form.workingDistance || ''}
              onChange={event => setForm(prev => ({ ...prev, workingDistance: event.target.value }))}
              placeholder="150"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">视野范围 FOV ({distanceUnit})</Label>
            <Input
              data-testid="line-scan-fov-input"
              type="number"
              min="0.0001"
              step="any"
              value={form.lineScan.fieldOfView}
              onChange={event => setForm(prev => ({
                ...prev,
                lineScan: { ...prev.lineScan, fieldOfView: event.target.value },
              }))}
              placeholder="50"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">扫描速度 (mm/s)</Label>
            <Input
              data-testid="line-scan-speed-input"
              type="number"
              min="0.0001"
              step="any"
              value={form.lineScan.scanSpeed}
              onChange={event => setForm(prev => ({
                ...prev,
                lineScan: { ...prev.lineScan, scanSpeed: event.target.value },
              }))}
              placeholder="500"
              className="h-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[18rem] flex-1 space-y-1.5">
            <Label className="text-xs font-medium">像素精度 (mm/px)</Label>
            <div className="flex items-center gap-2">
              <Input
                data-testid="line-scan-resolution-input"
                value={form.lineScan.resolutionPerPixel}
                onChange={event => setForm(prev => ({
                  ...prev,
                  lineScan: { ...prev.lineScan, resolutionPerPixel: event.target.value },
                }))}
                placeholder="0.0122"
                className="h-9 min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleCalculateResolution}
                disabled={!calculatedResolution}
              >
                <Calculator className="h-3.5 w-3.5" />
                一键计算
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9"
                onClick={handleApplySensorFov}
                disabled={sensorFovMm === null || pixelCount === null}
              >
                应用推算FOV
              </Button>
            </div>
          </div>
          <div className="w-24 shrink-0 space-y-1.5">
            <Label className="text-xs font-medium">距离单位</Label>
            <Select value={distanceUnit} onValueChange={handleDistanceUnitChange}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISTANCE_UNITS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">工作距离公差 (±{distanceUnit})</Label>
          <Input
            value={form.workingDistanceTolerance || ''}
            onChange={event => setForm(prev => ({ ...prev, workingDistanceTolerance: event.target.value }))}
            placeholder="例如: 15"
            className="h-9 max-w-md"
          />
        </div>
      </div>

      {lineFrequencyHz !== null && (
        <div data-testid="line-scan-flying-analysis" className="space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">线扫飞拍分析</span>
            <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div><span className="text-muted-foreground">扫描速度:</span>{' '}<code>{scanSpeed} mm/s</code></div>
            <div><span className="text-muted-foreground">行频:</span>{' '}<code>{Number(lineFrequencyHz.toFixed(2))} Hz</code></div>
            <div><span className="text-muted-foreground">行周期:</span>{' '}<code>{Number(linePeriodUs?.toFixed(2))} us</code></div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">曝光控制</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">曝光时间</Label>
            <Input value={form.exposure || ''} onChange={event => setForm(prev => ({ ...prev, exposure: event.target.value }))} placeholder="10ms" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">增益 (dB)</Label>
            <Input value={form.gain || ''} onChange={event => setForm(prev => ({ ...prev, gain: event.target.value }))} placeholder="0" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">触发延时</Label>
            <Input value={form.triggerDelay || ''} onChange={event => setForm(prev => ({ ...prev, triggerDelay: event.target.value }))} placeholder="0ms" className="h-9" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">光源参数</h4>
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
                  <div className="text-xs text-muted-foreground">{item.selectedLight || '未选择型号'}</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">光源模式</Label>
                    <EditableSelect
                      value={item.lightMode}
                      onValueChange={value => updateLightItem(item.id, { lightMode: value })}
                      options={['常亮', '频闪', 'PWM']}
                      placeholder="选择"
                      inputPlaceholder="请输入工作模式"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">光源角度</Label>
                    <Input value={item.lightAngle} onChange={event => updateLightItem(item.id, { lightAngle: event.target.value })} placeholder="45°" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">空间距离 ({distanceUnit})</Label>
                    <Input value={item.lightDistance} onChange={event => updateLightItem(item.id, getModuleLightGeometryPatch(item, { lightDistance: event.target.value }))} placeholder="100" className="h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">水平距离 ({distanceUnit})</Label>
                    <Input value={item.lightDistanceHorizontal} onChange={event => updateLightItem(item.id, getModuleLightGeometryPatch(item, { lightDistanceHorizontal: event.target.value }))} placeholder="50-70" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">垂直距离 ({distanceUnit})</Label>
                    <Input value={item.lightDistanceVertical} onChange={event => updateLightItem(item.id, getModuleLightGeometryPatch(item, { lightDistanceVertical: event.target.value }))} placeholder="80-100" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">光源备注</Label>
                    <Input value={item.lightNote} onChange={event => updateLightItem(item.id, { lightNote: event.target.value })} placeholder="例如: 光源暂不下单" className="h-9" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">镜头参数</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">光圈 (F值)</Label>
            <Input value={form.lensAperture || ''} onChange={event => setForm(prev => ({ ...prev, lensAperture: event.target.value }))} placeholder="F2.8" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">靶面尺寸</Label>
            <Input value={form.depthOfField || ''} onChange={event => setForm(prev => ({ ...prev, depthOfField: event.target.value }))} placeholder={'例如: 2/3"'} className="h-9" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">相机安装说明</h4>
        <Input
          value={form.cameraInstallNote || ''}
          onChange={event => setForm(prev => ({ ...prev, cameraInstallNote: event.target.value }))}
          placeholder="例如: 相机芯片长边及光源长边与模组短边方向平行安装"
          className="h-9"
        />
      </div>
    </div>
  );
}
