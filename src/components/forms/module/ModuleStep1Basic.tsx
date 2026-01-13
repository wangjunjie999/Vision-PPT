import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ModuleFormState } from './types';

type ModuleType = 'positioning' | 'defect' | 'ocr' | 'deeplearning' | 'measurement';
type TriggerType = 'io' | 'encoder' | 'software' | 'continuous';

interface ModuleStep1BasicProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

export function ModuleStep1Basic({ form, setForm }: ModuleStep1BasicProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">模块名称 *</Label>
          <Input 
            value={form.name} 
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
            className="h-9" 
            placeholder="请输入模块名称"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">模块类型 *</Label>
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
          className="min-h-[80px] text-sm resize-none" 
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
  );
}
