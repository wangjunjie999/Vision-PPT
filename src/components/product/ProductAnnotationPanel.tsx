import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/useData';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Star,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Box,
  Eye,
  Save,
  Loader2,
  Plus,
  Info,
  X,
  Maximize2,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from 'lucide-react';
import { AnnotationCanvas, Annotation } from './AnnotationCanvas';
import { useAppStore } from '@/store/useAppStore';
import { toLocalProxyUrl } from '@/utils/storageUrl';
import { uploadStorageFile } from '@/utils/storageUpload';
import { createSafeStorageObjectName } from '@/utils/storageFileNames';
import { DragDropUpload } from '@/components/upload/DragDropUpload';
import { UploadProgress, useUploadProgress } from '@/components/upload/UploadProgress';
import {
  buildProductMediaItems,
  formatProductMediaCaption,
  getProductMediaDisplayUrl,
  getProductPreviewImageUrls,
  resolveProductImagesPerPage,
  sortProductMedia,
  type ProductMediaRecord,
} from '@/utils/productAssetMedia';
import {
  createProductMedia,
  deleteProductMedia,
  loadProductMedia,
  reorderProductMedia,
  syncPreviewImagesFromMedia,
} from '@/services/productMediaService';
import { reorderProductAnnotations } from '@/services/productAnnotationService';

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
  document_images_per_page?: 1 | 2 | number | null;
  is_primary?: boolean;
  sort_order?: number;
  parent_product_id?: string | null;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  pos_x?: number | null;
  pos_y?: number | null;
  pos_z?: number | null;
}

interface AnnotationRecord {
  id: string;
  asset_id: string;
  media_id: string | null;
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
  updated_at: string;
  is_ppt_default: boolean;
  sort_order?: number | null;
}

interface ProductAnnotationStats {
  mediaCount: number;
  annotatedCount: number;
  pendingCount: number;
}

interface ProductAnnotationPanelProps {
  workstationId: string;
}

export function ProductAnnotationPanel({ workstationId }: ProductAnnotationPanelProps) {
  const { user } = useAuth();
  const {
    productAssets: canonicalProductAssets,
    addProductAsset,
    updateProductAsset,
    deleteProductAsset,
    setPrimaryProductAsset,
    reorderProductAssets,
  } = useData();
  const selectedProductId = useAppStore(state => state.selectedProductAssetId);
  const setSelectedProductId = useAppStore(state => state.selectProductAsset);
  const annotationMode = useAppStore(state => state.annotationMode);
  const products = useMemo(() => canonicalProductAssets
    .filter(row => row.scope_type === 'workstation' && row.workstation_id === workstationId)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
    .map(row => ({
      ...row,
      preview_images: getProductPreviewImageUrls(row.preview_images),
      product_models: Array.isArray(row.product_models)
        ? row.product_models as unknown as ProductModelItem[]
        : [],
      detection_requirements: Array.isArray(row.detection_requirements)
        ? row.detection_requirements as unknown as DetectionRequirementItem[]
        : [],
    })) as ProductAsset[], [canonicalProductAssets, workstationId]);
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
  const [mediaItems, setMediaItems] = useState<ProductMediaRecord[]>([]);
  const [productAnnotationStats, setProductAnnotationStats] = useState<Map<string, ProductAnnotationStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragMediaId, setDragMediaId] = useState<string | null>(null);
  const [dragOverMediaId, setDragOverMediaId] = useState<string | null>(null);
  const [dragAnnotationId, setDragAnnotationId] = useState<string | null>(null);
  const [dragOverAnnotationId, setDragOverAnnotationId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const uploadProgress = useUploadProgress();
  // Keep original File refs for retry, keyed by progress item id.
  const retryRegistryRef = useRef<Map<string, { file: File; targetProductId: string }>>(new Map());
  const [updatingPaginationMode, setUpdatingPaginationMode] = useState(false);

  // Product info state
  const [detectionMethod, setDetectionMethod] = useState('');
  const [productModels, setProductModels] = useState<ProductModelItem[]>([]);
  const [detectionRequirements, setDetectionRequirements] = useState<DetectionRequirementItem[]>([]);
  const [savingInfo, setSavingInfo] = useState(false);

  // Product management dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productDialogMode, setProductDialogMode] = useState<'create' | 'edit'>('create');
  const [productForm, setProductForm] = useState<{
    name: string;
    code: string;
    spec: string;
    length: string;
    width: string;
    height: string;
  }>({
    name: '',
    code: '',
    spec: '',
    length: '',
    width: '',
    height: '',
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  const asset: ProductAsset | null =
    products.find(p => p.id === selectedProductId) || products[0] || null;

  const productAnnotationItems = useMemo(() => {
    if (!asset) return [];
    return buildProductMediaItems(asset.id, mediaItems, annotations, asset.preview_images);
  }, [asset, mediaItems, annotations]);

  const sortedAnnotationRecords = useMemo(() => productAnnotationItems
    .filter(item => item.annotation)
    .map(item => item.annotation!)
    .sort((left, right) =>
      Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)
      || Number(right.version ?? 0) - Number(left.version ?? 0)
      || Date.parse(right.created_at || '') - Date.parse(left.created_at || '')
      || String(right.id).localeCompare(String(left.id))
    ), [productAnnotationItems]);

  const pendingMediaItems = useMemo(() => productAnnotationItems
    .filter(item => !item.annotation)
    .map(item => item.media), [productAnnotationItems]);

  const mediaById = useMemo(() => new Map(mediaItems.map(item => [item.id, item])), [mediaItems]);

  const refreshProductAnnotationStats = useCallback(async () => {
    const productIds = products.map(product => product.id);
    if (productIds.length === 0) {
      setProductAnnotationStats(new Map());
      return;
    }

    const [mediaResult, annotationResult] = await Promise.all([
      supabase
        .from('product_media')
        .select('id, asset_id')
        .in('asset_id', productIds),
      supabase
        .from('product_annotations')
        .select('asset_id, media_id')
        .in('asset_id', productIds),
    ]);
    if (mediaResult.error || annotationResult.error) {
      console.error('Failed to load product media stats:', mediaResult.error || annotationResult.error);
      return;
    }

    const next = new Map<string, ProductAnnotationStats>();
    for (const product of products) {
      const productMedia = (mediaResult.data || []).filter(item => item.asset_id === product.id);
      const mediaIds = new Set(productMedia.map(item => item.id));
      next.set(product.id, {
        mediaCount: productMedia.length,
        annotatedCount: (annotationResult.data || []).filter(item => item.asset_id === product.id).length,
        pendingCount: productMedia.filter(item => !((annotationResult.data || []).some(annotation =>
          annotation.asset_id === product.id && annotation.media_id === item.id
        ))).length,
      });
    }
    setProductAnnotationStats(next);
  }, [products]);

  useEffect(() => {
    void refreshProductAnnotationStats();
  }, [refreshProductAnnotationStats]);

  // Sync product info from asset
  useEffect(() => {
    if (asset) {
      setDetectionMethod(asset.detection_method || '');
      setProductModels(asset.product_models || []);
      setDetectionRequirements(asset.detection_requirements || []);
    } else {
      setDetectionMethod('');
      setProductModels([]);
      setDetectionRequirements([]);
    }
  }, [asset]);

  // Product rows come from DataContext; this helper only refreshes product selection
  // and the annotation records belonging to that shared selection.
  const loadData = useCallback(async (preferredProductId?: string | null) => {
    if (!workstationId || !user) return;
    setLoading(true);
    try {
      // Choose next selected product
      const nextSelected =
        preferredProductId ||
        (selectedProductId && products.find(p => p.id === selectedProductId)?.id) ||
        products[0]?.id ||
        null;
      setSelectedProductId(nextSelected);

      if (nextSelected) {
        const [productMedia, annotationResult] = await Promise.all([
          loadProductMedia([nextSelected]),
          supabase
            .from('product_annotations')
            .select('*')
            .eq('asset_id', nextSelected)
            .order('updated_at', { ascending: false }),
        ]);
        if (annotationResult.error) throw annotationResult.error;

        const records = (annotationResult.data || []).map(a => ({
          ...a,
          annotations_json: a.annotations_json as unknown as Annotation[],
          view_meta: a.view_meta as AnnotationRecord['view_meta'],
        }));
        setMediaItems(productMedia);
        setAnnotations(records);
      } else {
        setMediaItems([]);
        setAnnotations([]);
      }
    } catch (error) {
      console.error('Failed to load product data:', error);
      toast.error('加载产品数据失败');
    } finally {
      setLoading(false);
    }
  }, [products, selectedProductId, setSelectedProductId, user, workstationId]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workstationId, user]);

  useEffect(() => {
    if (selectedProductId && products.some(product => product.id === selectedProductId)) return;
    setSelectedProductId(products[0]?.id || null);
  }, [products, selectedProductId, setSelectedProductId]);

  useEffect(() => {
    if (!annotationMode && selectedProductId) {
      void loadData(selectedProductId);
      void refreshProductAnnotationStats();
    }
  }, [annotationMode, selectedProductId, loadData, refreshProductAnnotationStats]);

  // When user switches selected product, reload its annotations
  useEffect(() => {
    if (!selectedProductId) {
      setMediaItems([]);
      setAnnotations([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [productMedia, annotationResult] = await Promise.all([
        loadProductMedia([selectedProductId]),
        supabase
          .from('product_annotations')
          .select('*')
          .eq('asset_id', selectedProductId)
          .order('updated_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (annotationResult.error) {
        console.error(annotationResult.error);
        return;
      }
      const records = (annotationResult.data || []).map(a => ({
        ...a,
        annotations_json: a.annotations_json as unknown as Annotation[],
        view_meta: a.view_meta as AnnotationRecord['view_meta'],
      }));
      setMediaItems(productMedia);
      setAnnotations(records);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProductId]);

  // ---------- Product management ----------
  const openCreateProduct = () => {
    setProductDialogMode('create');
    setProductForm({ name: `产品 ${products.length + 1}`, code: '', spec: '', length: '', width: '', height: '' });
    setProductDialogOpen(true);
  };
  const openEditProduct = () => {
    if (!asset) return;
    setProductDialogMode('edit');
    setProductForm({
      name: asset.product_name || '',
      code: asset.product_code || '',
      spec: asset.product_spec || '',
      length: asset.length_mm?.toString() || '',
      width: asset.width_mm?.toString() || '',
      height: asset.height_mm?.toString() || '',
    });
    setProductDialogOpen(true);
  };
  const submitProductDialog = async () => {
    if (!user) return;
    const name = productForm.name.trim();
    if (!name) {
      toast.error('产品名称必填');
      return;
    }
    const dimensions = {
      length_mm: productForm.length.trim() ? Number(productForm.length) : null,
      width_mm: productForm.width.trim() ? Number(productForm.width) : null,
      height_mm: productForm.height.trim() ? Number(productForm.height) : null,
    };
    if (Object.values(dimensions).some(value => value != null && (!Number.isFinite(value) || value <= 0))) {
      toast.error('产品尺寸必须大于 0');
      return;
    }
    setSavingProduct(true);
    try {
      if (productDialogMode === 'create') {
        const nextOrder =
          products.length === 0
            ? 0
            : Math.max(...products.map(p => p.sort_order ?? 0)) + 1;
        const makePrimary = products.length === 0;
        const data = await addProductAsset({
            workstation_id: workstationId,
            scope_type: 'workstation',
            source_type: 'image',
            product_name: name,
            product_code: productForm.code.trim() || null,
            product_spec: productForm.spec.trim() || null,
            ...dimensions,
            pos_x: 0,
            pos_y: products.length === 0 ? 0 : products.length * 100,
            pos_z: 0,
            sort_order: nextOrder,
            is_primary: makePrimary,
            document_images_per_page: 1,
          });
        setProductDialogOpen(false);
        await loadData(data.id);
        toast.success('产品已创建');
      } else if (asset) {
        await updateProductAsset(asset.id, {
            product_name: name,
            product_code: productForm.code.trim() || null,
            product_spec: productForm.spec.trim() || null,
            ...dimensions,
          });
        setProductDialogOpen(false);
        await loadData(asset.id);
        toast.success('产品已更新');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingProduct(false);
    }
  };

  const setAsPrimary = async () => {
    if (!asset) return;
    try {
      await setPrimaryProductAsset(workstationId, asset.id);
      await loadData(asset.id);
      toast.success('已设为主产品');
    } catch (e) {
      console.error(e);
      toast.error('设置主产品失败');
    }
  };

  const moveProduct = async (direction: 'up' | 'down') => {
    if (!asset) return;
    const idx = products.findIndex(p => p.id === asset.id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= products.length) return;
    try {
      const reordered = products.map(product => product.id);
      [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
      await reorderProductAssets(workstationId, reordered);
      await loadData(asset.id);
    } catch (e) {
      console.error(e);
      toast.error('排序失败');
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirmId) return;
    setDeletingProduct(true);
    try {
      const remaining = products.filter(p => p.id !== deleteConfirmId);
      await deleteProductAsset(deleteConfirmId);
      setDeleteConfirmId(null);
      await loadData(remaining[0]?.id || null);
      toast.success('产品已删除');
    } catch (e) {
      console.error(e);
      toast.error('删除失败');
    } finally {
      setDeletingProduct(false);
    }
  };

  // Images are independent records; model upload remains one file per product.
  const handleFilesUpload = async (files: File[]) => {
    if (files.length === 0 || !user) return;
    const modelFiles = files.filter(file => /\.(glb|gltf)$/i.test(file.name));
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file.name));
    if (modelFiles.length > 1 || (modelFiles.length > 0 && files.length > 1)) {
      toast.error('3D 模型需单独上传；产品图片可一次选择多张');
      return;
    }
    if (modelFiles.length + imageFiles.length !== files.length) {
      toast.error('不支持的文件格式，请上传 GLB/GLTF 或 JPG/PNG/WEBP');
      return;
    }
    setUploading(true);
    try {
      // Ensure a product row exists to attach media to.
      // For images, respect the user's explicit target product selection.
      // Always upload to the currently selected product (top selector is the single source of truth).
      // If no product exists yet, create one automatically below.
      let targetProductId: string | null = asset?.id ?? null;
      if (!targetProductId) {
        const created = await addProductAsset({
          workstation_id: workstationId,
          scope_type: 'workstation',
          source_type: modelFiles.length > 0 ? 'model' : 'image',
          product_name: `产品 ${products.length + 1}`,
          sort_order: 0,
          is_primary: products.length === 0,
          document_images_per_page: 1,
        });
        targetProductId = created.id;
      }

      if (modelFiles.length === 1) {
        const file = modelFiles[0];
        let fileUrl: string;
        if (/\.glb$/i.test(file.name)) {
          const { uploadGLBFile } = await import('@/utils/glbUpload');
          const url = await uploadGLBFile(file, 'workstation-product');
          if (!url) return;
          fileUrl = url;
        } else {
          const path = `${workstationId}/${targetProductId}/${createSafeStorageObjectName(file.name, {
            fallbackBase: 'model',
            fallbackExtension: 'gltf',
          })}`;
          fileUrl = (await uploadStorageFile('product-models', path, file, {
            contentType: file.type || undefined,
          })).publicUrl;
        }
        await updateProductAsset(targetProductId, {
          model_file_url: fileUrl,
          source_type: 'model',
          updated_at: new Date().toISOString(),
        }, { silent: true });
        toast.success('3D 模型上传成功');
        await loadData(targetProductId);
        await refreshProductAnnotationStats();
        useAppStore.getState().enterViewerMode(fileUrl, [], targetProductId, 'workstation', 'model');
        toast.info('已进入 3D 查看模式，可截图并标注');
        return;
      } else {
        await uploadImageBatch(imageFiles, targetProductId);
      }
      await loadData(targetProductId);
      await refreshProductAnnotationStats();
    } catch (error) {
      console.error('Upload failed:', error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg ? `上传失败: ${msg}` : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  // Parallel upload of a batch of images to one target product.
  // Tracks per-file progress and returns after all settle (successes + failures).
  const uploadImageBatch = async (imageFiles: File[], targetProductId: string) => {
    if (imageFiles.length === 0 || !user) return;
    const currentMedia = await loadProductMedia([targetProductId]);
    const nextOrder = currentMedia.length === 0
      ? 0
      : Math.max(...currentMedia.map(item => item.sort_order)) + 1;

    const uploads = imageFiles.map((file, index) => {
      const id = uploadProgress.addItem(file);
      retryRegistryRef.current.set(id, { file, targetProductId });
      return { id, file, sortOrder: nextOrder + index };
    });

    // Fire all uploads in parallel.
    const results = await Promise.allSettled(uploads.map(async ({ id, file, sortOrder }) => {
      try {
        uploadProgress.updateProgress(id, 40);
        const path = `${workstationId}/${targetProductId}/${createSafeStorageObjectName(file.name, {
          fallbackBase: 'product-image',
          fallbackExtension: 'png',
        })}`;
        const { publicUrl } = await uploadStorageFile('product-models', path, file, {
          contentType: file.type || undefined,
        });
        uploadProgress.updateProgress(id, 90);
        return {
          id,
          row: {
            user_id: user.id,
            asset_id: targetProductId,
            workstation_id: workstationId,
            original_url: publicUrl,
            file_name: file.name,
            sort_order: sortOrder,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        uploadProgress.setError(id, msg || '上传失败');
        throw err;
      }
    }));

    const uploadedRows = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));

    if (uploadedRows.length > 0) {
      try {
        await createProductMedia(uploadedRows.map(r => r.row));
        uploadedRows.forEach(r => {
          uploadProgress.setSuccess(r.id);
          retryRegistryRef.current.delete(r.id);
        });
        await updateProductAsset(targetProductId, {
          source_type: asset?.model_file_url ? 'model' : 'image',
          updated_at: new Date().toISOString(),
        }, { silent: true });
        await syncPreviewImagesFromMedia(targetProductId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        uploadedRows.forEach(r => uploadProgress.setError(r.id, `入库失败: ${msg}`));
      }
    }

    const failed = results.length - uploadedRows.length;
    if (uploadedRows.length > 0 && failed === 0) {
      toast.success(`已上传 ${uploadedRows.length} 张产品图片`);
    } else if (uploadedRows.length > 0 && failed > 0) {
      toast.warning(`已上传 ${uploadedRows.length} 张，${failed} 张失败，可在进度面板重试`);
    } else if (failed > 0) {
      toast.error(`全部 ${failed} 张图片上传失败，可在进度面板重试`);
    }
  };

  const handleRetryUpload = async (id: string) => {
    const entry = retryRegistryRef.current.get(id);
    if (!entry) return;
    uploadProgress.removeItem(id);
    retryRegistryRef.current.delete(id);
    await uploadImageBatch([entry.file], entry.targetProductId);
    await loadData(entry.targetProductId);
    await refreshProductAnnotationStats();
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!asset) return;
    try {
      await deleteProductMedia(mediaId);
      await syncPreviewImagesFromMedia(asset.id);
      await loadData(asset.id);
      await refreshProductAnnotationStats();
      toast.success('产品图片及其标注已删除');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('删除失败');
    }
  };

  const handleMoveMedia = async (mediaId: string, direction: 'up' | 'down') => {
    if (!asset) return;
    const ordered = sortProductMedia(mediaItems, asset.id);
    const index = ordered.findIndex(item => item.id === mediaId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    try {
      await reorderProductMedia(asset.id, ordered.map(item => item.id));
      await syncPreviewImagesFromMedia(asset.id);
      await loadData(asset.id);
    } catch (error) {
      console.error(error);
      toast.error('图片排序失败');
    }
  };

  const handleReorderMediaByDrag = async (sourceId: string, targetId: string) => {
    if (!asset || sourceId === targetId) return;
    const ordered = sortProductMedia(mediaItems, asset.id);
    const fromIndex = ordered.findIndex(item => item.id === sourceId);
    const toIndex = ordered.findIndex(item => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...ordered];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setReordering(true);
    try {
      await reorderProductMedia(asset.id, next.map(item => item.id));
      await syncPreviewImagesFromMedia(asset.id);
      await loadData(asset.id);
    } catch (error) {
      console.error(error);
      toast.error('图片排序失败');
    } finally {
      setReordering(false);
    }
  };

  const handleMoveAnnotation = async (annotationId: string, direction: 'up' | 'down') => {
    if (!asset) return;
    const ordered = sortedAnnotationRecords.map(record => record.id);
    const index = ordered.findIndex(id => id === annotationId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    try {
      await reorderProductAnnotations(asset.id, ordered);
      await loadData(asset.id);
    } catch (error) {
      console.error(error);
      toast.error('标注图片排序失败');
    }
  };

  const handleReorderAnnotationByDrag = async (sourceId: string, targetId: string) => {
    if (!asset || sourceId === targetId) return;
    const ordered = sortedAnnotationRecords.map(record => record.id);
    const fromIndex = ordered.findIndex(id => id === sourceId);
    const toIndex = ordered.findIndex(id => id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...ordered];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setReordering(true);
    try {
      await reorderProductAnnotations(asset.id, next);
      await loadData(asset.id);
    } catch (error) {
      console.error(error);
      toast.error('标注图片排序失败');
    } finally {
      setReordering(false);
    }
  };

  const handlePaginationModeChange = async (value: string) => {
    if (!asset) return;
    const nextMode: 1 | 2 = value === '2' ? 2 : 1;
    if (resolveProductImagesPerPage(asset) === nextMode) return;
    setUpdatingPaginationMode(true);
    try {
      await updateProductAsset(asset.id, {
        document_images_per_page: nextMode,
        updated_at: new Date().toISOString(),
      }, { silent: true });
      toast.success(nextMode === 1 ? '已切换为单页单图' : '已切换为单页双图');
    } catch (error) {
      console.error(error);
      toast.error('文档分页方式保存失败');
    } finally {
      setUpdatingPaginationMode(false);
    }
  };

  const handleAnnotateMedia = (media: ProductMediaRecord) => {
    if (!asset) return;
    const annotation = annotations.find(record => record.media_id === media.id);
    useAppStore.getState().enterAnnotationMode(
      media.original_url,
      asset.id,
      'workstation',
      workstationId,
      {
        mediaId: media.id,
        annotations: annotation?.annotations_json || [],
        remark: annotation?.remark || null,
        recordId: annotation?.id,
      }
    );
  };

  const handleEditAnnotation = (annotation: AnnotationRecord) => {
    if (!asset) return;
    const sourceMedia = annotation.media_id ? mediaById.get(annotation.media_id) : null;
    useAppStore.getState().enterAnnotationMode(
      sourceMedia?.original_url || annotation.snapshot_url,
      asset.id,
      'workstation',
      workstationId,
      {
        mediaId: annotation.media_id || undefined,
        annotations: annotation.annotations_json || [],
        remark: annotation.remark || null,
        recordId: annotation.id,
      }
    );
  };

  const handleViewAnnotation = (annotation: AnnotationRecord) => {
    if (!asset) return;
    useAppStore.getState().enterViewerMode(null, [annotation.snapshot_url], asset.id, 'workstation', 'image');
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    if (!asset) return;
    try {
      const { error } = await supabase
        .from('product_annotations')
        .delete()
        .eq('id', annotationId)
        .eq('asset_id', asset.id);
      if (error) throw error;
      await loadData(asset.id);
      await refreshProductAnnotationStats();
      toast.success('标注图片已删除');
    } catch (error) {
      console.error('Delete annotation failed:', error);
      toast.error('删除失败');
    }
  };

  const handleViewMedia = (media: ProductMediaRecord) => {
    if (!asset) return;
    const annotation = annotations.find(record => record.media_id === media.id);
    const displayUrl = getProductMediaDisplayUrl({ media, annotation });
    useAppStore.getState().enterViewerMode(null, [displayUrl], asset.id, 'workstation', 'image');
  };

  if (loading) {
    return (
      <Card className="glass-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            产品图片与特征标注
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
          产品图片与特征标注
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product selector bar */}
        <div className="space-y-2 rounded-md border border-border/60 bg-secondary/30 p-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">产品</Label>
            <Select
              value={selectedProductId ?? ''}
              onValueChange={(v) => setSelectedProductId(v)}
              disabled={products.length === 0}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder={products.length === 0 ? '暂无产品' : '选择产品'} />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => {
                  const stats = productAnnotationStats.get(p.id);
                  return (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                        <span className="flex items-center gap-1">
                          {p.is_primary && <Star className="h-3 w-3 text-primary" />}
                          <span className="truncate">{p.product_name || '未命名产品'}</span>
                          {p.product_code ? (
                            <span className="text-muted-foreground">· {p.product_code}</span>
                          ) : null}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          图片 {stats?.mediaCount ?? 0} · 已标注 {stats?.annotatedCount ?? 0}
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={openCreateProduct}>
              <Plus className="h-3 w-3 mr-1" /> 新增
            </Button>
          </div>
          {asset && (
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="outline" className="text-[10px] h-5">
                图片 {productAnnotationStats.get(asset.id)?.mediaCount ?? mediaItems.length}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-5">
                已标注 {productAnnotationStats.get(asset.id)?.annotatedCount ?? annotations.filter(item => item.media_id).length}
              </Badge>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={openEditProduct}>
                <Edit3 className="h-3 w-3 mr-1" /> 编辑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={setAsPrimary}
                disabled={asset.is_primary}
              >
                <Star className="h-3 w-3 mr-1" /> 设为主产品
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => moveProduct('up')}
                disabled={products.findIndex(p => p.id === asset.id) <= 0}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => moveProduct('down')}
                disabled={products.findIndex(p => p.id === asset.id) >= products.length - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirmId(asset.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> 删除
              </Button>
              {asset.product_spec && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  规格 {asset.product_spec}
                </Badge>
              )}
            </div>
          )}
        </div>

        <section className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label className="text-xs">产品标注图片</Label>
                <p className="text-[10px] text-muted-foreground">图片可直接标注；GLB/GLTF 上传后进入画布截图，保存后进入同一个标注图片列表。</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-xs font-medium">文档分页方式</Label>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    仅作用于当前工位的当前产品；切换不会修改图片、排序或标注。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(resolveProductImagesPerPage(asset))}
                    onValueChange={handlePaginationModeChange}
                    disabled={!asset || updatingPaginationMode}
                  >
                    <SelectTrigger className="h-8 w-[176px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">单页单图（大图）</SelectItem>
                      <SelectItem value="2">单页双图（紧凑）</SelectItem>
                    </SelectContent>
                  </Select>
                  {updatingPaginationMode && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                当前 {sortedAnnotationRecords.length} 张已保存标注图片，预计生成{' '}
                {sortedAnnotationRecords.length === 0
                  ? 0
                  : Math.ceil(sortedAnnotationRecords.length / resolveProductImagesPerPage(asset))}{' '}
                页
              </div>
            </div>
            <DragDropUpload
                accept=".jpg,.jpeg,.png,.webp,.glb,.gltf"
                multiple
                maxFiles={null}
                maxSize={50}
                showPreview={false}
                uploading={uploading}
                label="拖拽或选择产品标注素材"
                hint="支持 JPG / PNG / WEBP / GLB / GLTF；3D 文件上传后在画布截图标注"
                onUpload={handleFilesUpload}
              />
              {products.length > 0 && asset && (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    将上传到当前产品：<span className="text-foreground font-medium">{asset.product_name || '未命名产品'}</span>
                    {asset.product_code ? ` · ${asset.product_code}` : ''}
                    <span className="ml-1">（在顶部切换产品）</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={openCreateProduct}
                    disabled={uploading}
                  >
                    <Plus className="mr-1 h-3 w-3" /> 新建产品
                  </Button>
                </div>
              )}
              {uploadProgress.items.length > 0 && (
                <div className="space-y-2 rounded-md border bg-muted/10 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">上传进度</span>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={uploadProgress.clearCompleted}
                    >
                      清除已完成
                    </button>
                  </div>
                  <UploadProgress
                    items={uploadProgress.items}
                    onRemove={uploadProgress.removeItem}
                    onRetry={handleRetryUpload}
                  />
                </div>
              )}
            </div>

            {asset?.model_file_url ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1.5">
                <span className="text-[10px] text-muted-foreground">当前产品已有 3D 模型，可继续截图生成标注图片。</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => useAppStore.getState().enterViewerMode(
                    asset.model_file_url,
                    [],
                    asset.id,
                    'workstation',
                    'model',
                  )}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Maximize2 className="h-3 w-3" />
                  打开 3D 模型
                </Button>
              </div>
            ) : null}

            {sortedAnnotationRecords.length > 0 || pendingMediaItems.length > 0 ? (
              <ScrollArea className="h-[420px] pr-2">
                <div className="grid grid-cols-1 gap-3">
                  {sortedAnnotationRecords.map((annotation, index, ordered) => {
                    const media = annotation.media_id ? mediaById.get(annotation.media_id) : null;
                    return (
                      <div
                        key={annotation.id}
                        draggable={!reordering}
                        onDragStart={(e) => {
                          setDragAnnotationId(annotation.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', annotation.id);
                        }}
                        onDragOver={(e) => {
                          if (!dragAnnotationId || dragAnnotationId === annotation.id) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverAnnotationId !== annotation.id) setDragOverAnnotationId(annotation.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverAnnotationId === annotation.id) setDragOverAnnotationId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceId = dragAnnotationId || e.dataTransfer.getData('text/plain');
                          setDragAnnotationId(null);
                          setDragOverAnnotationId(null);
                          if (sourceId && sourceId !== annotation.id) {
                            void handleReorderAnnotationByDrag(sourceId, annotation.id);
                          }
                        }}
                        onDragEnd={() => {
                          setDragAnnotationId(null);
                          setDragOverAnnotationId(null);
                        }}
                        className={`overflow-hidden rounded-xl border bg-card shadow-sm transition ${
                          dragAnnotationId === annotation.id ? 'opacity-50' : ''
                        } ${dragOverAnnotationId === annotation.id ? 'border-primary ring-2 ring-primary/30' : ''}`}
                      >
                        <div className="grid grid-cols-[24px_112px_1fr] gap-3 p-3">
                          <div className="flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing" title="拖拽排序">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <button
                            type="button"
                            className="group relative h-20 overflow-hidden rounded-lg border bg-muted"
                            onClick={() => handleViewAnnotation(annotation)}
                          >
                            <img
                              src={toLocalProxyUrl(annotation.snapshot_url)}
                              alt={annotation.remark || `产品标注图片 ${index + 1}`}
                              className="h-full w-full object-contain transition-transform group-hover:scale-105"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-card/0 text-foreground opacity-0 transition group-hover:bg-card/70 group-hover:opacity-100">
                              <Eye className="h-5 w-5" />
                            </span>
                          </button>
                          <div className="min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">{index + 1}. {annotation.remark || media?.file_name || `标注图片 V${annotation.version}`}</p>
                                <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[10px] text-muted-foreground">
                                  {formatProductMediaCaption({
                                    media: media || {
                                      id: annotation.id,
                                      asset_id: annotation.asset_id,
                                      original_url: annotation.snapshot_url,
                                      file_name: annotation.remark || `标注图片 V${annotation.version}`,
                                      sort_order: annotation.sort_order ?? index,
                                    },
                                    annotation,
                                  })}
                                </p>
                              </div>
                              <Badge variant="default" className="shrink-0 text-[10px]">已标注</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleEditAnnotation(annotation)}>
                                <Edit3 className="mr-1 h-3 w-3" /> 编辑标注
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleViewAnnotation(annotation)}>
                                <Maximize2 className="mr-1 h-3 w-3" /> 查看
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => handleMoveAnnotation(annotation.id, 'up')}>
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === ordered.length - 1} onClick={() => handleMoveAnnotation(annotation.id, 'down')}>
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteAnnotation(annotation.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {pendingMediaItems.map((media, index) => {
                    const ordered = pendingMediaItems;
                    return (
                      <div
                        key={media.id}
                        draggable={!reordering}
                        onDragStart={(e) => {
                          setDragMediaId(media.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', media.id);
                        }}
                        onDragOver={(e) => {
                          if (!dragMediaId || dragMediaId === media.id) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverMediaId !== media.id) setDragOverMediaId(media.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverMediaId === media.id) setDragOverMediaId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceId = dragMediaId || e.dataTransfer.getData('text/plain');
                          setDragMediaId(null);
                          setDragOverMediaId(null);
                          if (sourceId && sourceId !== media.id) void handleReorderMediaByDrag(sourceId, media.id);
                        }}
                        onDragEnd={() => {
                          setDragMediaId(null);
                          setDragOverMediaId(null);
                        }}
                        className={`overflow-hidden rounded-xl border bg-card shadow-sm transition ${
                          dragMediaId === media.id ? 'opacity-50' : ''
                        } ${dragOverMediaId === media.id ? 'border-primary ring-2 ring-primary/30' : ''}`}
                      >
                        <div className="grid grid-cols-[24px_112px_1fr] gap-3 p-3">
                          <div className="flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing" title="拖拽排序">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <button type="button" className="group relative h-20 overflow-hidden rounded-lg border bg-muted" onClick={() => handleViewMedia(media)}>
                            <img src={toLocalProxyUrl(media.original_url)} alt={media.file_name || `待标注图片 ${index + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          </button>
                          <div className="min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">待标注 {index + 1}. {media.file_name || '产品图片'}</p>
                                <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">进入标注并保存后，会成为产品标注图片。</p>
                              </div>
                              <Badge variant="outline" className="shrink-0 text-[10px]">待标注</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleAnnotateMedia(media)}>
                                <Edit3 className="mr-1 h-3 w-3" /> 进入标注
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleViewMedia(media)}>
                                <Maximize2 className="mr-1 h-3 w-3" /> 查看
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => handleMoveMedia(media.id, 'up')}>
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === ordered.length - 1} onClick={() => handleMoveMedia(media.id, 'down')}>
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteMedia(media.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-muted-foreground">
                <ImageIcon className="mb-2 h-10 w-10 opacity-30" />
                <p className="text-xs">当前产品还没有标注图片</p>
                <p className="text-[10px]">上传图片标注，或上传 3D 模型截图标注</p>
              </div>
            )}
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <Label className="text-xs font-medium">产品信息</Label>
            </div>
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
                    if (!user) return;
                    if (!asset) {
                      toast.error('请先添加产品');
                      return;
                    }

                      setSavingInfo(true);
                      try {
                        await updateProductAsset(asset.id, {
                            detection_method: detectionMethod || null,
                            product_models: productModels as unknown as any,
                            detection_requirements: detectionRequirements as unknown as any,
                            updated_at: new Date().toISOString(),
                          }, { silent: true });
                      await loadData(asset.id);
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
          </div>
        </section>

        {/* Product create / edit dialog */}
        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {productDialogMode === 'create' ? '新增产品' : '编辑产品'}
              </DialogTitle>
              <DialogDescription>
                名称必填；编号、规格可选。一个工位可有多个独立产品，第一个产品自动作为主产品。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">产品名称 *</Label>
                <Input
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="例如：正极电池盖板"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">产品编号</Label>
                <Input
                  value={productForm.code}
                  onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                  placeholder="例如：P-001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">产品规格</Label>
                <Input
                  value={productForm.spec}
                  onChange={(e) => setProductForm({ ...productForm, spec: e.target.value })}
                  placeholder="例如：120 × 80 × 12 mm"
                />
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div>
                  <Label className="text-xs font-medium">产品尺寸 (mm)</Label>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">留空时沿用工位默认尺寸；填写后将同步到机械布局。</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['length', 'L'],
                    ['width', 'W'],
                    ['height', 'H'],
                  ] as const).map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        min="1"
                        value={productForm[field]}
                        onChange={(e) => setProductForm({ ...productForm, [field]: e.target.value })}
                        placeholder="默认"
                        className="font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={submitProductDialog} disabled={savingProduct}>
                {savingProduct && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>删除产品？</DialogTitle>
              <DialogDescription>
                删除后，该产品的 3D 模型 / 图片、标注记录、以及模块层级挂在此产品下的素材都会一并删除，且无法恢复。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteProduct}
                disabled={deletingProduct}
              >
                {deletingProduct && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
