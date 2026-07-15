import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/useData';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getModuleHardwareSlots } from '@/utils/moduleHardwareSlots';

type ModuleType = 'positioning' | 'defect' | 'ocr' | 'deeplearning' | 'measurement';

export function NewModuleDialog({ open, onOpenChange, workstationId }: { open: boolean; onOpenChange: (open: boolean) => void; workstationId: string | null }) {
  const { addModule, selectModule, getLayoutByWorkstation } = useData();
  const [form, setForm] = useState({ name: '', type: 'defect' as ModuleType });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!workstationId) {
      toast.error('请先选择工位');
      return;
    }
    if (!form.name.trim()) {
      toast.error('请输入模块名称');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get workstation layout to inherit hardware
      const layout = getLayoutByWorkstation(workstationId);
      const cameraSlot = getModuleHardwareSlots(layout, 'camera')[0]?.value || null;
      const lensSlot = getModuleHardwareSlots(layout, 'lens')[0]?.value || null;
      const lightSlot = getModuleHardwareSlots(layout, 'light')[0]?.value || null;
      const controllerSlot = getModuleHardwareSlots(layout, 'controller')[0]?.value || null;
      
      // Inherit hardware from workstation (take first item of each type)
      const moduleData: any = {
        workstation_id: workstationId, 
        name: form.name.trim(), 
        type: form.type, 
        trigger_type: 'io', 
        output_types: ['okng'],
        status: 'incomplete',
        selected_camera: cameraSlot,
        selected_lens: lensSlot,
        selected_light: lightSlot,
        selected_controller: controllerSlot,
      };
      const mod = await addModule(moduleData);
      selectModule(mod.id);
      onOpenChange(false);
      setForm({ name: '', type: 'defect' });
    } catch (error) {
      console.error('Failed to create module:', error);
      toast.error('创建模块失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>新建功能模块</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">模块名称 <span className="text-destructive ml-0.5">*</span></Label>
            <Input 
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              placeholder="请输入模块名称"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">模块分类</Label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as ModuleType }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ocr">识别</SelectItem>
                <SelectItem value="measurement">测量</SelectItem>
                <SelectItem value="positioning">定位</SelectItem>
                <SelectItem value="defect">检测</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button onClick={handleCreate} disabled={loading || !form.name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

