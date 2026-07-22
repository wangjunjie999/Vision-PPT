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
  DialogDescription,
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
  Plus,
  Info,
  X,
  Maximize2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnnotationCanvas, Annotation } from './AnnotationCanvas';
import { useAppStore } from '@/store/useAppStore';
import { getSupportedProductModelHint, type ProductViewerDisplayMode } from '@/utils/productViewer';
import { toLocalProxyUrl } from '@/utils/storageUrl';
import { uploadStorageFile } from '@/utils/storageUpload';
import { createSafeStorageObjectName } from '@/utils/storageFileNames';
import { DragDropUpload } from '@/components/upload/DragDropUpload';

interface ProductModelItem {
  name: string;
  spec: string;
}

interface DetectionRequirementItem {
  content: string;
  highlight?: string | null;
}

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
  // New product info fields
  detection_method?: string | null;
  product_models?: ProductModelItem[] | null;
  detection_requirements?: DetectionRequirementItem[] | null;
  // Multi-product identity
  product_name?: string | null;
  product_code?: string | null;
  product_spec?: string | null;
  is_primary?: boolean;
  sort_order?: number;
  parent_product_id?: string | null;
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

function getPreferredDisplayMode(asset: ProductAsset): ProductViewerDisplayMode {
  if (asset.source_type === 'image') return 'image';
  if (asset.source_type === 'model') return 'model';
  return 'auto';
}

function getSingleViewerMedia(asset: ProductAsset): { modelUrl: string | null; imageUrls: string[] } {
  const mode = getPreferredDisplayMode(asset);
  if (mode === 'model') {
    return { modelUrl: asset.model_file_url, imageUrls: [] };
  }

  return { modelUrl: null, imageUrls: (asset.preview_images || []).slice(0, 1) };
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveRemark, setSaveRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AnnotationRecord | null>(null);
  const [defaultRecordId, setDefaultRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('viewer');

  // Product info state
  const [detectionMethod, setDetectionMethod] = useState('');
  const [productModels, setProductModels] = useState<ProductModelItem[]>([]);
  const [detectionRequirements, setDetectionRequirements] = useState<DetectionRequirementItem[]>([]);
  const [savingInfo, setSavingInfo] = useState(false);

  // Sync product info from asset
  useEffect(() => {
    if (asset) {
      setDetectionMethod(asset.detection_method || '');
      setProductModels(asset.product_models || []);
      setDetectionRequirements(asset.detection_requirements || []);
    }
  }, [asset]);

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
        const productModels = Array.isArray(assetData.product_models)
          ? assetData.product_models as unknown as ProductModelItem[]
          : [];
        const detectionRequirements = Array.isArray(assetData.detection_requirements)
          ? assetData.detection_requirements as unknown as DetectionRequirementItem[]
          : [];
        setAsset({
          ...assetData,
          preview_images: previewImages,
          product_models: productModels,
          detection_requirements: detectionRequirements,
        } as ProductAsset);

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
    if (files.length > 1) {
      toast.error('一次只能上传一个文件，请选择一个 3D 模型或一张图片');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const file = files[0];
      const isModel = file.name.match(/\.(glb|gltf)$/i);
      const isImage = file.name.match(/\.(jpg|jpeg|png|webp)$/i);

      const cadExts = /\.(sldprt|sldasm|step|stp|iges|igs|x_t|x_b|sat|catpart|catproduct|prt|asm)$/i;
      if (cadExts.test(file.name)) {
        const ext = file.name.split('.').pop()?.toUpperCase() || '';
        toast.error(
          `${ext} 是 CAD 原始格式，浏览器无法直接加载。请先将模型转换为 GLB 格式后再上传。`,
          { duration: 8000 }
        );
        return;
      }

      if (!isModel && !isImage) {
        toast.error('不支持的文件格式，请上传 3D 模型(GLB/GLTF)或图片');
        return;
      }

      // GLB: use same bucket + policies as hardware center (3d-models via uploadGLBFile).
      // GLTF + images: keep product-models direct upload.
      let fileUrl: string;
      const isGlb = /\.glb$/i.test(file.name);
      if (isModel && isGlb) {
        const { uploadGLBFile } = await import('@/utils/glbUpload');
        const url = await uploadGLBFile(file, 'workstation-product');
        if (!url) return;
        fileUrl = url;
      } else {
        const bucket = 'product-models';
        const path = `${workstationId}/${createSafeStorageObjectName(file.name, {
          fallbackBase: isModel ? 'model' : 'image',
          fallbackExtension: isModel ? 'gltf' : 'png',
        })}`;
        const { publicUrl } = await uploadStorageFile(bucket, path, file, {
          contentType: file.type || undefined,
        });
        fileUrl = publicUrl;
      }

      // Create or update asset
      if (asset) {
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };
        if (isModel) {
          updateData.model_file_url = fileUrl;
          updateData.preview_images = [];
          updateData.source_type = 'model';
        } else {
          updateData.model_file_url = null;
          updateData.preview_images = [fileUrl];
          updateData.source_type = 'image';
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

      // Auto enter viewer mode after upload
      // Need to re-fetch to get latest asset data
      const { data: latestAsset } = await supabase
        .from('product_assets')
        .select('*')
        .eq('workstation_id', workstationId)
        .eq('scope_type', 'workstation')
        .maybeSingle();
      if (latestAsset) {
        const images = Array.isArray(latestAsset.preview_images) ? latestAsset.preview_images as string[] : [];
        const latestProductAsset = {
          ...latestAsset,
          preview_images: images,
        } as unknown as ProductAsset;
        const viewerMedia = getSingleViewerMedia(latestProductAsset);
        if (viewerMedia.modelUrl || viewerMedia.imageUrls.length > 0) {
          useAppStore.getState().enterViewerMode(
            viewerMedia.modelUrl,
            viewerMedia.imageUrls,
            latestAsset.id,
            'workstation',
            getPreferredDisplayMode(latestProductAsset)
          );
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg ? `上传失败: ${msg}` : '上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
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
    setAnnotations(prev => {
      const idx = prev.findIndex(a => a.id === recordId);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const [target] = copy.splice(idx, 1);
      copy.unshift(target);
      return copy;
    });
    toast.success('已标记为首选（PPT将包含所有标注记录）');
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

  // View existing annotation record - jump to canvas
  const handleViewRecord = (record: AnnotationRecord) => {
    if (!asset) return;
    useAppStore.getState().enterAnnotationMode(
      record.snapshot_url,
      asset.id,
      'workstation',
      workstationId,
      {
        annotations: record.annotations_json || [],
        remark: record.remark,
        recordId: record.id,
      }
    );
    toast.success('已进入标注查看模式');
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
            <TabsTrigger value="info" className="text-xs">
              <Info className="h-3 w-3 mr-1" />
              产品信息
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
              <DragDropUpload
                accept=".glb,.gltf,.jpg,.jpeg,.png,.webp"
                maxSize={50}
                showPreview={false}
                uploading={uploading}
                label="拖拽 3D 模型或图片到此处"
                hint="支持 .glb / .gltf / jpg / png / webp"
                onUpload={async (files) => {
                  const file = files[0];
                  if (!file) return;
                  const fakeEvent = { target: { files: [file], value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
                  await handleFileUpload(fakeEvent);
                }}
              />
              {asset && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  更新于 {new Date(asset.updated_at).toLocaleString('zh-CN')}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{getSupportedProductModelHint()}</p>
            </div>

            {/* 3D Viewer */}
            {(asset?.model_file_url || (asset?.preview_images && asset.preview_images.length > 0)) ? (
              <div className="space-y-2">
                {/* Thumbnail preview */}
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  {asset.preview_images?.length > 0 ? (
                    <img
                      src={toLocalProxyUrl(asset.preview_images[0])}
                      alt="产品预览"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Box className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (asset) {
                        const viewerMedia = getSingleViewerMedia(asset);
                        useAppStore.getState().enterViewerMode(
                          viewerMedia.modelUrl,
                          viewerMedia.imageUrls,
                          asset.id,
                          'workstation',
                          getPreferredDisplayMode(asset)
                        );
                      }
                    }}
                    className="gap-1"
                  >
                    <Maximize2 className="h-4 w-4" />
                    在画布中查看
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

          {/* Annotation Tab removed - annotations now viewed/edited in central canvas */}

          {/* Product Info Tab */}
          <TabsContent value="info" className="mt-3">
            <ScrollArea className="h-[350px]">
              <div className="space-y-4 pr-2">
                {/* Detection Method */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">检测方式</Label>
                  <Input
                    value={detectionMethod}
                    onChange={(e) => setDetectionMethod(e.target.value)}
                    placeholder="例如: 2D×4（两台设备，各一拖二，两台工控机）"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Product Models */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">蓝本型号</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setProductModels([...productModels, { name: '', spec: '' }])}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      添加
                    </Button>
                  </div>
                  {productModels.length > 0 ? (
                    <div className="space-y-2">
                      {productModels.map((model, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            value={model.name}
                            onChange={(e) => {
                              const newModels = [...productModels];
                              newModels[idx].name = e.target.value;
                              setProductModels(newModels);
                            }}
                            placeholder="型号名称"
                            className="h-8 text-xs flex-1"
                          />
                          <Input
                            value={model.spec}
                            onChange={(e) => {
                              const newModels = [...productModels];
                              newModels[idx].spec = e.target.value;
                              setProductModels(newModels);
                            }}
                            placeholder="规格 (长*宽*高)"
                            className="h-8 text-xs flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => {
                              const newModels = productModels.filter((_, i) => i !== idx);
                              setProductModels(newModels);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">点击"添加"按钮添加产品型号</p>
                  )}
                </div>

                {/* Detection Requirements */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">检测要求</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setDetectionRequirements([...detectionRequirements, { content: '', highlight: null }])}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      添加
                    </Button>
                  </div>
                  {detectionRequirements.length > 0 ? (
                    <div className="space-y-3">
                      {detectionRequirements.map((req, idx) => (
                        <div key={idx} className="space-y-1 p-2 border rounded-md bg-secondary/20">
                          <div className="flex gap-2 items-start">
                            <span className="text-xs font-medium text-muted-foreground mt-1">{idx + 1}.</span>
                            <Textarea
                              value={req.content}
                              onChange={(e) => {
                                const newReqs = [...detectionRequirements];
                                newReqs[idx].content = e.target.value;
                                setDetectionRequirements(newReqs);
                              }}
                              placeholder="检测要求内容，如：电芯抓取引导定位，精度≤0.1mm，像素≥500W"
                              className="min-h-[60px] text-xs flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => {
                                const newReqs = detectionRequirements.filter((_, i) => i !== idx);
                                setDetectionRequirements(newReqs);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <Input
                            value={req.highlight || ''}
                            onChange={(e) => {
                              const newReqs = [...detectionRequirements];
                              newReqs[idx].highlight = e.target.value || null;
                              setDetectionRequirements(newReqs);
                            }}
                            placeholder="备注/高亮内容（可选），如：换型时拍一次，区分型号"
                            className="h-7 text-xs ml-4"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">点击"添加"按钮添加检测要求</p>
                  )}
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={async () => {
                      if (!asset || !user) {
                        // Create new asset if not exists
                        if (!user) return;
                        setSavingInfo(true);
                        try {
                          const { error } = await supabase.from('product_assets').insert({
                            workstation_id: workstationId,
                            scope_type: 'workstation',
                            source_type: 'image',
                            detection_method: detectionMethod || null,
                            product_models: productModels as unknown as any,
                            detection_requirements: detectionRequirements as unknown as any,
                            user_id: user.id,
                          });
                          if (error) throw error;
                          await loadData();
                          toast.success('产品信息已保存');
                        } catch (error) {
                          console.error('Save failed:', error);
                          toast.error('保存失败');
                        } finally {
                          setSavingInfo(false);
                        }
                        return;
                      }

                      setSavingInfo(true);
                      try {
                        const { error } = await supabase
                          .from('product_assets')
                          .update({
                            detection_method: detectionMethod || null,
                            product_models: productModels as unknown as any,
                            detection_requirements: detectionRequirements as unknown as any,
                            updated_at: new Date().toISOString(),
                          })
                          .eq('id', asset.id);

                        if (error) throw error;
                        await loadData();
                        toast.success('产品信息已保存');
                      } catch (error) {
                        console.error('Save failed:', error);
                        toast.error('保存失败');
                      } finally {
                        setSavingInfo(false);
                      }
                    }}
                    disabled={savingInfo}
                  >
                    {savingInfo && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <Save className="h-4 w-4 mr-1" />
                    保存产品信息
                  </Button>
                </div>
              </div>
            </ScrollArea>
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
                        src={toLocalProxyUrl(record.snapshot_url)}
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
