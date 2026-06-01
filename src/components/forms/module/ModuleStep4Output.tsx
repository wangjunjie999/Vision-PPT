import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditableSelect } from '@/components/ui/editable-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ModuleFormState } from './types';

interface ModuleStep4OutputProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

export function ModuleStep4Output({ 
  form, 
  setForm, 
}: ModuleStep4OutputProps) {
  return (
    <div className="space-y-6">
      {/* Common parameters */}
      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">判定与输出</h4>
        
        {/* Detection steps */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">检测步骤</Label>
          <Textarea 
            value={form.description} 
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
            placeholder="描述该模块的检测流程、处理步骤和结果输出..."
            className="min-h-[80px] text-sm resize-none" 
          />
        </div>
        
        {/* Judgment strategy */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">判定策略</Label>
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
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">输出动作</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">通讯方式</Label>
            <EditableSelect
              value={form.communicationMethod}
              onValueChange={v => setForm(p => ({ ...p, communicationMethod: v }))}
              options={['IO', 'PLC', 'TCP', '串口']}
              placeholder="请选择"
              inputPlaceholder="请输入协议名称"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">信号定义</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">数据留存策略</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">保存天数</Label>
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
  );
}
