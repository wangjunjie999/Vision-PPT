import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ModuleFormState } from './types';
import { useMemo, useCallback } from 'react';
import { calculateImagingParams, parseResolution, parseFOV } from '@/utils/imagingCalculations';
import { useCameras } from '@/hooks/useHardware';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface ModuleStep3ImagingProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

export function ModuleStep3Imaging({ form, setForm }: ModuleStep3ImagingProps) {
  const { cameras } = useCameras();
  
  // 获取当前选中相机的分辨率
  const selectedCameraResolution = useMemo(() => {
    if (!form.selectedCamera) return null;
    const camera = cameras.find(c => 
      `${c.brand} ${c.model}` === form.selectedCamera || c.id === form.selectedCamera
    );
    return camera?.resolution || null;
  }, [form.selectedCamera, cameras]);
  
  // 自动计算成像参数
  const calculationResult = useMemo(() => {
    const fov = form.type === 'positioning' ? form.fieldOfView : form.fieldOfViewCommon;
    const resolution = selectedCameraResolution || '';
    
    return calculateImagingParams({
      cameraResolution: resolution,
      fov: fov || '',
      targetAccuracy: form.accuracyRequirement ? parseFloat(form.accuracyRequirement) : undefined,
    });
  }, [form.fieldOfView, form.fieldOfViewCommon, form.type, selectedCameraResolution, form.accuracyRequirement]);
  
  // 自动填充像素精度
  const handleAutoCalculate = useCallback(() => {
    if (calculationResult.resolutionPerPixel) {
      setForm(p => ({ ...p, resolutionPerPixel: calculationResult.resolutionPerPixel || '' }));
    }
  }, [calculationResult.resolutionPerPixel, setForm]);
  
  // 检查是否可以自动计算
  const canAutoCalculate = useMemo(() => {
    const fov = form.type === 'positioning' ? form.fieldOfView : form.fieldOfViewCommon;
    return Boolean(selectedCameraResolution && fov && parseFOV(fov) && parseResolution(selectedCameraResolution));
  }, [form.fieldOfView, form.fieldOfViewCommon, form.type, selectedCameraResolution]);

  return (
    <div className="space-y-6">
      {/* Auto-calculation status banner */}
      {selectedCameraResolution && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center justify-between gap-2">
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
            {canAutoCalculate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAutoCalculate}
                      className="gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      自动计算
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    根据相机分辨率和视野自动计算像素精度
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {/* Calculation result preview */}
          {calculationResult.resolutionPerPixel && (
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">计算像素精度:</span>
                <code className="px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono">
                  {calculationResult.resolutionPerPixel} mm/px
                </code>
              </div>
              {calculationResult.meetsAccuracy !== null && (
                <div className="flex items-center gap-1">
                  {calculationResult.meetsAccuracy ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-primary text-xs">满足精度要求</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive text-xs">精度可能不足</span>
                    </>
                  )}
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
          <div className="space-y-1">
            <Label className="text-xs">工作距离 WD (mm)</Label>
            <Input 
              value={form.workingDistance || ''} 
              onChange={e => setForm(p => ({ ...p, workingDistance: e.target.value }))}
              placeholder="300"
              className="h-9" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">视场 FOV (mm)</Label>
            <div className="relative">
              <Input 
                value={form.type === 'positioning' ? form.fieldOfView : form.fieldOfViewCommon || ''} 
                onChange={e => {
                  if (form.type === 'positioning') {
                    setForm(p => ({ ...p, fieldOfView: e.target.value }));
                  } else {
                    setForm(p => ({ ...p, fieldOfViewCommon: e.target.value }));
                  }
                }}
                placeholder="100×80"
                className="h-9" 
              />
              {calculationResult.fovParsed && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">格式: 宽×高，如 100×80</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              分辨率 (mm/px)
              {canAutoCalculate && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0"
                        onClick={handleAutoCalculate}
                      >
                        <Calculator className="h-3 w-3 text-primary" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>点击自动计算</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </Label>
            <Input 
              value={form.resolutionPerPixel || ''} 
              onChange={e => setForm(p => ({ ...p, resolutionPerPixel: e.target.value }))} 
              placeholder={calculationResult.resolutionPerPixel || '0.1'}
              className="h-9" 
            />
            {calculationResult.resolutionPerPixel && !form.resolutionPerPixel && (
              <p className="text-[10px] text-primary">
                建议值: {calculationResult.resolutionPerPixel}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Exposure and gain */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">曝光控制</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">曝光时间</Label>
            <Input 
              value={form.exposure || ''} 
              onChange={e => setForm(p => ({ ...p, exposure: e.target.value }))} 
              placeholder="10ms"
              className="h-9" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">增益 (dB)</Label>
            <Input 
              value={form.gain || ''} 
              onChange={e => setForm(p => ({ ...p, gain: e.target.value }))} 
              placeholder="0"
              className="h-9" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">触发延时</Label>
            <Input 
              value={form.triggerDelay || ''} 
              onChange={e => setForm(p => ({ ...p, triggerDelay: e.target.value }))} 
              placeholder="0ms"
              className="h-9" 
            />
          </div>
        </div>
      </div>

      {/* Light source parameters */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">光源参数</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">光源模式</Label>
            <Select 
              value={form.lightMode} 
              onValueChange={v => setForm(p => ({ ...p, lightMode: v }))}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="选择" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="常亮">常亮</SelectItem>
                <SelectItem value="频闪">频闪</SelectItem>
                <SelectItem value="PWM">PWM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">光源角度</Label>
            <Input 
              value={form.lightAngle || ''} 
              onChange={e => setForm(p => ({ ...p, lightAngle: e.target.value }))} 
              placeholder="45°"
              className="h-9" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">光源距离 (mm)</Label>
            <Input 
              value={form.lightDistance || ''} 
              onChange={e => setForm(p => ({ ...p, lightDistance: e.target.value }))} 
              placeholder="100"
              className="h-9" 
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">光源水平距离 (mm)</Label>
            <Input 
              value={form.lightDistanceHorizontal || ''} 
              onChange={e => setForm(p => ({ ...p, lightDistanceHorizontal: e.target.value }))} 
              placeholder="50-70"
              className="h-9" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">光源垂直距离 (mm)</Label>
            <Input 
              value={form.lightDistanceVertical || ''} 
              onChange={e => setForm(p => ({ ...p, lightDistanceVertical: e.target.value }))} 
              placeholder="80-100"
              className="h-9" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">光源备注</Label>
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
          <div className="space-y-1">
            <Label className="text-xs">光圈 (F值)</Label>
            <Input 
              value={form.lensAperture || ''} 
              onChange={e => setForm(p => ({ ...p, lensAperture: e.target.value }))} 
              placeholder="F2.8"
              className="h-9" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">景深 (mm)</Label>
            <Input 
              value={form.depthOfField || ''} 
              onChange={e => setForm(p => ({ ...p, depthOfField: e.target.value }))} 
              placeholder="5"
              className="h-9" 
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">工作距离公差 (±mm)</Label>
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
        <div className="space-y-1">
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