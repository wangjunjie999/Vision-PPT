import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type WorkstationType = 'line' | 'turntable' | 'robot' | 'platform';

export function NewWorkstationDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string | null }) {
  const { addWorkstation, selectWorkstation, addLayout } = useData();
  const [form, setForm] = useState({ code: '', name: '', type: 'line' as WorkstationType, cycleTime: '3' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!projectId) {
      toast.error('请先选择项目');
      return;
    }
    if (!form.code.trim()) {
      toast.error('请输入工位编号');
      return;
    }
    if (!form.name.trim()) {
      toast.error('请输入工位名称');
      return;
    }
    
    try {
      setLoading(true);
      const ws = await addWorkstation({ 
        project_id: projectId, 
        code: form.code.trim(), 
        name: form.name.trim(), 
        type: form.type, 
        cycle_time: parseFloat(form.cycleTime) || 3, 
        product_dimensions: { length: 100, width: 100, height: 50 }, 
        status: 'draft' 
      });
      
      // Automatically create an empty layout for the workstation
      try {
        await addLayout({
          workstation_id: ws.id,
          name: `${form.name.trim()}-布局`,
          layout_type: form.type,
          selected_cameras: [],
          selected_lenses: [],
          selected_lights: [],
          selected_controller: null,
          mechanisms: [],
          camera_mounts: {},
          camera_count: 0,
        });
      } catch (layoutError) {
        console.warn('Failed to create default layout:', layoutError);
        // Don't fail the whole operation if layout creation fails
      }
      
      selectWorkstation(ws.id);
      onOpenChange(false);
      setForm({ code: '', name: '', type: 'line', cycleTime: '3' });
    } catch (error) {
      console.error('Failed to create workstation:', error);
      toast.error('创建工位失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>新建工位</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>工位编号 <span className="text-destructive">*</span></Label>
              <Input 
                value={form.code} 
                onChange={e => setForm(p => ({ ...p, code: e.target.value }))} 
                placeholder="WS-XX" 
              />
            </div>
            <div className="space-y-2">
              <Label>节拍(s/pcs)</Label>
              <Input 
                type="number" 
                value={form.cycleTime} 
                onChange={e => setForm(p => ({ ...p, cycleTime: e.target.value }))} 
                min="0.1"
                step="0.1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>工位名称 <span className="text-destructive">*</span></Label>
            <Input 
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              placeholder="请输入工位名称" 
            />
          </div>
          <div className="space-y-2">
            <Label>工位类型</Label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as WorkstationType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="line">线体</SelectItem>
                <SelectItem value="turntable">转盘</SelectItem>
                <SelectItem value="robot">机械手</SelectItem>
                <SelectItem value="platform">平台</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button onClick={handleCreate} disabled={loading || !form.code.trim() || !form.name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}