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
  Ruler,
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
import { resolveModuleHardwareSelection } from '@/utils/moduleHardwareSlots';
import {
  type DistanceUnit,
  formatDistanceInput,
  normalizeDistanceUnit,
  signedToMillimeters,
  toMillimeters,
} from '@/utils/distanceUnits';
import {
  getFirstModuleLightItem,
  normalizeModuleLightItems,
  type ModuleLightItem,
} from '@/utils/moduleLightItems';
import { createSchematicImageSignature } from '@/utils/schematicImageSignature';
import {
  getActiveModuleConfig,
  getObjectRecord,
  isActiveModule3DCamera,
  normalizeTwoDCameraType,
} from '@/utils/moduleConfig';
import { getThreeDDisplayInfo, serializeThreeDConfig } from '@/components/forms/module/threeDCamera';

const moduleTypeIcons = {
  positioning: Crosshair,
  defect: ScanLine,
  ocr: Type,
  measurement: Ruler,
  deeplearning: Brain,
};

const moduleTypeLabels = {
  ocr: '识别',
  measurement: '测量',
  positioning: '定位',
  defect: '检测',
  deeplearning: '深度学习（算法手段）',
};

const DEFAULT_CAMERA_POS = { x: 275, y: 77 };
const DEFAULT_LIGHT_POS = { x: 275, y: 231 };
const DEFAULT_FOV_ANGLE = 45;
const DEFAULT_LIGHT_DISTANCE = 335;
const SCHEMATIC_PRODUCT_Y = 420;
const SCHEMATIC_PRODUCT_CENTER_X = 275;
const SCHEMATIC_PRODUCT_HEIGHT = 40;
const DEFAULT_PRODUCT_POS = { x: SCHEMATIC_PRODUCT_CENTER_X, y: SCHEMATIC_PRODUCT_Y };
const PRODUCT_MIN_Y = 300;
const PRODUCT_MAX_Y = 430;
const SCHEMATIC_DISTANCE_SCALE = DEFAULT_LIGHT_DISTANCE / (SCHEMATIC_PRODUCT_Y - 175);
const LENS_BOTTOM_OFFSET_FROM_ROTATION_CENTER = 82;
const CAMERA_BOTTOM_OFFSET_FROM_ROTATION_CENTER = 30;

type SchematicPoint = { x: number; y: number };

interface SchematicLayoutState {
  camera?: SchematicPoint;
  light?: SchematicPoint;
  product?: SchematicPoint;
  lights?: Array<{ id: string; position: SchematicPoint; rotation?: number }>;
  cameraRotation?: number;
  lightRotation?: number;
  fovAngle?: number;
  lightDistance?: number;
  savedImageSignature?: string;
}

function isSchematicLayout(value: unknown): value is SchematicLayoutState {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function clampProductPosition(pos: SchematicPoint): SchematicPoint {
  return {
    x: DEFAULT_PRODUCT_POS.x,
    y: Math.max(PRODUCT_MIN_Y, Math.min(PRODUCT_MAX_Y, pos.y)),
  };
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getModuleConfig(module: any): any | null {
  return getActiveModuleConfig(module);
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

function parseAngle(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLightCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(12, Math.round(parsed)));
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

function getAdaptiveDistanceScale(values: Array<number | null | undefined>) {
  const maxDistance = values.reduce((max, value) => {
    return typeof value === 'number' && Number.isFinite(value) && value > max ? value : max;
  }, DEFAULT_LIGHT_DISTANCE);

  // Keep the largest displayed distance within a comfortable vertical span.
  return Math.max(SCHEMATIC_DISTANCE_SCALE, maxDistance / 260);
}

function getOpticalBottomOffset(is3DCamera: boolean) {
  return is3DCamera ? CAMERA_BOTTOM_OFFSET_FROM_ROTATION_CENTER : LENS_BOTTOM_OFFSET_FROM_ROTATION_CENTER;
}

function getCameraYForWorkingDistance(workingDistanceMm: number, cameraRotation: number, distanceScale: number, is3DCamera: boolean, productY: number) {
  const rotationRad = cameraRotation * Math.PI / 180;
  const rotatedLensOffsetY = 55 + (getOpticalBottomOffset(is3DCamera) * Math.cos(rotationRad));
  const targetY = productY - (workingDistanceMm / distanceScale) - rotatedLensOffsetY;
  return Math.max(16, Math.min(260, targetY));
}

function getWorkingDistanceForCameraY(cameraY: number, cameraRotation: number, distanceScale: number, is3DCamera: boolean, productY: number) {
  const rotationRad = cameraRotation * Math.PI / 180;
  const rotatedLensOffsetY = 55 + (getOpticalBottomOffset(is3DCamera) * Math.cos(rotationRad));
  return Math.max(0, Math.round((productY - cameraY - rotatedLensOffsetY) * distanceScale));
}

export function getLightYForDistance(
  lightDistanceMm: number,
  distanceScale: number,
  productY: number,
  productHeight = SCHEMATIC_PRODUCT_HEIGHT,
) {
  const productBottomY = productY + productHeight;
  const targetY = lightDistanceMm >= 0
    ? productY - (lightDistanceMm / distanceScale)
    : productBottomY + (Math.abs(lightDistanceMm) / distanceScale);
  return Math.max(24, Math.min(620, targetY));
}

function getLightXForHorizontalDistance(horizontalDistanceMm: number, distanceScale: number, productX: number) {
  return Math.max(80, Math.min(470, productX + (horizontalDistanceMm / distanceScale)));
}

export function getLightVerticalDistanceForY(
  lightY: number,
  distanceScale: number,
  productY: number,
  productHeight = SCHEMATIC_PRODUCT_HEIGHT,
) {
  const productBottomY = productY + productHeight;
  if (lightY <= productY) return Math.round((productY - lightY) * distanceScale);
  if (lightY >= productBottomY) return -Math.round((lightY - productBottomY) * distanceScale);

  const distanceToTop = lightY - productY;
  const distanceToBottom = productBottomY - lightY;
  return distanceToTop <= distanceToBottom
    ? Math.round(distanceToTop * distanceScale)
    : -Math.round(distanceToBottom * distanceScale);
}

function getLightHorizontalDistanceForX(lightX: number, distanceScale: number, productX: number) {
  return Math.round((lightX - productX) * distanceScale);
}

export function ModuleSchematic() {
  const { 
    selectedModuleId, 
    selectedWorkstationId,
    modules, 
    workstations, 
    projects,
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
  const [productPos, setProductPos] = useState(DEFAULT_PRODUCT_POS);
  const [lightLayouts, setLightLayouts] = useState<Record<string, { position: SchematicPoint; rotation: number }>>({});
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
  const project = workstation ? projects.find(p => p.id === workstation.project_id) as any : null;
  const layout = layouts.find(l => l.workstation_id === selectedWorkstationId) as any;
  const savedLayout = useMemo<SchematicLayoutState | null>(
    () => isSchematicLayout(module?.schematic_layout) ? (module.schematic_layout as SchematicLayoutState) : null,
    [module?.schematic_layout],
  );
  const liveForm = selectedModuleId ? moduleLiveForms[selectedModuleId]?.form : undefined;
  const distanceUnit = normalizeDistanceUnit(
    liveForm ? liveForm.distanceUnit : getPersistedImagingField(module, 'distanceUnit'),
  );
  const is3DCamera = liveForm
    ? Boolean(liveForm.is3DCamera)
    : isActiveModule3DCamera(module, Boolean(project?.use_3d));
  const persistedConfig = getModuleConfig(module);
  const persistedImaging = persistedConfig?.imaging || {};
  const twoDCameraType = normalizeTwoDCameraType(
    liveForm?.twoDCameraType ?? persistedImaging.twoDCameraType,
  );
  const isLineScan = !is3DCamera && twoDCameraType === 'line_scan';
  const persistedLineScan = getObjectRecord(persistedImaging.lineScan) || {};
  const liveLineScan = getObjectRecord(liveForm?.lineScan);
  const effectiveLineScan = liveForm && Object.prototype.hasOwnProperty.call(liveForm, 'lineScan')
    ? (liveLineScan || {})
    : persistedLineScan;
  const moduleLightItems = useMemo(() => {
    if (is3DCamera) return [];
    return normalizeModuleLightItems(liveForm?.lightItems ?? persistedImaging.lightItems, {
      selectedLight: liveForm?.selectedLight || module?.selected_light || module?.light_id || '',
      lightMode: liveForm?.lightMode ?? persistedImaging.lightMode ?? '',
      lightAngle: liveForm?.lightAngle ?? persistedImaging.lightAngle ?? '',
      lightDistance: liveForm?.lightDistance ?? persistedImaging.lightDistance ?? '',
      lightDistanceHorizontal: liveForm?.lightDistanceHorizontal ?? persistedImaging.lightDistanceHorizontal ?? '',
      lightDistanceVertical: liveForm?.lightDistanceVertical ?? persistedImaging.lightDistanceVertical ?? '',
      lightNote: liveForm?.lightNote ?? persistedImaging.lightNote ?? '',
    });
  }, [
    liveForm?.lightItems,
    liveForm?.selectedLight,
    liveForm?.lightMode,
    liveForm?.lightAngle,
    liveForm?.lightDistance,
    liveForm?.lightDistanceHorizontal,
    liveForm?.lightDistanceVertical,
    liveForm?.lightNote,
    is3DCamera,
    module?.selected_light,
    module?.light_id,
    persistedImaging.lightItems,
    persistedImaging.lightMode,
    persistedImaging.lightAngle,
    persistedImaging.lightDistance,
    persistedImaging.lightDistanceHorizontal,
    persistedImaging.lightDistanceVertical,
    persistedImaging.lightNote,
  ]);
  const firstLightItem = getFirstModuleLightItem(moduleLightItems);
  const workingDistanceInput = liveForm ? String(liveForm.workingDistance ?? '') : getPersistedWorkingDistance(module);
  const workingDistanceToleranceInput = liveForm
    ? String(liveForm.workingDistanceTolerance ?? '')
    : getPersistedImagingField(module, 'workingDistanceTolerance');
  const workingDistanceMm = toMillimeters(workingDistanceInput, distanceUnit);
  const diagramLightDistanceInput = firstLightItem?.lightDistance || '';
  const lightDistanceVerticalInput = firstLightItem?.lightDistanceVertical || '';
  const lightDistanceHorizontalInput = firstLightItem?.lightDistanceHorizontal || '';
  const diagramLightDistanceMm = toMillimeters(diagramLightDistanceInput, distanceUnit);
  const lightDistanceVerticalMm = signedToMillimeters(lightDistanceVerticalInput, distanceUnit);
  const lightDistanceHorizontalMm = signedToMillimeters(lightDistanceHorizontalInput, distanceUnit);
  const lightCount = is3DCamera ? 0 : moduleLightItems.length || parseLightCount(liveForm ? liveForm.lightCount : getPersistedImagingField(module, 'lightCount'));
  const lightAngleDeg = parseAngle(firstLightItem?.lightAngle ?? '');
  const resolvedLightHorizontalMm = lightDistanceHorizontalMm ?? 0;
  const resolvedLightVerticalMm =
    lightDistanceVerticalMm ??
    (diagramLightDistanceMm !== null && diagramLightDistanceMm >= Math.abs(resolvedLightHorizontalMm)
      ? Math.sqrt((diagramLightDistanceMm * diagramLightDistanceMm) - (resolvedLightHorizontalMm * resolvedLightHorizontalMm))
      : null);
  const resolvedDiagramLightDistanceMm =
    diagramLightDistanceMm ??
    (resolvedLightVerticalMm !== null
      ? Math.sqrt((resolvedLightHorizontalMm * resolvedLightHorizontalMm) + (resolvedLightVerticalMm * resolvedLightVerticalMm))
      : null);
  const fovInput = isLineScan
    ? String(effectiveLineScan.fieldOfView ?? '')
    : (liveForm ? getLiveFov(liveForm) : getPersistedFov(module));
  const fovWidthMm = isLineScan
    ? toMillimeters(fovInput, distanceUnit)
    : liveForm?.fieldOfViewWidth
      ? toMillimeters(liveForm.fieldOfViewWidth, distanceUnit)
      : (() => {
        const parsed = parseFovWidth(fovInput);
        return parsed === null ? null : parsed * (distanceUnit === 'm' ? 1000 : distanceUnit === 'cm' ? 10 : 1);
      })();
  const distanceScale = getAdaptiveDistanceScale([
    workingDistanceMm,
    fovWidthMm,
    resolvedDiagramLightDistanceMm,
    resolvedLightVerticalMm === null ? null : Math.abs(resolvedLightVerticalMm),
    Math.abs(resolvedLightHorizontalMm),
    ...moduleLightItems.flatMap(item => {
      const h = signedToMillimeters(item.lightDistanceHorizontal, distanceUnit);
      return [
        toMillimeters(item.lightDistance, distanceUnit),
        (() => {
          const v = signedToMillimeters(item.lightDistanceVertical, distanceUnit);
          return v === null ? null : Math.abs(v);
        })(),
        h === null ? null : Math.abs(h),
      ];
    }),
  ]);
  const selectedCameraId = liveForm?.selectedCamera || module?.selected_camera || module?.camera_id || null;
  const selectedLensId = is3DCamera ? null : (liveForm?.selectedLens || module?.selected_lens || module?.lens_id || null);
  const selectedLightId = is3DCamera ? null : (firstLightItem?.selectedLight || liveForm?.selectedLight || module?.selected_light || module?.light_id || null);
  const selectedControllerId = liveForm?.selectedController || module?.selected_controller || module?.controller_id || null;
  const resolvedCamera = useMemo(
    () => resolveModuleHardwareSelection(selectedCameraId, layout, 'camera', cameras),
    [selectedCameraId, layout, cameras],
  );
  const resolvedLens = useMemo(
    () => resolveModuleHardwareSelection(selectedLensId, layout, 'lens', lenses),
    [selectedLensId, layout, lenses],
  );
  const resolvedLight = useMemo(
    () => resolveModuleHardwareSelection(selectedLightId, layout, 'light', lights),
    [selectedLightId, layout, lights],
  );
  const resolvedDiagramLightItems = useMemo(() => {
    if (is3DCamera) return [];
    return moduleLightItems.map((item, index) => {
      const resolved = resolveModuleHardwareSelection(item.selectedLight, layout, 'light', lights);
      const horizontalMm = signedToMillimeters(item.lightDistanceHorizontal, distanceUnit) ?? 0;
      const verticalMm = signedToMillimeters(item.lightDistanceVertical, distanceUnit);
      const distanceMm = toMillimeters(item.lightDistance, distanceUnit)
        ?? (verticalMm !== null ? Math.sqrt(horizontalMm * horizontalMm + verticalMm * verticalMm) : null);
      const fallbackY = verticalMm !== null ? getLightYForDistance(verticalMm, distanceScale, productPos.y) : DEFAULT_LIGHT_POS.y + index * 34;
      const fallbackX = getLightXForHorizontalDistance(horizontalMm, distanceScale, productPos.x);
      const stored = lightLayouts[item.id];
      return {
        id: item.id,
        label: `LIGHT${index + 1}`,
        light: resolved?.item || null,
        position: stored?.position || { x: fallbackX, y: fallbackY },
        rotation: parseAngle(item.lightAngle) ?? stored?.rotation ?? 0,
        distanceInput: item.lightDistance,
        distanceMm,
        horizontalMm,
        verticalMm,
        angle: item.lightAngle,
      };
    });
  }, [distanceScale, distanceUnit, is3DCamera, layout, lightLayouts, lights, moduleLightItems]);
  const resolvedController = useMemo(
    () => resolveModuleHardwareSelection(selectedControllerId, layout, 'controller', controllers),
    [selectedControllerId, layout, controllers],
  );
  const threeDConfigForSignature = useMemo(() => {
    if (!is3DCamera) return null;
    const base = liveForm ? serializeThreeDConfig(liveForm) : (persistedConfig?.three_d ?? null);
    return {
      ...(base && typeof base === 'object' ? base : {}),
      workingDistance: liveForm ? liveForm.workingDistance : getPersistedImagingField(module, 'workingDistance'),
      workingDistanceTolerance: liveForm ? liveForm.workingDistanceTolerance : getPersistedImagingField(module, 'workingDistanceTolerance'),
    };
  }, [
    is3DCamera,
    liveForm,
    module,
    persistedConfig?.three_d,
  ]);
  const threeDInfo = useMemo(
    () => getThreeDDisplayInfo(threeDConfigForSignature || {}),
    [threeDConfigForSignature],
  );
  const currentImageSignature = useMemo(
    () => createSchematicImageSignature({
      cameraId: selectedCameraId,
      lensId: selectedLensId,
      lightId: selectedLightId,
      controllerId: selectedControllerId,
      camera: cameraPos,
      light: lightPos,
      product: productPos,
      cameraRotation,
      lightRotation,
      fovAngle,
      lightDistance,
      workingDistanceInput,
      workingDistanceMm,
      workingDistanceToleranceInput,
      fovWidthMm,
      diagramLightDistanceInput,
      diagramLightDistanceMm: resolvedDiagramLightDistanceMm,
      lightDistanceHorizontalMm: resolvedLightHorizontalMm,
      lightDistanceVerticalMm: resolvedLightVerticalMm,
      lightCount,
      lightItems: resolvedDiagramLightItems.map(item => ({
        id: item.id,
        hardwareId: item.light?.id || null,
        position: item.position,
        rotation: item.rotation,
        distanceMm: item.distanceMm,
        distanceInput: item.distanceInput,
        horizontalMm: item.horizontalMm,
        verticalMm: item.verticalMm,
        angle: item.angle,
      })),
      is3DCamera,
      twoDCameraType,
      distanceUnit,
      threeDConfig: threeDConfigForSignature,
    }),
    [
      cameraPos,
      cameraRotation,
      resolvedDiagramLightDistanceMm,
      diagramLightDistanceInput,
      distanceUnit,
      fovWidthMm,
      fovAngle,
      lightDistance,
      resolvedLightHorizontalMm,
      lightCount,
      resolvedDiagramLightItems,
      is3DCamera,
      twoDCameraType,
      lightPos,
      lightRotation,
      productPos,
      resolvedLightVerticalMm,
      selectedCameraId,
      selectedControllerId,
      selectedLensId,
      selectedLightId,
      threeDConfigForSignature,
      workingDistanceMm,
      workingDistanceInput,
      workingDistanceToleranceInput,
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
      setProductPos(saved.product ? clampProductPosition({ x: saved.product.x ?? DEFAULT_PRODUCT_POS.x, y: saved.product.y ?? DEFAULT_PRODUCT_POS.y }) : DEFAULT_PRODUCT_POS);
      if (Array.isArray(saved.lights)) {
        const nextLightLayouts = saved.lights.reduce<Record<string, { position: SchematicPoint; rotation: number }>>((acc, item) => {
          if (!item?.id || !item.position) return acc;
          acc[item.id] = {
            position: {
              x: item.position.x ?? DEFAULT_LIGHT_POS.x,
              y: item.position.y ?? DEFAULT_LIGHT_POS.y,
            },
            rotation: typeof item.rotation === 'number' ? item.rotation : 0,
          };
          return acc;
        }, {});
        setLightLayouts(nextLightLayouts);
      } else {
        setLightLayouts({});
      }
      if (typeof saved.cameraRotation === 'number') setCameraRotation(saved.cameraRotation);
      if (typeof saved.lightRotation === 'number') setLightRotation(saved.lightRotation);
      if (typeof saved.fovAngle === 'number') setFovAngle(saved.fovAngle);
      if (typeof saved.lightDistance === 'number') setLightDistance(saved.lightDistance);
    } else {
      setCameraPos(DEFAULT_CAMERA_POS);
      setLightPos(DEFAULT_LIGHT_POS);
      setProductPos(DEFAULT_PRODUCT_POS);
      setLightLayouts({});
      setCameraRotation(0);
      setLightRotation(0);
      setFovAngle(DEFAULT_FOV_ANGLE);
      setLightDistance(DEFAULT_LIGHT_DISTANCE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module?.id]);

  useEffect(() => {
    if (!workingDistanceMm) return;
    const nextY = getCameraYForWorkingDistance(workingDistanceMm, cameraRotation, distanceScale, is3DCamera, productPos.y);
    setCameraPos(prev => (
      Math.abs(prev.y - nextY) < 0.5
        ? prev
        : { ...prev, y: nextY }
    ));
  }, [cameraRotation, distanceScale, is3DCamera, module?.id, workingDistanceMm]);

  useEffect(() => {
    if (resolvedLightVerticalMm === null && lightDistanceHorizontalMm === null) return;
    setLightPos(prev => {
      const nextY = resolvedLightVerticalMm !== null ? getLightYForDistance(resolvedLightVerticalMm, distanceScale, productPos.y) : prev.y;
      const nextX = getLightXForHorizontalDistance(resolvedLightHorizontalMm, distanceScale, productPos.x);
      if (Math.abs(prev.x - nextX) < 0.5 && Math.abs(prev.y - nextY) < 0.5) return prev;
      return { x: nextX, y: nextY };
    });
  }, [distanceScale, lightDistanceHorizontalMm, module?.id, resolvedLightHorizontalMm, resolvedLightVerticalMm]);

  useEffect(() => {
    if (moduleLightItems.length === 0) return;
    setLightLayouts(prev => {
      let changed = false;
      const next = { ...prev };
      moduleLightItems.forEach(item => {
        const horizontalMm = signedToMillimeters(item.lightDistanceHorizontal, distanceUnit);
        const verticalMm = signedToMillimeters(item.lightDistanceVertical, distanceUnit);
        if (horizontalMm === null && verticalMm === null) return;
        const existing = next[item.id];
        const nextPos = {
          x: horizontalMm !== null ? getLightXForHorizontalDistance(horizontalMm, distanceScale, productPos.x) : existing?.position.x ?? DEFAULT_LIGHT_POS.x,
          y: verticalMm !== null ? getLightYForDistance(verticalMm, distanceScale, productPos.y) : existing?.position.y ?? DEFAULT_LIGHT_POS.y,
        };
        const nextRotation = parseAngle(item.lightAngle) ?? existing?.rotation ?? 0;
        if (!existing || Math.abs(existing.position.x - nextPos.x) >= 0.5 || Math.abs(existing.position.y - nextPos.y) >= 0.5 || Math.abs(existing.rotation - nextRotation) >= 0.5) {
          next[item.id] = { position: nextPos, rotation: nextRotation };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [distanceScale, distanceUnit, module?.id, moduleLightItems]);

  useEffect(() => {
    if (lightAngleDeg === null) return;
    const nextAngle = Math.max(-180, Math.min(180, lightAngleDeg));
    setLightRotation(prev => (Math.abs(prev - nextAngle) < 0.5 ? prev : nextAngle));
  }, [lightAngleDeg, module?.id]);

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
          product: productPos,
          lights: is3DCamera ? [] : resolvedDiagramLightItems.map(item => ({
            id: item.id,
            position: item.position,
            rotation: item.rotation,
          })),
          cameraRotation,
          lightRotation,
          fovAngle,
          lightDistance,
          lightCount: is3DCamera ? 0 : lightCount,
          savedImageSignature: savedImageSignatureRef.current,
        },
      } as any).catch((err) => console.warn('Failed to persist schematic layout:', err));
    }, 600);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPos.x, cameraPos.y, lightPos.x, lightPos.y, productPos.x, productPos.y, cameraRotation, lightRotation, fovAngle, is3DCamera, lightDistance, lightCount, resolvedDiagramLightItems, module?.id]);

  // All hooks must be above early returns
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
    const nextWorkingDistanceMm = getWorkingDistanceForCameraY(pos.y, cameraRotation, distanceScale, is3DCamera, productPos.y);
    patchModuleLiveForm(module.id, {
      workingDistance: formatDistanceInput(nextWorkingDistanceMm, distanceUnit),
    });
  }, [cameraRotation, distanceScale, distanceUnit, is3DCamera, module?.id, patchModuleLiveForm, productPos.y]);

  const handleDiagramLightDistanceChange = useCallback((value: string) => {
    if (!module) return;
    const nextDistanceMm = toMillimeters(value, distanceUnit);
    const patch: Record<string, string> = { lightDistance: value };
    if (nextDistanceMm !== null && nextDistanceMm >= Math.abs(resolvedLightHorizontalMm)) {
      const verticalSign = resolvedLightVerticalMm !== null && resolvedLightVerticalMm < 0 ? -1 : 1;
      const nextVerticalMm = Math.sqrt((nextDistanceMm * nextDistanceMm) - (resolvedLightHorizontalMm * resolvedLightHorizontalMm));
      patch.lightDistanceVertical = formatDistanceInput(nextVerticalMm * verticalSign, distanceUnit);
    }
    patchModuleLiveForm(module.id, {
      ...patch,
    });
  }, [distanceUnit, module?.id, patchModuleLiveForm, resolvedLightHorizontalMm, resolvedLightVerticalMm]);

  const handleLightPosChange = useCallback((pos: SchematicPoint) => {
    setLightPos(pos);
    if (!module) return;
    const verticalDistance = getLightVerticalDistanceForY(pos.y, distanceScale, productPos.y);
    const horizontalDistance = getLightHorizontalDistanceForX(pos.x, distanceScale, productPos.x);
    const shortestDistance = Math.sqrt((horizontalDistance * horizontalDistance) + (verticalDistance * verticalDistance));
    patchModuleLiveForm(module.id, {
      lightDistance: formatDistanceInput(shortestDistance, distanceUnit),
      lightDistanceHorizontal: formatDistanceInput(horizontalDistance, distanceUnit),
      lightDistanceVertical: formatDistanceInput(verticalDistance, distanceUnit),
    });
  }, [distanceScale, distanceUnit, module?.id, patchModuleLiveForm, productPos.x, productPos.y]);

  const patchLightItemsLiveForm = useCallback((nextItems: ModuleLightItem[]) => {
    if (!module) return;
    const first = getFirstModuleLightItem(nextItems);
    patchModuleLiveForm(module.id, {
      lightItems: nextItems,
      selectedLight: first?.selectedLight || '',
      lightMode: first?.lightMode || '',
      lightAngle: first?.lightAngle || '',
      lightCount: nextItems.length ? String(nextItems.length) : '',
      lightDistance: first?.lightDistance || '',
      lightDistanceHorizontal: first?.lightDistanceHorizontal || '',
      lightDistanceVertical: first?.lightDistanceVertical || '',
      lightNote: first?.lightNote || '',
    });
  }, [module?.id, patchModuleLiveForm]);

  const handleProductPosChange = useCallback((pos: SchematicPoint) => {
    const nextPos = clampProductPosition(pos);
    setProductPos(nextPos);
    if (!module) return;

    const nextWorkingDistanceMm = getWorkingDistanceForCameraY(cameraPos.y, cameraRotation, distanceScale, is3DCamera, nextPos.y);
    const nextItems = moduleLightItems.map(item => {
      const diagramItem = resolvedDiagramLightItems.find(lightItem => lightItem.id === item.id);
      const position = diagramItem?.position ?? lightPos;
      const verticalDistance = getLightVerticalDistanceForY(position.y, distanceScale, nextPos.y);
      const horizontalDistance = getLightHorizontalDistanceForX(position.x, distanceScale, nextPos.x);
      const shortestDistance = Math.sqrt((horizontalDistance * horizontalDistance) + (verticalDistance * verticalDistance));
      return {
        ...item,
        lightDistance: formatDistanceInput(shortestDistance, distanceUnit),
        lightDistanceHorizontal: formatDistanceInput(horizontalDistance, distanceUnit),
        lightDistanceVertical: formatDistanceInput(verticalDistance, distanceUnit),
      };
    });
    const first = getFirstModuleLightItem(nextItems);

    if (nextItems.length > 0) {
      patchModuleLiveForm(module.id, {
        workingDistance: formatDistanceInput(nextWorkingDistanceMm, distanceUnit),
        lightItems: nextItems,
        selectedLight: first?.selectedLight || '',
        lightMode: first?.lightMode || '',
        lightAngle: first?.lightAngle || '',
        lightCount: nextItems.length ? String(nextItems.length) : '',
        lightDistance: first?.lightDistance || '',
        lightDistanceHorizontal: first?.lightDistanceHorizontal || '',
        lightDistanceVertical: first?.lightDistanceVertical || '',
        lightNote: first?.lightNote || '',
      });
      return;
    }

    const verticalDistance = getLightVerticalDistanceForY(lightPos.y, distanceScale, nextPos.y);
    const horizontalDistance = getLightHorizontalDistanceForX(lightPos.x, distanceScale, nextPos.x);
    const shortestDistance = Math.sqrt((horizontalDistance * horizontalDistance) + (verticalDistance * verticalDistance));
    patchModuleLiveForm(module.id, {
      workingDistance: formatDistanceInput(nextWorkingDistanceMm, distanceUnit),
      lightDistance: formatDistanceInput(shortestDistance, distanceUnit),
      lightDistanceHorizontal: formatDistanceInput(horizontalDistance, distanceUnit),
      lightDistanceVertical: formatDistanceInput(verticalDistance, distanceUnit),
    });
  }, [
    cameraPos.y,
    cameraRotation,
    distanceScale,
    distanceUnit,
    is3DCamera,
    lightPos,
    module?.id,
    moduleLightItems,
    patchModuleLiveForm,
    resolvedDiagramLightItems,
  ]);

  const handleDiagramLightItemDistanceChange = useCallback((id: string, value: string) => {
    const nextDistanceMm = toMillimeters(value, distanceUnit);
    const nextItems = moduleLightItems.map(item => {
      if (item.id !== id) return item;
      const horizontalMm = signedToMillimeters(item.lightDistanceHorizontal, distanceUnit) ?? 0;
      const currentVerticalMm = signedToMillimeters(item.lightDistanceVertical, distanceUnit);
      const verticalSign = currentVerticalMm !== null && currentVerticalMm < 0 ? -1 : 1;
      const patch: Partial<ModuleLightItem> = { lightDistance: value };
      if (nextDistanceMm !== null && nextDistanceMm >= Math.abs(horizontalMm)) {
        patch.lightDistanceVertical = formatDistanceInput(
          Math.sqrt((nextDistanceMm * nextDistanceMm) - (horizontalMm * horizontalMm)) * verticalSign,
          distanceUnit,
        );
      }
      return { ...item, ...patch };
    });
    patchLightItemsLiveForm(nextItems);
  }, [distanceUnit, moduleLightItems, patchLightItemsLiveForm]);

  const handleDiagramLightItemPositionChange = useCallback((id: string, pos: SchematicPoint) => {
    setLightLayouts(prev => ({
      ...prev,
      [id]: {
        position: pos,
        rotation: prev[id]?.rotation ?? parseAngle(moduleLightItems.find(item => item.id === id)?.lightAngle) ?? 0,
      },
    }));

    const verticalDistance = getLightVerticalDistanceForY(pos.y, distanceScale, productPos.y);
    const horizontalDistance = getLightHorizontalDistanceForX(pos.x, distanceScale, productPos.x);
    const shortestDistance = Math.sqrt((horizontalDistance * horizontalDistance) + (verticalDistance * verticalDistance));
    const nextItems = moduleLightItems.map(item => (
      item.id === id
        ? {
            ...item,
            lightDistance: formatDistanceInput(shortestDistance, distanceUnit),
            lightDistanceHorizontal: formatDistanceInput(horizontalDistance, distanceUnit),
            lightDistanceVertical: formatDistanceInput(verticalDistance, distanceUnit),
          }
        : item
    ));
    patchLightItemsLiveForm(nextItems);
  }, [distanceScale, distanceUnit, moduleLightItems, patchLightItemsLiveForm, productPos.x, productPos.y]);

  const handleLightRotationChange = useCallback((angle: number) => {
    const nextAngle = Math.max(-180, Math.min(180, Math.round(angle)));
    setLightRotation(nextAngle);
    if (!module) return;
    patchModuleLiveForm(module.id, { lightAngle: String(nextAngle) });
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

  const selectedCamera = resolvedCamera?.item || null;
  const selectedLens = resolvedLens?.item || null;
  const selectedLight = resolvedLight?.item || null;
  const selectedController = resolvedController?.item || null;
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
          product: productPos,
          lights: is3DCamera ? [] : resolvedDiagramLightItems.map(item => ({
            id: item.id,
            position: item.position,
            rotation: item.rotation,
          })),
          cameraRotation,
          lightRotation,
          fovAngle,
          lightDistance,
          lightCount: is3DCamera ? 0 : lightCount,
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
                lens={is3DCamera ? null : selectedLens || null}
                light={is3DCamera ? null : selectedLight || null}
                controller={selectedController || null}
                is3DCamera={is3DCamera}
                lightDistance={lightDistance}
                lightCount={is3DCamera ? 0 : lightCount}
                fovAngle={fovAngle}
                onFovAngleChange={handleFovAngleChange}
                onLightDistanceChange={handleLightDistanceChange}
                workingDistanceInput={workingDistanceInput}
                workingDistanceMm={workingDistanceMm}
                workingDistanceToleranceInput={workingDistanceToleranceInput}
                fovWidthMm={fovWidthMm}
                distanceUnit={distanceUnit}
                onWorkingDistanceChange={handleWorkingDistanceChange}
                lightDistanceInput={diagramLightDistanceInput}
                lightDistanceMm={resolvedDiagramLightDistanceMm}
                threeDInfo={threeDInfo}
                onDiagramLightDistanceChange={handleDiagramLightDistanceChange}
                diagramLightItems={is3DCamera ? [] : resolvedDiagramLightItems}
                onDiagramLightItemPositionChange={handleDiagramLightItemPositionChange}
                onDiagramLightItemDistanceChange={handleDiagramLightItemDistanceChange}
                roiStrategy={module.roi_strategy || 'full'}
                moduleType={module.type || 'positioning'}
                interactive={true}
                cameraPos={cameraPos}
                lightPos={lightPos}
                productPos={productPos}
                cameraRotation={cameraRotation}
                lightRotation={lightRotation}
                onCameraPosChange={handleCameraPosChange}
                onLightPosChange={handleLightPosChange}
                onProductPosChange={handleProductPosChange}
                onCameraRotationChange={setCameraRotation}
                onLightRotationChange={handleLightRotationChange}
                className="w-full h-full"
              />

              {/* Module Info Badge */}
              <div data-screenshot-hide className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <ModuleIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{module.name}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>分类: {moduleTypeLabels[(module.type || 'positioning') as keyof typeof moduleTypeLabels] || module.type || 'positioning'}</div>
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
            lens={is3DCamera ? null : selectedLens || null}
            light={is3DCamera ? null : selectedLight || null}
            controller={selectedController || null}
            is3DCamera={is3DCamera}
            lightDistance={lightDistance}
            lightCount={is3DCamera ? 0 : lightCount}
            fovAngle={fovAngle}
            onFovAngleChange={handleFovAngleChange}
            onLightDistanceChange={handleLightDistanceChange}
            workingDistanceInput={workingDistanceInput}
            workingDistanceMm={workingDistanceMm}
            fovWidthMm={fovWidthMm}
            distanceUnit={distanceUnit}
            onWorkingDistanceChange={handleWorkingDistanceChange}
            lightDistanceInput={diagramLightDistanceInput}
            lightDistanceMm={resolvedDiagramLightDistanceMm}
            threeDInfo={threeDInfo}
            onDiagramLightDistanceChange={handleDiagramLightDistanceChange}
            diagramLightItems={is3DCamera ? [] : resolvedDiagramLightItems}
            roiStrategy={module.roi_strategy || 'full'}
            moduleType={module.type || 'positioning'}
            interactive={false}
            cameraPos={cameraPos}
            lightPos={lightPos}
            productPos={productPos}
            cameraRotation={cameraRotation}
            lightRotation={lightRotation}
            className="vision-diagram-container w-full h-full"
          />
        </div>
      )}
    </div>
  );
}
