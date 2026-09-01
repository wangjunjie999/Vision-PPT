import { describe, expect, it } from 'vitest';
import { matchesHardwareSearch, type HardwareSearchType } from './hardwareSearch';

const camera = {
  id: 'internal-camera-id',
  brand: 'FLIR',
  model: 'BFS-PGE-50S5M',
  tags: ['高速', '高分辨率'],
  resolution: '2448×2048',
  frame_rate: 75,
  interface: 'GigE',
  sensor_size: '2/3"',
  shutter_type: 'Global',
  focal_length: null,
  aperture: null,
  pixel_size_um: 3.45,
  sensor_width_mm: 8.45,
  sensor_height_mm: 7.07,
  image_url: 'https://example.com/hidden-camera.png',
};

describe('matchesHardwareSearch', () => {
  it('matches common fields, tags, specs, and numbers without case sensitivity', () => {
    expect(matchesHardwareSearch(camera, 'cameras', 'flir')).toBe(true);
    expect(matchesHardwareSearch(camera, 'cameras', '高速')).toBe(true);
    expect(matchesHardwareSearch(camera, 'cameras', 'gige')).toBe(true);
    expect(matchesHardwareSearch(camera, 'cameras', '75')).toBe(true);
    expect(matchesHardwareSearch(camera, 'cameras', '3.45')).toBe(true);
  });

  it('requires every keyword and supports whitespace plus Chinese and English commas', () => {
    expect(matchesHardwareSearch(camera, 'cameras', 'FLIR 高速 75')).toBe(true);
    expect(matchesHardwareSearch(camera, 'cameras', 'FLIR,，  高分辨率，GigE')).toBe(true);
    expect(matchesHardwareSearch(camera, 'cameras', 'FLIR USB3')).toBe(false);
  });

  it.each<[HardwareSearchType, Record<string, unknown>, string]>([
    ['lenses', { brand: 'Kowa', model: 'LM25HC', tags: ['定焦'], focal_length: '25mm', aperture: 'F1.4', mount: 'C-Mount', max_sensor_size: '2/3"', resolving_power: 3.5 }, 'kowa 25mm c-mount 3.5'],
    ['lights', { brand: 'CCS', model: 'LDR2', tags: ['均匀照明'], type: '环形光源', color: '红色', power: '24V/12W' }, '环形 红色 均匀 12w'],
    ['controllers', { brand: 'Neousys', model: 'Nuvo', tags: ['GPU推理'], cpu: 'i9-9900K', gpu: 'RTX 3080', memory: '64GB', storage: '1TB NVMe', performance: 'ultra' }, 'gpu推理 RTX 64gb nvme'],
  ])('matches all configured %s specification fields', (type, item, query) => {
    expect(matchesHardwareSearch(item, type, query)).toBe(true);
  });

  it('returns all items for an empty query and ignores internal or asset fields', () => {
    expect(matchesHardwareSearch(camera, 'cameras', ' ， ,  ')).toBe(true);
    expect(matchesHardwareSearch(camera, 'cameras', 'internal-camera-id')).toBe(false);
    expect(matchesHardwareSearch(camera, 'cameras', 'hidden-camera.png')).toBe(false);
  });
});
