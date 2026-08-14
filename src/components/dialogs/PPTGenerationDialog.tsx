import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useData } from '@/contexts/useData';
import { useAppStore } from '@/store/useAppStore';
import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckCircle2, 
  FileText, 
  Download, 
  AlertCircle, 
  Table, 
  Layout, 
  Box,
  Camera,
  Cpu,
  ChevronRight,
  Loader2,
  FileStack,
  Layers,
  HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generatePPTX } from '@/services/pptxGenerator';
import { getLightingPhotoSlideCount } from '@/services/pptx/workstationSlides';
import { generateFromUserTemplate, downloadGeneratedFile } from '@/services/templateBasedGenerator';
import { generateDOCX } from '@/services/docxGenerator';
import { generatePDF } from '@/services/pdfGenerator';
import { toast } from 'sonner';
import { useCameras, useLenses, useLights, useControllers } from '@/hooks/useHardware';
import { checkPPTReadiness } from '@/services/pptReadiness';
import { ChevronDown, ChevronUp, ExternalLink, ImageOff, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { usePPTTemplates } from '@/hooks/usePPTTemplates';
import { buildReportData, type HardwareLibrary, type ProductAssetInput, type AnnotationInput } from '@/services/reportDataBuilder';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  collectWorkstationImageUrls, 
  checkMultipleImages, 
  formatAccessibilityReport,
  type AccessibilityReport 
} from '@/utils/imageAccessibilityCheck';
import { resetFailedUrlsCache } from '@/services/pptx/imagePreloader';
import { useBatchImageCache } from '@/hooks/useImageCache';
import type { ImageCacheType } from '@/services/imageLocalCache';
import { PPTImagePreviewDialog } from './PPTImagePreviewDialog';
import { safeController, safeHardwareArray } from '@/utils/safeDataAccess';
import { buildModuleVisionChecklistTemplateFields } from '@/utils/moduleVisionChecklist';
import {
  deriveScopedGenerationData,
  deriveScopedMedia,
  getAssetsMissingProductMedia,
  getScopeSelectionPrompt,
  hasRequiredScopeSelection,
  type GenerationScope,
} from './pptGenerationScope';
import {
  buildProductMediaItems,
  normalizeProductPreviewImages,
  paginateProductMedia,
} from '@/utils/productAssetMedia';
import type { ProductMediaRow } from '@/services/productMediaService';

type OutputLanguage = 'zh' | 'en';
type ImageQuality = 'standard' | 'high' | 'ultra';
type GenerationMode = 'draft' | 'final';
type GenerationMethod = 'template' | 'scratch'; // 基于用户上传的PPTX模板 or 从零生成（使用pptxgenjs）
type OutputFormat = 'ppt' | 'word' | 'pdf'; // PPT, Word, or PDF document
type ProductDataStatus = 'idle' | 'loading' | 'ready' | 'error';
type ScopedProductAnnotation = Database['public']['Tables']['product_annotations']['Row'] & {
  scope_type: 'workstation' | 'module';
  workstation_id?: string | null;
  module_id?: string | null;
};

interface GenerationLog {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}

export function PPTGenerationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { 
    selectedProjectId, 
    projects,
    workstations: allWorkstations,
    modules: allModules,
    layouts: allLayouts,
    productAssets: canonicalProductAssets,
    loading: dataLoading,
    getProjectWorkstations,
    getWorkstationModules,
    selectWorkstation,
    selectModule,
  } = useData();
  
  const { pptImageQuality, setPPTImageQuality } = useAppStore();
  const { user } = useAuth();

  // Fetch PPT templates
  const { templates, defaultTemplate, isLoading: templatesLoading } = usePPTTemplates();

  // Fetch hardware data
  const { cameras } = useCameras();
  const { lenses } = useLenses();
  const { lights } = useLights();
  const { controllers } = useControllers();
  
  // Product assets come from DataContext; only media and annotations need loading here.
  const [annotations, setAnnotations] = useState<ScopedProductAnnotation[]>([]);
  const [productMedia, setProductMedia] = useState<ProductMediaRow[]>([]);
  const [productDataStatus, setProductDataStatus] = useState<ProductDataStatus>('idle');
  const [productDataError, setProductDataError] = useState('');
  const [productDataReloadKey, setProductDataReloadKey] = useState(0);
  const productDataRequestRef = useRef(0);

  const [stage, setStage] = useState<'config' | 'generating' | 'complete' | 'error'>('config');
  const [mode, setMode] = useState<GenerationMode>('final');
  const [scope, setScope] = useState<GenerationScope>('full');
  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const selectionInitializationRef = useRef<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [language, setLanguage] = useState<OutputLanguage>('zh');
  const [quality, setQuality] = useState<ImageQuality>(pptImageQuality);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Initialize template selection when templates load
  useEffect(() => {
    if (defaultTemplate && !selectedTemplateId) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [defaultTemplate, selectedTemplateId]);

  // Sync quality to store when changed
  useEffect(() => {
    setPPTImageQuality(quality);
  }, [quality, setPPTImageQuality]);

  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState({
    pageCount: 0,
    layoutImages: 0,
    parameterTables: 0,
    hardwareList: 0,
    fileUrl: '' as string,
  });
  const generatedBlobRef = useRef<Blob | null>(null);
  const [checkPanelOpen, setCheckPanelOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  // 默认使用"从零生成"，因为模板生成需要Edge Function支持
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('scratch');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('ppt'); // 输出格式

  useEffect(() => {
    if (outputFormat !== 'ppt' && generationMethod !== 'scratch') {
      setGenerationMethod('scratch');
    }
  }, [outputFormat, generationMethod]);
  
  // 详细进度追踪状态
  const [currentWorkstation, setCurrentWorkstation] = useState<string>('');
  const [currentSlideInfo, setCurrentSlideInfo] = useState<string>('');
  const [workstationProgress, setWorkstationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  
  // 图片可访问性检查状态
  const [imageCheckResult, setImageCheckResult] = useState<AccessibilityReport | null>(null);
  const [isCheckingImages, setIsCheckingImages] = useState(false);
  
  // 图片本地缓存 hook
  const { 
    isDownloading: isCachingImages, 
    progress: cacheProgress, 
    stats: cacheStats,
    downloadAll: downloadAllToCache,
    findMissingCache,
    refreshStats: refreshCacheStats,
    formatFileSize,
  } = useBatchImageCache();

  // Get current project and workstations
  const project = projects.find(p => p.id === selectedProjectId);
  const projectWorkstations = useMemo(
    () => selectedProjectId ? getProjectWorkstations(selectedProjectId) : [],
    [selectedProjectId, getProjectWorkstations],
  );

  const projectModules = useMemo(
    () => projectWorkstations.flatMap(ws => getWorkstationModules(ws.id)),
    [projectWorkstations, getWorkstationModules],
  );

  const productAssets = useMemo(() => {
    const workstationIds = new Set(projectWorkstations.map(workstation => workstation.id));
    const moduleIds = new Set(projectModules.map(module => module.id));
    return (canonicalProductAssets || [])
      .filter(asset => asset.scope_type === 'module'
        ? Boolean(asset.module_id && moduleIds.has(asset.module_id))
        : Boolean(asset.workstation_id && workstationIds.has(asset.workstation_id)))
      .map(asset => ({
        ...asset,
        scope_type: asset.scope_type as 'workstation' | 'module',
        preview_images: normalizeProductPreviewImages(asset.preview_images),
        product_models: Array.isArray(asset.product_models) ? asset.product_models : [],
        detection_requirements: Array.isArray(asset.detection_requirements) ? asset.detection_requirements : [],
        document_images_per_page: Number(asset.document_images_per_page) === 2 ? 2 : 1,
      }));
  }, [canonicalProductAssets, projectModules, projectWorkstations]);

  const modulesByWorkstation = useMemo(() => {
    const grouped = new Map<string, typeof projectModules>();
    projectWorkstations.forEach(ws => {
      grouped.set(ws.id, projectModules.filter(mod => mod.workstation_id === ws.id));
    });
    return grouped;
  }, [projectWorkstations, projectModules]);

  const scopedSelection = useMemo(() => {
    return deriveScopedGenerationData({
      scope,
      projectWorkstations,
      projectModules,
      layouts: allLayouts,
      selectedWorkstationIds: selectedWorkstations,
      selectedModuleIds: selectedModules,
    });
  }, [scope, selectedWorkstations, selectedModules, projectWorkstations, projectModules, allLayouts]);

  const hasRequiredSelection = hasRequiredScopeSelection(scope, scopedSelection);
  const selectionPrompt = getScopeSelectionPrompt(scope);
  const selectionOptionCount = scope === 'workstations'
    ? projectWorkstations.length
    : projectModules.length;

  const scopedMedia = useMemo(() => deriveScopedMedia({
    scope,
    scoped: scopedSelection,
    productAssets,
    annotations,
    productMedia,
  }), [scope, scopedSelection, productAssets, annotations, productMedia]);
  const scopedProductAssets = scopedMedia.productAssets;
  const scopedAnnotations = scopedMedia.annotations;
  const scopedProductMedia = scopedMedia.productMedia;
  const scopedWorkstationProducts = useMemo(
    () => scope === 'modules'
      ? []
      : scopedProductAssets.filter(asset => asset.scope_type === 'workstation'),
    [scope, scopedProductAssets],
  );
  const scopedProductPages = useMemo(
    () => paginateProductMedia(scopedWorkstationProducts, scopedProductMedia, scopedAnnotations),
    [scopedAnnotations, scopedProductMedia, scopedWorkstationProducts],
  );
  const placeholderProductPageCount = useMemo(
    () => scopedProductPages.filter(page => page.items.length === 0).length,
    [scopedProductPages],
  );

  // Check generation readiness using pptReadiness service
  const readinessResult = useMemo(() => {
    return checkPPTReadiness({
      projects,
      workstations: allWorkstations,
      layouts: allLayouts,
      modules: allModules,
      selectedProjectId,
      mode,
      scope,
      selectedWorkstationIds: selectedWorkstations,
      selectedModuleIds: selectedModules,
    });
  }, [projects, allWorkstations, allLayouts, allModules, selectedProjectId, mode, scope, selectedWorkstations, selectedModules]);

  const { draftReady, finalReady, missing, warnings } = readinessResult;
  const mediaWarnings = useMemo(() => {
    return getAssetsMissingProductMedia(scopedProductAssets, scopedAnnotations, scopedProductMedia).map(asset => {
      const isModule = asset.scope_type === 'module';
      const ownerName = isModule
        ? scopedSelection.modules.find(module => module.id === asset.module_id)?.name
        : scopedSelection.workstations.find(workstation => workstation.id === asset.workstation_id)?.name;
      const siblingProducts = scopedProductAssets
        .filter(item => isModule
          ? item.scope_type === 'module' && item.module_id === asset.module_id
          : item.scope_type !== 'module' && item.workstation_id === asset.workstation_id)
        .sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || (left.sort_order ?? 0) - (right.sort_order ?? 0));
      const productName = asset.product_name || asset.product_code || `产品 ${siblingProducts.findIndex(item => item.id === asset.id) + 1}`;
      return {
        level: isModule ? 'module' as const : 'workstation' as const,
        id: asset.id,
        name: ownerName ? `${ownerName} / ${productName}` : productName,
        warning: `${productName}：未上传产品图片，本次将生成无图占位页`,
      };
    });
  }, [scopedProductAssets, scopedAnnotations, scopedProductMedia, scopedSelection]);
  const allWarnings = useMemo(() => [...warnings, ...mediaWarnings], [warnings, mediaWarnings]);

  // Handle jump to missing item
  const handleJumpToMissing = (item: typeof missing[0]) => {
    if (item.actionType === 'selectWorkstation') {
      selectWorkstation(item.targetId);
      onOpenChange(false);
    } else if (item.actionType === 'selectModule') {
      selectModule(item.targetId);
      onOpenChange(false);
    } else if (item.actionType === 'selectProject') {
      // Project selection is handled elsewhere
      onOpenChange(false);
    }
  };

  // Calculate what will be generated
  const generationPreview = useMemo(() => {
    return {
      wsCount: scope === 'modules' ? 0 : scopedSelection.workstations.length,
      modCount: scopedSelection.modules.length,
      hardwareCount: scope === 'modules' ? 0 : 1,
      productCount: scopedWorkstationProducts.length,
      productPageCount: scopedProductPages.length,
      placeholderProductPageCount,
    };
  }, [
    placeholderProductPageCount,
    scope,
    scopedProductPages.length,
    scopedSelection,
    scopedWorkstationProducts.length,
  ]);

  useEffect(() => {
    if (!open) {
      setStage('config');
      setLogs([]);
      setCurrentStep('');
      setProgress(0);
      generatedBlobRef.current = null;
      setGenerationResult({
        pageCount: 0,
        layoutImages: 0,
        parameterTables: 0,
        hardwareList: 0,
        fileUrl: '',
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const preferredTemplateId = project?.template_id || defaultTemplate?.id || '';
    const selectedStillExists = templates.some(t => t.id === selectedTemplateId);
    if (preferredTemplateId && (!selectedTemplateId || !selectedStillExists)) {
      setSelectedTemplateId(preferredTemplateId);
    }
  }, [open, project?.template_id, defaultTemplate, selectedTemplateId, templates]);

  // Initialize once per dialog opening/project. Subsequent renders must preserve
  // the user's explicit checkbox changes.
  useEffect(() => {
    if (!open) {
      selectionInitializationRef.current = null;
      return;
    }
    if (!selectedProjectId || dataLoading || selectionInitializationRef.current === selectedProjectId) return;

    setSelectedWorkstations(projectWorkstations.map(ws => ws.id));
    setSelectedModules(projectModules.map(mod => mod.id));
    selectionInitializationRef.current = selectedProjectId;
  }, [open, selectedProjectId, dataLoading, projectWorkstations, projectModules]);

  // Drop stale IDs if the project data changes while the dialog is open. New
  // entities are not auto-selected after initialization, so manual choices stay intact.
  useEffect(() => {
    if (!open || !selectedProjectId || selectionInitializationRef.current !== selectedProjectId) return;
    const validWorkstationIds = new Set(projectWorkstations.map(ws => ws.id));
    const validModuleIds = new Set(projectModules.map(mod => mod.id));
    setSelectedWorkstations(previous => previous.filter(id => validWorkstationIds.has(id)));
    setSelectedModules(previous => previous.filter(id => validModuleIds.has(id)));
  }, [open, selectedProjectId, projectWorkstations, projectModules]);

  // Load media and annotations as one snapshot. A superseded request may finish,
  // but it must never replace data for a newer project/dialog state.
  useEffect(() => {
    const requestId = ++productDataRequestRef.current;
    if (!open || !user?.id || !selectedProjectId || dataLoading) {
      setProductDataStatus('idle');
      setProductDataError('');
      setProductMedia([]);
      setAnnotations([]);
      return;
    }

    const assetIds = productAssets.map(asset => asset.id);
    if (assetIds.length === 0) {
      setProductMedia([]);
      setAnnotations([]);
      setProductDataError('');
      setProductDataStatus('ready');
      return;
    }

    setProductDataStatus('loading');
    setProductDataError('');
    setProductMedia([]);
    setAnnotations([]);

    const loadProductSnapshot = async () => {
      try {
        const [mediaResult, annotationResult] = await Promise.all([
          supabase
            .from('product_media')
            .select('*')
            .eq('user_id', user.id)
            .in('asset_id', assetIds)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          supabase
            .from('product_annotations')
            .select('*')
            .eq('user_id', user.id)
            .in('asset_id', assetIds),
        ]);
        if (mediaResult.error) throw mediaResult.error;
        if (annotationResult.error) throw annotationResult.error;
        if (productDataRequestRef.current !== requestId) return;

        const assetsById = new Map(productAssets.map(asset => [asset.id, asset]));
        const mappedAnnotations = (annotationResult.data || []).map(annotation => {
          const asset = assetsById.get(annotation.asset_id);
          return {
            ...annotation,
            scope_type: asset?.scope_type || 'workstation',
            workstation_id: asset?.workstation_id,
            module_id: asset?.module_id,
          };
        });
        setProductMedia(mediaResult.data || []);
        setAnnotations(mappedAnnotations);
        setProductDataStatus('ready');
      } catch (error) {
        if (productDataRequestRef.current !== requestId) return;
        const message = error instanceof Error ? error.message : '未知错误';
        console.error('Failed to load PPT product data:', error);
        setProductMedia([]);
        setAnnotations([]);
        setProductDataError(`产品图片和标注加载失败：${message}`);
        setProductDataStatus('error');
      }
    };

    void loadProductSnapshot();
    return () => {
      if (productDataRequestRef.current === requestId) {
        productDataRequestRef.current += 1;
      }
    };
  }, [
    dataLoading,
    open,
    productAssets,
    productDataReloadKey,
    selectedProjectId,
    user?.id,
  ]);

  const addLog = (type: GenerationLog['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };

  // 检查选中的模板是否有PPTX文件
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;
  const templateHasFile = selectedTemplate?.file_url ? true : false;
  const templateProductMappingMissing = Boolean(
    generationMethod === 'template'
    && outputFormat === 'ppt'
    && scope !== 'modules'
    && scopedWorkstationProducts.length > 0
    && selectedTemplate
    && !selectedTemplate.structure_meta?.layoutMapping?.mappings?.some(mapping =>
      mapping.enabled !== false && mapping.slideType === 'product_schematic'
    ),
  );
  const productDataReady = productDataStatus === 'ready';

  // 图片可访问性预检
  const handleImagePreCheck = async () => {
    if (!project) return;
    if (!productDataReady) {
      toast.warning('请等待产品图片和标注加载完成');
      return;
    }
    
    setIsCheckingImages(true);
    try {
      const wsToCheck = scopedSelection.workstations;
      const modsToCheck = scopedSelection.modules;
      const layoutsToCheck = scopedSelection.layouts;

      // Collect all image URLs
      const imagesToCheck = collectWorkstationImageUrls(
        layoutsToCheck.map(l => ({
          name: l.name,
          front_view_image_url: l.front_view_image_url,
          side_view_image_url: l.side_view_image_url,
          top_view_image_url: l.top_view_image_url,
        })),
        modsToCheck.map(m => ({
          name: m.name,
          schematic_image_url: m.schematic_image_url,
        })),
        scopedAnnotations.map(a => ({ snapshot_url: a.snapshot_url })),
        scopedProductAssets
          .filter(asset => !scopedProductMedia.some(media => media.asset_id === asset.id))
          .map(a => ({ preview_images: a.preview_images })),
        scopedProductMedia,
      );

      if (imagesToCheck.length === 0) {
        toast.info('没有找到需要检查的图片');
        setImageCheckResult(null);
        return;
      }

      const result = await checkMultipleImages(imagesToCheck);
      setImageCheckResult(result);
      
      if (result.failed > 0) {
        toast.warning(formatAccessibilityReport(result));
      } else {
        toast.success(`所有 ${result.totalChecked} 张图片均可访问`);
      }
    } catch (error) {
      console.error('Image pre-check failed:', error);
      toast.error('图片检查失败');
    } finally {
      setIsCheckingImages(false);
    }
  };

  // 下载图片到本地缓存
  const handleDownloadToCache = async () => {
    if (!productDataReady) {
      toast.warning('请等待产品图片和标注加载完成');
      return;
    }
    if (!project) return;
    
    const wsToCheck = scopedSelection.workstations;
    const modsToCheck = scopedSelection.modules;
    const layoutsToCheck = scopedSelection.layouts;

    // 收集所有需要缓存的图片
    const itemsToCache: Array<{
      type: ImageCacheType;
      relatedId: string;
      url: string;
      label?: string;
    }> = [];

    // 三视图
    layoutsToCheck.forEach(layout => {
      const ws = wsToCheck.find(w => w.id === layout.workstation_id);
      const wsName = ws?.name || '工位';
      
      if (layout.front_view_image_url) {
        itemsToCache.push({
          type: 'layout_front_view',
          relatedId: layout.workstation_id,
          url: layout.front_view_image_url,
          label: `${wsName} - 正视图`,
        });
      }
      if (layout.side_view_image_url) {
        itemsToCache.push({
          type: 'layout_side_view',
          relatedId: layout.workstation_id,
          url: layout.side_view_image_url,
          label: `${wsName} - 侧视图`,
        });
      }
      if (layout.top_view_image_url) {
        itemsToCache.push({
          type: 'layout_top_view',
          relatedId: layout.workstation_id,
          url: layout.top_view_image_url,
          label: `${wsName} - 俯视图`,
        });
      }
    });

    // 模块示意图
    modsToCheck.forEach(mod => {
      if (mod.schematic_image_url) {
        itemsToCache.push({
          type: 'module_schematic',
          relatedId: mod.id,
          url: mod.schematic_image_url,
          label: `${mod.name} - 示意图`,
        });
      }
    });

    // Product previews and annotation snapshots must follow the same scoped
    // selection as report generation.
    scopedProductMedia.forEach(media => {
      if (!media.original_url) return;
      itemsToCache.push({
        type: 'product',
        relatedId: media.id,
        url: media.original_url,
        label: media.file_name || '产品图片',
      });
    });
    scopedAnnotations.forEach(annotation => {
      if (!annotation.snapshot_url) return;
      itemsToCache.push({
        type: 'annotation',
        relatedId: annotation.id,
        url: annotation.snapshot_url,
        label: '标注截图',
      });
    });

    if (itemsToCache.length === 0) {
      toast.info('没有找到需要缓存的图片，请先保存三视图和示意图');
      return;
    }

    // 先检查缺失的缓存
    const missingItems = await findMissingCache(itemsToCache);
    
    if (missingItems.length === 0) {
      toast.success(`所有 ${itemsToCache.length} 张图片已在本地缓存中`);
      return;
    }

    toast.info(`开始下载 ${missingItems.length} 张图片到本地缓存...`);
    
    const result = await downloadAllToCache(missingItems);
    
    if (result.failed === 0) {
      toast.success(`已成功缓存 ${result.success} 张图片`);
    } else {
      toast.warning(`缓存完成: ${result.success} 成功, ${result.failed} 失败`);
    }
  };

  // Upload generated blob to storage and save record
  const saveToHistory = async (blob: Blob, fileName: string, format: OutputFormat, method: GenerationMethod, pageCount: number) => {
    try {
      if (!user?.id || !selectedProjectId) return;
      const timestamp = Date.now();
      const filePath = `${user.id}/${selectedProjectId}/${timestamp}_${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('generated-documents')
        .upload(filePath, blob);
      
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('generated_documents')
        .insert({
          project_id: selectedProjectId,
          user_id: user.id,
          file_url: filePath,
          file_name: fileName,
          file_size: blob.size,
          format,
          generation_method: method,
          template_id: selectedTemplateId || null,
          page_count: pageCount,
          metadata: { language, quality, mode, scope },
        } as any);

      if (insertError) throw insertError;
      addLog('success', '已保存到生成历史');
    } catch (err) {
      console.error('Failed to save to history:', err);
      toast.warning('历史记录保存失败，但文件仍可下载');
    }
  };

  const saveGeneratedReferenceToHistory = async (
    filePathOrUrl: string,
    fileName: string,
    pageCount: number,
    fileSize?: number,
  ) => {
    try {
      if (!user?.id || !selectedProjectId) return;

      const { error: insertError } = await supabase
        .from('generated_documents')
        .insert({
          project_id: selectedProjectId,
          user_id: user.id,
          file_url: filePathOrUrl,
          file_name: fileName,
          file_size: fileSize || 0,
          format: 'ppt',
          generation_method: 'template',
          template_id: selectedTemplateId || null,
          page_count: pageCount,
          metadata: { language, quality, mode, scope, generationMethod: 'template' },
        } as any);

      if (insertError) throw insertError;
      addLog('success', '已保存到生成历史');
    } catch (err) {
      console.error('Failed to save template generation history:', err);
      toast.warning('历史记录保存失败，但文件仍可下载');
    }
  };

  const handleGenerate = async () => {
    if (!project) return;
    if (!productDataReady) {
      toast.warning(productDataStatus === 'error' ? productDataError : '请等待产品图片和标注加载完成');
      return;
    }
    if (!hasRequiredSelection) {
      toast.warning(selectionPrompt);
      return;
    }
    if (templateProductMappingMissing) {
      toast.error('上传模板未配置产品示意图页面映射，请先在模板管理中配置');
      return;
    }
    
    setIsGenerating(true);
    setStage('generating');
    setLogs([]);
    setProgress(0);
    // 重置详细进度追踪状态
    setCurrentWorkstation('');
    setCurrentSlideInfo('');
    setWorkstationProgress({
      current: 0,
      total: scope === 'modules' ? scopedSelection.modules.length : scopedSelection.workstations.length,
    });
    
    // 重置失败URL缓存，允许重新尝试加载
    resetFailedUrlsCache();

    try {
      addLog(
        'info',
        `产品数据：${generationPreview.productCount} 个产品，预计 ${generationPreview.productPageCount} 个产品页`,
      );
      if (generationPreview.placeholderProductPageCount > 0) {
        addLog(
          'warning',
          `${generationPreview.placeholderProductPageCount} 个产品没有图片，将生成无图占位页`,
        );
      }
      const wsToProcess = scopedSelection.workstations;
      const modsToProcess = scopedSelection.modules;
      const layoutsToProcess = scopedSelection.layouts;

      // ===================== 使用统一数据构建 =====================
      // Build hardware library
      const hardwareLibrary: HardwareLibrary = {
        cameras: cameras.map(c => ({
          id: c.id,
          brand: c.brand,
          model: c.model,
          resolution: c.resolution,
          frame_rate: c.frame_rate,
          interface: c.interface,
          sensor_size: c.sensor_size,
          image_url: c.image_url,
        })),
        lenses: lenses.map(l => ({
          id: l.id,
          brand: l.brand,
          model: l.model,
          focal_length: l.focal_length,
          aperture: l.aperture,
          max_sensor_size: l.max_sensor_size,
          mount: l.mount,
          image_url: l.image_url,
        })),
        lights: lights.map(l => ({
          id: l.id,
          brand: l.brand,
          model: l.model,
          type: l.type,
          color: l.color,
          power: l.power,
          image_url: l.image_url,
        })),
        controllers: controllers.map(c => ({
          id: c.id,
          brand: c.brand,
          model: c.model,
          cpu: c.cpu,
          gpu: c.gpu || null,
          memory: c.memory,
          storage: c.storage,
          performance: c.performance,
          image_url: c.image_url,
        })),
      };

      // Prepare product assets input
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productAssetInputs: ProductAssetInput[] = scopedProductAssets.map((a: any) => ({
        id: a.id,
        workstation_id: a.workstation_id,
        module_id: a.module_id,
        scope_type: a.scope_type,
        model_file_url: a.model_file_url,
        preview_images: normalizeProductPreviewImages(a.preview_images),
        detection_method: a.detection_method,
        product_models: a.product_models,
        detection_requirements: a.detection_requirements,
        product_name: a.product_name,
        product_code: a.product_code,
        product_spec: a.product_spec,
        is_primary: a.is_primary,
        sort_order: a.sort_order,
        parent_product_id: a.parent_product_id,
        length_mm: a.length_mm,
        width_mm: a.width_mm,
        height_mm: a.height_mm,
        pos_x: a.pos_x,
        pos_y: a.pos_y,
        pos_z: a.pos_z,
        document_images_per_page: Number(a.document_images_per_page) === 2 ? 2 : 1,
      })) as unknown as ProductAssetInput[];

      // Prepare annotation inputs
      const annotationInputs: AnnotationInput[] = scopedAnnotations.map(a => ({
        id: a.id,
        asset_id: a.asset_id,
        media_id: a.media_id ?? null,
        snapshot_url: a.snapshot_url,
        remark: a.remark,
        annotations_json: a.annotations_json,
        is_ppt_default: a.is_ppt_default ?? false,
        version: a.version ?? null,
        created_at: a.created_at ?? null,
        updated_at: a.updated_at ?? null,
        scope_type: a.scope_type,
        workstation_id: a.workstation_id,
        module_id: a.module_id,
      }));

      // 使用统一数据构建器构建报告数据
      const reportData = buildReportData({
        project: project as any,
        workstations: wsToProcess as any[],
        layouts: layoutsToProcess as any[],
        modules: modsToProcess as any[],
        hardware: hardwareLibrary,
        productAssets: productAssetInputs,
        productMedia: scopedProductMedia,
        annotations: annotationInputs,
        language,
      });

      // 为兼容现有生成器，保留原有数据结构
      const projectData = {
        id: reportData.project.id,
        code: reportData.project.code,
        name: reportData.project.name,
        customer: reportData.project.customer,
        date: reportData.project.date,
        responsible: reportData.project.responsible,
        sales_responsible: reportData.project.sales_responsible,
        vision_responsible: reportData.project.vision_responsible,
        product_process: reportData.project.product_process,
        description: reportData.project.description,
        quality_strategy: reportData.project.quality_strategy,
        environment: reportData.project.environment,
        notes: reportData.project.notes,
        revision_history: reportData.project.revision_history,
        spec_version: reportData.project.spec_version,
        production_line: reportData.project.production_line,
        main_camera_brand: reportData.project.main_camera_brand,
        use_ai: reportData.project.use_ai,
        use_3d: reportData.project.use_3d,
        cycle_time_target: reportData.project.cycle_time_target,
        extra_fields: reportData.project.extra_fields,
      };

      const workstationData = reportData.workstations.map(ws => ({
        id: ws.id,
        code: ws.code,
        name: ws.name,
        type: ws.type,
        type_label: ws.type_label,
        design_responsible: ws.design_responsible,
        cycle_time: ws.cycle_time,
        product_dimensions: ws.product_dimensions,
        product_dimensions_label: ws.product_dimensions_label,
        enclosed: ws.enclosed,
        enclosed_label: ws.enclosed_label,
        process_stage: ws.process_stage,
        process_stage_label: ws.process_stage_label,
        observation_target: ws.observation_target,
        motion_description: ws.motion_description,
        risk_notes: ws.risk_notes,
        notes: ws.notes,
        shot_count: ws.shot_count,
        acceptance_criteria: ws.acceptance_criteria,
        action_script: ws.action_script,
        description: ws.description,
        install_space: ws.install_space,
        install_space_label: ws.install_space_label,
        extra_fields: ws.extra_fields,
      }));

      // 转换 layoutData 为 pptxGenerator 期望的格式
      // ReportHardwareItem 需要转换为 { id, brand, model, image_url } 简单格式
      const layoutData = reportData.layouts.map(l => ({
        workstation_id: l.workstation_id,
        name: l.name,
        conveyor_type: l.conveyor_type,
        conveyor_type_label: l.conveyor_type_label,
        camera_count: l.camera_count,
        lens_count: l.lens_count,
        light_count: l.light_count,
        camera_mounts: l.camera_mounts,
        camera_mounts_labels: l.camera_mounts_labels,
        mechanisms: l.mechanisms,
        mechanisms_labels: l.mechanisms_labels,
        // 转换硬件数据为简单格式，兼容 pptxGenerator 的类型定义
        selected_cameras: safeHardwareArray(l.selected_cameras).map(c => ({
          id: c.id,
          brand: c.brand,
          model: c.model,
          image_url: c.image_url,
        })),
        selected_lenses: safeHardwareArray(l.selected_lenses).map(lens => ({
          id: lens.id,
          brand: lens.brand,
          model: lens.model,
          image_url: lens.image_url,
        })),
        selected_lights: safeHardwareArray(l.selected_lights).map(light => ({
          id: light.id,
          brand: light.brand,
          model: light.model,
          image_url: light.image_url,
        })),
        selected_controller: (() => {
          const controller = safeController(l.selected_controller) as any;
          const libraryController = controller
            ? controllers.find(item => item.id === controller.id)
            : null;
          return controller ? {
            id: controller.id,
            brand: libraryController?.brand || controller.brand,
            model: libraryController?.model || controller.model,
            image_url: libraryController?.image_url || controller.image_url,
            cpu: libraryController?.cpu || controller.cpu || null,
            // Hardware library is authoritative: clearing GPU there must clear the PPT note.
            gpu: libraryController ? (libraryController.gpu || null) : (controller.gpu || null),
            memory: libraryController?.memory || controller.memory || null,
            storage: libraryController?.storage || controller.storage || null,
          } : null;
        })(),
        front_view_image_url: l.front_view_image_url,
        side_view_image_url: l.side_view_image_url,
        top_view_image_url: l.top_view_image_url,
        isometric_view_image_url: l.isometric_view_image_url || null,
        primary_view: l.primary_view || 'front',
        auxiliary_view: l.auxiliary_view || 'side',
        layout_description: l.layout_description || '',
        width: l.width,
        height: l.height,
        depth: l.depth,
        extra_fields: l.extra_fields,
      }));

      const moduleData = reportData.modules.map(m => {
        const moduleWorkstation = workstationData.find(ws => ws.id === m.workstation_id) || null;
        const moduleLayout = layoutData.find(l => l.workstation_id === m.workstation_id) || null;
        const checklistFields = buildModuleVisionChecklistTemplateFields({
          module: m,
          workstation: moduleWorkstation,
          layout: moduleLayout,
          hardware: hardwareLibrary,
          language,
        });

        return {
          id: m.id,
          name: m.name,
          type: m.type,
          type_label: m.type_label,
          description: m.description,
          workstation_id: m.workstation_id,
          trigger_type: m.trigger_type,
          trigger_type_label: m.trigger_type_label,
          roi_strategy: m.roi_strategy,
          roi_strategy_label: m.roi_strategy_label,
          processing_time_limit: m.processing_time_limit,
          output_types: m.output_types,
          output_types_labels: m.output_types_labels,
          selected_camera: m.selected_camera,
          selected_camera_info: m.selected_camera_info,
          selected_lens: m.selected_lens,
          selected_lens_info: m.selected_lens_info,
          selected_light: m.selected_light,
          selected_light_info: m.selected_light_info,
          selected_controller: m.selected_controller,
          selected_controller_info: m.selected_controller_info,
          schematic_image_url: m.schematic_image_url,
          positioning_config: m.positioning_config,
          defect_config: m.defect_config,
          ocr_config: m.ocr_config,
          measurement_config: m.measurement_config,
          deep_learning_config: m.deep_learning_config,
          lighting_photos: m.lighting_photos || [],
          extra_fields: m.extra_fields,
          ...checklistFields,
        };
      });

      const hardwareData = hardwareLibrary;

      // ==================== 根据输出格式选择不同的生成逻辑 ====================
      
      // Prepare product assets and annotations for generator
      const productAssetData = scopedProductAssets.map(a => ({
        id: a.id,
        workstation_id: a.workstation_id,
        module_id: a.module_id,
        scope_type: a.scope_type as 'workstation' | 'module',
        preview_images: normalizeProductPreviewImages(a.preview_images),
        model_file_url: a.model_file_url,
        product_name: a.product_name ?? null,
        product_code: a.product_code ?? null,
        product_spec: a.product_spec ?? null,
        is_primary: a.is_primary ?? false,
        sort_order: a.sort_order ?? 0,
        parent_product_id: a.parent_product_id ?? null,
        length_mm: a.length_mm ?? null,
        width_mm: a.width_mm ?? null,
        height_mm: a.height_mm ?? null,
        pos_x: a.pos_x ?? null,
        pos_y: a.pos_y ?? null,
        pos_z: a.pos_z ?? null,
        document_images_per_page: Number(a.document_images_per_page) === 2 ? 2 : 1,
      }));
      const productMediaData = scopedProductMedia.map(media => ({ ...media }));

      const annotationData = scopedAnnotations.map(a => ({
        id: a.id,
        asset_id: a.asset_id,
        media_id: a.media_id ?? null,
        snapshot_url: a.snapshot_url,
        remark: a.remark,
        annotations_json: a.annotations_json,
        is_ppt_default: a.is_ppt_default ?? false,
        version: a.version ?? null,
        created_at: a.created_at ?? null,
        updated_at: a.updated_at ?? null,
      }));

      // Word文档生成（快速）
      if (outputFormat === 'word') {
        addLog('info', '生成Word文档（快速模式）...');
        setProgress(10);
        setCurrentStep('生成Word文档');

        // Add layout view image URLs to layout data
        const layoutDataWithImages = layoutsToProcess.map(l => {
          const layoutItem = l as any;
          return {
            workstation_id: layoutItem.workstation_id,
            conveyor_type: layoutItem.conveyor_type,
            camera_count: layoutItem.camera_count,
            lens_count: layoutItem.lens_count ?? 1,
            light_count: layoutItem.light_count ?? 1,
            camera_mounts: layoutItem.camera_mounts,
            mechanisms: layoutItem.mechanisms,
            selected_cameras: layoutItem.selected_cameras || null,
            selected_lenses: layoutItem.selected_lenses || null,
            selected_lights: layoutItem.selected_lights || null,
            selected_controller: layoutItem.selected_controller || null,
            front_view_image_url: layoutItem.front_view_image_url || null,
            side_view_image_url: layoutItem.side_view_image_url || null,
            top_view_image_url: layoutItem.top_view_image_url || null,
            isometric_view_image_url: layoutItem.isometric_view_image_url || null,
            primary_view: layoutItem.primary_view || 'front',
            auxiliary_view: layoutItem.auxiliary_view || 'side',
            layout_description: layoutItem.layout_description || '',
          };
        });

        const blob = await generateDOCX(
          projectData,
          workstationData,
          layoutDataWithImages,
          moduleData,
          hardwareData,
          { language, includeImages: true, scope },
          (prog, step, log) => {
            setProgress(prog);
            setCurrentStep(step);
            if (log) addLog('info', log);
          },
          productAssetData,
          annotationData,
          productMediaData,
        );

        generatedBlobRef.current = blob;

        // Count images included
        const imageCount = productMediaData.length;

        setGenerationResult({
          pageCount: 1,
          layoutImages: imageCount,
          parameterTables: wsToProcess.length + modsToProcess.length,
          hardwareList: 1,
          fileUrl: '',
        });

        const wordFileName = `${projectData.code}_${projectData.name}_方案.docx`;

        addLog('success', `Word文档生成完成，包含 ${imageCount} 张图片`);
        setStage('complete');
        setIsGenerating(false);
        toast.success('Word文档生成完成');
        // 非阻塞保存历史记录
        saveToHistory(blob, wordFileName, 'word', generationMethod, 1).catch(e => console.warn('保存历史记录失败:', e));
        return;
      }

      // PDF文档生成（快速，含图片）
      if (outputFormat === 'pdf') {
        addLog('info', '生成PDF文档...');
        setProgress(10);
        setCurrentStep('生成PDF文档');

        // Add layout view image URLs and complete hardware data to layout data
        const layoutDataWithImages = layoutsToProcess.map(l => {
          const layoutItem = l as any;
          
          // 处理选用相机，包含完整信息
          const selectedCameras = safeHardwareArray(layoutItem.selected_cameras).map((c: any) => {
            // 如果只有id，尝试从硬件库中获取完整信息
            const fullCam = cameras.find(cam => cam.id === c.id);
            return {
              id: c.id,
              brand: c.brand || fullCam?.brand || '',
              model: c.model || fullCam?.model || '',
              image_url: c.image_url || fullCam?.image_url || null,
              resolution: c.resolution || fullCam?.resolution || '',
              frame_rate: c.frame_rate || fullCam?.frame_rate || 0,
              interface: c.interface || fullCam?.interface || '',
              sensor_size: c.sensor_size || fullCam?.sensor_size || '',
            };
          });

          // 处理选用镜头
          const selectedLenses = safeHardwareArray(layoutItem.selected_lenses).map((l: any) => {
            const fullLens = lenses.find(lens => lens.id === l.id);
            return {
              id: l.id,
              brand: l.brand || fullLens?.brand || '',
              model: l.model || fullLens?.model || '',
              image_url: l.image_url || fullLens?.image_url || null,
              focal_length: l.focal_length || fullLens?.focal_length || '',
              aperture: l.aperture || fullLens?.aperture || '',
              max_sensor_size: l.max_sensor_size || fullLens?.max_sensor_size || '',
              mount: l.mount || fullLens?.mount || '',
            };
          });

          // 处理选用光源
          const selectedLights = safeHardwareArray(layoutItem.selected_lights).map((lt: any) => {
            const fullLight = lights.find(light => light.id === lt.id);
            return {
              id: lt.id,
              brand: lt.brand || fullLight?.brand || '',
              model: lt.model || fullLight?.model || '',
              image_url: lt.image_url || fullLight?.image_url || null,
              type: lt.type || fullLight?.type || '',
              color: lt.color || fullLight?.color || '',
              power: lt.power || fullLight?.power || '',
            };
          });

          // 处理选用控制器
          let selectedController = null;
          const controllerItem = safeController(layoutItem.selected_controller) as any;
          if (controllerItem) {
            const c = controllerItem;
            const fullCtrl = controllers.find(ctrl => ctrl.id === c.id);
            selectedController = {
              id: c.id,
              brand: c.brand || fullCtrl?.brand || '',
              model: c.model || fullCtrl?.model || '',
              image_url: c.image_url || fullCtrl?.image_url || null,
              cpu: c.cpu || fullCtrl?.cpu || '',
              gpu: fullCtrl ? (fullCtrl.gpu || null) : (c.gpu || null),
              memory: c.memory || fullCtrl?.memory || '',
              storage: c.storage || fullCtrl?.storage || '',
            };
          }

          return {
            workstation_id: layoutItem.workstation_id,
            conveyor_type: layoutItem.conveyor_type,
            camera_count: layoutItem.camera_count,
            lens_count: layoutItem.lens_count ?? 1,
            light_count: layoutItem.light_count ?? 1,
            camera_mounts: layoutItem.camera_mounts,
            mechanisms: layoutItem.mechanisms,
            selected_cameras: selectedCameras,
            selected_lenses: selectedLenses,
            selected_lights: selectedLights,
            selected_controller: selectedController,
            front_view_image_url: layoutItem.front_view_image_url || null,
            side_view_image_url: layoutItem.side_view_image_url || null,
            top_view_image_url: layoutItem.top_view_image_url || null,
            isometric_view_image_url: layoutItem.isometric_view_image_url || null,
            primary_view: layoutItem.primary_view || 'front',
            auxiliary_view: layoutItem.auxiliary_view || 'side',
            layout_description: layoutItem.layout_description || '',
          };
        });

        const blob = await generatePDF(
          projectData,
          workstationData,
          layoutDataWithImages,
          moduleData,
          hardwareData,
          { language, includeImages: true, scope },
          (prog, step, log) => {
            setProgress(prog);
            setCurrentStep(step);
            if (log) addLog('info', log);
          },
          productAssetData,
          annotationData,
          productMediaData,
        );

        generatedBlobRef.current = blob;

        // Count images included
        const imageCount = productMediaData.length;
        const pdfPageCount = Math.ceil((wsToProcess.length + 3) * 1.5);

        setGenerationResult({
          pageCount: pdfPageCount,
          layoutImages: imageCount,
          parameterTables: wsToProcess.length + modsToProcess.length,
          hardwareList: 1,
          fileUrl: '',
        });

        const pdfFileName = `${projectData.code}_${projectData.name}_方案.pdf`;

        addLog('success', `PDF文档生成完成，包含 ${imageCount} 张图片`);
        setStage('complete');
        setIsGenerating(false);
        toast.success('PDF文档生成完成');
        // 非阻塞保存历史记录
        saveToHistory(blob, pdfFileName, 'pdf', generationMethod, pdfPageCount).catch(e => console.warn('保存历史记录失败:', e));
        return;
      }
      
      // ================================================================
      // 【上传模板通道】独立路径：仅调用 templateBasedGenerator
      // 不与默认企业模板共用 pptxGenerator。任何失败都被本块内
      // 的逻辑捕获并以 [上传模板] 前缀记录，避免污染企业模板流程
      // ================================================================
      if (generationMethod === 'template') {
        if (!selectedTemplateId || !selectedTemplate) {
          throw new Error('[上传模板] 请先选择要使用的上传模板');
        }
        if (!templateHasFile) {
          throw new Error('[上传模板] 所选模板没有上传 PPTX 文件，请先在管理中心补充模板文件');
        }
        if (!selectedTemplate.structure_meta?.parsedSlides?.length) {
          throw new Error('[上传模板] 所选模板缺少解析信息，请在管理中心重新上传或重新解析模板');
        }
        if (templateProductMappingMissing) {
          throw new Error('[上传模板] 有产品数据，但模板未配置已启用的 product_schematic 页面映射');
        }

        const layoutMapping = selectedTemplate.structure_meta.layoutMapping;
        const workstationSlideMapping = layoutMapping?.mappings
          ?.filter(mapping => mapping.enabled !== false)
          .reduce<Record<string, number[]>>((acc, mapping) => {
            acc[mapping.slideType] = acc[mapping.slideType] || [];
            acc[mapping.slideType].push(mapping.templateSlideIndex);
            return acc;
          }, {});

        addLog('info', `[上传模板] 使用「${selectedTemplate.name}」生成 PPT...`);
        setProgress(10);
        setCurrentStep('准备模板生成数据');

        const toTemplateAnnotation = (annotation: typeof scopedAnnotations[number]) => ({
          id: annotation.id,
          asset_id: annotation.asset_id,
          media_id: annotation.media_id ?? null,
          snapshot_url: annotation.snapshot_url,
          annotations_json: Array.isArray(annotation.annotations_json) ? annotation.annotations_json : [],
          remark: annotation.remark,
          is_ppt_default: annotation.is_ppt_default ?? false,
          version: annotation.version ?? null,
          created_at: annotation.created_at ?? null,
          updated_at: annotation.updated_at ?? null,
        });

        const modulesForTemplate = moduleData.map(mod => {
          const moduleProductAsset = productAssetData.find(
            asset => asset.scope_type === 'module' && asset.module_id === mod.id,
          ) || null;
          const moduleMediaItems = moduleProductAsset
            ? buildProductMediaItems(moduleProductAsset.id, productMediaData, scopedAnnotations, moduleProductAsset.preview_images)
            : [];
          const moduleAnnotations = moduleMediaItems
            .map(item => item.annotation)
            .filter((item): item is typeof scopedAnnotations[number] => Boolean(item));

          return {
            ...mod,
            product_asset: moduleProductAsset ? {
              ...moduleProductAsset,
              product_media: moduleMediaItems.map(item => ({
                ...item.media,
                product_annotation: item.annotation ? toTemplateAnnotation(item.annotation) : null,
              })),
              product_annotations: moduleAnnotations.map(toTemplateAnnotation),
            } : null,
            product_annotation: moduleAnnotations[0] ? toTemplateAnnotation(moduleAnnotations[0]) : null,
            product_annotations: moduleAnnotations.map(toTemplateAnnotation),
          };
        });

        const workstationsForTemplate = workstationData.map(ws => {
          const wsModules = modulesForTemplate.filter(m => m.workstation_id === ws.id);
          const wsLayout = layoutData.find(l => l.workstation_id === ws.id) || null;
          const wsProductAssets = productAssetData
            .filter(asset => asset.scope_type === 'workstation' && asset.workstation_id === ws.id)
            .sort((a, b) =>
              Number(b.is_primary ?? false) - Number(a.is_primary ?? false)
              || (a.sort_order ?? 0) - (b.sort_order ?? 0)
            )
            .map(asset => {
              const assetMediaItems = buildProductMediaItems(asset.id, productMediaData, scopedAnnotations, asset.preview_images);
              const assetAnnotations = assetMediaItems
                .map(item => item.annotation)
                .filter((item): item is typeof scopedAnnotations[number] => Boolean(item));
              return {
                ...asset,
                product_media: assetMediaItems.map(item => ({
                  ...item.media,
                  product_annotation: item.annotation ? toTemplateAnnotation(item.annotation) : null,
                })),
                product_annotation: assetAnnotations[0] ? toTemplateAnnotation(assetAnnotations[0]) : null,
                product_annotations: assetAnnotations.map(toTemplateAnnotation),
              };
            });
          const wsProductAsset = wsProductAssets[0] || null;
          const wsAnnotation = wsProductAsset?.product_annotation || null;

          return {
            ...ws,
            modules: wsModules,
            layout: wsLayout,
            product_asset: wsProductAsset,
            product_assets: wsProductAssets,
            product_annotation: wsAnnotation,
            product_annotations: wsProductAssets.flatMap(asset => asset.product_annotations),
          };
        });

        const result = await generateFromUserTemplate({
          templateId: selectedTemplateId,
          scope,
          data: {
            project: projectData,
            workstations: workstationsForTemplate,
            modules: modulesForTemplate,
            hardware: hardwareData,
            language,
          },
          outputFileName: `${projectData.code}_${projectData.name}_方案.pptx`,
          duplicateWorkstationSlides: layoutMapping?.duplicateForEachWorkstation ?? true,
          workstationSlideMapping,
          fieldMappings: selectedTemplate.structure_meta.fieldMappings,
          onProgress: (message) => {
            addLog('info', message);
            setCurrentStep(message);
            setProgress(prev => Math.min(90, Math.max(prev + 12, 20)));
          },
        });

        if (!result.success || !result.fileUrl) {
          throw new Error(`[上传模板] ${result.error || '模板 PPT 生成失败'}`);
        }

        generatedBlobRef.current = null;
        setGenerationResult({
          pageCount: result.slideCount || 0,
          layoutImages: workstationsForTemplate.filter(ws => ws.layout).length * 3,
          parameterTables: wsToProcess.length + modsToProcess.length,
          hardwareList: 1,
          fileUrl: result.fileUrl,
        });

        addLog('success', `[上传模板] 成功生成 ${result.fileName || '方案.pptx'}`);
        setProgress(100);
        setCurrentStep('[上传模板] 生成完成');
        setStage('complete');
        setIsGenerating(false);
        toast.success('上传模板 PPT 生成完成');

        saveGeneratedReferenceToHistory(
          result.filePath || result.fileUrl,
          result.fileName || `${projectData.code}_${projectData.name}_方案.pptx`,
          result.slideCount || 0,
          result.fileSize,
        ).catch(e => console.warn('保存模板生成历史记录失败:', e));
        return;
      }

      // ================================================================
      // 【默认企业模板通道】独立路径：仅调用 pptxGenerator
      // 与上传模板路线完全隔离，互不影响
      // ================================================================
      {
        addLog('info', '[企业模板] 使用企业 VI 风格生成 PPT...');
        setProgress(10);
        setCurrentStep('[企业模板] 生成 PPT 内容');

        const blob = await generatePPTX(
          projectData,
          workstationData,
          layoutData,
          moduleData,
          { 
            language, 
            quality, 
            mode,
            scope,
          },
          (prog, step, log) => {
            // Adjust progress to start from 10%
            setProgress(10 + prog * 0.9);
            setCurrentStep(step);
            
            // 解析详细日志以提取工位和页面信息
            // 格式: [WORKSTATION:名称:当前/总数] -> [SLIDE:工位名:页码/总页]
            if (log.includes('[WORKSTATION:')) {
              const match = log.match(/\[WORKSTATION:(.+?):(\d+)\/(\d+)\]/);
              if (match) {
                setCurrentWorkstation(match[1]);
                setWorkstationProgress({ current: parseInt(match[2]), total: parseInt(match[3]) });
                setCurrentSlideInfo('');
              }
            } else if (log.includes('[SLIDE:')) {
              const match = log.match(/\[SLIDE:(.+?):(\d+)\/(\d+)\]/);
              if (match) {
                setCurrentSlideInfo(`${match[1]} - 页面 ${match[2]}/${match[3]}`);
              }
            }
            
            addLog('info', log);
          },
          hardwareData,
          readinessResult,
          scopedAnnotations,
          scopedProductAssets,
          scopedProductMedia,
        );

        generatedBlobRef.current = blob;

        const lightingPhotoPageCount = mode === 'final'
          ? moduleData.reduce((count, mod) => {
              const photos = Array.isArray((mod as any).lighting_photos)
                ? (mod as any).lighting_photos
                : [];
              return count + getLightingPhotoSlideCount(photos.length);
            }, 0)
          : 0;
        const moduleOnlyPageCount = moduleData.length + lightingPhotoPageCount;
        const estimatedPageCount = scope === 'modules'
          ? moduleOnlyPageCount
          : 2 + wsToProcess.length + modsToProcess.length + 2 + lightingPhotoPageCount;
        const pptPageCount = blob.slideCount || estimatedPageCount;
        // Set result
        setGenerationResult({
          pageCount: pptPageCount,
          layoutImages: scope === 'modules' ? moduleData.length : wsToProcess.length * 3,
          parameterTables: wsToProcess.length + modsToProcess.length,
          hardwareList: scope === 'modules' ? 0 : 1,
          fileUrl: '',
        });

        const pptFileName = `${projectData.code}_${projectData.name}_方案.pptx`;

        addLog('success', `[企业模板] 成功生成 PPT 文件`);
        setStage('complete');
        setIsGenerating(false);
        toast.success('企业模板 PPT 生成完成');
        // 非阻塞保存历史记录
        saveToHistory(blob, pptFileName, 'ppt', 'scratch', pptPageCount).catch(e => console.warn('保存历史记录失败:', e));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : '';
      // 详细错误日志，便于调试
      console.error('PPT generation failed:', {
        error,
        message: errMsg,
        stack: errStack,
        method: generationMethod,
        outputFormat,
        projectId: project?.id,
        projectName: project?.name,
        workstationCount: projectWorkstations.length,
        moduleCount: selectedModules.length,
      });
      addLog('error', `生成失败: ${errMsg}`);
      setErrorMessage(errMsg);
      setStage('error');
      setIsGenerating(false);
      toast.error('文档生成失败');
    }
  };

  const handleDownload = async () => {
    if (!project) return;
    
    // 如果有fileUrl（模板生成），从URL下载
    if (generationResult.fileUrl) {
      try {
        await downloadGeneratedFile(
          generationResult.fileUrl, 
          `${project.code}_${project.name}_方案.pptx`
        );
        toast.success('文件下载成功');
      } catch (error) {
        console.error('Download error:', error);
        toast.error('下载失败');
      }
      return;
    }
    
    // 否则使用 blob 下载（从零生成的 PPT/Word/PDF 文档）
    if (!generatedBlobRef.current) return;
    
    const url = URL.createObjectURL(generatedBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    // 根据输出格式决定文件扩展名
    const ext = outputFormat === 'word' ? 'docx' : outputFormat === 'pdf' ? 'pdf' : 'pptx';
    a.download = `${project.code}_${project.name}_方案.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('文件下载成功');
  };

  const toggleWorkstation = (wsId: string) => {
    setSelectedWorkstations(prev => 
      prev.includes(wsId) ? prev.filter(id => id !== wsId) : [...prev, wsId]
    );
  };

  const toggleModule = (modId: string) => {
    setSelectedModules(prev => 
      prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
    );
  };

  const selectAllWorkstations = () => {
    setSelectedWorkstations(projectWorkstations.map(ws => ws.id));
  };

  const clearSelectedWorkstations = () => {
    setSelectedWorkstations([]);
  };

  const selectAllModules = () => {
    setSelectedModules(projectModules.map(mod => mod.id));
  };

  const clearSelectedModules = () => {
    setSelectedModules([]);
  };

  const toggleWorkstationModules = (workstationId: string) => {
    const workstationModuleIds = (modulesByWorkstation.get(workstationId) || []).map(mod => mod.id);
    if (workstationModuleIds.length === 0) return;

    setSelectedModules(previous => {
      const selectedIds = new Set(previous);
      const groupIsFullySelected = workstationModuleIds.every(id => selectedIds.has(id));
      if (groupIsFullySelected) {
        return previous.filter(id => !workstationModuleIds.includes(id));
      }
      workstationModuleIds.forEach(id => selectedIds.add(id));
      return projectModules.map(mod => mod.id).filter(id => selectedIds.has(id));
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[min(96vw,72rem)] min-h-0 flex-col overflow-hidden p-4 sm:max-w-6xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            生成PPT方案文档
          </DialogTitle>
        </DialogHeader>

        {/* Config Stage */}
        {stage === 'config' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto pr-1 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:overflow-hidden">
              <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            {/* Output Format Selection - 输出格式选择 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">输出格式</Label>
              <RadioGroup 
                value={outputFormat} 
                onValueChange={(v) => setOutputFormat(v as OutputFormat)} 
                className="grid grid-cols-3 gap-2"
              >
                <Label className={cn(
                  "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                  outputFormat === 'word' ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}>
                  <RadioGroupItem value="word" />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      📄 Word
                      <Badge variant="secondary" className="text-xs">快速</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">纯文档表格</div>
                  </div>
                </Label>
                <Label className={cn(
                  "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                  outputFormat === 'pdf' ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}>
                  <RadioGroupItem value="pdf" />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      📕 PDF
                      <Badge variant="outline" className="text-xs">推荐</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">含图片，可打印</div>
                  </div>
                </Label>
                <Label className={cn(
                  "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                  outputFormat === 'ppt' ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}>
                  <RadioGroupItem value="ppt" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">📊 PPT</div>
                    <div className="text-xs text-muted-foreground">可编辑演示</div>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* PPT-specific options - only show when PPT format selected */}
            {outputFormat === 'ppt' && (
              <>
                {/* Generation Mode Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">生成模式</Label>
                  <RadioGroup value={mode} onValueChange={(v) => setMode(v as GenerationMode)} className="grid grid-cols-2 gap-2">
                    <Label className={cn(
                      "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                      mode === 'draft' ? "border-primary bg-primary/5" : "hover:bg-muted"
                    )}>
                      <RadioGroupItem value="draft" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">草案版</div>
                        <div className="text-xs text-muted-foreground">允许缺失，用占位提示</div>
                      </div>
                    </Label>
                    <Label className={cn(
                      "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                      mode === 'final' ? "border-primary bg-primary/5" : "hover:bg-muted"
                    )}>
                      <RadioGroupItem value="final" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">交付版</div>
                        <div className="text-xs text-muted-foreground">必须完整，所有项齐全</div>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>
              </>
            )}

            {outputFormat === 'ppt' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">PPT模板来源</Label>
                <RadioGroup
                  value={generationMethod}
                  onValueChange={(v) => setGenerationMethod(v as GenerationMethod)}
                  className="grid grid-cols-2 gap-2"
                >
                  <Label className={cn(
                    "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                    generationMethod === 'scratch' ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}>
                    <RadioGroupItem value="scratch" />
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        默认企业模板
                      </div>
                      <div className="text-xs text-muted-foreground">使用现有生成逻辑</div>
                    </div>
                  </Label>
                  <Label className={cn(
                    "flex items-center gap-2 p-3 border rounded-lg transition-colors",
                    templatesLoading || templates.length === 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                    generationMethod === 'template' ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}>
                    <RadioGroupItem value="template" disabled={templatesLoading || templates.length === 0} />
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <FileStack className="h-4 w-4" />
                        上传模板
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {templates.length === 0 ? '管理中心暂无模板' : '按占位符与页面映射生成'}
                      </div>
                    </div>
                  </Label>
                </RadioGroup>

                <p className="text-[11px] text-muted-foreground px-1">
                  两种生成方式互不影响：上传模板出错不会影响默认企业模板，反之亦然。
                </p>

                {generationMethod === 'template' && (
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
                    <Label className="text-xs text-muted-foreground">选择上传模板</Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                      disabled={templatesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={templatesLoading ? '模板加载中...' : '请选择模板'} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(tpl => (
                          <SelectItem key={tpl.id} value={tpl.id}>
                            {tpl.name} {tpl.is_default && '(默认)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplate && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant={selectedTemplate.file_url ? 'secondary' : 'destructive'}>
                          {selectedTemplate.file_url ? '已上传文件' : '缺少PPTX文件'}
                        </Badge>
                        <Badge variant={(selectedTemplate.structure_meta?.parsedSlides?.length || 0) > 0 ? 'secondary' : 'destructive'}>
                          已解析 {selectedTemplate.structure_meta?.parsedSlides?.length || 0} 页
                        </Badge>
                        <Badge variant="outline">
                          字段 {selectedTemplate.structure_meta?.fieldMappings?.length || 0} 个
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Delivery Check Panel */}
            {(missing.length > 0 || allWarnings.length > 0) && (
              <Collapsible open={checkPanelOpen} onOpenChange={setCheckPanelOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={cn(
                        "h-4 w-4",
                        mode === 'final' && !finalReady ? "text-destructive" : "text-warning"
                      )} />
                      <span className="text-sm font-medium">
                        交付检查 ({missing.length} 项缺失 / {allWarnings.length} 项警告)
                      </span>
                    </div>
                    {checkPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-2">
                  {/* Missing Items */}
                  {missing.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-destructive">缺失项（必须补齐）</p>
                          <p className="text-xs text-destructive/70 mt-0.5">
                            {mode === 'final' ? '交付版需要补齐所有缺失项' : '草案版将使用占位提示'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 mt-3">
                        {missing.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-2 p-2 bg-background rounded border border-destructive/20">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {item.level === 'project' ? '项目' : item.level === 'workstation' ? '工位' : '模块'}
                                </Badge>
                                <span className="text-sm font-medium truncate">{item.name}</span>
                              </div>
                              <ul className="text-xs text-destructive/80 space-y-0.5 ml-6">
                                {item.missing.map((m, i) => (
                                  <li key={i}>- {m}</li>
                                ))}
                              </ul>
                            </div>
                            {(item.actionType === 'selectWorkstation' || item.actionType === 'selectModule') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 gap-1 h-7 text-xs"
                                onClick={() => handleJumpToMissing(item)}
                              >
                                <ExternalLink className="h-3 w-3" />
                                跳转
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {allWarnings.length > 0 && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-warning">警告项（建议补齐）</p>
                          <p className="text-xs text-warning/70 mt-0.5">不影响生成，但建议完善</p>
                        </div>
                      </div>
                      <div className="space-y-2 mt-3">
                        {allWarnings.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-2 bg-background rounded border border-warning/20">
                            <Badge variant="outline" className="text-xs shrink-0">
                              {item.level === 'project' ? '项目' : item.level === 'workstation' ? '工位' : '模块'}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate mb-1">{item.name}</div>
                              <div className="text-xs text-warning/80">{item.warning}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </CollapsibleContent>
              </Collapsible>
            )}

            {productDataStatus === 'loading' && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载产品图片和标注，完成后才能生成…
              </div>
            )}
            {productDataStatus === 'error' && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <div className="flex min-w-0 items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{productDataError}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setProductDataReloadKey(value => value + 1)}
                >
                  重试
                </Button>
              </div>
            )}
            {templateProductMappingMissing && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">上传模板缺少产品示意图映射</p>
                  <p className="mt-1 text-xs text-destructive/80">
                    请在模板管理中将对应页面启用并映射为 product_schematic。
                  </p>
                </div>
              </div>
            )}

            {/* Image Accessibility Pre-Check & Local Cache */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ImageOff className="h-4 w-4" />
                  图片可访问性检查
                </Label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDownloadToCache}
                    disabled={isCachingImages || isCheckingImages || !productDataReady}
                  >
                    {isCachingImages ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        {cacheProgress.current}/{cacheProgress.total}
                      </>
                    ) : (
                      <>
                        <HardDrive className="h-3 w-3 mr-1" />
                        下载到本地
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleImagePreCheck}
                    disabled={isCheckingImages || isCachingImages || !productDataReady}
                  >
                    {isCheckingImages ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        检查中...
                      </>
                    ) : (
                      '运行检查'
                    )}
                  </Button>
                </div>
              </div>
              
              {/* 缓存统计 */}
              {cacheStats && cacheStats.totalCount > 0 && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <HardDrive className="h-3 w-3" />
                  本地缓存: {cacheStats.totalCount} 张图片 ({formatFileSize(cacheStats.totalSize)})
                </div>
              )}
              
              {/* 下载进度 */}
              {isCachingImages && (
                <div className="p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>{cacheProgress.message}</span>
                    <span>{cacheProgress.current}/{cacheProgress.total}</span>
                  </div>
                  <Progress value={(cacheProgress.current / cacheProgress.total) * 100} className="h-1" />
                </div>
              )}
              
              {imageCheckResult && (
                <div className={cn(
                  "p-3 rounded-lg border text-sm",
                  imageCheckResult.failed > 0 
                    ? "bg-warning/10 border-warning/30 text-warning" 
                    : "bg-primary/10 border-primary/30 text-primary"
                )}>
                  <div className="font-medium mb-1">
                    {imageCheckResult.failed > 0 
                      ? `⚠️ ${imageCheckResult.failed}/${imageCheckResult.totalChecked} 张图片无法访问`
                      : `所有 ${imageCheckResult.totalChecked} 张图片均可访问`
                    }
                  </div>
                  {imageCheckResult.failed > 0 && (
                    <div className="text-xs space-y-1 mt-2">
                      {imageCheckResult.failedByType.three_view && (
                        <div>- 三视图: {imageCheckResult.failedByType.three_view} 张</div>
                      )}
                      {imageCheckResult.failedByType.schematic && (
                        <div>- 视觉系统示意图: {imageCheckResult.failedByType.schematic} 张</div>
                      )}
                      {imageCheckResult.failedByType.hardware && (
                        <div>- 硬件图片: {imageCheckResult.failedByType.hardware} 张</div>
                      )}
                      {imageCheckResult.failedByType.product && (
                        <div>- 产品图片: {imageCheckResult.failedByType.product} 张</div>
                      )}
                      {imageCheckResult.failedByType.annotation && (
                        <div>- 标注截图: {imageCheckResult.failedByType.annotation} 张</div>
                      )}
                      <p className="mt-2 text-muted-foreground">
                        提示: 点击“下载到本地”可将图片缓存到浏览器，确保离线或本地部署时可用。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Output Options */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">输出语言</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as OutputLanguage)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">图片清晰度</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as ImageQuality)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">标准 (72dpi)</SelectItem>
                    <SelectItem value="high">高清 (150dpi)</SelectItem>
                    <SelectItem value="ultra">超清 (300dpi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
              </div>

              <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">

            {/* Generation Scope */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">生成范围</Label>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as GenerationScope)} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Label className={cn(
                  "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                  scope === 'full' ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}>
                  <RadioGroupItem value="full" />
                  <span className="text-sm">全项目</span>
                </Label>
                <Label className={cn(
                  "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                  scope === 'workstations' ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}>
                  <RadioGroupItem value="workstations" />
                  <span className="text-sm">选择工位</span>
                </Label>
                <Label className={cn(
                  "flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors",
                  scope === 'modules' ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}>
                  <RadioGroupItem value="modules" />
                  <span className="text-sm">选择模块</span>
                </Label>
              </RadioGroup>
            </div>

            {/* Workstation/Module Selection */}
            {(scope === 'workstations' || scope === 'modules') && (
              <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background" data-testid="generation-scope-selection">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {scope === 'workstations' ? '选择要生成的工位' : '选择要生成的模块'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scope === 'workstations'
                        ? '只导出勾选工位及其包含模块'
                        : '只导出勾选模块的光学方案页和打光照片页'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={hasRequiredSelection ? 'secondary' : 'outline'} className="mr-1 shrink-0">
                      {scope === 'workstations'
                        ? `${scopedSelection.workstations.length}/${projectWorkstations.length}`
                        : `${scopedSelection.modules.length}/${projectModules.length}`} 已选
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      aria-label={scope === 'workstations' ? '全选工位' : '全选模块'}
                      onClick={scope === 'workstations' ? selectAllWorkstations : selectAllModules}
                    >
                      全选
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      aria-label={scope === 'workstations' ? '清空工位' : '清空模块'}
                      onClick={scope === 'workstations' ? clearSelectedWorkstations : clearSelectedModules}
                    >
                      清空
                    </Button>
                  </div>
                </div>
                <div
                  className="min-h-0 overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable]"
                  style={selectionOptionCount > 10 ? { maxHeight: 'min(52dvh, 36rem)' } : undefined}
                  data-testid="generation-scope-list"
                >
                  <div className="space-y-1">
                    {scope === 'workstations' && projectWorkstations.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">当前项目暂无工位</div>
                    )}
                    {scope === 'workstations' && projectWorkstations.map(ws => (
                      <label key={ws.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox 
                          aria-label={`选择工位 ${ws.name}`}
                          checked={selectedWorkstations.includes(ws.id)} 
                          onCheckedChange={() => toggleWorkstation(ws.id)} 
                        />
                        <Box className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 min-w-0 truncate">{ws.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {(modulesByWorkstation.get(ws.id) || []).length} 模块
                        </Badge>
                      </label>
                    ))}
                    {scope === 'modules' && projectModules.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">当前项目暂无模块</div>
                    )}
                    {scope === 'modules' && projectWorkstations.map(ws => {
                      const wsModules = modulesByWorkstation.get(ws.id) || [];
                      if (wsModules.length === 0) return null;
                      const selectedGroupCount = wsModules.filter(mod => selectedModules.includes(mod.id)).length;
                      const groupChecked = selectedGroupCount === wsModules.length
                        ? true
                        : selectedGroupCount > 0 ? 'indeterminate' : false;
                      return (
                      <div key={ws.id} className="rounded-md border border-transparent bg-muted/20">
                        <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60">
                          <Checkbox
                            aria-label={`选择 ${ws.name} 全部模块`}
                            checked={groupChecked}
                            onCheckedChange={() => toggleWorkstationModules(ws.id)}
                          />
                          <Box className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                          <span className="shrink-0 font-normal">{selectedGroupCount}/{wsModules.length}</span>
                        </label>
                        {wsModules.map(mod => (
                          <label key={mod.id} className="flex cursor-pointer items-center gap-2 rounded p-2 pl-9 hover:bg-muted">
                            <Checkbox 
                              aria-label={`选择模块 ${mod.name}`}
                              checked={selectedModules.includes(mod.id)} 
                              onCheckedChange={() => toggleModule(mod.id)} 
                            />
                            <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 min-w-0 truncate">{mod.name}</span>
                          </label>
                        ))}
                      </div>
                      );
                    })}
                  </div>
                </div>
                {!hasRequiredSelection && (
                  <p className="border-t px-3 py-2 text-xs text-destructive" role="alert">{selectionPrompt}</p>
                )}
              </div>
            )}

            <Separator />

            {/* Generation Preview */}
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-medium mb-2">生成预览</p>
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Table className="h-4 w-4 text-chart-3" />
                    <span className="text-lg font-bold">{generationPreview.wsCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">工位</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Table className="h-4 w-4 text-chart-4" />
                    <span className="text-lg font-bold">{generationPreview.modCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">检测模块</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Camera className="h-4 w-4 text-chart-4" />
                    <span className="text-lg font-bold">{generationPreview.hardwareCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">硬件清单</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Box className="h-4 w-4 text-chart-2" />
                    <span className="text-lg font-bold">{generationPreview.productCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">产品</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <FileStack className="h-4 w-4 text-chart-3" />
                    <span className="text-lg font-bold">{generationPreview.productPageCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    产品页
                    {generationPreview.placeholderProductPageCount > 0
                      ? `（占位 ${generationPreview.placeholderProductPageCount}）`
                      : ''}
                  </p>
                </div>
              </div>
            </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-background pt-3">
              <Button
                variant="outline"
                onClick={() => setImagePreviewOpen(true)}
                className="gap-1 mr-auto"
                disabled={!productDataReady}
              >
                <Eye className="h-4 w-4" />
                查看已保存图片
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button 
                onClick={handleGenerate} 
                disabled={
                  !draftReady || 
                  (mode === 'final' && !finalReady) ||
                  !hasRequiredSelection ||
                  !productDataReady ||
                  templateProductMappingMissing ||
                  isGenerating
                }
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : !productDataReady ? (
                  productDataStatus === 'error' ? '产品数据加载失败' : '正在加载产品数据'
                ) : templateProductMappingMissing ? (
                  '模板缺少产品页映射'
                ) : !hasRequiredSelection ? (
                  selectionPrompt
                ) : mode === 'final' && !finalReady ? (
                  '请先补齐缺失项'
                ) : (
                  '开始生成'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Generating Stage */}
        {stage === 'generating' && (
          <div className="flex flex-col gap-4 py-4">
            {/* Current Step Header */}
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">{currentStep}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>生成进度</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Detailed Progress Info - 工位和页面追踪 */}
            {(currentWorkstation || workstationProgress.total > 0) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      {currentWorkstation || '准备中...'}
                    </span>
                  </div>
                  {workstationProgress.total > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      工位 {workstationProgress.current}/{workstationProgress.total}
                    </Badge>
                  )}
                </div>
                
                {currentSlideInfo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                    <Layers className="h-3 w-3" />
                    <span>{currentSlideInfo}</span>
                  </div>
                )}
                
                {/* 工位内部进度 */}
                {workstationProgress.total > 0 && (
                  <div className="pl-6">
                    <Progress 
                      value={(workstationProgress.current / workstationProgress.total) * 100} 
                      className="h-1" 
                    />
                  </div>
                )}
              </div>
            )}

            {/* Log Output - 可折叠 */}
            <Collapsible defaultOpen={true}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full bg-muted/50 px-3 py-1.5 text-xs font-medium border-b flex items-center justify-between hover:bg-muted/70 transition-colors">
                  <span>生成日志</span>
                  <ChevronDown className="h-3 w-3" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-32">
                    <div className="p-2 font-mono text-xs space-y-1">
                      {logs.slice(-20).map((log, idx) => (
                        <div key={idx} className={cn(
                          "flex items-start gap-2",
                          log.type === 'success' && "text-chart-2",
                          log.type === 'warning' && "text-warning",
                          log.type === 'error' && "text-destructive"
                        )}>
                          <span className="text-muted-foreground shrink-0">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="break-all">
                            {/* 清理日志中的标记符号 */}
                            {log.message.replace(/\[WORKSTATION:.*?\]|\[SLIDE:.*?\]/g, '').trim()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        )}

        {/* Complete Stage */}
        {stage === 'complete' && (
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="w-16 h-16 rounded-full bg-chart-2/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-chart-2" />
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                {outputFormat === 'word' ? 'Word文档生成完成' : outputFormat === 'pdf' ? 'PDF文档生成完成' : 'PPT生成完成'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                项目: {project?.name}
              </p>
            </div>

            {/* Result Summary */}
            <div className="w-full bg-muted/30 rounded-lg p-4">
              <p className="text-sm font-medium mb-3 text-center">生成摘要</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>总页数:</span>
                  <span className="font-medium">{generationResult.pageCount} 页</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Layout className="h-4 w-4 text-chart-1" />
                  <span>布局图:</span>
                  <span className="font-medium">{generationResult.layoutImages} 张</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Table className="h-4 w-4 text-chart-3" />
                  <span>参数表:</span>
                  <span className="font-medium">{generationResult.parameterTables} 张</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Camera className="h-4 w-4 text-chart-4" />
                  <span>硬件清单:</span>
                  <span className="font-medium">{generationResult.hardwareList} 张</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button className="gap-2" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                {outputFormat === 'word' ? '下载Word文件' : outputFormat === 'pdf' ? '下载PDF文件' : '下载PPTX文件'}
              </Button>
            </div>
            
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </div>
        )}

        {/* Error Stage */}
        {stage === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center max-w-md">
              <p className="text-sm font-medium text-destructive mb-2">生成失败</p>
              <p className="text-xs text-muted-foreground">{errorMessage || '请重试'}</p>
            </div>
            <Button variant="outline" onClick={() => { setStage('config'); setErrorMessage(''); }}>返回</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <PPTImagePreviewDialog
      open={imagePreviewOpen}
      onOpenChange={setImagePreviewOpen}
      scope={scope}
      workstationIds={scopedSelection.workstations.map(workstation => workstation.id)}
      moduleIds={scopedSelection.modules.map(module => module.id)}
      productAssets={scopedWorkstationProducts}
      productMedia={scopedProductMedia}
      annotations={scopedAnnotations}
    />
    </>
  );
}
