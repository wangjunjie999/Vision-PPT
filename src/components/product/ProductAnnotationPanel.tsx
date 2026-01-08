import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  Camera,
  RotateCcw,
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
  CheckCircle2,
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
  } | null;
  version: number;
  remark: string | null;
  created_at: string;
  is_default?: boolean;
}

interface ProductAnnotationPanelProps {
  workstationId: string;
}

export function ProductAnnotationPanel({ workstationId }: ProductAnnotationPanelProps) {
  const { user } = useAuth();
  const [asset, setAsset] = useState<ProductAsset | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
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

  // Load asset and annotations
  const loadData = useCallback(async () => {
    if (!workstationId || !user) return;
    setLoading(true);
    try {
      // Load product asset
      const { data: assetData, error: assetError } = await supabase
        .from('product_assets')
        .select('*')
        .eq('workstation_id', workstationId)
        .eq('scope_type', 'workstation')
        .maybeSingle();

      if (assetError) throw assetError;

      if (assetData) {
        const previewImages = Array.isArray(assetData.preview_images) 
          ? assetData.preview_images as string[]
          : [];
        setAsset({ ...assetData, preview_images: previewImages } as ProductAsset);

        // Load annotations for this asset
        const { data: annotData, error: annotError } = await supabase
          .from('product_annotations')
          .select('*')
          .eq('asset_id', assetData.id)
          .order('version', { ascending: false });

        if (annotError) throw annotError;
        
        const records = (annotData || []).map(a => ({
          ...a,
          annotations_json: a.annotations_json as unknown as Annotation[],
          view_meta: a.view_meta as AnnotationRecord['view_meta'],
        }));
        setAnnotations(records);

        // Find default record (highest version or marked as default)
        if (records.length > 0) {
          setDefaultRecordId(records[0].id);
        }
      } else {
        setAsset(null);
        setAnnotations([]);
      }
    } catch (error) {
      console.error('Failed to load product data:', error);
      toast.error('加载产品数据失败');
    } finally {
      setLoading(false);
    }
  }, [workstationId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Upload 3D model or images
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    try {
      const file = files[0];
      const isModel = file.name.match(/\.(glb|gltf|obj|fbx)$/i);
      const isImage = file.name.match(/\.(jpg|jpeg|png|webp)$/i);

      if (!isModel && !isImage) {
        toast.error('不支持的文件格式，请上传3D模型(glb/gltf)或图片');
        return;
      }

      // Upload to storage
      const bucket = 'product-models';
      const path = `${workstationId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      // Create or update asset
      if (asset) {
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };
        if (isModel) {
          updateData.model_file_url = fileUrl;
          updateData.source_type = 'model';
        } else {
          updateData.preview_images = [...(asset.preview_images || []), fileUrl];
          if (!asset.model_file_url) {
            updateData.source_type = 'image';
          }
        }
        const { error } = await supabase
          .from('product_assets')
          .update(updateData)
          .eq('id', asset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_assets').insert({
          workstation_id: workstationId,
          scope_type: 'workstation',
          source_type: isModel ? 'model' : 'image',
          model_file_url: isModel ? fileUrl : null,
          preview_images: isImage ? [fileUrl] : [],
          user_id: user.id,
        });
        if (error) throw error;
      }

      await loadData();
      toast.success('文件上传成功');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // Take screenshot from 3D viewer
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

  // Save annotation record
  const handleSaveAnnotation = async () => {
    if (!currentSnapshot || !asset || !user) return;

    setSaving(true);
    try {
      // Upload snapshot to storage
      const blob = await fetch(currentSnapshot).then(r => r.blob());
      const path = `${workstationId}/snapshots/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('product-snapshots')
        .upload(path, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('product-snapshots').getPublicUrl(path);
      const snapshotUrl = urlData.publicUrl;

      // Calculate next version
      const nextVersion = annotations.length > 0 
        ? Math.max(...annotations.map(a => a.version)) + 1 
        : 1;

      // Insert annotation record
      const { error } = await supabase.from('product_annotations').insert({
        asset_id: asset.id,
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

  // Set record as default for PPT
  const handleSetDefault = async (recordId: string) => {
    setDefaultRecordId(recordId);
    toast.success('已设为PPT默认使用');
  };

  // Delete annotation record
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

  // View existing annotation record
  const handleViewRecord = (record: AnnotationRecord) => {
    setSelectedRecord(record);
    setCurrentSnapshot(record.snapshot_url);
    setCurrentAnnotations(record.annotations_json || []);
    setIsAnnotating(false);
    setActiveTab('annotate');
  };

  if (loading) {
    return (
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            产品3D与特征标注
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
        <CardTitle className="text-sm flex items-center gap-2">
          <Box className="h-4 w-4 text-primary" />
          产品3D与特征标注
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="viewer" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              3D查看
            </TabsTrigger>
            <TabsTrigger value="annotate" className="text-xs" disabled={!currentSnapshot}>
              <Edit3 className="h-3 w-3 mr-1" />
              标注
            </TabsTrigger>
            <TabsTrigger value="records" className="text-xs">
              <FileImage className="h-3 w-3 mr-1" />
              记录({annotations.length})
            </TabsTrigger>
          </TabsList>

          {/* 3D Viewer Tab */}
          <TabsContent value="viewer" className="mt-3 space-y-3">
            {/* Upload Area */}
            <div className="space-y-2">
              <Label className="text-xs">素材上传</Label>
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept=".glb,.gltf,.obj,.jpg,.jpeg,.png,.webp"
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
                      {uploading ? '上传中...' : '上传3D模型或图片'}
                    </span>
                  </div>
                </label>
              </div>
              {asset && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  更新于 {new Date(asset.updated_at).toLocaleString('zh-CN')}
                </div>
              )}
            </div>

            {/* 3D Viewer */}
            {(asset?.model_file_url || (asset?.preview_images && asset.preview_images.length > 0)) ? (
              <div className="space-y-2">
                <Product3DViewer
                  modelUrl={asset.model_file_url}
                  imageUrls={asset.preview_images}
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
                <p className="text-xs">请上传3D模型或多角度图片</p>
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
                      版本 {selectedRecord.version} - {selectedRecord.remark || '无备注'}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Camera className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">请先在3D查看中截图</p>
              </div>
            )}
          </TabsContent>

          {/* Records Tab */}
          <TabsContent value="records" className="mt-3">
            {annotations.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {annotations.map((record) => (
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
                          {defaultRecordId === record.id && (
                            <Badge variant="default" className="text-[10px] h-4 px-1">
                              <Star className="h-2.5 w-2.5 mr-0.5" />
                              PPT默认
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {record.remark || '无备注'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(record.created_at).toLocaleString('zh-CN')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(record.annotations_json || []).length} 个标注
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
                          className="h-6 w-6 text-destructive hover:text-destructive"
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
                <p className="text-xs">请先截图并添加标注</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Save Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>保存标注</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>备注说明</Label>
                <Textarea
                  value={saveRemark}
                  onChange={(e) => setSaveRemark(e.target.value)}
                  placeholder="例如：正面视角、第二版标注..."
                  rows={3}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                共 {currentAnnotations.length} 个标注点
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
      </CardContent>
    </Card>
  );
}
