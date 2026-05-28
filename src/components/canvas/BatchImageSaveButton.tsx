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
import { safeController, safeHardwareArray } from '@/utils/safeDataAccess';
import { resolveModuleHardwareSelection } from '@/utils/moduleHardwareSlots';
import { getFirstModuleLightItem, normalizeModuleLightItems } from '@/utils/moduleLightItems';
import { createSchematicImageSignature, hasCurrentSchematicImageSignature } from '@/utils/schematicImageSignature';
import { normalizeDistanceUnit, signedToMillimeters, toMillimeters } from '@/utils/distanceUnits';

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
  product: { x: number; y: number };
  lights?: Array<{ id: string; position: { x: number; y: number }; rotation?: number }>;
  cameraRotation: number;
  lightRotation: number;
  fovAngle: number;
  lightDistance: number;
  lightCount?: number;
  savedImageSignature?: string;
}

const DEFAULT_SCHEMATIC_LAYOUT: SchematicLayoutState = {
  camera: { x: 275, y: 77 },
  light: { x: 275, y: 231 },
  product: { x: 275, y: 420 },
  cameraRotation: 0,
  lightRotation: 0,
  fovAngle: 45,
  lightDistance: 335,
};
const PRODUCT_MIN_Y = 300;
const PRODUCT_MAX_Y = 430;

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

function readProductPoint(value: unknown) {
  const point = readPoint(value, DEFAULT_SCHEMATIC_LAYOUT.product);
  return {
    x: DEFAULT_SCHEMATIC_LAYOUT.product.x,
    y: Math.max(PRODUCT_MIN_Y, Math.min(PRODUCT_MAX_Y, point.y)),
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
    product: readProductPoint(data.product),
    lights: Array.isArray(data.lights)
      ? data.lights.map((item: any) => ({
          id: String(item.id || ''),
          position: readPoint(item.position, DEFAULT_SCHEMATIC_LAYOUT.light),
          rotation: toFiniteNumber(item.rotation, 0),
        })).filter(item => item.id)
      : undefined,
    cameraRotation: toFiniteNumber(data.cameraRotation, DEFAULT_SCHEMATIC_LAYOUT.cameraRotation),
    lightRotation: toFiniteNumber(data.lightRotation, DEFAULT_SCHEMATIC_LAYOUT.lightRotation),
    fovAngle: toFiniteNumber(data.fovAngle, DEFAULT_SCHEMATIC_LAYOUT.fovAngle),
    lightDistance: toFiniteNumber(data.lightDistance, DEFAULT_SCHEMATIC_LAYOUT.lightDistance),
    lightCount: toFiniteNumber(data.lightCount, 0) || undefined,
    savedImageSignature: typeof data.savedImageSignature === 'string' ? data.savedImageSignature : undefined,
  };
}

const MODULE_CONFIG_KEYS = ['defect_config', 'positioning_config', 'ocr_config', 'deep_learning_config', 'measurement_config'] as const;

function getModuleConfig(module: any): any {
  if (!module) return null;
  for (const key of MODULE_CONFIG_KEYS) {
    if (module[key]) return module[key];
  }
  return null;
}

function getPersistedImaging(module: any): Record<string, any> {
  return getModuleConfig(module)?.imaging || {};
}

function isBatchModule3DCamera(module: any, projectUses3D = false): boolean {
  if (projectUses3D) return true;
  const imaging = getPersistedImaging(module);
  return imaging.is3DCamera === true || String(imaging.is3DCamera || '') === 'true';
}

function getPersistedWorkingDistance(module: any): string {
  const cfg = getModuleConfig(module);
  return String(cfg?.imaging?.workingDistance ?? cfg?.workingDistance ?? '');
}

function getPersistedFov(module: any): string {
  const cfg = getModuleConfig(module);
  return String(cfg?.imaging?.fieldOfView ?? cfg?.fieldOfView ?? '');
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseFovWidth(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const pair = trimmed.match(/^(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)$/);
  if (pair) return parsePositiveNumber(pair[1]);
  return parsePositiveNumber(trimmed);
}

function readSchematicLayoutRecord(rawLayout: unknown): Record<string, unknown> {
  let layout = rawLayout;
  if (typeof rawLayout === 'string') {
    try {
      layout = JSON.parse(rawLayout);
    } catch {
      layout = null;
    }
  }
  return layout && typeof layout === 'object' && !Array.isArray(layout) ? { ...(layout as Record<string, unknown>) } : {};
}

function getModuleLightItemsForBatch(module: any, projectUses3D = false) {
  if (isBatchModule3DCamera(module, projectUses3D)) return [];
  const imaging = getPersistedImaging(module);
  return normalizeModuleLightItems(imaging.lightItems, {
    selectedLight: module?.selected_light || module?.light_id || '',
    lightMode: imaging.lightMode || '',
    lightAngle: imaging.lightAngle || '',
    lightDistance: imaging.lightDistance || '',
    lightDistanceHorizontal: imaging.lightDistanceHorizontal || '',
    lightDistanceVertical: imaging.lightDistanceVertical || '',
    lightNote: imaging.lightNote || '',
  });
}

function getBatchDiagramLightItems(
  module: any,
  layout: any,
  schematicLayout: SchematicLayoutState,
  lights: any[],
  projectUses3D = false,
) {
  if (isBatchModule3DCamera(module, projectUses3D)) return [];
  const imaging = getPersistedImaging(module);
  const distanceUnit = normalizeDistanceUnit(imaging.distanceUnit);
  return getModuleLightItemsForBatch(module, projectUses3D).map((item, index) => {
    const resolved = resolveModuleHardwareSelection(item.selectedLight, layout, 'light', lights);
    const saved = schematicLayout.lights?.find(lightItem => lightItem.id === item.id);
    const horizontalMm = signedToMillimeters(item.lightDistanceHorizontal, distanceUnit) ?? 0;
    const verticalMm = toMillimeters(item.lightDistanceVertical, distanceUnit);
    const distanceMm = toMillimeters(item.lightDistance, distanceUnit)
      ?? (verticalMm !== null ? Math.sqrt(horizontalMm * horizontalMm + verticalMm * verticalMm) : null);
    const angle = Number.parseFloat(item.lightAngle);
    return {
      id: item.id,
      label: `LIGHT${index + 1}`,
      light: resolved?.item || null,
      position: saved?.position || (index === 0 ? schematicLayout.light : { x: schematicLayout.light.x + index * 36, y: schematicLayout.light.y }),
      rotation: saved?.rotation ?? (Number.isFinite(angle) ? angle : schematicLayout.lightRotation),
      distanceInput: item.lightDistance,
      distanceMm,
      horizontalMm,
      verticalMm,
      angle: item.lightAngle,
    };
  });
}

function createBatchSchematicImageSignature(
  module: any,
  layout: any,
  schematicLayout: SchematicLayoutState,
  lights: any[],
  projectUses3D = false,
) {
  const imaging = getPersistedImaging(module);
  const distanceUnit = normalizeDistanceUnit(imaging.distanceUnit);
  const moduleLightItems = getModuleLightItemsForBatch(module, projectUses3D);
  const firstLightItem = getFirstModuleLightItem(moduleLightItems);
  const is3DCamera = isBatchModule3DCamera(module, projectUses3D);
  const selectedCameraId = module?.selected_camera || module?.camera_id || null;
  const selectedLensId = is3DCamera ? null : (module?.selected_lens || module?.lens_id || null);
  const selectedLightId = is3DCamera ? null : (firstLightItem?.selectedLight || module?.selected_light || module?.light_id || null);
  const selectedControllerId = module?.selected_controller || module?.controller_id || null;
  const workingDistanceMm = toMillimeters(getPersistedWorkingDistance(module), distanceUnit);
  const fovInput = getPersistedFov(module);
  const fovWidthMm = imaging.fieldOfViewWidth
    ? toMillimeters(imaging.fieldOfViewWidth, distanceUnit)
    : (() => {
      const parsed = parseFovWidth(fovInput);
      return parsed === null ? null : parsed * (distanceUnit === 'm' ? 1000 : distanceUnit === 'cm' ? 10 : 1);
    })();
  const lightDistanceHorizontalMm = signedToMillimeters(firstLightItem?.lightDistanceHorizontal, distanceUnit) ?? 0;
  const lightDistanceVerticalMm = toMillimeters(firstLightItem?.lightDistanceVertical, distanceUnit);
  const diagramLightDistanceMm = toMillimeters(firstLightItem?.lightDistance, distanceUnit)
    ?? (lightDistanceVerticalMm !== null
      ? Math.sqrt(lightDistanceHorizontalMm * lightDistanceHorizontalMm + lightDistanceVerticalMm * lightDistanceVerticalMm)
      : null);
  const diagramLightItems = getBatchDiagramLightItems(module, layout, schematicLayout, lights, projectUses3D);

  return createSchematicImageSignature({
    cameraId: selectedCameraId,
    lensId: selectedLensId,
    lightId: selectedLightId,
    controllerId: selectedControllerId,
    camera: schematicLayout.camera,
    light: schematicLayout.light,
    product: schematicLayout.product,
    cameraRotation: schematicLayout.cameraRotation,
    lightRotation: schematicLayout.lightRotation,
    fovAngle: schematicLayout.fovAngle,
    lightDistance: schematicLayout.lightDistance,
    workingDistanceMm,
    fovWidthMm,
    diagramLightDistanceMm,
    lightDistanceHorizontalMm,
    lightDistanceVerticalMm,
    lightCount: is3DCamera ? 0 : diagramLightItems.length || schematicLayout.lightCount || 1,
    lightItems: diagramLightItems.map(item => ({
      id: item.id,
      hardwareId: item.light?.id || null,
      position: item.position,
      rotation: item.rotation,
      distanceMm: item.distanceMm,
      horizontalMm: item.horizontalMm,
      verticalMm: item.verticalMm,
      angle: item.angle,
    })),
    is3DCamera,
    distanceUnit,
  });
}

export function BatchImageSaveButton({ projectId }: BatchImageSaveButtonProps) {
  const { 
    projects,
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
  const projectUses3D = Boolean(projects.find(p => p.id === projectId)?.use_3d);
  
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
        const schematicLayout = resolveSchematicLayout((m as any).schematic_layout);
        if (!(m as any).schematic_image_url || !hasCurrentSchematicImageSignature(schematicLayout.savedImageSignature)) {
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
                quality: 'high',
                backgroundColor: '#1e293b',
                format: 'png',
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
            const moduleForSignature = modules.find(m => m.id === schematicItem.moduleId) as any;
            const layoutForSignature = moduleForSignature
              ? layouts.find(l => l.workstation_id === moduleForSignature.workstation_id) as any
              : null;
            const schematicLayout = resolveSchematicLayout(moduleForSignature?.schematic_layout);
            const is3DCamera = moduleForSignature ? isBatchModule3DCamera(moduleForSignature, projectUses3D) : false;
            const diagramLightItems = moduleForSignature
              ? getBatchDiagramLightItems(moduleForSignature, layoutForSignature, schematicLayout, lights, projectUses3D)
              : [];
            const savedImageSignature = moduleForSignature
              ? createBatchSchematicImageSignature(moduleForSignature, layoutForSignature, schematicLayout, lights, projectUses3D)
              : undefined;
            const existingSchematicLayout = moduleForSignature
              ? readSchematicLayoutRecord(moduleForSignature.schematic_layout)
              : {};
            
            await saveSchematicToStorage(
              schematicItem.moduleId,
              blob,
              updateModule,
              savedImageSignature ? {
                schematic_layout: {
                  ...existingSchematicLayout,
                  camera: schematicLayout.camera,
                  light: schematicLayout.light,
                  product: schematicLayout.product,
                  lights: is3DCamera ? [] : diagramLightItems.map(item => ({
                    id: item.id,
                    position: item.position,
                    rotation: item.rotation,
                  })),
                  cameraRotation: schematicLayout.cameraRotation,
                  lightRotation: schematicLayout.lightRotation,
                  fovAngle: schematicLayout.fovAngle,
                  lightDistance: schematicLayout.lightDistance,
                  lightCount: is3DCamera ? 0 : diagramLightItems.length || schematicLayout.lightCount || 1,
                  savedImageSignature,
                },
              } : {}
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
  }, [missingImages, allImages, layouts, modules, lights, projectUses3D, waitForRender, updateLayout, updateModule]);

  // Get current module data for schematic rendering
  const currentModuleData = currentRenderModule 
    ? modules.find(m => m.id === currentRenderModule) as any
    : null;
  const currentModuleLayout = currentModuleData
    ? layouts.find(l => l.workstation_id === currentModuleData.workstation_id) as any
    : null;
  const currentSchematicLayout = useMemo(
    () => resolveSchematicLayout(currentModuleData?.schematic_layout),
    [currentModuleData?.schematic_layout]
  );
  const currentDistanceUnit = normalizeDistanceUnit(getPersistedImaging(currentModuleData).distanceUnit);
  const currentIs3DCamera = currentModuleData ? isBatchModule3DCamera(currentModuleData, projectUses3D) : false;
  const currentDiagramLightItems = currentModuleData
    ? getBatchDiagramLightItems(currentModuleData, currentModuleLayout, currentSchematicLayout, lights, projectUses3D)
    : [];

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
                    projectUses3D={projectUses3D}
                  />
                </div>
              )}

              {currentRenderModule && currentModuleData && (
                <div ref={schematicRef}>
                  <div className="vision-diagram-container" style={{ width: '1000px', height: '680px', backgroundColor: '#ffffff' }}>
                    <VisionSystemDiagram
                      camera={resolveModuleHardwareSelection(currentModuleData.selected_camera, currentModuleLayout, 'camera', cameras)?.item || null}
                      lens={currentIs3DCamera ? null : resolveModuleHardwareSelection(currentModuleData.selected_lens, currentModuleLayout, 'lens', lenses)?.item || null}
                      light={currentIs3DCamera ? null : resolveModuleHardwareSelection(currentModuleData.selected_light, currentModuleLayout, 'light', lights)?.item || null}
                      controller={resolveModuleHardwareSelection(currentModuleData.selected_controller, currentModuleLayout, 'controller', controllers)?.item || null}
                      is3DCamera={currentIs3DCamera}
                      cameras={cameras}
                      lenses={lenses}
                      lights={lights}
                      controllers={controllers}
                      onCameraSelect={() => {}}
                      onLensSelect={() => {}}
                      onLightSelect={() => {}}
                      onControllerSelect={() => {}}
                      lightDistance={currentSchematicLayout.lightDistance}
                      lightCount={currentIs3DCamera ? 0 : currentDiagramLightItems.length || 1}
                      fovAngle={currentSchematicLayout.fovAngle}
                      distanceUnit={currentDistanceUnit}
                      onFovAngleChange={() => {}}
                      onLightDistanceChange={() => {}}
                      roiStrategy={currentModuleData.roi_strategy || 'full'}
                      moduleType={currentModuleData.type || 'positioning'}
                      interactive={false}
                      cameraPos={currentSchematicLayout.camera}
                      lightPos={currentSchematicLayout.light}
                      productPos={currentSchematicLayout.product}
                      diagramLightItems={currentIs3DCamera ? [] : currentDiagramLightItems}
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
  projectUses3D = false,
}: { 
  workstationId: string;
  cameras: any[];
  lenses: any[];
  lights: any[];
  controllers: any[];
  projectUses3D?: boolean;
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

  const selectedCameras = safeHardwareArray(layout?.selected_cameras);
  const selectedLenses = projectUses3D ? [] : safeHardwareArray(layout?.selected_lenses);
  const selectedLights = projectUses3D ? [] : safeHardwareArray(layout?.selected_lights);
  const selectedController = safeController(layout?.selected_controller);

  const hardwareSummary = {
    cameras: selectedCameras.map((c: any) => {
      const full = cameras.find((fc: any) => fc.id === c.id);
      return { brand: c.brand, model: c.model, resolution: full?.resolution };
    }),
    lenses: selectedLenses.map((l: any) => {
      const full = lenses.find((fl: any) => fl.id === l.id);
      return { brand: l.brand, model: l.model, focal_length: full?.focal_length };
    }),
    lights: selectedLights.map((l: any) => {
      const full = lights.find((fl: any) => fl.id === l.id);
      return { brand: l.brand, model: l.model, type: full?.type };
    }),
    controller: selectedController ? {
      brand: selectedController.brand,
      model: selectedController.model,
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
