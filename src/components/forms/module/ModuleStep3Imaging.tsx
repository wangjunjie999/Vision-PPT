import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditableSelect } from '@/components/ui/editable-select';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertCircle, CheckCircle2, Focus, Crosshair, Zap, ScanEye, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ModuleFormState } from './types';
import { useMemo, useEffect } from 'react';
import { computeVisionParams } from '@/utils/visionCalcEngine';
import { useCameras, useLenses } from '@/hooks/useHardware';

interface ModuleStep3ImagingProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

export function ModuleStep3Imaging({ form, setForm }: ModuleStep3ImagingProps) {
  const { cameras } = useCameras();
  const { lenses } = useLenses();
  
  // 获取当前选中相机的属性
  const selectedCamera = useMemo(() => {
    if (!form.selectedCamera) return null;
    return cameras.find(c =>
      `${c.brand} ${c.model}` === form.selectedCamera || c.id === form.selectedCamera
    ) || null;
  }, [form.selectedCamera, cameras]);

  const selectedCameraResolution = selectedCamera?.resolution || null;
  const selectedSensorSize = selectedCamera?.sensor_size || null;

  // 获取选中镜头的属性
  const selectedLens = useMemo(() => {
    if (!form.selectedLens) return null;
    return lenses.find(l =>
      `${l.brand} ${l.model}` === form.selectedLens || l.id === form.selectedLens
    ) || null;
  }, [form.selectedLens, lenses]);

  // 按模块类型映射目标特征尺寸
  const targetFeatureSizeMm = useMemo(() => {
    switch (form.type) {
      case 'defect': return form.minDefectSize || undefined;
      case 'positioning': return form.accuracyRequirement || undefined;
      case 'measurement': return form.targetAccuracy || undefined;
      default: return form.accuracyRequirement || undefined;
    }
  }, [form.type, form.minDefectSize, form.accuracyRequirement, form.targetAccuracy]);

  // 统一计算：成像参数 + 飞拍参数 + 精度分析
  const calcResult = useMemo(() => {
    const fov = form.type === 'positioning' ? form.fieldOfView : form.fieldOfViewCommon;
    return computeVisionParams({
      cameraResolution: selectedCameraResolution || undefined,
      sensorSize: selectedSensorSize || undefined,
      focalLengthStr: selectedLens?.focal_length || undefined,
      fNumberStr: form.lensAperture || undefined,
      fov: fov || undefined,
      workingDistance: form.workingDistance || undefined,
      targetAccuracy: form.accuracyRequirement || undefined,
      lensResolvingPower: selectedLens?.resolving_power?.toString() || undefined,
      lensMount: selectedLens?.mount || undefined,
      lensMaxSensorSize: selectedLens?.max_sensor_size || undefined,
      targetFeatureSizeMm,
      redundancyStrategy: form.redundancyStrategy || 'standard',
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
    selectedSensorSize, selectedLens,
    form.workingDistance, form.lensAperture,
    targetFeatureSizeMm, form.redundancyStrategy,
    form.exposure, form.lineSpeed, form.triggerType,
  ]);

  const calculationResult = calcResult.imaging;
  const selectedFocalLength = calcResult.parsed.focalLength;
  
  // 自动填充像素精度
  useEffect(() => {
    if (calculationResult.resolutionPerPixel) {
      setForm(p => ({ ...p, resolutionPerPixel: calculationResult.resolutionPerPixel || '' }));
    }
  }, [calculationResult.resolutionPerPixel, setForm]);

  // FOV 靶面联动修正：只向上调整，防循环（仅当值不同时回写）
  const fovRecon = calculationResult.fovReconciliation;
  useEffect(() => {
    if (!fovRecon?.wasAdjusted) return;
    const eff = fovRecon.effectiveFov;
    const currentW = form.fieldOfViewWidth;
    const currentH = form.fieldOfViewHeight;
    const newW = String(eff.width);
    const newH = String(eff.height);
    if (currentW === newW && currentH === newH) return;
    const combined = `${newW}×${newH}`;
    if (form.type === 'positioning') {
      setForm(p => ({ ...p, fieldOfViewWidth: newW, fieldOfViewHeight: newH, fieldOfView: combined }));
    } else {
      setForm(p => ({ ...p, fieldOfViewWidth: newW, fieldOfViewHeight: newH, fieldOfViewCommon: combined }));
    }
  }, [fovRecon, form.fieldOfViewWidth, form.fieldOfViewHeight, form.type, setForm]);

  return (
    <div className="space-y-6">
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
          {(calculationResult.magnification || calculationResult.depthOfField || calculationResult.recommendedFocalLength || calculationResult.fovFromSensor) && (
            <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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
            <span>请先在"输出与硬件"步骤中选择相机，以启用自动计算功能</span>
          </div>
        </div>
      )}

      {/* Core optical parameters */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">核心参数</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">工作距离 WD (mm)</Label>
            <Input 
              value={form.workingDistance || ''} 
              onChange={e => setForm(p => ({ ...p, workingDistance: e.target.value }))}
              placeholder="300"
              className="h-9" 
            />
          </div>
          <div className="space-y-1.5 col-span-1">
            <Label className="text-xs font-medium">视场 FOV (mm)</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">分辨率 (mm/px)</Label>
            <Input 
              value={form.resolutionPerPixel || ''} 
              onChange={e => setForm(p => ({ ...p, resolutionPerPixel: e.target.value }))} 
              placeholder="0.1"
              className="h-9" 
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">像素冗余策略</Label>
            <Select
              value={form.redundancyStrategy || 'standard'}
              onValueChange={v => setForm(p => ({ ...p, redundancyStrategy: v }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">保守 (≥3px)</SelectItem>
                <SelectItem value="standard">标准 (≥5px)</SelectItem>
                <SelectItem value="high">高冗余 (≥10px)</SelectItem>
              </SelectContent>
            </Select>
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

      {/* Light source parameters */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">光源参数</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">光源模式</Label>
            <EditableSelect
              value={form.lightMode}
              onValueChange={v => setForm(p => ({ ...p, lightMode: v }))}
              options={['常亮', '频闪', 'PWM']}
              placeholder="选择"
              inputPlaceholder="请输入工作模式"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">光源角度</Label>
            <Input 
              value={form.lightAngle || ''} 
              onChange={e => setForm(p => ({ ...p, lightAngle: e.target.value }))} 
              placeholder="45°"
              className="h-9" 
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">光源距离 (mm)</Label>
            <Input 
              value={form.lightDistance || ''} 
              onChange={e => setForm(p => ({ ...p, lightDistance: e.target.value }))} 
              placeholder="100"
              className="h-9" 
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">光源水平距离 (mm)</Label>
            <Input 
              value={form.lightDistanceHorizontal || ''} 
              onChange={e => setForm(p => ({ ...p, lightDistanceHorizontal: e.target.value }))} 
              placeholder="50-70"
              className="h-9" 
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">光源垂直距离 (mm)</Label>
            <Input 
              value={form.lightDistanceVertical || ''} 
              onChange={e => setForm(p => ({ ...p, lightDistanceVertical: e.target.value }))} 
              placeholder="80-100"
              className="h-9" 
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">光源备注</Label>
            <Input 
              value={form.lightNote || ''} 
              onChange={e => setForm(p => ({ ...p, lightNote: e.target.value }))} 
              placeholder="例如: 光源暂不下单"
              className="h-9" 
            />
          </div>
        </div>
      </div>

      {/* Lens parameters */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">镜头参数</h4>
        <div className="grid grid-cols-3 gap-3">
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
            <Label className="text-xs font-medium">景深 (mm)</Label>
            <Input 
              value={form.depthOfField || ''} 
              onChange={e => setForm(p => ({ ...p, depthOfField: e.target.value }))} 
              placeholder="5"
              className="h-9" 
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">工作距离公差 (±mm)</Label>
            <Input 
              value={form.workingDistanceTolerance || ''} 
              onChange={e => setForm(p => ({ ...p, workingDistanceTolerance: e.target.value }))} 
              placeholder="20"
              className="h-9" 
            />
          </div>
        </div>
      </div>

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