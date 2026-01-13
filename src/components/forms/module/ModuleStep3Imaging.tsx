import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModuleFormState } from './types';

interface ModuleStep3ImagingProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

export function ModuleStep3Imaging({ form, setForm }: ModuleStep3ImagingProps) {
  return (
    <div className="space-y-6">
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
            <Input 
              value={form.fieldOfViewCommon || form.fieldOfView || ''} 
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
          </div>
          <div className="space-y-1">
            <Label className="text-xs">分辨率 (mm/px)</Label>
            <Input 
              value={form.resolutionPerPixel || ''} 
              onChange={e => setForm(p => ({ ...p, resolutionPerPixel: e.target.value }))} 
              placeholder="0.1"
              className="h-9" 
            />
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
            <Label className="text-xs">光源距离</Label>
            <Input 
              value={form.lightDistance || ''} 
              onChange={e => setForm(p => ({ ...p, lightDistance: e.target.value }))} 
              placeholder="100mm"
              className="h-9" 
            />
          </div>
        </div>
      </div>

      {/* Lens parameters */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">镜头参数</h4>
        <div className="grid grid-cols-2 gap-3">
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
        </div>
      </div>
    </div>
  );
}
