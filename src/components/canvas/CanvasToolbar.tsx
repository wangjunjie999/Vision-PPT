import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  Save, RotateCcw, Plus, Camera, Loader2, Check,
  ChevronDown, ChevronUp, Settings2, Zap, Layers, LayoutGrid, GripVertical,
  Undo2, Redo2,
} from 'lucide-react';
import type { ViewType, LayerType, StandardViewType, ObjectOrderMap } from './canvasTypes';
import type { LayoutObject } from './ObjectPropertyPanel';
import type { QualityPreset } from '@/utils/imageCompression';
import type { Mechanism } from '@/hooks/useMechanisms';
import { MechanismThumbnail } from '@/components/common/ImageWithFallback';
import { CAMERA_INTERACTION_TYPES } from './MechanismSVG';

interface CanvasToolbarProps {
  // View
  currentView: ViewType;
  setCurrentView: (v: ViewType) => void;
  viewSaveStatus: Record<StandardViewType, boolean>;
  // Save
  saveQuality: QualityPreset;
  setSaveQuality: (q: QualityPreset) => void;
  handleSaveAll: () => void;
  isSaving: boolean;
  isSavingAllViews: boolean;
  saveProgress: number;
  // Settings toggle
  settingsCollapsed: boolean;
  setSettingsCollapsed: (v: boolean) => void;
  // Object actions
  addCamera: () => void;
  addMechanism: (m: Mechanism) => void;
  autoArrangeObjects: () => void;
  resetLayout: () => void;
  // Grid
  gridSize: number;
  setGridSize: (v: number) => void;
  gridEnabled: boolean;
  setGridEnabled: (v: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  smartSnapEnabled: boolean;
  setSmartSnapEnabled: (v: boolean) => void;
  // Display
  showDistances: boolean;
  setShowDistances: (v: boolean) => void;
  showObjectList: boolean;
  setShowObjectList: (v: boolean) => void;
  // Layer order
  layerOrder: LayerType[];
  draggedLayer: LayerType | null;
  dragOverLayer: LayerType | null;
  onLayerDragStart: (type: LayerType) => void;
  onLayerDragOver: (e: React.DragEvent, type: LayerType) => void;
  onLayerDrop: (type: LayerType) => void;
  onLayerDragEnd: () => void;
  onSaveLayerOrder: () => void;
  // Data
  objects: LayoutObject[];
  selectedId: string | null;
  selectedObj: LayoutObject | undefined;
  mechanisms: Mechanism[];
  enabledMechanisms: Mechanism[];
  mechanismCounts: Record<string, number>;
  // Object-level ordering
  objectOrder: ObjectOrderMap;
  onObjectReorder: (id: string, direction: 'up' | 'down') => void;
  // Undo/Redo
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const CanvasToolbar = memo(function CanvasToolbar({
  currentView, setCurrentView, viewSaveStatus,
  saveQuality, setSaveQuality, handleSaveAll, isSaving, isSavingAllViews, saveProgress,
  settingsCollapsed, setSettingsCollapsed,
  addCamera, addMechanism, autoArrangeObjects, resetLayout,
  gridSize, setGridSize, gridEnabled, setGridEnabled, snapEnabled, setSnapEnabled, smartSnapEnabled, setSmartSnapEnabled,
  showDistances, setShowDistances, showObjectList, setShowObjectList,
  layerOrder, draggedLayer, dragOverLayer, onLayerDragStart, onLayerDragOver, onLayerDrop, onLayerDragEnd, onSaveLayerOrder,
  objects, selectedId, selectedObj, mechanisms, enabledMechanisms, mechanismCounts,
  objectOrder, onObjectReorder,
  canUndo, canRedo, onUndo, onRedo,
}: CanvasToolbarProps) {
  const [expandedLayers, setExpandedLayers] = useState<Set<LayerType>>(new Set());
  const toggleLayerExpand = (type: LayerType) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-card border-b border-border">
        {/* View tabs */}
        <div className="flex gap-1">
          {(['front', 'side', 'top'] as ViewType[]).map(view => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5',
                currentView === view
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              )}
            >
              {view === 'front' ? '正视图 (X-Z)' : view === 'side' ? '左视图 (Y-Z)' : '俯视图 (X-Y)'}
              {viewSaveStatus[view as StandardViewType] && <Check className="h-3 w-3 text-green-500" />}
            </button>
          ))}
          <div className="h-6 w-px bg-border self-center mx-1" />
          <button
            onClick={() => setCurrentView('isometric')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5',
              currentView === 'isometric'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            )}
          >
            🧊 3D 预览
          </button>
          
          {/* Undo/Redo */}
          <div className="h-6 w-px bg-border self-center mx-1" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!canUndo} onClick={onUndo}>
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">撤销 (Ctrl+Z)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!canRedo} onClick={onRedo}>
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">重做 (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Right: Quality + Save + Settings toggle */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Select value={saveQuality} onValueChange={(v) => setSaveQuality(v as QualityPreset)}>
                    <SelectTrigger className="w-20 h-8 text-xs">
                      <Zap className={cn("h-3 w-3 mr-1", saveQuality === 'fast' ? "text-green-500" : saveQuality === 'high' ? "text-amber-500" : "text-blue-500")} />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />快速</span></SelectItem>
                      <SelectItem value="standard"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />标准</span></SelectItem>
                      <SelectItem value="high"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />高清</span></SelectItem>
                    </SelectContent>
                  </Select>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="text-xs">
                  <p className="font-medium mb-1">保存质量设置</p>
                  <p>快速: 更快的保存速度，较小文件</p>
                  <p>标准: 平衡质量和速度</p>
                  <p>高清: 最佳质量，较大文件</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={handleSaveAll} disabled={isSaving || isSavingAllViews} className="gap-1.5 h-8 min-w-[120px] relative overflow-hidden">
                  {isSavingAllViews && saveProgress > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 bg-primary-foreground/20 transition-all duration-300" style={{ width: `${saveProgress}%` }} />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {isSaving || isSavingAllViews ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {isSavingAllViews ? `保存中 ${saveProgress}%` : '保存'}
                    {!isSaving && !isSavingAllViews && viewSaveStatus.front && viewSaveStatus.side && viewSaveStatus.top && (
                      <Check className="h-3 w-3 text-green-500" />
                    )}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>一键保存布局数据 + 三视图截图</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-5 w-px bg-border" />

          <Button variant={settingsCollapsed ? "outline" : "secondary"} size="sm" onClick={() => setSettingsCollapsed(!settingsCollapsed)} className="gap-1.5 h-8">
            <Settings2 className="h-3.5 w-3.5" />
            工具
            {settingsCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Collapsible Tools Panel */}
      <Collapsible open={!settingsCollapsed} onOpenChange={(open) => setSettingsCollapsed(!open)}>
        <CollapsibleContent>
          <div className="bg-muted/30 border-b border-border px-4 py-3 space-y-3">
            {/* Row 1: Object Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">添加对象</span>
              <Button variant="default" size="sm" onClick={addCamera} className="gap-1.5 h-7 text-xs">
                <Camera className="h-3 w-3" />添加相机
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                    <Plus className="h-3 w-3" />添加机构
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {enabledMechanisms.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 text-center">暂无可用机构</p>
                    ) : (() => {
                      const CAMERA_TYPES = ['camera_mount', 'robot_arm'];
                      const cameraMechs = enabledMechanisms.filter(m => CAMERA_TYPES.includes(m.type));
                      const productMechs = enabledMechanisms.filter(m => !CAMERA_TYPES.includes(m.type));
                      const renderItem = (mech: any) => (
                        <button
                          key={mech.id}
                          onClick={() => addMechanism(mech)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted text-left transition-colors"
                        >
                          <MechanismThumbnail type={mech.type} databaseUrl={mech.front_view_image_url} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{mech.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {mechanismCounts[mech.id] ? `已添加 ${mechanismCounts[mech.id]} 个` : '点击添加'}
                            </div>
                          </div>
                        </button>
                      );
                      return (
                        <>
                          {cameraMechs.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">📷 相机交互</div>
                              {cameraMechs.map(renderItem)}
                            </>
                          )}
                          {cameraMechs.length > 0 && productMechs.length > 0 && <div className="my-1 h-px bg-border" />}
                          {productMechs.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">📦 产品交互</div>
                              {productMechs.map(renderItem)}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="h-4 w-px bg-border" />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={autoArrangeObjects} className="gap-1.5 h-7 text-xs">
                      <LayoutGrid className="h-3 w-3" />自动排布
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>一键重新排列所有对象</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button variant="ghost" size="sm" onClick={resetLayout} className="gap-1.5 h-7 text-xs">
                <RotateCcw className="h-3 w-3" />重置布局
              </Button>
            </div>

            {/* Row 2: Grid Settings */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">网格设置</span>
              <Select value={gridSize.toString()} onValueChange={(v) => setGridSize(parseInt(v))}>
                <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10px</SelectItem>
                  <SelectItem value="20">20px</SelectItem>
                  <SelectItem value="40">40px</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <Switch checked={gridEnabled} onCheckedChange={setGridEnabled} id="grid" className="scale-75" />
                <Label htmlFor="grid" className="text-xs cursor-pointer">显示网格</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} id="snap" className="scale-75" />
                <Label htmlFor="snap" className="text-xs cursor-pointer">网格吸附</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch checked={smartSnapEnabled} onCheckedChange={setSmartSnapEnabled} id="smartsnap" className="scale-75" />
                <Label htmlFor="smartsnap" className="text-xs cursor-pointer">智能对齐</Label>
              </div>
            </div>

            {/* Row 3: Display Settings */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">显示选项</span>
              <div className="flex items-center gap-1.5">
                <Switch checked={showDistances} onCheckedChange={setShowDistances} id="dist" className="scale-75" />
                <Label htmlFor="dist" className="text-xs cursor-pointer">尺寸标注</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch checked={showObjectList} onCheckedChange={setShowObjectList} id="table" className="scale-75" />
                <Label htmlFor="table" className="text-xs cursor-pointer">对象清单</Label>
              </div>

              <div className="h-4 w-px bg-border" />

              {/* Layer order control */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                    <Layers className="h-3 w-3" />层级设置
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">渲染层级（上方 = 最前）</div>
                    {[...layerOrder].reverse().map((type) => {
                      const info = {
                        mechanism: { icon: '🔧', label: '执行机构' },
                        product: { icon: '📦', label: '产品' },
                        camera: { icon: '📷', label: '相机' },
                      }[type];
                      const layerObjects = objects
                        .filter(o => o.type === type)
                        .sort((a, b) => (objectOrder[a.id] ?? 0) - (objectOrder[b.id] ?? 0));
                      const isExpanded = expandedLayers.has(type);
                      return (
                        <div key={type} className="space-y-1">
                          <div
                            draggable
                            onDragStart={() => onLayerDragStart(type)}
                            onDragOver={(e) => onLayerDragOver(e, type)}
                            onDrop={() => onLayerDrop(type)}
                            onDragEnd={onLayerDragEnd}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 border border-border/50 cursor-grab active:cursor-grabbing transition-all",
                              draggedLayer === type && "opacity-40",
                              dragOverLayer === type && draggedLayer !== type && "border-primary ring-1 ring-primary/30"
                            )}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs font-medium flex items-center gap-1.5 flex-1">
                              <span>{info.icon}</span>{info.label}
                              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-auto">{layerObjects.length}</Badge>
                            </span>
                            {layerObjects.length > 1 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleLayerExpand(type); }}
                                className="p-0.5 rounded hover:bg-muted"
                              >
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            )}
                          </div>
                          {/* Object-level items within this category */}
                          {isExpanded && layerObjects.length > 1 && (
                            <div className="ml-5 space-y-0.5">
                              {layerObjects.map((obj, idx) => (
                                <div
                                  key={obj.id}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-background/50 border border-border/30",
                                    selectedId === obj.id && "border-primary/50 bg-primary/10"
                                  )}
                                >
                                  <span className="flex-1 truncate text-muted-foreground">{obj.name}</span>
                                  <button
                                    onClick={() => onObjectReorder(obj.id, 'up')}
                                    disabled={idx === 0}
                                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => onObjectReorder(obj.id, 'down')}
                                    disabled={idx === layerObjects.length - 1}
                                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="text-[10px] text-muted-foreground mt-1">拖拽调整分类顺序，展开调整对象顺序</div>
                    <Button size="sm" className="w-full mt-2 gap-1.5" onClick={onSaveLayerOrder}>
                      <Save className="h-3.5 w-3.5" />保存层级设置
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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
    </>
  );
});
