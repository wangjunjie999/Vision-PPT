import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Focus, Lightbulb, Monitor, Plus, Minus, X, ChevronDown, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { sanitizeHardwareItem } from '@/utils/hardwareSerialization';

interface HardwareItem {
  id: string;
  brand: string;
  model: string;
  image_url?: string | null;
  front_view_url?: string | null;
  top_view_url?: string | null;
  model_3d_url?: string | null;
  [key: string]: any;
}

function getHardwareDisplayImage(item: HardwareItem | null) {
  return item?.front_view_url || item?.image_url || item?.top_view_url || null;
}

function getHardwareKey(items: ({ id: string; image_url?: string | null; front_view_url?: string | null; top_view_url?: string | null; model_3d_url?: string | null } | null)[]) {
  return JSON.stringify(
    items.map(item => item
      ? [
        item.id,
        item.image_url || '',
        item.front_view_url || '',
        item.top_view_url || '',
        item.model_3d_url || '',
      ].join('|')
      : null,
    ),
  );
}

interface HardwareSlotProps {
  label: string;
  icon: React.ReactNode;
  item: HardwareItem | null;
  slotIndex: number;
  onSelect: () => void;
  onClear: () => void;
}

function HardwareSlot({ label, icon, item, slotIndex, onSelect, onClear }: HardwareSlotProps) {
  const isEmpty = !item;
  const imageUrl = getHardwareDisplayImage(item);
  const [imageError, setImageError] = useState(false);

  // Reset image error when item changes
  useEffect(() => {
    setImageError(false);
  }, [item?.id, item?.image_url, item?.front_view_url, item?.top_view_url]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}_{slotIndex + 1}
        </span>
        {icon}
      </div>
      <div
        className={cn(
          'hardware-slot group cursor-pointer',
          !isEmpty && 'filled'
        )}
        onClick={isEmpty ? onSelect : undefined}
      >
        {isEmpty ? (
          <>
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                <ImageIcon className="h-5 w-5" />
              </div>
              <span className="text-xs">Empty</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] h-6 px-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              <Plus className="h-3 w-3" />
              From Pool
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
            <div className="flex flex-col items-center gap-2">
              {imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt={item.model}
                  className="w-12 h-12 object-contain rounded-lg bg-background/50"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  {icon}
                </div>
              )}
              <div className="text-center">
                <p className="text-xs font-medium text-foreground truncate max-w-[80px]">
                  {item.model}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] h-6 px-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              <Plus className="h-3 w-3" />
              From Pool
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// 单独的硬件选择项组件，用于处理图片加载错误
function HardwareSelectionItem({ 
  item, 
  type, 
  onSelect, 
  getItemDetails 
}: { 
  item: HardwareItem; 
  type: 'cameras' | 'lenses' | 'lights' | 'controllers';
  onSelect: () => void; 
  getItemDetails: (item: HardwareItem) => string;
}) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getHardwareDisplayImage(item);

  const renderIcon = () => {
    switch (type) {
      case 'cameras': return <Camera className="h-6 w-6 text-primary" />;
      case 'lenses': return <Focus className="h-6 w-6 text-primary" />;
      case 'lights': return <Lightbulb className="h-6 w-6 text-primary" />;
      case 'controllers': return <Monitor className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <div
      className="group relative p-3 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-md transition-all cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={item.model}
            className="w-14 h-14 object-contain rounded-lg bg-muted/50"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
            {renderIcon()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{item.brand}</p>
          <p className="text-xs text-muted-foreground truncate">{item.model}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">
            {getItemDetails(item)}
          </p>
        </div>
      </div>
    </div>
  );
}

interface HardwareSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'cameras' | 'lenses' | 'lights' | 'controllers';
  onSelect: (item: HardwareItem) => void;
}

function HardwareSelectionDialog({ open, onOpenChange, type, onSelect }: HardwareSelectionDialogProps) {
  const [items, setItems] = useState<HardwareItem[]>([]);
  const [loading, setLoading] = useState(true);

  const typeLabels = {
    cameras: '相机',
    lenses: '镜头',
    lights: '光源',
    controllers: '工控机',
  };

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open, type]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(type)
        .select('*')
        .eq('enabled', true);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast.error('Failed to load hardware items');
    } finally {
      setLoading(false);
    }
  };

  const getItemDetails = (item: HardwareItem) => {
    switch (type) {
      case 'cameras':
        return `${item.resolution} @ ${item.frame_rate}fps`;
      case 'lenses':
        return `${item.focal_length} ${item.aperture}`;
      case 'lights':
        return `${item.type} - ${item.color}`;
      case 'controllers':
        return `${item.cpu} / ${item.memory}`;
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            选择{typeLabels[type]}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无可用的{typeLabels[type]}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-1">
              {items.map((item) => (
                <HardwareSelectionItem 
                  key={item.id} 
                  item={item} 
                  type={type}
                  onSelect={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                  getItemDetails={getItemDetails}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export interface HardwareItemData {
  id: string;
  brand: string;
  model: string;
  image_url?: string | null;
  front_view_url?: string | null;
  top_view_url?: string | null;
  model_3d_url?: string | null;
}

interface HardwareConfigPanelProps {
  cameraCount?: number;
  lensCount?: number;
  lightCount?: number;
  onCameraCountChange?: (count: number) => void;
  onLensCountChange?: (count: number) => void;
  onLightCountChange?: (count: number) => void;
  initialCameras?: (HardwareItemData | null)[];
  initialLenses?: (HardwareItemData | null)[];
  initialLights?: (HardwareItemData | null)[];
  initialController?: HardwareItemData | null;
  hideLensAndLight?: boolean;
  onHardwareChange?: (config: {
    cameras: (HardwareItemData | null)[];
    lenses: (HardwareItemData | null)[];
    lights: (HardwareItemData | null)[];
    controller: HardwareItemData | null;
  }) => void;
}

function SlotCountControl({
  value,
  onIncrease,
  onDecrease,
  label,
  disableDecrease = false,
}: {
  value: number;
  onIncrease: () => void;
  onDecrease: () => void;
  label: string;
  disableDecrease?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onDecrease}
          disabled={disableDecrease}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-8 rounded bg-muted px-2 py-1 text-center text-xs font-semibold">
          {value}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onIncrease}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function HardwareConfigPanel({
  cameraCount = 1,
  lensCount = 1,
  lightCount = 1,
  onCameraCountChange,
  onLensCountChange,
  onLightCountChange,
  initialCameras = [],
  initialLenses = [],
  initialLights = [],
  initialController = null,
  hideLensAndLight = false,
  onHardwareChange,
}: HardwareConfigPanelProps) {
  const [cameras, setCameras] = useState<(HardwareItem | null)[]>([]);
  const [lenses, setLenses] = useState<(HardwareItem | null)[]>([]);
  const [lights, setLights] = useState<(HardwareItem | null)[]>([]);
  const [controller, setController] = useState<HardwareItem | null>(null);
  
  // Use ref to track if change is from user action vs initial sync
  const isUserAction = useRef(false);
  const lastInitialCamerasRef = useRef<string>('');
  const lastInitialLensesRef = useRef<string>('');
  const lastInitialLightsRef = useRef<string>('');
  const lastInitialControllerRef = useRef<string>('');

  // Sync cameras from initialCameras when they change (e.g., data loaded from DB)
  // Only sync if the initial data actually changed (not from our own updates)
  useEffect(() => {
    const newKey = getHardwareKey(initialCameras);
    if (newKey !== lastInitialCamerasRef.current) {
      lastInitialCamerasRef.current = newKey;
      const arr = Array(cameraCount).fill(null);
      initialCameras.forEach((item, i) => {
        if (i < cameraCount && item) arr[i] = item as HardwareItem;
      });
      setCameras(arr);
    }
  }, [initialCameras, cameraCount]);

  // Sync lenses from initialLenses when they change
  useEffect(() => {
    const newKey = getHardwareKey(initialLenses);
    if (newKey !== lastInitialLensesRef.current) {
      lastInitialLensesRef.current = newKey;
      const arr = Array(lensCount).fill(null);
      initialLenses.forEach((item, i) => {
        if (i < lensCount && item) arr[i] = item as HardwareItem;
      });
      setLenses(arr);
    }
  }, [initialLenses, lensCount]);

  // Sync lights from initialLights when they change
  useEffect(() => {
    const newKey = getHardwareKey(initialLights);
    if (newKey !== lastInitialLightsRef.current) {
      lastInitialLightsRef.current = newKey;
      const arr = Array(lightCount).fill(null);
      initialLights.forEach((item, i) => {
        if (i < lightCount && item) arr[i] = item as HardwareItem;
      });
      setLights(arr);
    }
  }, [initialLights, lightCount]);

  // Sync controller from initialController when it changes
  useEffect(() => {
    // Include both id and image_url in the key to detect image updates
    const newKey = initialController 
      ? `${initialController.id}|${initialController.image_url || ''}` 
      : '';
    if (newKey !== lastInitialControllerRef.current) {
      lastInitialControllerRef.current = newKey;
      setController(initialController as HardwareItem | null);
    }
  }, [initialController]);

  // Sync cameras array length when cameraCount changes
  useEffect(() => {
    setCameras(prev => {
      const newLength = cameraCount;
      const currentLength = prev.length;
      if (currentLength === newLength) return prev;
      if (currentLength < newLength) {
        // Increase length: add null elements
        return [...prev, ...Array(newLength - currentLength).fill(null)];
      } else {
        // Decrease length: truncate array
        return prev.slice(0, newLength);
      }
    });
  }, [cameraCount]);

  // Sync lenses array length when lensCount changes
  useEffect(() => {
    setLenses(prev => {
      const newLength = lensCount;
      const currentLength = prev.length;
      if (currentLength === newLength) return prev;
      if (currentLength < newLength) {
        return [...prev, ...Array(newLength - currentLength).fill(null)];
      } else {
        return prev.slice(0, newLength);
      }
    });
  }, [lensCount]);

  // Sync lights array length when lightCount changes
  useEffect(() => {
    setLights(prev => {
      const newLength = lightCount;
      const currentLength = prev.length;
      if (currentLength === newLength) return prev;
      if (currentLength < newLength) {
        return [...prev, ...Array(newLength - currentLength).fill(null)];
      } else {
        return prev.slice(0, newLength);
      }
    });
  }, [lightCount]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'cameras' | 'lenses' | 'lights' | 'controllers'>('cameras');
  const [selectedSlot, setSelectedSlot] = useState(0);
  const serializeHardwareItem = useCallback((item: HardwareItem | null): HardwareItemData | null => {
    if (!item) return null;
    return sanitizeHardwareItem(item) as HardwareItemData | null;
  }, []);

  // Notify parent when hardware changes via user action
  const notifyParent = useCallback(() => {
    if (onHardwareChange && isUserAction.current) {
      onHardwareChange({
        cameras: cameras.map(serializeHardwareItem),
        lenses: lenses.map(serializeHardwareItem),
        lights: lights.map(serializeHardwareItem),
        controller: serializeHardwareItem(controller),
      });
      isUserAction.current = false;
    }
  }, [cameras, lenses, lights, controller, onHardwareChange, serializeHardwareItem]);

  useEffect(() => {
    notifyParent();
  }, [notifyParent]);

  const openDialog = (type: 'cameras' | 'lenses' | 'lights' | 'controllers', slotIndex: number) => {
    setDialogType(type);
    setSelectedSlot(slotIndex);
    setDialogOpen(true);
  };

  const requestSlotCountChange = (
    type: 'cameras' | 'lenses' | 'lights',
    nextCount: number,
  ) => {
    const normalizedNext = Math.max(1, Math.round(nextCount));
    const config = {
      cameras: { current: cameraCount, items: cameras, onChange: onCameraCountChange, label: '相机' },
      lenses: { current: lensCount, items: lenses, onChange: onLensCountChange, label: '镜头' },
      lights: { current: lightCount, items: lights, onChange: onLightCountChange, label: '光源' },
    }[type];

    if (!config.onChange || normalizedNext === config.current) return;

    if (normalizedNext < config.current) {
      const removedSlots = config.items.slice(normalizedNext);
      if (removedSlots.some(Boolean)) {
        toast.warning(`请先清空最后的${config.label}槽位，再减少数量`);
        return;
      }
    }

    config.onChange(normalizedNext);
  };

  const handleSelect = (item: HardwareItem) => {
    isUserAction.current = true;
    // Create a complete item with all necessary properties
    const completeItem: HardwareItem = {
      id: item.id,
      brand: item.brand,
      model: item.model,
      image_url: item.image_url || null,
      ...item, // Keep any additional properties
    };
    
    switch (dialogType) {
      case 'cameras':
        const newCameras = [...cameras];
        newCameras[selectedSlot] = completeItem;
        setCameras(newCameras);
        // Update ref to prevent re-sync
        lastInitialCamerasRef.current = getHardwareKey(newCameras);
        break;
      case 'lenses':
        const newLenses = [...lenses];
        newLenses[selectedSlot] = completeItem;
        setLenses(newLenses);
        lastInitialLensesRef.current = getHardwareKey(newLenses);
        break;
      case 'lights':
        const newLights = [...lights];
        newLights[selectedSlot] = completeItem;
        setLights(newLights);
        lastInitialLightsRef.current = getHardwareKey(newLights);
        break;
      case 'controllers':
        setController(completeItem);
        // Update ref with same format as sync logic (id|image_url)
        lastInitialControllerRef.current = completeItem 
          ? `${completeItem.id}|${completeItem.image_url || ''}` 
          : '';
        break;
    }
  };

  const handleClear = (type: 'cameras' | 'lenses' | 'lights' | 'controllers', slotIndex: number) => {
    isUserAction.current = true;
    switch (type) {
      case 'cameras':
        const newCameras = [...cameras];
        newCameras[slotIndex] = null;
        setCameras(newCameras);
        break;
      case 'lenses':
        const newLenses = [...lenses];
        newLenses[slotIndex] = null;
        setLenses(newLenses);
        break;
      case 'lights':
        const newLights = [...lights];
        newLights[slotIndex] = null;
        setLights(newLights);
        break;
      case 'controllers':
        setController(null);
        // Update ref to empty string when cleared
        lastInitialControllerRef.current = '';
        break;
    }
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="config-panel-header">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-primary" />
          Hardware Configuration
        </h3>
      </div>

      <div className="p-4 space-y-6">
        {/* Cameras Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cameras
            </h4>
            {onCameraCountChange && (
              <SlotCountControl
                value={cameraCount}
                label="数量"
                onIncrease={() => requestSlotCountChange('cameras', cameraCount + 1)}
                onDecrease={() => requestSlotCountChange('cameras', cameraCount - 1)}
                disableDecrease={cameraCount <= 1}
              />
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {cameras.map((camera, index) => (
              <HardwareSlot
                key={`camera-${index}`}
                label="CAM"
                icon={<Camera className="h-3 w-3 text-primary" />}
                item={camera}
                slotIndex={index}
                onSelect={() => openDialog('cameras', index)}
                onClear={() => handleClear('cameras', index)}
              />
            ))}
          </div>
        </div>

        {!hideLensAndLight && (
          <>
            {/* Lenses Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Lenses
                </h4>
                {onLensCountChange && (
                  <SlotCountControl
                    value={lensCount}
                    label="数量"
                    onIncrease={() => requestSlotCountChange('lenses', lensCount + 1)}
                    onDecrease={() => requestSlotCountChange('lenses', lensCount - 1)}
                    disableDecrease={lensCount <= 1}
                  />
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {lenses.map((lens, index) => (
                  <HardwareSlot
                    key={`lens-${index}`}
                    label="LEN"
                    icon={<Focus className="h-3 w-3 text-accent" />}
                    item={lens}
                    slotIndex={index}
                    onSelect={() => openDialog('lenses', index)}
                    onClear={() => handleClear('lenses', index)}
                  />
                ))}
              </div>
            </div>

            {/* Lights Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Lights
                </h4>
                {onLightCountChange && (
                  <SlotCountControl
                    value={lightCount}
                    label="数量"
                    onIncrease={() => requestSlotCountChange('lights', lightCount + 1)}
                    onDecrease={() => requestSlotCountChange('lights', lightCount - 1)}
                    disableDecrease={lightCount <= 1}
                  />
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {lights.map((light, index) => (
                  <HardwareSlot
                    key={`light-${index}`}
                    label="LIGHT"
                    icon={<Lightbulb className="h-3 w-3 text-warning" />}
                    item={light}
                    slotIndex={index}
                    onSelect={() => openDialog('lights', index)}
                    onClear={() => handleClear('lights', index)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Industrial PC Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Industrial PC
          </h4>
          <div className="grid grid-cols-1 gap-2">
            <HardwareSlot
              label="IPC"
              icon={<Monitor className="h-3 w-3 text-success" />}
              item={controller}
              slotIndex={0}
              onSelect={() => openDialog('controllers', 0)}
              onClear={() => handleClear('controllers', 0)}
            />
          </div>
        </div>
      </div>

      <HardwareSelectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={dialogType}
        onSelect={handleSelect}
      />
    </div>
  );
}
