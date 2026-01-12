import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Star, Trash2, Upload, FileText, Edit, Download, Eye } from 'lucide-react';
import { usePPTTemplates, PPTTemplateInsert } from '@/hooks/usePPTTemplates';
import { toast } from 'sonner';

const SECTION_OPTIONS = [
  { id: 'cover', label: '封面页' },
  { id: 'overview', label: '项目概览页' },
  { id: 'workstation_info', label: '工位基本信息页' },
  { id: 'workstation_annotation', label: '工位产品标注页' },
  { id: 'layout_views', label: '三视图布局页' },
  { id: 'workstation_hardware', label: '工位硬件清单页' },
  { id: 'module_target', label: '模块目标与检测项' },
  { id: 'module_schematic', label: '模块示意图页' },
  { id: 'module_annotation', label: '模块局部标注页' },
  { id: 'bom', label: 'BOM汇总页' },
];

const SCOPE_OPTIONS = [
  { value: 'all', label: '通用（所有项目）' },
  { value: 'assembly', label: '总装检测' },
  { value: 'sorting', label: '分拣应用' },
  { value: 'packaging', label: '包装检测' },
];

export function PPTTemplateManager() {
  const {
    templates,
    isLoading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    uploadTemplateFile,
  } = usePPTTemplates();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PPTTemplateInsert>({
    name: '',
    description: '',
    scope: 'all',
    is_default: false,
    structure_meta: { sections: ['cover', 'overview', 'workstation_info', 'layout_views', 'module_target', 'bom'] },
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      scope: 'all',
      is_default: false,
      structure_meta: { sections: ['cover', 'overview', 'workstation_info', 'layout_views', 'module_target', 'bom'] },
    });
    setSelectedFile(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (template: typeof templates[0]) => {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      description: template.description || '',
      scope: template.scope || 'all',
      is_default: template.is_default || false,
      structure_meta: template.structure_meta || { sections: [] },
    });
    setSelectedFile(null);
    setDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pptx') && !file.name.endsWith('.ppt')) {
        toast.error('请选择 .pptx 或 .ppt 文件');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSectionToggle = (sectionId: string, checked: boolean) => {
    const currentSections = formData.structure_meta?.sections || [];
    const newSections = checked
      ? [...currentSections, sectionId]
      : currentSections.filter(s => s !== sectionId);
    setFormData({ ...formData, structure_meta: { sections: newSections } });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入模板名称');
      return;
    }

    setUploading(true);
    try {
      if (editingId) {
        // Update existing
        let file_url: string | undefined;
        if (selectedFile) {
          file_url = await uploadTemplateFile(selectedFile, editingId);
        }
        await updateTemplate.mutateAsync({
          id: editingId,
          updates: {
            ...formData,
            ...(file_url && { file_url }),
          },
        });
      } else {
        // Create new
        const result = await addTemplate.mutateAsync(formData);
        if (selectedFile && result?.id) {
          const file_url = await uploadTemplateFile(selectedFile, result.id);
          await updateTemplate.mutateAsync({
            id: result.id,
            updates: { file_url },
          });
        }
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Save template error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除此模板吗？')) {
      deleteTemplate.mutate(id);
    }
  };

  const previewTemplate = templates.find(t => t.id === previewId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          管理PPT生成模板，定义页面结构与适用范围
        </p>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          新建模板
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">暂无PPT模板</p>
            <Button onClick={handleOpenCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              创建第一个模板
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tpl => (
            <Card key={tpl.id} className={tpl.is_default ? 'border-primary ring-1 ring-primary/20' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {tpl.name}
                      {tpl.is_default && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          默认
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      版本 {tpl.version} · {SCOPE_OPTIONS.find(s => s.value === tpl.scope)?.label || '通用'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {tpl.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tpl.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-1">
                  {tpl.structure_meta?.sections?.slice(0, 4).map(sectionId => {
                    const section = SECTION_OPTIONS.find(s => s.id === sectionId);
                    return section ? (
                      <Badge key={sectionId} variant="outline" className="text-xs">
                        {section.label}
                      </Badge>
                    ) : null;
                  })}
                  {(tpl.structure_meta?.sections?.length || 0) > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{(tpl.structure_meta?.sections?.length || 0) - 4}
                    </Badge>
                  )}
                </div>

                {tpl.file_url && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>已上传母版文件</span>
                  </div>
                )}

                <div className="flex gap-1 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewId(tpl.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(tpl)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {tpl.file_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a href={tpl.file_url} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {!tpl.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultTemplate.mutate(tpl.id)}
                    >
                      设为默认
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive ml-auto"
                    onClick={() => handleDelete(tpl.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? '编辑模板' : '新建PPT模板'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>模板名称 *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：标准检测方案模板"
              />
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="模板用途说明..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>适用范围</Label>
                <Select
                  value={formData.scope}
                  onValueChange={value => setFormData({ ...formData, scope: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>上传母版文件</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pptx,.ppt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {selectedFile ? selectedFile.name : '选择文件'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>页面结构（勾选需要生成的页面）</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                {SECTION_OPTIONS.map(section => (
                  <div key={section.id} className="flex items-center gap-2">
                    <Checkbox
                      id={section.id}
                      checked={formData.structure_meta?.sections?.includes(section.id)}
                      onCheckedChange={(checked) => handleSectionToggle(section.id, !!checked)}
                    />
                    <Label htmlFor={section.id} className="text-sm font-normal cursor-pointer">
                      {section.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: !!checked })}
              />
              <Label htmlFor="is_default" className="font-normal cursor-pointer">
                设为默认模板
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? '保存中...' : (editingId ? '保存修改' : '创建模板')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewId} onOpenChange={() => setPreviewId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>模板结构预览</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{previewTemplate.name}</h4>
                <p className="text-sm text-muted-foreground">{previewTemplate.description}</p>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground">生成页面顺序</Label>
                <ol className="mt-2 space-y-1">
                  {previewTemplate.structure_meta?.sections?.map((sectionId, idx) => {
                    const section = SECTION_OPTIONS.find(s => s.id === sectionId);
                    return section ? (
                      <li key={sectionId} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        {section.label}
                      </li>
                    ) : null;
                  })}
                </ol>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
