import { resolveModuleHardwareSelection } from './moduleHardwareSlots';

type Language = 'zh' | 'en';

export interface VisionChecklistCamera {
  id?: string | null;
  brand?: string | null;
  model?: string | null;
  resolution?: string | null;
  specs?: Record<string, string> | null;
}

export interface VisionChecklistModule {
  id?: string;
  type?: string | null;
  selected_camera?: string | null;
  selected_camera_info?: VisionChecklistCamera | null;
  processing_time_limit?: number | null;
  defect_config?: Record<string, unknown> | null;
  positioning_config?: Record<string, unknown> | null;
  ocr_config?: Record<string, unknown> | null;
  deep_learning_config?: Record<string, unknown> | null;
  measurement_config?: Record<string, unknown> | null;
}

export interface VisionChecklistWorkstation {
  cycle_time?: number | string | null;
  shot_count?: number | string | null;
  acceptance_criteria?: { cycle_time?: string | null } | null;
}

export interface VisionChecklistLayout {
  camera_count?: number | null;
  camera_mounts?: unknown;
  camera_mounts_labels?: string | null;
  layout_description?: string | null;
  selected_cameras?: VisionChecklistCamera[] | null;
}

export interface VisionChecklistHardware {
  cameras?: VisionChecklistCamera[] | null;
}

export interface ModuleVisionChecklistInput {
  module: VisionChecklistModule;
  workstation?: VisionChecklistWorkstation | null;
  layout?: VisionChecklistLayout | null;
  hardware?: VisionChecklistHardware | null;
  language?: Language;
}

export interface ModuleVisionChecklist {
  detectionMethod: string;
  fieldOfView: string;
  pixelAccuracy: string;
  cameraInstall: string;
  shotCount: string;
  taktTime: string;
}

export interface ModuleVisionChecklistTemplateFields {
  mod_detection_method: string;
  mod_field_of_view: string;
  mod_pixel_accuracy: string;
  mod_camera_install: string;
  mod_shot_count: string;
  mod_takt_time: string;
}

const CAMERA_MOUNT_LABELS: Record<string, { zh: string; en: string }> = {
  top: { zh: '顶部安装', en: 'Top Mount' },
  side: { zh: '侧面安装', en: 'Side Mount' },
  bottom: { zh: '底部安装', en: 'Bottom Mount' },
  front: { zh: '正面安装', en: 'Front Mount' },
  back: { zh: '背面安装', en: 'Back Mount' },
  angle: { zh: '斜角安装', en: 'Angle Mount' },
  '45deg': { zh: '45°安装', en: '45° Mount' },
  overhead: { zh: '顶置安装', en: 'Overhead' },
};

export function buildModuleVisionChecklist(input: ModuleVisionChecklistInput): ModuleVisionChecklist {
  const language = input.language ?? 'zh';
  const config = getModuleConfig(input.module);
  const imaging = getObject(config?.imaging);
  const cameraCount = getModuleCameraCount(input.module, config);
  const selectedCamera = getSelectedCamera(input);

  const detectionMethod = `${toBoolean(imaging?.is3DCamera) ? '3D' : '2D'}*${cameraCount}`;
  const fieldOfViewRaw = firstPresent(
    joinFov(imaging?.fieldOfViewWidth, imaging?.fieldOfViewHeight),
    imaging?.fieldOfView,
    config?.fieldOfView,
    config?.fieldOfViewCommon,
    config?.measurementFieldOfView,
    config?.ocrCameraFieldOfView,
    config?.dlFieldOfView,
  );
  const fieldOfView = formatFieldOfView(fieldOfViewRaw);

  const explicitPixelAccuracy = firstPresent(imaging?.resolutionPerPixel, config?.resolutionPerPixel);
  const pixelAccuracy = formatPixelAccuracy(explicitPixelAccuracy)
    || calculatePixelAccuracy(fieldOfViewRaw ?? fieldOfView, selectedCamera?.resolution)
    || '-';

  const cameraInstall = firstPresent(
    imaging?.cameraInstallNote,
    config?.cameraInstallNote,
    input.layout?.layout_description,
    input.layout?.camera_mounts_labels,
    formatCameraMounts(input.layout?.camera_mounts, language),
  ) || '-';

  const shotCountValue = firstPresent(
    input.workstation?.shot_count,
    config?.shotCount,
    config?.shot_count,
    cameraCount,
  );
  const taktValue = firstPresent(
    input.workstation?.cycle_time,
    input.workstation?.acceptance_criteria?.cycle_time,
    config?.taktTime,
    config?.cycleTime,
    input.module.processing_time_limit ? input.module.processing_time_limit / 1000 : undefined,
  );

  return {
    detectionMethod,
    fieldOfView,
    pixelAccuracy,
    cameraInstall: String(cameraInstall),
    shotCount: formatShotCount(shotCountValue, language),
    taktTime: formatTaktTime(taktValue, language),
  };
}

export function buildModuleVisionChecklistTemplateFields(
  input: ModuleVisionChecklistInput
): ModuleVisionChecklistTemplateFields {
  const checklist = buildModuleVisionChecklist(input);
  return {
    mod_detection_method: checklist.detectionMethod,
    mod_field_of_view: checklist.fieldOfView,
    mod_pixel_accuracy: checklist.pixelAccuracy,
    mod_camera_install: checklist.cameraInstall,
    mod_shot_count: checklist.shotCount,
    mod_takt_time: checklist.taktTime,
  };
}

function getModuleConfig(module: VisionChecklistModule): Record<string, unknown> | null {
  return module.defect_config
    || module.measurement_config
    || module.positioning_config
    || module.ocr_config
    || module.deep_learning_config
    || null;
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstPresent(...values: unknown[]): string | number | boolean | undefined {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value as string | number | boolean;
  }
  return undefined;
}

function joinFov(width: unknown, height: unknown): string | undefined {
  const w = firstPresent(width);
  const h = firstPresent(height);
  return w !== undefined && h !== undefined ? `${w}*${h}` : undefined;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  return Boolean(value);
}

function getModuleCameraCount(module: VisionChecklistModule, config: Record<string, unknown> | null): number {
  const count = parsePositiveNumber(
    firstPresent(config?.cameraCount, config?.defectCameraCount, config?.camera_count)
  );
  if (count) return Math.max(1, Math.round(count));
  return module.selected_camera || module.selected_camera_info ? 1 : 1;
}

function formatFieldOfView(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  const text = String(value)
    .trim()
    .replace(/[×xX]/g, '*')
    .replace(/\s*mm\b/gi, '')
    .replace(/\s+/g, '');
  if (!text) return '-';
  return `${text}mm`;
}

function formatPixelAccuracy(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const text = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/px/gi, 'pixel');
  if (/mm\/pixel$/i.test(text)) return text.replace(/mm\/pixel$/i, 'mm/pixel');
  const parsed = parsePositiveNumber(text);
  return parsed ? `${formatNumber(parsed, parsed < 0.01 ? 4 : 3)}mm/pixel` : text;
}

function calculatePixelAccuracy(fieldOfView: unknown, cameraResolution: unknown): string {
  const fovWidth = parseFirstNumber(fieldOfView);
  const resolutionWidth = parseFirstNumber(cameraResolution);
  if (!fovWidth || !resolutionWidth) return '';
  const value = fovWidth / resolutionWidth;
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${formatNumber(value, value < 0.01 ? 4 : 2)}mm/pixel`;
}

function getSelectedCamera(input: ModuleVisionChecklistInput): VisionChecklistCamera | null {
  const explicit = getObject(input.module.selected_camera_info) as VisionChecklistCamera | null;
  if (explicit?.resolution) return explicit;
  if (explicit?.specs?.resolution) return { ...explicit, resolution: explicit.specs.resolution };

  const cameras = input.hardware?.cameras || [];
  const selectedCamera = input.module.selected_camera || '';
  if (selectedCamera) {
    const resolved = resolveModuleHardwareSelection(
      selectedCamera,
      input.layout,
      'camera',
      cameras.filter((camera): camera is VisionChecklistCamera & { id: string } => Boolean(camera.id))
    );
    if (resolved?.item) return resolved.item;

    const direct = cameras.find(camera => camera.id === selectedCamera);
    if (direct) return direct;
  }

  const selectedCameras = Array.isArray(input.layout?.selected_cameras) ? input.layout?.selected_cameras || [] : [];
  if (selectedCameras.length === 1) {
    const layoutCamera = selectedCameras[0];
    return cameras.find(camera => camera.id === layoutCamera.id) || layoutCamera;
  }

  return null;
}

function formatCameraMounts(value: unknown, language: Language): string {
  const mounts = Array.isArray(value)
    ? value.map(String)
    : value && typeof value === 'object'
      ? Object.keys(value as Record<string, unknown>)
      : [];
  if (mounts.length === 0) return '';
  return mounts
    .map(mount => CAMERA_MOUNT_LABELS[mount]?.[language] || mount)
    .join('/');
}

function formatShotCount(value: unknown, language: Language): string {
  const count = parsePositiveNumber(value) || 1;
  const rounded = Math.max(1, Math.round(count));
  return language === 'zh' ? `${rounded}次` : `${rounded} shot${rounded === 1 ? '' : 's'}`;
}

function formatTaktTime(value: unknown, language: Language): string {
  const seconds = parsePositiveNumber(value);
  if (seconds) {
    return language === 'zh' ? `${formatNumber(seconds, 3)}S/次` : `${formatNumber(seconds, 3)}s/shot`;
  }
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || (language === 'zh' ? '待定' : 'TBD');
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseFirstNumber(value);
  return parsed && parsed > 0 ? parsed : null;
}

function parseFirstNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, decimals: number): string {
  return Number(value.toFixed(decimals)).toString();
}
