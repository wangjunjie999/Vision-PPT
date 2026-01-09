import { useData } from '@/contexts/DataContext';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Save, RotateCcw, Eye, EyeOff, Loader2, Move, Image } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DraggableLayoutCanvas } from './DraggableLayoutCanvas';

type ViewType = 'front' | 'side' | 'top';
type CameraMount = 'top' | 'side' | 'front' | 'bottom' | 'left' | 'right' | 'back';
type Mechanism = string;
type CanvasMode = 'static' | 'layout';

export function WorkstationCanvas() {
  const { 
    selectedWorkstationId, 
    workstations, 
    layouts,
    getLayoutByWorkstation,
    updateLayout,
    addLayout
  } = useData();
  
  const { getPixelRatio } = useAppStore();

  const [showGrid, setShowGrid] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('front');
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; viewName: string } | null>(null);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('layout');
  const canvasRef = useRef<HTMLDivElement>(null);

  const workstation = workstations.find(ws => ws.id === selectedWorkstationId) as any;
  if (!workstation) return null;

  // Show draggable layout mode
  if (canvasMode === 'layout') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mode toggle bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">画布模式:</span>
            <Button
              variant="default"
              size="sm"
              onClick={() => setCanvasMode('layout')}
              className="gap-1"
            >
              <Move className="h-3.5 w-3.5" />
              可拖拽布局
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCanvasMode('static')}
              className="gap-1"
            >
              <Image className="h-3.5 w-3.5" />
              静态三视图
            </Button>
          </div>
        </div>
        <DraggableLayoutCanvas workstationId={selectedWorkstationId!} />
      </div>
    );
  }

  const layout = getLayoutByWorkstation(selectedWorkstationId!) as any;
  
  // Create default layout values for display
  const selectedCameras = layout?.selected_cameras || [];
  const selectedLenses = layout?.selected_lenses || [];
  const selectedController = layout?.selected_controller || null;
  
  const displayLayout = {
    conveyorType: layout?.conveyor_type || '皮带输送线',
    cameraCount: layout?.camera_count || 1,
    cameraMounts: (layout?.camera_mounts || ['top']) as CameraMount[],
    mechanisms: (layout?.mechanisms || []) as Mechanism[],
    frontViewSaved: layout?.front_view_saved || false,
    sideViewSaved: layout?.side_view_saved || false,
    topViewSaved: layout?.top_view_saved || false,
    machineOutline: layout?.machine_outline as { length: number; width: number; height: number } | undefined,
    selectedCameras: Array.isArray(selectedCameras) ? selectedCameras : [],
    selectedLenses: Array.isArray(selectedLenses) ? selectedLenses : [],
    selectedController: selectedController,
  };

  const productDimensions = workstation.product_dimensions as { length: number; width: number; height: number } || { length: 300, width: 200, height: 100 };
  const installSpace = workstation.install_space as { length: number; width: number; height: number } | undefined;

  const views: { key: ViewType; label: string; saved: boolean }[] = [
    { key: 'front', label: '正视图', saved: displayLayout.frontViewSaved },
    { key: 'side', label: '侧视图', saved: displayLayout.sideViewSaved },
    { key: 'top', label: '俯视图', saved: displayLayout.topViewSaved },
  ];

  // Convert base64 to Blob for upload
  const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  };

  const saveViewImage = async (view: ViewType): Promise<{ url: string | null; success: boolean }> => {
    // Temporarily switch view for rendering
    setCurrentView(view);
    
    // Wait for DOM update using requestAnimationFrame
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
    
    try {
      if (!canvasRef.current) return { url: null, success: false };
      
      const pixelRatio = getPixelRatio();
      const dataUrl = await toPng(canvasRef.current, {
        backgroundColor: '#0f172a',
        pixelRatio,
        skipFonts: true,
        cacheBust: true,
      });
      
      const blob = base64ToBlob(dataUrl);
      const fileName = `${selectedWorkstationId}-${view}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('workstation-views')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('workstation-views')
        .getPublicUrl(fileName);
      
      return { url: `${urlData.publicUrl}?t=${Date.now()}`, success: true };
    } catch (error) {
      console.error(`Save ${view} view error:`, error);
      return { url: null, success: false };
    }
  };

  const handleSaveView = async () => {
    setIsSaving(true);
    try {
      const result = await saveViewImage(currentView);
      
      if (!result.success) {
        toast.error('保存失败');
        return;
      }

      const updates: Record<string, unknown> = {};
      if (currentView === 'front') {
        updates.front_view_saved = true;
        if (result.url) updates.front_view_url = result.url;
      }
      if (currentView === 'side') {
        updates.side_view_saved = true;
        if (result.url) updates.side_view_url = result.url;
      }
      if (currentView === 'top') {
        updates.top_view_saved = true;
        if (result.url) updates.top_view_url = result.url;
      }
      
      if (layout?.id) {
        await updateLayout(layout.id, updates as any);
      } else {
        await addLayout({
          workstation_id: selectedWorkstationId!,
          name: workstation.name || 'Layout',
          ...updates
        } as any);
      }
      toast.success(`${views.find(v => v.key === currentView)?.label}已保存`);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllViews = async () => {
    setIsSaving(true);
    
    try {
      const viewsToSave: { key: ViewType; name: string }[] = [
        { key: 'front', name: '正视图' },
        { key: 'side', name: '侧视图' },
        { key: 'top', name: '俯视图' },
      ];
      const results: Record<ViewType, string | null> = { front: null, side: null, top: null };
      let successCount = 0;
      
      for (let i = 0; i < viewsToSave.length; i++) {
        const view = viewsToSave[i];
        setSaveProgress({ current: i + 1, total: 3, viewName: view.name });
        
        const result = await saveViewImage(view.key);
        if (result.success) {
          results[view.key] = result.url;
          successCount++;
        }
      }
      
      // Switch back to front view after saving all
      setCurrentView('front');
      
      // Update layout with all URLs
      const updates: Record<string, unknown> = {
        front_view_saved: !!results.front,
        side_view_saved: !!results.side,
        top_view_saved: !!results.top,
      };
      if (results.front) updates.front_view_url = results.front;
      if (results.side) updates.side_view_url = results.side;
      if (results.top) updates.top_view_url = results.top;
      
      if (layout?.id) {
        await updateLayout(layout.id, updates as any);
      } else {
        await addLayout({
          workstation_id: selectedWorkstationId!,
          name: workstation.name || 'Layout',
          ...updates
        } as any);
      }
      
      toast.success(`已保存 ${successCount}/3 个视图`);
    } catch (error) {
      console.error('Save all views error:', error);
      toast.error('批量保存失败');
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Mode toggle bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">画布模式:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCanvasMode('layout')}
            className="gap-1"
          >
            <Move className="h-3.5 w-3.5" />
            可拖拽布局
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setCanvasMode('static')}
            className="gap-1"
          >
            <Image className="h-3.5 w-3.5" />
            静态三视图
          </Button>
        </div>
      </div>
      {/* View Tabs */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex gap-1">
          {views.map(view => (
            <button
              key={view.key}
              onClick={() => setCurrentView(view.key)}
              className={cn(
                'view-tab flex items-center gap-2',
                currentView === view.key && 'active'
              )}
            >
              {view.label}
              {view.saved && (
                <span className="w-2 h-2 rounded-full bg-success" />
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGrid(!showGrid)}
            className="h-8 w-8"
          >
            {showGrid ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setCurrentView('front')}
          >
            <RotateCcw className="h-4 w-4" />
            重置
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handleSaveView} disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? '保存中...' : `保存${views.find(v => v.key === currentView)?.label}`}
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSaveAllViews} disabled={isSaving}>
            {isSaving && saveProgress ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            一键保存三视图
          </Button>
        </div>
        
        {/* Save Progress Indicator */}
        {saveProgress && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-3 shadow-lg z-50 min-w-[280px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">正在保存三视图</span>
              <span className="text-xs text-muted-foreground">{saveProgress.current}/{saveProgress.total}</span>
            </div>
            <Progress value={(saveProgress.current / saveProgress.total) * 100} className="h-2 mb-2" />
            <div className="text-xs text-muted-foreground">
              正在保存: {saveProgress.viewName}
            </div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 p-4 overflow-hidden">
        <div 
          ref={canvasRef}
          className={cn(
            'canvas-container w-full h-full',
            !showGrid && 'bg-card'
          )}
        >
          <ThreeViewCanvas 
            view={currentView} 
            layout={displayLayout}
            workstation={{ productDimensions, installSpace }}
          />
        </div>
      </div>
    </div>
  );
}

interface HardwareItemInfo {
  id: string;
  brand: string;
  model: string;
  image_url?: string | null;
}

interface ThreeViewCanvasProps {
  view: ViewType;
  layout: {
    conveyorType: string;
    cameraCount: number;
    cameraMounts: CameraMount[];
    mechanisms: Mechanism[];
    machineOutline?: { length: number; width: number; height: number };
    selectedCameras: HardwareItemInfo[];
    selectedLenses: HardwareItemInfo[];
    selectedController: HardwareItemInfo | null;
  };
  workstation: {
    productDimensions: { length: number; width: number; height: number };
    installSpace?: { length: number; width: number; height: number };
  };
}

function ThreeViewCanvas({ view, layout, workstation }: ThreeViewCanvasProps) {
  // SVG dimensions
  const width = 900;
  const height = 600;
  const padding = 80;
  
  // Machine outline
  const machineW = layout.machineOutline?.length || workstation.installSpace?.length || 600;
  const machineH = layout.machineOutline?.height || workstation.installSpace?.height || 400;
  const machineD = layout.machineOutline?.width || workstation.installSpace?.width || 400;
  
  // Product dimensions
  const productL = workstation.productDimensions.length || 200;
  const productW = workstation.productDimensions.width || 150;
  const productH = workstation.productDimensions.height || 50;
  
  // Scale to fit
  const scaleX = (width - padding * 2 - 100) / machineW;
  const scaleY = (height - padding * 2 - 80) / Math.max(machineH, machineD);
  const scale = Math.min(scaleX, scaleY, 0.8);
  
  const centerX = width / 2;
  const centerY = height / 2 + 10;

  // View-specific dimensions
  const viewWidth = (view === 'side' ? machineD : machineW) * scale;
  const viewHeight = (view === 'top' ? machineD : machineH) * scale;

  // Camera positions based on camera count
  const getCameraPositions = () => {
    const cameraCount = layout.cameraCount || 1;
    return Array.from({ length: cameraCount }, (_, i) => {
      // Use cameraMounts to determine mount type for each camera, cycling if needed
      const mount = layout.cameraMounts[i % layout.cameraMounts.length] || 'top';
      const totalCameras = cameraCount;
      const spacing = Math.min(80, viewWidth / (totalCameras + 1));
      const offset = (i - (totalCameras - 1) / 2) * spacing;
      
      // Get hardware info for this camera slot
      const cameraInfo = layout.selectedCameras[i];
      const lensInfo = layout.selectedLenses[i];
      const cameraLabel = cameraInfo ? cameraInfo.model.slice(0, 12) : `CAM${i + 1}`;
      const lensLabel = lensInfo ? lensInfo.model.slice(0, 10) : '';
      
      if (view === 'front') {
        if (mount === 'top') return { 
          x: centerX + offset, 
          y: centerY - viewHeight / 2 - 60, 
          label: `CAM${i + 1}`,
          cameraModel: cameraLabel,
          lensModel: lensLabel,
          direction: 'down',
          mountType: '顶视'
        };
        if (mount === 'side') return { 
          x: centerX + viewWidth / 2 + 60, 
          y: centerY + offset * 0.5, 
          label: `CAM${i + 1}`,
          cameraModel: cameraLabel,
          lensModel: lensLabel,
          direction: 'left',
          mountType: '侧视'
        };
        return { 
          x: centerX + offset, 
          y: centerY - viewHeight / 2 - 50, 
          label: `CAM${i + 1}`, 
          cameraModel: cameraLabel,
          lensModel: lensLabel,
          angle: 25,
          direction: 'down-angled',
          mountType: '斜视'
        };
      }
      
      if (view === 'side') {
        if (mount === 'top') return { 
          x: centerX + offset, 
          y: centerY - viewHeight / 2 - 60, 
          label: `CAM${i + 1}`,
          cameraModel: cameraLabel,
          lensModel: lensLabel,
          direction: 'down',
          mountType: '顶视'
        };
        if (mount === 'side') return { 
          x: centerX + viewWidth / 2 + 60, 
          y: centerY + offset * 0.5, 
          label: `CAM${i + 1}`,
          cameraModel: cameraLabel,
          lensModel: lensLabel,
          direction: 'left',
          mountType: '侧视'
        };
        return { 
          x: centerX + offset, 
          y: centerY - viewHeight / 2 - 50, 
          label: `CAM${i + 1}`, 
          cameraModel: cameraLabel,
          lensModel: lensLabel,
          angle: 25,
          direction: 'down-angled',
          mountType: '斜视'
        };
      }
      
      // Top view
      if (mount === 'top') return { 
        x: centerX + offset, 
        y: centerY, 
        label: `CAM${i + 1}`, 
        cameraModel: cameraLabel,
        lensModel: lensLabel,
        isTopView: true,
        direction: 'center',
        mountType: '顶视'
      };
      if (mount === 'side') return { 
        x: centerX + viewWidth / 2 + 60, 
        y: centerY + offset * 0.5, 
        label: `CAM${i + 1}`,
        cameraModel: cameraLabel,
        lensModel: lensLabel,
        direction: 'left',
        mountType: '侧视'
      };
      return { 
        x: centerX + offset, 
        y: centerY - viewWidth / 2 - 40, 
        label: `CAM${i + 1}`,
        cameraModel: cameraLabel,
        lensModel: lensLabel,
        direction: 'down',
        mountType: '斜视'
      };
    });
  };

  const cameraPositions = getCameraPositions();

  // Mechanism info with icons - bright colors for dark background
  const mechanismInfo: Record<string, { symbol: string; name: string; color: string }> = {
    'stop': { symbol: '⊥', name: '挡停', color: '#f87171' },
    'cylinder': { symbol: '◇', name: '气缸', color: '#4ade80' },
    'gripper': { symbol: '⌐⌐', name: '夹爪', color: '#60a5fa' },
    'clamp': { symbol: '⊏⊐', name: '压紧', color: '#facc15' },
    'flip': { symbol: '↻', name: '翻转', color: '#a78bfa' },
    'lift': { symbol: '↕', name: '升降', color: '#38bdf8' },
    'indexing': { symbol: '◎', name: '分度盘', color: '#22d3ee' },
    'robot_pick': { symbol: '✋', name: '机械手', color: '#fb923c' }
  };

  // Grid pattern
  const gridSize = 40;
  const gridOpacity = 0.25;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        {/* Grid pattern - higher contrast */}
        <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path 
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} 
            fill="none" 
            stroke="#4a9eff" 
            strokeWidth="0.8" 
            opacity={gridOpacity}
          />
        </pattern>
        
        {/* Arrow markers - brighter */}
        <marker id="arrowhead" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
          <polygon points="0 0, 12 4, 0 8" fill="#00d4aa" />
        </marker>
        <marker id="arrowhead-dim" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
        <marker id="arrowhead-dim-rev" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
          <polygon points="8 0, 0 3, 8 6" fill="#94a3b8" />
        </marker>
        
        {/* Camera gradient - brighter blue */}
        <linearGradient id="cameraGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
        </linearGradient>
        
        {/* Machine gradient - more visible */}
        <linearGradient id="machineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="0.8" />
        </linearGradient>
        
        {/* Product gradient - vibrant cyan */}
        <linearGradient id="productGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="1" />
        </linearGradient>
        
        {/* FOV gradient - more visible */}
        <linearGradient id="fovGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
        </linearGradient>
        
        {/* Shadow filter */}
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>
      
      {/* Background grid */}
      <rect width={width} height={height} fill="url(#grid)" />
      
      {/* Border frame - bright cyan border */}
      <rect 
        x={padding - 20} 
        y={padding - 30} 
        width={width - padding * 2 + 40} 
        height={height - padding * 2 + 50} 
        fill="none" 
        stroke="#38bdf8"
        strokeWidth="2"
        rx={8}
      />
      
      {/* Title block */}
      <g>
        <rect 
          x={centerX - 140} 
          y={20} 
          width={280} 
          height={36} 
          fill="#1e3a5f"
          stroke="#38bdf8"
          strokeWidth="1.5"
          rx={6}
        />
        <text 
          x={centerX} 
          y={44} 
          textAnchor="middle" 
          fill="#e2e8f0"
          fontSize="16"
          fontWeight="600"
        >
          {view === 'front' ? '正视图 (Front View)' : view === 'side' ? '侧视图 (Side View)' : '俯视图 (Top View)'}
        </text>
      </g>
      
      {/* Machine outline with shadow - high contrast */}
      <g filter="url(#shadow)">
        <rect
          x={centerX - viewWidth / 2}
          y={centerY - viewHeight / 2}
          width={viewWidth}
          height={viewHeight}
          fill="url(#machineGrad)"
          stroke="#64748b"
          strokeWidth="3"
          rx={6}
        />
      </g>
      
      {/* Machine internal structure lines - more visible */}
      <g>
        <line 
          x1={centerX - viewWidth / 2 + 20} 
          y1={centerY - viewHeight / 2 + 20}
          x2={centerX + viewWidth / 2 - 20}
          y2={centerY - viewHeight / 2 + 20}
          stroke="#64748b"
          strokeWidth="1.5"
          strokeDasharray="6 3"
        />
        <line 
          x1={centerX - viewWidth / 2 + 20} 
          y1={centerY + viewHeight / 2 - 20}
          x2={centerX + viewWidth / 2 - 20}
          y2={centerY + viewHeight / 2 - 20}
          stroke="#64748b"
          strokeWidth="1.5"
          strokeDasharray="6 3"
        />
      </g>
      
      {/* Product on conveyor - vibrant cyan */}
      <g>
        <rect
          x={centerX - (view === 'side' ? productW : productL) * scale / 2}
          y={centerY - (view === 'top' ? productW : productH) * scale / 2 + 10}
          width={(view === 'side' ? productW : productL) * scale}
          height={(view === 'top' ? productW : productH) * scale}
          fill="url(#productGrad)"
          stroke="#22d3ee"
          strokeWidth="3"
          rx={3}
        />
        <text
          x={centerX}
          y={centerY + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize="12"
          fontWeight="600"
        >
          产品
        </text>
      </g>
      
      {/* Enhanced Flow direction with animated arrow - bright green */}
      <g>
        {/* Main flow line */}
        <path
          d={view === 'top' 
            ? `M ${padding + 30} ${centerY} L ${width - padding - 50} ${centerY}`
            : `M ${padding + 30} ${centerY + viewHeight / 4 + 30} L ${width - padding - 50} ${centerY + viewHeight / 4 + 30}`
          }
          fill="none"
          stroke="#10b981"
          strokeWidth="4"
          strokeDasharray="12 6"
          markerEnd="url(#arrowhead)"
        />
        
        {/* Flow direction arrow head (larger) */}
        <polygon
          points={view === 'top'
            ? `${width - padding - 50},${centerY - 12} ${width - padding - 20},${centerY} ${width - padding - 50},${centerY + 12}`
            : `${width - padding - 50},${centerY + viewHeight / 4 + 18} ${width - padding - 20},${centerY + viewHeight / 4 + 30} ${width - padding - 50},${centerY + viewHeight / 4 + 42}`
          }
          fill="#10b981"
        />
        
        {/* Flow direction label with background */}
        <rect
          x={width - padding - 55}
          y={view === 'top' ? centerY + 15 : centerY + viewHeight / 4 + 45}
          width={50}
          height={22}
          fill="#10b981"
          rx={4}
        />
        <text
          x={width - padding - 30}
          y={view === 'top' ? centerY + 30 : centerY + viewHeight / 4 + 60}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="12"
          fontWeight="700"
        >
          流向
        </text>
        
        {/* Entry point indicator */}
        <circle
          cx={padding + 30}
          cy={view === 'top' ? centerY : centerY + viewHeight / 4 + 30}
          r={10}
          fill="#10b981"
          opacity={0.8}
        />
        <text
          x={padding + 30}
          y={view === 'top' ? centerY - 18 : centerY + viewHeight / 4 + 10}
          textAnchor="middle"
          fill="#10b981"
          fontSize="12"
          fontWeight="600"
        >
          入料
        </text>
        
        {/* Exit point indicator */}
        <text
          x={width - padding - 30}
          y={view === 'top' ? centerY - 18 : centerY + viewHeight / 4 + 10}
          textAnchor="middle"
          fill="#10b981"
          fontSize="12"
          fontWeight="600"
        >
          出料
        </text>
      </g>
      
      {/* Conveyor type label - visible background */}
      <g>
        <rect 
          x={padding} 
          y={view === 'top' ? centerY - 40 : centerY + viewHeight / 4 + 5} 
          width={130} 
          height={28} 
          fill="#334155"
          stroke="#64748b"
          strokeWidth="1.5"
          rx={6}
        />
        <text
          x={padding + 65}
          y={view === 'top' ? centerY - 21 : centerY + viewHeight / 4 + 24}
          textAnchor="middle"
          fill="#e2e8f0"
          fontSize="12"
          fontWeight="500"
        >
          {layout.conveyorType}
        </text>
      </g>
      
      {/* Enhanced Cameras with FOV and position labels */}
      {cameraPositions.map((cam, i) => (
        <g key={i} transform={cam.angle ? `rotate(${cam.angle} ${cam.x} ${cam.y})` : undefined}>
          {/* Enhanced Field of view cone with gradient */}
          {cam.direction === 'down' && (
            <>
              <path
                d={`M ${cam.x} ${cam.y + 22} L ${cam.x - 50} ${centerY + 10} L ${cam.x + 50} ${centerY + 10} Z`}
                fill="url(#fovGrad)"
                stroke="#60a5fa"
                strokeWidth="2"
                strokeDasharray="6 3"
              />
              {/* FOV center line */}
              <line
                x1={cam.x}
                y1={cam.y + 22}
                x2={cam.x}
                y2={centerY + 10}
                stroke="#60a5fa"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </>
          )}
          {cam.direction === 'left' && (
            <>
              <path
                d={`M ${cam.x - 22} ${cam.y} L ${centerX + viewWidth / 2 - 20} ${cam.y - 40} L ${centerX + viewWidth / 2 - 20} ${cam.y + 40} Z`}
                fill="url(#fovGrad)"
                stroke="#60a5fa"
                strokeWidth="2"
                strokeDasharray="6 3"
              />
              {/* FOV center line */}
              <line
                x1={cam.x - 22}
                y1={cam.y}
                x2={centerX + viewWidth / 2 - 20}
                y2={cam.y}
                stroke="#60a5fa"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </>
          )}
          {cam.direction === 'down-angled' && (
            <path
              d={`M ${cam.x} ${cam.y + 22} L ${cam.x - 35} ${centerY + 15} L ${cam.x + 35} ${centerY + 15} Z`}
              fill="url(#fovGrad)"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="6 3"
            />
          )}
          {cam.isTopView && (
            <>
              {/* Top view camera indicator - concentric circles */}
              <circle
                cx={cam.x}
                cy={cam.y}
                r={35}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <circle
                cx={cam.x}
                cy={cam.y}
                r={25}
                fill="url(#fovGrad)"
                stroke="#3b82f6"
                strokeWidth="2"
              />
            </>
          )}
          
          {/* Camera bracket with enhanced styling */}
          <line
            x1={cam.x}
            y1={cam.y - 12}
            x2={cam.x}
            y2={cam.y - 32}
            stroke="#94a3b8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line
            x1={cam.x - 15}
            y1={cam.y - 32}
            x2={cam.x + 15}
            y2={cam.y - 32}
            stroke="#94a3b8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          
          {/* Camera body with enhanced styling */}
          <rect
            x={cam.x - 20}
            y={cam.y - 14}
            width={40}
            height={28}
            fill="url(#cameraGrad)"
            stroke="#60a5fa"
            strokeWidth="2.5"
            rx={5}
            filter="url(#shadow)"
          />
          
          {/* Camera indicator light */}
          <circle
            cx={cam.x + 12}
            cy={cam.y - 6}
            r={4}
            fill="#22c55e"
          />
          
          {/* Lens with enhanced styling */}
          <circle
            cx={cam.x}
            cy={cam.y + (cam.isTopView ? 0 : 20)}
            r={12}
            fill="#1e293b"
            stroke="#60a5fa"
            strokeWidth="2.5"
          />
          <circle
            cx={cam.x}
            cy={cam.y + (cam.isTopView ? 0 : 20)}
            r={7}
            fill="#3b82f6"
          />
          <circle
            cx={cam.x}
            cy={cam.y + (cam.isTopView ? 0 : 20)}
            r={3}
            fill="#1e293b"
          />
          
          {/* Enhanced Label badge with camera model */}
          <rect
            x={cam.x - 44}
            y={cam.y - 56}
            width={88}
            height={cam.lensModel ? 38 : 24}
            fill="#3b82f6"
            rx={6}
            filter="url(#shadow)"
          />
          <text
            x={cam.x}
            y={cam.y - 39}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="12"
            fontWeight="700"
          >
            {cam.cameraModel}
          </text>
          {cam.lensModel && (
            <text
              x={cam.x}
              y={cam.y - 24}
              textAnchor="middle"
              fill="#bfdbfe"
              fontSize="10"
              fontWeight="500"
            >
              {cam.lensModel}
            </text>
          )}
          
          {/* Mount type with background */}
          <rect
            x={cam.x - 28}
            y={cam.y + 32}
            width={56}
            height={20}
            fill="#475569"
            rx={4}
          />
          <text
            x={cam.x}
            y={cam.y + 46}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="11"
            fontWeight="500"
          >
            {cam.mountType}
          </text>
        </g>
      ))}
      
      {/* Dimension lines - brighter */}
      <g>
        {/* Width dimension */}
        <line
          x1={centerX - viewWidth / 2}
          y1={height - padding + 5}
          x2={centerX + viewWidth / 2}
          y2={height - padding + 5}
          stroke="#94a3b8"
          strokeWidth="1.5"
          markerStart="url(#arrowhead-dim-rev)"
          markerEnd="url(#arrowhead-dim)"
        />
        <line x1={centerX - viewWidth / 2} y1={centerY + viewHeight / 2} x2={centerX - viewWidth / 2} y2={height - padding + 10} stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" />
        <line x1={centerX + viewWidth / 2} y1={centerY + viewHeight / 2} x2={centerX + viewWidth / 2} y2={height - padding + 10} stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" />
        <rect x={centerX - 45} y={height - padding - 5} width={90} height={22} fill="#1e3a5f" rx={4} />
        <text x={centerX} y={height - padding + 10} textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="600">
          {view === 'side' ? machineD : machineW} mm
        </text>
        
        {/* Height dimension */}
        <line
          x1={padding - 15}
          y1={centerY - viewHeight / 2}
          x2={padding - 15}
          y2={centerY + viewHeight / 2}
          stroke="#94a3b8"
          strokeWidth="1.5"
          markerStart="url(#arrowhead-dim-rev)"
          markerEnd="url(#arrowhead-dim)"
        />
        <line x1={centerX - viewWidth / 2} y1={centerY - viewHeight / 2} x2={padding - 20} y2={centerY - viewHeight / 2} stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" />
        <line x1={centerX - viewWidth / 2} y1={centerY + viewHeight / 2} x2={padding - 20} y2={centerY + viewHeight / 2} stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" />
        <text x={padding - 15} y={centerY} textAnchor="middle" transform={`rotate(-90 ${padding - 15} ${centerY})`} fill="#e2e8f0" fontSize="13" fontWeight="600">
          {view === 'top' ? machineD : machineH} mm
        </text>
      </g>
      
      {/* Mechanism legend panel */}
      {layout.mechanisms.length > 0 && (
        <g>
          <rect
            x={width - padding - 130}
            y={padding - 20}
            width={140}
            height={30 + layout.mechanisms.length * 26}
            fill="#1e3a5f"
            stroke="#38bdf8"
            strokeWidth="1.5"
            rx={6}
          />
          <text
            x={width - padding - 60}
            y={padding + 2}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="12"
            fontWeight="600"
          >
            执行机构
          </text>
          <line
            x1={width - padding - 125}
            y1={padding + 10}
            x2={width - padding + 5}
            y2={padding + 10}
            stroke="#38bdf8"
            strokeWidth="0.8"
          />
          {layout.mechanisms.map((mech, i) => {
            const info = mechanismInfo[mech] || { symbol: '?', name: mech, color: '#94a3b8' };
            return (
              <g key={i}>
                <circle
                  cx={width - padding - 110}
                  cy={padding + 28 + i * 26}
                  r={12}
                  fill={info.color}
                  opacity={0.3}
                />
                <text
                  x={width - padding - 110}
                  y={padding + 33 + i * 26}
                  textAnchor="middle"
                  fontSize="14"
                  fill={info.color}
                >
                  {info.symbol}
                </text>
                <text
                  x={width - padding - 90}
                  y={padding + 32 + i * 26}
                  fill="#e2e8f0"
                  fontSize="12"
                >
                  {info.name}
                </text>
              </g>
            );
          })}
        </g>
      )}
      
      {/* Info panel - expanded to show hardware info */}
      <g>
        {(() => {
          const hasHardwareInfo = (layout.selectedCameras.length > 0 && layout.selectedCameras.some(c => c)) || 
                                   (layout.selectedLenses.length > 0 && layout.selectedLenses.some(l => l)) ||
                                   layout.selectedController !== null;
          const hasController = layout.selectedController !== null;
          // Calculate panel height: base 42px, +30px for camera/lens info, +16px for controller
          const panelHeight = hasHardwareInfo ? (hasController ? 88 : 72) : 42;
          const cameraModels = layout.selectedCameras
            .filter(c => c)
            .map(c => c.model)
            .slice(0, 2)
            .join(', ');
          const lensModels = layout.selectedLenses
            .filter(l => l)
            .map(l => l.model)
            .slice(0, 2)
            .join(', ');
          const controllerModel = layout.selectedController?.model || '';
          
          return (
            <>
              <rect
                x={padding - 10}
                y={height - panelHeight - 13}
                width={260}
                height={panelHeight}
                fill="#1e3a5f"
                stroke="#38bdf8"
                strokeWidth="1.5"
                rx={6}
              />
              <text x={padding + 5} y={height - panelHeight + 3} fill="#94a3b8" fontSize="11" fontWeight="500">
                相机数量: <tspan fill="#e2e8f0">{layout.cameraCount}台</tspan>
              </text>
              <text x={padding + 5} y={height - panelHeight + 19} fill="#94a3b8" fontSize="11" fontWeight="500">
                产品尺寸: <tspan fill="#e2e8f0">{productL}×{productW}×{productH} mm</tspan>
              </text>
              {hasHardwareInfo && (
                <>
                  {cameraModels && (
                    <text x={padding + 5} y={height - panelHeight + 35} fill="#94a3b8" fontSize="10" fontWeight="500">
                      相机型号: <tspan fill="#60a5fa">{cameraModels}</tspan>
                    </text>
                  )}
                  {lensModels && (
                    <text x={padding + 5} y={height - panelHeight + 51} fill="#94a3b8" fontSize="10" fontWeight="500">
                      镜头型号: <tspan fill="#a78bfa">{lensModels}</tspan>
                    </text>
                  )}
                  {controllerModel && (
                    <text x={padding + 5} y={height - panelHeight + 67} fill="#94a3b8" fontSize="10" fontWeight="500">
                      工控机型号: <tspan fill="#34d399">{controllerModel}</tspan>
                    </text>
                  )}
                </>
              )}
            </>
          );
        })()}
      </g>
    </svg>
  );
}
