import { Camera, Light, Lens, Controller } from '@/hooks/useHardware';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type DistanceUnit,
  formatDistanceDisplay,
  formatDistanceInput,
  formatDistanceInputText,
  formatDistanceLabel,
  normalizeDistanceUnit,
} from '@/utils/distanceUnits';
import type { ThreeDDisplayInfo } from '@/components/forms/module/threeDCamera';
import { resolveSensorDimensions, parseResolution } from '@/utils/imagingCalculations';
import { isTelecentricHardware, getOpticalFieldLabels } from '@/utils/telecentric';

// ─── Display helpers for camera / lens / FOV cards ───
function formatOpticalFormat(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/["”'']/g, '');
  if (!s) return null;
  return `${s}"光学格式`;
}

function formatLensSupportedSensor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/["”'']/g, '');
  if (!s) return null;
  return `支持 ${s}"靶面`;
}

function getCameraSensorInfo(camera: Camera | null | undefined) {
  if (!camera) return { effectiveSensorText: null as string | null, pixelText: null as string | null, sourceLabel: null as string | null };
  const resolution = camera.resolution ? parseResolution(camera.resolution) : null;
  const resolved = resolveSensorDimensions(camera.sensor_size, {
    pixelSizeUm: camera.pixel_size_um ?? undefined,
    sensorWidthMm: camera.sensor_width_mm ?? undefined,
    sensorHeightMm: camera.sensor_height_mm ?? undefined,
    resolution: resolution || undefined,
  });
  // 只在 manual / pixel_size 来源时展示精确尺寸，sensor_map 估算时不展示具体毫米数避免误导
  let effectiveSensorText: string | null = null;
  if (resolved && (resolved.source === 'manual' || resolved.source === 'pixel_size')) {
    effectiveSensorText = `有效靶面 ${resolved.width.toFixed(2)} × ${resolved.height.toFixed(2)} mm`;
  }
  const pixelText = camera.pixel_size_um && camera.pixel_size_um > 0
    ? `像元 ${camera.pixel_size_um} μm`
    : null;
  return {
    effectiveSensorText,
    pixelText,
    sourceLabel: resolved?.sourceLabel ?? null,
  };
}

function getLensSupportedSensorText(lens: Lens | null | undefined): string | null {
  if (!lens) return null;
  const raw = (lens as unknown as Record<string, unknown>);
  const candidate = (raw.max_sensor_size as string | null | undefined)
    || (raw.supported_sensor_size as string | null | undefined)
    || (raw.max_sensor_format as string | null | undefined)
    || (raw.image_circle as string | null | undefined);
  return formatLensSupportedSensor(candidate);
}

function joinDotParts(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(' · ');
}

function estimateSvgTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const char of text) {
    if (/\s/.test(char)) units += 0.34;
    else if (/[\u4e00-\u9fff]/.test(char)) units += 1;
    else if (/[A-Z0-9]/.test(char)) units += 0.66;
    else if (/[a-z]/.test(char)) units += 0.56;
    else if (/[.,:;'"|]/.test(char)) units += 0.32;
    else if (/[-/·，、@×+]/.test(char)) units += 0.52;
    else units += 0.75;
  }
  return units * fontSize;
}

function splitSvgTextTokens(text: string): string[] {
  const breakChars = new Set([' ', '·', '，', '、', ',', '/', '@', '-']);
  const tokens: string[] = [];
  let token = '';

  for (const char of text) {
    token += char;
    if (breakChars.has(char)) {
      if (token.trim()) tokens.push(token);
      token = '';
    }
  }

  if (token.trim()) tokens.push(token);
  return tokens;
}

function splitOversizedSvgTextToken(token: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  let current = '';

  for (const char of token) {
    const candidate = `${current}${char}`;
    if (current && estimateSvgTextWidth(candidate, fontSize) > maxWidth) {
      lines.push(current.trim());
      current = char;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) lines.push(current.trim());
  return lines;
}

function wrapSvgText(text: string | null | undefined, maxWidth: number, fontSize: number): string[] {
  const source = String(text || '-').trim() || '-';
  const tokens = splitSvgTextTokens(source);
  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    const candidate = `${current}${token}`;
    if (estimateSvgTextWidth(candidate.trim(), fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current.trim()) {
      lines.push(current.trim());
      current = '';
    }

    if (estimateSvgTextWidth(token.trim(), fontSize) > maxWidth) {
      const split = splitOversizedSvgTextToken(token, maxWidth, fontSize);
      lines.push(...split.slice(0, -1));
      current = split[split.length - 1] || '';
    } else {
      current = token;
    }
  }

  if (current.trim()) lines.push(current.trim());
  return lines.length ? lines : ['-'];
}

const DEFAULT_PRODUCT_POS = { x: 275, y: 420 };
const PRODUCT_MIN_Y = 300;
const PRODUCT_MAX_Y = 430;
const PRODUCT_HEIGHT = 40;

function clampProductPosition(pos: { x: number; y: number }) {
  return {
    x: DEFAULT_PRODUCT_POS.x,
    y: Math.max(PRODUCT_MIN_Y, Math.min(PRODUCT_MAX_Y, pos.y)),
  };
}

// ─── Hardware image with fallback ───
function HardwareImage({ 
  url, alt, type, className 
}: { 
  url: string | null | undefined; 
  alt: string;
  type: 'camera' | 'lens' | 'light' | 'controller';
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const emoji = type === 'camera' ? '📷' : type === 'lens' ? '🔭' : type === 'light' ? '💡' : '🖥️';
  if (!url || hasError) return <span className="text-2xl">{emoji}</span>;
  return <img src={url} alt={alt} className={className || "w-full h-full object-cover"} onError={() => setHasError(true)} />;
}

// ─── Hardware selection popover ───
interface HardwareSelectPopoverProps {
  type: 'camera' | 'lens' | 'light' | 'controller';
  items: (Camera | Lens | Light | Controller)[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function HardwareSelectPopover({ type, items, selectedId, onSelect, children, disabled }: HardwareSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const typeLabels = { camera: '选择相机', lens: '选择镜头', light: '选择光源', controller: '选择工控机' };

  const getItemDetails = (item: Camera | Lens | Light | Controller) => {
    if ('resolution' in item && 'frame_rate' in item) return `${(item as Camera).resolution} @ ${(item as Camera).frame_rate}fps`;
    if ('focal_length' in item) {
      const sensorSize = (item as Lens).max_sensor_size || '-';
      return `${(item as Lens).focal_length} · 靶面${sensorSize}`;
    }
    if ('color' in item && 'power' in item) return `${(item as Light).color}${(item as Light).type} · ${(item as Light).power}`;
    if ('cpu' in item) return `${(item as Controller).cpu} · ${(item as Controller).memory}`;
    return '';
  };

  if (disabled) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-3 py-2 border-b border-border">
          <h4 className="font-semibold text-sm">{typeLabels[type]}</h4>
        </div>
        <ScrollArea className="h-64">
          <div className="p-2 space-y-1">
            {items.filter(i => i.enabled).map((item) => (
              <button
                key={item.id}
                onClick={() => { onSelect(item.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors hover:bg-accent",
                  selectedId === item.id && "bg-primary/10 border border-primary/30"
                )}
              >
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  <HardwareImage url={item.image_url} alt={item.model} type={type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{item.brand}</span>
                    {selectedId === item.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.model}</p>
                  <p className="text-xs text-muted-foreground">{getItemDetails(item)}</p>
                </div>
              </button>
            ))}
            {items.filter(i => i.enabled).length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">暂无可用{typeLabels[type].replace('选择', '')}</div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ─── Drag hook ───
function useSvgDrag(
  svgRef: React.RefObject<SVGSVGElement | null>,
  initial: { x: number; y: number },
  enabled: boolean,
  controlled?: { value: { x: number; y: number }; onChange?: (p: { x: number; y: number }) => void },
  constrain?: (p: { x: number; y: number }) => { x: number; y: number },
) {
  const [internalPos, setInternalPos] = useState(initial);
  const pos = controlled ? controlled.value : internalPos;
  const setPos = (p: { x: number; y: number }) => {
    const next = constrain ? constrain(p) : p;
    if (controlled) controlled.onChange?.(next);
    else setInternalPos(next);
  };
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!controlled) setInternalPos(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.x, initial.y]);

  const toSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, [svgRef]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    const svgPt = toSvgCoords(e.clientX, e.clientY);
    offset.current = { x: svgPt.x - pos.x, y: svgPt.y - pos.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, [enabled, pos, toSvgCoords]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const svgPt = toSvgCoords(e.clientX, e.clientY);
    setPos({ x: svgPt.x - offset.current.x, y: svgPt.y - offset.current.y });
  }, [toSvgCoords]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return { pos, setPos, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}

// ─── Props ───
interface VisionSystemDiagramProps {
  camera: Camera | null;
  lens: Lens | null;
  light: Light | null;
  controller?: Controller | null;
  is3DCamera?: boolean;
  cameras?: Camera[];
  lenses?: Lens[];
  lights?: Light[];
  controllers?: Controller[];
  onCameraSelect?: (id: string) => void;
  onLensSelect?: (id: string) => void;
  onLightSelect?: (id: string) => void;
  onControllerSelect?: (id: string) => void;
  lightDistance?: number;
  lightCount?: number;
  fovAngle?: number;
  onFovAngleChange?: (angle: number) => void;
  onLightDistanceChange?: (distance: number) => void;
  workingDistanceInput?: string;
  workingDistanceMm?: number | null;
  workingDistanceToleranceInput?: string;
  fovWidthMm?: number | null;
  distanceUnit?: DistanceUnit;
  onWorkingDistanceChange?: (value: string) => void;
  lightDistanceInput?: string;
  lightDistanceMm?: number | null;
  threeDInfo?: ThreeDDisplayInfo | null;
  onDiagramLightDistanceChange?: (value: string) => void;
  diagramLightItems?: Array<{
    id: string;
    label?: string;
    light: Light | null;
    position: { x: number; y: number };
    rotation?: number;
    distanceInput?: string;
    distanceMm?: number | null;
  }>;
  onDiagramLightItemPositionChange?: (id: string, p: { x: number; y: number }) => void;
  onDiagramLightItemDistanceChange?: (id: string, value: string) => void;
  onDiagramLightItemRotationChange?: (id: string, angle: number) => void;
  roiStrategy?: string;
  moduleType?: string;
  interactive?: boolean;
  className?: string;
  // Controlled positions (optional). When provided, drag updates call onChange instead of internal state.
  cameraPos?: { x: number; y: number };
  lightPos?: { x: number; y: number };
  productPos?: { x: number; y: number };
  cameraRotation?: number;
  lightRotation?: number;
  onCameraPosChange?: (p: { x: number; y: number }) => void;
  onLightPosChange?: (p: { x: number; y: number }) => void;
  onProductPosChange?: (p: { x: number; y: number }) => void;
  onCameraRotationChange?: (r: number) => void;
  onLightRotationChange?: (r: number) => void;
}

// ─── SVG hardware shape renderers ───
function CameraSVGShape({ hasImage, imageUrl, brand, model }: { hasImage: boolean; imageUrl?: string | null; brand?: string; model?: string }) {
  if (hasImage && imageUrl) {
    return <image href={imageUrl} x="0" y="0" width="90" height="72" preserveAspectRatio="xMidYMid meet" />;
  }
  const b = (brand || '').toLowerCase();

  // Hikvision — 紫色方体、绿色指示灯、散热格栅
  if (b.includes('hikvision') || b.includes('海康')) {
    return (
      <>
        <rect x="0" y="0" width="90" height="72" rx="4" fill="#3d2066" />
        <rect x="3" y="3" width="84" height="66" rx="3" fill="#4a2878" />
        {/* 散热格栅 */}
        {[12, 18, 24, 30, 36].map(yy => (
          <rect key={yy} x="6" y={yy} width="30" height="2" rx="1" fill="#2d1850" opacity="0.6" />
        ))}
        {/* 镜头安装口 */}
        <circle cx="60" cy="40" r="16" fill="#1a0f30" />
        <circle cx="60" cy="40" r="12" fill="#251650" />
        <circle cx="60" cy="40" r="4" fill="#3d2066" />
        {/* 绿色指示灯 */}
        <circle cx="14" cy="10" r="3.5" fill="#00e676" />
        <circle cx="14" cy="10" r="5" fill="none" stroke="#00e676" strokeWidth="0.8" opacity="0.4" />
        {/* 接口区 */}
        <rect x="42" y="4" width="20" height="8" rx="2" fill="#2d1850" />
        <text x="45" y="66" textAnchor="middle" fill="#c0a0ff" style={{ fontSize: '7px', fontWeight: 600 }}>HIKVISION</text>
      </>
    );
  }

  // Basler — 灰黑扁平体、蓝色标识条
  if (b.includes('basler') || b.includes('巴斯勒')) {
    return (
      <>
        <rect x="0" y="6" width="90" height="60" rx="3" fill="#2a2a2a" />
        <rect x="2" y="8" width="86" height="56" rx="2" fill="#3a3a3a" />
        {/* 蓝色品牌条 */}
        <rect x="0" y="6" width="90" height="6" rx="3" fill="#1976d2" />
        {/* 镜头口 */}
        <circle cx="45" cy="42" r="18" fill="#1a1a1a" />
        <circle cx="45" cy="42" r="14" fill="#252525" />
        <circle cx="45" cy="42" r="6" fill="#1a1a1a" />
        {/* 散热鳍片 */}
        {[18, 22, 26].map(yy => (
          <rect key={yy} x="72" y={yy} width="14" height="2" rx="1" fill="#222" />
        ))}
        {/* 接口 */}
        <rect x="5" y="52" width="16" height="10" rx="2" fill="#222" />
        <text x="45" y="62" textAnchor="middle" fill="#64b5f6" style={{ fontSize: '7px', fontWeight: 600 }}>BASLER</text>
      </>
    );
  }

  // Daheng — 深灰窄体、红色LED
  if (b.includes('daheng') || b.includes('大恒')) {
    return (
      <>
        <rect x="10" y="0" width="70" height="72" rx="3" fill="#2e2e2e" />
        <rect x="12" y="2" width="66" height="68" rx="2" fill="#383838" />
        {/* 镜头口 */}
        <circle cx="45" cy="40" r="16" fill="#1c1c1c" />
        <circle cx="45" cy="40" r="11" fill="#282828" />
        <circle cx="45" cy="40" r="4" fill="#1c1c1c" />
        {/* 红色LED */}
        <circle cx="22" cy="10" r="3" fill="#f44336" />
        <circle cx="22" cy="10" r="4.5" fill="none" stroke="#f44336" strokeWidth="0.6" opacity="0.4" />
        {/* 散热纹理 */}
        {[16, 20, 24].map(yy => (
          <rect key={yy} x="60" y={yy} width="14" height="1.5" rx="0.5" fill="#252525" />
        ))}
        <rect x="28" y="4" width="18" height="7" rx="2" fill="#252525" />
        <text x="45" y="66" textAnchor="middle" fill="#aaa" style={{ fontSize: '7px', fontWeight: 500 }}>DAHENG</text>
      </>
    );
  }

  // Cognex — 银色紧凑体、橙色logo
  if (b.includes('cognex') || b.includes('康耐视')) {
    return (
      <>
        <rect x="5" y="4" width="80" height="64" rx="6" fill="#b0b0b0" />
        <rect x="7" y="6" width="76" height="60" rx="5" fill="#c8c8c8" />
        {/* 镜头区 */}
        <rect x="20" y="16" width="50" height="40" rx="4" fill="#444" />
        <circle cx="45" cy="38" r="14" fill="#333" />
        <circle cx="45" cy="38" r="9" fill="#444" />
        <circle cx="45" cy="38" r="3" fill="#333" />
        {/* 橙色logo条 */}
        <rect x="5" y="4" width="80" height="5" rx="3" fill="#ff6d00" />
        {/* LED指示灯 */}
        <circle cx="15" cy="14" r="2.5" fill="#4caf50" />
        <circle cx="22" cy="14" r="2.5" fill="#ffeb3b" />
        <text x="45" y="62" textAnchor="middle" fill="#ff6d00" style={{ fontSize: '7px', fontWeight: 700 }}>COGNEX</text>
      </>
    );
  }

  // Baumer — 黑色长方体、白色前面板
  if (b.includes('baumer') || b.includes('堡盟')) {
    return (
      <>
        <rect x="0" y="2" width="90" height="68" rx="3" fill="#1a1a1a" />
        <rect x="2" y="4" width="86" height="64" rx="2" fill="#222" />
        {/* 白色前面板 */}
        <rect x="18" y="12" width="54" height="48" rx="3" fill="#e0e0e0" />
        {/* 镜头口 */}
        <circle cx="45" cy="38" r="16" fill="#333" />
        <circle cx="45" cy="38" r="12" fill="#444" />
        <circle cx="45" cy="38" r="5" fill="#333" />
        {/* 接口 */}
        <rect x="6" y="52" width="10" height="10" rx="1.5" fill="#333" />
        <text x="45" y="66" textAnchor="middle" fill="#aaa" style={{ fontSize: '7px', fontWeight: 600 }}>BAUMER</text>
      </>
    );
  }

  // 默认
  return (
    <>
      <rect x="0" y="0" width="90" height="72" rx="6" fill="url(#cameraBody)" />
      <rect x="8" y="5" width="28" height="8" rx="2" fill="hsl(270, 30%, 60%)" opacity="0.5" />
      <circle cx="76" cy="11" r="4" fill="hsl(120, 70%, 50%)" />
      <text x="45" y="48" textAnchor="middle" fill="white" style={{ fontSize: '14px', fontWeight: 600 }}>Cam</text>
    </>
  );
}

function LensSVGShape({ hasImage, imageUrl, brand, model }: { hasImage: boolean; imageUrl?: string | null; brand?: string; model?: string }) {
  if (hasImage && imageUrl) {
    return <image href={imageUrl} x="0" y="0" width="96" height="48" preserveAspectRatio="xMidYMid meet" />;
  }
  const b = (brand || '').toLowerCase();

  // Computar — 黑色哑光镜筒，银色对焦环，白色品牌字
  if (b.includes('computar')) {
    return (
      <>
        <rect x="6" y="2" width="84" height="44" rx="22" fill="#1a1a1a" />
        <rect x="8" y="4" width="80" height="40" rx="20" fill="#2d2d2d" />
        {[12, 16, 20, 24, 28, 32].map(yy => (
          <rect key={yy} x="12" y={yy} width="72" height="0.8" rx="0.4" fill="#1a1a1a" opacity="0.6" />
        ))}
        <rect x="6" y="18" width="84" height="5" rx="2.5" fill="#b0b0b0" opacity="0.5" />
        <rect x="6" y="30" width="84" height="3" rx="1.5" fill="#b0b0b0" opacity="0.35" />
        <ellipse cx="48" cy="40" rx="18" ry="5" fill="#111" />
        <ellipse cx="48" cy="40" rx="12" ry="3" fill="#1a1a3a" />
        <text x="48" y="11" textAnchor="middle" fill="#ccc" style={{ fontSize: '5px', fontFamily: 'monospace' }}>COMPUTAR</text>
      </>
    );
  }

  // Kowa — 深灰色镜筒，蓝色标识环，精细纹理
  if (b.includes('kowa')) {
    return (
      <>
        <rect x="6" y="1" width="84" height="46" rx="23" fill="#252525" />
        <rect x="8" y="3" width="80" height="42" rx="21" fill="#353535" />
        {[10, 14, 18, 22, 26, 30, 34].map(yy => (
          <rect key={yy} x="14" y={yy} width="68" height="1" rx="0.5" fill="#252525" opacity="0.5" />
        ))}
        <rect x="6" y="13" width="84" height="4" rx="2" fill="#1565c0" opacity="0.85" />
        <rect x="6" y="32" width="84" height="3" rx="1.5" fill="#1565c0" opacity="0.5" />
        <ellipse cx="48" cy="40" rx="20" ry="6" fill="#1a1a1a" />
        <ellipse cx="48" cy="40" rx="14" ry="4" fill="#222244" />
        <text x="48" y="9" textAnchor="middle" fill="#90caf9" style={{ fontSize: '5.5px', fontWeight: 'bold' }}>KOWA</text>
      </>
    );
  }

  // Fujinon — 银灰色金属镜筒，红色品牌环
  if (b.includes('fujinon') || b.includes('fujifilm')) {
    return (
      <>
        <rect x="6" y="2" width="84" height="44" rx="22" fill="#555" />
        <rect x="8" y="4" width="80" height="40" rx="20" fill="#6a6a6a" />
        {[11, 15, 19, 23, 27, 31].map(yy => (
          <rect key={yy} x="14" y={yy} width="68" height="1.2" rx="0.6" fill="#555" opacity="0.5" />
        ))}
        <rect x="6" y="19" width="84" height="4" rx="2" fill="#c62828" opacity="0.85" />
        <ellipse cx="48" cy="39" rx="19" ry="5.5" fill="#3a3a3a" />
        <ellipse cx="48" cy="39" rx="13" ry="3.5" fill="#2a2a3a" />
        <text x="48" y="10" textAnchor="middle" fill="#ef9a9a" style={{ fontSize: '5px', fontWeight: 'bold' }}>FUJINON</text>
      </>
    );
  }

  // VS Technology — 黑色镜筒，金色品牌环
  if (b.includes('vs tech') || b.includes('vst')) {
    return (
      <>
        <rect x="6" y="2" width="84" height="44" rx="22" fill="#1c1c1c" />
        <rect x="8" y="4" width="80" height="40" rx="20" fill="#2e2e2e" />
        {[12, 16, 20, 24, 28, 32].map(yy => (
          <rect key={yy} x="12" y={yy} width="72" height="0.8" rx="0.4" fill="#1c1c1c" opacity="0.5" />
        ))}
        <rect x="6" y="17" width="84" height="4" rx="2" fill="#c9a84c" opacity="0.8" />
        <ellipse cx="48" cy="40" rx="18" ry="5" fill="#111" />
        <ellipse cx="48" cy="40" rx="12" ry="3" fill="#1a1a2a" />
        <text x="48" y="10" textAnchor="middle" fill="#e8c07a" style={{ fontSize: '5px', fontWeight: 'bold' }}>VS TECH</text>
      </>
    );
  }

  // Tamron — 深灰黑镜筒，白色纹理环
  if (b.includes('tamron')) {
    return (
      <>
        <rect x="6" y="2" width="84" height="44" rx="22" fill="#222" />
        <rect x="8" y="4" width="80" height="40" rx="20" fill="#333" />
        {[12, 16, 20, 24, 28, 32].map(yy => (
          <rect key={yy} x="12" y={yy} width="72" height="1" rx="0.5" fill="#222" opacity="0.5" />
        ))}
        <rect x="6" y="20" width="84" height="3" rx="1.5" fill="#e0e0e0" opacity="0.4" />
        <ellipse cx="48" cy="40" rx="18" ry="5" fill="#111" />
        <ellipse cx="48" cy="40" rx="12" ry="3" fill="#1a1a2a" />
        <text x="48" y="10" textAnchor="middle" fill="#bbb" style={{ fontSize: '5px' }}>TAMRON</text>
      </>
    );
  }

  // 默认镜头
  return (
    <>
      <rect x="8" y="0" width="80" height="48" rx="3" fill="url(#lensBody)" />
      <ellipse cx="48" cy="38" rx="22" ry="7" fill="url(#lensGlass)" />
      <rect x="13" y="12" width="70" height="2.5" fill="hsl(30, 15%, 45%)" rx="1" />
      <rect x="13" y="26" width="70" height="2.5" fill="hsl(30, 15%, 45%)" rx="1" />
    </>
  );
}

function LightSVGShape({ hasImage, imageUrl, brand, lightType }: { hasImage: boolean; imageUrl?: string | null; brand?: string; lightType?: string }) {
  if (hasImage && imageUrl) {
    return <image href={imageUrl} x="0" y="0" width="160" height="32" preserveAspectRatio="xMidYMid meet" />;
  }
  const b = (brand || '').toLowerCase();
  const lt = (lightType || '').toLowerCase();

  // ── 环形光源 ──
  if (lt.includes('环形') || lt.includes('ring')) {
    // OPT — 绿色调
    if (b.includes('opt') || b.includes('奥普特')) {
      return (
        <>
          <rect x="20" y="0" width="120" height="32" rx="16" fill="#2a2a2a" />
          <ellipse cx="80" cy="16" rx="48" ry="14" fill="#222" />
          <ellipse cx="80" cy="16" rx="38" ry="10" fill="none" stroke="#4caf50" strokeWidth="2.5" opacity="0.9" />
          <ellipse cx="80" cy="16" rx="28" ry="6" fill="#1a1a1a" />
          <text x="80" y="30" textAnchor="middle" fill="#81c784" style={{ fontSize: '5px', fontWeight: 'bold' }}>OPT RING</text>
        </>
      );
    }
    // CCS — 蓝白色调
    if (b.includes('ccs')) {
      return (
        <>
          <rect x="20" y="0" width="120" height="32" rx="16" fill="#e8eaf6" />
          <ellipse cx="80" cy="16" rx="48" ry="14" fill="#c5cae9" />
          <ellipse cx="80" cy="16" rx="38" ry="10" fill="none" stroke="#1565c0" strokeWidth="2.5" opacity="0.9" />
          <ellipse cx="80" cy="16" rx="28" ry="6" fill="#e8eaf6" />
          <text x="80" y="30" textAnchor="middle" fill="#1565c0" style={{ fontSize: '5px', fontWeight: 'bold' }}>CCS RING</text>
        </>
      );
    }
    // 默认环形
    return (
      <>
        <rect x="20" y="0" width="120" height="32" rx="16" fill="#3a3a3a" />
        <ellipse cx="80" cy="16" rx="48" ry="14" fill="#2a2a2a" />
        <ellipse cx="80" cy="16" rx="38" ry="10" fill="none" stroke="#ff1744" strokeWidth="2" opacity="0.8" />
        <ellipse cx="80" cy="16" rx="28" ry="6" fill="#1a1a1a" />
        <text x="80" y="30" textAnchor="middle" fill="#888" style={{ fontSize: '5px' }}>RING</text>
      </>
    );
  }

  // ── 条形光源 ──
  if (lt.includes('条形') || lt.includes('bar') || lt.includes('线形')) {
    // OPT
    if (b.includes('opt') || b.includes('奥普特')) {
      return (
        <>
          <rect x="0" y="4" width="160" height="24" rx="4" fill="#2a2a2a" />
          <rect x="3" y="6" width="154" height="20" rx="3" fill="#333" />
          {Array.from({ length: 18 }).map((_, i) => (
            <circle key={i} cx={10 + i * 8} cy="16" r="2.2" fill="#4caf50" opacity="0.8" />
          ))}
          <text x="80" y="30" textAnchor="middle" fill="#81c784" style={{ fontSize: '5px', fontWeight: 'bold' }}>OPT BAR</text>
        </>
      );
    }
    // CCS
    if (b.includes('ccs')) {
      return (
        <>
          <rect x="0" y="4" width="160" height="24" rx="4" fill="#e0e0e0" />
          <rect x="3" y="6" width="154" height="20" rx="3" fill="#f5f5f5" />
          {Array.from({ length: 18 }).map((_, i) => (
            <circle key={i} cx={10 + i * 8} cy="16" r="2.2" fill="#1565c0" opacity="0.7" />
          ))}
          <text x="80" y="30" textAnchor="middle" fill="#1565c0" style={{ fontSize: '5px', fontWeight: 'bold' }}>CCS BAR</text>
        </>
      );
    }
    // 默认条形
    return (
      <>
        <rect x="0" y="4" width="160" height="24" rx="3" fill="#3a3a3a" />
        <rect x="3" y="6" width="154" height="20" rx="2" fill="#2a2a2a" />
        {Array.from({ length: 16 }).map((_, i) => (
          <circle key={i} cx={12 + i * 9} cy="16" r="2.5" fill="#ff1744" opacity="0.7" />
        ))}
        <text x="80" y="30" textAnchor="middle" fill="#888" style={{ fontSize: '5px' }}>BAR</text>
      </>
    );
  }

  // ── 面光源/背光 ──
  if (lt.includes('面') || lt.includes('area') || lt.includes('back')) {
    if (b.includes('opt') || b.includes('奥普特')) {
      return (
        <>
          <rect x="10" y="0" width="140" height="32" rx="3" fill="#2a2a2a" />
          <rect x="14" y="3" width="132" height="26" rx="2" fill="#e8f5e9" opacity="0.9" />
          <rect x="18" y="6" width="124" height="20" rx="1" fill="#c8e6c9" opacity="0.7" />
          <text x="80" y="30" textAnchor="middle" fill="#4caf50" style={{ fontSize: '5px', fontWeight: 'bold' }}>OPT AREA</text>
        </>
      );
    }
    if (b.includes('ccs')) {
      return (
        <>
          <rect x="10" y="0" width="140" height="32" rx="3" fill="#e0e0e0" />
          <rect x="14" y="3" width="132" height="26" rx="2" fill="#e3f2fd" opacity="0.9" />
          <rect x="18" y="6" width="124" height="20" rx="1" fill="#bbdefb" opacity="0.7" />
          <text x="80" y="30" textAnchor="middle" fill="#1565c0" style={{ fontSize: '5px', fontWeight: 'bold' }}>CCS AREA</text>
        </>
      );
    }
    return (
      <>
        <rect x="10" y="0" width="140" height="32" rx="3" fill="#3a3a3a" />
        <rect x="14" y="3" width="132" height="26" rx="2" fill="#fafafa" opacity="0.9" />
        <rect x="18" y="6" width="124" height="20" rx="1" fill="#fff3e0" opacity="0.7" />
        <text x="80" y="30" textAnchor="middle" fill="#888" style={{ fontSize: '5px' }}>AREA</text>
      </>
    );
  }

  // ── 同轴光源 ──
  if (lt.includes('同轴') || lt.includes('coax')) {
    return (
      <>
        <rect x="30" y="0" width="100" height="32" rx="4" fill="#3a3a3a" />
        <rect x="34" y="3" width="92" height="26" rx="3" fill="#2a2a2a" />
        <rect x="60" y="5" width="40" height="22" rx="2" fill="#444" />
        <circle cx="80" cy="16" r="8" fill="none" stroke={b.includes('opt') ? '#4caf50' : b.includes('ccs') ? '#1565c0' : '#ff1744'} strokeWidth="1.5" opacity="0.8" />
        <circle cx="80" cy="16" r="4" fill={b.includes('opt') ? '#4caf50' : b.includes('ccs') ? '#1565c0' : '#ff1744'} opacity="0.3" />
        <text x="80" y="30" textAnchor="middle" fill="#888" style={{ fontSize: '5px' }}>COAX</text>
      </>
    );
  }

  // ── 圆顶光源 ──
  if (lt.includes('穹顶') || lt.includes('dome') || lt.includes('圆顶')) {
    return (
      <>
        <path d="M30,32 Q30,2 80,0 Q130,2 130,32 Z" fill="#3a3a3a" />
        <path d="M34,30 Q34,6 80,4 Q126,6 126,30 Z" fill="#2a2a2a" />
        <ellipse cx="80" cy="30" rx="50" ry="4" fill="#444" />
        <circle cx="80" cy="16" r="10" fill="none" stroke={b.includes('opt') ? '#4caf50' : '#ff1744'} strokeWidth="1" opacity="0.5" />
        <text x="80" y="28" textAnchor="middle" fill="#888" style={{ fontSize: '5px' }}>DOME</text>
      </>
    );
  }

  // 默认光源
  return (
    <>
      <rect x="0" y="0" width="160" height="32" rx="4" fill="hsl(0, 0%, 45%)" />
      <rect x="3" y="3" width="154" height="26" rx="3" fill="hsl(0, 0%, 35%)" />
      <rect x="45" y="6" width="70" height="20" rx="3" fill="hsl(0, 0%, 12%)" />
      <rect x="8" y="8" width="32" height="16" rx="2" fill="hsl(0, 80%, 50%)" />
      <rect x="120" y="8" width="32" height="16" rx="2" fill="hsl(0, 80%, 50%)" />
    </>
  );
}

// ─── Rotation handle ───
function RotationHandle({ cx, cy, radius, angle, onAngleChange, enabled }: {
  cx: number; cy: number; radius: number; angle: number;
  onAngleChange: (a: number) => void; enabled: boolean;
}) {
  const handleRef = useRef<SVGCircleElement>(null);
  const dragging = useRef(false);

  const rad = (angle * Math.PI) / 180;
  const hx = cx + Math.cos(rad) * radius;
  const hy = cy + Math.sin(rad) * radius;

  const onDown = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.stopPropagation();
    dragging.current = true;
    handleRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const svg = (e.target as Element).closest('svg');
    if (!svg) return;
    const pt = (svg as SVGSVGElement).createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = (svg as SVGSVGElement).getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const newAngle = Math.atan2(svgPt.y - cy, svgPt.x - cx) * (180 / Math.PI);
    onAngleChange(Math.round(newAngle));
  };
  const onUp = () => { dragging.current = false; };

  if (!enabled) return null;

  return (
    <g>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="hsl(220, 80%, 55%)" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
      <circle
        ref={handleRef}
        cx={hx} cy={hy} r="6"
        fill="hsl(220, 80%, 55%)" stroke="white" strokeWidth="2"
        style={{ cursor: 'grab' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
    </g>
  );
}

// ═══════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════
export function VisionSystemDiagram({ 
  camera, lens, light, controller,
  is3DCamera = false,
  cameras = [], lenses = [], lights = [], controllers = [],
  onCameraSelect, onLensSelect, onLightSelect, onControllerSelect,
  lightDistance = 335, lightCount = 1, fovAngle = 45,
  onFovAngleChange, onLightDistanceChange,
  workingDistanceInput, workingDistanceMm, workingDistanceToleranceInput, fovWidthMm, distanceUnit: distanceUnitProp, onWorkingDistanceChange,
  lightDistanceInput, lightDistanceMm, onDiagramLightDistanceChange,
  threeDInfo,
  diagramLightItems = [], onDiagramLightItemPositionChange, onDiagramLightItemDistanceChange, onDiagramLightItemRotationChange,
  roiStrategy = 'full', moduleType = 'defect',
  interactive = true, className,
  cameraPos, lightPos, productPos, cameraRotation, lightRotation,
  onCameraPosChange, onLightPosChange, onProductPosChange,
  onCameraRotationChange, onLightRotationChange,
}: VisionSystemDiagramProps) {

  const svgRef = useRef<SVGSVGElement>(null);
  const distanceUnit = normalizeDistanceUnit(distanceUnitProp);
  const multiLightDragRef = useRef<{ id: string; offset: { x: number; y: number } } | null>(null);

  const toSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleDiagramLightPointerDown = useCallback((id: string, pos: { x: number; y: number }, e: React.PointerEvent) => {
    if (!interactive || !onDiagramLightItemPositionChange) return;
    e.stopPropagation();
    e.preventDefault();
    const svgPt = toSvgCoords(e.clientX, e.clientY);
    multiLightDragRef.current = { id, offset: { x: svgPt.x - pos.x, y: svgPt.y - pos.y } };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, [interactive, onDiagramLightItemPositionChange, toSvgCoords]);

  const handleDiagramLightPointerMove = useCallback((e: React.PointerEvent) => {
    const dragging = multiLightDragRef.current;
    if (!dragging || !onDiagramLightItemPositionChange) return;
    const svgPt = toSvgCoords(e.clientX, e.clientY);
    // Soft bounds: keep light within the drawable area (left panel),
    // allowing positions both above and below the product.
    const nextX = Math.max(20, Math.min(485, svgPt.x - dragging.offset.x));
    const nextY = Math.max(20, Math.min(620, svgPt.y - dragging.offset.y));
    onDiagramLightItemPositionChange(dragging.id, {
      x: nextX,
      y: nextY,
    });
  }, [onDiagramLightItemPositionChange, toSvgCoords]);

  const handleDiagramLightPointerUp = useCallback(() => {
    multiLightDragRef.current = null;
  }, []);

  // Draggable positions (controlled if cameraPos/lightPos supplied)
  const camLensDrag = useSvgDrag(
    svgRef,
    { x: 275, y: 77 },
    interactive,
    cameraPos ? { value: cameraPos, onChange: onCameraPosChange } : undefined
  );
  const lightDrag = useSvgDrag(
    svgRef,
    { x: 275, y: 231 },
    interactive,
    lightPos ? { value: lightPos, onChange: onLightPosChange } : undefined
  );
  const productDrag = useSvgDrag(
    svgRef,
    DEFAULT_PRODUCT_POS,
    interactive,
    productPos ? { value: clampProductPosition(productPos), onChange: onProductPosChange } : undefined,
    clampProductPosition
  );
  const productY = productDrag.pos.y;
  const productBottomY = productY + PRODUCT_HEIGHT;
  const productCenterX = productDrag.pos.x;
  const productX = productCenterX - 75;
  const roiWidth = roiStrategy === 'full' ? 140 : 100;
  const roiX = productCenterX - (roiWidth / 2);

  // Rotation angles (controlled if cameraRotation/lightRotation supplied)
  const [internalCamRot, setInternalCamRot] = useState(0);
  const [internalLightRot, setInternalLightRot] = useState(0);
  const camRotation = cameraRotation !== undefined ? cameraRotation : internalCamRot;
  const setCamRotation = (r: number) => {
    if (onCameraRotationChange) onCameraRotationChange(r);
    else setInternalCamRot(r);
  };
  const lightRotationVal = lightRotation !== undefined ? lightRotation : internalLightRot;
  const setLightRotation = (r: number) => {
    if (onLightRotationChange) onLightRotationChange(r);
    else setInternalLightRot(r);
  };

  // Derived measurements (rotation-aware)
  const rotRad = camRotation * Math.PI / 180;
  const lensBottomOffsetFromRotationCenter = is3DCamera ? 30 : 82; // 3D camera measures from camera bottom; 2D measures from lens bottom.

  // Rotated lens exit point (rotation pivot = camLensDrag.pos which is group top-left, rotation center at (45,55) inside group)
  // The working distance is measured from the rendered lens image bottom, not from an estimated optical center.
  // Lens bottom local coords: (45, 137); rotation center local coords: (45, 55).
  const localLensX = 0;
  const localLensY = lensBottomOffsetFromRotationCenter;
  // Standard 2D rotation: x' = x*cos - y*sin, y' = x*sin + y*cos
  const rotatedLensLocalX = localLensX * Math.cos(rotRad) - localLensY * Math.sin(rotRad);
  const rotatedLensLocalY = localLensX * Math.sin(rotRad) + localLensY * Math.cos(rotRad);
  // Rotation center in SVG coords: camLensDrag.pos.x - 45 + 45 = camLensDrag.pos.x, camLensDrag.pos.y + 55
  const rotCenterX = camLensDrag.pos.x;
  const rotCenterY = camLensDrag.pos.y + 55;
  const lensExitX = rotCenterX + rotatedLensLocalX;
  const lensExitY = rotCenterY + rotatedLensLocalY;

  const workingDistance = Math.max(0, Math.round(productY - lensExitY));
  const legacyWorkingDistanceMM = Math.max(50, Math.round(workingDistance * (lightDistance / (productY - 175))));
  const controlledWorkingDistanceMM =
    typeof workingDistanceMm === 'number' && Number.isFinite(workingDistanceMm) && workingDistanceMm > 0
      ? Math.round(workingDistanceMm)
      : null;
  const hasControlledWorkingDistance =
    workingDistanceInput !== undefined || workingDistanceMm !== undefined || Boolean(onWorkingDistanceChange);
  const workingDistanceMM = controlledWorkingDistanceMM ?? legacyWorkingDistanceMM;
  const workingDistanceValue = hasControlledWorkingDistance
    ? (workingDistanceInput ?? (controlledWorkingDistanceMM !== null ? String(controlledWorkingDistanceMM) : ''))
    : String(workingDistanceMM);
  const hasWorkingDistanceText = typeof workingDistanceInput === 'string' && workingDistanceInput.trim().length > 0;
  const isWorkingDistanceMissing = hasControlledWorkingDistance && !controlledWorkingDistanceMM && !hasWorkingDistanceText;
  const workingDistanceDisplay = isWorkingDistanceMissing
    ? '待填写'
    : formatDistanceDisplay(workingDistanceInput, distanceUnit, workingDistanceMM);
  const workingDistanceNumberDisplay = isWorkingDistanceMissing
    ? '待填写'
    : formatDistanceInputText(workingDistanceInput, distanceUnit, workingDistanceMM);
  const workingDistanceToleranceText = formatDistanceInputText(workingDistanceToleranceInput, distanceUnit);
  const workingDistanceDimensionLabel = isWorkingDistanceMissing
    ? '待填写'
    : `${workingDistanceNumberDisplay}${workingDistanceToleranceText ? `±${workingDistanceToleranceText}` : ''}${distanceUnit}`;

  const fovRadians = (fovAngle / 2) * (Math.PI / 180);
  const fovPixelHeight = Math.max(productY - lensExitY, 50);
  const fovOffsetX = Math.tan(fovRadians) * fovPixelHeight;
  const fovWidthMM =
    typeof fovWidthMm === 'number' && Number.isFinite(fovWidthMm) && fovWidthMm > 0
      ? Math.round(fovWidthMm)
      : Math.round(2 * Math.tan(fovRadians) * workingDistanceMM);
  const fovWidthDisplay = formatDistanceLabel(fovWidthMM, distanceUnit);

  // Camera/Lens display info (memo-cheap; computed each render)
  const cameraSensorInfo = getCameraSensorInfo(camera ?? null);
  const lensSupportedText = getLensSupportedSensorText(lens ?? null);
  const isTelecentricOptics = isTelecentricHardware(lens ?? null);
  const opticalFieldLabels = getOpticalFieldLabels(isTelecentricOptics);

  const legacyDiagramLightDistancePx = lightDrag.pos.y <= productY
    ? productY - lightDrag.pos.y
    : Math.max(0, lightDrag.pos.y - productBottomY);
  const legacyDiagramLightDistanceMM = Math.round(legacyDiagramLightDistancePx * (lightDistance / (productY - 175)));
  const controlledLightDistanceMM =
    typeof lightDistanceMm === 'number' && Number.isFinite(lightDistanceMm) && lightDistanceMm > 0
      ? Math.round(lightDistanceMm)
      : null;
  const hasControlledLightDistance =
    lightDistanceInput !== undefined || lightDistanceMm !== undefined || Boolean(onDiagramLightDistanceChange);
  const diagramLightDistanceMM = controlledLightDistanceMM ?? legacyDiagramLightDistanceMM;
  const diagramLightDistanceValue = hasControlledLightDistance
    ? (lightDistanceInput ?? (controlledLightDistanceMM !== null ? String(controlledLightDistanceMM) : ''))
    : String(diagramLightDistanceMM);
  const hasDiagramLightDistanceText = typeof lightDistanceInput === 'string' && lightDistanceInput.trim().length > 0;
  const isDiagramLightDistanceMissing = hasControlledLightDistance && !controlledLightDistanceMM && !hasDiagramLightDistanceText;
  const diagramLightDistanceDisplay = isDiagramLightDistanceMissing
    ? '待填写'
    : formatDistanceInputText(lightDistanceInput, distanceUnit, diagramLightDistanceMM);
  const diagramLightDistanceWithUnit = isDiagramLightDistanceMissing
    ? '待填写'
    : formatDistanceDisplay(lightDistanceInput, distanceUnit, diagramLightDistanceMM);

  // FOV direction vector (rotation of downward (0,1) by camRotation)
  const fovDirX = -Math.sin(rotRad);
  const fovDirY = Math.cos(rotRad);
  // FOV perpendicular vector (90° of direction)
  const fovPerpX = Math.cos(rotRad);
  const fovPerpY = Math.sin(rotRad);
  // FOV end points: extend along direction by fovPixelHeight, then offset perpendicular by fovOffsetX
  const fovEndCenterX = lensExitX + fovDirX * fovPixelHeight;
  const fovEndCenterY = lensExitY + fovDirY * fovPixelHeight;
  const fovEndLeftX = fovEndCenterX - fovPerpX * fovOffsetX;
  const fovEndLeftY = fovEndCenterY - fovPerpY * fovOffsetX;
  const fovEndRightX = fovEndCenterX + fovPerpX * fovOffsetX;
  const fovEndRightY = fovEndCenterY + fovPerpY * fovOffsetX;

  const hasCamera = !!camera;
  const hasLens = !is3DCamera && !!lens;
  const hasMultiLights = !is3DCamera && diagramLightItems.length > 0;
  const hasLight = !is3DCamera && (hasMultiLights ? diagramLightItems.some(item => !!item.light) : !!light);
  const hasController = !!controller;
  const threeDOpticalLines = threeDInfo ? [
    threeDInfo.model ? `型号: ${threeDInfo.model}` : null,
    threeDInfo.orderModel ? `下单型号: ${threeDInfo.orderModel}` : null,
    workingDistanceDisplay !== '待填写' ? `工作距离: ${workingDistanceDisplay}` : null,
    workingDistanceToleranceText ? `工作距离公差: ±${workingDistanceToleranceText}${distanceUnit}` : null,
    threeDInfo.scanLineWidth ? `线宽: ${threeDInfo.scanLineWidth}` : null,
    threeDInfo.dataPoints ? `XY数据点: ${threeDInfo.dataPoints}` : null,
  ].filter((line): line is string => Boolean(line)) : [];

  // Camera+lens group center for drawing connections
  const camCenterX = camLensDrag.pos.x;
  const camTopY = camLensDrag.pos.y;
  const lensCenterY = camTopY + 85 + 24;

  const primaryLightPosition = hasMultiLights ? diagramLightItems[0].position : lightDrag.pos;
  const lightCenterX = primaryLightPosition.x;
  const lightCenterY = primaryLightPosition.y;
  const boundedLightCount = Math.max(1, Math.min(12, Math.round(lightCount || 1)));
  const lightGroupSpread = boundedLightCount > 1
    ? Math.min(96, Math.max(42, Math.abs(lightDrag.pos.x - productCenterX) || 56))
    : 0;
  const lightInstances = Array.from({ length: boundedLightCount }, (_, index) => {
    const offset = (index - (boundedLightCount - 1) / 2) * lightGroupSpread;
    return {
      key: `light-${index}`,
      x: lightDrag.pos.x + offset,
      y: lightDrag.pos.y,
    };
  });

  return (
    <div className={cn("relative w-full h-full min-h-[560px]", className)} style={{ backgroundColor: '#ffffff', contain: 'layout style paint' }}>
      <svg 
        ref={svgRef}
        viewBox="0 0 800 640"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision"
        style={{ maxHeight: '100%' }}
        onPointerMove={interactive ? handleDiagramLightPointerMove : undefined}
        onPointerUp={interactive ? handleDiagramLightPointerUp : undefined}
      >
        <defs>
          <linearGradient id="fovGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(270, 60%, 55%)" stopOpacity="0.35" />
            <stop offset="40%" stopColor="hsl(270, 55%, 50%)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(270, 50%, 45%)" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="cameraBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(270, 40%, 55%)" />
            <stop offset="50%" stopColor="hsl(270, 40%, 45%)" />
            <stop offset="100%" stopColor="hsl(270, 40%, 35%)" />
          </linearGradient>
          <linearGradient id="lensBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(30, 20%, 40%)" />
            <stop offset="50%" stopColor="hsl(30, 20%, 30%)" />
            <stop offset="100%" stopColor="hsl(30, 20%, 20%)" />
          </linearGradient>
          <radialGradient id="lensGlass" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="hsl(200, 50%, 70%)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(200, 50%, 40%)" stopOpacity="0.4" />
          </radialGradient>
          <marker id="arrowUp" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1,7 L4,1 L7,7" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
          <marker id="arrowDown" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1,1 L4,7 L7,1" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
          <marker id="dimensionArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
            <path d="M1,1 L7,4 L1,7" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
          <marker id="arrowLeft" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M7,1 L1,4 L7,7" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
          <marker id="arrowRight" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1,1 L7,4 L1,7" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
        </defs>

        {/* Border */}
        <rect x="60" y="20" width="430" height="600" rx="8" fill="none" stroke="hsl(220, 80%, 55%)" strokeWidth="1.5" strokeDasharray="8,4" opacity="0.5" />

        {/* Background grid */}
        <g opacity="0.06">
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`h${i}`} x1="60" y1={20 + i * 40} x2="490" y2={20 + i * 40} stroke="#000000" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`v${i}`} x1={60 + i * 40} y1="20" x2={60 + i * 40} y2="620" stroke="#000000" strokeWidth="0.5" />
          ))}
        </g>

        {/* ===== FOV Cone - follows camera/lens rotation ===== */}
        <polygon 
          points={`${lensExitX},${lensExitY} ${fovEndLeftX},${fovEndLeftY} ${fovEndRightX},${fovEndRightY}`}
          fill="url(#fovGradient)"
        />
        <line x1={lensExitX} y1={lensExitY} x2={fovEndLeftX} y2={fovEndLeftY} 
          stroke="hsl(270, 50%, 60%)" strokeWidth="1.5" strokeDasharray="6,3" opacity="0.6" />
        <line x1={lensExitX} y1={lensExitY} x2={fovEndRightX} y2={fovEndRightY} 
          stroke="hsl(270, 50%, 60%)" strokeWidth="1.5" strokeDasharray="6,3" opacity="0.6" />
        {/* FOV angle arc */}
        {(() => {
          const arcR = 20;
          const arcStartX = lensExitX + (-fovPerpX * arcR + fovDirX * arcR) * 0.7;
          const arcStartY = lensExitY + (-fovPerpY * arcR + fovDirY * arcR) * 0.7;
          const arcEndX = lensExitX + (fovPerpX * arcR + fovDirX * arcR) * 0.7;
          const arcEndY = lensExitY + (fovPerpY * arcR + fovDirY * arcR) * 0.7;
          return (
            <>
              <path d={`M ${arcStartX} ${arcStartY} A ${arcR} ${arcR} 0 0 1 ${arcEndX} ${arcEndY}`}
                fill="none" stroke="hsl(270, 50%, 60%)" strokeWidth="1.5" />
              <text x={lensExitX + fovPerpX * 25 + fovDirX * 8} y={lensExitY + fovPerpY * 25 + fovDirY * 8} 
                textAnchor="start" fill="#333333" style={{ fontSize: '11px', fontWeight: 500 }}>
                {fovAngle}°
              </text>
            </>
          );
        })()}

        {/* ===== Product (vertical draggable) ===== */}
        <g
          data-testid="diagram-product"
          style={{ cursor: interactive ? 'ns-resize' : 'default' }}
          {...(interactive ? productDrag.handlers : {})}
        >
          <rect data-testid="diagram-product-body" x={productX} y={productY} width="150" height={PRODUCT_HEIGHT} rx="3" fill="hsl(220, 10%, 85%)" />
          <rect x={productX} y={productY} width="150" height={PRODUCT_HEIGHT} rx="3" fill="none" stroke="hsl(220, 10%, 70%)" strokeWidth="1" />
          <rect 
            x={roiX} y={productY + 4} 
            width={roiWidth} height="32" rx="2"
            fill="none" stroke="hsl(120, 70%, 50%)" strokeWidth="1.5" strokeDasharray="4,2" opacity="0.7"
          />
          <text x={productCenterX} y={productY + 23} textAnchor="middle" fill="#333333" style={{ fontSize: '10px', fontWeight: 500 }}>产品</text>
          {/* Detection point */}
          <circle cx={productCenterX} cy={productY + 15} r="5" fill="hsl(220, 80%, 55%)" />
          <circle cx={productCenterX} cy={productY + 15} r="8" fill="none" stroke="hsl(220, 80%, 55%)" strokeWidth="1" opacity="0.5" />
        </g>

        {/* ===== Working distance dimension line (dynamic, rotation-aware) ===== */}
        <g>
          <line x1="100" y1={lensExitY} x2="130" y2={lensExitY} stroke="hsl(220, 80%, 55%)" strokeWidth="1" strokeDasharray="3,2" />
          <line x1="100" y1={productY} x2="130" y2={productY} stroke="hsl(220, 80%, 55%)" strokeWidth="1" strokeDasharray="3,2" />
          <line x1="115" y1={lensExitY + 10} x2="115" y2={productY - 10} 
            stroke="hsl(220, 80%, 55%)" strokeWidth="1.5" markerStart="url(#dimensionArrow)" markerEnd="url(#dimensionArrow)" />
          <text x="98" y={(lensExitY + productY) / 2} textAnchor="middle" fill="#333333"
            style={{ fontSize: '11px', fontWeight: 500 }} transform={`rotate(-90, 98, ${(lensExitY + productY) / 2})`}>
            {workingDistanceDimensionLabel}
          </text>
        </g>

        {/* ===== FOV width dimension (dynamic, rotation-aware) ===== */}
        <g>
          <line x1={fovEndLeftX} y1={productY + 45} x2={fovEndLeftX} y2={productY + 58} stroke="hsl(220, 80%, 55%)" strokeWidth="1" />
          <line x1={fovEndRightX} y1={productY + 45} x2={fovEndRightX} y2={productY + 58} stroke="hsl(220, 80%, 55%)" strokeWidth="1" />
          <line x1={fovEndLeftX + 8} y1={productY + 53} x2={fovEndRightX - 8} y2={productY + 53}
            stroke="hsl(220, 80%, 55%)" strokeWidth="1.5" markerStart="url(#arrowLeft)" markerEnd="url(#arrowRight)" />
          <text x={(fovEndLeftX + fovEndRightX) / 2} y={productY + 72} textAnchor="middle" fill="#333333" style={{ fontSize: '10px' }}>
            视野宽度 ~{fovWidthDisplay}
          </text>
        </g>

        {/* ===== Connection lines to annotation panel (dynamic) ===== */}
        <g stroke="hsl(220, 80%, 50%)" strokeWidth="1" strokeDasharray="4,2" opacity="0.5">
          <line x1={rotCenterX + 45} y1={rotCenterY - 19} x2="495" y2="55" />
          {!is3DCamera && <line x1={lensExitX + 10} y1={lensExitY - 10} x2="495" y2="140" />}
          {!is3DCamera && <line x1={lightCenterX + 80} y1={lightCenterY} x2="495" y2="210" />}
        </g>

        {/* ===== Camera + Lens group (draggable + rotatable) ===== */}
        <g 
          transform={`translate(${camLensDrag.pos.x - 45}, ${camLensDrag.pos.y}) rotate(${camRotation}, 45, 55)`}
          style={{ cursor: interactive ? 'grab' : 'default' }}
          {...(interactive ? camLensDrag.handlers : {})}
        >
          {/* Camera body */}
          <g>
            {interactive ? (
              <foreignObject x="0" y="0" width="90" height="85">
                <div className="w-full h-full" style={{ transform: 'translateZ(0)' }}>
                  <HardwareSelectPopover
                    type="camera" items={cameras} selectedId={camera?.id || null}
                    onSelect={onCameraSelect || (() => {})} disabled={!onCameraSelect}
                  >
                    <button className="relative w-full h-full cursor-pointer group bg-transparent border-0 p-0">
                      <svg width="90" height="85" viewBox="0 0 90 85">
                        <CameraSVGShape hasImage={!!camera?.front_view_url} imageUrl={camera?.front_view_url} brand={camera?.brand} model={camera?.model} />
                        <rect x="32" y="72" width="26" height="13" fill="hsl(0, 0%, 22%)" />
                      </svg>
                      {!hasCamera && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                          <span className="text-xs text-muted-foreground">点击选择</span>
                        </div>
                      )}
                    </button>
                  </HardwareSelectPopover>
                </div>
              </foreignObject>
            ) : (
              <g>
                <CameraSVGShape hasImage={!!camera?.front_view_url} imageUrl={camera?.front_view_url} brand={camera?.brand} model={camera?.model} />
                <rect x="32" y="72" width="26" height="13" fill="hsl(0, 0%, 22%)" />
              </g>
            )}
          </g>

          {/* Lens - hidden for 3D cameras */}
          {!is3DCamera && (
            <g transform="translate(-3, 85)">
              {interactive ? (
                <foreignObject x="0" y="0" width="96" height="52">
                  <div className="w-full h-full" style={{ transform: 'translateZ(0)' }}>
                    <HardwareSelectPopover
                      type="lens" items={lenses} selectedId={lens?.id || null}
                      onSelect={onLensSelect || (() => {})} disabled={!onLensSelect}
                    >
                      <button className="relative w-full h-full cursor-pointer group bg-transparent border-0 p-0">
                        <svg width="96" height="48" viewBox="0 0 96 48">
                          <LensSVGShape hasImage={!!lens?.front_view_url} imageUrl={lens?.front_view_url} brand={lens?.brand} />
                        </svg>
                        {!hasLens && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                            <span className="text-xs text-muted-foreground">点击选择</span>
                          </div>
                        )}
                      </button>
                    </HardwareSelectPopover>
                  </div>
                </foreignObject>
              ) : (
                <LensSVGShape hasImage={!!lens?.front_view_url} imageUrl={lens?.front_view_url} brand={lens?.brand} />
              )}
            </g>
          )}
        </g>

        {/* Camera rotation handle */}
        {interactive && (
          <RotationHandle
            cx={camLensDrag.pos.x} cy={camLensDrag.pos.y + 55}
            radius={65} angle={camRotation}
            onAngleChange={setCamRotation} enabled={interactive}
          />
        )}

        {/* ===== Light (draggable + rotatable) ===== */}
        {!is3DCamera && (
          hasMultiLights ? (
            <g>
              {diagramLightItems.map((item) => {
                const itemLight = item.light;
                const rotation = item.rotation ?? 0;
                const labelAbove = item.position.y <= productY;
                const labelY = labelAbove ? item.position.y - 10 : item.position.y + 22;
                return (
                  <g key={item.id}>
                    <g
                      data-testid={`diagram-light-${item.id}`}
                      transform={`translate(${item.position.x}, ${item.position.y}) rotate(${rotation}) scale(0.65) translate(-80, -16)`}
                      style={{ cursor: interactive ? 'grab' : 'default', touchAction: 'none' }}
                      onPointerDown={interactive ? (e) => handleDiagramLightPointerDown(item.id, item.position, e) : undefined}
                      onPointerMove={interactive ? handleDiagramLightPointerMove : undefined}
                      onPointerUp={interactive ? handleDiagramLightPointerUp : undefined}
                      onPointerCancel={interactive ? handleDiagramLightPointerUp : undefined}
                    >
                      <LightSVGShape hasImage={!!itemLight?.front_view_url} imageUrl={itemLight?.front_view_url} brand={itemLight?.brand} lightType={itemLight?.type} />
                    </g>
                    <circle cx={item.position.x} cy={item.position.y} r="4" fill="hsl(220, 80%, 55%)" opacity="0.9" />
                    <text x={item.position.x + 10} y={labelY} fill="#333333" style={{ fontSize: '9px', fontWeight: 600 }}>
                      {item.label || 'LIGHT'}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : (
            <>
              <g
                style={{ cursor: interactive ? 'grab' : 'default' }}
                {...(interactive ? lightDrag.handlers : {})}
              >
                {lightInstances.map((instance, index) => (
                  <g
                    key={instance.key}
                    transform={`translate(${instance.x - 80}, ${instance.y - 16}) rotate(${lightRotationVal}, 80, 16)`}
                  >
                    {interactive && index === 0 ? (
                      <foreignObject x="0" y="0" width="160" height="32">
                        <div className="w-full h-full" style={{ transform: 'translateZ(0)' }}>
                          <HardwareSelectPopover
                            type="light" items={lights} selectedId={light?.id || null}
                            onSelect={onLightSelect || (() => {})} disabled={!onLightSelect}
                          >
                            <button className="relative w-full h-full cursor-pointer group bg-transparent border-0 p-0">
                              <svg width="160" height="32" viewBox="0 0 160 32">
                                <LightSVGShape hasImage={!!light?.front_view_url} imageUrl={light?.front_view_url} brand={light?.brand} lightType={light?.type} />
                              </svg>
                              {!hasLight && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                                  <span className="text-xs text-muted-foreground">点击选择</span>
                                </div>
                              )}
                            </button>
                          </HardwareSelectPopover>
                        </div>
                      </foreignObject>
                    ) : (
                      <LightSVGShape hasImage={!!light?.front_view_url} imageUrl={light?.front_view_url} brand={light?.brand} lightType={light?.type} />
                    )}
                  </g>
                ))}
              </g>

              {interactive && (
                <RotationHandle
                  cx={lightDrag.pos.x} cy={lightDrag.pos.y}
                  radius={50} angle={lightRotationVal}
                  onAngleChange={setLightRotation} enabled={interactive}
                />
              )}
            </>
          )
        )}


        {/* ===== Right annotation panel ===== */}
        {interactive ? (
          <foreignObject x="500" y="20" width="290" height="600">
            <div
              style={{
                height: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px 8px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              {/* Camera specs */}
              <div style={{ backgroundColor: 'hsl(220, 10%, 96%)', borderRadius: '8px', padding: '6px 8px', border: '1px solid hsl(220, 15%, 82%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '14px' }}>📷</span>
                  <span style={{ fontWeight: 600, fontSize: '12px', color: '#333333' }}>工业相机</span>
                </div>
                {hasCamera ? (
                  <>
                    <p style={{ fontSize: '11px', color: '#333333', margin: 0 }}>
                      {joinDotParts([camera.resolution, formatOpticalFormat(camera.sensor_size)])}
                    </p>
                    {(cameraSensorInfo.effectiveSensorText || cameraSensorInfo.pixelText) && (
                      <p style={{ fontSize: '10px', color: '#444444', margin: 0 }}>
                        {joinDotParts([cameraSensorInfo.effectiveSensorText, cameraSensorInfo.pixelText])}
                      </p>
                    )}
                    <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>{camera.brand} {camera.model} @ {camera.frame_rate}fps</p>
                  </>
                ) : (
                  <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>点击左侧相机图标选择</p>
                )}
              </div>

              {/* Lens specs */}
              {!is3DCamera && (
                <div style={{ backgroundColor: 'hsl(220, 10%, 96%)', borderRadius: '8px', padding: '6px 8px', border: '1px solid hsl(220, 15%, 82%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px' }}>🔭</span>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: '#333333' }}>工业镜头</span>
                  </div>
                  {hasLens ? (
                    <>
                      <p style={{ fontSize: '11px', color: '#333333', margin: 0 }}>
                        {joinDotParts([
                          lens.focal_length ? `${opticalFieldLabels.focalLabel} ${lens.focal_length}` : null,
                          lensSupportedText ?? '支持靶面：待维护',
                        ])}
                      </p>
                      <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>{lens.brand} {lens.model}</p>
                    </>
                  ) : (
                    <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>点击左侧镜头图标选择</p>
                  )}
                </div>
              )}

              {/* Light specs */}
              {!is3DCamera && (
                <div style={{ backgroundColor: 'hsl(220, 10%, 96%)', borderRadius: '8px', padding: '6px 8px', border: '1px solid hsl(220, 15%, 82%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px' }}>💡</span>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: '#333333' }}>光源</span>
                  </div>
                  {hasMultiLights ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '210px', overflowY: 'auto', paddingRight: '2px' }}>
                      {diagramLightItems.map((item, index) => {
                        const itemLight = item.light;
                        const distanceDisplay = formatDistanceDisplay(item.distanceInput, distanceUnit, item.distanceMm);
                        return (
                          <div key={item.id} style={{ borderTop: index === 0 ? 'none' : '1px solid hsl(220, 15%, 86%)', paddingTop: index === 0 ? 0 : 4 }}>
                            <p style={{ fontSize: '10px', color: '#333333', margin: 0, fontWeight: 600 }}>{item.label || `LIGHT${index + 1}`}</p>
                            <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>{itemLight ? `${itemLight.brand} ${itemLight.model}` : '未选择型号'}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '10px', color: '#666666' }}>距离:</span>
                              {onDiagramLightItemDistanceChange ? (
                                <input
                                  type="text"
                                  value={item.distanceInput || ''}
                                  onChange={(e) => onDiagramLightItemDistanceChange(item.id, e.target.value)}
                                  style={{ width: '72px', height: '22px', fontSize: '10px', padding: '0 6px', borderRadius: '4px', border: '1px solid hsl(220, 15%, 78%)', backgroundColor: 'hsl(220, 10%, 98%)', color: '#333' }}
                                />
                              ) : (
                                <span style={{ fontSize: '10px', color: '#666666' }}>{distanceDisplay}</span>
                              )}
                              {onDiagramLightItemDistanceChange && <span style={{ fontSize: '10px', color: '#666666' }}>{distanceUnit}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : hasLight ? (
                    <>
                      <p style={{ fontSize: '11px', color: '#333333', margin: 0 }}>{light.color}{light.type} · {light.power}</p>
                      <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>{light.brand} {light.model} · 数量 {boundedLightCount}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', color: '#666666' }}>光源距产品:</span>
                        {onDiagramLightDistanceChange ? (
                          <input
                            type="text"
                            value={diagramLightDistanceValue}
                            onChange={(e) => onDiagramLightDistanceChange(e.target.value)}
                            style={{ width: '72px', height: '22px', fontSize: '10px', padding: '0 6px', borderRadius: '4px', border: '1px solid hsl(220, 15%, 78%)', backgroundColor: 'hsl(220, 10%, 98%)', color: '#333' }}
                          />
                        ) : (
                          <span style={{ fontSize: '10px', color: '#666666' }}>{diagramLightDistanceDisplay}</span>
                        )}
                        {diagramLightDistanceDisplay !== '待填写' && <span style={{ fontSize: '10px', color: '#666666' }}>{distanceUnit}</span>}
                      </div>
                    </>
                  ) : (
                    <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>点击左侧光源图标选择</p>
                  )}
                </div>
              )}

              {is3DCamera && (
                <div style={{ backgroundColor: 'hsl(220, 10%, 96%)', borderRadius: '8px', padding: '6px 8px', border: '1px solid hsl(220, 15%, 82%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px' }}>▣</span>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: '#333333' }}>3D光学方案</span>
                  </div>
                  {(threeDOpticalLines.length ? threeDOpticalLines : ['待维护3D光学参数']).map(line => (
                    <p key={line} style={{ fontSize: '10px', color: '#333333', margin: 0 }}>{line}</p>
                  ))}
                </div>
              )}

              {/* FOV info */}
              {!is3DCamera && (
              <div style={{ backgroundColor: 'hsl(220, 10%, 96%)', borderRadius: '8px', padding: '6px 8px', border: '1px solid hsl(220, 15%, 82%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '14px' }}>📐</span>
                  <span style={{ fontWeight: 600, fontSize: '12px', color: '#333333' }}>视野参数</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#333333', width: '56px' }}>视角:</span>
                    {onFovAngleChange ? (
                      <input type="number" value={fovAngle}
                        onChange={(e) => onFovAngleChange(parseFloat(e.target.value) || 45)}
                        style={{ width: '56px', height: '24px', fontSize: '11px', padding: '0 6px', borderRadius: '4px', border: '1px solid hsl(220, 15%, 78%)', backgroundColor: 'hsl(220, 10%, 98%)', color: '#333' }}
                        min="10" max="120" />
                    ) : (
                      <span style={{ fontSize: '11px', color: '#333333' }}>{fovAngle}</span>
                    )}
                    <span style={{ fontSize: '10px', color: '#333333' }}>°</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#333333', width: '56px' }}>工作距离:</span>
                    {onWorkingDistanceChange || onLightDistanceChange ? (
                      <input type="text" value={workingDistanceValue}
                        onChange={(e) => {
                          if (onWorkingDistanceChange) {
                            onWorkingDistanceChange(e.target.value);
                            return;
                          }
                          const next = parseFloat(e.target.value);
                          if (Number.isFinite(next)) onLightDistanceChange?.(next);
                        }}
                        style={{ width: '72px', height: '24px', fontSize: '11px', padding: '0 6px', borderRadius: '4px', border: '1px solid hsl(220, 15%, 78%)', backgroundColor: 'hsl(220, 10%, 98%)', color: '#333' }}
                      />
                    ) : (
                      <span style={{ fontSize: '11px', color: '#333333' }}>{workingDistanceNumberDisplay}</span>
                    )}
                    <span style={{ fontSize: '10px', color: '#333333' }}>{distanceUnit}</span>
                  </div>
                  <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>视野宽度约 {fovWidthDisplay}</p>
                  {cameraSensorInfo.sourceLabel && (
                    <p style={{ fontSize: '10px', color: '#888888', margin: 0 }}>计算依据：{cameraSensorInfo.sourceLabel}</p>
                  )}
                </div>
              </div>
              )}

              {/* Controller */}
              {hasController && (
                <div style={{ backgroundColor: 'hsl(220, 10%, 96%)', borderRadius: '8px', padding: '6px 8px', border: '1px solid hsl(220, 15%, 82%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px' }}>🖥️</span>
                    <span style={{ fontWeight: 600, fontSize: '12px', color: '#333333' }}>工控机</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#333333', margin: 0 }}>{controller.cpu}</p>
                  <p style={{ fontSize: '11px', color: '#333333', margin: 0 }}>{controller.memory} · {controller.storage}</p>
                  <p style={{ fontSize: '10px', color: '#666666', margin: 0 }}>{controller.brand} {controller.model}</p>
                  {controller.gpu && <p style={{ fontSize: '10px', color: '#666666', margin: '2px 0 0 0' }}>GPU: {controller.gpu}</p>}
                </div>
              )}
            </div>
          </foreignObject>
        ) : (
          /* Export mode: pure SVG cards */
          <g>
            {(() => {
              const cardX = 508, cardW = 274, cardGap = 7;
              const cardMinHeight = 64;
              const cardPadX = 12;
              const cardPadTop = 7;
              const cardPadBottom = 9;
              const cardTextWidth = cardW - cardPadX * 2;
              const cardTitleFontSize = 16;
              const cardMainFontSize = 14;
              const cardSubFontSize = 13;
              const cardFineFontSize = 12;
              const cardTitleLineHeight = 20;
              const cardMainLineHeight = 18;
              const cardSubLineHeight = 17;
              const cardFineLineHeight = 16;
              const cardBg = 'hsl(220, 10%, 96%)', cardBorder = 'hsl(220, 15%, 82%)';
              const tc = '#333333', ts = '#666666';
              let y = 28;
              const cards: React.ReactNode[] = [];

              type ExportCardTextBlock = {
                key: string;
                text: string | null | undefined;
                color: string;
                fontSize: number;
                lineHeight: number;
                fontWeight?: number;
                gapAfter?: number;
              };
              type ExportCardLayoutBlock = ExportCardTextBlock & {
                lines: string[];
                y: number;
              };

              const titleBlock = (key: string, text: string): ExportCardTextBlock => ({
                key,
                text,
                color: tc,
                fontSize: cardTitleFontSize,
                lineHeight: cardTitleLineHeight,
                fontWeight: 600,
                gapAfter: 3,
              });
              const mainBlock = (key: string, text: string | null | undefined, color = tc): ExportCardTextBlock => ({
                key,
                text,
                color,
                fontSize: cardMainFontSize,
                lineHeight: cardMainLineHeight,
                gapAfter: 2,
              });
              const subBlock = (key: string, text: string | null | undefined, color = ts): ExportCardTextBlock => ({
                key,
                text,
                color,
                fontSize: cardSubFontSize,
                lineHeight: cardSubLineHeight,
                gapAfter: 2,
              });
              const fineBlock = (key: string, text: string | null | undefined, color = ts): ExportCardTextBlock => ({
                key,
                text,
                color,
                fontSize: cardFineFontSize,
                lineHeight: cardFineLineHeight,
                gapAfter: 2,
              });

              const layoutCardBlocks = (blocks: ExportCardTextBlock[], minHeight = cardMinHeight) => {
                let cursor = cardPadTop;
                const layoutBlocks: ExportCardLayoutBlock[] = blocks.map((block) => {
                  const lines = wrapSvgText(block.text, cardTextWidth, block.fontSize);
                  const baselineY = cursor + block.fontSize;
                  cursor = baselineY + Math.max(0, lines.length - 1) * block.lineHeight + (block.gapAfter ?? 2);
                  return { ...block, lines, y: baselineY };
                });
                const lastGap = blocks.length ? (blocks[blocks.length - 1].gapAfter ?? 2) : 0;
                const height = Math.max(minHeight, cursor - lastGap + cardPadBottom);
                return { height, blocks: layoutBlocks };
              };

              const renderTextBlock = (block: ExportCardLayoutBlock) => (
                <text
                  key={block.key}
                  x={cardPadX}
                  y={block.y}
                  fill={block.color}
                  style={{ fontSize: block.fontSize, fontWeight: block.fontWeight }}
                >
                  {block.lines.map((line, index) => (
                    <tspan key={`${block.key}-${index}`} x={cardPadX} dy={index === 0 ? 0 : block.lineHeight}>
                      {line}
                    </tspan>
                  ))}
                </text>
              );

              const pushCard = (cardKey: string, blocks: ExportCardTextBlock[], minHeight = cardMinHeight) => {
                const layout = layoutCardBlocks(blocks, minHeight);
                cards.push(
                  <g key={cardKey} data-testid={`export-card-${cardKey}`} transform={`translate(${cardX}, ${y})`}>
                    <rect width={cardW} height={layout.height} rx="8" fill={cardBg} stroke={cardBorder} strokeWidth="1" />
                    {layout.blocks.map(renderTextBlock)}
                  </g>
                );
                y += layout.height + cardGap;
              };

              const cameraLine2 = joinDotParts([cameraSensorInfo.effectiveSensorText, cameraSensorInfo.pixelText]);
              const cameraBlocks = [titleBlock('cam-title', '📷 工业相机')];
              if (hasCamera) {
                cameraBlocks.push(
                  mainBlock('cam-spec', joinDotParts([camera.resolution, formatOpticalFormat(camera.sensor_size)])),
                );
                if (cameraLine2) cameraBlocks.push(fineBlock('cam-sensor', cameraLine2, tc));
                cameraBlocks.push(subBlock('cam-model', `${camera.brand} ${camera.model} @ ${camera.frame_rate}fps`));
              } else {
                cameraBlocks.push(subBlock('cam-empty', '未选择相机'));
              }
              pushCard('cam', cameraBlocks);

              if (!is3DCamera) {
                const lensBlocks = [titleBlock('lens-title', '🔭 工业镜头')];
                if (hasLens) {
                  lensBlocks.push(
                    mainBlock('lens-spec', joinDotParts([lens.focal_length ? `${opticalFieldLabels.focalLabel} ${lens.focal_length}` : null, lensSupportedText ?? '支持靶面：待维护'])),
                    subBlock('lens-model', `${lens.brand} ${lens.model}`),
                  );
                } else {
                  lensBlocks.push(subBlock('lens-empty', '未选择镜头'));
                }
                pushCard('lens', lensBlocks);
              }

              if (!is3DCamera) {
                const lightBlocks = [titleBlock('light-title', '💡 光源')];
                if (hasMultiLights) {
                  diagramLightItems.forEach((item, index) => {
                    lightBlocks.push(fineBlock(
                      `light-${item.id}`,
                      `${item.label || `LIGHT${index + 1}`} · ${item.light ? `${item.light.brand} ${item.light.model}` : '未选择'} · 距离 ${formatDistanceDisplay(item.distanceInput, distanceUnit, item.distanceMm)}`,
                      index === 0 ? tc : ts,
                    ));
                  });
                } else if (hasLight) {
                  lightBlocks.push(
                    mainBlock('light-spec', `${light.color}${light.type} · ${light.power}`),
                    subBlock('light-model', `${light.brand} ${light.model}`),
                    subBlock('light-distance', `数量 ${boundedLightCount} · 光源距产品: ${diagramLightDistanceWithUnit}`),
                  );
                } else {
                  lightBlocks.push(subBlock('light-empty', '未选择光源'));
                }
                pushCard('light', lightBlocks);
              }

              if (is3DCamera) {
                const opticalLines = threeDOpticalLines.length ? threeDOpticalLines : ['待维护3D光学参数'];
                pushCard('three-d-optical', [
                  titleBlock('three-d-title', '▣ 3D光学方案'),
                  ...opticalLines.map((line, index) => subBlock(`three-d-line-${index}`, line, index === 0 ? tc : ts)),
                ]);
              }

              if (!is3DCamera) {
                const fovBlocks = [
                  titleBlock('fov-title', '📐 视野参数'),
                  mainBlock('fov-angle', `视角: ${fovAngle}°`),
                  mainBlock('fov-distance', `工作距离: ${workingDistanceDisplay}`),
                  subBlock('fov-width', `视野宽度约 ${fovWidthDisplay}`),
                ];
                if (cameraSensorInfo.sourceLabel) {
                  fovBlocks.push(subBlock('fov-source', `计算依据：${cameraSensorInfo.sourceLabel}`));
                }
                pushCard('fov', fovBlocks);
              }

              if (hasController) {
                const controllerBlocks = [
                  titleBlock('controller-title', '🖥️ 工控机'),
                  mainBlock('controller-cpu', controller.cpu || '-'),
                  mainBlock('controller-memory', `${controller.memory || '-'} · ${controller.storage || '-'}`),
                  subBlock('controller-model', `${controller.brand} ${controller.model}`),
                ];
                if (controller.gpu) controllerBlocks.push(subBlock('controller-gpu', `GPU: ${controller.gpu}`));
                pushCard('controller', controllerBlocks);
              }

              return cards;
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}
