import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Circle, Square, ArrowRight, Type, Hash, Trash2, Edit2 } from 'lucide-react';
import type { Annotation } from '@/types/product';

interface AnnotationLayerProps {
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  width: number;
  height: number;
  readonly?: boolean;
}

type ToolType = 'point' | 'rect' | 'arrow' | 'text' | 'number' | null;

export function AnnotationLayer({ 
  annotations, 
  onChange, 
  width, 
  height,
  readonly = false 
}: AnnotationLayerProps) {
  const [tool, setTool] = useState<ToolType>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextNumber, setNextNumber] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const numbers = annotations.filter(a => a.type === 'number').map(a => a.number || 0);
    if (numbers.length > 0) {
      setNextNumber(Math.max(...numbers) + 1);
    }
  }, []);

  const getMousePos = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (readonly || !tool) return;
    const pos = getMousePos(e);
    setStartPos(pos);
    setDrawing(true);
  }, [readonly, tool, getMousePos]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!drawing || !startPos || !tool) return;
    const endPos = getMousePos(e);
    
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      type: tool,
      x: startPos.x,
      y: startPos.y,
      name: '',
      color: '#ef4444',
    };

    if (tool === 'rect') {
      newAnnotation.width = Math.abs(endPos.x - startPos.x);
      newAnnotation.height = Math.abs(endPos.y - startPos.y);
      newAnnotation.x = Math.min(startPos.x, endPos.x);
      newAnnotation.y = Math.min(startPos.y, endPos.y);
    } else if (tool === 'arrow') {
      newAnnotation.endX = endPos.x;
      newAnnotation.endY = endPos.y;
    } else if (tool === 'text') {
      newAnnotation.text = '文本';
    } else if (tool === 'number') {
      newAnnotation.number = nextNumber;
      setNextNumber(n => n + 1);
    }

    onChange([...annotations, newAnnotation]);
    setDrawing(false);
    setStartPos(null);
    setEditingId(newAnnotation.id);
  }, [drawing, startPos, tool, annotations, onChange, getMousePos, nextNumber]);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    onChange(annotations.map(a => a.id === id ? { ...a, ...updates } : a));
  }, [annotations, onChange]);

  const deleteAnnotation = useCallback((id: string) => {
    onChange(annotations.filter(a => a.id !== id));
    setEditingId(null);
  }, [annotations, onChange]);

  const renderAnnotation = (ann: Annotation) => {
    const isEditing = editingId === ann.id;
    const color = ann.color || '#ef4444';

    return (
      <g key={ann.id} className="cursor-pointer">
        {ann.type === 'point' && (
          <>
            <circle
              cx={`${ann.x}%`}
              cy={`${ann.y}%`}
              r={8}
              fill={color}
              stroke="white"
              strokeWidth={2}
              onClick={() => !readonly && setEditingId(ann.id)}
            />
            {ann.name && (
              <text
                x={`${ann.x + 2}%`}
                y={`${ann.y - 2}%`}
                fill={color}
                fontSize={12}
                fontWeight="bold"
              >
                {ann.name}
              </text>
            )}
          </>
        )}

        {ann.type === 'rect' && (
          <>
            <rect
              x={`${ann.x}%`}
              y={`${ann.y}%`}
              width={`${ann.width || 0}%`}
              height={`${ann.height || 0}%`}
              fill="none"
              stroke={color}
              strokeWidth={2}
              onClick={() => !readonly && setEditingId(ann.id)}
            />
            {ann.name && (
              <text
                x={`${ann.x}%`}
                y={`${ann.y - 1}%`}
                fill={color}
                fontSize={12}
                fontWeight="bold"
              >
                {ann.name}
              </text>
            )}
          </>
        )}

        {ann.type === 'arrow' && (
          <>
            <defs>
              <marker
                id={`arrowhead-${ann.id}`}
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={color} />
              </marker>
            </defs>
            <line
              x1={`${ann.x}%`}
              y1={`${ann.y}%`}
              x2={`${ann.endX || ann.x}%`}
              y2={`${ann.endY || ann.y}%`}
              stroke={color}
              strokeWidth={2}
              markerEnd={`url(#arrowhead-${ann.id})`}
              onClick={() => !readonly && setEditingId(ann.id)}
            />
          </>
        )}

        {ann.type === 'text' && (
          <text
            x={`${ann.x}%`}
            y={`${ann.y}%`}
            fill={color}
            fontSize={14}
            fontWeight="bold"
            onClick={() => !readonly && setEditingId(ann.id)}
          >
            {ann.text || '文本'}
          </text>
        )}

        {ann.type === 'number' && (
          <>
            <circle
              cx={`${ann.x}%`}
              cy={`${ann.y}%`}
              r={12}
              fill={color}
              stroke="white"
              strokeWidth={2}
              onClick={() => !readonly && setEditingId(ann.id)}
            />
            <text
              x={`${ann.x}%`}
              y={`${ann.y}%`}
              fill="white"
              fontSize={12}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {ann.number}
            </text>
          </>
        )}

        {isEditing && !readonly && (
          <foreignObject
            x={`${Math.min(ann.x + 3, 70)}%`}
            y={`${Math.min(ann.y + 3, 70)}%`}
            width="200"
            height="180"
          >
            <div className="bg-background border rounded-lg shadow-lg p-3 space-y-2" onClick={e => e.stopPropagation()}>
              <Input
                placeholder="标注名称"
                value={ann.name}
                onChange={e => updateAnnotation(ann.id, { name: e.target.value })}
                className="h-8 text-sm"
              />
              <Textarea
                placeholder="说明"
                value={ann.description || ''}
                onChange={e => updateAnnotation(ann.id, { description: e.target.value })}
                className="min-h-[60px] text-sm"
              />
              {ann.type === 'text' && (
                <Input
                  placeholder="文本内容"
                  value={ann.text || ''}
                  onChange={e => updateAnnotation(ann.id, { text: e.target.value })}
                  className="h-8 text-sm"
                />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  完成
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteAnnotation(ann.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  return (
    <div className="relative w-full h-full">
      {!readonly && (
        <div className="absolute top-2 left-2 z-10 flex gap-1 bg-background/90 rounded-lg p-1 shadow-md">
          <Button
            size="sm"
            variant={tool === 'point' ? 'default' : 'ghost'}
            onClick={() => setTool(tool === 'point' ? null : 'point')}
            title="点标注"
          >
            <Circle className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={tool === 'rect' ? 'default' : 'ghost'}
            onClick={() => setTool(tool === 'rect' ? null : 'rect')}
            title="矩形框"
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={tool === 'arrow' ? 'default' : 'ghost'}
            onClick={() => setTool(tool === 'arrow' ? null : 'arrow')}
            title="箭头"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={tool === 'text' ? 'default' : 'ghost'}
            onClick={() => setTool(tool === 'text' ? null : 'text')}
            title="文本"
          >
            <Type className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={tool === 'number' ? 'default' : 'ghost'}
            onClick={() => setTool(tool === 'number' ? null : 'number')}
            title="编号"
          >
            <Hash className="h-4 w-4" />
          </Button>
        </div>
      )}

      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: tool ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {annotations.map(renderAnnotation)}
      </svg>
    </div>
  );
}
