import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import { toPng } from 'html-to-image';
import { useData } from '@/contexts/DataContext';
import { useMechanisms, type Mechanism } from '@/hooks/useMechanisms';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Camera, Trash2, Lock, Unlock, Copy, Crosshair } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ObjectPropertyPanel, type LayoutObject } from './ObjectPropertyPanel';
import { ObjectListPanel } from './ObjectListPanel';
import { CanvasControls } from './CanvasControls';
import { AlignmentGuides, calculateSnapPosition } from './AlignmentGuides';
import { CoordinateSystem } from './CoordinateSystem';
import { CAMERA_INTERACTION_TYPES, PRODUCT_INTERACTION_TYPES } from './MechanismSVG';
import { CameraMountPoints, findNearestMountPoint, getMountPointWorldPosition } from './CameraMountPoints';
import { ProductMountPoints, findNearestProductMountPoint, getProductMountPointWorldPosition } from './ProductMountPoints';
import { getMechanismImage } from '@/utils/mechanismImageUrls';
import { compressImage, dataUrlToBlob, QUALITY_PRESETS, type QualityPreset } from '@/utils/imageCompression';
import { getImageSaveErrorMessage } from '@/utils/errorMessages';

// Sub-components
import type { ViewType, StandardViewType, LayerType, ObjectOrderMap } from './canvasTypes';
import { AUTO_ARRANGE_CONFIG } from './canvasTypes';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasSVGDefs } from './CanvasSVGDefs';
import { IsometricGrid } from './IsometricGrid';
import { Layout3DPreview, getMechanismSurfaceHeight, getCameraMountPosition } from './Layout3DPreview';
import { ConnectionLines } from './ConnectionLines';
import { MechanismRenderer } from './MechanismRenderer';
import { ProductRenderer } from './ProductRenderer';
import { CameraRenderer } from './CameraRenderer';

import { ResizeHandles } from './ResizeHandles';
import { safeHardwareArray } from '@/utils/safeDataAccess';

interface DraggableLayoutCanvasProps {
  workstationId: string;
}

export function DraggableLayoutCanvas({ workstationId }: DraggableLayoutCanvasProps) {
  const {
    workstations, layouts, getLayoutByWorkstation, updateLayout, addLayout,
    updateWorkstation,
  } = useData();
  const { mechanisms, getEnabledMechanisms } = useMechanisms();

  const workstation = workstations.find(ws => ws.id === workstationId) as any;
  const layout = getLayoutByWorkstation(workstationId) as any;

  // Derive active views
  const primaryView: ViewType = layout?.primary_view || 'front';
  const auxiliaryView: ViewType = layout?.auxiliary_view || 'side';
  const activeViews: ViewType[] = useMemo(() =>
    primaryView === auxiliaryView ? [primaryView] : [primaryView, auxiliaryView],
    [primaryView, auxiliaryView]
  );
  const selectedCameraData = useMemo(() => safeHardwareArray(layout?.selected_cameras), [layout?.selected_cameras]);

  // ========== State ==========
  const [currentView, setCurrentView] = useState<ViewType>('front');
  const [objects, setObjects] = useState<LayoutObject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showDistances, setShowDistances] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const mouseDownPos = useRef<{ x: number; y: number; objId: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mechanismCounts, setMechanismCounts] = useState<Record<string, number>>({});
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [gridSize, setGridSize] = useState(20);
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [smartSnapEnabled, setSmartSnapEnabled] = useState(true);
  const [draggingObject, setDraggingObject] = useState<LayoutObject | null>(null);
  const [showObjectList, setShowObjectList] = useState(true);
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [saveQuality, setSaveQuality] = useState<QualityPreset>('fast');
  const [isSavingView, setIsSavingView] = useState(false);
  const [isSavingAllViews, setIsSavingAllViews] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [viewSaveStatus, setViewSaveStatus] = useState<Record<string, boolean>>({
    front: false, side: false, top: false, isometric: false,
  });
  const isometricScreenshotFnRef = useRef<(() => string | null) | null>(null);
  const fitAllFnRef = useRef<(() => void) | null>(null);
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);

  // Undo/Redo history
  const { pushState: pushHistory, undo: undoHistory, redo: redoHistory, canUndo, canRedo, reset: resetHistory } = useCanvasHistory<LayoutObject[]>([]);

  // Layer order
  const [layerOrder, setLayerOrder] = useState<LayerType[]>(() => {
    try {
      const saved = localStorage.getItem(`layerOrder_${workstationId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 3) return parsed;
      }
    } catch {}
    return ['mechanism', 'product', 'camera'];
  });
  const [draggedLayer, setDraggedLayer] = useState<LayerType | null>(null);
  const [dragOverLayer, setDragOverLayer] = useState<LayerType | null>(null);

  // Object-level ordering within each layer category
  const [objectOrder, setObjectOrder] = useState<ObjectOrderMap>(() => {
    try {
      const saved = localStorage.getItem(`objectOrder_${workstationId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const handleSaveLayerOrder = useCallback(() => {
    localStorage.setItem(`layerOrder_${workstationId}`, JSON.stringify(layerOrder));
    localStorage.setItem(`objectOrder_${workstationId}`, JSON.stringify(objectOrder));
    toast.success('层级设置已保存');
  }, [workstationId, layerOrder, objectOrder]);

  const handleObjectReorder = useCallback((objectId: string, direction: 'up' | 'down') => {
    setObjectOrder(prev => {
      const obj = objects.find(o => o.id === objectId);
      if (!obj) return prev;
      // Get all objects of same type, sorted by current order
      const sameType = objects
        .filter(o => o.type === obj.type)
        .sort((a, b) => (prev[a.id] ?? 0) - (prev[b.id] ?? 0));
      const idx = sameType.findIndex(o => o.id === objectId);
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sameType.length) return prev;
      // Swap order values
      const newOrder = { ...prev };
      const currentVal = newOrder[objectId] ?? idx;
      const targetVal = newOrder[sameType[targetIdx].id] ?? targetIdx;
      newOrder[objectId] = targetVal;
      newOrder[sameType[targetIdx].id] = currentVal;
      return newOrder;
    });
  }, [objects]);

  // Sort objects within each type by objectOrder for rendering
  const sortedObjects = useMemo(() => {
    return [...objects].sort((a, b) => {
      // First sort by layer category order
      const aLayerIdx = layerOrder.indexOf(a.type as LayerType);
      const bLayerIdx = layerOrder.indexOf(b.type as LayerType);
      if (aLayerIdx !== bLayerIdx) return aLayerIdx - bLayerIdx;
      // Within same category, sort by objectOrder
      return (objectOrder[a.id] ?? 0) - (objectOrder[b.id] ?? 0);
    });
  }, [objects, layerOrder, objectOrder]);

  const handleLayerDragStart = useCallback((type: LayerType) => setDraggedLayer(type), []);
  const handleLayerDragOver = useCallback((e: React.DragEvent, type: LayerType) => {
    e.preventDefault();
    setDragOverLayer(type);
  }, []);
  const handleLayerDrop = useCallback((targetType: LayerType) => {
    if (!draggedLayer || draggedLayer === targetType) {
      setDraggedLayer(null);
      setDragOverLayer(null);
      return;
    }
    setLayerOrder(prev => {
      const newOrder = [...prev];
      const oldIndex = newOrder.indexOf(draggedLayer);
      const newIndex = newOrder.indexOf(targetType);
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, draggedLayer);
      return newOrder;
    });
    setDraggedLayer(null);
    setDragOverLayer(null);
  }, [draggedLayer]);
  const handleLayerDragEnd = useCallback(() => {
    setDraggedLayer(null);
    setDragOverLayer(null);
  }, []);

  const canvasRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canvasWidth = 1200;
  const canvasHeight = 800;

  const productDimensions = workstation?.product_dimensions as { length: number; width: number; height: number } || { length: 300, width: 200, height: 100 };

  // Local product position state (only persisted on explicit save)
  const [localProductPosition, setLocalProductPosition] = useState<{ posX: number; posY: number; posZ: number }>(() => {
    const pp = (workstation as any)?.product_position as any;
    return pp && typeof pp === 'object' ? { posX: pp.posX ?? 0, posY: pp.posY ?? 0, posZ: pp.posZ ?? 0 } : { posX: 0, posY: 0, posZ: 0 };
  });

  // ========== Auto-scale ==========
  const autoScaleResult = useMemo(() => {
    const padding = 120;
    const iconMargin = 60;
    const allPoints: { x: number; y: number }[] = [];

    const projectForView = (px: number, py: number, pz: number, view: ViewType) => {
      switch (view) {
        case 'front': return { x: px, y: -pz };
        case 'side': return { x: py, y: -pz };
        case 'top': return { x: px, y: py };
        case 'isometric': {
          const cos30 = Math.cos(Math.PI / 6);
          const sin30 = Math.sin(Math.PI / 6);
          return { x: (px - py) * cos30, y: -(px + py) * sin30 - pz };
        }
      }
    };

    const pHalfL = productDimensions.length / 2;
    const pHalfW = productDimensions.width / 2;
    const pHalfH = productDimensions.height / 2;
    [{ x: -pHalfL, y: -pHalfW, z: -pHalfH }, { x: pHalfL, y: pHalfW, z: pHalfH }].forEach(c => {
      allPoints.push(projectForView(c.x, c.y, c.z, currentView));
    });

    objects.forEach(obj => {
      const p = projectForView(obj.posX ?? 0, obj.posY ?? 0, obj.posZ ?? 0, currentView);
      allPoints.push({ x: p.x - iconMargin, y: p.y - iconMargin });
      allPoints.push({ x: p.x + iconMargin, y: p.y + iconMargin });
    });

    if (allPoints.length < 2) {
      return { scale: 1.0, centerX: canvasWidth / 2, centerY: canvasHeight / 2 };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allPoints.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });

    const rangeX = maxX - minX || 200;
    const rangeY = maxY - minY || 200;
    let s = Math.min((canvasWidth - padding) / rangeX, (canvasHeight - padding) / rangeY, 2.0);
    s = Math.max(s, 0.3);

    const mmCenterX = (minX + maxX) / 2;
    const mmCenterY = (minY + maxY) / 2;

    return {
      scale: s,
      centerX: canvasWidth / 2 - mmCenterX * s,
      centerY: canvasHeight / 2 - mmCenterY * s,
    };
  }, [objects, currentView, productDimensions, canvasWidth, canvasHeight]);

  const scale = autoScaleResult.scale;
  const centerX = autoScaleResult.centerX;
  const centerY = autoScaleResult.centerY;
  const productW = productDimensions.length * scale;
  const productH = productDimensions.height * scale;
  const productD = productDimensions.width * scale;

  const selectedId = selectedIds[0] || null;
  const secondSelectedId = selectedIds[1] || null;

  // ========== 3D Coordinate Functions ==========
  const project3DTo2D = useCallback((posX: number, posY: number, posZ: number, view: ViewType) => {
    switch (view) {
      case 'front': return { x: centerX + posX * scale, y: centerY - posZ * scale };
      case 'side': return { x: centerX + posY * scale, y: centerY - posZ * scale };
      case 'top': return { x: centerX + posX * scale, y: centerY + posY * scale };
      case 'isometric': {
        const cos30 = Math.cos(Math.PI / 6);
        const sin30 = Math.sin(Math.PI / 6);
        return {
          x: centerX + (posX - posY) * cos30 * scale,
          y: centerY - ((posX + posY) * sin30 + posZ) * scale,
        };
      }
      default: return { x: centerX, y: centerY };
    }
  }, [centerX, centerY, scale]);

  const update3DFromCanvas = useCallback((canvasX: number, canvasY: number, view: ViewType, currentObj: LayoutObject): Partial<LayoutObject> => {
    const deltaXmm = (canvasX - centerX) / scale;
    const deltaYmm = (centerY - canvasY) / scale;
    switch (view) {
      case 'front': return { posX: Math.round(deltaXmm), posZ: Math.round(deltaYmm) };
      case 'side': return { posY: Math.round(deltaXmm), posZ: Math.round(deltaYmm) };
      case 'top': return { posX: Math.round(deltaXmm), posY: Math.round(-deltaYmm) };
      default: return {};
    }
  }, [centerX, centerY, scale]);

  // ========== Object CRUD ==========
  const updateObject = useCallback((id: string, updates: Partial<LayoutObject>) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
  }, []);

  const updateObjectWithFollowers = useCallback((id: string, updates: Partial<LayoutObject>) => {
    setObjects(prev => {
      const targetObj = prev.find(o => o.id === id);
      if (!targetObj) return prev;
      const deltaX = (updates.posX ?? targetObj.posX ?? 0) - (targetObj.posX ?? 0);
      const deltaY = (updates.posY ?? targetObj.posY ?? 0) - (targetObj.posY ?? 0);
      const deltaZ = (updates.posZ ?? targetObj.posZ ?? 0) - (targetObj.posZ ?? 0);
      if (targetObj.type === 'mechanism' && (deltaX !== 0 || deltaY !== 0 || deltaZ !== 0)) {
        return prev.map(obj => {
          if (obj.id === id) return { ...obj, ...updates };
          if (obj.mountedToMechanismId === id) {
            const newPosX = (obj.posX ?? 0) + deltaX;
            const newPosY = (obj.posY ?? 0) + deltaY;
            const newPosZ = (obj.posZ ?? 0) + deltaZ;
            const canvasPos = project3DTo2D(newPosX, newPosY, newPosZ, currentView);
            return { ...obj, posX: newPosX, posY: newPosY, posZ: newPosZ, x: canvasPos.x, y: canvasPos.y };
          }
          return obj;
        });
      }
      return prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj);
    });
  }, [project3DTo2D, currentView]);

  const deleteObject = useCallback((id: string) => {
    setObjects(prev => prev.filter(o => o.id !== id));
    setSelectedIds(prev => {
      const newIds = prev.filter(i => i !== id);
      if (newIds.length === 0) setShowPropertyPanel(false);
      return newIds;
    });
    setHiddenIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const duplicateObject = useCallback((id: string) => {
    setObjects(prev => {
      const obj = prev.find(o => o.id === id);
      if (!obj) return prev;
      const newObj: LayoutObject = {
        ...obj, id: `${obj.type}-${Date.now()}`,
        posX: (obj.posX ?? 0) + 50, posY: (obj.posY ?? 0) + 50,
        x: obj.x + 25, y: obj.y + 25, locked: false,
      };
      if (obj.type === 'camera') {
        const cameraCount = prev.filter(o => o.type === 'camera').length;
        newObj.name = `CAM${cameraCount + 1}`;
        newObj.cameraIndex = cameraCount + 1;
      } else if (obj.mechanismId) {
        const mechCount = prev.filter(o => o.mechanismId === obj.mechanismId).length;
        newObj.name = `${obj.name?.split('#')[0] || 'Mechanism'}#${mechCount + 1}`;
      }
      setSelectedIds([newObj.id]);
      return [...prev, newObj];
    });
  }, []);

  // ========== Effects ==========
  useEffect(() => {
    if (layout?.layout_objects) {
      try {
        const loadedObjects = typeof layout.layout_objects === 'string'
          ? JSON.parse(layout.layout_objects) : layout.layout_objects;
        if (Array.isArray(loadedObjects)) {
          const migratedObjects = loadedObjects.map((obj: any) => ({
            ...obj,
            posX: obj.posX ?? 0, posY: obj.posY ?? 0,
            posZ: obj.posZ ?? (obj.type === 'camera' ? 300 : 0),
          }));
          const hasProduct = migratedObjects.some((o: any) => o.type === 'product');
          if (!hasProduct) {
            const productCanvasPos = project3DTo2D(0, 0, 0, currentView);
            migratedObjects.push({
              id: 'product-main', type: 'product', name: '产品',
              posX: 0, posY: 0, posZ: 0,
              x: productCanvasPos.x, y: productCanvasPos.y,
              width: productDimensions.length, height: productDimensions.height,
              rotation: 0, locked: false,
            });
          }
          setObjects(migratedObjects);
        }
      } catch (e) { console.error('Failed to parse layout objects:', e); }
    } else {
      const productCanvasPos = project3DTo2D(0, 0, 0, currentView);
      setObjects([{
        id: 'product-main', type: 'product', name: '产品',
        posX: 0, posY: 0, posZ: 0,
        x: productCanvasPos.x, y: productCanvasPos.y,
        width: productDimensions.length, height: productDimensions.height,
        rotation: 0, locked: false,
      }]);
    }
    if (layout?.grid_enabled !== undefined) setGridEnabled(layout.grid_enabled);
    if (layout?.snap_enabled !== undefined) setSnapEnabled(layout.snap_enabled);
    if (layout?.show_distances !== undefined) setShowDistances(layout.show_distances);
    setViewSaveStatus({
      front: layout?.front_view_saved || false,
      side: layout?.side_view_saved || false,
      top: layout?.top_view_saved || false,
      isometric: !!(layout as any).isometric_view_saved,
    });
  }, [layout]);

  useEffect(() => {
    setObjects(prev => prev.map(obj => {
      const canvasPos = project3DTo2D(obj.posX ?? 0, obj.posY ?? 0, obj.posZ ?? 0, currentView);
      return { ...obj, x: canvasPos.x, y: canvasPos.y };
    }));
  }, [currentView, project3DTo2D]);

  useEffect(() => {
    const counts: Record<string, number> = {};
    objects.forEach(obj => {
      if (obj.type === 'mechanism' && obj.mechanismId) {
        counts[obj.mechanismId] = (counts[obj.mechanismId] || 0) + 1;
      }
    });
    setMechanismCounts(counts);
  }, [objects]);

  // ========== Keyboard shortcuts ==========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) setPanMode(true);
      if (!selectedId) return;
      const selectedObj = objects.find(o => o.id === selectedId);
      if (!selectedObj || selectedObj.locked) return;
      const nudgeAmount = e.shiftKey ? 10 : 1;

      const getNudge3D = (direction: 'up' | 'down' | 'left' | 'right') => {
        switch (currentView) {
          case 'front':
            if (direction === 'left') return { posX: (selectedObj.posX ?? 0) - nudgeAmount };
            if (direction === 'right') return { posX: (selectedObj.posX ?? 0) + nudgeAmount };
            if (direction === 'up') return { posZ: (selectedObj.posZ ?? 0) + nudgeAmount };
            if (direction === 'down') return { posZ: (selectedObj.posZ ?? 0) - nudgeAmount };
            break;
          case 'side':
            if (direction === 'left') return { posY: (selectedObj.posY ?? 0) - nudgeAmount };
            if (direction === 'right') return { posY: (selectedObj.posY ?? 0) + nudgeAmount };
            if (direction === 'up') return { posZ: (selectedObj.posZ ?? 0) + nudgeAmount };
            if (direction === 'down') return { posZ: (selectedObj.posZ ?? 0) - nudgeAmount };
            break;
          case 'top':
            if (direction === 'left') return { posX: (selectedObj.posX ?? 0) - nudgeAmount };
            if (direction === 'right') return { posX: (selectedObj.posX ?? 0) + nudgeAmount };
            if (direction === 'up') return { posY: (selectedObj.posY ?? 0) - nudgeAmount };
            if (direction === 'down') return { posY: (selectedObj.posY ?? 0) + nudgeAmount };
            break;
        }
        return {};
      };

      switch (e.key) {
        case 'Delete': case 'Backspace': pushHistory(objects, 'delete'); deleteObject(selectedId); break;
        case 'ArrowUp': e.preventDefault(); updateObject(selectedId, { y: selectedObj.y - nudgeAmount * scale, ...getNudge3D('up') }); break;
        case 'ArrowDown': e.preventDefault(); updateObject(selectedId, { y: selectedObj.y + nudgeAmount * scale, ...getNudge3D('down') }); break;
        case 'ArrowLeft': e.preventDefault(); updateObject(selectedId, { x: selectedObj.x - nudgeAmount * scale, ...getNudge3D('left') }); break;
        case 'ArrowRight': e.preventDefault(); updateObject(selectedId, { x: selectedObj.x + nudgeAmount * scale, ...getNudge3D('right') }); break;
        case 'd': case 'D':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); pushHistory(objects, 'duplicate'); duplicateObject(selectedId); }
          break;
        case 'z': case 'Z':
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();
            const redoState = redoHistory();
            if (redoState) setObjects(redoState);
          } else if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const undoState = undoHistory();
            if (undoState) setObjects(undoState);
          }
          break;
        case 'Escape': setSelectedIds([]); setShowPropertyPanel(false); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setPanMode(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [selectedId, objects, deleteObject, updateObject, duplicateObject, scale, pushHistory, undoHistory, redoHistory]);

  // ========== Mouse handlers ==========
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

  const isIsometric = currentView === 'isometric';

  const handleMouseDown = useCallback((e: React.MouseEvent, obj: LayoutObject) => {
    if (obj.locked || panMode || isIsometric) return;
    e.stopPropagation();
    if (e.shiftKey && selectedId && selectedId !== obj.id) {
      setSelectedIds(prev => prev.includes(obj.id) ? prev : [...prev, obj.id]);
      return;
    }
    setSelectedIds([obj.id]);
    setShowPropertyPanel(true);
    // Record mouse down position; don't start dragging yet
    const pos = screenToSvg(e.clientX, e.clientY);
    mouseDownPos.current = { x: e.clientX, y: e.clientY, objId: obj.id };
    setDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });
  }, [panMode, isIsometric, selectedId, screenToSvg]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && panMode) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: pan.x + dx, y: pan.y + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    // Check drag threshold before starting drag
    if (!isDragging && mouseDownPos.current) {
      const dx = Math.abs(e.clientX - mouseDownPos.current.x);
      const dy = Math.abs(e.clientY - mouseDownPos.current.y);
      if (dx > 5 || dy > 5) {
        setIsDragging(true);
      } else {
        return; // Haven't moved enough yet
      }
    }
    if (!isDragging || !selectedId) return;

    const pos = screenToSvg(e.clientX, e.clientY);
    let newX = pos.x - dragOffset.x;
    let newY = pos.y - dragOffset.y;

    if (snapEnabled) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    const currentObj = objects.find(o => o.id === selectedId);
    if (smartSnapEnabled && currentObj) {
      const snapResult = calculateSnapPosition(newX, newY, currentObj.width, currentObj.height, objects, centerX, centerY, 15, selectedId);
      newX = snapResult.x;
      newY = snapResult.y;
    }
    if (currentObj) setDraggingObject({ ...currentObj, x: newX, y: newY });

    if (currentObj?.type === 'camera' && currentView !== 'isometric') {
      const nearestMount = findNearestMountPoint(newX, newY, objects, currentView as StandardViewType, 70);
      if (nearestMount) {
        const mountPos = getMountPointWorldPosition(nearestMount.mechanism, nearestMount.mountPoint.id, currentView as StandardViewType);
        if (mountPos) { newX = mountPos.x; newY = mountPos.y; }
      }
    }
    if (currentObj?.type === 'product' && currentView !== 'isometric') {
      const nearestProductMount = findNearestProductMountPoint(newX, newY, objects, currentView as StandardViewType, 80);
      if (nearestProductMount) {
        const mountPos = getProductMountPointWorldPosition(nearestProductMount.mechanism, nearestProductMount.mountPoint.id, currentView as StandardViewType);
        if (mountPos) { newX = mountPos.x; newY = mountPos.y; }
      }
    }

    if (currentObj) {
      const updates3D = update3DFromCanvas(newX, newY, currentView, currentObj);
      if (currentObj.type === 'mechanism') {
        updateObjectWithFollowers(selectedId, { x: newX, y: newY, ...updates3D });
      } else {
        setObjects(prev => prev.map(obj => obj.id === selectedId ? { ...obj, x: newX, y: newY, ...updates3D } : obj));
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging && selectedId) {
      const currentObj = objects.find(o => o.id === selectedId);

      // Camera → mechanism snapping
      if (currentObj?.type === 'camera') {
        const nearestMount = findNearestMountPoint(currentObj.x, currentObj.y, objects, currentView as StandardViewType, 70);
        if (nearestMount) {
          const mountPos = getMountPointWorldPosition(nearestMount.mechanism, nearestMount.mountPoint.id, currentView as StandardViewType);
          const mechPosX = nearestMount.mechanism.posX ?? 0;
          const mechPosY = nearestMount.mechanism.posY ?? 0;
          const mechPosZ = nearestMount.mechanism.posZ ?? 0;
          const mechDims = {
            width: nearestMount.mechanism.width ?? 100,
            height: nearestMount.mechanism.height ?? 100,
            depth: (nearestMount.mechanism as any).depth ?? 100,
          };
          const mechType = nearestMount.mechanism.mechanismType || 'camera_mount';
          const mountOffset = getCameraMountPosition(mechType, nearestMount.mountPoint.id, mechDims);
          updateObject(selectedId, {
            mountedToMechanismId: nearestMount.mechanism.id,
            mountPointId: nearestMount.mountPoint.id,
            mountOffsetX: mountOffset.offsetX,
            mountOffsetY: mountOffset.offsetY,
            mountOffsetZ: mountOffset.offsetZ,
            posX: mechPosX + mountOffset.offsetX,
            posY: mechPosY + mountOffset.offsetY,
            posZ: mechPosZ + mountOffset.offsetZ,
            ...(mountPos ? { x: mountPos.x, y: mountPos.y } : {}),
          });
          toast.success(`${currentObj.name} 已挂载到 ${nearestMount.mechanism.name}`);
        } else if (currentObj.mountedToMechanismId) {
          const mechObj = objects.find(o => o.id === currentObj.mountedToMechanismId);
          updateObject(selectedId, {
            mountedToMechanismId: undefined, mountPointId: undefined,
            mountOffsetX: undefined, mountOffsetY: undefined, mountOffsetZ: undefined,
          });
          if (mechObj) toast.info(`${currentObj.name} 已从 ${mechObj.name} 解除挂载`);
        }
      }

      // Product → mechanism snapping
      if (currentObj?.type === 'product') {
        const nearestProductMount = findNearestProductMountPoint(currentObj.x, currentObj.y, objects, currentView as StandardViewType, 80);
        if (nearestProductMount) {
          const mountPos = getProductMountPointWorldPosition(nearestProductMount.mechanism, nearestProductMount.mountPoint.id, currentView as StandardViewType);
          const mech = nearestProductMount.mechanism;
          const mechPosX = mech.posX ?? 0;
          const mechPosY = mech.posY ?? 0;
          const mechPosZ = mech.posZ ?? 0;
          const mechHeight = mech.height ?? 100;
          const mechType = mech.mechanismType || '';

          // Calculate surface Z so product sits flush on mechanism
          const surfaceZ = getMechanismSurfaceHeight(mechType, mechHeight);
          const correctPosZ = mechPosZ + surfaceZ;

          updateObject(selectedId, {
            mountedToMechanismId: mech.id,
            mountPointId: nearestProductMount.mountPoint.id,
            mountOffsetX: 0,
            mountOffsetY: 0,
            mountOffsetZ: surfaceZ,
            posZ: correctPosZ,
            ...(mountPos ? { x: mountPos.x, y: mountPos.y } : {}),
          });

          // Sync 3D product position
          setLocalProductPosition({
            posX: mechPosX,
            posY: mechPosY,
            posZ: correctPosZ,
          });

          toast.success(`产品已吸附到 ${mech.name}`);
        } else if (currentObj.mountedToMechanismId) {
          const mechObj = objects.find(o => o.id === currentObj.mountedToMechanismId);
          updateObject(selectedId, {
            mountedToMechanismId: undefined, mountPointId: undefined,
            mountOffsetX: undefined, mountOffsetY: undefined, mountOffsetZ: undefined,
          });
          if (mechObj) toast.info(`产品已从 ${mechObj.name} 解除吸附`);
        }
      }
    }
    // Push history after drag completes
    if (isDragging) {
      pushHistory(objects, 'drag');
    }
    setIsDragging(false);
    setIsPanning(false);
    setDraggingObject(null);
    mouseDownPos.current = null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // If click hit an interactive object, stopPropagation already prevented reaching here
    // So any event that arrives is a background/grid click → deselect
    if (panMode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    } else {
      setSelectedIds([]);
      setShowPropertyPanel(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.min(3, Math.max(0.25, prev + delta)));
  };

  const handleResize = useCallback((id: string, width: number, height: number, x: number, y: number) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, width, height, x, y } : obj));
  }, []);

  // ========== Add objects ==========
  const doAddCamera = useCallback((selectedCam?: any) => {
    const existingCameras = objects.filter(o => o.type === 'camera');
    const cameraCount = existingCameras.length;
    let defaultPosX: number;
    if (cameraCount === 0) {
      defaultPosX = 0;
    } else {
      const totalAfterAdd = cameraCount + 1;
      const positions = [];
      for (let i = 0; i < totalAfterAdd; i++) {
        positions.push(-((totalAfterAdd - 1) * AUTO_ARRANGE_CONFIG.cameraSpacing / 2) + i * AUTO_ARRANGE_CONFIG.cameraSpacing);
      }
      defaultPosX = positions[cameraCount];
    }
    const defaultPosY = AUTO_ARRANGE_CONFIG.cameraDefaultY;
    const defaultPosZ = AUTO_ARRANGE_CONFIG.cameraDefaultZ;
    const canvasPos = project3DTo2D(defaultPosX, defaultPosY, defaultPosZ, currentView);
    const cameraModel3dUrl = selectedCam?.model_3d_url || null;
    const camName = selectedCam ? `${selectedCam.brand || ''} ${selectedCam.model || ''}`.trim() : `CAM${cameraCount + 1}`;
    const newCamera: LayoutObject = {
      id: `camera-${Date.now()}`, type: 'camera', name: camName || `CAM${cameraCount + 1}`,
      posX: defaultPosX, posY: defaultPosY, posZ: defaultPosZ,
      x: canvasPos.x, y: canvasPos.y, width: 50, height: 55, rotation: 0, locked: false,
      cameraIndex: cameraCount + 1,
      ...(cameraModel3dUrl ? { model3dUrl: cameraModel3dUrl } : {}),
    };
    setObjects(prev => [...prev, newCamera]);
    setSelectedIds([newCamera.id]);
    setShowPropertyPanel(true);
    toast.success(`已添加 ${newCamera.name}`);
  }, [objects, project3DTo2D, currentView]);

  const addCamera = useCallback(() => {
    if (selectedCameraData.length === 0) {
      // No cameras configured, add generic
      doAddCamera();
    } else if (selectedCameraData.length === 1) {
      // Only one camera, auto-select
      doAddCamera(selectedCameraData[0]);
    } else {
      // Multiple cameras, show picker
      setCameraPickerOpen(true);
    }
  }, [selectedCameraData, doAddCamera]);

  const addMechanism = useCallback((mechanism: Mechanism) => {
    const existingMechs = objects.filter(o => o.type === 'mechanism');
    const sameMechCount = existingMechs.filter(o => o.mechanismId === mechanism.id).length;
    const totalMechCount = existingMechs.length;
    let defaultPosX: number;
    if (totalMechCount === 0) { defaultPosX = 0; }
    else {
      const side = totalMechCount % 2 === 0 ? 1 : -1;
      defaultPosX = side * Math.ceil(totalMechCount / 2) * AUTO_ARRANGE_CONFIG.mechanismSpacing;
    }
    const defaultPosY = productDimensions.width / 2 + AUTO_ARRANGE_CONFIG.mechanismOffsetY;
    const defaultPosZ = AUTO_ARRANGE_CONFIG.mechanismDefaultZ;
    const canvasPos = project3DTo2D(defaultPosX, defaultPosY, defaultPosZ, currentView);
    const newMech: LayoutObject = {
      id: `mech-${Date.now()}`, type: 'mechanism', mechanismId: mechanism.id,
      mechanismType: mechanism.type, name: `${mechanism.name}#${sameMechCount + 1}`,
      posX: defaultPosX, posY: defaultPosY, posZ: defaultPosZ,
      x: canvasPos.x, y: canvasPos.y, width: 80, height: 60, rotation: 0, locked: false,
      model3dUrl: (mechanism as any).model_3d_url || undefined,
    };
    setObjects(prev => [...prev, newMech]);
    setSelectedIds([newMech.id]);
    setShowPropertyPanel(true);
    toast.success(`已添加 ${newMech.name}`);
  }, [objects, project3DTo2D, currentView, productDimensions.width]);

  // ========== Stage (save data only, no screenshots) ==========
  const handleStageLayout = useCallback(async () => {
    try {
      const updates = { layout_objects: objects, grid_enabled: gridEnabled, snap_enabled: snapEnabled, show_distances: showDistances };
      let layoutId = layout?.id;
      if (layoutId) { await updateLayout(layoutId, updates as any); }
      else {
        const newLayout = await addLayout({ workstation_id: workstationId, name: workstation?.name || 'Layout', ...updates } as any);
        layoutId = (newLayout as any)?.id;
      }
      await updateWorkstation(workstationId, { product_position: localProductPosition as any });
      toast.success('布局数据已暂存（未截图）');
    } catch (err) {
      toast.error('暂存失败');
      console.error(err);
    }
  }, [objects, gridEnabled, snapEnabled, showDistances, layout, workstationId, workstation, localProductPosition, updateLayout, addLayout, updateWorkstation]);

  // ========== Save ==========
  const handleSaveAll = async () => {
    setIsSaving(true);
    setIsSavingAllViews(true);
    setSaveProgress(0);
    const originalView = currentView;
    try {
      const updates = { layout_objects: objects, grid_enabled: gridEnabled, snap_enabled: snapEnabled, show_distances: showDistances };
      let layoutId = layout?.id;
      if (layoutId) { await updateLayout(layoutId, updates as any); }
      else {
        const newLayout = await addLayout({ workstation_id: workstationId, name: workstation?.name || 'Layout', ...updates } as any);
        layoutId = (newLayout as any)?.id;
      }
      setSaveProgress(10);

      // If currently in isometric (3D) mode, switch to 2D first so SVG renders
      const wasIsometric = originalView === 'isometric';
      if (wasIsometric) {
        // Clear stale refs before switching away from isometric — the 3D component will unmount
        isometricScreenshotFnRef.current = null;
        fitAllFnRef.current = null;
        setCurrentView('front');
        await new Promise(r => setTimeout(r, 400));
      }

      // Capture canvasRef AFTER switching to 2D so SVG is mounted
      const svg = canvasRef.current;
      if (svg && layoutId) {
        const views: ViewType[] = ['front', 'side', 'top'];
        const preset = QUALITY_PRESETS[saveQuality];
        const viewImages: { view: ViewType; blob: Blob }[] = [];

        for (let i = 0; i < views.length; i++) {
          const view = views[i];
          setCurrentView(view);
          await new Promise(r => setTimeout(r, wasIsometric ? 400 : 200));
          const dataUrl = await toPng(svg as unknown as HTMLElement, { quality: preset.quality, pixelRatio: preset.pixelRatio, backgroundColor: '#1e293b', skipFonts: true });
          const originalBlob = dataUrlToBlob(dataUrl);
          const compressedBlob = await compressImage(originalBlob, { quality: preset.quality, maxWidth: preset.maxWidth, maxHeight: preset.maxHeight, format: 'image/jpeg' });
          viewImages.push({ view, blob: compressedBlob });
          setSaveProgress(10 + Math.round(((i + 1) / views.length) * 35));
        }

        // Capture isometric (3D) screenshot — poll for 3D scene readiness
        setCurrentView('isometric');
        // Wait for 3D canvas to mount and register screenshot/fitAll refs (up to 3s)
        {
          let attempts = 0;
          while (!isometricScreenshotFnRef.current && attempts < 30) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
          }
        }
        if (isometricScreenshotFnRef.current) {
          // Wait for fitAll ref too
          {
            let attempts = 0;
            while (!fitAllFnRef.current && attempts < 10) {
              await new Promise(r => setTimeout(r, 100));
              attempts++;
            }
          }
          fitAllFnRef.current?.();
          await new Promise(r => setTimeout(r, 2000));
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
        }
        if (isometricScreenshotFnRef.current) {
          try {
            const isoDataUrl = isometricScreenshotFnRef.current();
            if (isoDataUrl) {
              const isoBlob = dataUrlToBlob(isoDataUrl);
              const compressedIsoBlob = await compressImage(isoBlob, { quality: preset.quality, maxWidth: preset.maxWidth, maxHeight: preset.maxHeight, format: 'image/jpeg' });
              viewImages.push({ view: 'isometric' as ViewType, blob: compressedIsoBlob });
            }
          } catch (e) {
            console.warn('Isometric screenshot failed:', e);
          }
        }
        setSaveProgress(50);

        const uploadPromises = viewImages.map(async ({ view, blob }, index) => {
          const fileName = `${workstationId}/${view}-${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage.from('workstation-views').upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('workstation-views').getPublicUrl(fileName);
          setSaveProgress(50 + Math.round(((index + 1) / viewImages.length) * 45));
          return { view, url: urlData.publicUrl };
        });
        const uploadResults = await Promise.all(uploadPromises);
        const updateData: Record<string, any> = {};
        uploadResults.forEach(({ view, url }) => { updateData[`${view}_view_image_url`] = url; updateData[`${view}_view_saved`] = true; });
        await updateLayout(layoutId, updateData as any);
        setViewSaveStatus({ front: true, side: true, top: true, isometric: true });
      }
      // Persist product position
      await updateWorkstation(workstationId, { product_position: localProductPosition as any });

      setSaveProgress(100);
      toast.success('布局和视图（含等轴测）已保存');
    } catch (error) {
      console.error('Save all error:', error);
      toast.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      // Restore original view (e.g. back to isometric)
      setCurrentView(originalView);
      setIsSaving(false);
      setIsSavingAllViews(false);
      setSaveProgress(0);
    }
  };

  const resetLayout = () => {
    if (!confirm('确定要重置布局吗？所有对象将被清除。')) return;
    setObjects([]);
    setSelectedIds([]);
    setShowPropertyPanel(false);
    setHiddenIds(new Set());
  };

  const autoArrangeObjects = useCallback(() => {
    setObjects(prev => {
      const cameras = prev.filter(o => o.type === 'camera');
      const mechs = prev.filter(o => o.type === 'mechanism');
      const arrangedCameras = cameras.map((cam, i) => {
        const startX = -(cameras.length - 1) * AUTO_ARRANGE_CONFIG.cameraSpacing / 2;
        const posX = startX + i * AUTO_ARRANGE_CONFIG.cameraSpacing;
        const canvasPos = project3DTo2D(posX, 0, AUTO_ARRANGE_CONFIG.cameraDefaultZ, currentView);
        return { ...cam, posX, posY: 0, posZ: AUTO_ARRANGE_CONFIG.cameraDefaultZ, x: canvasPos.x, y: canvasPos.y };
      });
      const arrangedMechs = mechs.map((mech, i) => {
        const startX = -(mechs.length - 1) * AUTO_ARRANGE_CONFIG.mechanismSpacing / 2;
        const posX = startX + i * AUTO_ARRANGE_CONFIG.mechanismSpacing;
        const canvasPos = project3DTo2D(posX, 100, AUTO_ARRANGE_CONFIG.mechanismDefaultZ, currentView);
        return { ...mech, posX, posY: 100, posZ: AUTO_ARRANGE_CONFIG.mechanismDefaultZ, x: canvasPos.x, y: canvasPos.y };
      });
      const others = prev.filter(o => o.type !== 'camera' && o.type !== 'mechanism');
      return [...arrangedCameras, ...arrangedMechs, ...others];
    });
    toast.success('已自动排布对象');
  }, [project3DTo2D, currentView]);

  // ========== Object list callbacks ==========
  const toggleObjectVisibility = useCallback((id: string) => {
    setHiddenIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }, []);

  const toggleObjectLock = useCallback((id: string) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, locked: !obj.locked } : obj));
  }, []);

  const focusObject = useCallback((id: string) => {
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    setPan({ x: (centerX - obj.x) * zoom, y: (centerY - obj.y) * zoom });
    setSelectedIds([id]);
    setShowPropertyPanel(true);
  }, [objects, centerX, centerY, zoom]);

  const reorderObject = useCallback((id: string, direction: 'up' | 'down') => {
    setObjects(prev => {
      const index = prev.findIndex(o => o.id === id);
      if (index === -1) return prev;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const newObjects = [...prev];
      [newObjects[index], newObjects[newIndex]] = [newObjects[newIndex], newObjects[index]];
      return newObjects;
    });
  }, []);

  const selectAllObjects = useCallback(() => setSelectedIds(objects.map(o => o.id)), [objects]);
  const deselectAllObjects = useCallback(() => { setSelectedIds([]); setShowPropertyPanel(false); }, []);

  const handleSelectObject = useCallback((id: string, multiSelect?: boolean) => {
    if (multiSelect) {
      setSelectedIds(prev => {
        if (prev.includes(id)) { const newIds = prev.filter(i => i !== id); if (newIds.length === 0) setShowPropertyPanel(false); return newIds; }
        return [...prev, id];
      });
    } else {
      setSelectedIds([id]);
      setShowPropertyPanel(true);
    }
  }, []);

  const fitToScreen = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ========== Derived ==========
  const selectedObj = objects.find(o => o.id === selectedId);
  const enabledMechanisms = getEnabledMechanisms();
  const mechViewForImage: StandardViewType = currentView === 'isometric' ? 'front' : currentView as StandardViewType;

  const getMechanismImageForObject = useCallback((obj: LayoutObject) => {
    // Check database URL first (user-uploaded images take priority)
    const mech = mechanisms.find(m => m.id === obj.mechanismId);
    if (mech) {
      let dbUrl: string | null = null;
      switch (mechViewForImage) {
        case 'front': dbUrl = mech.front_view_image_url; break;
        case 'side': dbUrl = mech.side_view_image_url; break;
        case 'top': dbUrl = mech.top_view_image_url; break;
        default: dbUrl = mech.front_view_image_url;
      }
      if (dbUrl) return dbUrl;
    }
    // Fallback to local static assets
    const mechType = obj.mechanismType || mech?.type;
    if (mechType) {
      const localImage = getMechanismImage(mechType, mechViewForImage);
      if (localImage) return localImage;
    }
    return null;
  }, [mechanisms, mechViewForImage]);

  const isoProject = useCallback((px: number, py: number, pz: number) => {
    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = Math.sin(Math.PI / 6);
    return { x: centerX + (px - py) * cos30 * scale, y: centerY - ((px + py) * sin30 + pz) * scale };
  }, [centerX, centerY, scale]);

  if (!workstation) return null;

  // ========== JSX ==========
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <CanvasToolbar
        currentView={currentView} setCurrentView={setCurrentView} viewSaveStatus={viewSaveStatus}
        saveQuality={saveQuality} setSaveQuality={setSaveQuality}
        handleSaveAll={handleSaveAll} isSaving={isSaving} isSavingAllViews={isSavingAllViews} saveProgress={saveProgress}
        settingsCollapsed={settingsCollapsed} setSettingsCollapsed={setSettingsCollapsed}
        addCamera={addCamera} addMechanism={addMechanism}
        autoArrangeObjects={autoArrangeObjects} resetLayout={resetLayout}
        gridSize={gridSize} setGridSize={setGridSize}
        gridEnabled={gridEnabled} setGridEnabled={setGridEnabled}
        snapEnabled={snapEnabled} setSnapEnabled={setSnapEnabled}
        smartSnapEnabled={smartSnapEnabled} setSmartSnapEnabled={setSmartSnapEnabled}
        showDistances={showDistances} setShowDistances={setShowDistances}
        showObjectList={showObjectList} setShowObjectList={setShowObjectList}
        layerOrder={layerOrder} draggedLayer={draggedLayer} dragOverLayer={dragOverLayer}
        onLayerDragStart={handleLayerDragStart} onLayerDragOver={handleLayerDragOver}
        onLayerDrop={handleLayerDrop} onLayerDragEnd={handleLayerDragEnd}
        onSaveLayerOrder={handleSaveLayerOrder}
        objects={objects} selectedId={selectedId} selectedObj={selectedObj}
        mechanisms={mechanisms} enabledMechanisms={enabledMechanisms} mechanismCounts={mechanismCounts}
        objectOrder={objectOrder} onObjectReorder={handleObjectReorder}
        canUndo={canUndo} canRedo={canRedo}
        onUndo={() => { const s = undoHistory(); if (s) setObjects(s); }}
        onRedo={() => { const s = redoHistory(); if (s) setObjects(s); }}
      />

      {/* Canvas Container */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {isIsometric ? (
          <Layout3DPreview
            objects={objects}
            productDimensions={productDimensions}
            onUpdateObject={updateObjectWithFollowers}
            selectedObjectId={selectedId}
            onSelectObject={(id) => {
              setSelectedIds(id ? [id] : []);
              setShowPropertyPanel(!!id);
            }}
            onUpdateProductDimensions={(dims) => {
              updateWorkstation(workstationId, { product_dimensions: dims as any });
            }}
            onScreenshotReady={(fn) => { isometricScreenshotFnRef.current = fn; }}
            onFitAllReady={(fn) => { fitAllFnRef.current = fn; }}
            productPosition={localProductPosition}
            onUpdateProductPosition={setLocalProductPosition}
            onStageLayout={handleStageLayout}
          />
        ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <svg
              ref={canvasRef}
              viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${canvasWidth / zoom} ${canvasHeight / zoom}`}
              className={cn("w-full h-full", panMode ? "cursor-grab" : "cursor-default", isPanning && "cursor-grabbing")}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onMouseDown={handleCanvasMouseDown}
              onWheel={handleWheel}
            >
              <CanvasSVGDefs gridSize={gridSize} />

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
                <rect x={-120} y={-16} width={240} height={32} rx={8} fill="rgba(30, 41, 59, 0.95)" />
                <text x={0} y={6} textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
                  {currentView === 'front' ? '🎯 正视图 | X↔ Z↕'
                    : currentView === 'side' ? '📐 左视图 | Y↔ Z↕'
                    : '🔍 俯视图 | X↔ Y↕'}
                </text>
              </g>

              {/* Connection lines */}
              <ConnectionLines objects={objects} isIsometric={false} currentView={currentView as 'front' | 'side' | 'top'} />

              {/* Dynamic layer rendering with object-level ordering */}
              {layerOrder.map((layerType) => {
                const layerObjects = sortedObjects.filter(o => o.type === layerType);
                return (
                  <g key={layerType}>
                    {layerType === 'mechanism' && (
                      <MechanismRenderer
                        objects={sortedObjects}
                        selectedId={selectedId} secondSelectedId={secondSelectedId}
                        panMode={panMode} isDragging={isDragging} draggingObject={draggingObject}
                        onMouseDown={handleMouseDown} onResize={handleResize}
                        getMechanismImageForObject={getMechanismImageForObject}
                        currentView={currentView as 'front' | 'side' | 'top'}
                      />
                    )}
                    {layerType === 'product' && (
                      <ProductRenderer
                        objects={sortedObjects} selectedId={selectedId} secondSelectedId={secondSelectedId}
                        panMode={panMode} isIsometric={false}
                        onMouseDown={handleMouseDown} onResize={handleResize}
                        productDimensions={productDimensions}
                        productW={productW} productH={productH} productD={productD}
                        currentView={currentView} isoProject={isoProject}
                      />
                    )}
                    {layerType === 'camera' && (
                      <CameraRenderer
                        objects={sortedObjects} selectedId={selectedId} secondSelectedId={secondSelectedId}
                        panMode={panMode} isIsometric={false}
                        onMouseDown={handleMouseDown} onResize={handleResize}
                        isoProject={isoProject}
                      />
                    )}
                  </g>
                );
              })}

              {/* Alignment guides */}
              {isDragging && draggingObject && smartSnapEnabled && (
                <AlignmentGuides objects={objects} draggingObject={draggingObject} centerX={centerX} centerY={centerY} snapThreshold={15} />
              )}

              {/* Coordinate system */}
              <CoordinateSystem centerX={centerX} centerY={centerY} canvasWidth={canvasWidth} canvasHeight={canvasHeight} scale={scale} currentView={currentView as StandardViewType} gridSize={gridSize} />

              {/* Camera mount points */}
              {isDragging && draggingObject?.type === 'camera' && objects
                .filter(o => o.type === 'mechanism' && CAMERA_INTERACTION_TYPES.includes(o.mechanismType || ''))
                .map(mech => (
                  <g key={`mount-${mech.id}`} transform={`translate(${mech.x}, ${mech.y})`}>
                    <CameraMountPoints
                      mechanismObject={mech} currentView={currentView as StandardViewType}
                      cameras={objects.filter(o => o.type === 'camera')}
                      onSnapCamera={(cameraId, mountPoint, mechanismId) => {
                        const mp = getMountPointWorldPosition(mech, mountPoint.id, currentView as StandardViewType);
                        if (mp) updateObject(cameraId, { x: mp.x, y: mp.y, mountedToMechanismId: mechanismId, mountPointId: mountPoint.id });
                      }}
                      draggingCameraId={draggingObject.id} scale={scale}
                    />
                  </g>
                ))}

              {/* Product mount points */}
              {isDragging && draggingObject?.type === 'product' && objects
                .filter(o => o.type === 'mechanism' && PRODUCT_INTERACTION_TYPES.includes(o.mechanismType || ''))
                .map(mech => (
                  <g key={`product-mount-${mech.id}`} transform={`translate(${mech.x}, ${mech.y})`}>
                    <ProductMountPoints
                      mechanismObject={mech} currentView={currentView as StandardViewType}
                      productObject={draggingObject} draggingProductId={draggingObject.id} scale={scale}
                    />
                  </g>
                ))}
            </svg>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={addCamera} className="gap-2"><Camera className="h-4 w-4" />添加相机</ContextMenuItem>
            <ContextMenuSeparator />
            {selectedId && (
              <>
                <ContextMenuItem onClick={() => duplicateObject(selectedId)} className="gap-2"><Copy className="h-4 w-4" />复制对象</ContextMenuItem>
                <ContextMenuItem onClick={() => updateObject(selectedId, { locked: !selectedObj?.locked })} className="gap-2">
                  {selectedObj?.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {selectedObj?.locked ? '解锁' : '锁定'}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => deleteObject(selectedId)} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />删除
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem onClick={fitToScreen} className="gap-2"><Crosshair className="h-4 w-4" />适应屏幕</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        )}


        {/* Object List Panel */}
        {showObjectList && (
          <ObjectListPanel
            objects={objects.filter(o => !hiddenIds.has(o.id) || selectedIds.includes(o.id))}
            selectedIds={selectedIds} onSelectObject={handleSelectObject}
            onToggleVisibility={toggleObjectVisibility} onToggleLock={toggleObjectLock}
            onFocusObject={focusObject} onDeleteObject={deleteObject} onDuplicateObject={duplicateObject}
            onReorderObject={reorderObject} onAutoArrange={autoArrangeObjects}
            onSelectAll={selectAllObjects} onDeselectAll={deselectAllObjects}
            hiddenIds={hiddenIds} centerX={centerX} centerY={centerY}
            scale={scale} currentView={currentView as StandardViewType}
          />
        )}

        {/* Property Panel */}
        {showPropertyPanel && selectedObj && (
          <ObjectPropertyPanel
            object={selectedObj} onUpdate={updateObject} onDelete={deleteObject}
            onClose={() => { setShowPropertyPanel(false); setSelectedIds([]); }}
            scale={scale} canvasCenter={{ x: centerX, y: centerY }}
            currentView={currentView as StandardViewType} allObjects={objects}
            isIsometric={isIsometric}
            productDimensions={productDimensions}
            onUpdateProductDimensions={(dims) => {
              updateWorkstation(workstationId, { product_dimensions: dims as any });
            }}
            productPosition={localProductPosition}
            onUpdateProductPosition={setLocalProductPosition}
          />
        )}

        {/* Zoom Controls */}
        <CanvasControls zoom={zoom} onZoomChange={setZoom} onFitToScreen={fitToScreen} onResetView={resetView} panMode={panMode} onPanModeChange={setPanMode} />
      </div>

      {/* Camera Picker Dialog */}
      <Dialog open={cameraPickerOpen} onOpenChange={setCameraPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择相机型号</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 max-h-60 overflow-y-auto">
            {selectedCameraData.map((cam: any, idx: number) => {
              const displayName = `${cam.brand || ''} ${cam.model || ''}`.trim() || `CAM${idx + 1}`;
              return (
                <button
                  key={cam.id || idx}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent text-left transition-colors"
                  onClick={() => {
                    setCameraPickerOpen(false);
                    doAddCamera(cam);
                  }}
                >
                  <Camera className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-medium text-sm">{displayName}</div>
                    {cam.resolution && <div className="text-xs text-muted-foreground">{cam.resolution}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
