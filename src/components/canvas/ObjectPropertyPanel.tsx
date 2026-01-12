import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Trash2, Lock, Unlock, X, RotateCcw, Move, 
  Copy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Maximize2, Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

interface ObjectPropertyPanelProps {
  object: LayoutObject | null;
  onUpdate: (id: string, updates: Partial<LayoutObject>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  scale: number;
  canvasCenter: { x: number; y: number };
}

export function ObjectPropertyPanel({
  object,
  onUpdate,
  onDelete,
  onClose,
  scale,
  canvasCenter,
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

  if (!object) return null;

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

  const typeColor = object.type === 'camera' ? 'bg-blue-500' : 'bg-orange-500';
  const typeLabel = object.type === 'camera' ? '相机' : '机构';

  return (
    <div className={cn(
      "absolute right-4 top-4 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl overflow-hidden z-10 transition-all duration-200",
      isMinimized ? "w-56" : "w-72"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-muted/80 to-muted/40 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", typeColor)} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{typeLabel}</span>
          <span className="text-sm font-semibold truncate">{object.name}</span>
        </div>
        <div className="flex items-center gap-1">
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
        <div className="p-3 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin">
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
                  <Label className="text-[10px] text-muted-foreground">X</Label>
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
                  <Label className="text-[10px] text-muted-foreground">Y</Label>
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
            
            {/* Distance indicator */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/50 text-xs">
              <span className="text-muted-foreground">距产品中心</span>
              <span className="font-semibold text-foreground">{distanceFromCenter}mm</span>
            </div>
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
