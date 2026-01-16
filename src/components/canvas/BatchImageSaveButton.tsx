import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Save, 
  Loader2, 
  CheckCircle2, 
  ImageIcon,
  Camera,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { 
  calculateMissingImages, 
  saveViewToStorage,
  saveSchematicToStorage,
  generateImageFromElement,
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
import { VisionSystemDiagram } from './VisionSystemDiagram';
import { useCameras, useLights, useLenses, useControllers } from '@/hooks/useHardware';

interface BatchImageSaveButtonProps {
  projectId: string;
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
  const missingImages = calculateMissingImages(projectWorkstations, layouts, getWorkstationModules);

  // Handle render complete
  useEffect(() => {
    if (renderCompleteResolve.current && (currentRenderWorkstation || currentRenderModule)) {
      // Give extra time for SVG to fully render
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

  const handleBatchSave = useCallback(async () => {
    if (missingImages.total === 0) {
      toast.info('所有图片已保存，无需重复操作');
      return;
    }

    setIsSaving(true);
    setShowDialog(true);
    let current = 0;
    let successCount = 0;
    let errorCount = 0;

    try {
      // Save layout views
      for (const layoutItem of missingImages.layouts) {
        const layout = layouts.find(l => l.workstation_id === layoutItem.workstationId);
        if (!layout) continue;

        for (const view of layoutItem.missingViews) {
          current++;
          setProgress({
            current,
            total: missingImages.total,
            message: `${layoutItem.workstationName} - ${getViewLabel(view)}`,
            type: 'layout',
          });

          try {
            // Render the view
            setCurrentRenderWorkstation(layoutItem.workstationId);
            setCurrentView(view);
            await waitForRender();
            
            // Extra wait for canvas to settle
            await new Promise(r => setTimeout(r, 300));

            const canvasElement = layoutCanvasRef.current?.querySelector('svg');
            if (canvasElement) {
              const blob = await generateImageFromElement(canvasElement as unknown as HTMLElement, {
                quality: 'fast',
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
      for (const schematicItem of missingImages.schematics) {
        current++;
        setProgress({
          current,
          total: missingImages.total,
          message: `${schematicItem.workstationName} - ${schematicItem.moduleName}`,
          type: 'schematic',
        });

        try {
          setCurrentRenderModule(schematicItem.moduleId);
          await waitForRender();
          
          // Extra wait for diagram to settle
          await new Promise(r => setTimeout(r, 300));

          const diagramElement = schematicRef.current?.querySelector('.vision-diagram-container');
          if (diagramElement) {
            const blob = await generateImageFromElement(diagramElement as HTMLElement, {
              quality: 'fast',
              backgroundColor: '#1a1a2e',
              format: 'png',
            });
            
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
      
      // Close dialog after a short delay
      setTimeout(() => setShowDialog(false), 1500);
    }
  }, [missingImages, layouts, waitForRender, updateLayout, updateModule]);

  // Get current module data for schematic rendering
  const currentModuleData = currentRenderModule 
    ? modules.find(m => m.id === currentRenderModule) as any
    : null;

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={handleBatchSave}
        disabled={isSaving || missingImages.total === 0}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : missingImages.total === 0 ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        一键保存所有图片
        {missingImages.total > 0 && (
          <Badge variant="destructive" className="ml-1">
            {missingImages.total}
          </Badge>
        )}
      </Button>

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
            {/* Progress Info */}
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

            {/* Missing Items Summary */}
            {!isSaving && missingImages.total === 0 && (
              <div className="flex items-center justify-center gap-2 py-8 text-success">
                <CheckCircle2 className="h-8 w-8" />
                <span className="text-lg font-medium">所有图片已保存完成！</span>
              </div>
            )}

            {/* Off-screen render area */}
            <div 
              className="fixed left-[-9999px] top-0 w-[1200px] h-[800px] overflow-hidden"
              aria-hidden="true"
            >
              {/* Layout Canvas Renderer */}
              {currentRenderWorkstation && (
                <div ref={layoutCanvasRef}>
                  <OffscreenLayoutCanvas
                    workstationId={currentRenderWorkstation}
                    currentView={currentView}
                  />
                </div>
              )}

              {/* Schematic Renderer */}
              {currentRenderModule && currentModuleData && (
                <div ref={schematicRef}>
                  <div className="vision-diagram-container" style={{ width: '1000px', height: '600px' }}>
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
                      lightDistance={335}
                      fovAngle={45}
                      onFovAngleChange={() => {}}
                      onLightDistanceChange={() => {}}
                      roiStrategy={currentModuleData.roi_strategy || 'full'}
                      moduleType={currentModuleData.type || 'positioning'}
                      interactive={false}
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
 * Simplified offscreen layout canvas for batch rendering
 */
function OffscreenLayoutCanvas({ 
  workstationId, 
  currentView 
}: { 
  workstationId: string; 
  currentView: ViewType;
}) {
  const { 
    workstations, 
    layouts,
    getLayoutByWorkstation,
  } = useData();
  
  const workstation = workstations.find(ws => ws.id === workstationId) as any;
  const layout = getLayoutByWorkstation(workstationId) as any;
  
  if (!workstation || !layout) return null;

  const productDimensions = workstation?.product_dimensions as { length: number; width: number; height: number } || { length: 300, width: 200, height: 100 };
  
  const canvasWidth = 1200;
  const canvasHeight = 800;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const scale = 1.0;
  
  const productW = productDimensions.length * scale;
  const productH = productDimensions.height * scale;
  const productD = productDimensions.width * scale;

  // Load objects from layout
  let objects: any[] = [];
  if (layout?.layout_objects) {
    try {
      objects = typeof layout.layout_objects === 'string' 
        ? JSON.parse(layout.layout_objects) 
        : layout.layout_objects;
    } catch (e) {
      console.error('Failed to parse layout objects:', e);
    }
  }

  // Project 3D to 2D based on view
  const project3DTo2D = (posX: number, posY: number, posZ: number, view: ViewType) => {
    switch (view) {
      case 'front':
        return { x: centerX + posX * scale, y: centerY - posZ * scale };
      case 'side':
        return { x: centerX + posY * scale, y: centerY - posZ * scale };
      case 'top':
        return { x: centerX + posX * scale, y: centerY + posY * scale };
      default:
        return { x: centerX, y: centerY };
    }
  };

  // Get product display dimensions based on view
  const getProductDimensions = (view: ViewType) => {
    switch (view) {
      case 'front': return { width: productW, height: productH };
      case 'side': return { width: productD, height: productH };
      case 'top': return { width: productW, height: productD };
      default: return { width: productW, height: productH };
    }
  };

  const productDims = getProductDimensions(currentView);

  return (
    <svg
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      className="bg-slate-800"
    >
      {/* Grid */}
      <defs>
        <pattern id="offscreen-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#offscreen-grid)" />
      
      {/* Product */}
      <rect
        x={centerX - productDims.width / 2}
        y={centerY - productDims.height / 2}
        width={productDims.width}
        height={productDims.height}
        fill="rgba(59, 130, 246, 0.1)"
        stroke="rgba(59, 130, 246, 0.5)"
        strokeWidth="2"
        strokeDasharray="8 4"
        rx="4"
      />
      
      {/* Objects */}
      {objects.map((obj: any) => {
        const pos = project3DTo2D(obj.posX ?? 0, obj.posY ?? 0, obj.posZ ?? 0, currentView);
        const size = obj.type === 'camera' ? 40 : (obj.width || 60);
        
        return (
          <g key={obj.id} transform={`translate(${pos.x}, ${pos.y})`}>
            {obj.type === 'camera' ? (
              <>
                <rect
                  x={-size / 2}
                  y={-size / 2}
                  width={size}
                  height={size}
                  fill="rgba(59, 130, 246, 0.3)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  rx="4"
                />
                <text
                  y={size / 2 + 14}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                >
                  {obj.name}
                </text>
              </>
            ) : (
              <rect
                x={-(obj.width || 60) / 2}
                y={-(obj.height || 40) / 2}
                width={obj.width || 60}
                height={obj.height || 40}
                fill="rgba(168, 85, 247, 0.2)"
                stroke="#a855f7"
                strokeWidth="1.5"
                rx="4"
              />
            )}
          </g>
        );
      })}
      
      {/* View Label */}
      <text
        x="20"
        y="30"
        fill="white"
        fontSize="16"
        fontWeight="bold"
      >
        {getViewLabel(currentView)} - {workstation.name}
      </text>
    </svg>
  );
}
