import { useState, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Upload, Loader2, Image as ImageIcon, Search, Box } from 'lucide-react';
import { useMechanisms, type MechanismInsert, type MechanismUpdate } from '@/hooks/useMechanisms';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

import { ImageCropDialog } from './ImageCropDialog';

// Mechanism image display with error handling
const MechanismImageDisplay = memo(function MechanismImageDisplay({ 
  type, 
  databaseUrl, 
  name 
}: { 
  type: string; 
  databaseUrl: string | null; 
  name: string;
}) {
  const [hasError, setHasError] = useState(false);
  
  const imageUrl = databaseUrl;
  
  const handleError = useCallback(() => {
    setHasError(true);
  }, []);
  
  return (
    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
      {!hasError && imageUrl ? (
        <img 
          src={imageUrl} 
          alt={name} 
          className="w-full h-full object-contain"
          onError={handleError}
        />
      ) : (
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      )}
    </div>
  );
});

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

// Get the display image for a mechanism - only database URL (user uploaded)
function getMechanismDisplayImage(mech: { type: string; front_view_image_url: string | null }): string | null {
  return mech.front_view_image_url || null;
}

export function MechanismResourceManager() {
  const { mechanisms, loading, addMechanism, updateMechanism, deleteMechanism } = useMechanisms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingView, setUploadingView] = useState<'front' | 'side' | 'top' | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropViewType, setCropViewType] = useState<'front' | 'side' | 'top'>('front');

  const [uploadingGlb, setUploadingGlb] = useState(false);

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
    model_3d_url: '',
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
      model_3d_url: '',
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
      model_3d_url: mechanism.model_3d_url || '',
    });
    setEditing(mechanism.id);
    setDialogOpen(true);
  };

  const openCropDialog = (file: File, viewType: 'front' | 'side' | 'top') => {
    setCropFile(file);
    setCropViewType(viewType);
    setCropDialogOpen(true);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const viewType = cropViewType;
    setUploadingView(viewType);
    try {
      const fileName = `mechanisms/${Date.now()}-${viewType}-cropped.png`;
      const file = new File([croppedBlob], fileName.split('/').pop()!, { type: 'image/png' });
      const { error: uploadError } = await supabase.storage
        .from('product-models')
        .upload(fileName, file, { contentType: 'image/png', upsert: true });

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
      } as any;
      // Add model_3d_url directly to the DB update object
      (data as any).model_3d_url = form.model_3d_url || null;

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

  const ImageUploadArea = ({ viewType, label, url }: { viewType: 'front' | 'side' | 'top'; label: string; url: string }) => {
    return (
    <DragDropUpload
      variant="thumbnail"
      accept="image/*"
      label={label}
      currentUrl={url || null}
      uploading={uploadingView === viewType}
      showPreview={false}
      onUpload={async (files) => {
        const file = files[0];
        if (file) openCropDialog(file, viewType);
      }}
    />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索执行机构..."
            className="pl-9"
          />
        </div>
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

              {/* 3D Model (GLB) Upload */}
              <div className="space-y-2">
                <Label>3D 模型（GLB）</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 border-2 border-dashed border-border rounded-lg p-3 flex items-center justify-center bg-muted/30 min-h-[48px]">
                    {form.model_3d_url ? (
                      <div className="flex items-center gap-2 w-full">
                        <Box className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-xs text-foreground truncate flex-1">{form.model_3d_url.split('/').pop()}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => setForm(prev => ({ ...prev, model_3d_url: '' }))}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-xs">
                        <Box className="h-5 w-5 mx-auto mb-1" />
                        未上传
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".glb"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingGlb}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingGlb(true);
                        try {
                          const { uploadGLBFile } = await import('@/utils/glbUpload');
                          const url = await uploadGLBFile(file, 'mechanisms');
                          if (url) {
                            setForm(prev => ({ ...prev, model_3d_url: url }));
                            toast.success('3D 模型上传成功');
                          }
                        } catch (err) {
                          toast.error('3D 模型上传失败');
                        } finally {
                          setUploadingGlb(false);
                        }
                      }}
                    />
                    {uploadingGlb && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">上传 .glb 格式3D模型，将替换默认程序化几何体</p>
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
        {mechanisms.filter(m => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          const typeLabel = MECHANISM_TYPES.find(t => t.value === m.type)?.label || '';
          return m.name.toLowerCase().includes(q) || typeLabel.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
        }).map((mech) => (
          <Card key={mech.id} className={mech.enabled === false ? 'opacity-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <MechanismImageDisplay type={mech.type} databaseUrl={mech.front_view_image_url} name={mech.name} />
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

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageFile={cropFile}
        onCropComplete={handleCropComplete}
        recommendedSize={cropViewType === 'front' ? { width: 400, height: 400 } : { width: 400, height: 300 }}
        title={`裁剪${cropViewType === 'front' ? '正' : cropViewType === 'side' ? '侧' : '俯'}视图`}
      />
    </div>
  );
}
