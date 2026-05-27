import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toLocalProxyUrl } from '@/utils/storageUrl';
import {
  Circle,
  Square,
  ArrowRight,
  Type,
  Hash,
  Trash2,
  Edit3,
  MousePointer,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Loader2 } from 'lucide-react';

export interface Annotation {
  id: string;
  type: 'point' | 'rect' | 'arrow' | 'text' | 'number';
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  number?: number;
  name: string;
  description: string;
  category: string;
  dimension?: string;
  tolerance?: string;
}

export interface ImageTransform {
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

interface AnnotationCanvasProps {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  readOnly?: boolean;
  fillContainer?: boolean;
  highlightId?: string | null;
  onTransformChange?: (transform: ImageTransform) => void;
}

type Tool = 'select' | 'point' | 'rect' | 'arrow' | 'text' | 'number';

const TOOLS: { value: Tool; label: string; icon: React.ReactNode }[] = [
  { value: 'select', label: '选择', icon: <MousePointer className="h-4 w-4" /> },
  { value: 'point', label: '点', icon: <Circle className="h-4 w-4" /> },
  { value: 'rect', label: '矩形', icon: <Square className="h-4 w-4" /> },
  { value: 'arrow', label: '箭头', icon: <ArrowRight className="h-4 w-4" /> },
  { value: 'text', label: '文本', icon: <Type className="h-4 w-4" /> },
  { value: 'number', label: '编号', icon: <Hash className="h-4 w-4" /> },
];

const CATEGORIES = [
  { value: 'mark', label: 'Mark点' },
  { value: 'qrcode', label: '二维码' },
  { value: 'hole', label: '定位孔' },
  { value: 'pole', label: '极柱' },
  { value: 'edge', label: '边缘' },
  { value: 'surface', label: '表面' },
  { value: 'defect', label: '缺陷检测区' },
  { value: 'other', label: '其他' },
];

interface ImageBounds {
  renderWidth: number;
  renderHeight: number;
  offsetX: number;
  offsetY: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.15;

export function AnnotationCanvas({
  imageUrl,
  annotations,
  onChange,
  readOnly = false,
  fillContainer = false,
  highlightId = null,
  onTransformChange,
}: AnnotationCanvasProps) {
  const proxiedImageUrl = toLocalProxyUrl(imageUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('point');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempAnnotation, setTempAnnotation] = useState<Partial<Annotation> | null>(null);
  const [nextNumber, setNextNumber] = useState(1);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [imageBounds, setImageBounds] = useState<ImageBounds>({ renderWidth: 0, renderHeight: 0, offsetX: 0, offsetY: 0 });
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number; origAnnotation: Annotation } | null>(null);
  const [imageLoadState, setImageLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');

  // Image transform state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Notify parent of transform changes
  useEffect(() => {
    onTransformChange?.({ rotation, flipH, flipV });
  }, [rotation, flipH, flipV, onTransformChange]);

  // Calculate next number
  useEffect(() => {
    const maxNumber = annotations
      .filter(a => a.type === 'number')
      .reduce((max, a) => Math.max(max, a.number || 0), 0);
    setNextNumber(maxNumber + 1);
  }, [annotations]);

  // Space key for panning mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        setIsPanning(false);
        setPanStart(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Effective image dimensions after rotation (for bounds calc)
  const effectiveImageSize = useCallback(() => {
    if (rotation === 90 || rotation === 270) {
      return { width: imageSize.height, height: imageSize.width };
    }
    return imageSize;
  }, [imageSize, rotation]);

  // Calculate image bounds for object-contain alignment
  const calcImageBounds = useCallback(() => {
    if (!containerRef.current || !imageSize.width || !imageSize.height) return;
    const container = containerRef.current.getBoundingClientRect();
    const effSize = effectiveImageSize();
    const containerAspect = container.width / container.height;
    const imageAspect = effSize.width / effSize.height;

    let renderWidth: number, renderHeight: number, offsetX: number, offsetY: number;
    if (imageAspect > containerAspect) {
      renderWidth = container.width;
      renderHeight = container.width / imageAspect;
      offsetX = 0;
      offsetY = (container.height - renderHeight) / 2;
    } else {
      renderHeight = container.height;
      renderWidth = container.height * imageAspect;
      offsetX = (container.width - renderWidth) / 2;
      offsetY = 0;
    }
    setImageBounds({
      renderWidth: Math.round(renderWidth),
      renderHeight: Math.round(renderHeight),
      offsetX: Math.round(offsetX),
      offsetY: Math.round(offsetY),
    });
  }, [imageSize, effectiveImageSize]);

  useEffect(() => {
    setImageLoadState('loading');
    setImageSize({ width: 0, height: 0 });
    setImageBounds({ renderWidth: 0, renderHeight: 0, offsetX: 0, offsetY: 0 });
    setSelectedId(null);
  }, [imageUrl]);

  useEffect(() => {
    calcImageBounds();
    window.addEventListener('resize', calcImageBounds);
    return () => window.removeEventListener('resize', calcImageBounds);
  }, [calcImageBounds]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => calcImageBounds());
    ro.observe(el);
    return () => ro.disconnect();
  }, [calcImageBounds]);

  // Get coordinates relative to the actual rendered image area, accounting for transforms
  const getRelativeCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    if (!containerRef.current || !imageBounds.renderWidth || !imageBounds.renderHeight) return { x: 0, y: 0 };
    const container = containerRef.current.getBoundingClientRect();

    // Mouse position relative to the container center
    const cx = container.width / 2;
    const cy = container.height / 2;
    let mx = e.clientX - container.left - cx;
    let my = e.clientY - container.top - cy;

    // Reverse pan
    mx -= panX;
    my -= panY;

    // Reverse zoom
    mx /= zoom;
    my /= zoom;

    // Reverse rotation
    const rad = -(rotation * Math.PI) / 180;
    const rmx = mx * Math.cos(rad) - my * Math.sin(rad);
    const rmy = mx * Math.sin(rad) + my * Math.cos(rad);
    mx = rmx;
    my = rmy;

    // Reverse flip
    if (flipH) mx = -mx;
    if (flipV) my = -my;

    // Back to container-relative
    mx += cx;
    my += cy;

    // Now relative to image bounds
    const mouseX = mx - imageBounds.offsetX;
    const mouseY = my - imageBounds.offsetY;

    return {
      x: (mouseX / imageBounds.renderWidth) * 100,
      y: (mouseY / imageBounds.renderHeight) * 100,
    };
  }, [imageBounds, zoom, rotation, flipH, flipV, panX, panY]);

  // Hit-test: find annotation under cursor
  const hitTest = useCallback((coords: { x: number; y: number }) => {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      if (a.type === 'point' || a.type === 'number') {
        if (Math.abs(a.x - coords.x) < 3 && Math.abs(a.y - coords.y) < 3) return a;
      } else if (a.type === 'rect') {
        if (coords.x >= a.x && coords.x <= a.x + (a.width || 0) &&
            coords.y >= a.y && coords.y <= a.y + (a.height || 0)) return a;
      } else if (a.type === 'arrow' || a.type === 'text') {
        if (Math.abs(a.x - coords.x) < 3 && Math.abs(a.y - coords.y) < 3) return a;
      }
    }
    return null;
  }, [annotations]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  // Handle mouse down — panning or annotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle button or space+left → pan
    if (e.button === 1 || (spaceHeld && e.button === 0)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, panX, panY });
      return;
    }

    if (readOnly) return;
    const coords = getRelativeCoords(e);

    const clicked = hitTest(coords);

    if (tool === 'select') {
      if (clicked) {
        setSelectedId(clicked.id);
        setDragging({
          id: clicked.id,
          offsetX: coords.x - clicked.x,
          offsetY: coords.y - clicked.y,
          origAnnotation: { ...clicked },
        });
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (clicked) {
      setSelectedId(clicked.id);
      setDragging({
        id: clicked.id,
        offsetX: coords.x - clicked.x,
        offsetY: coords.y - clicked.y,
        origAnnotation: { ...clicked },
      });
      return;
    }

    setSelectedId(null);
    setIsDrawing(true);
    setDrawStart(coords);

    if (tool === 'point' || tool === 'text' || tool === 'number') {
      const newAnnotation: Annotation = {
        id: `ann_${Date.now()}`,
        type: tool,
        x: coords.x,
        y: coords.y,
        number: tool === 'number' ? nextNumber : undefined,
        name: '',
        description: '',
        category: 'other',
      };
      onChange([...annotations, newAnnotation]);
      setIsDrawing(false);
    }
  }, [tool, annotations, readOnly, getRelativeCoords, nextNumber, onChange, hitTest, spaceHeld, panX, panY]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Panning
    if (isPanning && panStart) {
      setPanX(panStart.panX + e.clientX - panStart.x);
      setPanY(panStart.panY + e.clientY - panStart.y);
      return;
    }

    if (readOnly) return;
    const coords = getRelativeCoords(e);

    if (dragging) {
      const newX = coords.x - dragging.offsetX;
      const newY = coords.y - dragging.offsetY;
      const orig = dragging.origAnnotation;
      onChange(annotations.map(a =>
        a.id === dragging.id
          ? {
              ...a,
              x: newX,
              y: newY,
              endX: a.endX !== undefined ? newX + ((orig.endX || 0) - orig.x) : undefined,
              endY: a.endY !== undefined ? newY + ((orig.endY || 0) - orig.y) : undefined,
            }
          : a
      ));
      return;
    }

    if (!isDrawing || !drawStart) return;

    if (tool === 'rect') {
      setTempAnnotation({
        type: 'rect',
        x: Math.min(drawStart.x, coords.x),
        y: Math.min(drawStart.y, coords.y),
        width: Math.abs(coords.x - drawStart.x),
        height: Math.abs(coords.y - drawStart.y),
      });
    } else if (tool === 'arrow') {
      setTempAnnotation({
        type: 'arrow',
        x: drawStart.x,
        y: drawStart.y,
        endX: coords.x,
        endY: coords.y,
      });
    }
  }, [isDrawing, drawStart, tool, readOnly, getRelativeCoords, dragging, annotations, onChange, isPanning, panStart]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (dragging) {
      setDragging(null);
      return;
    }
    if (!isDrawing || !drawStart || readOnly) return;
    const coords = getRelativeCoords(e);
    setIsDrawing(false);

    if (tool === 'rect' || tool === 'arrow') {
      const newAnnotation: Annotation = {
        id: `ann_${Date.now()}`,
        type: tool,
        x: tool === 'rect' ? Math.min(drawStart.x, coords.x) : drawStart.x,
        y: tool === 'rect' ? Math.min(drawStart.y, coords.y) : drawStart.y,
        width: tool === 'rect' ? Math.abs(coords.x - drawStart.x) : undefined,
        height: tool === 'rect' ? Math.abs(coords.y - drawStart.y) : undefined,
        endX: tool === 'arrow' ? coords.x : undefined,
        endY: tool === 'arrow' ? coords.y : undefined,
        name: '',
        description: '',
        category: 'other',
      };
      onChange([...annotations, newAnnotation]);
    }

    setTempAnnotation(null);
    setDrawStart(null);
  }, [isDrawing, drawStart, tool, readOnly, getRelativeCoords, dragging, annotations, onChange, isPanning]);

  // Save annotation from dialog
  const handleSaveAnnotation = () => {
    if (!editingAnnotation) return;

    const existing = annotations.find(a => a.id === editingAnnotation.id);
    if (existing) {
      onChange(annotations.map(a => a.id === editingAnnotation.id ? editingAnnotation : a));
    } else {
      onChange([...annotations, editingAnnotation]);
    }

    setEditDialogOpen(false);
    setEditingAnnotation(null);
  };

  // Delete selected annotation
  const handleDelete = useCallback(() => {
    if (selectedId) {
      onChange(annotations.filter(a => a.id !== selectedId));
      setSelectedId(null);
    }
  }, [selectedId, annotations, onChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly || !selectedId) return;
      if (editDialogOpen) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, selectedId, editDialogOpen, handleDelete]);

  const handleEdit = () => {
    const selected = annotations.find(a => a.id === selectedId);
    if (selected) {
      setEditingAnnotation({ ...selected });
      setEditDialogOpen(true);
    }
  };

  const handleDoubleClick = useCallback((annId: string) => {
    const ann = annotations.find(a => a.id === annId);
    if (ann && !readOnly) {
      setSelectedId(annId);
      setEditingAnnotation({ ...ann });
      setEditDialogOpen(true);
    }
  }, [annotations, readOnly]);

  // Transform actions
  const handleRotateCW = () => setRotation(prev => (prev + 90) % 360);
  const handleRotateCCW = () => setRotation(prev => (prev - 90 + 360) % 360);
  const handleFlipH = () => setFlipH(prev => !prev);
  const handleFlipV = () => setFlipV(prev => !prev);
  const handleZoomIn = () => setZoom(prev => Math.min(MAX_ZOOM, prev + 0.25));
  const handleZoomOut = () => setZoom(prev => Math.max(MIN_ZOOM, prev - 0.25));
  const handleFitReset = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  };

  // Build CSS transform for image + annotation layer
  const layerTransform = `translate(${panX}px, ${panY}px) rotate(${rotation}deg) scale(${zoom}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;

  // Render annotation
  const renderAnnotation = (ann: Annotation) => {
    const isSelected = selectedId === ann.id;
    const isHighlighted = highlightId === ann.id;
    const baseClass = cn(
      "absolute pointer-events-auto cursor-pointer transition-all",
      isSelected && "ring-2 ring-primary ring-offset-1",
      isHighlighted && "ring-2 ring-primary ring-offset-1 animate-pulse"
    );

    // Counter-transform for text so it remains readable after flip/rotation
    const textCounterTransform = `rotate(${-rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;

    switch (ann.type) {
      case 'point':
        return (
          <div
            key={ann.id}
            className={cn(baseClass, "w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-white shadow-lg")}
            style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
            onClick={() => setSelectedId(ann.id)}
            onDoubleClick={() => handleDoubleClick(ann.id)}
            title={ann.name || '标注点'}
          />
        );

      case 'number':
        return (
          <div
            key={ann.id}
            className={cn(baseClass, "w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold border-2 border-white shadow-lg")}
            style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: `translate(-50%, -50%) ${textCounterTransform}` }}
            onClick={() => setSelectedId(ann.id)}
            onDoubleClick={() => handleDoubleClick(ann.id)}
            title={ann.name || `标注${ann.number}`}
          >
            {ann.number}
          </div>
        );

      case 'rect':
        return (
          <div
            key={ann.id}
            className={cn(baseClass, "border-2 border-primary bg-primary/20")}
            style={{
              left: `${ann.x}%`,
              top: `${ann.y}%`,
              width: `${ann.width}%`,
              height: `${ann.height}%`,
            }}
            onClick={() => setSelectedId(ann.id)}
            onDoubleClick={() => handleDoubleClick(ann.id)}
            title={ann.name || '区域'}
          />
        );

      case 'arrow': {
        const dx = (ann.endX || ann.x) - ann.x;
        const dy = (ann.endY || ann.y) - ann.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <div
            key={ann.id}
            className={cn(baseClass, "h-0.5 bg-primary origin-left")}
            style={{
              left: `${ann.x}%`,
              top: `${ann.y}%`,
              width: `${length}%`,
              transform: `rotate(${angle}deg)`,
            }}
            onClick={() => setSelectedId(ann.id)}
            onDoubleClick={() => handleDoubleClick(ann.id)}
            title={ann.name || '箭头'}
          >
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 border-l-8 border-l-primary border-y-4 border-y-transparent"
            />
          </div>
        );
      }

      case 'text':
        return (
          <div
            key={ann.id}
            className={cn(baseClass, "px-2 py-1 bg-background/90 border border-primary rounded text-xs whitespace-nowrap")}
            style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: textCounterTransform }}
            onClick={() => setSelectedId(ann.id)}
            onDoubleClick={() => handleDoubleClick(ann.id)}
          >
            {ann.name || '文本'}
          </div>
        );

      default:
        return null;
    }
  };

  // Render temporary annotation while drawing
  const renderTempAnnotation = () => {
    if (!tempAnnotation) return null;

    if (tempAnnotation.type === 'rect') {
      return (
        <div
          className="absolute border-2 border-primary border-dashed bg-primary/10 pointer-events-none"
          style={{
            left: `${tempAnnotation.x}%`,
            top: `${tempAnnotation.y}%`,
            width: `${tempAnnotation.width}%`,
            height: `${tempAnnotation.height}%`,
          }}
        />
      );
    }

    if (tempAnnotation.type === 'arrow') {
      const dx = (tempAnnotation.endX || 0) - (tempAnnotation.x || 0);
      const dy = (tempAnnotation.endY || 0) - (tempAnnotation.y || 0);
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      return (
        <div
          className="absolute h-0.5 bg-primary/50 origin-left pointer-events-none"
          style={{
            left: `${tempAnnotation.x}%`,
            top: `${tempAnnotation.y}%`,
            width: `${length}%`,
            transform: `rotate(${angle}deg)`,
          }}
        />
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        fillContainer ? 'flex h-full min-h-0 flex-col gap-2' : 'space-y-2'
      )}
    >
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Annotation tools */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {TOOLS.map(t => (
              <Button
                key={t.value}
                variant={tool === t.value ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setTool(t.value)}
                title={t.label}
              >
                {t.icon}
              </Button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-border" />

          {/* Image transform tools */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleRotateCCW}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>逆时针旋转90°</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleRotateCW}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>顺时针旋转90°</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={flipH ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={handleFlipH}>
                  <FlipHorizontal className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>水平翻转</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={flipV ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={handleFlipV}>
                  <FlipVertical className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>垂直翻转</TooltipContent>
            </Tooltip>
          </div>

          {/* Zoom controls */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>缩小</TooltipContent>
            </Tooltip>
            <span className="text-xs font-mono w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>放大</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleFitReset}>
                  <Maximize className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重置视图</TooltipContent>
            </Tooltip>
          </div>

          {selectedId && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-8" onClick={handleEdit}>
                <Edit3 className="h-3 w-3 mr-1" />
                编辑
              </Button>
              <Button variant="destructive" size="sm" className="h-8" onClick={handleDelete}>
                <Trash2 className="h-3 w-3 mr-1" />
                删除
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          "relative bg-muted rounded-lg overflow-hidden select-none",
          (spaceHeld || isPanning) ? "cursor-grab" : "cursor-crosshair",
          isPanning && "cursor-grabbing",
          fillContainer ? "min-h-0 flex-1" : "aspect-video"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setTempAnnotation(null);
            setDrawStart(null);
          }
          if (dragging) {
            setDragging(null);
          }
          if (isPanning) {
            setIsPanning(false);
            setPanStart(null);
          }
        }}
      >
        {/* Transformed image + annotations wrapper */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: layerTransform,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.2s ease',
            visibility: imageLoadState === 'error' ? 'hidden' : 'visible',
          }}
        >
          {/*
            Single stacking context: img + overlay must share one relative box.
            Previously two flex siblings (img + position:absolute overlay) let the overlay’s
            static position drift horizontally, so rects/annotations misaligned with the bitmap.
          */}
          <div
            className="relative shrink-0"
            style={
              imageBounds.renderWidth > 0
                ? { width: imageBounds.renderWidth, height: imageBounds.renderHeight }
                : imageSize.width > 0 && imageSize.height > 0
                  ? {
                      aspectRatio: `${imageSize.width} / ${imageSize.height}`,
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                    }
                  : { maxWidth: '100%', maxHeight: '100%' }
            }
          >
            <img
              src={proxiedImageUrl}
              alt="标注图片"
              data-testid="annotation-image"
              className="block h-full w-full object-contain pointer-events-none"
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                setImageLoadState('loaded');
                setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
              }}
              onError={() => {
                setImageLoadState('error');
                setImageSize({ width: 0, height: 0 });
              }}
            />
            <div className="absolute inset-0 pointer-events-none">
              {annotations.map(renderAnnotation)}
              {renderTempAnnotation()}
            </div>
          </div>
        </div>

        {imageLoadState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/70 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-xs">标注底图加载中...</p>
          </div>
        )}

        {imageLoadState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground px-4 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm">标注底图加载失败</p>
            <p className="text-xs break-all max-w-full">{imageUrl}</p>
          </div>
        )}

        {/* Zoom indicator (bottom-right) */}
        {imageLoadState === 'loaded' && zoom !== 1 && (
          <div className="absolute bottom-2 right-2 bg-background/80 text-foreground text-xs px-2 py-1 rounded-md pointer-events-none">
            {Math.round(zoom * 100)}%
          </div>
        )}

        {/* Pan hint */}
        {spaceHeld && !isPanning && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-background/80 text-foreground text-xs px-3 py-1 rounded-md pointer-events-none">
            拖拽平移图片
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑标注</DialogTitle>
          </DialogHeader>
          {editingAnnotation && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>名称 *</Label>
                  <Input
                    value={editingAnnotation.name}
                    onChange={(e) => setEditingAnnotation({
                      ...editingAnnotation,
                      name: e.target.value,
                    })}
                    placeholder="例如：Mark点1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>类型</Label>
                  <Select
                    value={editingAnnotation.category}
                    onValueChange={(v) => setEditingAnnotation({
                      ...editingAnnotation,
                      category: v,
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>说明</Label>
                <Textarea
                  value={editingAnnotation.description}
                  onChange={(e) => setEditingAnnotation({
                    ...editingAnnotation,
                    description: e.target.value,
                  })}
                  placeholder="详细说明..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>尺寸（可选）</Label>
                  <Input
                    value={editingAnnotation.dimension || ''}
                    onChange={(e) => setEditingAnnotation({
                      ...editingAnnotation,
                      dimension: e.target.value,
                    })}
                    placeholder="例如：Φ3mm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>公差（可选）</Label>
                  <Input
                    value={editingAnnotation.tolerance || ''}
                    onChange={(e) => setEditingAnnotation({
                      ...editingAnnotation,
                      tolerance: e.target.value,
                    })}
                    placeholder="例如：±0.1mm"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveAnnotation} disabled={!editingAnnotation?.name}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
