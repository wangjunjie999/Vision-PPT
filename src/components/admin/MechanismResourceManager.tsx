import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { useMechanisms, type MechanismInsert, type MechanismUpdate } from '@/hooks/useMechanisms';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getMechanismImage } from '@/utils/mechanismImageUrls';

const MECHANISM_TYPES = [
  { value: 'robot_arm', label: '机械臂' },
  { value: 'cylinder', label: '气缸' },
  { value: 'gripper', label: '夹爪' },
  { value: 'lift', label: '顶升机构' },
  { value: 'stop', label: '定位挡停' },
  { value: 'conveyor', label: '传送带' },
  { value: 'turntable', label: '旋转台' },
  { value: 'camera_mount', label: '视觉支架' },
];

// Get the display image for a mechanism - prefer database URL, fallback to local asset
function getMechanismDisplayImage(mech: { type: string; front_view_image_url: string | null }): string | null {
  // If there's a URL in the database, use it
  if (mech.front_view_image_url) return mech.front_view_image_url;
  // Otherwise try to get from local assets
  return getMechanismImage(mech.type, 'front');
}

export function MechanismResourceManager() {
  const { mechanisms, loading, addMechanism, updateMechanism, deleteMechanism } = useMechanisms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingView, setUploadingView] = useState<'front' | 'side' | 'top' | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'robot_arm',
    description: '',
    front_view_image_url: '',
    side_view_image_url: '',
    top_view_image_url: '',
    default_width: '',
    default_height: '',
    default_depth: '',
    notes: '',
    enabled: true,
  });

  const resetForm = () => {
    setForm({
      name: '',
      type: 'robot_arm',
      description: '',
      front_view_image_url: '',
      side_view_image_url: '',
      top_view_image_url: '',
      default_width: '',
      default_height: '',
      default_depth: '',
      notes: '',
      enabled: true,
    });
    setEditing(null);
  };

  const openEditDialog = (mechanism: any) => {
    setForm({
      name: mechanism.name || '',
      type: mechanism.type || 'robot_arm',
      description: mechanism.description || '',
      front_view_image_url: mechanism.front_view_image_url || '',
      side_view_image_url: mechanism.side_view_image_url || '',
      top_view_image_url: mechanism.top_view_image_url || '',
      default_width: mechanism.default_width?.toString() || '',
      default_height: mechanism.default_height?.toString() || '',
      default_depth: mechanism.default_depth?.toString() || '',
      notes: mechanism.notes || '',
      enabled: mechanism.enabled !== false,
    });
    setEditing(mechanism.id);
    setDialogOpen(true);
  };

  const handleImageUpload = async (file: File, viewType: 'front' | 'side' | 'top') => {
    setUploadingView(viewType);
    try {
      const fileName = `mechanisms/${Date.now()}-${viewType}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('product-models')
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-models')
        .getPublicUrl(fileName);

      const urlKey = `${viewType}_view_image_url` as 'front_view_image_url' | 'side_view_image_url' | 'top_view_image_url';
      setForm(prev => ({ ...prev, [urlKey]: urlData.publicUrl }));
      toast.success(`${viewType === 'front' ? '正' : viewType === 'side' ? '侧' : '俯'}视图上传成功`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('图片上传失败');
    } finally {
      setUploadingView(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('请输入机构名称');
      return;
    }

    setSaving(true);
    try {
      const data: MechanismInsert | MechanismUpdate = {
        name: form.name.trim(),
        type: form.type,
        description: form.description || null,
        front_view_image_url: form.front_view_image_url || null,
        side_view_image_url: form.side_view_image_url || null,
        top_view_image_url: form.top_view_image_url || null,
        default_width: form.default_width ? parseFloat(form.default_width) : null,
        default_height: form.default_height ? parseFloat(form.default_height) : null,
        default_depth: form.default_depth ? parseFloat(form.default_depth) : null,
        notes: form.notes || null,
        enabled: form.enabled,
      };

      if (editing) {
        await updateMechanism(editing, data);
        toast.success('机构已更新');
      } else {
        await addMechanism(data as MechanismInsert);
        toast.success('机构已添加');
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该机构吗？')) return;
    try {
      await deleteMechanism(id);
      toast.success('机构已删除');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('删除失败');
    }
  };

  const ImageUploadArea = ({ viewType, label, url }: { viewType: 'front' | 'side' | 'top'; label: string; url: string }) => (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="relative border-2 border-dashed border-border rounded-lg p-2 h-24 flex items-center justify-center bg-muted/30">
        {url ? (
          <img src={url} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-center text-muted-foreground text-xs">
            <ImageIcon className="h-6 w-6 mx-auto mb-1" />
            未上传
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file, viewType);
          }}
          disabled={uploadingView === viewType}
        />
        {uploadingView === viewType && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          共 {mechanisms.length} 种执行机构，用于三视图布局
        </p>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              新增机构
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑机构' : '新增机构'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>机构名称 *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="如：机械臂"
                  />
                </div>
                <div className="space-y-2">
                  <Label>机构类型</Label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    {MECHANISM_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="机构用途和特点说明"
                  rows={2}
                />
              </div>

              <div>
                <Label className="mb-2 block">三视图图片</Label>
                <div className="grid grid-cols-3 gap-3">
                  <ImageUploadArea viewType="front" label="正视图" url={form.front_view_image_url} />
                  <ImageUploadArea viewType="side" label="侧视图" url={form.side_view_image_url} />
                  <ImageUploadArea viewType="top" label="俯视图" url={form.top_view_image_url} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">默认宽度(mm)</Label>
                  <Input
                    type="number"
                    value={form.default_width}
                    onChange={(e) => setForm(prev => ({ ...prev, default_width: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">默认高度(mm)</Label>
                  <Input
                    type="number"
                    value={form.default_height}
                    onChange={(e) => setForm(prev => ({ ...prev, default_height: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">默认深度(mm)</Label>
                  <Input
                    type="number"
                    value={form.default_depth}
                    onChange={(e) => setForm(prev => ({ ...prev, default_depth: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="安装注意事项、兼容性说明等"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, enabled: checked }))}
                />
                <Label>启用</Label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mechanisms.map((mech) => (
          <Card key={mech.id} className={mech.enabled === false ? 'opacity-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {getMechanismDisplayImage(mech) ? (
                    <img src={getMechanismDisplayImage(mech)!} alt={mech.name} className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium truncate">{mech.name}</h4>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(mech)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(mech.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{mech.description}</p>
                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{MECHANISM_TYPES.find(t => t.value === mech.type)?.label || mech.type}</span>
                    {mech.default_width && (
                      <span>· {mech.default_width}×{mech.default_height}×{mech.default_depth}mm</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {mech.front_view_image_url && <span className="text-xs bg-primary/10 text-primary px-1 rounded">正</span>}
                    {mech.side_view_image_url && <span className="text-xs bg-primary/10 text-primary px-1 rounded">侧</span>}
                    {mech.top_view_image_url && <span className="text-xs bg-primary/10 text-primary px-1 rounded">俯</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
