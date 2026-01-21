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
import { useState, useCallback } from 'react';

// Hardware image with error handling
function HardwareImage({ 
  url, 
  alt, 
  type,
  className 
}: { 
  url: string | null | undefined; 
  alt: string;
  type: 'camera' | 'lens' | 'light' | 'controller';
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  
  const handleError = useCallback(() => {
    setHasError(true);
  }, []);
  
  const emoji = type === 'camera' ? '📷' : type === 'lens' ? '🔭' : type === 'light' ? '💡' : '🖥️';
  
  if (!url || hasError) {
    return <span className="text-2xl">{emoji}</span>;
  }
  
  return (
    <img 
      src={url} 
      alt={alt} 
      className={className || "w-full h-full object-cover"}
      onError={handleError}
    />
  );
}

interface HardwareSelectPopoverProps {
  type: 'camera' | 'lens' | 'light' | 'controller';
  items: (Camera | Lens | Light | Controller)[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function HardwareSelectPopover({ 
  type, 
  items, 
  selectedId, 
  onSelect, 
  children,
  disabled 
}: HardwareSelectPopoverProps) {
  const [open, setOpen] = useState(false);

  const typeLabels = {
    camera: '选择相机',
    lens: '选择镜头',
    light: '选择光源',
    controller: '选择工控机'
  };

  const getItemDetails = (item: Camera | Lens | Light | Controller) => {
    if ('resolution' in item && 'frame_rate' in item) {
      const camera = item as Camera;
      return `${camera.resolution} @ ${camera.frame_rate}fps`;
    }
    if ('focal_length' in item) {
      const lens = item as Lens;
      return `${lens.focal_length} · ${lens.aperture}`;
    }
    if ('color' in item && 'power' in item) {
      const light = item as Light;
      return `${light.color}${light.type} · ${light.power}`;
    }
    if ('cpu' in item) {
      const controller = item as Controller;
      return `${controller.cpu} · ${controller.memory}`;
    }
    return '';
  };

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-3 py-2 border-b border-border">
          <h4 className="font-semibold text-sm">{typeLabels[type]}</h4>
          <p className="text-xs text-muted-foreground">点击选择硬件设备</p>
        </div>
        <ScrollArea className="h-64">
          <div className="p-2 space-y-1">
            {items.filter(i => i.enabled).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                  "hover:bg-accent",
                  selectedId === item.id && "bg-primary/10 border border-primary/30"
                )}
              >
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  <HardwareImage url={item.image_url} alt={item.model} type={type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{item.brand}</span>
                    {selectedId === item.id && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.model}</p>
                  <p className="text-xs text-muted-foreground">{getItemDetails(item)}</p>
                </div>
              </button>
            ))}
            {items.filter(i => i.enabled).length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无可用{typeLabels[type].replace('选择', '')}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface VisionSystemDiagramProps {
  camera: Camera | null;
  lens: Lens | null;
  light: Light | null;
  controller?: Controller | null;
  cameras?: Camera[];
  lenses?: Lens[];
  lights?: Light[];
  controllers?: Controller[];
  onCameraSelect?: (id: string) => void;
  onLensSelect?: (id: string) => void;
  onLightSelect?: (id: string) => void;
  onControllerSelect?: (id: string) => void;
  lightDistance?: number;
  fovAngle?: number;
  onFovAngleChange?: (angle: number) => void;
  onLightDistanceChange?: (distance: number) => void;
  roiStrategy?: string;
  moduleType?: string;
  interactive?: boolean;
  className?: string;
}

export function VisionSystemDiagram({ 
  camera, 
  lens, 
  light,
  controller,
  cameras = [],
  lenses = [],
  lights = [],
  controllers = [],
  onCameraSelect,
  onLensSelect,
  onLightSelect,
  onControllerSelect,
  lightDistance = 335,
  fovAngle = 45,
  onFovAngleChange,
  onLightDistanceChange,
  roiStrategy = 'full',
  moduleType = 'defect',
  interactive = true,
  className
}: VisionSystemDiagramProps) {
  const hasCamera = !!camera;
  const hasLens = !!lens;
  const hasLight = !!light;
  const hasController = !!controller;

  // Calculate FOV line endpoints based on angle
  const fovRadians = (fovAngle / 2) * (Math.PI / 180);
  const fovLength = 250;
  const fovOffsetX = Math.tan(fovRadians) * fovLength;

  const interactiveClass = interactive ? "cursor-pointer hover:opacity-80 transition-opacity" : "";

  return (
    <div className={cn("relative w-full h-full min-h-[500px]", className)}>
      <svg 
        viewBox="0 0 800 550" 
        className="w-full h-full"
        style={{ maxHeight: '100%' }}
      >
        <defs>
          {/* Camera FOV gradient */}
          <linearGradient id="fovGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(220, 80%, 60%)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(220, 80%, 60%)" stopOpacity="0.05" />
          </linearGradient>

          {/* Light cone gradient */}
          <linearGradient id="lightCone" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(270, 50%, 70%)" stopOpacity="0.5" />
            <stop offset="50%" stopColor="hsl(270, 50%, 70%)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(270, 50%, 70%)" stopOpacity="0.05" />
          </linearGradient>

          {/* Light illumination zone */}
          <radialGradient id="lightZone" cx="50%" cy="0%" r="100%" fx="50%" fy="0%">
            <stop offset="0%" stopColor="hsl(45, 100%, 70%)" stopOpacity="0.4" />
            <stop offset="40%" stopColor="hsl(45, 100%, 60%)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(45, 100%, 50%)" stopOpacity="0" />
          </radialGradient>
          
          {/* Camera body gradient */}
          <linearGradient id="cameraBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(270, 40%, 55%)" />
            <stop offset="50%" stopColor="hsl(270, 40%, 45%)" />
            <stop offset="100%" stopColor="hsl(270, 40%, 35%)" />
          </linearGradient>

          {/* Camera hover gradient */}
          <linearGradient id="cameraBodyHover" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(270, 50%, 65%)" />
            <stop offset="50%" stopColor="hsl(270, 50%, 55%)" />
            <stop offset="100%" stopColor="hsl(270, 50%, 45%)" />
          </linearGradient>

          {/* Lens gradient */}
          <linearGradient id="lensBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(30, 20%, 40%)" />
            <stop offset="50%" stopColor="hsl(30, 20%, 30%)" />
            <stop offset="100%" stopColor="hsl(30, 20%, 20%)" />
          </linearGradient>

          {/* Lens glass gradient */}
          <radialGradient id="lensGlass" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="hsl(200, 50%, 70%)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(200, 50%, 40%)" stopOpacity="0.4" />
          </radialGradient>

          {/* Product gradient */}
          <linearGradient id="productBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(220, 60%, 40%)" />
            <stop offset="100%" stopColor="hsl(220, 60%, 25%)" />
          </linearGradient>

          {/* Ring light glow */}
          <filter id="lightGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Selection highlight */}
          <filter id="selectGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Arrow markers */}
          <marker id="arrowUp" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1,7 L4,1 L7,7" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
          <marker id="arrowDown" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1,1 L4,7 L7,1" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
          <marker id="arrowLeft" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M7,1 L1,4 L7,7" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
          <marker id="arrowRight" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1,1 L7,4 L1,7" fill="none" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          </marker>
        </defs>

        {/* Background grid */}
        <g opacity="0.1">
          {Array.from({ length: 15 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 40} x2="700" y2={i * 40} stroke="currentColor" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="550" stroke="currentColor" strokeWidth="0.5" />
          ))}
        </g>

        {/* Camera FOV (Field of View) visualization */}
        <g>
          <polygon 
            points={`220,130 ${220 - fovOffsetX},${130 + fovLength} ${220 + fovOffsetX},${130 + fovLength}`}
            fill="url(#fovGradient)"
          />
          <line 
            x1="220" y1="130" 
            x2={220 - fovOffsetX} y2={130 + fovLength} 
            stroke="hsl(220, 80%, 60%)" 
            strokeWidth="1.5" 
            strokeDasharray="8,4"
            opacity="0.7"
          />
          <line 
            x1="220" y1="130" 
            x2={220 + fovOffsetX} y2={130 + fovLength} 
            stroke="hsl(220, 80%, 60%)" 
            strokeWidth="1.5" 
            strokeDasharray="8,4"
            opacity="0.7"
          />
          {/* FOV angle arc - moved up to avoid overlap */}
          <path 
            d={`M ${220 - 25} 145 A 30 30 0 0 1 ${220 + 25} 145`}
            fill="none"
            stroke="hsl(220, 80%, 60%)"
            strokeWidth="1.5"
          />
          {/* FOV angle label - positioned outside the arc, above the lens */}
          <text x="280" y="130" textAnchor="start" className="fill-primary" style={{ fontSize: '11px', fontWeight: 500 }}>
            {fovAngle}°
          </text>
          {/* Connector line from arc to label */}
          <line x1="245" y1="140" x2="275" y2="132" stroke="hsl(220, 80%, 60%)" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
        </g>

        {/* Light illumination zone on product */}
        <ellipse 
          cx="220" 
          cy="475" 
          rx="100" 
          ry="25" 
          fill="url(#lightZone)"
          opacity="0.8"
        />

        {/* Light cone / rays */}
        <polygon 
          points="220,235 120,460 320,460" 
          fill="url(#lightCone)"
        />
        
        {/* Light ray lines */}
        <g stroke="hsl(270, 50%, 70%)" strokeWidth="0.5" opacity="0.4">
          <line x1="220" y1="235" x2="140" y2="460" />
          <line x1="220" y1="235" x2="170" y2="460" />
          <line x1="220" y1="235" x2="200" y2="460" />
          <line x1="220" y1="235" x2="240" y2="460" />
          <line x1="220" y1="235" x2="270" y2="460" />
          <line x1="220" y1="235" x2="300" y2="460" />
        </g>

        {/* Focus point indicator */}
        <g transform="translate(220, 340)">
          <circle r="8" fill="hsl(220, 80%, 50%)" opacity="0.3" className="animate-ping" />
          <circle r="4" fill="hsl(220, 80%, 50%)" />
          <line x1="-12" y1="0" x2="-6" y2="0" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          <line x1="6" y1="0" x2="12" y2="0" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          <line x1="0" y1="-12" x2="0" y2="-6" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
          <line x1="0" y1="6" x2="0" y2="12" stroke="hsl(220, 80%, 50%)" strokeWidth="1.5" />
        </g>

        {/* Product with ROI indicator */}
        <g transform="translate(155, 460)">
          <rect 
            x="0" 
            y="0" 
            width="130" 
            height="45" 
            rx="3"
            fill="url(#productBody)"
          />
          {/* ROI indicator on product surface */}
          <rect 
            x={roiStrategy === 'full' ? 5 : 25} 
            y="5" 
            width={roiStrategy === 'full' ? 120 : 80} 
            height="35" 
            rx="2"
            fill="none"
            stroke="hsl(120, 70%, 50%)"
            strokeWidth="1.5"
            strokeDasharray="4,2"
            opacity="0.8"
          />
          {/* ROI corner markers */}
          <g stroke="hsl(120, 70%, 50%)" strokeWidth="2" opacity="0.9">
            {/* Top-left corner */}
            <path d={`M ${roiStrategy === 'full' ? 5 : 25} 12 L ${roiStrategy === 'full' ? 5 : 25} 5 L ${roiStrategy === 'full' ? 12 : 32} 5`} fill="none" />
            {/* Top-right corner */}
            <path d={`M ${roiStrategy === 'full' ? 118 : 98} 5 L ${roiStrategy === 'full' ? 125 : 105} 5 L ${roiStrategy === 'full' ? 125 : 105} 12`} fill="none" />
            {/* Bottom-left corner */}
            <path d={`M ${roiStrategy === 'full' ? 5 : 25} 33 L ${roiStrategy === 'full' ? 5 : 25} 40 L ${roiStrategy === 'full' ? 12 : 32} 40`} fill="none" />
            {/* Bottom-right corner */}
            <path d={`M ${roiStrategy === 'full' ? 118 : 98} 40 L ${roiStrategy === 'full' ? 125 : 105} 40 L ${roiStrategy === 'full' ? 125 : 105} 33`} fill="none" />
          </g>
          {/* ROI label */}
          <text 
            x="65" 
            y="26" 
            textAnchor="middle" 
            fill="hsl(120, 70%, 60%)" 
            style={{ fontSize: '9px', fontWeight: 500 }}
          >
            ROI
          </text>
          <text x="65" y="55" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '9px' }}>
            待检测产品
          </text>
        </g>

        {/* Dimension line - vertical */}
        <g transform="translate(70, 0)">
          <line x1="0" y1="215" x2="35" y2="215" stroke="hsl(220, 80%, 50%)" strokeWidth="1" />
          <line x1="0" y1="480" x2="35" y2="480" stroke="hsl(220, 80%, 50%)" strokeWidth="1" />
          <line 
            x1="18" 
            y1="225" 
            x2="18" 
            y2="470" 
            stroke="hsl(220, 80%, 50%)" 
            strokeWidth="1.5"
            markerStart="url(#arrowUp)"
            markerEnd="url(#arrowDown)"
          />
          <text 
            x="0" 
            y="350" 
            textAnchor="middle" 
            className="fill-primary font-medium"
            style={{ fontSize: '12px' }}
            transform="rotate(-90, 0, 350)"
          >
            {lightDistance}±20mm
          </text>
        </g>

        {/* FOV width dimension */}
        <g transform="translate(0, 515)">
          <line x1={220 - fovOffsetX} y1="-10" x2={220 - fovOffsetX} y2="5" stroke="hsl(220, 80%, 50%)" strokeWidth="1" />
          <line x1={220 + fovOffsetX} y1="-10" x2={220 + fovOffsetX} y2="5" stroke="hsl(220, 80%, 50%)" strokeWidth="1" />
          <line 
            x1={220 - fovOffsetX + 10} 
            y1="0" 
            x2={220 + fovOffsetX - 10} 
            y2="0" 
            stroke="hsl(220, 80%, 50%)" 
            strokeWidth="1.5"
            markerStart="url(#arrowLeft)"
            markerEnd="url(#arrowRight)"
          />
          <text x="220" y="20" textAnchor="middle" className="fill-primary" style={{ fontSize: '11px' }}>
            视野宽度 ~{Math.round(fovOffsetX * 2)}mm
          </text>
        </g>

        {/* Connection lines to annotations */}
        <g stroke="hsl(220, 80%, 50%)" strokeWidth="1" strokeDasharray="4,2" opacity="0.6">
          <line x1="265" y1="65" x2="395" y2="55" />
          <line x1="268" y1="140" x2="395" y2="130" />
          <line x1="290" y1="215" x2="395" y2="200" />
        </g>

        {/* Interactive Camera Element - embedded in SVG */}
        <foreignObject x="175" y="30" width="90" height="85">
          <div className="w-full h-full">
            <HardwareSelectPopover
              type="camera"
              items={cameras}
              selectedId={camera?.id || null}
              onSelect={onCameraSelect || (() => {})}
              disabled={!interactive || !onCameraSelect}
            >
              <div className={cn(
                "relative w-full h-full cursor-pointer group"
              )}>
                <svg width="90" height="85" viewBox="0 0 90 85" className="group-hover:drop-shadow-lg transition-all">
                  <rect x="0" y="0" width="90" height="75" rx="6" fill="url(#cameraBody)" className="group-hover:brightness-110" />
                  <rect x="10" y="5" width="25" height="8" rx="2" fill="hsl(270, 30%, 60%)" opacity="0.5" />
                  <circle cx="75" cy="12" r="4" fill="hsl(120, 70%, 50%)" />
                  <text x="45" y="50" textAnchor="middle" fill="white" style={{ fontSize: '14px', fontWeight: 600 }}>Cam1</text>
                  <rect x="30" y="75" width="30" height="10" fill="hsl(0, 0%, 25%)" />
                </svg>
                {interactive && onCameraSelect && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <span className="text-primary-foreground text-xs">✎</span>
                  </div>
                )}
                {!hasCamera && interactive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                    <span className="text-xs text-muted-foreground">点击选择</span>
                  </div>
                )}
              </div>
            </HardwareSelectPopover>
          </div>
        </foreignObject>

        {/* Interactive Lens Element - embedded in SVG */}
        <foreignObject x="172" y="115" width="96" height="62">
          <div className="w-full h-full">
            <HardwareSelectPopover
              type="lens"
              items={lenses}
              selectedId={lens?.id || null}
              onSelect={onLensSelect || (() => {})}
              disabled={!interactive || !onLensSelect}
            >
              <div className={cn(
                "relative w-full h-full cursor-pointer group"
              )}>
                <svg width="96" height="62" viewBox="0 0 96 62" className="group-hover:drop-shadow-lg transition-all">
                  <rect x="8" y="0" width="80" height="50" rx="3" fill="url(#lensBody)" className="group-hover:brightness-110" />
                  <ellipse cx="48" cy="40" rx="25" ry="8" fill="url(#lensGlass)" />
                  <rect x="0" y="45" width="96" height="12" rx="2" fill="hsl(0, 0%, 20%)" />
                  <rect x="13" y="12" width="70" height="3" fill="hsl(30, 15%, 45%)" rx="1" />
                  <rect x="13" y="28" width="70" height="3" fill="hsl(30, 15%, 45%)" rx="1" />
                </svg>
                {interactive && onLensSelect && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <span className="text-primary-foreground text-xs">✎</span>
                  </div>
                )}
                {!hasLens && interactive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                    <span className="text-xs text-muted-foreground">点击选择</span>
                  </div>
                )}
              </div>
            </HardwareSelectPopover>
          </div>
        </foreignObject>

        {/* Interactive Light Element - embedded in SVG */}
        <foreignObject x="150" y="195" width="140" height="40">
          <div className="w-full h-full">
            <HardwareSelectPopover
              type="light"
              items={lights}
              selectedId={light?.id || null}
              onSelect={onLightSelect || (() => {})}
              disabled={!interactive || !onLightSelect}
            >
              <div className={cn(
                "relative w-full h-full cursor-pointer group"
              )}>
                <svg width="140" height="40" viewBox="0 0 140 40" className="group-hover:drop-shadow-lg transition-all">
                  <rect x="0" y="0" width="140" height="40" rx="6" fill="hsl(0, 0%, 45%)" className="group-hover:brightness-110" />
                  <rect x="5" y="5" width="130" height="30" rx="4" fill="hsl(0, 0%, 35%)" />
                  <rect x="40" y="8" width="60" height="24" rx="3" fill="hsl(0, 0%, 15%)" />
                  <rect x="10" y="12" width="25" height="16" fill="hsl(0, 75%, 50%)" rx="2" />
                  <rect x="105" y="12" width="25" height="16" fill="hsl(0, 75%, 50%)" rx="2" />
                </svg>
                {interactive && onLightSelect && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <span className="text-primary-foreground text-xs">✎</span>
                  </div>
                )}
                {!hasLight && interactive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded">
                    <span className="text-xs text-muted-foreground">点击选择</span>
                  </div>
                )}
              </div>
            </HardwareSelectPopover>
          </div>
        </foreignObject>

        {/* Interactive Controller Element - positioned at bottom right, only show if controller is selected */}
        {hasController && (
          <foreignObject x="340" y="430" width="140" height="80">
            <div className="w-full h-full">
              <HardwareSelectPopover
                type="controller"
                items={controllers}
                selectedId={controller?.id || null}
                onSelect={onControllerSelect || (() => {})}
                disabled={!interactive || !onControllerSelect}
              >
                <div className="relative w-full h-full cursor-pointer group">
                  <svg width="140" height="80" viewBox="0 0 140 80" className="group-hover:drop-shadow-lg transition-all">
                    {/* IPC Body - compact version */}
                    <rect x="0" y="5" width="140" height="70" rx="3" fill="hsl(220, 15%, 25%)" className="group-hover:brightness-110" />
                    <rect x="4" y="9" width="132" height="62" rx="2" fill="hsl(220, 15%, 20%)" />
                    
                    {/* Front panel */}
                    <rect x="8" y="13" width="124" height="54" rx="2" fill="hsl(220, 15%, 15%)" />
                    
                    {/* Power button */}
                    <circle cx="20" cy="28" r="5" fill="hsl(220, 10%, 30%)" />
                    <circle cx="20" cy="28" r="3" fill="hsl(120, 70%, 50%)" />
                    
                    {/* Drive bay */}
                    <rect x="32" y="20" width="45" height="12" rx="1" fill="hsl(220, 10%, 25%)" />
                    
                    {/* Activity LEDs */}
                    <circle cx="85" cy="26" r="2" fill="hsl(220, 80%, 50%)" />
                    <circle cx="93" cy="26" r="2" fill="hsl(40, 80%, 50%)" />
                    
                    {/* Ventilation */}
                    <g fill="hsl(220, 10%, 10%)">
                      <rect x="105" y="18" width="22" height="2" rx="1" />
                      <rect x="105" y="23" width="22" height="2" rx="1" />
                      <rect x="105" y="28" width="22" height="2" rx="1" />
                      <rect x="105" y="33" width="22" height="2" rx="1" />
                    </g>
                    
                    {/* USB ports */}
                    <rect x="16" y="50" width="10" height="5" rx="1" fill="hsl(0, 0%, 15%)" stroke="hsl(0, 0%, 40%)" strokeWidth="0.5" />
                    <rect x="30" y="50" width="10" height="5" rx="1" fill="hsl(0, 0%, 15%)" stroke="hsl(0, 0%, 40%)" strokeWidth="0.5" />
                    
                    {/* Display port */}
                    <rect x="46" y="49" width="16" height="7" rx="1" fill="hsl(0, 0%, 15%)" stroke="hsl(220, 80%, 50%)" strokeWidth="0.5" />
                    
                    {/* Label */}
                    <text x="100" y="58" textAnchor="middle" fill="hsl(0, 0%, 60%)" style={{ fontSize: '9px', fontWeight: 500 }}>IPC</text>
                  </svg>
                  {interactive && onControllerSelect && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <span className="text-primary-foreground text-[10px]">✎</span>
                    </div>
                  )}
                </div>
              </HardwareSelectPopover>
            </div>
          </foreignObject>
        )}

        {/* Annotations in SVG - moved further right */}
        <foreignObject x="500" y="20" width="290" height="520">
          <div className="space-y-2" style={{ padding: '8px' }}>
            {/* Camera specs */}
            <div className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">📷</span>
                <span className="font-semibold text-xs text-foreground">工业相机</span>
              </div>
              {hasCamera ? (
                <>
                  <p className="text-[11px] text-foreground">{camera.resolution} · 靶面{camera.sensor_size}</p>
                  <p className="text-[10px] text-muted-foreground">{camera.brand} {camera.model} @ {camera.frame_rate}fps</p>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">点击左侧相机图标选择</p>
              )}
            </div>

            {/* Lens specs */}
            <div className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🔭</span>
                <span className="font-semibold text-xs text-foreground">工业镜头</span>
              </div>
              {hasLens ? (
                <>
                  <p className="text-[11px] text-foreground">焦距 {lens.focal_length} · 光圈 {lens.aperture}</p>
                  <p className="text-[10px] text-muted-foreground">{lens.brand} {lens.model}</p>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">点击左侧镜头图标选择</p>
              )}
            </div>

            {/* Light specs */}
            <div className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">💡</span>
                <span className="font-semibold text-xs text-foreground">光源</span>
              </div>
              {hasLight ? (
                <>
                  <p className="text-[11px] text-foreground">{light.color}{light.type} · {light.power}</p>
                  <p className="text-[10px] text-muted-foreground">{light.brand} {light.model}</p>
                  <p className="text-[10px] text-primary mt-0.5">光源距离产品：{lightDistance}±20mm</p>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">点击左侧光源图标选择</p>
              )}
            </div>

            {/* FOV info - editable */}
            <div className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">📐</span>
                <span className="font-semibold text-xs text-foreground">视野参数</span>
                {interactive && (onFovAngleChange || onLightDistanceChange) && (
                  <span className="text-[9px] text-primary ml-auto">可编辑</span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-14">视角:</span>
                  {interactive && onFovAngleChange ? (
                    <input
                      type="number"
                      value={fovAngle}
                      onChange={(e) => onFovAngleChange(parseFloat(e.target.value) || 45)}
                      className="w-14 h-6 text-[11px] px-1.5 rounded border bg-background text-foreground"
                      min="10"
                      max="120"
                    />
                  ) : (
                    <span className="text-[11px] text-foreground">{fovAngle}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">°</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-14">工作距离:</span>
                  {interactive && onLightDistanceChange ? (
                    <input
                      type="number"
                      value={lightDistance}
                      onChange={(e) => onLightDistanceChange(parseFloat(e.target.value) || 335)}
                      className="w-14 h-6 text-[11px] px-1.5 rounded border bg-background text-foreground"
                      min="50"
                      max="1000"
                    />
                  ) : (
                    <span className="text-[11px] text-foreground">{lightDistance}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">mm</span>
                </div>
                <p className="text-[10px] text-muted-foreground">视野宽度约 {Math.round(fovOffsetX * 2)}mm</p>
              </div>
            </div>

            {/* Controller specs - only show if controller is selected */}
            {hasController && (
              <div className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 border shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">🖥️</span>
                  <span className="font-semibold text-xs text-foreground">工控机</span>
                </div>
                <p className="text-[11px] text-foreground">{controller.cpu}</p>
                <p className="text-[11px] text-foreground">{controller.memory} · {controller.storage}</p>
                <p className="text-[10px] text-muted-foreground">{controller.brand} {controller.model}</p>
                {controller.gpu && (
                  <p className="text-[10px] text-primary mt-0.5">GPU: {controller.gpu}</p>
                )}
              </div>
            )}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}
