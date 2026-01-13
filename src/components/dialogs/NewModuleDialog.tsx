import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
      
      // Safely extract hardware from layout - handle both array formats
      const selectedCameras = Array.isArray((layout as any)?.selected_cameras) 
        ? (layout as any).selected_cameras 
        : [];
      const selectedLenses = Array.isArray((layout as any)?.selected_lenses) 
        ? (layout as any).selected_lenses 
        : [];
      const selectedLights = Array.isArray((layout as any)?.selected_lights) 
        ? (layout as any).selected_lights 
        : [];
      const selectedController = (layout as any)?.selected_controller;
      
      // Get first camera/lens/light ID - handle both object and string formats
      const getFirstId = (arr: any[]): string | null => {
        if (!arr || arr.length === 0) return null;
        const first = arr[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object') return first.id || null;
        return null;
      };
      
      const getControllerId = (ctrl: any): string | null => {
        if (!ctrl) return null;
        if (typeof ctrl === 'string') return ctrl;
        if (typeof ctrl === 'object') return ctrl.id || null;
        return null;
      };
      
      // Inherit hardware from workstation (take first item of each type)
      const moduleData: any = {
        workstation_id: workstationId, 
        name: form.name.trim(), 
        type: form.type, 
        trigger_type: 'io', 
        output_types: ['okng'],
        status: 'incomplete',
        selected_camera: getFirstId(selectedCameras),
        selected_lens: getFirstId(selectedLenses),
        selected_light: getFirstId(selectedLights),
        selected_controller: getControllerId(selectedController),
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
          <div className="space-y-2">
            <Label>模块名称 <span className="text-destructive">*</span></Label>
            <Input 
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              placeholder="请输入模块名称" 
            />
          </div>
          <div className="space-y-2">
            <Label>模块类型</Label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as ModuleType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="positioning">引导定位</SelectItem>
                <SelectItem value="defect">缺陷检测</SelectItem>
                <SelectItem value="ocr">OCR识别</SelectItem>
                <SelectItem value="deeplearning">深度学习</SelectItem>
                <SelectItem value="measurement">尺寸测量</SelectItem>
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