import { useState, useRef, useCallback, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useMechanisms, type Mechanism } from '@/hooks/useMechanisms';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  Save, RotateCcw, Grid3X3, Magnet, Ruler, Plus, Minus, 
  Camera, Trash2, Move, Lock, Unlock, Loader2, Check
} from 'lucide-react';
import { toast } from 'sonner';

type ViewType = 'front' | 'side' | 'top';

interface LayoutObject {
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

interface DraggableLayoutCanvasProps {
  workstationId: string;
}

export function DraggableLayoutCanvas({ workstationId }: DraggableLayoutCanvasProps) {
  const { 
    workstations, 
    layouts,
    getLayoutByWorkstation,
    updateLayout,
    addLayout
  } = useData();
  
  const { mechanisms, getEnabledMechanisms } = useMechanisms();
  
  const workstation = workstations.find(ws => ws.id === workstationId) as any;
  const layout = getLayoutByWorkstation(workstationId) as any;
  
  const [currentView, setCurrentView] = useState<ViewType>('front');
  const [objects, setObjects] = useState<LayoutObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secondSelectedId, setSecondSelectedId] = useState<string | null>(null);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showDistances, setShowDistances] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [mechanismCounts, setMechanismCounts] = useState<Record<string, number>>({});
  
  const canvasRef = useRef<SVGSVGElement>(null);
  
  // Canvas dimensions
  const canvasWidth = 900;
  const canvasHeight = 600;
  const gridSize = 20;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  // Product dimensions from workstation
  const productDimensions = workstation?.product_dimensions as { length: number; width: number; height: number } || { length: 300, width: 200, height: 100 };
  const scale = 0.5; // pixels per mm
  const productW = productDimensions.length * scale;
  const productH = productDimensions.height * scale;
  const productD = productDimensions.width * scale;

  // Load layout objects when layout changes
  useEffect(() => {
    if (layout?.layout_objects) {
      try {
        const loadedObjects = typeof layout.layout_objects === 'string' 
          ? JSON.parse(layout.layout_objects) 
          : layout.layout_objects;
        if (Array.isArray(loadedObjects)) {
          setObjects(loadedObjects);
        }
      } catch (e) {
        console.error('Failed to parse layout objects:', e);
      }
    }
    if (layout?.grid_enabled !== undefined) setGridEnabled(layout.grid_enabled);
    if (layout?.snap_enabled !== undefined) setSnapEnabled(layout.snap_enabled);
    if (layout?.show_distances !== undefined) setShowDistances(layout.show_distances);
  }, [layout]);

  // Count mechanisms in objects
  useEffect(() => {
    const counts: Record<string, number> = {};
    objects.forEach(obj => {
      if (obj.type === 'mechanism' && obj.mechanismId) {
        counts[obj.mechanismId] = (counts[obj.mechanismId] || 0) + 1;
      }
    });
    setMechanismCounts(counts);
  }, [objects]);

  const snapToGrid = useCallback((value: number) => {
    if (!snapEnabled) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapEnabled, gridSize]);

  const handleMouseDown = (e: React.MouseEvent, obj: LayoutObject) => {
    if (obj.locked) return;
    e.stopPropagation();
    
    // Handle multi-selection with shift key
    if (e.shiftKey && selectedId && selectedId !== obj.id) {
      setSecondSelectedId(obj.id);
      return;
    }
    
    setSelectedId(obj.id);
    setSecondSelectedId(null);
    setIsDragging(true);
    
    const svg = canvasRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const svgY = ((e.clientY - rect.top) / rect.height) * canvasHeight;
    
    setDragOffset({
      x: svgX - obj.x,
      y: svgY - obj.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId) return;
    
    const svg = canvasRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const svgY = ((e.clientY - rect.top) / rect.height) * canvasHeight;
    
    const newX = snapToGrid(svgX - dragOffset.x);
    const newY = snapToGrid(svgY - dragOffset.y);
    
    setObjects(prev => prev.map(obj => 
      obj.id === selectedId ? { ...obj, x: newX, y: newY } : obj
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = () => {
    setSelectedId(null);
    setSecondSelectedId(null);
  };

  const addCamera = () => {
    const cameraCount = objects.filter(o => o.type === 'camera').length;
    const newCamera: LayoutObject = {
      id: `camera-${Date.now()}`,
      type: 'camera',
      name: `CAM${cameraCount + 1}`,
      x: centerX + (cameraCount * 60 - 60),
      y: centerY - 150,
      width: 40,
      height: 50,
      rotation: 0,
      locked: false,
      cameraIndex: cameraCount + 1,
    };
    setObjects(prev => [...prev, newCamera]);
  };

  const addMechanism = (mechanism: Mechanism) => {
    const count = mechanismCounts[mechanism.id] || 0;
    const newMech: LayoutObject = {
      id: `mech-${Date.now()}`,
      type: 'mechanism',
      mechanismId: mechanism.id,
      mechanismType: mechanism.type,
      name: `${mechanism.name}#${count + 1}`,
      x: centerX + 100 + (count * 30),
      y: centerY + 80,
      width: (mechanism.default_width || 80) * scale,
      height: (mechanism.default_height || 60) * scale,
      rotation: 0,
      locked: false,
    };
    setObjects(prev => [...prev, newMech]);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setObjects(prev => prev.filter(o => o.id !== selectedId));
    setSelectedId(null);
  };

  const toggleLock = () => {
    if (!selectedId) return;
    setObjects(prev => prev.map(o => 
      o.id === selectedId ? { ...o, locked: !o.locked } : o
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = {
        layout_objects: objects,
        grid_enabled: gridEnabled,
        snap_enabled: snapEnabled,
        show_distances: showDistances,
      };
      
      if (layout?.id) {
        await updateLayout(layout.id, updates as any);
      } else {
        await addLayout({
          workstation_id: workstationId,
          name: workstation?.name || 'Layout',
          ...updates
        } as any);
      }
      toast.success('布局已保存');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const resetLayout = () => {
    if (!confirm('确定要重置布局吗？所有对象将被清除。')) return;
    setObjects([]);
    setSelectedId(null);
  };

  // Calculate distance between two objects or from product center
  const getDistance = (obj: LayoutObject, target?: LayoutObject) => {
    const productCenterX = centerX;
    const productCenterY = centerY;
    
    if (target) {
      const dx = (obj.x - target.x) / scale;
      const dy = (obj.y - target.y) / scale;
      return Math.round(Math.sqrt(dx * dx + dy * dy));
    }
    
    const dx = (obj.x - productCenterX) / scale;
    const dy = (obj.y - productCenterY) / scale;
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  };

  const selectedObj = objects.find(o => o.id === selectedId);
  const secondObj = objects.find(o => o.id === secondSelectedId);
  const enabledMechanisms = getEnabledMechanisms();

  // Get mechanism image URL for current view
  const getMechanismImage = (obj: LayoutObject) => {
    const mech = mechanisms.find(m => m.id === obj.mechanismId);
    if (!mech) return null;
    
    switch (currentView) {
      case 'front': return mech.front_view_image_url;
      case 'side': return mech.side_view_image_url;
      case 'top': return mech.top_view_image_url;
      default: return mech.front_view_image_url;
    }
  };

  if (!workstation) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-card border-b border-border">
        {/* Left: View tabs */}
        <div className="flex gap-1">
          {(['front', 'side', 'top'] as ViewType[]).map(view => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                currentView === view 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {view === 'front' ? '正视图' : view === 'side' ? '侧视图' : '俯视图'}
            </button>
          ))}
        </div>
        
        {/* Center: Add objects */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addCamera} className="gap-1">
            <Camera className="h-4 w-4" />
            添加相机
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                添加机构
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {enabledMechanisms.map(mech => (
                  <button
                    key={mech.id}
                    onClick={() => addMechanism(mech)}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left text-sm"
                  >
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden">
                      {mech.front_view_image_url ? (
                        <img src={mech.front_view_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs">📦</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{mech.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {mechanismCounts[mech.id] ? `已添加 ${mechanismCounts[mech.id]} 个` : '点击添加'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          {selectedId && (
            <>
              <Button variant="ghost" size="icon" onClick={toggleLock} className="h-8 w-8">
                {selectedObj?.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={deleteSelected} className="h-8 w-8 text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        
        {/* Right: Settings and save */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Switch checked={gridEnabled} onCheckedChange={setGridEnabled} id="grid" />
            <Label htmlFor="grid" className="text-xs cursor-pointer">
              <Grid3X3 className="h-3.5 w-3.5" />
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} id="snap" />
            <Label htmlFor="snap" className="text-xs cursor-pointer">
              <Magnet className="h-3.5 w-3.5" />
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={showDistances} onCheckedChange={setShowDistances} id="dist" />
            <Label htmlFor="dist" className="text-xs cursor-pointer">
              <Ruler className="h-3.5 w-3.5" />
            </Label>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <Button variant="outline" size="sm" onClick={resetLayout}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存布局
          </Button>
        </div>
      </div>
      
      {/* Objects count summary */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border text-sm">
        <span className="text-muted-foreground">当前布局:</span>
        <Badge variant="secondary">
          相机 {objects.filter(o => o.type === 'camera').length}
        </Badge>
        {Object.entries(mechanismCounts).map(([mechId, count]) => {
          const mech = mechanisms.find(m => m.id === mechId);
          return mech ? (
            <Badge key={mechId} variant="outline">
              {mech.name} ×{count}
            </Badge>
          ) : null;
        })}
      </div>
      
      {/* Canvas */}
      <div className="flex-1 p-4 overflow-hidden">
        <svg
          ref={canvasRef}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          className="w-full h-full bg-slate-900 rounded-lg"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
          <defs>
            <pattern id="grid-pattern" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <path 
                d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} 
                fill="none" 
                stroke="#334155" 
                strokeWidth="0.5" 
              />
            </pattern>
            <linearGradient id="product-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
          </defs>
          
          {/* Grid */}
          {gridEnabled && (
            <rect width={canvasWidth} height={canvasHeight} fill="url(#grid-pattern)" />
          )}
          
          {/* View label */}
          <text x={centerX} y={30} textAnchor="middle" fill="#e2e8f0" fontSize="16" fontWeight="600">
            {currentView === 'front' ? '正视图 (Front View)' : currentView === 'side' ? '侧视图 (Side View)' : '俯视图 (Top View)'}
          </text>
          
          {/* Product (center reference) */}
          <g>
            <rect
              x={centerX - (currentView === 'side' ? productD : productW) / 2}
              y={centerY - (currentView === 'top' ? productD : productH) / 2}
              width={currentView === 'side' ? productD : productW}
              height={currentView === 'top' ? productD : productH}
              fill="url(#product-grad)"
              stroke="#22d3ee"
              strokeWidth="2"
              rx={4}
            />
            <text
              x={centerX}
              y={centerY + 4}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="12"
              fontWeight="600"
            >
              产品
            </text>
            <text
              x={centerX}
              y={centerY + 18}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="10"
              opacity="0.8"
            >
              {productDimensions.length}×{productDimensions.width}×{productDimensions.height}mm
            </text>
          </g>
          
          {/* Draggable objects */}
          {objects.map(obj => {
            const isSelected = obj.id === selectedId;
            const isSecondSelected = obj.id === secondSelectedId;
            const mechImage = obj.type === 'mechanism' ? getMechanismImage(obj) : null;
            
            return (
              <g 
                key={obj.id}
                transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation})`}
                onMouseDown={(e) => handleMouseDown(e, obj)}
                style={{ cursor: obj.locked ? 'not-allowed' : 'move' }}
              >
                {/* Object body */}
                {obj.type === 'camera' ? (
                  <>
                    <rect
                      x={-obj.width / 2}
                      y={-obj.height / 2}
                      width={obj.width}
                      height={obj.height}
                      fill={isSelected ? '#3b82f6' : '#2563eb'}
                      stroke={isSelected ? '#60a5fa' : '#1d4ed8'}
                      strokeWidth={isSelected ? 3 : 2}
                      rx={4}
                    />
                    <circle cx={0} cy={obj.height / 4} r={8} fill="#1e40af" stroke="#3b82f6" strokeWidth="1.5" />
                    <text x={0} y={-obj.height / 2 - 8} textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="600">
                      {obj.name}
                    </text>
                  </>
                ) : (
                  <>
                    {mechImage ? (
                      <image
                        href={mechImage}
                        x={-obj.width / 2}
                        y={-obj.height / 2}
                        width={obj.width}
                        height={obj.height}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ pointerEvents: 'none' }}
                      />
                    ) : (
                      <rect
                        x={-obj.width / 2}
                        y={-obj.height / 2}
                        width={obj.width}
                        height={obj.height}
                        fill={isSelected ? '#f97316' : '#ea580c'}
                        stroke={isSelected ? '#fb923c' : '#c2410c'}
                        strokeWidth={isSelected ? 3 : 2}
                        rx={4}
                      />
                    )}
                    {(isSelected || isSecondSelected) && (
                      <rect
                        x={-obj.width / 2 - 4}
                        y={-obj.height / 2 - 4}
                        width={obj.width + 8}
                        height={obj.height + 8}
                        fill="none"
                        stroke={isSecondSelected ? '#22c55e' : '#60a5fa'}
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        rx={6}
                      />
                    )}
                    <text x={0} y={obj.height / 2 + 16} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="500">
                      {obj.name}
                    </text>
                  </>
                )}
                
                {/* Lock indicator */}
                {obj.locked && (
                  <g transform={`translate(${obj.width / 2 - 8}, ${-obj.height / 2 - 8})`}>
                    <circle r={8} fill="#1e293b" stroke="#64748b" />
                    <text x={0} y={4} textAnchor="middle" fill="#94a3b8" fontSize="10">🔒</text>
                  </g>
                )}
              </g>
            );
          })}
          
          {/* Distance lines */}
          {showDistances && selectedObj && (
            <g>
              {/* Distance to product center */}
              <line
                x1={selectedObj.x}
                y1={selectedObj.y}
                x2={centerX}
                y2={centerY}
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeDasharray="6 3"
              />
              <rect
                x={(selectedObj.x + centerX) / 2 - 30}
                y={(selectedObj.y + centerY) / 2 - 12}
                width={60}
                height={24}
                fill="#1e293b"
                stroke="#fbbf24"
                rx={4}
              />
              <text
                x={(selectedObj.x + centerX) / 2}
                y={(selectedObj.y + centerY) / 2 + 4}
                textAnchor="middle"
                fill="#fbbf24"
                fontSize="11"
                fontWeight="600"
              >
                {getDistance(selectedObj)}mm
              </text>
              
              {/* Distance between two selected objects */}
              {secondObj && (
                <>
                  <line
                    x1={selectedObj.x}
                    y1={selectedObj.y}
                    x2={secondObj.x}
                    y2={secondObj.y}
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />
                  <rect
                    x={(selectedObj.x + secondObj.x) / 2 - 35}
                    y={(selectedObj.y + secondObj.y) / 2 - 12}
                    width={70}
                    height={24}
                    fill="#1e293b"
                    stroke="#22c55e"
                    rx={4}
                  />
                  <text
                    x={(selectedObj.x + secondObj.x) / 2}
                    y={(selectedObj.y + secondObj.y) / 2 + 4}
                    textAnchor="middle"
                    fill="#22c55e"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {getDistance(selectedObj, secondObj)}mm
                  </text>
                </>
              )}
            </g>
          )}
          
          {/* Instructions */}
          <text x={20} y={canvasHeight - 20} fill="#64748b" fontSize="11">
            点击选择对象 | 拖拽移动 | Shift+点击测量两点距离
          </text>
        </svg>
      </div>
    </div>
  );
}
