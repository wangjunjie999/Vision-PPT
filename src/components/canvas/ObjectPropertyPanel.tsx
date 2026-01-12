import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Trash2, Lock, Unlock, X, RotateCcw, Move } from 'lucide-react';
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
  });

  useEffect(() => {
    if (object) {
      // Convert canvas coordinates to mm (relative to center)
      setLocalValues({
        x: Math.round((object.x - canvasCenter.x) / scale),
        y: Math.round((canvasCenter.y - object.y) / scale), // Invert Y for intuitive input
        rotation: object.rotation,
        width: Math.round(object.width / scale),
        height: Math.round(object.height / scale),
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

  const handleRotationChange = (value: number[]) => {
    const rotation = value[0];
    setLocalValues(prev => ({ ...prev, rotation }));
    onUpdate(object.id, { rotation });
  };

  const handleSizeChange = (dim: 'width' | 'height', value: string) => {
    const num = Math.max(20, parseFloat(value) || 0);
    setLocalValues(prev => ({ ...prev, [dim]: num }));
    onUpdate(object.id, { [dim]: num * scale });
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

  return (
    <div className="absolute right-4 top-4 w-64 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            object.type === 'camera' ? "bg-blue-500" : "bg-orange-500"
          )} />
          <span className="text-sm font-medium truncate max-w-[140px]">{object.name}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-4">
        {/* Position */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">位置 (mm)</Label>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleCenterObject}>
              <Move className="h-3 w-3 mr-1" />
              居中
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">X</Label>
              <Input
                type="number"
                value={localValues.x}
                onChange={(e) => handlePositionChange('x', e.target.value)}
                className="h-8 text-sm"
                disabled={object.locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Y</Label>
              <Input
                type="number"
                value={localValues.y}
                onChange={(e) => handlePositionChange('y', e.target.value)}
                className="h-8 text-sm"
                disabled={object.locked}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            距产品中心: <span className="font-medium text-foreground">{distanceFromCenter}mm</span>
          </p>
        </div>

        {/* Rotation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">旋转角度</Label>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium">{localValues.rotation}°</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleResetRotation} disabled={object.locked}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Slider
            value={[localValues.rotation]}
            onValueChange={handleRotationChange}
            min={0}
            max={360}
            step={15}
            disabled={object.locked}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0°</span>
            <span>90°</span>
            <span>180°</span>
            <span>270°</span>
            <span>360°</span>
          </div>
        </div>

        {/* Size */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">尺寸 (mm)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">宽度</Label>
              <Input
                type="number"
                value={localValues.width}
                onChange={(e) => handleSizeChange('width', e.target.value)}
                className="h-8 text-sm"
                disabled={object.locked}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">高度</Label>
              <Input
                type="number"
                value={localValues.height}
                onChange={(e) => handleSizeChange('height', e.target.value)}
                className="h-8 text-sm"
                disabled={object.locked}
              />
            </div>
          </div>
        </div>

        {/* Lock Toggle */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div className="flex items-center gap-2">
            {object.locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
            <Label className="text-xs">锁定位置</Label>
          </div>
          <Switch
            checked={object.locked}
            onCheckedChange={(checked) => onUpdate(object.id, { locked: checked })}
          />
        </div>

        {/* Delete Button */}
        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-2"
          onClick={() => onDelete(object.id)}
        >
          <Trash2 className="h-4 w-4" />
          删除此对象
        </Button>
      </div>
    </div>
  );
}
