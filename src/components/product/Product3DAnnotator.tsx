import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Camera, 
  Save, 
  Loader2, 
  Image as ImageIcon, 
  Box, 
  RotateCcw,
  Trash2,
  Eye,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { Model3DViewer } from './Model3DViewer';
import { AnnotationLayer } from './AnnotationLayer';
import { useProductAssets } from '@/hooks/useProductAssets';
import type { Annotation, ViewMeta, ProductAsset, ProductAnnotation } from '@/types/product';

interface Product3DAnnotatorProps {
  scope: 'workstation' | 'module';
  workstationId?: string;
  moduleId?: string;
  onAssetCreated?: (asset: ProductAsset) => void;
}

export function Product3DAnnotator({ 
  scope, 
  workstationId, 
  moduleId,
  onAssetCreated 
}: Product3DAnnotatorProps) {
  const {
    assets,
    annotations: allAnnotations,
    loading,
    fetchAnnotations,
    getAssetByWorkstation,
    getAssetByModule,
    getAnnotationsByAsset,
    createAsset,
    updateAsset,
    createAnnotation,
    deleteAnnotation,
    uploadFile,
    uploadSnapshot,
  } = useProductAssets();

  const [activeTab, setActiveTab] = useState<'upload' | 'view' | 'annotate' | 'history'>('upload');
  const [uploading, setUploading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [currentAsset, setCurrentAsset] = useState<ProductAsset | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [viewMeta, setViewMeta] = useState<ViewMeta>({});
  const [remark, setRemark] = useState('');
  
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Load existing asset
  useEffect(() => {
    let asset: ProductAsset | undefined;
    if (scope === 'workstation' && workstationId) {
      asset = getAssetByWorkstation(workstationId);
    } else if (scope === 'module' && moduleId) {
      asset = getAssetByModule(moduleId);
    }
    
    if (asset) {
      setCurrentAsset(asset);
      if (asset.source_type === 'image' && asset.preview_images.length > 0) {
        setImageUrl(asset.preview_images[0]);
      }
      fetchAnnotations(asset.id);
      setActiveTab('view');
    }
  }, [scope, workstationId, moduleId, getAssetByWorkstation, getAssetByModule, fetchAnnotations, assets]);

  // Get annotations for current asset
  const assetAnnotations = currentAsset ? getAnnotationsByAsset(currentAsset.id) : [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext || '');
    const is3D = ['glb', 'gltf', 'stl'].includes(ext || '');

    if (!isImage && !is3D) {
      toast.error('请上传图片(PNG/JPG)或3D模型(GLB/GLTF/STL)');
      return;
    }

    setUploading(true);
    try {
      const bucket = is3D ? 'product-models' : 'product-snapshots';
      const url = await uploadFile(file, bucket);
      
      if (!url) throw new Error('Upload failed');

      const sourceType = isImage ? 'image' : (ext as 'glb' | 'gltf' | 'stl');
      
      const assetData = {
        scope_type: scope,
        workstation_id: scope === 'workstation' ? workstationId : undefined,
        module_id: scope === 'module' ? moduleId : undefined,
        source_type: sourceType,
        model_file_url: is3D ? url : undefined,
        preview_images: isImage ? [url] : [],
      };

      const asset = await createAsset(assetData);
      if (asset) {
        setCurrentAsset(asset);
        if (isImage) {
          setImageUrl(url);
        }
        onAssetCreated?.(asset);
        setActiveTab('view');
        toast.success('文件上传成功');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleCameraChange = useCallback((position: [number, number, number], rotation: [number, number, number]) => {
    setViewMeta({ cameraPosition: position, cameraRotation: rotation });
  }, []);

  const handleCapture = async () => {
    if (!viewerContainerRef.current) return;
    
    setCapturing(true);
    try {
      const dataUrl = await toPng(viewerContainerRef.current, {
        quality: 0.95,
        pixelRatio: 2,
      });
      
      // Convert to blob and upload
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const url = await uploadSnapshot(blob);
      
      if (url) {
        setSnapshotUrl(url);
        setAnnotations([]);
        setActiveTab('annotate');
        
        // Update asset preview_images
        if (currentAsset) {
          await updateAsset(currentAsset.id, {
            preview_images: [...currentAsset.preview_images, url],
          });
        }
        
        toast.success('截图完成，请添加标注');
      }
    } catch (error) {
      console.error('Capture failed:', error);
      toast.error('截图失败');
    } finally {
      setCapturing(false);
    }
  };

  const handleCaptureImage = async () => {
    if (!imageRef.current || !imageUrl) return;
    
    setCapturing(true);
    try {
      // For images, we can just use the current image URL as snapshot
      setSnapshotUrl(imageUrl);
      setAnnotations([]);
      setActiveTab('annotate');
      toast.success('准备标注');
    } catch (error) {
      console.error('Capture failed:', error);
      toast.error('操作失败');
    } finally {
      setCapturing(false);
    }
  };

  const handleSaveAnnotation = async () => {
    if (!currentAsset || !snapshotUrl) return;
    
    setSaving(true);
    try {
      await createAnnotation({
        asset_id: currentAsset.id,
        snapshot_url: snapshotUrl,
        annotations_json: annotations,
        view_meta: viewMeta,
        remark: remark || undefined,
      });
      
      setRemark('');
      setActiveTab('history');
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleViewAnnotation = (annotation: ProductAnnotation) => {
    setSnapshotUrl(annotation.snapshot_url);
    setAnnotations(annotation.annotations_json);
    setViewMeta(annotation.view_meta);
    setActiveTab('annotate');
  };

  const renderUploadTab = () => (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ImageIcon className="h-8 w-8" />
        <Box className="h-8 w-8" />
      </div>
      <p className="text-sm text-muted-foreground text-center">
        支持上传图片(PNG/JPG)或3D模型(GLB/GLTF/STL)
      </p>
      <Label className="cursor-pointer">
        <Input
          type="file"
          className="hidden"
          accept=".png,.jpg,.jpeg,.webp,.glb,.gltf,.stl"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        <Button asChild disabled={uploading}>
          <span>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            选择文件
          </span>
        </Button>
      </Label>
    </div>
  );

  const renderViewTab = () => {
    if (!currentAsset) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          请先上传文件
        </div>
      );
    }

    const is3D = ['glb', 'gltf', 'stl'].includes(currentAsset.source_type);

    if (is3D && currentAsset.model_file_url) {
      return (
        <div className="space-y-3">
          <div 
            ref={viewerContainerRef}
            className="w-full h-64 rounded-lg overflow-hidden border"
          >
            <Model3DViewer
              modelUrl={currentAsset.model_file_url}
              sourceType={currentAsset.source_type as 'glb' | 'gltf' | 'stl'}
              onCameraChange={handleCameraChange}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCapture} disabled={capturing} className="flex-1">
              {capturing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              截图并标注
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            拖拽旋转 · 滚轮缩放 · 右键平移
          </p>
        </div>
      );
    }

    if (imageUrl) {
      return (
        <div className="space-y-3">
          <div 
            ref={imageRef}
            className="w-full h-64 rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center"
          >
            <img 
              src={imageUrl} 
              alt="Product" 
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <Button onClick={handleCaptureImage} disabled={capturing} className="w-full">
            {capturing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            开始标注
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        没有可显示的内容
      </div>
    );
  };

  const renderAnnotateTab = () => {
    if (!snapshotUrl) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          请先截图或选择图片
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="relative w-full h-64 rounded-lg overflow-hidden border">
          <img 
            src={snapshotUrl} 
            alt="Snapshot" 
            className="w-full h-full object-contain bg-muted/30"
          />
          <AnnotationLayer
            annotations={annotations}
            onChange={setAnnotations}
            width={400}
            height={256}
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">备注</Label>
          <Input
            placeholder="标注说明（可选）"
            value={remark}
            onChange={e => setRemark(e.target.value)}
            className="h-8"
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleSaveAnnotation} 
            disabled={saving || annotations.length === 0}
            className="flex-1"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存标注
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setAnnotations([])}
            disabled={annotations.length === 0}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1">
          {annotations.map((ann, i) => (
            <Badge key={ann.id} variant="secondary" className="text-xs">
              {ann.name || `标注${i + 1}`}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const renderHistoryTab = () => (
    <ScrollArea className="h-64">
      {assetAnnotations.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          暂无标注记录
        </div>
      ) : (
        <div className="space-y-2 pr-2">
          {assetAnnotations.map(ann => (
            <Card key={ann.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={ann.snapshot_url} 
                    alt="Snapshot" 
                    className="w-16 h-12 object-cover rounded border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        v{ann.version}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {ann.annotations_json.length} 个标注
                      </span>
                    </div>
                    {ann.remark && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {ann.remark}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(ann.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleViewAnnotation(ann)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => deleteAnnotation(ann.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Box className="h-4 w-4" />
          产品3D与特征标注
          {scope === 'workstation' ? (
            <Badge variant="outline" className="text-xs">工位级</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">模块级</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-4 mb-3">
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="h-3 w-3 mr-1" />
              上传
            </TabsTrigger>
            <TabsTrigger value="view" className="text-xs" disabled={!currentAsset}>
              <Eye className="h-3 w-3 mr-1" />
              查看
            </TabsTrigger>
            <TabsTrigger value="annotate" className="text-xs" disabled={!snapshotUrl}>
              <Camera className="h-3 w-3 mr-1" />
              标注
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs" disabled={!currentAsset}>
              <History className="h-3 w-3 mr-1" />
              记录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-0">
            {renderUploadTab()}
          </TabsContent>
          <TabsContent value="view" className="mt-0">
            {renderViewTab()}
          </TabsContent>
          <TabsContent value="annotate" className="mt-0">
            {renderAnnotateTab()}
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            {renderHistoryTab()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
