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
import { useData } from '@/contexts/DataContext';
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
import { generateFromUserTemplate, downloadGeneratedFile } from '@/services/templateBasedGenerator';
import { extractTemplateStyles, convertStylesToGeneratorFormat } from '@/services/templateStyleExtractor';
import { generateDOCX } from '@/services/docxGenerator';
import { generatePDF } from '@/services/pdfGenerator';
import { toast } from 'sonner';
import { useCameras, useLenses, useLights, useControllers } from '@/hooks/useHardware';
import { checkPPTReadiness } from '@/services/pptReadiness';
import { ChevronDown, ChevronUp, ExternalLink, ImageOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

type GenerationScope = 'full' | 'workstations' | 'modules';
type OutputLanguage = 'zh' | 'en';
type ImageQuality = 'standard' | 'high' | 'ultra';
type GenerationMode = 'draft' | 'final';
type GenerationMethod = 'template' | 'scratch'; // 基于用户上传的PPTX模板 or 从零生成（使用pptxgenjs）
type OutputFormat = 'ppt' | 'word' | 'pdf'; // PPT, Word, or PDF document

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
  
  // State for annotations and product assets
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [productAssets, setProductAssets] = useState<any[]>([]);

  const [stage, setStage] = useState<'config' | 'generating' | 'complete' | 'error'>('config');
  const [mode, setMode] = useState<GenerationMode>('draft');
  const [scope, setScope] = useState<GenerationScope>('full');
  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
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
  const [checkPanelOpen, setCheckPanelOpen] = useState(true);
  // 默认使用"从零生成"，因为模板生成需要Edge Function支持
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('scratch');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('ppt'); // 输出格式
  
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
  const projectWorkstations = selectedProjectId ? getProjectWorkstations(selectedProjectId) : [];

  // Check generation readiness using pptReadiness service
  const readinessResult = useMemo(() => {
    return checkPPTReadiness({
      projects,
      workstations: allWorkstations,
      layouts: allLayouts,
      modules: allModules,
      selectedProjectId,
    });
  }, [projects, allWorkstations, allLayouts, allModules, selectedProjectId]);

  const { draftReady, finalReady, missing, warnings } = readinessResult;

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
    let wsCount = 0;
    let modCount = 0;

    if (scope === 'full') {
      projectWorkstations.forEach(ws => {
        wsCount++;
        const wsMods = getWorkstationModules(ws.id);
        modCount += wsMods.length;
      });
    } else if (scope === 'workstations') {
      selectedWorkstations.forEach(wsId => {
        const ws = allWorkstations.find(w => w.id === wsId);
        if (ws) {
          wsCount++;
          const wsMods = getWorkstationModules(wsId);
          modCount += wsMods.length;
        }
      });
    } else {
      selectedModules.forEach(modId => {
        const mod = allModules.find(m => m.id === modId);
        if (mod) {
          modCount++;
        }
      });
    }

    return { wsCount, modCount };
  }, [scope, selectedWorkstations, selectedModules, projectWorkstations, allModules, allWorkstations, getWorkstationModules]);

  useEffect(() => {
    if (!open) {
      setStage('config');
      setLogs([]);
      setCurrentStep('');
      setProgress(0);
      generatedBlobRef.current = null;
    }
  }, [open]);

  // Initialize selected items when project/dialog changes
  useEffect(() => {
    if (selectedProjectId && open) {
      const wsIds = projectWorkstations.map(ws => ws.id);
      setSelectedWorkstations(wsIds);
      
      const modIds: string[] = [];
      projectWorkstations.forEach(ws => {
        getWorkstationModules(ws.id).forEach(m => modIds.push(m.id));
      });
      setSelectedModules(modIds);
    }
  }, [selectedProjectId, open, projectWorkstations, getWorkstationModules]);
  
  // Fetch annotations and product assets when dialog opens
  useEffect(() => {
    if (open && user?.id && selectedProjectId) {
      const fetchAnnotationsAndAssets = async () => {
        const wsIds = projectWorkstations.map(ws => ws.id);
        const modIds: string[] = [];
        projectWorkstations.forEach(ws => {
          getWorkstationModules(ws.id).forEach(m => modIds.push(m.id));
        });
        
        if (wsIds.length === 0) return;
        
        // Get product assets with all fields including new detection info
        const { data: assets } = await supabase
          .from('product_assets')
          .select('id, workstation_id, module_id, scope_type, model_file_url, preview_images, detection_method, product_models, detection_requirements')
          .eq('user_id', user.id)
          .or(`workstation_id.in.(${wsIds.join(',')}),module_id.in.(${modIds.join(',')})`);
        
        if (assets && assets.length > 0) {
          // Store product assets for PPT generation
          const mappedAssets = assets.map(asset => ({
            id: asset.id,
            workstation_id: asset.workstation_id,
            module_id: asset.module_id,
            scope_type: asset.scope_type as 'workstation' | 'module',
            model_file_url: asset.model_file_url,
            preview_images: Array.isArray(asset.preview_images) 
              ? (asset.preview_images as string[]).map(url => ({ url, name: '' }))
              : [],
            detection_method: asset.detection_method,
            product_models: Array.isArray(asset.product_models) ? asset.product_models : [],
            detection_requirements: Array.isArray(asset.detection_requirements) ? asset.detection_requirements : [],
          }));
          setProductAssets(mappedAssets);
          
          const assetIds = assets.map(a => a.id);
          const { data: annotationsData } = await supabase
            .from('product_annotations')
            .select('*')
            .eq('user_id', user.id)
            .in('asset_id', assetIds);
          
          if (annotationsData) {
            // Map annotations with scope info
            const mappedAnnotations = annotationsData.map(ann => {
              const asset = assets.find(a => a.id === ann.asset_id);
              return {
                ...ann,
                scope_type: asset?.scope_type || 'workstation',
                workstation_id: asset?.workstation_id,
                module_id: asset?.module_id,
              };
            });
            setAnnotations(mappedAnnotations);
          }
        } else {
          setProductAssets([]);
          setAnnotations([]);
        }
      };
      fetchAnnotationsAndAssets();
    }
  }, [open, user?.id, selectedProjectId, projectWorkstations, getWorkstationModules]);

  const addLog = (type: GenerationLog['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };

  // 检查选中的模板是否有PPTX文件
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;
  const templateHasFile = selectedTemplate?.file_url ? true : false;

  // 图片可访问性预检查
  const handleImagePreCheck = async () => {
    if (!project) return;
    
    setIsCheckingImages(true);
    try {
      const wsToCheck = scope === 'full' 
        ? projectWorkstations 
        : allWorkstations.filter(ws => selectedWorkstations.includes(ws.id));
      
      const modsToCheck = scope === 'modules' 
        ? allModules.filter(m => selectedModules.includes(m.id))
        : allModules.filter(m => wsToCheck.some(ws => ws.id === m.workstation_id));
      
      const layoutsToCheck = allLayouts.filter(l => 
        wsToCheck.some(ws => ws.id === l.workstation_id)
      );

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
        annotations.map(a => ({ snapshot_url: a.snapshot_url })),
        productAssets.map(a => ({ preview_images: a.preview_images }))
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
        toast.success(`✅ 所有 ${result.totalChecked} 张图片均可访问`);
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
    if (!project) return;
    
    const wsToCheck = scope === 'full' 
      ? projectWorkstations 
      : allWorkstations.filter(ws => selectedWorkstations.includes(ws.id));
    
    const modsToCheck = scope === 'modules' 
      ? allModules.filter(m => selectedModules.includes(m.id))
      : allModules.filter(m => wsToCheck.some(ws => ws.id === m.workstation_id));
    
    const layoutsToCheck = allLayouts.filter(l => 
      wsToCheck.some(ws => ws.id === l.workstation_id)
    );

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
      toast.success(`✅ 成功缓存 ${result.success} 张图片`);
    } else {
      toast.warning(`缓存完成: ${result.success} 成功, ${result.failed} 失败`);
    }
  };

  const handleGenerate = async () => {
    if (!project) return;
    
    setIsGenerating(true);
    setStage('generating');
    setLogs([]);
    setProgress(0);
    // 重置详细进度追踪状态
    setCurrentWorkstation('');
    setCurrentSlideInfo('');
    setWorkstationProgress({ current: 0, total: projectWorkstations.length });
    
    // 重置失败URL缓存，允许重新尝试加载
    resetFailedUrlsCache();

    try {
      // Determine which workstations and modules to include
      const wsToProcess = scope === 'full' 
        ? projectWorkstations 
        : scope === 'workstations' 
          ? allWorkstations.filter(ws => selectedWorkstations.includes(ws.id))
          : [];

      const modsToProcess = scope === 'modules' 
        ? allModules.filter(m => selectedModules.includes(m.id))
        : scope === 'full'
          ? allModules.filter(m => projectWorkstations.some(ws => ws.id === m.workstation_id))
          : allModules.filter(m => selectedWorkstations.includes(m.workstation_id));

      const layoutsToProcess = allLayouts.filter(l => 
        wsToProcess.some(ws => ws.id === l.workstation_id)
      );

      // ===================== 使用统一数据构建器 =====================
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
      const productAssetInputs: ProductAssetInput[] = productAssets.map(a => ({
        id: a.id,
        workstation_id: a.workstation_id,
        module_id: a.module_id,
        scope_type: a.scope_type,
        model_file_url: a.model_file_url,
        preview_images: a.preview_images,
        detection_method: a.detection_method,
        product_models: a.product_models,
        detection_requirements: a.detection_requirements,
      }));

      // Prepare annotation inputs
      const annotationInputs: AnnotationInput[] = annotations.map(a => ({
        id: a.id,
        asset_id: a.asset_id,
        snapshot_url: a.snapshot_url,
        remark: a.remark,
        annotations_json: a.annotations_json,
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
        selected_cameras: l.selected_cameras?.map(c => ({
          id: c.id,
          brand: c.brand,
          model: c.model,
          image_url: c.image_url,
        })) ?? null,
        selected_lenses: l.selected_lenses?.map(lens => ({
          id: lens.id,
          brand: lens.brand,
          model: lens.model,
          image_url: lens.image_url,
        })) ?? null,
        selected_lights: l.selected_lights?.map(light => ({
          id: light.id,
          brand: light.brand,
          model: light.model,
          image_url: light.image_url,
        })) ?? null,
        selected_controller: l.selected_controller ? {
          id: l.selected_controller.id,
          brand: l.selected_controller.brand,
          model: l.selected_controller.model,
          image_url: l.selected_controller.image_url,
        } : null,
        front_view_image_url: l.front_view_image_url,
        side_view_image_url: l.side_view_image_url,
        top_view_image_url: l.top_view_image_url,
        width: l.width,
        height: l.height,
        depth: l.depth,
        extra_fields: l.extra_fields,
      }));

      const moduleData = reportData.modules.map(m => ({
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
        extra_fields: m.extra_fields,
      }));

      const hardwareData = hardwareLibrary;

      // ==================== 根据输出格式选择不同的生成逻辑 ====================
      
      // Prepare product assets and annotations for generator
      const productAssetData = productAssets.map(a => ({
        id: a.id,
        workstation_id: a.workstation_id,
        module_id: a.module_id,
        scope_type: a.scope_type as 'workstation' | 'module',
        preview_images: a.preview_images || [],
        model_file_url: a.model_file_url,
      }));

      const annotationData = annotations.map(a => ({
        id: a.id,
        asset_id: a.asset_id,
        snapshot_url: a.snapshot_url,
        remark: a.remark,
        annotations_json: a.annotations_json,
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
          };
        });

        const blob = await generateDOCX(
          projectData,
          workstationData,
          layoutDataWithImages,
          moduleData,
          hardwareData,
          { language, includeImages: true },
          (prog, step, log) => {
            setProgress(prog);
            setCurrentStep(step);
            if (log) addLog('info', log);
          },
          productAssetData,
          annotationData
        );

        generatedBlobRef.current = blob;

        // Count images included
        const imageCount = productAssetData.reduce((acc, a) => acc + (a.preview_images?.length || 0), 0) + annotationData.length;

        setGenerationResult({
          pageCount: 1,
          layoutImages: imageCount,
          parameterTables: wsToProcess.length + modsToProcess.length,
          hardwareList: 1,
          fileUrl: '',
        });

        addLog('success', `Word文档生成完成，包含 ${imageCount} 张图片`);
        setStage('complete');
        setIsGenerating(false);
        toast.success('Word文档生成完成');
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
          const selectedCameras = layoutItem.selected_cameras?.map((c: any) => {
            if (!c) return null;
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
          }).filter(Boolean) || null;

          // 处理选用镜头
          const selectedLenses = layoutItem.selected_lenses?.map((l: any) => {
            if (!l) return null;
            const fullLens = lenses.find(lens => lens.id === l.id);
            return {
              id: l.id,
              brand: l.brand || fullLens?.brand || '',
              model: l.model || fullLens?.model || '',
              image_url: l.image_url || fullLens?.image_url || null,
              focal_length: l.focal_length || fullLens?.focal_length || '',
              aperture: l.aperture || fullLens?.aperture || '',
              mount: l.mount || fullLens?.mount || '',
            };
          }).filter(Boolean) || null;

          // 处理选用光源
          const selectedLights = layoutItem.selected_lights?.map((lt: any) => {
            if (!lt) return null;
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
          }).filter(Boolean) || null;

          // 处理选用控制器
          let selectedController = null;
          if (layoutItem.selected_controller) {
            const c = layoutItem.selected_controller;
            const fullCtrl = controllers.find(ctrl => ctrl.id === c.id);
            selectedController = {
              id: c.id,
              brand: c.brand || fullCtrl?.brand || '',
              model: c.model || fullCtrl?.model || '',
              image_url: c.image_url || fullCtrl?.image_url || null,
              cpu: c.cpu || fullCtrl?.cpu || '',
              gpu: c.gpu || fullCtrl?.gpu || null,
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
          };
        });

        const blob = await generatePDF(
          projectData,
          workstationData,
          layoutDataWithImages,
          moduleData,
          hardwareData,
          { language, includeImages: true },
          (prog, step, log) => {
            setProgress(prog);
            setCurrentStep(step);
            if (log) addLog('info', log);
          },
          productAssetData,
          annotationData
        );

        generatedBlobRef.current = blob;

        // Count images included
        const imageCount = productAssetData.reduce((acc, a) => acc + (a.preview_images?.length || 0), 0) + annotationData.length;

        setGenerationResult({
          pageCount: Math.ceil((wsToProcess.length + 3) * 1.5), // Estimate
          layoutImages: imageCount,
          parameterTables: wsToProcess.length + modsToProcess.length,
          hardwareList: 1,
          fileUrl: '',
        });

        addLog('success', `PDF文档生成完成，包含 ${imageCount} 张图片`);
        setStage('complete');
        setIsGenerating(false);
        toast.success('PDF文档生成完成');
        return;
      }
      
      // PPT生成逻辑
      if (generationMethod === 'template' && selectedTemplate?.file_url) {
        // 基于用户上传的PPTX模板生成
        addLog('info', '使用用户上传的PPTX模板生成...');
        setProgress(10);
        setCurrentStep('调用模板生成服务');

        const result = await generateFromUserTemplate({
          templateId: selectedTemplateId,
          data: {
            project: projectData,
            workstations: workstationData,
            modules: moduleData,
            hardware: hardwareData,
            language,
          },
          outputFileName: `${projectData.code}_${projectData.name}_方案.pptx`,
          onProgress: (msg) => {
            addLog('info', msg);
          },
        });

        if (result.success && result.fileUrl) {
          addLog('success', `成功生成PPT: ${result.slideCount} 页`);
          
          // 设置结果并允许下载
          setGenerationResult({
            pageCount: result.slideCount || 0,
            layoutImages: 0,
            parameterTables: 0,
            hardwareList: 0,
            fileUrl: result.fileUrl,
          });

          // 下载文件
          generatedBlobRef.current = null; // 模板方法不使用blob
          setProgress(100);
          setStage('complete');
          setIsGenerating(false);
          toast.success('PPT生成完成');
        } else {
          throw new Error(result.error || '模板生成失败');
        }
      } else {
        // 从零生成（使用pptxgenjs）
        addLog('info', '使用内置生成器从零创建PPT...');

        // 如果选择了模板，先提取其样式
        let extractedStyles = null;
        if (selectedTemplate?.file_url) {
          addLog('info', '正在从模板提取样式...');
          setProgress(8);
          setCurrentStep('提取模板样式');
          
          const styleResult = await extractTemplateStyles({
            templateId: selectedTemplate.id,
            onProgress: (msg) => addLog('info', msg),
          });
          
          if (styleResult.success && styleResult.styles) {
            extractedStyles = convertStylesToGeneratorFormat(styleResult.styles);
            addLog('success', `成功提取模板样式: ${styleResult.styles.masterCount} 个母版, ${styleResult.styles.layoutCount} 个布局`);
          } else {
            addLog('warning', `模板样式提取失败，将使用默认样式: ${styleResult.error || '未知错误'}`);
          }
        }

        setProgress(10);
        setCurrentStep('生成PPT内容');

        const blob = await generatePPTX(
          projectData,
          workstationData,
          layoutData,
          moduleData,
          { 
            language, 
            quality, 
            mode,
            template: selectedTemplate ? {
              id: selectedTemplate.id,
              name: selectedTemplate.name,
              file_url: selectedTemplate.file_url,
              background_image_url: selectedTemplate.background_image_url,
            } : null,
            // 传入提取的样式
            extractedStyles: extractedStyles,
          },
          (prog, step, log) => {
            // Adjust progress to start from 10%
            setProgress(10 + prog * 0.9);
            setCurrentStep(step);
            
            // 解析详细日志以提取工位和页面信息
            // 格式: [WORKSTATION:名称:当前/总数] 或 [SLIDE:工位名:页码/总页]
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
          annotations,
          productAssets
        );

        generatedBlobRef.current = blob;

        // Set result
        setGenerationResult({
          pageCount: 2 + wsToProcess.length + modsToProcess.length + 2,
          layoutImages: wsToProcess.length * 3,
          parameterTables: wsToProcess.length + modsToProcess.length,
          hardwareList: 1,
          fileUrl: '',
        });

        addLog('success', `成功生成PPT文件`);
        setStage('complete');
        setIsGenerating(false);
        toast.success('PPT生成完成');
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
    
    // 否则使用blob下载（从零生成 或 Word/PDF文档）
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            生成PPT方案文档
          </DialogTitle>
        </DialogHeader>

        {/* Config Stage */}
        {stage === 'config' && (
          <div className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1">
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
                    <div className="text-xs text-muted-foreground">纯文本+表格</div>
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

            {/* Template Selection - only for PPT */}
            {outputFormat === 'ppt' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <FileStack className="h-4 w-4" />
                  选择PPT母版
                </Label>
                <Select 
                  value={selectedTemplateId} 
                  onValueChange={setSelectedTemplateId}
                  disabled={templatesLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={templatesLoading ? "加载中..." : "选择模板"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        暂无模板，请在管理中心添加
                      </div>
                    ) : (
                      templates.filter(t => t.enabled !== false).map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <span>{template.name}</span>
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">默认</Badge>
                            )}
                            {template.scope && (
                              <Badge variant="outline" className="text-xs">{template.scope}</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedTemplateId && templates.find(t => t.id === selectedTemplateId)?.description && (
                  <p className="text-xs text-muted-foreground">
                    {templates.find(t => t.id === selectedTemplateId)?.description}
                  </p>
                )}
              </div>
            )}

            {/* 从零生成提示信息 - 仅当选择了模板文件时显示 */}
            {outputFormat === 'ppt' && selectedTemplate?.file_url && (
              <p className="text-xs text-primary flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                将提取 "{selectedTemplate?.name}" 的样式并应用到生成的PPT
              </p>
            )}

            {/* Delivery Check Panel */}
            {(missing.length > 0 || warnings.length > 0) && (
              <Collapsible open={checkPanelOpen} onOpenChange={setCheckPanelOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={cn(
                        "h-4 w-4",
                        mode === 'final' && !finalReady ? "text-destructive" : "text-warning"
                      )} />
                      <span className="text-sm font-medium">
                        交付检查 ({missing.length} 项缺失, {warnings.length} 项警告)
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
                            {mode === 'final' ? '交付版需要补齐所有缺失项' : '草案版将使用占位图'}
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
                                  <li key={i}>• {m}</li>
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
                  {warnings.length > 0 && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-warning">警告项（建议补齐）</p>
                          <p className="text-xs text-warning/70 mt-0.5">不影响生成，但建议完善</p>
                        </div>
                      </div>
                      <div className="space-y-2 mt-3">
                        {warnings.map((item, idx) => (
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
                    disabled={isCachingImages || isCheckingImages}
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
                    disabled={isCheckingImages || isCachingImages}
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
                      : `✅ 所有 ${imageCheckResult.totalChecked} 张图片均可访问`
                    }
                  </div>
                  {imageCheckResult.failed > 0 && (
                    <div className="text-xs space-y-1 mt-2">
                      {imageCheckResult.failedByType.three_view && (
                        <div>• 三视图: {imageCheckResult.failedByType.three_view} 张</div>
                      )}
                      {imageCheckResult.failedByType.schematic && (
                        <div>• 视觉系统示意图: {imageCheckResult.failedByType.schematic} 张</div>
                      )}
                      {imageCheckResult.failedByType.hardware && (
                        <div>• 硬件图片: {imageCheckResult.failedByType.hardware} 张</div>
                      )}
                      {imageCheckResult.failedByType.product && (
                        <div>• 产品图片: {imageCheckResult.failedByType.product} 张</div>
                      )}
                      {imageCheckResult.failedByType.annotation && (
                        <div>• 标注截图: {imageCheckResult.failedByType.annotation} 张</div>
                      )}
                      <p className="mt-2 text-muted-foreground">
                        提示: 点击"下载到本地"可将图片缓存到浏览器，确保离线/本地部署时可用。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Generation Scope */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">生成范围</Label>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as GenerationScope)} className="grid grid-cols-3 gap-2">
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
              <div className="border rounded-lg overflow-hidden flex-1 min-h-0">
                <ScrollArea className="h-40">
                  <div className="p-2 space-y-1">
                    {scope === 'workstations' && projectWorkstations.map(ws => (
                      <label key={ws.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox 
                          checked={selectedWorkstations.includes(ws.id)} 
                          onCheckedChange={() => toggleWorkstation(ws.id)} 
                        />
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1">{ws.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {getWorkstationModules(ws.id).length} 模块
                        </Badge>
                      </label>
                    ))}
                    {scope === 'modules' && projectWorkstations.map(ws => (
                      <div key={ws.id}>
                        <div className="text-xs text-muted-foreground px-2 py-1 font-medium">{ws.name}</div>
                        {getWorkstationModules(ws.id).map(mod => (
                          <label key={mod.id} className="flex items-center gap-2 p-2 pl-6 rounded hover:bg-muted cursor-pointer">
                            <Checkbox 
                              checked={selectedModules.includes(mod.id)} 
                              onCheckedChange={() => toggleModule(mod.id)} 
                            />
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm flex-1">{mod.name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Options Row */}
            <div className="grid grid-cols-2 gap-4">
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

            <Separator />

            {/* Generation Preview */}
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-medium mb-2">生成预览</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Table className="h-4 w-4 text-chart-3" />
                    <span className="text-lg font-bold">{generationPreview.wsCount + generationPreview.modCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">参数表</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Table className="h-4 w-4 text-chart-3" />
                    <span className="text-lg font-bold">{generationPreview.wsCount + generationPreview.modCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">参数表</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Camera className="h-4 w-4 text-chart-4" />
                    <span className="text-lg font-bold">1</span>
                  </div>
                  <p className="text-xs text-muted-foreground">硬件清单</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button 
                onClick={handleGenerate} 
                disabled={
                  !draftReady || 
                  (mode === 'final' && !finalReady) ||
                  isGenerating
                }
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
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
                
                {/* 工位内部进度条 */}
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
                  <span className="font-medium">{generationResult.parameterTables} 个</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Camera className="h-4 w-4 text-chart-4" />
                  <span>硬件清单:</span>
                  <span className="font-medium">{generationResult.hardwareList} 份</span>
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
  );
}
