import { safeController, safeHardwareArray } from '@/utils/safeDataAccess';
import { resolveHardwareImageUrl } from '@/utils/hardwareImageUrls';

export type ModuleHardwareKind = 'camera' | 'lens' | 'light' | 'controller';

type HardwareLike = {
  id: string;
  brand?: string;
  model?: string;
  [key: string]: unknown;
};

export interface ModuleHardwareSlot<T extends HardwareLike = HardwareLike> {
  value: string;
  slotLabel: string;
  item: T;
  hardwareId: string;
  displayName: string;
}

export interface ResolvedModuleHardware<T extends HardwareLike = HardwareLike> {
  value: string;
  slotLabel?: string;
  hardwareId: string;
  item: T;
  displayName: string;
}

const SLOT_PREFIX: Record<ModuleHardwareKind, string> = {
  camera: 'cam',
  lens: 'lens',
  light: 'light',
  controller: 'ipc',
};

const SLOT_LABEL: Record<ModuleHardwareKind, string> = {
  camera: 'CAM',
  lens: 'LENS',
  light: 'LIGHT',
  controller: 'IPC',
};

const LAYOUT_FIELD: Record<Exclude<ModuleHardwareKind, 'controller'>, string> = {
  camera: 'selected_cameras',
  lens: 'selected_lenses',
  light: 'selected_lights',
};

function getName(item: HardwareLike) {
  return `${item.brand || ''} ${item.model || ''}`.trim() || item.id;
}

function mergeHardwareItem<T extends HardwareLike>(item: T, libraryItems: T[] = []) {
  const latest = libraryItems.find(candidate => candidate.id === item.id);
  const merged = latest ? { ...item, ...latest } as T : { ...item } as T;

  (['image_url', 'front_view_url', 'top_view_url', 'model_3d_url'] as const).forEach(field => {
    const value = merged[field];
    if (typeof value === 'string') {
      (merged as Record<string, unknown>)[field] = resolveHardwareImageUrl(value);
    }
  });

  return merged;
}

export function getModuleHardwareSlotValue(kind: ModuleHardwareKind, index: number) {
  return `${SLOT_PREFIX[kind]}_${index + 1}`;
}

export function isModuleHardwareSlotRef(value: string | null | undefined, kind?: ModuleHardwareKind) {
  if (!value) return false;
  const prefixes = kind ? [SLOT_PREFIX[kind]] : Object.values(SLOT_PREFIX);
  return prefixes.some(prefix => new RegExp(`^${prefix}_\\d+$`, 'i').test(value));
}

export function getModuleHardwareSlots<T extends HardwareLike>(
  layout: unknown,
  kind: ModuleHardwareKind,
  libraryItems: T[] = [],
): ModuleHardwareSlot<T>[] {
  const source = layout as Record<string, unknown> | null | undefined;
  if (!source) return [];

  if (kind === 'controller') {
    const controller = safeController<T>(source.selected_controller);
    if (!controller?.id) return [];
    const item = mergeHardwareItem(controller, libraryItems);
    const slotLabel = SLOT_LABEL.controller;
    return [{
      value: getModuleHardwareSlotValue('controller', 0),
      slotLabel,
      item,
      hardwareId: item.id,
      displayName: `${slotLabel} · ${getName(item)}`,
    }];
  }

  const items = safeHardwareArray<T>(source[LAYOUT_FIELD[kind]]);
  return items.map((item, index) => {
    const merged = mergeHardwareItem(item, libraryItems);
    const slotLabel = `${SLOT_LABEL[kind]}${index + 1}`;
    return {
      value: getModuleHardwareSlotValue(kind, index),
      slotLabel,
      item: merged,
      hardwareId: merged.id,
      displayName: `${slotLabel} · ${getName(merged)}`,
    };
  });
}

export function normalizeModuleHardwareSelection(
  value: string | null | undefined,
  layout: unknown,
  kind: ModuleHardwareKind,
) {
  if (!value) return '';
  const slots = getModuleHardwareSlots(layout, kind);
  const bySlot = slots.find(slot => slot.value.toLowerCase() === value.toLowerCase());
  if (bySlot) return bySlot.value;

  const byHardwareId = slots.find(slot => slot.hardwareId === value);
  return byHardwareId?.value || '';
}

export function resolveModuleHardwareSelection<T extends HardwareLike>(
  value: string | null | undefined,
  layout: unknown,
  kind: ModuleHardwareKind,
  libraryItems: T[] = [],
): ResolvedModuleHardware<T> | null {
  if (!value) return null;

  const slots = getModuleHardwareSlots<T>(layout, kind, libraryItems);
  const slot = slots.find(item => item.value.toLowerCase() === value.toLowerCase())
    || slots.find(item => item.hardwareId === value);

  if (slot) {
    return {
      value: slot.value,
      slotLabel: slot.slotLabel,
      hardwareId: slot.hardwareId,
      item: slot.item,
      displayName: `${slot.slotLabel} · ${getName(slot.item)}`,
    };
  }

  return null;
}
