import { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, Lock, Unlock, X, RotateCcw, Move, 
  Copy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Maximize2, Minimize2, Box, Loader2, Camera, Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CAMERA_INTERACTION_TYPES, PRODUCT_INTERACTION_TYPES } from './MechanismSVG';

type ViewType = 'front' | 'side' | 'top';

export interface LayoutObject {
  id: string;
  type: 'camera' | 'mechanism' | 'product';
  mechanismId?: string;
  mechanismType?: string;
  name: string;
  // 3D coordinates in mm (relative to product center)
  posX: number;
  posY: number;
  posZ: number;
  // Canvas coordinates (derived from 3D based on view)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  // 3D rotation angles in degrees
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  locked: boolean;
  cameraIndex?: number;
  // Camera mounting to mechanism
  mountedToMechanismId?: string;
  mountPointId?: string;
  mountOffsetX?: number;
  mountOffsetY?: number;
  mountOffsetZ?: number;
  // Custom GLB 3D model URL
  model3dUrl?: string;
}

interface ObjectPropertyPanelProps {
  object: LayoutObject | null;
  onUpdate: (id: string, updates: Partial<LayoutObject>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  scale: number;
  canvasCenter: { x: number; y: number };
  currentView?: ViewType;
  allObjects?: LayoutObject[];
  isIsometric?: boolean;
  productDimensions?: { length: number; width: number; height: number };
  onUpdateProductDimensions?: (dims: { length: number; width: number; height: number }) => void;
  productPosition?: { posX: number; posY: number; posZ: number };
  onUpdateProductPosition?: (pos: { posX: number; posY: number; posZ: number }) => void;
}
// Inline GLB upload field for property panel
function GLBUploadField({ currentUrl, onUpdate }: { currentUrl?: string; onUpdate: (url: string | undefined) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    const cadExts = /\.(sldprt|sldasm|step|stp|iges|igs|x_t|x_b|sat|catpart|catproduct|prt|asm)$/i;
    if (cadExts.test(file.name)) {
      const ext = file.name.split('.').pop()?.toUpperCase() || '';
      toast.error(`${ext} 是 CAD 格式，请先转换为 GLB 后再上传。`, { duration: 8000 });
      return;
    }
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      toast.error('仅支持 GLB / GLTF 格式');
      return;
    }
    setUploading(true);
    try {
      const { uploadGLBFile } = await import('@/utils/glbUpload');
      const url = await uploadGLBFile(file, 'layout-objects');
      if (url) {
        onUpdate(url);
        toast.success('3D 模型已更新');
      }
    } catch (err) {
      console.error('GLB upload error:', err);
      toast.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-lg p-2 min-h-[40px] flex items-center justify-center transition-all',
        dragOver
          ? 'border-primary bg-primary/10 ring-2 ring-primary/30 scale-[1.01]'
          : 'border-border bg-gradient-to-br from-muted/40 to-muted/10 hover:border-primary/50'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        if (uploading) return;
        const file = e.dataTransfer.files?.[0];
        if (file) await handleFile(file);
      }}
    >
      {currentUrl ? (
        <div className="flex items-center gap-2 w-full">
          <Box className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">{currentUrl.split('/').pop()}</span>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => onUpdate(undefined)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">拖拽 .glb 到此处或点击上传</span>
      )}
      <input
        type="file"
        accept=".glb,.gltf"
        className="absolute inset-0 opacity-0 cursor-pointer"
        disabled={uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await handleFile(file);
          e.currentTarget.value = '';
        }}
      />
      {uploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
    </div>
  );
}

export function ObjectPropertyPanel({
  object,
  onUpdate,
  onDelete,
  onClose,
  scale,
  canvasCenter,
  currentView = 'front',
  allObjects = [],
  isIsometric = false,
  productDimensions,
  onUpdateProductDimensions,
  productPosition,
  onUpdateProductPosition,
}: ObjectPropertyPanelProps) {
  const [localValues, setLocalValues] = useState({
    x: 0,
    y: 0,
    rotation: 0,
    width: 0,
    height: 0,
    name: '',
  });
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Vertical drag state
  const [panelY, setPanelY] = useState(16); // Initial top offset in pixels
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle panel drag
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartY(e.clientY - panelY);
  };

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const newY = Math.max(16, Math.min(window.innerHeight - 200, e.clientY - dragStartY));
      setPanelY(newY);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartY]);

  useEffect(() => {
    if (object) {
      // Convert canvas coordinates to mm (relative to center)
      setLocalValues({
        x: Math.round((object.x - canvasCenter.x) / scale),
        y: Math.round((canvasCenter.y - object.y) / scale), // Invert Y for intuitive input
        rotation: object.rotation,
        width: Math.round(object.width / scale),
        height: Math.round(object.height / scale),
        name: object.name,
      });
    }
  }, [object, scale, canvasCenter]);

  // Early return moved after all hooks - see below

  const handlePositionChange = (axis: 'x' | 'y', value: string) => {
    if (!object) return;
    const num = parseFloat(value) || 0;
    setLocalValues(prev => ({ ...prev, [axis]: num }));
    
    const posUpdate: Record<string, number> = {};
    if (axis === 'x') {
      posUpdate.x = canvasCenter.x + num * scale;
      if (currentView === 'front' || currentView === 'top') posUpdate.posX = num;
      else if (currentView === 'side') posUpdate.posY = num;
    } else {
      posUpdate.y = canvasCenter.y - num * scale;
      if (currentView === 'front' || currentView === 'side') posUpdate.posZ = num;
      else if (currentView === 'top') posUpdate.posY = num;
    }
    onUpdate(object.id, posUpdate);
  };

  const handleNudge = (direction: 'up' | 'down' | 'left' | 'right', amount: number = 1) => {
    const nudgeMm = amount;
    switch (direction) {
      case 'up':
        handlePositionChange('y', (localValues.y + nudgeMm).toString());
        break;
      case 'down':
        handlePositionChange('y', (localValues.y - nudgeMm).toString());
        break;
      case 'left':
        handlePositionChange('x', (localValues.x - nudgeMm).toString());
        break;
      case 'right':
        handlePositionChange('x', (localValues.x + nudgeMm).toString());
        break;
    }
  };

  const handleRotationChange = (value: number[]) => {
    if (!object) return;
    const rotation = value[0];
    setLocalValues(prev => ({ ...prev, rotation }));
    onUpdate(object.id, { rotation });
  };

  const handleQuickRotation = (degrees: number) => {
    if (!object) return;
    const newRotation = (localValues.rotation + degrees) % 360;
    setLocalValues(prev => ({ ...prev, rotation: newRotation }));
    onUpdate(object.id, { rotation: newRotation });
  };

  const handleSizeChange = (dim: 'width' | 'height', value: string) => {
    if (!object) return;
    const num = Math.max(20, parseFloat(value) || 0);
    setLocalValues(prev => ({ ...prev, [dim]: num }));
    onUpdate(object.id, { [dim]: num * scale });
  };

  const handleNameChange = (value: string) => {
    if (!object) return;
    setLocalValues(prev => ({ ...prev, name: value }));
    onUpdate(object.id, { name: value });
  };

  const handleResetRotation = () => {
    if (!object) return;
    setLocalValues(prev => ({ ...prev, rotation: 0 }));
    onUpdate(object.id, { rotation: 0 });
  };

  const handleCenterObject = () => {
    if (!object) return;
    setLocalValues(prev => ({ ...prev, x: 0, y: 0 }));
    onUpdate(object.id, { x: canvasCenter.x, y: canvasCenter.y });
  };

  const distanceFromCenter = Math.round(
    Math.sqrt(
      Math.pow(localValues.x, 2) + Math.pow(localValues.y, 2)
    )
  );

  // Get 3D coordinates directly from object (now stored as primary data)
  const get3DCoordinates = useMemo(() => {
    if (!object) return { posX: 0, posY: 0, posZ: 0 };
    return {
      posX: object.posX ?? 0,
      posY: object.posY ?? 0,
      posZ: object.posZ ?? 0,
    };
  }, [object?.posX, object?.posY, object?.posZ]);

  // Get axis labels based on view (左视图 replaces 侧视图)
  const axisLabels = useMemo(() => {
    switch (currentView) {
      case 'front': return { horizontal: 'X (左右)', vertical: 'Z (上下)', view: '正视图' };
      case 'side': return { horizontal: 'Y (前后)', vertical: 'Z (上下)', view: '左视图' };
      case 'top': return { horizontal: 'X (左右)', vertical: 'Y (前后)', view: '俯视图' };
      default: return { horizontal: 'X', vertical: 'Z', view: '正视图' };
    }
  }, [currentView]);

  // Calculate distances to nearby objects
  const nearbyDevices = useMemo(() => {
    if (!allObjects || allObjects.length <= 1 || !object) return [];
    
    return allObjects
      .filter(o => o.id !== object.id)
      .map(o => {
        const dx = ((o.x - canvasCenter.x) / scale) - localValues.x;
        const dy = ((canvasCenter.y - o.y) / scale) - localValues.y;
        const distance = Math.round(Math.sqrt(dx * dx + dy * dy));
        return {
          name: o.name,
          type: o.type,
          distance,
          deltaX: Math.round(dx),
          deltaY: Math.round(dy),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3); // Show top 3 nearest
  }, [allObjects, object?.id, localValues.x, localValues.y, scale, canvasCenter]);

  // Early return after all hooks
  if (!object) return null;

  const typeColor = object.type === 'camera' ? 'bg-blue-500' : 'bg-orange-500';
  const typeLabel = object.type === 'camera' ? '相机' : '机构';

  return (
    <div 
      ref={panelRef}
      onMouseDown={e => e.stopPropagation()}
      style={{ top: `${panelY}px` }}
      className={cn(
        "absolute right-4 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl overflow-hidden z-10 transition-shadow duration-200",
        isMinimized ? "w-56" : "w-72",
        isDragging && "shadow-xl ring-2 ring-primary/30"
      )}
    >
      {/* Draggable Header */}
      <div 
        className={cn(
          "flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-muted/80 to-muted/40 border-b border-border",
          "cursor-grab active:cursor-grabbing select-none"
        )}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Drag indicator */}
          <div className="flex flex-col gap-0.5 mr-1 opacity-50">
            <div className="w-4 h-0.5 bg-muted-foreground rounded-full" />
            <div className="w-4 h-0.5 bg-muted-foreground rounded-full" />
          </div>
          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", typeColor)} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{typeLabel}</span>
          <span className="text-sm font-semibold truncate">{object.name}</span>
        </div>
        <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 hover:bg-muted" 
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-4 max-h-[50vh] overflow-y-auto scrollbar-thin scroll-smooth">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">名称</Label>
            <Input
              value={localValues.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-8 text-sm"
              disabled={object.locked}
            />
          </div>

          <Separator className="my-3" />

          {/* Position with nudge buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">位置 (mm)</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs gap-1 text-primary hover:text-primary" 
                onClick={handleCenterObject}
                disabled={object.locked}
              >
                <Move className="h-3 w-3" />
                居中
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-red-400 font-semibold">{axisLabels.horizontal}</Label>
                  <div className="flex gap-0.5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5" 
                      onClick={() => handleNudge('left')}
                      disabled={object.locked}
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5" 
                      onClick={() => handleNudge('right')}
                      disabled={object.locked}
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  value={localValues.x}
                  onChange={(e) => handlePositionChange('x', e.target.value)}
                  className="h-8 text-sm font-mono"
                  disabled={object.locked}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-green-400 font-semibold">{axisLabels.vertical}</Label>
                  <div className="flex gap-0.5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5" 
                      onClick={() => handleNudge('up')}
                      disabled={object.locked}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5" 
                      onClick={() => handleNudge('down')}
                      disabled={object.locked}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  value={localValues.y}
                  onChange={(e) => handlePositionChange('y', e.target.value)}
                  className="h-8 text-sm font-mono"
                  disabled={object.locked}
                />
              </div>
            </div>
            
            {/* 3D Coordinates display */}
            <div className="grid grid-cols-3 gap-1 p-2 rounded-lg bg-muted/30 border border-border">
              <div className="text-center">
                <div className="text-[9px] text-red-400 font-semibold">X</div>
                <div className="text-xs font-mono font-semibold">{get3DCoordinates.posX}</div>
              </div>
              <div className="text-center border-x border-border">
                <div className="text-[9px] text-green-400 font-semibold">Y</div>
                <div className="text-xs font-mono font-semibold">{get3DCoordinates.posY}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-blue-400 font-semibold">Z</div>
                <div className="text-xs font-mono font-semibold">{get3DCoordinates.posZ}</div>
              </div>
            </div>
            
            {/* Distance indicator */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs">
              <span className="text-muted-foreground">距产品中心</span>
              <span className="font-semibold text-amber-400">{distanceFromCenter}mm</span>
            </div>
            
            {/* Nearby devices */}
            {nearbyDevices.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-[10px] text-muted-foreground">邻近设备间距</Label>
                <div className="space-y-1">
                  {nearbyDevices.map((device, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between px-2 py-1 rounded bg-muted/40 text-[10px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${device.type === 'camera' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                        <span className="text-muted-foreground truncate max-w-[80px]">{device.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          Δ{axisLabels.horizontal}:<span className="text-red-400 ml-0.5">{device.deltaX}</span>
                        </span>
                        <span className="font-mono font-semibold text-emerald-400">{device.distance}mm</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator className="my-3" />

          {/* 2D Rotation - only in 2D mode */}
          {!isIsometric && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">2D 旋转角度</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-muted">{localValues.rotation}°</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={handleResetRotation} 
                  disabled={object.locked}
                  title="重置为0°"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <Slider
              value={[localValues.rotation]}
              onValueChange={handleRotationChange}
              min={0}
              max={360}
              step={1}
              disabled={object.locked}
              className="py-2"
            />
            
            <div className="flex gap-1">
              {[0, 45, 90, 135, 180, 270].map(deg => (
                <Button
                  key={deg}
                  variant={localValues.rotation === deg ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1 h-7 text-xs px-0"
                  onClick={() => {
                    setLocalValues(prev => ({ ...prev, rotation: deg }));
                    onUpdate(object.id, { rotation: deg });
                  }}
                  disabled={object.locked}
                >
                  {deg}°
                </Button>
              ))}
            </div>
          </div>
          )}

          {/* 3D Rotation (X/Y/Z) - only in 3D mode */}
          {isIsometric && (
          <>
          <Separator className="my-3" />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">3D 旋转 (X/Y/Z)</Label>
            {(['rotX', 'rotY', 'rotZ'] as const).map((axis) => {
              const label = axis === 'rotX' ? 'X轴（俯仰）' : axis === 'rotY' ? 'Y轴（翻滚）' : 'Z轴（偏航）';
              const color = axis === 'rotX' ? 'text-red-400' : axis === 'rotY' ? 'text-green-400' : 'text-blue-400';
              const val = object[axis] ?? 0;
              return (
                <div key={axis} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className={`text-[10px] font-semibold ${color}`}>{label}</Label>
                    <span className="text-[10px] font-mono text-muted-foreground">{val}°</span>
                  </div>
                  <Slider
                    value={[val]}
                    onValueChange={(v) => onUpdate(object.id, { [axis]: v[0] })}
                    min={0}
                    max={360}
                    step={5}
                    disabled={object.locked}
                    className="py-1"
                  />
                  <div className="flex gap-0.5">
                    {[0, 90, 180, 270].map(deg => (
                      <Button
                        key={deg}
                        variant={val === deg ? "secondary" : "ghost"}
                        size="sm"
                        className="flex-1 h-6 text-[10px] px-0"
                        onClick={() => onUpdate(object.id, { [axis]: deg })}
                        disabled={object.locked}
                      >
                        {deg}°
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}

          <Separator className="my-3" />

          {/* Size */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">尺寸 (mm)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">宽度</Label>
                <Input
                  type="number"
                  value={localValues.width}
                  onChange={(e) => handleSizeChange('width', e.target.value)}
                  className="h-8 text-sm font-mono"
                  disabled={object.locked}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">高度</Label>
                <Input
                  type="number"
                  value={localValues.height}
                  onChange={(e) => handleSizeChange('height', e.target.value)}
                  className="h-8 text-sm font-mono"
                  disabled={object.locked}
                />
              </div>
            </div>
          </div>

          {/* 3D Depth dimension - only in isometric mode */}
          {isIsometric && object.type === 'mechanism' && (
            <div className="space-y-1 mt-2">
              <Label className="text-[10px] text-muted-foreground">深度 (D)</Label>
              <Input
                type="number"
                value={(object as any).depth || 200}
                onChange={(e) => {
                  const v = Math.max(10, Math.round(parseFloat(e.target.value) || 200));
                  onUpdate(object.id, { depth: v } as any);
                }}
                className="h-8 text-sm font-mono"
                disabled={object.locked}
              />
            </div>
          )}

          {/* 3D Mount status for cameras */}
          {isIsometric && object.type === 'camera' && (
            <>
              <Separator className="my-3" />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">挂载状态</Label>
                {object.mountedToMechanismId ? (() => {
                  const parent = allObjects.find(o => o.id === object.mountedToMechanismId);
                  const parentType = parent?.mechanismType || '';
                  const isLegal = CAMERA_INTERACTION_TYPES.includes(parentType);
                  return (
                    <div className="p-2 rounded-lg bg-muted/40 border border-border space-y-1">
                      <div className="text-xs text-muted-foreground">
                        挂载到: <span className="text-foreground font-medium">{parent?.name || '未知'}</span>
                      </div>
                      <div className={cn("text-xs font-medium", isLegal ? 'text-emerald-500' : 'text-destructive')}>
                        {isLegal ? '✅ 合法挂载' : '⚠️ 非法挂载 — 该机构不支持相机'}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="p-2 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
                    未挂载到任何机构
                  </div>
                )}
              </div>
            </>
          )}

          {/* 3D Mechanism interaction type */}
          {isIsometric && object.type === 'mechanism' && (() => {
            const mechType = object.mechanismType || '';
            const isCamType = CAMERA_INTERACTION_TYPES.includes(mechType);
            const isProdType = PRODUCT_INTERACTION_TYPES.includes(mechType);
            const mountedChildren = allObjects.filter(o => o.mountedToMechanismId === object.id);
            const illegalCameras = mountedChildren.filter(o => o.type === 'camera' && !isCamType);
            return (
              <>
                <Separator className="my-3" />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">机构交互类型</Label>
                  <div className="p-2 rounded-lg bg-muted/40 border border-border space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {isCamType ? <Camera className="h-3.5 w-3.5 text-blue-400" /> : isProdType ? <Package className="h-3.5 w-3.5 text-emerald-400" /> : null}
                      <span className={cn("text-xs font-medium", isCamType ? 'text-blue-400' : isProdType ? 'text-emerald-400' : 'text-muted-foreground')}>
                        {isCamType ? '相机交互类' : isProdType ? '产品交互类' : '未分类'}
                      </span>
                    </div>
                    {isCamType && <div className="text-[10px] text-muted-foreground">支持安装相机</div>}
                    {isProdType && <div className="text-[10px] text-muted-foreground">承载/传递产品 · 不支持安装相机</div>}
                    {mountedChildren.length > 0 && (
                      <div className="text-[10px] text-foreground">
                        已挂载: {mountedChildren.map(c => c.name || c.id.slice(0, 6)).join(', ')}
                      </div>
                    )}
                    {illegalCameras.length > 0 && (
                      <div className="text-[10px] text-destructive font-medium">
                        ⚠ {illegalCameras.length} 台相机非法挂载!
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          {/* 3D Product dimensions & position editing */}
          {isIsometric && object.id === '__product__' && (
            <>
              {onUpdateProductDimensions && productDimensions && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">产品尺寸 (mm)</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['length', 'width', 'height'] as const).map(dim => (
                        <div key={dim} className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">{dim === 'length' ? 'L' : dim === 'width' ? 'W' : 'H'}</Label>
                          <Input
                            type="number"
                            value={productDimensions[dim]}
                            onChange={(e) => {
                              const v = Math.max(1, Math.round(parseFloat(e.target.value) || 1));
                              onUpdateProductDimensions({ ...productDimensions, [dim]: v });
                            }}
                            className="h-7 text-xs font-mono px-1.5"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {onUpdateProductPosition && productPosition && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">产品位置 (mm)</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['posX', 'posY', 'posZ'] as const).map(axis => (
                        <div key={axis} className="space-y-1">
                          <Label className={cn("text-[10px] font-semibold", axis === 'posX' ? 'text-red-400' : axis === 'posY' ? 'text-green-400' : 'text-blue-400')}>
                            {axis === 'posX' ? 'X' : axis === 'posY' ? 'Y' : 'Z'}
                          </Label>
                          <Input
                            type="number"
                            value={productPosition[axis]}
                            onChange={(e) => {
                              const v = Math.round(parseFloat(e.target.value) || 0);
                              onUpdateProductPosition({ ...productPosition, [axis]: v });
                            }}
                            className="h-7 text-xs font-mono px-1.5"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <Separator className="my-3" />
          {object.type === 'camera' && object.mountedToMechanismId && (
            <>
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">🔗</span>
                    <div>
                      <div className="text-xs font-medium text-blue-300">已挂载到机构</div>
                      <div className="text-[10px] text-muted-foreground">
                        机构移动时相机跟随
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                    onClick={() => onUpdate(object.id, { 
                      mountedToMechanismId: undefined, 
                      mountPointId: undefined,
                      mountOffsetX: undefined,
                      mountOffsetY: undefined,
                      mountOffsetZ: undefined,
                    })}
                  >
                    解除挂载
                  </Button>
                </div>
              </div>
              <Separator className="my-3" />
            </>
          )}

          {/* 3D Model Override for Mechanism/Camera Objects */}
          {(object.type === 'mechanism' || object.type === 'camera') && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium">3D 模型（GLB）</Label>
                <GLBUploadField
                  currentUrl={object.model3dUrl}
                  onUpdate={(url) => onUpdate(object.id, { model3dUrl: url })}
                />
              </div>
              <Separator className="my-3" />
            </>
          )}

          {/* Lock Toggle */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              {object.locked ? (
                <Lock className="h-4 w-4 text-amber-500" />
              ) : (
                <Unlock className="h-4 w-4 text-muted-foreground" />
              )}
              <Label className="text-xs">锁定位置</Label>
            </div>
            <Switch
              checked={object.locked}
              onCheckedChange={(checked) => onUpdate(object.id, { locked: checked })}
            />
          </div>

          <Separator className="my-3" />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => {
                // Trigger duplicate via keyboard shortcut emulation
                const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true });
                window.dispatchEvent(event);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              复制
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onDelete(object.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
          </div>
        </div>
      )}

      {/* Minimized view */}
      {isMinimized && (
        <div className="p-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            X: <span className="font-mono text-foreground">{localValues.x}</span>
            &nbsp;Y: <span className="font-mono text-foreground">{localValues.y}</span>
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onUpdate(object.id, { locked: !object.locked })}
            >
              {object.locked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDelete(object.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
