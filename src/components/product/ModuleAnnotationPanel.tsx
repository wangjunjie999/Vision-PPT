import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  Camera,
  Star,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Box,
  Eye,
  Save,
  Loader2,
  FileImage,
  Clock,
  Link2,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product3DViewer } from './Product3DViewer';
import { AnnotationCanvas, Annotation } from './AnnotationCanvas';

interface ProductAsset {
  id: string;
  workstation_id: string | null;
  module_id: string | null;
  scope_type: 'workstation' | 'module';
  source_type: string;
  model_file_url: string | null;
  preview_images: string[];
  created_at: string;
  updated_at: string;
}

interface AnnotationRecord {
  id: string;
  asset_id: string;
  snapshot_url: string;
  annotations_json: Annotation[];
  view_meta: {
    cameraPosition?: [number, number, number];
    cameraTarget?: [number, number, number];
    viewName?: string;
    isReference?: boolean;
    referenceAssetId?: string;
  } | null;
  version: number;
  remark: string | null;
  created_at: string;
  is_default?: boolean;
}

interface ModuleAnnotationPanelProps {
  moduleId: string;
  workstationId: string;
}

export function ModuleAnnotationPanel({ moduleId, workstationId }: ModuleAnnotationPanelProps) {
  const { user } = useAuth();
  const [moduleAsset, setModuleAsset] = useState<ProductAsset | null>(null);
  const [workstationAsset, setWorkstationAsset] = useState<ProductAsset | null>(null);
  const [moduleAnnotations, setModuleAnnotations] = useState<AnnotationRecord[]>([]);
  const [workstationAnnotations, setWorkstationAnnotations] = useState<AnnotationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<string | null>(null);
  const [currentAnnotations, setCurrentAnnotations] = useState<Annotation[]>([]);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [viewerRef, setViewerRef] = useState<{ takeScreenshot: () => string | null } | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveRemark, setSaveRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AnnotationRecord | null>(null);
  const [defaultRecordId, setDefaultRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('viewer');
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);

  // Load module and workstation assets/annotations
  const loadData = useCallback(async () => {
    if (!moduleId || !workstationId || !user) return;
    setLoading(true);
    try {
      // Load module-specific asset
      const { data: moduleAssetData } = await supabase
        .from('product_assets')
        .select('*')
        .eq('module_id', moduleId)
        .eq('scope_type', 'module')
        .maybeSingle();

      if (moduleAssetData) {
        const previewImages = Array.isArray(moduleAssetData.preview_images)
          ? moduleAssetData.preview_images as string[]
          : [];
        setModuleAsset({ ...moduleAssetData, preview_images: previewImages } as ProductAsset);

        // Load annotations for module asset
        const { data: annotData } = await supabase
          .from('product_annotations')
          .select('*')
          .eq('asset_id', moduleAssetData.id)
          .order('version', { ascending: false });

        const records = (annotData || []).map(a => ({
          ...a,
          annotations_json: a.annotations_json as unknown as Annotation[],
          view_meta: a.view_meta as AnnotationRecord['view_meta'],
        }));
        setModuleAnnotations(records);
        if (records.length > 0) {
          setDefaultRecordId(records[0].id);
        }
      } else {
        setModuleAsset(null);
        setModuleAnnotations([]);
      }

      // Load workstation asset for reference
      const { data: wsAssetData } = await supabase
        .from('product_assets')
        .select('*')
        .eq('workstation_id', workstationId)
        .eq('scope_type', 'workstation')
        .maybeSingle();

      if (wsAssetData) {
        const previewImages = Array.isArray(wsAssetData.preview_images)
          ? wsAssetData.preview_images as string[]
          : [];
        setWorkstationAsset({ ...wsAssetData, preview_images: previewImages } as ProductAsset);

        // Load workstation annotations
        const { data: wsAnnotData } = await supabase
          .from('product_annotations')
          .select('*')
          .eq('asset_id', wsAssetData.id)
          .order('version', { ascending: false });

        const wsRecords = (wsAnnotData || []).map(a => ({
          ...a,
          annotations_json: a.annotations_json as unknown as Annotation[],
          view_meta: a.view_meta as AnnotationRecord['view_meta'],
        }));
        setWorkstationAnnotations(wsRecords);
      } else {
        setWorkstationAsset(null);
        setWorkstationAnnotations([]);
      }
    } catch (error) {
      console.error('Failed to load annotation data:', error);
      toast.error('加载标注数据失败');
    } finally {
      setLoading(false);
    }
  }, [moduleId, workstationId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Upload image for module
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    try {
      const file = files[0];
      const isImage = file.name.match(/\.(jpg|jpeg|png|webp)$/i);

      if (!isImage) {
        toast.error('请上传图片文件 (jpg/png/webp)');
        return;
      }

      const bucket = 'product-models';
      const path = `modules/${moduleId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      if (moduleAsset) {
        const { error } = await supabase
          .from('product_assets')
          .update({
            preview_images: [...(moduleAsset.preview_images || []), fileUrl],
            updated_at: new Date().toISOString(),
          })
          .eq('id', moduleAsset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_assets').insert({
          module_id: moduleId,
          scope_type: 'module',
          source_type: 'image',
          model_file_url: null,
          preview_images: [fileUrl],
          user_id: user.id,
        });
        if (error) throw error;
      }

      await loadData();
      toast.success('图片上传成功');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // Take screenshot from viewer
  const handleTakeScreenshot = () => {
    if (viewerRef) {
      const dataUrl = viewerRef.takeScreenshot();
      if (dataUrl) {
        setCurrentSnapshot(dataUrl);
        setCurrentAnnotations([]);
        setIsAnnotating(true);
        setActiveTab('annotate');
        toast.success('截图成功，请进行标注');
      }
    }
  };

  // Reference workstation annotation
  const handleReferenceAnnotation = async (record: AnnotationRecord) => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Create module asset if not exists
      let assetId = moduleAsset?.id;
      if (!assetId) {
        const { data: newAsset, error: assetError } = await supabase
          .from('product_assets')
          .insert({
            module_id: moduleId,
            scope_type: 'module',
            source_type: 'reference',
            user_id: user.id,
          })
          .select()
          .single();
        if (assetError) throw assetError;
        assetId = newAsset.id;
      }

      // Calculate next version
      const nextVersion = moduleAnnotations.length > 0
        ? Math.max(...moduleAnnotations.map(a => a.version)) + 1
        : 1;

      // Create reference annotation
      const { error } = await supabase.from('product_annotations').insert({
        asset_id: assetId,
        snapshot_url: record.snapshot_url,
        annotations_json: record.annotations_json as unknown as any,
        view_meta: {
          ...record.view_meta,
          isReference: true,
          referenceAssetId: record.asset_id,
          viewName: `引用工位-版本${record.version}`,
        },
        version: nextVersion,
        remark: `引用自工位标注版本${record.version}`,
        user_id: user.id,
      });

      if (error) throw error;

      await loadData();
      setReferenceDialogOpen(false);
      toast.success('已引用工位标注');
    } catch (error) {
      console.error('Reference failed:', error);
      toast.error('引用失败');
    } finally {
      setSaving(false);
    }
  };

  // Save annotation
  const handleSaveAnnotation = async () => {
    if (!currentSnapshot || !user) return;

    setSaving(true);
    try {
      // Create module asset if not exists
      let assetId = moduleAsset?.id;
      if (!assetId) {
        const { data: newAsset, error: assetError } = await supabase
          .from('product_assets')
          .insert({
            module_id: moduleId,
            scope_type: 'module',
            source_type: 'image',
            user_id: user.id,
          })
          .select()
          .single();
        if (assetError) throw assetError;
        assetId = newAsset.id;
      }

      // Upload snapshot
      const blob = await fetch(currentSnapshot).then(r => r.blob());
      const path = `modules/${moduleId}/snapshots/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('product-snapshots')
        .upload(path, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('product-snapshots').getPublicUrl(path);
      const snapshotUrl = urlData.publicUrl;

      const nextVersion = moduleAnnotations.length > 0
        ? Math.max(...moduleAnnotations.map(a => a.version)) + 1
        : 1;

      const { error } = await supabase.from('product_annotations').insert({
        asset_id: assetId,
        snapshot_url: snapshotUrl,
        annotations_json: currentAnnotations as unknown as any,
        view_meta: { viewName: `版本${nextVersion}` },
        version: nextVersion,
        remark: saveRemark || null,
        user_id: user.id,
      });

      if (error) throw error;

      await loadData();
      setIsAnnotating(false);
      setCurrentSnapshot(null);
      setCurrentAnnotations([]);
      setSaveDialogOpen(false);
      setSaveRemark('');
      setActiveTab('records');
      toast.success('标注已保存');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = (recordId: string) => {
    setDefaultRecordId(recordId);
    toast.success('已设为PPT默认使用');
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('product_annotations')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      await loadData();
      toast.success('记录已删除');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('删除失败');
    }
  };

  const handleViewRecord = (record: AnnotationRecord) => {
    setSelectedRecord(record);
    setCurrentSnapshot(record.snapshot_url);
    setCurrentAnnotations(record.annotations_json || []);
    setIsAnnotating(false);
    setActiveTab('annotate');
  };

  // Get display asset (module's own or workstation's for viewing)
  const displayAsset = moduleAsset || workstationAsset;

  if (loading) {
    return (
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            产品局部标注
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            产品局部标注
          </CardTitle>
          {workstationAnnotations.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReferenceDialogOpen(true)}
              className="gap-1 h-7 text-xs"
            >
              <Link2 className="h-3 w-3" />
              引用工位标注
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="viewer" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              查看
            </TabsTrigger>
            <TabsTrigger value="annotate" className="text-xs" disabled={!currentSnapshot}>
              <Edit3 className="h-3 w-3 mr-1" />
              标注
            </TabsTrigger>
            <TabsTrigger value="records" className="text-xs">
              <FileImage className="h-3 w-3 mr-1" />
              记录({moduleAnnotations.length})
            </TabsTrigger>
          </TabsList>

          {/* Viewer Tab */}
          <TabsContent value="viewer" className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">上传局部图片</Label>
              <label className="block">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <div className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed rounded-md cursor-pointer transition-colors",
                  "hover:border-primary hover:bg-primary/5",
                  uploading && "opacity-50 cursor-not-allowed"
                )}>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="text-xs">
                    {uploading ? '上传中...' : '上传检测区域图片'}
                  </span>
                </div>
              </label>
            </div>

            {displayAsset ? (
              <div className="space-y-2">
                <Product3DViewer
                  modelUrl={displayAsset.model_file_url}
                  imageUrls={[
                    ...(moduleAsset?.preview_images || []),
                    ...(workstationAsset?.preview_images || []),
                  ]}
                  onReady={setViewerRef}
                />
                <div className="flex justify-center">
                  <Button size="sm" onClick={handleTakeScreenshot} className="gap-1">
                    <Camera className="h-4 w-4" />
                    截图并标注
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-2 opacity-30" />
                <p className="text-xs">暂无产品素材</p>
                <p className="text-xs">请上传图片或引用工位标注</p>
              </div>
            )}
          </TabsContent>

          {/* Annotation Tab */}
          <TabsContent value="annotate" className="mt-3">
            {currentSnapshot ? (
              <div className="space-y-3">
                <AnnotationCanvas
                  imageUrl={currentSnapshot}
                  annotations={currentAnnotations}
                  onChange={setCurrentAnnotations}
                  readOnly={!isAnnotating}
                />
                {isAnnotating && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsAnnotating(false);
                        setCurrentSnapshot(null);
                        setCurrentAnnotations([]);
                        setActiveTab('viewer');
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSaveDialogOpen(true)}
                      disabled={currentAnnotations.length === 0}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      保存标注
                    </Button>
                  </div>
                )}
                {selectedRecord && !isAnnotating && (
                  <div className="text-center">
                    <Badge variant="outline" className="text-xs">
                      {selectedRecord.view_meta?.isReference && (
                        <Link2 className="h-3 w-3 mr-1" />
                      )}
                      版本 {selectedRecord.version} - {selectedRecord.remark || '无备注'}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Camera className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">请先截图或选择记录查看</p>
              </div>
            )}
          </TabsContent>

          {/* Records Tab */}
          <TabsContent value="records" className="mt-3">
            {moduleAnnotations.length > 0 ? (
              <ScrollArea className="h-[250px]">
                <div className="space-y-2">
                  {moduleAnnotations.map((record) => (
                    <div
                      key={record.id}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors",
                        "hover:bg-secondary/50",
                        defaultRecordId === record.id && "border-primary bg-primary/5"
                      )}
                      onClick={() => handleViewRecord(record)}
                    >
                      <img
                        src={record.snapshot_url}
                        alt={`版本${record.version}`}
                        className="w-16 h-12 object-cover rounded border"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">版本 {record.version}</span>
                          {record.view_meta?.isReference && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              <Link2 className="h-2.5 w-2.5 mr-0.5" />
                              引用
                            </Badge>
                          )}
                          {defaultRecordId === record.id && (
                            <Badge variant="default" className="text-[10px] h-4 px-1">
                              <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                              默认
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {record.remark || '无备注'}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(record.created_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {defaultRecordId !== record.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(record.id);
                            }}
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRecord(record.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileImage className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">暂无标注记录</p>
                <p className="text-xs">可截图标注或引用工位标注</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>保存标注</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>备注说明</Label>
              <Textarea
                value={saveRemark}
                onChange={(e) => setSaveRemark(e.target.value)}
                placeholder="描述此标注的重点区域或用途..."
                className="min-h-[80px]"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              已标注 {currentAnnotations.length} 个区域
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveAnnotation} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reference Workstation Annotation Dialog */}
      <Dialog open={referenceDialogOpen} onOpenChange={setReferenceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              引用工位标注
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              选择要引用的工位级标注，将作为模块的局部标注基础
            </p>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {workstationAnnotations.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleReferenceAnnotation(record)}
                  >
                    <img
                      src={record.snapshot_url}
                      alt={`版本${record.version}`}
                      className="w-20 h-14 object-cover rounded border"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">工位标注 版本{record.version}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {record.remark || '无备注'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {new Date(record.created_at).toLocaleString('zh-CN')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(record.annotations_json || []).length} 个标注区域
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0">
                      <Plus className="h-3 w-3 mr-1" />
                      引用
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferenceDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
