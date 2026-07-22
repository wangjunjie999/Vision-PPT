import JSZip from 'jszip';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { generateDOCX } from './docxGenerator';
import { generatePDF } from './pdfGenerator';

const project = {
  id: 'project-1',
  code: 'PRJ-001',
  name: 'Scope test',
  customer: 'Customer',
  date: '2026-07-20',
  responsible: 'Owner',
  product_process: null,
  quality_strategy: null,
  environment: null,
  notes: null,
};
const workstations = [{
  id: 'ws-1',
  code: 'WS-001',
  name: 'Station A',
  type: 'line',
  cycle_time: 1,
  product_dimensions: null,
  enclosed: false,
}];
const layouts = [{
  workstation_id: 'ws-1',
  conveyor_type: null,
  camera_count: 0,
  lens_count: 0,
  light_count: 0,
  camera_mounts: null,
  mechanisms: null,
  selected_cameras: null,
  selected_lenses: null,
  selected_lights: null,
  selected_controller: null,
}];
const modules = [{
  id: 'mod-2',
  name: 'Selected Module',
  type: 'defect',
  workstation_id: 'ws-1',
  trigger_type: 'io',
  roi_strategy: 'fixed',
  processing_time_limit: 50,
  output_types: ['result'],
  selected_camera: null,
  selected_lens: null,
  selected_light: null,
  selected_controller: null,
}];
const hardware = { cameras: [], lenses: [], lights: [], controllers: [] };

beforeAll(() => {
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X4f6WQAAAABJRU5ErkJggg==';
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    font: '',
    fillStyle: '',
    textBaseline: 'top',
    measureText: (text: string) => ({ width: Math.max(text.length * 8, 1) }),
    fillText: vi.fn(),
  }) as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(tinyPng);
});

describe('document generators in module scope', () => {
  it('Word contains the selected module and parent context but no workstation or hardware sections', async () => {
    const steps: string[] = [];
    const blob = await generateDOCX(
      project,
      workstations,
      layouts,
      modules,
      hardware,
      { language: 'en', includeImages: false, scope: 'modules' },
      (_progress, step) => steps.push(step),
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');

    expect(xml).toContain('Selected Module');
    expect(xml).toContain('Station A');
    expect(xml).not.toContain('Workstation Configuration');
    expect(xml).not.toContain('Hardware List');
    expect(steps).not.toContain('Generating workstation details');
    expect(steps).not.toContain('Generating hardware list');
  });

  it('PDF completes without workstation configuration or hardware stages', async () => {
    const steps: string[] = [];
    const blob = await generatePDF(
      project,
      workstations,
      layouts,
      modules,
      hardware,
      { language: 'en', includeImages: false, scope: 'modules' },
      (_progress, step) => steps.push(step),
    );

    expect(blob.size).toBeGreaterThan(0);
    expect(steps).toContain('Creating module details');
    expect(steps).not.toContain('Creating workstation configuration');
    expect(steps).not.toContain('Creating hardware list');
  });
});
