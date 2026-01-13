import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/contexts/DataContext';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addProject, selectProject } = useData();
  const [form, setForm] = useState({ 
    code: '', 
    name: '', 
    customer: '', 
    product_process: '总装检测', 
    date: new Date().toISOString().split('T')[0], 
    responsible: '' 
  });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    // Validation
    if (!form.code.trim()) {
      toast.error('请输入项目编号');
      return;
    }
    if (!form.name.trim()) {
      toast.error('请输入项目名称');
      return;
    }
    if (!form.customer.trim()) {
      toast.error('请输入客户名称');
      return;
    }
    
    try {
      setLoading(true);
      const project = await addProject({ 
        code: form.code.trim(),
        name: form.name.trim(),
        customer: form.customer.trim(),
        product_process: form.product_process,
        date: form.date,
        responsible: form.responsible.trim() || null,
        status: 'draft' 
      });
      selectProject(project.id);
      onOpenChange(false);
      setForm({ 
        code: '', 
        name: '', 
        customer: '', 
        product_process: '总装检测', 
        date: new Date().toISOString().split('T')[0], 
        responsible: '' 
      });
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('创建项目失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>新建项目</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>项目编号 <span className="text-destructive">*</span></Label>
              <Input 
                value={form.code} 
                onChange={e => setForm(p => ({ ...p, code: e.target.value }))} 
                placeholder="VIS-2024-XXX" 
              />
            </div>
            <div className="space-y-2">
              <Label>方案日期</Label>
              <Input 
                type="date" 
                value={form.date} 
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>项目名称 <span className="text-destructive">*</span></Label>
            <Input 
              value={form.name} 
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
              placeholder="请输入项目名称" 
            />
          </div>
          <div className="space-y-2">
            <Label>客户名称 <span className="text-destructive">*</span></Label>
            <Input 
              value={form.customer} 
              onChange={e => setForm(p => ({ ...p, customer: e.target.value }))} 
              placeholder="请输入客户名称" 
            />
          </div>
          <div className="space-y-2">
            <Label>负责人</Label>
            <Input 
              value={form.responsible} 
              onChange={e => setForm(p => ({ ...p, responsible: e.target.value }))} 
              placeholder="请输入负责人" 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button onClick={handleCreate} disabled={loading || !form.code.trim() || !form.name.trim() || !form.customer.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}