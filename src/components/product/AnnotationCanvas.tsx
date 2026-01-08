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
import {
  Circle,
  Square,
  ArrowRight,
  Type,
  Hash,
  Trash2,
  Edit3,
  Move,
  MousePointer,
} from 'lucide-react';

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

interface AnnotationCanvasProps {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  readOnly?: boolean;
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

export function AnnotationCanvas({
  imageUrl,
  annotations,
  onChange,
  readOnly = false,
}: AnnotationCanvasProps) {
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

  // Calculate next number
  useEffect(() => {
    const maxNumber = annotations
      .filter(a => a.type === 'number')
      .reduce((max, a) => Math.max(max, a.number || 0), 0);
    setNextNumber(maxNumber + 1);
  }, [annotations]);

  // Get relative coordinates
  const getRelativeCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    const coords = getRelativeCoords(e);

    if (tool === 'select') {
      // Check if clicking on an annotation
      const clicked = annotations.find(a => {
        if (a.type === 'point' || a.type === 'number') {
          return Math.abs(a.x - coords.x) < 3 && Math.abs(a.y - coords.y) < 3;
        }
        if (a.type === 'rect') {
          return coords.x >= a.x && coords.x <= a.x + (a.width || 0) &&
                 coords.y >= a.y && coords.y <= a.y + (a.height || 0);
        }
        if (a.type === 'arrow' || a.type === 'text') {
          return Math.abs(a.x - coords.x) < 3 && Math.abs(a.y - coords.y) < 3;
        }
        return false;
      });
      
      if (clicked) {
        setSelectedId(clicked.id);
      } else {
        setSelectedId(null);
      }
      return;
    }

    setIsDrawing(true);
    setDrawStart(coords);

    if (tool === 'point' || tool === 'text' || tool === 'number') {
      // Create immediately for point-based tools
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
      setEditingAnnotation(newAnnotation);
      setEditDialogOpen(true);
      setIsDrawing(false);
    }
  }, [tool, annotations, readOnly, getRelativeCoords, nextNumber]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !drawStart || readOnly) return;
    const coords = getRelativeCoords(e);

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
  }, [isDrawing, drawStart, tool, readOnly, getRelativeCoords]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
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
      setEditingAnnotation(newAnnotation);
      setEditDialogOpen(true);
    }

    setTempAnnotation(null);
    setDrawStart(null);
  }, [isDrawing, drawStart, tool, readOnly, getRelativeCoords]);

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
  const handleDelete = () => {
    if (selectedId) {
      onChange(annotations.filter(a => a.id !== selectedId));
      setSelectedId(null);
    }
  };

  // Edit selected annotation
  const handleEdit = () => {
    const selected = annotations.find(a => a.id === selectedId);
    if (selected) {
      setEditingAnnotation({ ...selected });
      setEditDialogOpen(true);
    }
  };

  // Render annotation
  const renderAnnotation = (ann: Annotation) => {
    const isSelected = selectedId === ann.id;
    const baseClass = cn(
      "absolute pointer-events-auto cursor-pointer transition-all",
      isSelected && "ring-2 ring-primary ring-offset-1"
    );

    switch (ann.type) {
      case 'point':
        return (
          <div
            key={ann.id}
            className={cn(baseClass, "w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-white shadow-lg")}
            style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
            onClick={() => setSelectedId(ann.id)}
            title={ann.name || '标注点'}
          />
        );

      case 'number':
        return (
          <div
            key={ann.id}
            className={cn(baseClass, "w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold border-2 border-white shadow-lg")}
            style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
            onClick={() => setSelectedId(ann.id)}
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
            title={ann.name || '区域'}
          />
        );

      case 'arrow':
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
            title={ann.name || '箭头'}
          >
            <div 
              className="absolute right-0 top-1/2 -translate-y-1/2 border-l-8 border-l-primary border-y-4 border-y-transparent"
            />
          </div>
        );

      case 'text':
        return (
          <div
            key={ann.id}
            className={cn(baseClass, "px-2 py-1 bg-background/90 border border-primary rounded text-xs whitespace-nowrap")}
            style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
            onClick={() => setSelectedId(ann.id)}
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
    <div className="space-y-2">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
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
        className="relative aspect-video bg-muted rounded-lg overflow-hidden cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setTempAnnotation(null);
            setDrawStart(null);
          }
        }}
      >
        <img
          src={imageUrl}
          alt="标注图片"
          className="w-full h-full object-contain pointer-events-none"
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
          }}
        />
        
        {/* Annotations layer */}
        <div className="absolute inset-0 pointer-events-none">
          {annotations.map(renderAnnotation)}
          {renderTempAnnotation()}
        </div>
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
