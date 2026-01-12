import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useMechanisms, type Mechanism } from '@/hooks/useMechanisms';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { 
  Save, RotateCcw, Grid3X3, Magnet, Ruler, Plus, 
  Camera, Trash2, Lock, Unlock, Loader2, Copy, 
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair,
  Move
} from 'lucide-react';
import { toast } from 'sonner';
import { ObjectPropertyPanel, type LayoutObject } from './ObjectPropertyPanel';
import { CanvasControls } from './CanvasControls';
import { AlignmentGuides, calculateSnapPosition } from './AlignmentGuides';
import { EngineeringAnnotations } from './EngineeringAnnotations';
import { ResizeHandles } from './ResizeHandles';
import { CoordinateSystem } from './CoordinateSystem';
import { DimensionTable } from './DimensionTable';

type ViewType = 'front' | 'side' | 'top';

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
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Grid size selection
  const [gridSize, setGridSize] = useState(20);
  
  // Show property panel
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  
  // Smart snap enabled
  const [smartSnapEnabled, setSmartSnapEnabled] = useState(true);
  
  // Dragging object for alignment guides
  const [draggingObject, setDraggingObject] = useState<LayoutObject | null>(null);
  
  // Show dimension table
  const [showDimensionTable, setShowDimensionTable] = useState(true);
  
  // Show camera spacing and working distance
  const [showCameraSpacing, setShowCameraSpacing] = useState(true);
  const [showWorkingDistance, setShowWorkingDistance] = useState(true);
  
  const canvasRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Canvas dimensions
  const canvasWidth = 1200;
  const canvasHeight = 800;
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for pan mode
      if (e.code === 'Space' && !e.repeat) {
        setPanMode(true);
      }
      
      if (!selectedId) return;
      
      const selectedObj = objects.find(o => o.id === selectedId);
      if (!selectedObj || selectedObj.locked) return;
      
      const nudgeAmount = e.shiftKey ? 10 : 1;
      
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          deleteObject(selectedId);
          break;
        case 'ArrowUp':
          e.preventDefault();
          updateObject(selectedId, { y: selectedObj.y - nudgeAmount * scale });
          break;
        case 'ArrowDown':
          e.preventDefault();
          updateObject(selectedId, { y: selectedObj.y + nudgeAmount * scale });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          updateObject(selectedId, { x: selectedObj.x - nudgeAmount * scale });
          break;
        case 'ArrowRight':
          e.preventDefault();
          updateObject(selectedId, { x: selectedObj.x + nudgeAmount * scale });
          break;
        case 'd':
        case 'D':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            duplicateObject(selectedId);
          }
          break;
        case 'Escape':
          setSelectedId(null);
          setSecondSelectedId(null);
          setShowPropertyPanel(false);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setPanMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId, objects]);

  const snapToGrid = useCallback((value: number) => {
    if (!snapEnabled) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapEnabled, gridSize]);

  // Convert screen coordinates to SVG coordinates
  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = canvasRef.current;
    if (!svg) return { x: 0, y: 0 };
    
    const rect = svg.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX / zoom - pan.x / zoom,
      y: (clientY - rect.top) * scaleY / zoom - pan.y / zoom,
    };
  }, [zoom, pan]);

  const handleMouseDown = (e: React.MouseEvent, obj: LayoutObject) => {
    if (obj.locked || panMode) return;
    e.stopPropagation();
    
    // Handle multi-selection with shift key
    if (e.shiftKey && selectedId && selectedId !== obj.id) {
      setSecondSelectedId(obj.id);
      return;
    }
    
    setSelectedId(obj.id);
    setSecondSelectedId(null);
    setShowPropertyPanel(true);
    setIsDragging(true);
    
    const pos = screenToSvg(e.clientX, e.clientY);
    setDragOffset({
      x: pos.x - obj.x,
      y: pos.y - obj.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle panning
    if (isPanning && panMode) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: pan.x + dx, y: pan.y + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    if (!isDragging || !selectedId) return;
    
    const pos = screenToSvg(e.clientX, e.clientY);
    let newX = pos.x - dragOffset.x;
    let newY = pos.y - dragOffset.y;
    
    // Apply grid snap first
    if (snapEnabled) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }
    
    // Get current object for smart snap
    const currentObj = objects.find(o => o.id === selectedId);
    
    // Apply smart snap to other objects
    if (smartSnapEnabled && currentObj) {
      const snapResult = calculateSnapPosition(
        newX, newY,
        currentObj.width, currentObj.height,
        objects,
        centerX, centerY,
        15, // snap threshold
        selectedId
      );
      newX = snapResult.x;
      newY = snapResult.y;
    }
    
    // Update dragging object for alignment guides
    if (currentObj) {
      setDraggingObject({ ...currentObj, x: newX, y: newY });
    }
    
    setObjects(prev => prev.map(obj => 
      obj.id === selectedId ? { ...obj, x: newX, y: newY } : obj
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
    setDraggingObject(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (panMode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    } else {
      setSelectedId(null);
      setSecondSelectedId(null);
      setShowPropertyPanel(false);
    }
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.min(3, Math.max(0.25, prev + delta)));
  };

  const updateObject = (id: string, updates: Partial<LayoutObject>) => {
    setObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    ));
  };

  const handleResize = (id: string, width: number, height: number, x: number, y: number) => {
    setObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, width, height, x, y } : obj
    ));
  };

  const deleteObject = (id: string) => {
    setObjects(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setShowPropertyPanel(false);
    }
    if (secondSelectedId === id) {
      setSecondSelectedId(null);
    }
  };

  const duplicateObject = (id: string) => {
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    
    const newObj: LayoutObject = {
      ...obj,
      id: `${obj.type}-${Date.now()}`,
      x: obj.x + 40,
      y: obj.y + 40,
      locked: false,
    };
    
    if (obj.type === 'camera') {
      const cameraCount = objects.filter(o => o.type === 'camera').length;
      newObj.name = `CAM${cameraCount + 1}`;
      newObj.cameraIndex = cameraCount + 1;
    } else if (obj.mechanismId) {
      const mechCount = (mechanismCounts[obj.mechanismId] || 0) + 1;
      const mech = mechanisms.find(m => m.id === obj.mechanismId);
      newObj.name = `${mech?.name || 'Mechanism'}#${mechCount}`;
    }
    
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newObj.id);
  };

  const addCamera = () => {
    const cameraCount = objects.filter(o => o.type === 'camera').length;
    const newCamera: LayoutObject = {
      id: `camera-${Date.now()}`,
      type: 'camera',
      name: `CAM${cameraCount + 1}`,
      x: centerX + (cameraCount * 80 - 80),
      y: centerY - 180,
      width: 50,
      height: 60,
      rotation: 0,
      locked: false,
      cameraIndex: cameraCount + 1,
    };
    setObjects(prev => [...prev, newCamera]);
    setSelectedId(newCamera.id);
    setShowPropertyPanel(true);
  };

  const addMechanism = (mechanism: Mechanism) => {
    const count = mechanismCounts[mechanism.id] || 0;
    const newMech: LayoutObject = {
      id: `mech-${Date.now()}`,
      type: 'mechanism',
      mechanismId: mechanism.id,
      mechanismType: mechanism.type,
      name: `${mechanism.name}#${count + 1}`,
      x: centerX + 120 + (count * 40),
      y: centerY + 100,
      width: (mechanism.default_width || 100) * scale,
      height: (mechanism.default_height || 80) * scale,
      rotation: 0,
      locked: false,
    };
    setObjects(prev => [...prev, newMech]);
    setSelectedId(newMech.id);
    setShowPropertyPanel(true);
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
    setShowPropertyPanel(false);
  };

  const fitToScreen = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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

  // Current product dimensions based on view
  const currentProductW = currentView === 'side' ? productD : productW;
  const currentProductH = currentView === 'top' ? productD : productH;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-card border-b border-border">
        {/* Left: View tabs */}
        <div className="flex gap-1">
          {(['front', 'side', 'top'] as ViewType[]).map(view => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-all',
                currentView === view 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              )}
            >
              {view === 'front' ? '正视图' : view === 'side' ? '侧视图' : '俯视图'}
            </button>
          ))}
        </div>
        
        {/* Center: Add objects */}
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={addCamera} className="gap-2">
            <Camera className="h-4 w-4" />
            添加相机
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                添加机构
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {enabledMechanisms.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">暂无可用机构</p>
                ) : (
                  enabledMechanisms.map(mech => (
                    <button
                      key={mech.id}
                      onClick={() => addMechanism(mech)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted text-left transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center overflow-hidden border border-orange-500/20">
                        {mech.front_view_image_url ? (
                          <img src={mech.front_view_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">⚙️</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{mech.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {mechanismCounts[mech.id] ? `已添加 ${mechanismCounts[mech.id]} 个` : '点击添加'}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Right: Settings and save */}
        <div className="flex items-center gap-3">
          {/* Grid Size */}
          <Select value={gridSize.toString()} onValueChange={(v) => setGridSize(parseInt(v))}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10px</SelectItem>
              <SelectItem value="20">20px</SelectItem>
              <SelectItem value="40">40px</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-1.5">
            <Switch checked={gridEnabled} onCheckedChange={setGridEnabled} id="grid" />
            <Label htmlFor="grid" className="text-xs cursor-pointer flex items-center gap-1">
              <Grid3X3 className="h-3.5 w-3.5" />
              网格
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} id="snap" />
            <Label htmlFor="snap" className="text-xs cursor-pointer flex items-center gap-1">
              <Magnet className="h-3.5 w-3.5" />
              网格吸附
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={smartSnapEnabled} onCheckedChange={setSmartSnapEnabled} id="smartsnap" />
            <Label htmlFor="smartsnap" className="text-xs cursor-pointer flex items-center gap-1">
              <Move className="h-3.5 w-3.5" />
              智能对齐
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={showDistances} onCheckedChange={setShowDistances} id="dist" />
            <Label htmlFor="dist" className="text-xs cursor-pointer flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" />
              标注
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={showCameraSpacing} onCheckedChange={setShowCameraSpacing} id="spacing" />
            <Label htmlFor="spacing" className="text-xs cursor-pointer">
              相机间距
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={showDimensionTable} onCheckedChange={setShowDimensionTable} id="table" />
            <Label htmlFor="table" className="text-xs cursor-pointer">
              位置表
            </Label>
          </div>
          
          <div className="h-5 w-px bg-border" />
          
          <Button variant="outline" size="sm" onClick={resetLayout} className="gap-1">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存布局
          </Button>
        </div>
      </div>
      
      {/* Objects count summary */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border text-sm">
        <span className="text-muted-foreground">当前布局:</span>
        <Badge variant="secondary" className="gap-1">
          <Camera className="h-3 w-3" />
          {objects.filter(o => o.type === 'camera').length} 相机
        </Badge>
        {Object.entries(mechanismCounts).map(([mechId, count]) => {
          const mech = mechanisms.find(m => m.id === mechId);
          return mech ? (
            <Badge key={mechId} variant="outline" className="gap-1">
              {mech.name} ×{count}
            </Badge>
          ) : null;
        })}
        {selectedId && (
          <span className="ml-auto text-xs text-muted-foreground">
            已选中: {selectedObj?.name} | 按 Delete 删除 | Ctrl+D 复制
          </span>
        )}
      </div>
      
      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      >
        {/* Canvas */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <svg
              ref={canvasRef}
              viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${canvasWidth / zoom} ${canvasHeight / zoom}`}
              className={cn(
                "w-full h-full",
                panMode ? "cursor-grab" : "cursor-default",
                isPanning && "cursor-grabbing"
              )}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onMouseDown={handleCanvasMouseDown}
              onWheel={handleWheel}
            >
              <defs>
                {/* Grid pattern */}
                <pattern id="grid-pattern" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                  <path 
                    d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} 
                    fill="none" 
                    stroke="rgba(148, 163, 184, 0.15)" 
                    strokeWidth="0.5" 
                  />
                </pattern>
                <pattern id="grid-pattern-major" width={gridSize * 5} height={gridSize * 5} patternUnits="userSpaceOnUse">
                  <path 
                    d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`} 
                    fill="none" 
                    stroke="rgba(148, 163, 184, 0.3)" 
                    strokeWidth="1" 
                  />
                </pattern>
                
                {/* Product gradient */}
                <linearGradient id="product-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.6" />
                </linearGradient>
                
                {/* Camera gradient */}
                <linearGradient id="camera-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                
                {/* Selected camera gradient */}
                <linearGradient id="camera-selected-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                
                {/* Mechanism gradient */}
                <linearGradient id="mech-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
                
                {/* Shadow filter */}
                <filter id="drop-shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.3" />
                </filter>
                
                {/* Glow filter for selected */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              
              {/* Grid */}
              {gridEnabled && (
                <>
                  <rect x={-pan.x / zoom} y={-pan.y / zoom} width={canvasWidth * 2} height={canvasHeight * 2} fill="url(#grid-pattern)" />
                  <rect x={-pan.x / zoom} y={-pan.y / zoom} width={canvasWidth * 2} height={canvasHeight * 2} fill="url(#grid-pattern-major)" />
                </>
              )}
              
              {/* Axis lines */}
              <line x1={0} y1={centerY} x2={canvasWidth} y2={centerY} stroke="rgba(148, 163, 184, 0.2)" strokeWidth="1" strokeDasharray="8 4" />
              <line x1={centerX} y1={0} x2={centerX} y2={canvasHeight} stroke="rgba(148, 163, 184, 0.2)" strokeWidth="1" strokeDasharray="8 4" />
              
              {/* View label */}
              <g transform={`translate(${centerX}, 40)`}>
                <rect x={-80} y={-16} width={160} height={32} rx={8} fill="rgba(30, 41, 59, 0.9)" />
                <text x={0} y={6} textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
                  {currentView === 'front' ? '🎯 正视图 (Front)' : currentView === 'side' ? '📐 侧视图 (Side)' : '🔍 俯视图 (Top)'}
                </text>
              </g>
              
              {/* Product (center reference) */}
              <g filter="url(#drop-shadow)">
                <rect
                  x={centerX - currentProductW / 2}
                  y={centerY - currentProductH / 2}
                  width={currentProductW}
                  height={currentProductH}
                  fill="url(#product-grad)"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  rx={6}
                />
                {/* Product cross-hair */}
                <line x1={centerX - 15} y1={centerY} x2={centerX + 15} y2={centerY} stroke="#fff" strokeWidth="1" opacity="0.5" />
                <line x1={centerX} y1={centerY - 15} x2={centerX} y2={centerY + 15} stroke="#fff" strokeWidth="1" opacity="0.5" />
                <circle cx={centerX} cy={centerY} r={4} fill="#fff" opacity="0.7" />
                
                <text
                  x={centerX}
                  y={centerY + currentProductH / 2 + 20}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                >
                  产品 {productDimensions.length}×{productDimensions.width}×{productDimensions.height}mm
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
                    style={{ cursor: obj.locked ? 'not-allowed' : panMode ? 'inherit' : 'move' }}
                    filter={isSelected ? "url(#glow)" : "url(#drop-shadow)"}
                  >
                    {/* Selection outline */}
                    {(isSelected || isSecondSelected) && (
                      <rect
                        x={-obj.width / 2 - 6}
                        y={-obj.height / 2 - 6}
                        width={obj.width + 12}
                        height={obj.height + 12}
                        fill="none"
                        stroke={isSecondSelected ? '#22c55e' : '#60a5fa'}
                        strokeWidth="2"
                        strokeDasharray="6 3"
                        rx={8}
                        className="animate-pulse"
                      />
                    )}
                    
                    {/* Object body */}
                    {obj.type === 'camera' ? (
                      <>
                        {/* Camera body */}
                        <rect
                          x={-obj.width / 2}
                          y={-obj.height / 2}
                          width={obj.width}
                          height={obj.height}
                          fill={isSelected ? 'url(#camera-selected-grad)' : 'url(#camera-grad)'}
                          stroke={isSelected ? '#93c5fd' : '#3b82f6'}
                          strokeWidth={isSelected ? 3 : 2}
                          rx={6}
                        />
                        {/* Lens */}
                        <circle cx={0} cy={obj.height / 4} r={10} fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2" />
                        <circle cx={0} cy={obj.height / 4} r={5} fill="#1e40af" />
                        {/* Camera label */}
                        <rect x={-20} y={-obj.height / 2 - 22} width={40} height={18} rx={4} fill="rgba(30, 41, 59, 0.95)" />
                        <text x={0} y={-obj.height / 2 - 10} textAnchor="middle" fill="#60a5fa" fontSize="11" fontWeight="700">
                          {obj.name}
                        </text>
                      </>
                    ) : (
                      <>
                        {mechImage ? (
                          <>
                            <rect
                              x={-obj.width / 2 - 2}
                              y={-obj.height / 2 - 2}
                              width={obj.width + 4}
                              height={obj.height + 4}
                              fill="rgba(30, 41, 59, 0.9)"
                              stroke={isSelected ? '#fb923c' : '#ea580c'}
                              strokeWidth={isSelected ? 3 : 2}
                              rx={6}
                            />
                            <image
                              href={mechImage}
                              x={-obj.width / 2}
                              y={-obj.height / 2}
                              width={obj.width}
                              height={obj.height}
                              preserveAspectRatio="xMidYMid meet"
                              style={{ pointerEvents: 'none' }}
                            />
                          </>
                        ) : (
                          <rect
                            x={-obj.width / 2}
                            y={-obj.height / 2}
                            width={obj.width}
                            height={obj.height}
                            fill={isSelected ? 'url(#mech-grad)' : '#ea580c'}
                            stroke={isSelected ? '#fdba74' : '#c2410c'}
                            strokeWidth={isSelected ? 3 : 2}
                            rx={6}
                          />
                        )}
                        {/* Mechanism label */}
                        <rect x={-obj.width / 2} y={obj.height / 2 + 4} width={obj.width} height={18} rx={4} fill="rgba(30, 41, 59, 0.95)" />
                        <text x={0} y={obj.height / 2 + 16} textAnchor="middle" fill="#fdba74" fontSize="10" fontWeight="600">
                          {obj.name}
                        </text>
                      </>
                    )}
                    
                    {/* Lock indicator */}
                    {obj.locked && (
                      <g transform={`translate(${obj.width / 2 - 6}, ${-obj.height / 2 - 6})`}>
                        <circle r={10} fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                        <Lock x={-5} y={-5} width={10} height={10} className="text-amber-400" />
                      </g>
                    )}
                    
                    {/* Rotation indicator for selected */}
                    {isSelected && obj.rotation !== 0 && (
                      <text x={obj.width / 2 + 8} y={0} fill="#94a3b8" fontSize="9">
                        {obj.rotation}°
                      </text>
                    )}
                    
                    {/* Resize handles for selected object */}
                    <ResizeHandles
                      object={obj}
                      isSelected={isSelected}
                      onResize={handleResize}
                    />
                  </g>
                );
              })}
              
              {/* Alignment guides during drag */}
              {isDragging && draggingObject && smartSnapEnabled && (
                <AlignmentGuides
                  objects={objects}
                  draggingObject={draggingObject}
                  centerX={centerX}
                  centerY={centerY}
                  snapThreshold={15}
                />
              )}
              
              {/* Coordinate system with axes and rulers */}
              <CoordinateSystem
                centerX={centerX}
                centerY={centerY}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                scale={scale}
                currentView={currentView}
                gridSize={gridSize}
              />
              
              {/* Engineering annotations - camera spacing and working distance */}
              {showDistances && (
                <EngineeringAnnotations
                  objects={objects}
                  selectedObject={selectedObj || null}
                  secondSelectedObject={secondObj || null}
                  centerX={centerX}
                  centerY={centerY}
                  scale={scale}
                  currentView={currentView}
                  showCameraSpacing={showCameraSpacing}
                  showWorkingDistance={showWorkingDistance}
                />
              )}
              
              {/* Instructions */}
              <g transform={`translate(20, ${canvasHeight - 30})`}>
                <rect x={-8} y={-14} width={500} height={24} rx={6} fill="rgba(30, 41, 59, 0.9)" />
                <text fill="#94a3b8" fontSize="11">
                  <tspan>点击选择</tspan>
                  <tspan dx="8" fill="#64748b">|</tspan>
                  <tspan dx="8">拖拽移动</tspan>
                  <tspan dx="8" fill="#64748b">|</tspan>
                  <tspan dx="8">Shift+点击测距</tspan>
                  <tspan dx="8" fill="#64748b">|</tspan>
                  <tspan dx="8">拖角调整大小</tspan>
                  <tspan dx="8" fill="#64748b">|</tspan>
                  <tspan dx="8">滚轮缩放</tspan>
                  <tspan dx="8" fill="#64748b">|</tspan>
                  <tspan dx="8">空格+拖拽平移</tspan>
                </text>
              </g>
            </svg>
          </ContextMenuTrigger>
          
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={addCamera} className="gap-2">
              <Camera className="h-4 w-4" />
              添加相机
            </ContextMenuItem>
            <ContextMenuSeparator />
            {selectedId && (
              <>
                <ContextMenuItem onClick={() => duplicateObject(selectedId)} className="gap-2">
                  <Copy className="h-4 w-4" />
                  复制对象
                </ContextMenuItem>
                <ContextMenuItem 
                  onClick={() => updateObject(selectedId, { locked: !selectedObj?.locked })}
                  className="gap-2"
                >
                  {selectedObj?.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {selectedObj?.locked ? '解锁' : '锁定'}
                </ContextMenuItem>
                <ContextMenuItem 
                  onClick={() => deleteObject(selectedId)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem onClick={fitToScreen} className="gap-2">
              <Crosshair className="h-4 w-4" />
              适应屏幕
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        
        {/* Dimension Table */}
        {showDimensionTable && (
          <DimensionTable
            objects={objects}
            centerX={centerX}
            centerY={centerY}
            scale={scale}
            currentView={currentView}
            selectedId={selectedId}
            onSelectObject={(id) => {
              setSelectedId(id);
              setShowPropertyPanel(true);
            }}
          />
        )}
        
        {/* Property Panel */}
        {showPropertyPanel && selectedObj && (
          <ObjectPropertyPanel
            object={selectedObj}
            onUpdate={updateObject}
            onDelete={deleteObject}
            onClose={() => {
              setShowPropertyPanel(false);
              setSelectedId(null);
            }}
            scale={scale}
            canvasCenter={{ x: centerX, y: centerY }}
            currentView={currentView}
            allObjects={objects}
          />
        )}
        
        {/* Zoom Controls */}
        <CanvasControls
          zoom={zoom}
          onZoomChange={setZoom}
          onFitToScreen={fitToScreen}
          onResetView={resetView}
          panMode={panMode}
          onPanModeChange={setPanMode}
        />
      </div>
    </div>
  );
}
