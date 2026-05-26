import { describe, expect, it } from 'vitest';
import {
  getModuleHardwareSlots,
  normalizeModuleHardwareSelection,
  resolveModuleHardwareSelection,
} from './moduleHardwareSlots';

const layout = {
  selected_cameras: [
    { id: 'camera-a', brand: 'Basler', model: 'acA2500' },
    { id: 'camera-b', brand: 'Hikvision', model: 'MV-CA' },
  ],
  selected_lenses: [
    { id: 'lens-a', brand: 'Computar', model: 'M1214' },
  ],
  selected_lights: [
    null,
    { id: 'light-a', brand: 'CCS', model: 'HLDR2' },
  ],
  selected_controller: { id: 'ipc-a', brand: 'Advantech', model: 'MIC-770' },
};

describe('module hardware slot helpers', () => {
  it('builds stable workstation slot references', () => {
    expect(getModuleHardwareSlots(layout, 'camera').map(slot => [slot.value, slot.slotLabel, slot.hardwareId])).toEqual([
      ['cam_1', 'CAM1', 'camera-a'],
      ['cam_2', 'CAM2', 'camera-b'],
    ]);
    expect(getModuleHardwareSlots(layout, 'lens')[0].value).toBe('lens_1');
    expect(getModuleHardwareSlots(layout, 'light')[0].value).toBe('light_1');
    expect(getModuleHardwareSlots(layout, 'controller')[0].value).toBe('ipc_1');
  });

  it('normalizes legacy hardware ids to slot references', () => {
    expect(normalizeModuleHardwareSelection('camera-b', layout, 'camera')).toBe('cam_2');
    expect(normalizeModuleHardwareSelection('unknown-camera', layout, 'camera')).toBe('');
    expect(normalizeModuleHardwareSelection('', layout, 'camera')).toBe('');
  });

  it('resolves slot references to full library hardware', () => {
    const resolved = resolveModuleHardwareSelection('cam_1', layout, 'camera', [
      { id: 'camera-a', brand: 'Basler', model: 'acA2500', resolution: '2592x1944' },
    ]);

    expect(resolved?.slotLabel).toBe('CAM1');
    expect(resolved?.hardwareId).toBe('camera-a');
    expect(resolved?.item.resolution).toBe('2592x1944');
  });

  it('does not resolve direct library hardware outside the workstation slots', () => {
    const resolved = resolveModuleHardwareSelection('camera-x', layout, 'camera', [
      { id: 'camera-x', brand: 'Basler', model: 'Not In Station' },
    ]);

    expect(resolved).toBeNull();
  });

  it('fills image fields from the current hardware library for slot options', () => {
    const slots = getModuleHardwareSlots(layout, 'camera', [
      {
        id: 'camera-a',
        brand: 'Basler',
        model: 'acA2500',
        image_url: 'https://example.com/camera-a.png',
        front_view_url: 'https://example.com/camera-a-front.png',
        top_view_url: 'https://example.com/camera-a-top.png',
        model_3d_url: 'https://example.com/camera-a.glb',
      },
    ]);

    expect(slots[0].item.image_url).toBe('https://example.com/camera-a.png');
    expect(slots[0].item.front_view_url).toBe('https://example.com/camera-a-front.png');
    expect(slots[0].item.top_view_url).toBe('https://example.com/camera-a-top.png');
    expect(slots[0].item.model_3d_url).toBe('https://example.com/camera-a.glb');
  });

  it('supports legacy text controller ids as IPC slot references', () => {
    const slots = getModuleHardwareSlots({ selected_controller: 'ipc-a' }, 'controller', [
      { id: 'ipc-a', brand: 'Advantech', model: 'MIC-770', image_url: 'https://example.com/ipc.png' },
    ]);

    expect(slots).toHaveLength(1);
    expect(slots[0].value).toBe('ipc_1');
    expect(slots[0].hardwareId).toBe('ipc-a');
    expect(slots[0].item.model).toBe('MIC-770');
    expect(normalizeModuleHardwareSelection('ipc-a', { selected_controller: 'ipc-a' }, 'controller')).toBe('ipc_1');
  });
});
