import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Star, Trash2, Upload, FileText, Edit, Download, Eye, Image as ImageIcon, Loader2, CheckCircle2, Code, List, Scan, Layers, LayoutTemplate, FileCode, Link2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { usePPTTemplates, PPTTemplateInsert } from '@/hooks/usePPTTemplates';
import { toast } from 'sonner';
import { parseTemplate, SYSTEM_FIELDS, autoMapFields, getFieldLabel, type ParsedTemplate, type FieldMapping } from '@/services/pptTemplateParser';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 动态页面结构选项 - 将根据模板解析结果动态更新
const DEFAULT_SECTION_OPTIONS = [
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
    background_image_url: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBgFile, setSelectedBgFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      scope: 'all',
      is_default: false,
      structure_meta: { sections: ['cover', 'overview', 'workstation_info', 'layout_views', 'module_target', 'bom'] },
      background_image_url: '',
    });
    setSelectedFile(null);
    setSelectedBgFile(null);
    setParsedTemplate(null);
    setFieldMappings([]);
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
      background_image_url: template.background_image_url || '',
    });
    setSelectedFile(null);
    setSelectedBgFile(null);
    setParsedTemplate(null);
    setFieldMappings([]);
    setDialogOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pptx') && !file.name.endsWith('.ppt')) {
        toast.error('请选择 .pptx 或 .ppt 文件');
        return;
      }
      setSelectedFile(file);
      
      // 自动解析模板
      setParsing(true);
      setParsedTemplate(null);
      setFieldMappings([]);
      
      try {
        const result = await parseTemplate({ file });
        if (result.success && result.template) {
          setParsedTemplate(result.template);
          // 自动映射字段
          const mappings = autoMapFields(result.template.customFields);
          setFieldMappings(mappings);
          toast.success(`解析成功：发现 ${result.template.masters.length} 个母版, ${result.template.customFields.length} 个占位符`);
        } else {
          toast.error(result.error || '解析失败');
        }
      } catch (error) {
        console.error('Parse template error:', error);
        toast.error('解析模板时发生错误');
      } finally {
        setParsing(false);
      }
    }
  };

  const handleSectionToggle = (sectionId: string, checked: boolean) => {
    const currentSections = formData.structure_meta?.sections || [];
    const newSections = checked
      ? [...currentSections, sectionId]
      : currentSections.filter(s => s !== sectionId);
    setFormData({ ...formData, structure_meta: { sections: newSections } });
  };

  const handleBgFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件');
        return;
      }
      setSelectedBgFile(file);
    }
  };

  const uploadBackgroundImage = async (file: File, templateId: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `backgrounds/${templateId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('ppt-templates')
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('ppt-templates')
      .getPublicUrl(path);

    return data.publicUrl;
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
        let background_image_url: string | undefined;
        
        if (selectedFile) {
          file_url = await uploadTemplateFile(selectedFile, editingId);
        }
        if (selectedBgFile) {
          background_image_url = await uploadBackgroundImage(selectedBgFile, editingId);
        }
        
        await updateTemplate.mutateAsync({
          id: editingId,
          updates: {
            ...formData,
            ...(file_url && { file_url }),
            ...(background_image_url && { background_image_url }),
          },
        });
      } else {
        // Create new
        const result = await addTemplate.mutateAsync(formData);
        if (result?.id) {
          const updates: Record<string, string> = {};
          
          if (selectedFile) {
            updates.file_url = await uploadTemplateFile(selectedFile, result.id);
          }
          if (selectedBgFile) {
            updates.background_image_url = await uploadBackgroundImage(selectedBgFile, result.id);
          }
          
          if (Object.keys(updates).length > 0) {
            await updateTemplate.mutateAsync({
              id: result.id,
              updates,
            });
          }
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
                    const section = DEFAULT_SECTION_OPTIONS.find(s => s.id === sectionId);
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

                {tpl.background_image_url && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="h-3 w-3" />
                    <span>已设置背景图</span>
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
                {parsing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在解析模板...</span>
                  </div>
                )}
              </div>
            </div>

            {/* 解析结果预览 */}
            {parsedTemplate && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    解析成功
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {parsedTemplate.slideCount} 页 · {(parsedTemplate.dimensions.width / 914400).toFixed(1)}×{(parsedTemplate.dimensions.height / 914400).toFixed(1)} 英寸
                  </div>
                </div>

                <Tabs defaultValue="masters" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-8">
                    <TabsTrigger value="masters" className="text-xs gap-1">
                      <Layers className="h-3 w-3" />
                      母版 ({parsedTemplate.masters.length})
                    </TabsTrigger>
                    <TabsTrigger value="layouts" className="text-xs gap-1">
                      <LayoutTemplate className="h-3 w-3" />
                      布局 ({parsedTemplate.layouts.length})
                    </TabsTrigger>
                    <TabsTrigger value="fields" className="text-xs gap-1">
                      <FileCode className="h-3 w-3" />
                      占位符 ({parsedTemplate.customFields.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="masters" className="mt-2">
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {parsedTemplate.masters.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">未检测到母版</p>
                        ) : (
                          parsedTemplate.masters.map((master, idx) => (
                            <div key={master.id} className="flex items-center justify-between p-2 bg-background rounded border">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-6 h-4 rounded border"
                                  style={{ 
                                    backgroundColor: master.background.type === 'color' ? master.background.value : undefined,
                                    backgroundImage: master.background.type === 'gradient' ? master.background.value : undefined,
                                  }}
                                />
                                <span className="text-sm">{master.name || `母版 ${idx + 1}`}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {master.placeholders.length} 占位
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="layouts" className="mt-2">
                    <ScrollArea className="h-32">
                      <div className="space-y-1">
                        {parsedTemplate.layouts.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">未检测到布局</p>
                        ) : (
                          parsedTemplate.layouts.map((layout) => (
                            <div key={layout.id} className="flex items-center justify-between p-2 hover:bg-muted rounded text-sm">
                              <div className="flex items-center gap-2">
                                <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{layout.name || layout.type}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {layout.placeholders.length} 占位
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="fields" className="mt-2">
                    <ScrollArea className="h-32">
                      {parsedTemplate.customFields.length === 0 ? (
                        <div className="text-center py-4">
                          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">
                            未发现 {'{{field}}'} 格式的占位符
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            在模板中使用 {'{{project_name}}'} 等语法来定义动态字段
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {parsedTemplate.customFields.map((field, idx) => {
                            const mapping = fieldMappings.find(m => m.templateField === field);
                            return (
                              <div key={idx} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {`{{${field}}}`}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  {mapping ? (
                                    <>
                                      <Link2 className="h-3 w-3 text-green-500" />
                                      <span className="text-xs text-green-600">
                                        {getFieldLabel(mapping.systemField)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">未映射</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>

                {/* 字段映射统计 */}
                {parsedTemplate.customFields.length > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="text-muted-foreground">
                      已映射: {fieldMappings.length}/{parsedTemplate.customFields.length} 个字段
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        const mappings = autoMapFields(parsedTemplate.customFields);
                        setFieldMappings(mappings);
                        toast.success(`自动映射了 ${mappings.length} 个字段`);
                      }}
                    >
                      重新自动映射
                    </Button>
                  </div>
                )}
              </div>
            )}
            {/* Background Image Upload */}
            <div className="space-y-2">
              <Label>PPT背景图（可选，将应用到所有页面）</Label>
              <div className="flex gap-2 items-center">
                <Input
                  ref={bgFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBgFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => bgFileInputRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4" />
                  {selectedBgFile ? selectedBgFile.name : (formData.background_image_url ? '更换背景图' : '选择背景图')}
                </Button>
                {(formData.background_image_url || selectedBgFile) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedBgFile(null);
                      setFormData({ ...formData, background_image_url: '' });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {formData.background_image_url && !selectedBgFile && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-3 w-3" />
                  <span>已有背景图</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>页面结构（勾选需要生成的页面）</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                {DEFAULT_SECTION_OPTIONS.map(section => (
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
                    const section = DEFAULT_SECTION_OPTIONS.find(s => s.id === sectionId);
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
