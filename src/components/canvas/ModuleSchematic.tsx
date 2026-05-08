import { useData } from '@/contexts/DataContext';
import { useAppStore } from '@/store/useAppStore';
import { useCameras, useLights, useLenses, useControllers } from '@/hooks/useHardware';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Save,
  AlertCircle,
  Crosshair,
  ScanLine,
  Type,
  Brain,
  Box,
  Download,
  FileImage,
  FileText,
  Loader2,
  CheckCircle2,
  Camera
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { VisionSystemDiagram } from './VisionSystemDiagram';
import { LightingPhotosPanel } from './LightingPhotosPanel';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { getImageSaveErrorMessage } from '@/utils/errorMessages';
import { generateSchematicImage } from '@/services/batchImageSaver';

const moduleTypeIcons = {
  positioning: Crosshair,
  defect: ScanLine,
  ocr: Type,
  deeplearning: Brain,
};

const moduleTypeLabels = {
  positioning: '引导定位',
  defect: '缺陷检测',
  ocr: 'OCR识别',
  deeplearning: '深度学习',
};

export function ModuleSchematic() {
  const { 
    selectedModuleId, 
    selectedWorkstationId,
    modules, 
    workstations, 
    layouts,
    updateModule,
    selectModule
  } = useData();

  const { cameras } = useCameras();
  const { lights } = useLights();
  const { lenses } = useLenses();
  const { controllers } = useControllers();
  const { getPixelRatio } = useAppStore();
  const diagramRef = useRef<HTMLDivElement>(null);
  const exportDiagramRef = useRef<HTMLDivElement>(null);
  
  const [fovAngle, setFovAngle] = useState(45);
  const [lightDistance, setLightDistance] = useState(335);
  const [savingSchematic, setSavingSchematic] = useState(false);
  const [schematicSaved, setSchematicSaved] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Schematic layout (camera/light position + rotation) — persisted to module.schematic_layout
  const [cameraPos, setCameraPos] = useState({ x: 275, y: 77 });
  const [lightPos, setLightPos] = useState({ x: 275, y: 231 });
  const [cameraRotation, setCameraRotation] = useState(0);
  const [lightRotation, setLightRotation] = useState(0);

  // Resolve function ref for async capture flow
  const captureResolveRef = useRef<((dataUrl: string) => void) | null>(null);
  const captureRejectRef = useRef<((err: Error) => void) | null>(null);

  // Shared off-screen capture — renders interactive=false diagram, then captures
  const captureOffscreen = useCallback(async (): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      captureResolveRef.current = resolve;
      captureRejectRef.current = reject;
      setIsCapturing(true);
    });
  }, []);

  // Effect: when isCapturing becomes true and exportDiagramRef is ready, do capture
  const handleExportReady = useCallback(async () => {
    if (!isCapturing || !exportDiagramRef.current) return;
    const el = exportDiagramRef.current.querySelector('.vision-diagram-container') as HTMLElement;
    if (!el) {
      captureRejectRef.current?.(new Error('Export diagram not found'));
      setIsCapturing(false);
      return;
    }
    try {
      const blob = await generateSchematicImage(el);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      captureResolveRef.current?.(dataUrl);
    } catch (err) {
      captureRejectRef.current?.(err as Error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  // Trigger capture when exportDiagramRef mounts
  useEffect(() => {
    if (isCapturing) {
      // Wait for React to render the off-screen diagram
      requestAnimationFrame(() => requestAnimationFrame(() => handleExportReady()));
    }
  }, [isCapturing, handleExportReady]);
  
  const module = modules.find(m => m.id === selectedModuleId) as any;
  const workstation = workstations.find(w => w.id === selectedWorkstationId) as any;
  const layout = layouts.find(l => l.workstation_id === selectedWorkstationId) as any;

  // Load saved schematic layout when module changes
  useEffect(() => {
    if (!module) return;
    const saved = module.schematic_layout;
    if (saved && typeof saved === 'object') {
      if (saved.camera) setCameraPos({ x: saved.camera.x ?? 275, y: saved.camera.y ?? 77 });
      if (saved.light) setLightPos({ x: saved.light.x ?? 275, y: saved.light.y ?? 231 });
      if (typeof saved.cameraRotation === 'number') setCameraRotation(saved.cameraRotation);
      if (typeof saved.lightRotation === 'number') setLightRotation(saved.lightRotation);
      if (typeof saved.fovAngle === 'number') setFovAngle(saved.fovAngle);
      if (typeof saved.lightDistance === 'number') setLightDistance(saved.lightDistance);
    } else {
      setCameraPos({ x: 275, y: 77 });
      setLightPos({ x: 275, y: 231 });
      setCameraRotation(0);
      setLightRotation(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module?.id]);

  // Reset saved state whenever any visual input changes — so the button
  // accurately reflects "needs re-save" after the user moves/rotates anything.
  useEffect(() => {
    setSchematicSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cameraPos.x, cameraPos.y, lightPos.x, lightPos.y,
    cameraRotation, lightRotation,
    fovAngle, lightDistance,
    module?.selected_camera, module?.selected_lens, module?.selected_light, module?.selected_controller,
  ]);

  // Reset saved indicator when switching modules
  useEffect(() => {
    setSchematicSaved(false);
    setLastSavedAt(null);
  }, [module?.id]);

  // Debounced persistence of layout changes
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!module) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      updateModule(module.id, {
        schematic_layout: {
          camera: cameraPos,
          light: lightPos,
          cameraRotation,
          lightRotation,
          fovAngle,
          lightDistance,
        },
      } as any).catch((err) => console.warn('Failed to persist schematic layout:', err));
    }, 600);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPos.x, cameraPos.y, lightPos.x, lightPos.y, cameraRotation, lightRotation, fovAngle, lightDistance, module?.id]);

  // All hooks must be above early returns
  const handleCameraSelect = useCallback((cameraId: string) => {
    if (!module) return;
    updateModule(module.id, { camera_id: cameraId } as any);
    toast.success('相机已更新');
  }, [module?.id, updateModule]);

  const handleLensSelect = useCallback((lensId: string) => {
    if (!module) return;
    updateModule(module.id, { lens_id: lensId } as any);
    toast.success('镜头已更新');
  }, [module?.id, updateModule]);

  const handleLightSelect = useCallback((lightId: string) => {
    if (!module) return;
    updateModule(module.id, { light_id: lightId } as any);
    toast.success('光源已更新');
  }, [module?.id, updateModule]);

  const handleControllerSelect = useCallback((controllerId: string) => {
    if (!module) return;
    updateModule(module.id, { controller_id: controllerId } as any);
    toast.success('工控机已更新');
  }, [module?.id, updateModule]);

  const handleFovAngleChange = useCallback((angle: number) => {
    setFovAngle(Math.max(10, Math.min(120, angle)));
  }, []);

  const handleLightDistanceChange = useCallback((distance: number) => {
    setLightDistance(Math.max(50, Math.min(1000, distance)));
  }, []);

  // Export as PNG
  const handleExportPNG = useCallback(async () => {
    if (!diagramRef.current || !module) return;
    try {
      toast.loading('正在生成PNG...');
      const dataUrl = await captureOffscreen();
      const link = document.createElement('a');
      link.download = `${module.name}-视觉系统示意图.png`;
      link.href = dataUrl;
      link.click();
      toast.dismiss();
      toast.success('PNG已导出');
    } catch (error) {
      toast.dismiss();
      toast.error('导出PNG失败');
      console.error(error);
    }
  }, [module?.name, getPixelRatio, captureOffscreen]);

  // Export as PDF
  const handleExportPDF = useCallback(async () => {
    if (!diagramRef.current || !module) return;
    try {
      toast.loading('正在生成PDF...');
      const dataUrl = await captureOffscreen();
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const imgWidth = 280;
      const imgHeight = (1100 / 1200) * imgWidth;
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, 297, 210, 'F');
      pdf.addImage(dataUrl, 'PNG', 8, 10, imgWidth, imgHeight);
      pdf.setTextColor(51, 51, 51);
      pdf.setFontSize(12);
      pdf.text(`${module.name} - 视觉系统示意图`, 148, 200, { align: 'center' });
      pdf.save(`${module.name}-视觉系统示意图.pdf`);
      toast.dismiss();
      toast.success('PDF已导出');
    } catch (error) {
      toast.dismiss();
      toast.error('导出PDF失败');
      console.error(error);
    }
  }, [module?.name, getPixelRatio, captureOffscreen]);

  // Lighting photos save handler
  const handleSaveLightingPhotos = useCallback(async (photos: Array<{ url: string; remark: string; created_at: string }>) => {
    if (!module) return;
    await updateModule(module.id, { lighting_photos: photos } as any);
  }, [module?.id, updateModule]);

  // Early returns after all hooks
  if (!module || !workstation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">未选择模块</p>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-16 w-16 text-warning" />
        <h3 className="text-lg font-semibold">请先完成工位布局</h3>
        <p className="text-muted-foreground text-center max-w-md">
          模块2D示意图需要以工位布局作为参考。请先选择工位"{workstation.name}"并配置机械布局。
        </p>
        <Button variant="outline" onClick={() => selectModule(null)}>
          返回工位配置
        </Button>
      </div>
    );
  }

  const selectedCamera = cameras.find(c => c.id === module.selected_camera);
  const selectedLens = lenses.find(l => l.id === module.selected_lens);
  const selectedLight = lights.find(l => l.id === module.selected_light);
  const selectedController = controllers.find(c => c.id === module.selected_controller);
  const ModuleIcon = moduleTypeIcons[(module.type || 'positioning') as keyof typeof moduleTypeIcons] || Box;
  const lightingPhotos = Array.isArray((module as any).lighting_photos) ? (module as any).lighting_photos : [];

  const handleSaveSchematic = async () => {
    if (!diagramRef.current) return;
    
    setSavingSchematic(true);
    
    try {
      // Ensure latest cameraPos / rotation state is flushed to the offscreen SVG transform
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const dataUrl = await captureOffscreen();
      
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const fileName = `module-schematic-${module.id}-${Date.now()}.png`;
      
      const { data: oldFiles } = await supabase.storage
        .from('module-schematics')
        .list('', { search: `module-schematic-${module.id}` });
      if (oldFiles?.length) {
        await supabase.storage.from('module-schematics')
          .remove(oldFiles.map(f => f.name));
      }
      
      const { error: uploadError } = await supabase.storage
        .from('module-schematics')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('module-schematics')
        .getPublicUrl(fileName);
      
      await updateModule(module.id, { 
        schematic_image_url: publicUrl,
        status: 'complete'
      });
      
      setSchematicSaved(true);
      setLastSavedAt(new Date());
      toast.success('视觉系统示意图已保存，可用于PPT生成');
    } catch (error) {
      console.error('Failed to save schematic:', error);
      toast.error(getImageSaveErrorMessage(error));
    } finally {
      setSavingSchematic(false);
    }
  };


  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ModuleIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{module.name}</h3>
            <p className="text-sm text-muted-foreground">
              {moduleTypeLabels[(module.type || 'positioning') as keyof typeof moduleTypeLabels] || module.type || 'positioning'} · {workstation.name}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schematic" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 border-b border-border bg-card/30">
          <TabsList className="h-9">
            <TabsTrigger value="schematic" className="gap-1.5 text-xs">
              <FileImage className="h-3.5 w-3.5" />
              光学方案
            </TabsTrigger>
            <TabsTrigger value="lighting" className="gap-1.5 text-xs">
              <Camera className="h-3.5 w-3.5" />
              打光照片
              {lightingPhotos.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium">
                  {lightingPhotos.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="schematic" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          {/* Toolbar for schematic tab */}
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border">
            {lastSavedAt && (
              <span className="text-xs text-muted-foreground mr-2">
                最后保存于 {lastSavedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                {!schematicSaved && <span className="ml-2 text-warning">· 有改动未保存</span>}
              </span>
            )}
            {!lastSavedAt && !schematicSaved && (
              <span className="text-xs text-warning mr-2">· 有改动未保存</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  导出
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={handleExportPNG} className="gap-2 cursor-pointer">
                  <FileImage className="h-4 w-4" />
                  导出为 PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  导出为 PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleSaveSchematic} className="gap-2" disabled={savingSchematic} size="sm">
              {savingSchematic ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : schematicSaved ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {schematicSaved ? '已保存' : '保存示意图'}
            </Button>
          </div>

          {/* Schematic Canvas */}
          <div className="flex-1 p-6 overflow-y-scroll">
            <div 
              ref={diagramRef}
              className="relative w-full max-w-5xl mx-auto bg-background rounded-xl border-2 border-border overflow-hidden" 
              style={{ minHeight: '500px' }}
            >
              <VisionSystemDiagram
                key={module.id}
                camera={selectedCamera || null}
                lens={selectedLens || null}
                light={selectedLight || null}
                controller={selectedController || null}
                cameras={cameras}
                lenses={lenses}
                lights={lights}
                controllers={controllers}
                onCameraSelect={handleCameraSelect}
                onLensSelect={handleLensSelect}
                onLightSelect={handleLightSelect}
                onControllerSelect={handleControllerSelect}
                lightDistance={lightDistance}
                fovAngle={fovAngle}
                onFovAngleChange={handleFovAngleChange}
                onLightDistanceChange={handleLightDistanceChange}
                roiStrategy={module.roi_strategy || 'full'}
                moduleType={module.type || 'positioning'}
                interactive={true}
                cameraPos={cameraPos}
                lightPos={lightPos}
                cameraRotation={cameraRotation}
                lightRotation={lightRotation}
                onCameraPosChange={setCameraPos}
                onLightPosChange={setLightPos}
                onCameraRotationChange={setCameraRotation}
                onLightRotationChange={setLightRotation}
                className="w-full h-full"
              />

              {/* Module Info Badge */}
              <div data-screenshot-hide className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <ModuleIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{module.name}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>类型: {moduleTypeLabels[(module.type || 'positioning') as keyof typeof moduleTypeLabels] || module.type || 'positioning'}</div>
                  {module.processing_time_limit && <div>处理时限: {module.processing_time_limit}ms</div>}
                  <div>ROI: {(module.roi_strategy || 'full') === 'full' ? '全图检测' : '自定义区域'}</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lighting" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <div className="flex-1 overflow-auto">
            <LightingPhotosPanel
              moduleId={module.id}
              moduleName={module.name}
              initialPhotos={lightingPhotos}
              onSave={handleSaveLightingPhotos}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Off-screen export diagram (interactive=false, pure SVG) */}
      {isCapturing && (
        <div
          ref={exportDiagramRef}
          style={{
            position: 'absolute',
            left: '-20000px',
            top: '-20000px',
            width: '1200px',
            height: '700px',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <VisionSystemDiagram
            key={`export-${module.id}`}
            camera={selectedCamera || null}
            lens={selectedLens || null}
            light={selectedLight || null}
            controller={selectedController || null}
            cameras={cameras}
            lenses={lenses}
            lights={lights}
            controllers={controllers}
            onCameraSelect={handleCameraSelect}
            onLensSelect={handleLensSelect}
            onLightSelect={handleLightSelect}
            onControllerSelect={handleControllerSelect}
            lightDistance={lightDistance}
            fovAngle={fovAngle}
            onFovAngleChange={handleFovAngleChange}
            onLightDistanceChange={handleLightDistanceChange}
            roiStrategy={module.roi_strategy || 'full'}
            moduleType={module.type || 'positioning'}
            interactive={false}
            cameraPos={cameraPos}
            lightPos={lightPos}
            cameraRotation={cameraRotation}
            lightRotation={lightRotation}
            className="vision-diagram-container w-full h-full"
          />
        </div>
      )}
    </div>
  );
}
