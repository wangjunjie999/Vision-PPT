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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generatePPTX } from '@/services/pptxGenerator';
import { toast } from 'sonner';
import { useCameras, useLenses, useLights, useControllers } from '@/hooks/useHardware';
import { checkPPTReadiness } from '@/services/pptReadiness';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type GenerationScope = 'full' | 'workstations' | 'modules';
type OutputLanguage = 'zh' | 'en';
type ImageQuality = 'standard' | 'high' | 'ultra';
type GenerationMode = 'draft' | 'final';

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

  // Fetch hardware data
  const { cameras } = useCameras();
  const { lenses } = useLenses();
  const { lights } = useLights();
  const { controllers } = useControllers();
  
  // State for annotations
  const [annotations, setAnnotations] = useState<any[]>([]);

  const [stage, setStage] = useState<'config' | 'generating' | 'complete' | 'error'>('config');
  const [mode, setMode] = useState<GenerationMode>('draft');
  const [scope, setScope] = useState<GenerationScope>('full');
  const [selectedWorkstations, setSelectedWorkstations] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [language, setLanguage] = useState<OutputLanguage>('zh');
  const [quality, setQuality] = useState<ImageQuality>(pptImageQuality);
  
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
    hardwareList: 0
  });
  const generatedBlobRef = useRef<Blob | null>(null);
  const [checkPanelOpen, setCheckPanelOpen] = useState(true);

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
    let layoutCount = 0;

    if (scope === 'full') {
      projectWorkstations.forEach(ws => {
        wsCount++;
        const wsLayout = allLayouts.find(l => l.workstation_id === ws.id);
        if (wsLayout?.front_view_saved && wsLayout?.side_view_saved && wsLayout?.top_view_saved) {
          layoutCount += 3;
        }
        const wsMods = getWorkstationModules(ws.id);
        modCount += wsMods.length;
      });
    } else if (scope === 'workstations') {
      selectedWorkstations.forEach(wsId => {
        const ws = allWorkstations.find(w => w.id === wsId);
        if (ws) {
          wsCount++;
          const wsLayout = allLayouts.find(l => l.workstation_id === wsId);
          if (wsLayout?.front_view_saved && wsLayout?.side_view_saved && wsLayout?.top_view_saved) {
            layoutCount += 3;
          }
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

    return { wsCount, modCount, layoutCount };
  }, [scope, selectedWorkstations, selectedModules, projectWorkstations, allLayouts, allModules, allWorkstations, getWorkstationModules]);

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
  
  // Fetch annotations when dialog opens
  useEffect(() => {
    if (open && user?.id && selectedProjectId) {
      const fetchAnnotations = async () => {
        const wsIds = projectWorkstations.map(ws => ws.id);
        const modIds: string[] = [];
        projectWorkstations.forEach(ws => {
          getWorkstationModules(ws.id).forEach(m => modIds.push(m.id));
        });
        
        // Get product assets with annotations
        const { data: assets } = await supabase
          .from('product_assets')
          .select('id, workstation_id, module_id, scope_type')
          .eq('user_id', user.id)
          .or(`workstation_id.in.(${wsIds.join(',')}),module_id.in.(${modIds.join(',')})`);
        
        if (assets && assets.length > 0) {
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
        }
      };
      fetchAnnotations();
    }
  }, [open, user?.id, selectedProjectId, projectWorkstations, getWorkstationModules]);

  const addLog = (type: GenerationLog['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };

  const handleGenerate = async () => {
    if (!project) return;
    
    setIsGenerating(true);
    setStage('generating');
    setLogs([]);
    setProgress(0);

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

      // Prepare data for generator - cast to any to access extended properties
      const proj = project as any;
      const projectData = {
        id: proj.id,
        code: proj.code,
        name: proj.name,
        customer: proj.customer,
        date: proj.date,
        responsible: proj.responsible,
        product_process: proj.product_process,
        quality_strategy: proj.quality_strategy,
        environment: proj.environment,
        notes: proj.notes,
      };

      const workstationData = wsToProcess.map(ws => {
        const wsData = ws as any;
        return {
          id: wsData.id,
          code: wsData.code,
          name: wsData.name,
          type: wsData.type,
          cycle_time: wsData.cycle_time,
          product_dimensions: wsData.product_dimensions as { length: number; width: number; height: number } | null,
          enclosed: wsData.enclosed,
        };
      });

      const layoutData = layoutsToProcess.map(l => {
        const layoutItem = l as any;
        return {
          workstation_id: layoutItem.workstation_id,
          conveyor_type: layoutItem.conveyor_type,
          camera_count: layoutItem.camera_count,
          lens_count: layoutItem.lens_count ?? 1,
          light_count: layoutItem.light_count ?? 1,
          camera_mounts: layoutItem.camera_mounts,
          mechanisms: layoutItem.mechanisms,
          front_view_saved: layoutItem.front_view_saved,
          side_view_saved: layoutItem.side_view_saved,
          top_view_saved: layoutItem.top_view_saved,
          front_view_url: layoutItem.front_view_url || null,
          side_view_url: layoutItem.side_view_url || null,
          top_view_url: layoutItem.top_view_url || null,
          selected_cameras: layoutItem.selected_cameras || null,
          selected_lenses: layoutItem.selected_lenses || null,
          selected_lights: layoutItem.selected_lights || null,
          selected_controller: layoutItem.selected_controller || null,
        };
      });

      const moduleData = modsToProcess.map(m => {
        const modItem = m as any;
        return {
          id: modItem.id,
          name: modItem.name,
          type: modItem.type,
          description: modItem.description,
          workstation_id: modItem.workstation_id,
          trigger_type: modItem.trigger_type,
          roi_strategy: modItem.roi_strategy,
          processing_time_limit: modItem.processing_time_limit,
          output_types: modItem.output_types,
          selected_camera: modItem.selected_camera,
          selected_lens: modItem.selected_lens,
          selected_light: modItem.selected_light,
          selected_controller: modItem.selected_controller,
          schematic_image_url: modItem.schematic_image_url || null,
          positioning_config: modItem.positioning_config as Record<string, unknown> | null,
          defect_config: modItem.defect_config as Record<string, unknown> | null,
          ocr_config: modItem.ocr_config as Record<string, unknown> | null,
          deep_learning_config: modItem.deep_learning_config as Record<string, unknown> | null,
          measurement_config: modItem.measurement_config as Record<string, unknown> | null,
        };
      });

      // Prepare hardware data
      const hardwareData = {
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
          gpu: c.gpu,
          memory: c.memory,
          storage: c.storage,
          performance: c.performance,
          image_url: c.image_url,
        })),
      };

      // Generate PPTX with annotations
      const blob = await generatePPTX(
        projectData,
        workstationData,
        layoutData,
        moduleData,
        { language, quality, mode },
        (prog, step, log) => {
          setProgress(prog);
          setCurrentStep(step);
          addLog('info', log);
        },
        hardwareData,
        readinessResult,
        annotations
      );

      generatedBlobRef.current = blob;

      // Set result
      setGenerationResult({
        pageCount: 2 + wsToProcess.length + modsToProcess.length + 2,
        layoutImages: wsToProcess.length * 3,
        parameterTables: wsToProcess.length + modsToProcess.length,
        hardwareList: 1
      });

      addLog('success', `成功生成PPT文件`);
      setStage('complete');
      setIsGenerating(false);
      toast.success('PPT生成完成');
    } catch (error) {
      console.error('PPT generation failed:', error);
      addLog('error', `生成失败: ${error}`);
      setStage('error');
      setIsGenerating(false);
      toast.error('PPT生成失败');
    }
  };

  const handleDownload = () => {
    if (!generatedBlobRef.current || !project) return;
    
    const url = URL.createObjectURL(generatedBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.code}_${project.name}_方案.pptx`;
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
          <div className="flex flex-col gap-4 overflow-hidden flex-1">
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
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Layout className="h-4 w-4 text-primary" />
                    <span className="text-lg font-bold">{generationPreview.layoutCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">布局图</p>
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
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">{currentStep}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>生成进度</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Log Output */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium border-b">生成日志</div>
              <ScrollArea className="h-40">
                <div className="p-2 font-mono text-xs space-y-1">
                  {logs.map((log, idx) => (
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
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Complete Stage */}
        {stage === 'complete' && (
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="w-16 h-16 rounded-full bg-chart-2/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-chart-2" />
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold">PPT生成完成</h3>
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
                下载PPTX文件
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
            <p className="text-sm text-destructive">生成失败，请重试</p>
            <Button variant="outline" onClick={() => setStage('config')}>返回</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
