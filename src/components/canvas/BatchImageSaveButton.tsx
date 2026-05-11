import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Save, 
  Loader2, 
  CheckCircle2, 
  ImageIcon,
  Camera,
  Layers,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { 
  saveViewToStorage,
  saveSchematicToStorage,
  generateImageFromElement,
  generateSchematicImage,
  getViewLabel,
  type ViewType,
  type SaveProgress,
} from '@/services/batchImageSaver';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VisionSystemDiagram } from './VisionSystemDiagram';
import { SimpleLayoutDiagram } from './SimpleLayoutDiagram';
import { useCameras, useLights, useLenses, useControllers } from '@/hooks/useHardware';

interface BatchImageSaveButtonProps {
  projectId: string;
}

interface ImageList {
  layouts: Array<{ workstationId: string; workstationName: string; missingViews: ViewType[] }>;
  schematics: Array<{ moduleId: string; moduleName: string; workstationName: string }>;
  total: number;
}

interface SchematicLayoutState {
  camera: { x: number; y: number };
  light: { x: number; y: number };
  cameraRotation: number;
  lightRotation: number;
  fovAngle: number;
  lightDistance: number;
}

const DEFAULT_SCHEMATIC_LAYOUT: SchematicLayoutState = {
  camera: { x: 275, y: 77 },
  light: { x: 275, y: 231 },
  cameraRotation: 0,
  lightRotation: 0,
  fovAngle: 45,
  lightDistance: 335,
};

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readPoint(value: unknown, fallback: { x: number; y: number }) {
  if (!value || typeof value !== 'object') return fallback;
  const point = value as { x?: unknown; y?: unknown };
  return {
    x: toFiniteNumber(point.x, fallback.x),
    y: toFiniteNumber(point.y, fallback.y),
  };
}

function resolveSchematicLayout(rawLayout: unknown): SchematicLayoutState {
  let layout = rawLayout;
  if (typeof rawLayout === 'string') {
    try {
      layout = JSON.parse(rawLayout);
    } catch {
      layout = null;
    }
  }

  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    return DEFAULT_SCHEMATIC_LAYOUT;
  }

  const data = layout as Record<string, unknown>;
  return {
    camera: readPoint(data.camera, DEFAULT_SCHEMATIC_LAYOUT.camera),
    light: readPoint(data.light, DEFAULT_SCHEMATIC_LAYOUT.light),
    cameraRotation: toFiniteNumber(data.cameraRotation, DEFAULT_SCHEMATIC_LAYOUT.cameraRotation),
    lightRotation: toFiniteNumber(data.lightRotation, DEFAULT_SCHEMATIC_LAYOUT.lightRotation),
    fovAngle: toFiniteNumber(data.fovAngle, DEFAULT_SCHEMATIC_LAYOUT.fovAngle),
    lightDistance: toFiniteNumber(data.lightDistance, DEFAULT_SCHEMATIC_LAYOUT.lightDistance),
  };
}

export function BatchImageSaveButton({ projectId }: BatchImageSaveButtonProps) {
  const { 
    workstations,
    modules,
    layouts,
    getProjectWorkstations,
    getWorkstationModules,
    updateLayout,
    updateModule,
  } = useData();

  const { cameras } = useCameras();
  const { lights } = useLights();
  const { lenses } = useLenses();
  const { controllers } = useControllers();

  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [currentRenderWorkstation, setCurrentRenderWorkstation] = useState<string | null>(null);
  const [currentRenderModule, setCurrentRenderModule] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('front');
  
  const layoutCanvasRef = useRef<HTMLDivElement>(null);
  const schematicRef = useRef<HTMLDivElement>(null);
  const renderCompleteResolve = useRef<(() => void) | null>(null);

  const projectWorkstations = getProjectWorkstations(projectId);
  
  // Calculate missing images (only those without URLs)
  const missingImages = useMemo<ImageList>(() => {
    const missingLayouts: ImageList['layouts'] = [];
    const missingSchematics: ImageList['schematics'] = [];

    for (const ws of projectWorkstations) {
      const layout = layouts.find(l => l.workstation_id === ws.id);
      if (layout && !layout.front_view_image_url) {
        missingLayouts.push({
          workstationId: ws.id,
          workstationName: ws.name,
          missingViews: ['front' as ViewType],
        });
      }
      const wsModules = getWorkstationModules(ws.id);
      for (const m of wsModules) {
        if (!(m as any).schematic_image_url) {
          missingSchematics.push({ moduleId: m.id, moduleName: m.name, workstationName: ws.name });
        }
      }
    }

    const total = missingLayouts.length + missingSchematics.length;
    return { layouts: missingLayouts, schematics: missingSchematics, total };
  }, [projectWorkstations, layouts, getWorkstationModules]);

  // Calculate ALL images (for force regeneration)
  const allImages = useMemo<ImageList>(() => {
    const allLayouts: ImageList['layouts'] = [];
    const allSchematics: ImageList['schematics'] = [];

    for (const ws of projectWorkstations) {
      const layout = layouts.find(l => l.workstation_id === ws.id);
      if (layout) {
        allLayouts.push({
          workstationId: ws.id,
          workstationName: ws.name,
          missingViews: ['front' as ViewType],
        });
      }
      const wsModules = getWorkstationModules(ws.id);
      for (const m of wsModules) {
        allSchematics.push({ moduleId: m.id, moduleName: m.name, workstationName: ws.name });
      }
    }

    const total = allLayouts.length + allSchematics.length;
    return { layouts: allLayouts, schematics: allSchematics, total };
  }, [projectWorkstations, layouts, getWorkstationModules]);

  // Handle render complete
  useEffect(() => {
    if (renderCompleteResolve.current && (currentRenderWorkstation || currentRenderModule)) {
      const timeout = setTimeout(() => {
        renderCompleteResolve.current?.();
        renderCompleteResolve.current = null;
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentRenderWorkstation, currentRenderModule, currentView]);

  const waitForRender = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      renderCompleteResolve.current = resolve;
    });
  }, []);

  const handleBatchSave = useCallback(async (force: boolean = false) => {
    const imageList = force ? allImages : missingImages;

    if (imageList.total === 0) {
      toast.info(force ? '项目中没有可生成的图片' : '所有图片已保存，无需重复操作');
      return;
    }

    setIsSaving(true);
    setShowDialog(true);
    let current = 0;
    let successCount = 0;
    let errorCount = 0;

    try {
      // Save layout views
      for (const layoutItem of imageList.layouts) {
        const layout = layouts.find(l => l.workstation_id === layoutItem.workstationId);
        if (!layout) continue;

        for (const view of layoutItem.missingViews) {
          current++;
          setProgress({
            current,
            total: imageList.total,
            message: `${layoutItem.workstationName} - ${getViewLabel(view)}`,
            type: 'layout',
          });

          try {
            setCurrentRenderWorkstation(layoutItem.workstationId);
            setCurrentView(view);
            await waitForRender();
            await new Promise(r => setTimeout(r, 300));

            const canvasElement = layoutCanvasRef.current?.querySelector('svg');
            if (canvasElement) {
              const blob = await generateImageFromElement(canvasElement as unknown as HTMLElement, {
                quality: 'standard',
                backgroundColor: '#1e293b',
                format: 'jpeg',
              });
              
              await saveViewToStorage(
                layoutItem.workstationId,
                layout.id,
                view,
                blob,
                updateLayout
              );
              successCount++;
            } else {
              throw new Error('Canvas element not found');
            }
          } catch (error) {
            console.error(`Failed to save ${view} view for ${layoutItem.workstationName}:`, error);
            errorCount++;
          }
        }
      }

      setCurrentRenderWorkstation(null);

      // Save module schematics
      for (const schematicItem of imageList.schematics) {
        current++;
        setProgress({
          current,
          total: imageList.total,
          message: `${schematicItem.workstationName} - ${schematicItem.moduleName}`,
          type: 'schematic',
        });

        try {
          setCurrentRenderModule(schematicItem.moduleId);
          await waitForRender();
          await new Promise(r => setTimeout(r, 300));

          const diagramElement = schematicRef.current?.querySelector('.vision-diagram-container');
          if (diagramElement) {
            const blob = await generateSchematicImage(diagramElement as HTMLElement);
            
            await saveSchematicToStorage(
              schematicItem.moduleId,
              blob,
              updateModule
            );
            successCount++;
          } else {
            throw new Error('Diagram element not found');
          }
        } catch (error) {
          console.error(`Failed to save schematic for ${schematicItem.moduleName}:`, error);
          errorCount++;
        }
      }

      setCurrentRenderModule(null);

      if (errorCount === 0) {
        toast.success(`已成功保存 ${successCount} 张图片`);
      } else {
        toast.warning(`保存完成: ${successCount} 成功, ${errorCount} 失败`);
      }
    } finally {
      setIsSaving(false);
      setProgress(null);
      setCurrentRenderWorkstation(null);
      setCurrentRenderModule(null);
      setTimeout(() => setShowDialog(false), 1500);
    }
  }, [missingImages, allImages, layouts, waitForRender, updateLayout, updateModule]);

  // Get current module data for schematic rendering
  const currentModuleData = currentRenderModule 
    ? modules.find(m => m.id === currentRenderModule) as any
    : null;
  const currentSchematicLayout = useMemo(
    () => resolveSchematicLayout(currentModuleData?.schematic_layout),
    [currentModuleData?.schematic_layout]
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="gap-2"
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : missingImages.total === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            一键保存图片
            {missingImages.total > 0 && (
              <Badge variant="destructive" className="ml-1">
                {missingImages.total}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => handleBatchSave(false)}
            disabled={missingImages.total === 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            保存缺失图片
            {missingImages.total > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs">
                {missingImages.total}
              </Badge>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleBatchSave(true)}
            disabled={allImages.total === 0}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            重新生成全部图片
            {allImages.total > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {allImages.total}
              </Badge>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Progress Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              批量保存项目图片
            </DialogTitle>
            <DialogDescription>
              正在自动渲染并保存项目中的所有三视图和示意图
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {progress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {progress.type === 'layout' ? (
                      <Layers className="h-4 w-4 text-primary" />
                    ) : (
                      <Camera className="h-4 w-4 text-accent" />
                    )}
                    {progress.message}
                  </span>
                  <span className="text-muted-foreground">
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <Progress 
                  value={(progress.current / progress.total) * 100} 
                  className="h-2"
                />
              </div>
            )}

            {!isSaving && missingImages.total === 0 && (
              <div className="flex items-center justify-center gap-2 py-8 text-success">
                <CheckCircle2 className="h-8 w-8" />
                <span className="text-lg font-medium">所有图片已保存完成！</span>
              </div>
            )}

            {/* Off-screen render area */}
            <div 
              style={{ position: 'absolute', left: '-20000px', top: '-20000px', width: 1200, height: 700, pointerEvents: 'none', overflow: 'hidden' }}
              aria-hidden="true"
            >
              {currentRenderWorkstation && (
                <div ref={layoutCanvasRef}>
                  <OffscreenSimpleLayout
                    workstationId={currentRenderWorkstation}
                    cameras={cameras}
                    lenses={lenses}
                    lights={lights}
                    controllers={controllers}
                  />
                </div>
              )}

              {currentRenderModule && currentModuleData && (
                <div ref={schematicRef}>
                  <div className="vision-diagram-container" style={{ width: '1000px', height: '680px', backgroundColor: '#ffffff' }}>
                    <VisionSystemDiagram
                      camera={cameras.find(c => c.id === currentModuleData.selected_camera) || null}
                      lens={lenses.find(l => l.id === currentModuleData.selected_lens) || null}
                      light={lights.find(l => l.id === currentModuleData.selected_light) || null}
                      controller={controllers.find(c => c.id === currentModuleData.selected_controller) || null}
                      cameras={cameras}
                      lenses={lenses}
                      lights={lights}
                      controllers={controllers}
                      onCameraSelect={() => {}}
                      onLensSelect={() => {}}
                      onLightSelect={() => {}}
                      onControllerSelect={() => {}}
                      lightDistance={currentSchematicLayout.lightDistance}
                      fovAngle={currentSchematicLayout.fovAngle}
                      onFovAngleChange={() => {}}
                      onLightDistanceChange={() => {}}
                      roiStrategy={currentModuleData.roi_strategy || 'full'}
                      moduleType={currentModuleData.type || 'positioning'}
                      interactive={false}
                      cameraPos={currentSchematicLayout.camera}
                      lightPos={currentSchematicLayout.light}
                      cameraRotation={currentSchematicLayout.cameraRotation}
                      lightRotation={currentSchematicLayout.lightRotation}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Offscreen renderer using SimpleLayoutDiagram
 */
function OffscreenSimpleLayout({ 
  workstationId,
  cameras,
  lenses,
  lights,
  controllers,
}: { 
  workstationId: string;
  cameras: any[];
  lenses: any[];
  lights: any[];
  controllers: any[];
}) {
  const { 
    workstations, 
    layouts,
    getLayoutByWorkstation,
    getWorkstationModules,
  } = useData();
  
  const workstation = workstations.find(ws => ws.id === workstationId) as any;
  const layout = getLayoutByWorkstation(workstationId) as any;
  
  if (!workstation || !layout) return null;

  let layoutObjects: any[] = [];
  if (layout?.layout_objects) {
    try {
      layoutObjects = typeof layout.layout_objects === 'string' 
        ? JSON.parse(layout.layout_objects) 
        : (Array.isArray(layout.layout_objects) ? layout.layout_objects : []);
    } catch (e) {
      console.error('Failed to parse layout objects:', e);
    }
  }

  const wsModules = getWorkstationModules(workstationId);
  const mechanisms = Array.isArray(layout?.mechanisms) ? layout.mechanisms : [];
  const cameraMounts = Array.isArray(layout?.camera_mounts) ? layout.camera_mounts : [];

  const selectedCameras = Array.isArray(layout?.selected_cameras) ? layout.selected_cameras : [];
  const selectedLenses = Array.isArray(layout?.selected_lenses) ? layout.selected_lenses : [];
  const selectedLights = Array.isArray(layout?.selected_lights) ? layout.selected_lights : [];

  const hardwareSummary = {
    cameras: selectedCameras.filter(Boolean).map((c: any) => {
      const full = cameras.find((fc: any) => fc.id === c.id);
      return { brand: c.brand, model: c.model, resolution: full?.resolution };
    }),
    lenses: selectedLenses.filter(Boolean).map((l: any) => {
      const full = lenses.find((fl: any) => fl.id === l.id);
      return { brand: l.brand, model: l.model, focal_length: full?.focal_length };
    }),
    lights: selectedLights.filter(Boolean).map((l: any) => {
      const full = lights.find((fl: any) => fl.id === l.id);
      return { brand: l.brand, model: l.model, type: full?.type };
    }),
    controller: layout?.selected_controller ? {
      brand: layout.selected_controller.brand,
      model: layout.selected_controller.model,
    } : null,
  };

  return (
    <SimpleLayoutDiagram
      layoutObjects={layoutObjects}
      mechanisms={mechanisms}
      cameraMounts={cameraMounts}
      cameraCount={layout?.camera_count || wsModules.length}
      workstationName={workstation.name}
      cycleTime={workstation.cycle_time}
      shotCount={workstation.shot_count}
      modules={wsModules.map((m: any) => ({
        name: m.name,
        type: m.type || 'positioning',
        trigger_type: m.trigger_type,
        processing_time_limit: m.processing_time_limit,
      }))}
      hardware={hardwareSummary}
      width={1200}
      height={700}
    />
  );
}
