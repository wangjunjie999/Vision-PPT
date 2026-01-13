import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ModuleFormState } from './types';
import { HardwareSelector } from '@/components/hardware/HardwareSelector';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ModuleStep4OutputProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
  cameras: any[];
  lenses: any[];
  lights: any[];
  controllers: any[];
  workstationLayout?: any;
}

export function ModuleStep4Output({ 
  form, 
  setForm, 
  cameras, 
  lenses, 
  lights, 
  controllers,
  workstationLayout 
}: ModuleStep4OutputProps) {
  const handleInheritHardware = () => {
    if (!workstationLayout) return;
    
    const selectedCameras = workstationLayout?.selected_cameras || [];
    const selectedLenses = workstationLayout?.selected_lenses || [];
    const selectedLights = workstationLayout?.selected_lights || [];
    const selectedController = workstationLayout?.selected_controller;
    
    setForm(p => ({
      ...p,
      selectedCamera: selectedCameras.length > 0 ? selectedCameras[0].id : '',
      selectedLens: selectedLenses.length > 0 ? selectedLenses[0].id : '',
      selectedLight: selectedLights.length > 0 ? selectedLights[0].id : '',
      selectedController: selectedController ? selectedController.id : '',
    }));
    toast.success('已套用工位硬件配置');
  };

  return (
    <div className="space-y-6">
      {/* Common parameters */}
      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">判定与输出</h4>
        
        {/* Detection object */}
        <div className="space-y-1">
          <Label className="text-xs">检测对象/检测内容描述</Label>
          <Textarea 
            value={form.detectionObject} 
            onChange={e => setForm(p => ({ ...p, detectionObject: e.target.value }))} 
            placeholder="描述该模块的检测对象、关键要求等..."
            className="min-h-[60px] text-sm resize-none" 
          />
        </div>
        
        {/* Judgment strategy */}
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
        
        {/* Output actions */}
        <div className="space-y-2">
          <Label className="text-xs">输出动作</Label>
          <div className="grid grid-cols-3 gap-2">
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
        
        {/* Communication */}
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
        
        {/* Data retention */}
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

      {/* Hardware selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">硬件选型</h4>
          {workstationLayout && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={handleInheritHardware}
            >
              <Copy className="h-3 w-3" />
              一键套用工位硬件
            </Button>
          )}
        </div>
        
        {workstationLayout && (
          <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground">
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
  );
}
