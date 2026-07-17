import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModuleFormState } from './types';
import { ModuleHardwareSelection } from './ModuleHardwareSelection';
import { strip3DOpticsFromForm } from './threeDCamera';
import { stripCameraTaktTimeUnit } from '@/utils/cameraTaktTime';

type ModuleType = 'positioning' | 'defect' | 'ocr' | 'deeplearning' | 'measurement';
type TriggerType = 'io' | 'encoder' | 'software' | 'continuous';

interface ModuleStep1BasicProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
  cameras?: any[];
  lenses?: any[];
  lights?: any[];
  controllers?: any[];
  workstationLayout?: any;
}

export function ModuleStep1Basic({
  form,
  setForm,
  cameras = [],
  lenses = [],
  lights = [],
  controllers = [],
  workstationLayout,
}: ModuleStep1BasicProps) {
  const isLineScan = !form.is3DCamera && form.twoDCameraType === 'line_scan';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">模块名称 <span className="text-destructive ml-0.5">*</span></Label>
          <Input 
            value={form.name} 
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
            className="h-9" 
            placeholder="请输入模块名称"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">模块分类 <span className="text-destructive ml-0.5">*</span></Label>
          <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as ModuleType }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ocr">识别</SelectItem>
              <SelectItem value="measurement">测量</SelectItem>
              <SelectItem value="positioning">定位</SelectItem>
              <SelectItem value="defect">检测</SelectItem>
              {form.type === 'deeplearning' && (
                <SelectItem value="deeplearning">深度学习（算法手段）</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">触发方式</Label>
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
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">处理时限 (ms)</Label>
          <Input 
            type="number"
            value={form.processingTimeLimit} 
            onChange={e => setForm(p => ({ ...p, processingTimeLimit: e.target.value }))} 
            placeholder="200"
            className="h-9" 
          />
        </div>
      </div>

      {!isLineScan && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">相机节拍</Label>
            <div className="relative">
              <Input
                value={form.cameraTaktTime}
                onChange={e => setForm(p => ({ ...p, cameraTaktTime: stripCameraTaktTimeUnit(e.target.value) }))}
                placeholder="例如 1~1.5"
                className="h-9 pr-10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                S/次
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">拍照次数</Label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                value={form.shotCount}
                onChange={e => setForm(p => ({ ...p, shotCount: e.target.value }))}
                placeholder="1"
                className="h-9 pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                次
              </span>
            </div>
          </div>
        </div>
      )}

      {isLineScan && (
        <div
          data-testid="line-scan-step1-hint"
          className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"
        >
          线扫相机不使用相机节拍和拍照次数，请在“成像配置”步骤填写扫描速度。
        </div>
      )}

      {!isLineScan && (form.triggerType === 'encoder' || form.triggerType === 'continuous') && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">线体速度 (mm/s)</Label>
            <Input
              type="number"
              value={form.lineSpeed}
              onChange={e => setForm(p => ({ ...p, lineSpeed: e.target.value }))}
              placeholder="500"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">飞拍提示</Label>
            <div className="h-9 flex items-center text-xs text-muted-foreground px-2 border rounded-md bg-muted/30">
              {form.lineSpeed ? `速度 ${form.lineSpeed} mm/s，详见成像参数步骤` : '填入速度后可自动计算飞拍参数'}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant={form.is3DCamera ? 'default' : 'outline'}
          className="h-9 justify-center"
          onClick={() => setForm(p => (
            p.is3DCamera
              ? { ...p, is3DCamera: false }
              : strip3DOpticsFromForm(p)
          ))}
        >
          {form.is3DCamera ? '已启用3D相机' : '是否使用3D相机'}
        </Button>
      </div>

      <ModuleHardwareSelection
        form={form}
        setForm={setForm}
        cameras={cameras}
        lenses={lenses}
        lights={lights}
        controllers={controllers}
        workstationLayout={workstationLayout}
      />
    </div>
  );
}
