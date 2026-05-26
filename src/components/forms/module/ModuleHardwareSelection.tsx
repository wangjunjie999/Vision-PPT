import { useMemo } from 'react';
import { Camera, Aperture, Cpu, Lightbulb, Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModuleFormState } from './types';
import { createModuleLightItem, type ModuleLightItem } from '@/utils/moduleLightItems';
import { getLensImagingAutoFill } from '@/utils/lensImagingAutoFill';
import {
  getModuleHardwareSlots,
  normalizeModuleHardwareSelection,
  resolveModuleHardwareSelection,
  type ModuleHardwareKind,
  type ModuleHardwareSlot,
} from '@/utils/moduleHardwareSlots';

const NONE_VALUE = '__none__';

type HardwareItem = {
  id: string;
  brand?: string;
  model?: string;
  resolution?: string;
  focal_length?: string;
  max_sensor_size?: string | null;
  type?: string;
  performance?: string;
  image_url?: string | null;
  front_view_url?: string | null;
  enabled?: boolean | null;
};

interface ModuleHardwareSelectionProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
  cameras: HardwareItem[];
  lenses: HardwareItem[];
  lights: HardwareItem[];
  controllers: HardwareItem[];
  workstationLayout?: unknown;
}

const kindMeta: Record<ModuleHardwareKind, { title: string; Icon: typeof Camera; emptyText: string; hint: string }> = {
  camera: { title: '相机', Icon: Camera, emptyText: '工位未配置相机', hint: '选择 CAM 槽位' },
  lens: { title: '镜头', Icon: Aperture, emptyText: '工位未配置镜头', hint: '选择 LENS 槽位' },
  light: { title: '光源', Icon: Lightbulb, emptyText: '工位未配置光源', hint: '选择 LIGHT 槽位' },
  controller: { title: '工控机', Icon: Cpu, emptyText: '工位未配置工控机', hint: '选择 IPC' },
};

function getSubtitle(kind: ModuleHardwareKind, item: HardwareItem) {
  if (kind === 'camera') return item.resolution || '';
  if (kind === 'lens') {
    return [item.focal_length, item.max_sensor_size ? `靶面 ${item.max_sensor_size}` : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (kind === 'light') return item.type || '';
  return item.performance || '';
}

function getHardwareImage(item: HardwareItem) {
  return item.front_view_url || item.image_url || '';
}

function HardwareOptionContent({
  label,
  subtitle,
  imageUrl,
}: {
  label: string;
  subtitle?: string;
  imageUrl?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {imageUrl ? (
        <img src={imageUrl} alt={label} className="h-7 w-7 shrink-0 rounded border bg-muted object-contain" />
      ) : (
        <div className="h-7 w-7 shrink-0 rounded border bg-muted" />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm">{label}</div>
        {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

function HardwareSlotSelect({
  kind,
  label,
  value,
  options,
  libraryItems,
  workstationLayout,
  onChange,
}: {
  kind: ModuleHardwareKind;
  label?: string;
  value: string;
  options: ModuleHardwareSlot<HardwareItem>[];
  libraryItems: HardwareItem[];
  workstationLayout?: unknown;
  onChange: (value: string) => void;
}) {
  const meta = kindMeta[kind];
  const normalizedValue = normalizeModuleHardwareSelection(value, workstationLayout, kind);
  const resolved = resolveModuleHardwareSelection(value, workstationLayout, kind, libraryItems);
  const hasNormalizedOption = options.some(option => option.value === normalizedValue);
  const selectValue = hasNormalizedOption
    ? normalizedValue
    : NONE_VALUE;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        <meta.Icon className="h-3.5 w-3.5 text-primary" />
        {label || meta.title}
      </Label>
      <Select
        value={selectValue}
        onValueChange={(nextValue) => {
          if (nextValue === NONE_VALUE) {
            onChange('');
            return;
          }

          onChange(nextValue);
        }}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder={meta.hint} />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={NONE_VALUE}>不指定</SelectItem>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              <HardwareOptionContent
                label={option.displayName}
                subtitle={getSubtitle(kind, option.item)}
                imageUrl={getHardwareImage(option.item)}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="min-h-4 text-[11px] text-muted-foreground">
        {resolved
          ? `${resolved.slotLabel} 复用 · ${getSubtitle(kind, resolved.item) || '已选择'}`
          : meta.emptyText}
      </div>
    </div>
  );
}

export function ModuleHardwareSelection({
  form,
  setForm,
  cameras,
  lenses,
  lights,
  controllers,
  workstationLayout,
}: ModuleHardwareSelectionProps) {
  const cameraSlots = useMemo(
    () => getModuleHardwareSlots<HardwareItem>(workstationLayout, 'camera', cameras),
    [workstationLayout, cameras],
  );
  const lensSlots = useMemo(
    () => getModuleHardwareSlots<HardwareItem>(workstationLayout, 'lens', lenses),
    [workstationLayout, lenses],
  );
  const lightSlots = useMemo(
    () => getModuleHardwareSlots<HardwareItem>(workstationLayout, 'light', lights),
    [workstationLayout, lights],
  );
  const controllerSlots = useMemo(
    () => getModuleHardwareSlots<HardwareItem>(workstationLayout, 'controller', controllers),
    [workstationLayout, controllers],
  );

  const hasStationHardware = cameraSlots.length > 0
    || lensSlots.length > 0
    || lightSlots.length > 0
    || controllerSlots.length > 0;

  const applyLightItems = (prev: ModuleFormState, lightItems: ModuleLightItem[]): ModuleFormState => {
    const first = lightItems[0];
    return {
      ...prev,
      lightItems,
      selectedLight: first?.selectedLight || '',
      lightMode: first?.lightMode || '',
      lightAngle: first?.lightAngle || '',
      lightDistance: first?.lightDistance || '',
      lightDistanceHorizontal: first?.lightDistanceHorizontal || '',
      lightDistanceVertical: first?.lightDistanceVertical || '',
      lightNote: first?.lightNote || '',
      lightCount: lightItems.length ? String(lightItems.length) : '',
    };
  };

  const updateLightItem = (id: string, patch: Partial<ModuleLightItem>) => {
    setForm(prev => {
      const nextItems = prev.lightItems.map(item => item.id === id ? { ...item, ...patch } : item);
      return applyLightItems(prev, nextItems);
    });
  };

  const addLightItem = () => {
    setForm(prev => {
      const used = new Set(prev.lightItems.map(item => item.selectedLight).filter(Boolean));
      const nextSlot = lightSlots.find(slot => !used.has(slot.value));
      const nextItems = [...prev.lightItems, createModuleLightItem({ selectedLight: nextSlot?.value || '' })];
      return applyLightItems(prev, nextItems);
    });
  };

  const removeLightItem = (id: string) => {
    setForm(prev => applyLightItems(prev, prev.lightItems.filter(item => item.id !== id)));
  };

  const applyLensAutoFill = (state: ModuleFormState, selectedLens: string): ModuleFormState => {
    if (!selectedLens) return { ...state, selectedLens };
    const resolved = resolveModuleHardwareSelection(selectedLens, workstationLayout, 'lens', lenses);
    const autoFill = getLensImagingAutoFill(resolved?.item);
    return {
      ...state,
      selectedLens,
      lensAperture: autoFill.lensAperture || state.lensAperture,
      depthOfField: autoFill.depthOfField || state.depthOfField,
    };
  };

  const handleInheritHardware = () => {
    const inheritedLights = lightSlots.length > 0
      ? [createModuleLightItem({ selectedLight: lightSlots[0].value })]
      : [];
    setForm(prev => {
      const selectedLens = prev.is3DCamera ? '' : lensSlots[0]?.value || prev.selectedLens;
      const next = {
        ...applyLightItems(prev, inheritedLights),
        selectedCamera: cameraSlots[0]?.value || prev.selectedCamera,
        selectedController: controllerSlots[0]?.value || prev.selectedController,
      };
      return applyLensAutoFill(next, selectedLens);
    });

    if (hasStationHardware) {
      toast.success('已套用工位硬件槽位');
    } else {
      toast.warning('该工位还没有配置可复用硬件');
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">硬件选型</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            引用工位硬件槽位
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 text-xs"
          onClick={handleInheritHardware}
        >
          <Copy className="h-3 w-3" />
          套用工位槽位
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <HardwareSlotSelect
          kind="camera"
          value={form.selectedCamera}
          options={cameraSlots}
          libraryItems={cameras}
          workstationLayout={workstationLayout}
          onChange={(selectedCamera) => setForm(prev => ({ ...prev, selectedCamera }))}
        />
        {form.is3DCamera ? (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Aperture className="h-3.5 w-3.5 text-muted-foreground" />
              镜头
            </Label>
            <div className="h-9 flex items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
              3D相机无需镜头
            </div>
            <div className="min-h-4 text-[11px] text-muted-foreground">已自动跳过镜头配置</div>
          </div>
        ) : (
          <HardwareSlotSelect
            kind="lens"
            value={form.selectedLens}
            options={lensSlots}
            libraryItems={lenses}
            workstationLayout={workstationLayout}
            onChange={(selectedLens) => setForm(prev => applyLensAutoFill(prev, selectedLens))}
          />
        )}
        <HardwareSlotSelect
          kind="controller"
          value={form.selectedController}
          options={controllerSlots}
          libraryItems={controllers}
          workstationLayout={workstationLayout}
          onChange={(selectedController) => setForm(prev => ({ ...prev, selectedController }))}
        />
      </div>

      <div className="space-y-2 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              光源型号
            </Label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              每行对应一个模块光源，只能复用工位 LIGHT 槽位
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={addLightItem}>
            <Plus className="h-3.5 w-3.5" />
            添加光源
          </Button>
        </div>

        {form.lightItems.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
            暂未配置模块光源。点击“添加光源”后可选择工位 LIGHT 槽位。
          </div>
        ) : (
          <div className="space-y-2">
            {form.lightItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-md border bg-background/40 p-2">
                <HardwareSlotSelect
                  kind="light"
                  label={`LIGHT${index + 1}`}
                  value={item.selectedLight}
                  options={lightSlots}
                  libraryItems={lights}
                  workstationLayout={workstationLayout}
                  onChange={(selectedLight) => updateLightItem(item.id, { selectedLight })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-4 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLightItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
