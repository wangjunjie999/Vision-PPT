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
  Maximize2, Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewType = 'front' | 'side' | 'top';

export interface LayoutObject {
  id: string;
  type: 'camera' | 'mechanism';
  mechanismId?: string;
  mechanismType?: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  cameraIndex?: number;
  // 3D coordinates (optional, derived from view)
  posX?: number;
  posY?: number;
  posZ?: number;
  // Camera mounting to mechanism
  mountedToMechanismId?: string;
  mountPointId?: string;
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
    const num = parseFloat(value) || 0;
    setLocalValues(prev => ({ ...prev, [axis]: num }));
    
    if (axis === 'x') {
      onUpdate(object.id, { x: canvasCenter.x + num * scale });
    } else {
      onUpdate(object.id, { y: canvasCenter.y - num * scale }); // Invert Y
    }
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
    const rotation = value[0];
    setLocalValues(prev => ({ ...prev, rotation }));
    onUpdate(object.id, { rotation });
  };

  const handleQuickRotation = (degrees: number) => {
    const newRotation = (localValues.rotation + degrees) % 360;
    setLocalValues(prev => ({ ...prev, rotation: newRotation }));
    onUpdate(object.id, { rotation: newRotation });
  };

  const handleSizeChange = (dim: 'width' | 'height', value: string) => {
    const num = Math.max(20, parseFloat(value) || 0);
    setLocalValues(prev => ({ ...prev, [dim]: num }));
    onUpdate(object.id, { [dim]: num * scale });
  };

  const handleNameChange = (value: string) => {
    setLocalValues(prev => ({ ...prev, name: value }));
    onUpdate(object.id, { name: value });
  };

  const handleResetRotation = () => {
    setLocalValues(prev => ({ ...prev, rotation: 0 }));
    onUpdate(object.id, { rotation: 0 });
  };

  const handleCenterObject = () => {
    setLocalValues(prev => ({ ...prev, x: 0, y: 0 }));
    onUpdate(object.id, { x: canvasCenter.x, y: canvasCenter.y });
  };

  const distanceFromCenter = Math.round(
    Math.sqrt(
      Math.pow(localValues.x, 2) + Math.pow(localValues.y, 2)
    )
  );

  // Calculate 3D coordinates based on current view
  const get3DCoordinates = useMemo(() => {
    const canvasXmm = localValues.x;
    const canvasYmm = localValues.y;
    
    let posX = 0, posY = 0, posZ = 0;
    
    switch (currentView) {
      case 'front': // X-Z plane
        posX = canvasXmm;
        posZ = canvasYmm;
        posY = 0;
        break;
      case 'side': // Y-Z plane
        posY = canvasXmm;
        posZ = canvasYmm;
        posX = 0;
        break;
      case 'top': // X-Y plane
        posX = canvasXmm;
        posY = canvasYmm;
        posZ = object?.type === 'camera' ? 300 : 0; // Default camera height
        break;
    }
    
    return { posX, posY, posZ };
  }, [localValues.x, localValues.y, currentView, object?.type]);

  // Get axis labels based on view
  const axisLabels = useMemo(() => {
    switch (currentView) {
      case 'front': return { horizontal: 'X', vertical: 'Z' };
      case 'side': return { horizontal: 'Y', vertical: 'Z' };
      case 'top': return { horizontal: 'X', vertical: 'Y' };
      default: return { horizontal: 'X', vertical: 'Z' };
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

          {/* Rotation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">旋转角度</Label>
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
            
            {/* Quick rotation buttons */}
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

          <Separator className="my-3" />

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
