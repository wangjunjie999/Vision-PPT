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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const DEFAULT_CAMERA_POS = { x: 275, y: 77 };
const DEFAULT_LIGHT_POS = { x: 275, y: 231 };
const DEFAULT_FOV_ANGLE = 45;
const DEFAULT_LIGHT_DISTANCE = 335;
const SCHEMATIC_PRODUCT_Y = 420;
const SCHEMATIC_PRODUCT_CENTER_X = 275;
const SCHEMATIC_DISTANCE_SCALE = DEFAULT_LIGHT_DISTANCE / (SCHEMATIC_PRODUCT_Y - 175);
const LENS_BOTTOM_OFFSET_FROM_ROTATION_CENTER = 82;

type SchematicPoint = { x: number; y: number };

interface SchematicLayoutState {
  camera?: SchematicPoint;
  light?: SchematicPoint;
  cameraRotation?: number;
  lightRotation?: number;
  fovAngle?: number;
  lightDistance?: number;
  savedImageSignature?: string;
}

const MODULE_CONFIG_KEYS = [
  'defect_config',
  'positioning_config',
  'ocr_config',
  'deep_learning_config',
  'measurement_config',
] as const;

function roundForSignature(value: number) {
  return Math.round(value * 1000) / 1000;
}

function createSchematicImageSignature({
  cameraId,
  lensId,
  lightId,
  controllerId,
  camera,
  light,
  cameraRotation,
  lightRotation,
  fovAngle,
  lightDistance,
  workingDistanceMm,
  fovWidthMm,
  diagramLightDistanceMm,
  lightDistanceHorizontalMm,
  lightDistanceVerticalMm,
}: {
  cameraId?: string | null;
  lensId?: string | null;
  lightId?: string | null;
  controllerId?: string | null;
  camera: SchematicPoint;
  light: SchematicPoint;
  cameraRotation: number;
  lightRotation: number;
  fovAngle: number;
  lightDistance: number;
  workingDistanceMm?: number | null;
  fovWidthMm?: number | null;
  diagramLightDistanceMm?: number | null;
  lightDistanceHorizontalMm?: number | null;
  lightDistanceVerticalMm?: number | null;
}) {
  return JSON.stringify({
    v: 1,
    cameraId: cameraId || null,
    lensId: lensId || null,
    lightId: lightId || null,
    controllerId: controllerId || null,
    camera: { x: roundForSignature(camera.x), y: roundForSignature(camera.y) },
    light: { x: roundForSignature(light.x), y: roundForSignature(light.y) },
    cameraRotation: roundForSignature(cameraRotation),
    lightRotation: roundForSignature(lightRotation),
    fovAngle: roundForSignature(fovAngle),
    lightDistance: roundForSignature(lightDistance),
    workingDistanceMm: workingDistanceMm ? roundForSignature(workingDistanceMm) : null,
    fovWidthMm: fovWidthMm ? roundForSignature(fovWidthMm) : null,
    diagramLightDistanceMm: diagramLightDistanceMm ? roundForSignature(diagramLightDistanceMm) : null,
    lightDistanceHorizontalMm: lightDistanceHorizontalMm !== null && lightDistanceHorizontalMm !== undefined ? roundForSignature(lightDistanceHorizontalMm) : null,
    lightDistanceVerticalMm: lightDistanceVerticalMm ? roundForSignature(lightDistanceVerticalMm) : null,
  });
}

function isSchematicLayout(value: unknown): value is SchematicLayoutState {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSignedNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getModuleConfig(module: any): any | null {
  if (!module) return null;
  for (const key of MODULE_CONFIG_KEYS) {
    if (module[key]) return module[key];
  }
  return null;
}

function getPersistedWorkingDistance(module: any): string {
  const cfg = getModuleConfig(module);
  return String(cfg?.imaging?.workingDistance ?? cfg?.workingDistance ?? '');
}

function getPersistedFov(module: any): string {
  const cfg = getModuleConfig(module);
  return String(cfg?.imaging?.fieldOfView ?? cfg?.fieldOfView ?? '');
}

function getPersistedImagingField(module: any, field: string): string {
  const cfg = getModuleConfig(module);
  return String(cfg?.imaging?.[field] ?? '');
}

function getLiveFov(form: any): string {
  if (!form) return '';
  if (form.fieldOfViewWidth && form.fieldOfViewHeight) {
    return `${form.fieldOfViewWidth}×${form.fieldOfViewHeight}`;
  }
  return String(form.fieldOfViewCommon || form.fieldOfView || '');
}

function parseFovWidth(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const pair = trimmed.match(/^(\d+(?:\.\d+)?)\s*[×xX脳]\s*(\d+(?:\.\d+)?)$/);
  if (pair) return parsePositiveNumber(pair[1]);
  return parsePositiveNumber(trimmed);
}

function getCameraYForWorkingDistance(workingDistanceMm: number, cameraRotation: number) {
  const rotationRad = cameraRotation * Math.PI / 180;
  const rotatedLensOffsetY = 55 + (LENS_BOTTOM_OFFSET_FROM_ROTATION_CENTER * Math.cos(rotationRad));
  const targetY = SCHEMATIC_PRODUCT_Y - (workingDistanceMm / SCHEMATIC_DISTANCE_SCALE) - rotatedLensOffsetY;
  return Math.max(-120, Math.min(260, targetY));
}

function getWorkingDistanceForCameraY(cameraY: number, cameraRotation: number) {
  const rotationRad = cameraRotation * Math.PI / 180;
  const rotatedLensOffsetY = 55 + (LENS_BOTTOM_OFFSET_FROM_ROTATION_CENTER * Math.cos(rotationRad));
  return Math.max(0, Math.round((SCHEMATIC_PRODUCT_Y - cameraY - rotatedLensOffsetY) * SCHEMATIC_DISTANCE_SCALE));
}

function getLightYForDistance(lightDistanceMm: number) {
  return Math.max(-120, Math.min(SCHEMATIC_PRODUCT_Y - 24, SCHEMATIC_PRODUCT_Y - (lightDistanceMm / SCHEMATIC_DISTANCE_SCALE)));
}

function getLightXForHorizontalDistance(horizontalDistanceMm: number) {
  return Math.max(80, Math.min(470, SCHEMATIC_PRODUCT_CENTER_X + (horizontalDistanceMm / SCHEMATIC_DISTANCE_SCALE)));
}

function getLightVerticalDistanceForY(lightY: number) {
  return Math.max(0, Math.round(Math.abs(SCHEMATIC_PRODUCT_Y - lightY) * SCHEMATIC_DISTANCE_SCALE));
}

function getLightHorizontalDistanceForX(lightX: number) {
  return Math.round((lightX - SCHEMATIC_PRODUCT_CENTER_X) * SCHEMATIC_DISTANCE_SCALE);
}

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
  const { getPixelRatio, moduleLiveForms, patchModuleLiveForm } = useAppStore();
  const diagramRef = useRef<HTMLDivElement>(null);
  const exportDiagramRef = useRef<HTMLDivElement>(null);
  
  const [fovAngle, setFovAngle] = useState(DEFAULT_FOV_ANGLE);
  const [lightDistance, setLightDistance] = useState(DEFAULT_LIGHT_DISTANCE);
  const [savingSchematic, setSavingSchematic] = useState(false);
  const [schematicSaved, setSchematicSaved] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Schematic layout (camera/light position + rotation) — persisted to module.schematic_layout
  const [cameraPos, setCameraPos] = useState(DEFAULT_CAMERA_POS);
  const [lightPos, setLightPos] = useState(DEFAULT_LIGHT_POS);
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
  const savedLayout = useMemo(
    () => isSchematicLayout(module?.schematic_layout) ? module.schematic_layout : null,
    [module?.schematic_layout],
  );
  const liveForm = selectedModuleId ? moduleLiveForms[selectedModuleId]?.form : undefined;
  const workingDistanceInput = liveForm ? String(liveForm.workingDistance ?? '') : getPersistedWorkingDistance(module);
  const workingDistanceMm = parsePositiveNumber(workingDistanceInput);
  const diagramLightDistanceInput = liveForm
    ? String(liveForm.lightDistance ?? '')
    : getPersistedImagingField(module, 'lightDistance');
  const lightDistanceVerticalInput = liveForm
    ? String(liveForm.lightDistanceVertical ?? '')
    : getPersistedImagingField(module, 'lightDistanceVertical');
  const lightDistanceHorizontalInput = liveForm
    ? String(liveForm.lightDistanceHorizontal ?? '')
    : getPersistedImagingField(module, 'lightDistanceHorizontal');
  const diagramLightDistanceMm = parsePositiveNumber(diagramLightDistanceInput);
  const lightDistanceVerticalMm = parsePositiveNumber(lightDistanceVerticalInput);
  const lightDistancePositionMm = diagramLightDistanceMm ?? lightDistanceVerticalMm;
  const lightDistanceHorizontalMm = parseSignedNumber(lightDistanceHorizontalInput);
  const fovInput = liveForm ? getLiveFov(liveForm) : getPersistedFov(module);
  const fovWidthMm = liveForm?.fieldOfViewWidth
    ? parsePositiveNumber(liveForm.fieldOfViewWidth)
    : parseFovWidth(fovInput);
  const selectedCameraId = liveForm?.selectedCamera || module?.selected_camera || module?.camera_id || null;
  const selectedLensId = liveForm?.selectedLens || module?.selected_lens || module?.lens_id || null;
  const selectedLightId = liveForm?.selectedLight || module?.selected_light || module?.light_id || null;
  const selectedControllerId = liveForm?.selectedController || module?.selected_controller || module?.controller_id || null;
  const currentImageSignature = useMemo(
    () => createSchematicImageSignature({
      cameraId: selectedCameraId,
      lensId: selectedLensId,
      lightId: selectedLightId,
      controllerId: selectedControllerId,
      camera: cameraPos,
      light: lightPos,
      cameraRotation,
      lightRotation,
      fovAngle,
      lightDistance,
      workingDistanceMm,
      fovWidthMm,
      diagramLightDistanceMm,
      lightDistanceHorizontalMm,
      lightDistanceVerticalMm,
    }),
    [
      cameraPos,
      cameraRotation,
      diagramLightDistanceMm,
      fovWidthMm,
      fovAngle,
      lightDistance,
      lightDistanceHorizontalMm,
      lightPos,
      lightRotation,
      lightDistanceVerticalMm,
      selectedCameraId,
      selectedControllerId,
      selectedLensId,
      selectedLightId,
      workingDistanceMm,
    ],
  );
  const isCurrentSchematicSaved = Boolean(
    module?.schematic_image_url &&
    savedLayout?.savedImageSignature &&
    savedLayout.savedImageSignature === currentImageSignature,
  );
  const savedImageSignatureRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    savedImageSignatureRef.current = savedLayout?.savedImageSignature;
  }, [savedLayout?.savedImageSignature]);

  // Load saved schematic layout when module changes
  useEffect(() => {
    if (!module) return;
    const saved = savedLayout;
    if (saved) {
      if (saved.camera) setCameraPos({ x: saved.camera.x ?? DEFAULT_CAMERA_POS.x, y: saved.camera.y ?? DEFAULT_CAMERA_POS.y });
      if (saved.light) setLightPos({ x: saved.light.x ?? DEFAULT_LIGHT_POS.x, y: saved.light.y ?? DEFAULT_LIGHT_POS.y });
      if (typeof saved.cameraRotation === 'number') setCameraRotation(saved.cameraRotation);
      if (typeof saved.lightRotation === 'number') setLightRotation(saved.lightRotation);
      if (typeof saved.fovAngle === 'number') setFovAngle(saved.fovAngle);
      if (typeof saved.lightDistance === 'number') setLightDistance(saved.lightDistance);
    } else {
      setCameraPos(DEFAULT_CAMERA_POS);
      setLightPos(DEFAULT_LIGHT_POS);
      setCameraRotation(0);
      setLightRotation(0);
      setFovAngle(DEFAULT_FOV_ANGLE);
      setLightDistance(DEFAULT_LIGHT_DISTANCE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module?.id]);

  useEffect(() => {
    if (!workingDistanceMm) return;
    const nextY = getCameraYForWorkingDistance(workingDistanceMm, cameraRotation);
    setCameraPos(prev => (
      Math.abs(prev.y - nextY) < 0.5
        ? prev
        : { ...prev, y: nextY }
    ));
  }, [cameraRotation, module?.id, workingDistanceMm]);

  useEffect(() => {
    if (!lightDistancePositionMm && lightDistanceHorizontalMm === null) return;
    setLightPos(prev => {
      const nextY = lightDistancePositionMm ? getLightYForDistance(lightDistancePositionMm) : prev.y;
      const nextX = lightDistanceHorizontalMm !== null ? getLightXForHorizontalDistance(lightDistanceHorizontalMm) : prev.x;
      if (Math.abs(prev.x - nextX) < 0.5 && Math.abs(prev.y - nextY) < 0.5) return prev;
      return { x: nextX, y: nextY };
    });
  }, [lightDistanceHorizontalMm, lightDistancePositionMm, module?.id]);

  // Reset saved state whenever any visual input changes — so the button
  // accurately reflects "needs re-save" after the user moves/rotates anything.
  useEffect(() => {
    setSchematicSaved(isCurrentSchematicSaved);
  }, [isCurrentSchematicSaved]);

  // Reset saved indicator when switching modules
  useEffect(() => {
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
          savedImageSignature: savedImageSignatureRef.current,
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
    patchModuleLiveForm(module.id, { selectedCamera: cameraId });
    updateModule(module.id, { camera_id: cameraId, selected_camera: cameraId } as any);
    toast.success('相机已更新');
  }, [module?.id, patchModuleLiveForm, updateModule]);

  const handleLensSelect = useCallback((lensId: string) => {
    if (!module) return;
    patchModuleLiveForm(module.id, { selectedLens: lensId });
    updateModule(module.id, { lens_id: lensId, selected_lens: lensId } as any);
    toast.success('镜头已更新');
  }, [module?.id, patchModuleLiveForm, updateModule]);

  const handleLightSelect = useCallback((lightId: string) => {
    if (!module) return;
    patchModuleLiveForm(module.id, { selectedLight: lightId });
    updateModule(module.id, { light_id: lightId, selected_light: lightId } as any);
    toast.success('光源已更新');
  }, [module?.id, patchModuleLiveForm, updateModule]);

  const handleControllerSelect = useCallback((controllerId: string) => {
    if (!module) return;
    patchModuleLiveForm(module.id, { selectedController: controllerId });
    updateModule(module.id, { controller_id: controllerId, selected_controller: controllerId } as any);
    toast.success('工控机已更新');
  }, [module?.id, patchModuleLiveForm, updateModule]);

  const handleFovAngleChange = useCallback((angle: number) => {
    setFovAngle(Math.max(10, Math.min(120, angle)));
  }, []);

  const handleLightDistanceChange = useCallback((distance: number) => {
    setLightDistance(Math.max(50, Math.min(1000, distance)));
  }, []);

  const handleWorkingDistanceChange = useCallback((value: string) => {
    if (!module) return;
    patchModuleLiveForm(module.id, { workingDistance: value });
  }, [module?.id, patchModuleLiveForm]);

  const handleCameraPosChange = useCallback((pos: SchematicPoint) => {
    setCameraPos(pos);
    if (!module) return;
    patchModuleLiveForm(module.id, {
      workingDistance: String(getWorkingDistanceForCameraY(pos.y, cameraRotation)),
    });
  }, [cameraRotation, module?.id, patchModuleLiveForm]);

  const handleDiagramLightDistanceChange = useCallback((value: string) => {
    if (!module) return;
    patchModuleLiveForm(module.id, {
      lightDistance: value,
      lightDistanceVertical: value,
    });
  }, [module?.id, patchModuleLiveForm]);

  const handleLightPosChange = useCallback((pos: SchematicPoint) => {
    setLightPos(pos);
    if (!module) return;
    const verticalDistance = getLightVerticalDistanceForY(pos.y);
    const horizontalDistance = getLightHorizontalDistanceForX(pos.x);
    patchModuleLiveForm(module.id, {
      lightDistance: String(verticalDistance),
      lightDistanceHorizontal: String(horizontalDistance),
      lightDistanceVertical: String(verticalDistance),
    });
  }, [module?.id, patchModuleLiveForm]);

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

  const selectedCamera = cameras.find(c => c.id === selectedCameraId || `${c.brand} ${c.model}` === selectedCameraId);
  const selectedLens = lenses.find(l => l.id === selectedLensId || `${l.brand} ${l.model}` === selectedLensId);
  const selectedLight = lights.find(l => l.id === selectedLightId || `${l.brand} ${l.model}` === selectedLightId);
  const selectedController = controllers.find(c => c.id === selectedControllerId || `${c.brand} ${c.model}` === selectedControllerId);
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
        status: 'complete',
        schematic_layout: {
          camera: cameraPos,
          light: lightPos,
          cameraRotation,
          lightRotation,
          fovAngle,
          lightDistance,
          savedImageSignature: currentImageSignature,
        },
      });
      
      savedImageSignatureRef.current = currentImageSignature;
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
                workingDistanceInput={workingDistanceInput}
                workingDistanceMm={workingDistanceMm}
                fovWidthMm={fovWidthMm}
                onWorkingDistanceChange={handleWorkingDistanceChange}
                lightDistanceInput={diagramLightDistanceInput}
                lightDistanceMm={diagramLightDistanceMm}
                onDiagramLightDistanceChange={handleDiagramLightDistanceChange}
                roiStrategy={module.roi_strategy || 'full'}
                moduleType={module.type || 'positioning'}
                interactive={true}
                cameraPos={cameraPos}
                lightPos={lightPos}
                cameraRotation={cameraRotation}
                lightRotation={lightRotation}
                onCameraPosChange={handleCameraPosChange}
                onLightPosChange={handleLightPosChange}
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
            workingDistanceInput={workingDistanceInput}
            workingDistanceMm={workingDistanceMm}
            fovWidthMm={fovWidthMm}
            onWorkingDistanceChange={handleWorkingDistanceChange}
            lightDistanceInput={diagramLightDistanceInput}
            lightDistanceMm={diagramLightDistanceMm}
            onDiagramLightDistanceChange={handleDiagramLightDistanceChange}
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
