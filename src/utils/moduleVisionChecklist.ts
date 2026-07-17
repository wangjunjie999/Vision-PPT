import { resolveModuleHardwareSelection } from './moduleHardwareSlots';
import { formatCameraTaktTime } from './cameraTaktTime';
import {
  getActiveModuleConfig,
  getObjectRecord,
  normalizeTwoDCameraType,
  type TwoDCameraType,
} from './moduleConfig';
import { normalizeDistanceUnit, toMillimeters, type DistanceUnit } from './distanceUnits';

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
  cameraType: '3d' | TwoDCameraType;
  detectionMethod: string;
  fieldOfView: string;
  pixelAccuracy: string;
  cameraInstall: string;
  shotCount: string;
  taktTime: string;
  scanSpeed: string;
}

export interface ModuleVisionChecklistTemplateFields {
  mod_detection_method: string;
  mod_field_of_view: string;
  mod_pixel_accuracy: string;
  mod_camera_install: string;
  mod_shot_count: string;
  mod_takt_time: string;
  mod_scan_speed: string;
  mod_vision_checklist: string;
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
const TAKT_RANGE_RE = /\d+(?:\.\d+)?\s*(?:~|～|至|–|—|-)\s*\d+(?:\.\d+)?/;
const TAKT_UNIT_RE = /(s\s*\/\s*pcs|s\s*\/\s*pc|秒\s*\/\s*件|秒|s\s*\/\s*次)$/i;

export function buildModuleVisionChecklist(input: ModuleVisionChecklistInput): ModuleVisionChecklist {
  const language = input.language ?? 'zh';
  const config = getModuleConfig(input.module);
  const imaging = getObject(config?.imaging);
  const is3DCamera = toBoolean(imaging?.is3DCamera);
  const twoDCameraType = normalizeTwoDCameraType(imaging?.twoDCameraType);
  const cameraType: ModuleVisionChecklist['cameraType'] = is3DCamera ? '3d' : twoDCameraType;
  const isLineScan = cameraType === 'line_scan';
  const lineScan = getObject(imaging?.lineScan);
  const distanceUnit = normalizeDistanceUnit(imaging?.distanceUnit);
  const cameraCount = getModuleCameraCount(input.module, config);
  const selectedCamera = getSelectedCamera(input);

  const detectionMethod = isLineScan
    ? `${language === 'zh' ? '2D线扫相机' : '2D Line Scan Camera'}*${cameraCount}`
    : `${is3DCamera ? '3D' : '2D'}*${cameraCount}`;
  const fieldOfViewRaw = isLineScan
    ? firstPresent(lineScan?.fieldOfView)
    : firstPresent(
      joinFov(imaging?.fieldOfViewWidth, imaging?.fieldOfViewHeight),
      imaging?.fieldOfView,
      config?.fieldOfView,
      config?.fieldOfViewCommon,
      config?.measurementFieldOfView,
      config?.ocrCameraFieldOfView,
      config?.dlFieldOfView,
    );
  const fieldOfView = formatFieldOfView(fieldOfViewRaw, isLineScan ? distanceUnit : 'mm');

  const explicitPixelAccuracy = isLineScan
    ? firstPresent(lineScan?.resolutionPerPixel)
    : firstPresent(imaging?.resolutionPerPixel, config?.resolutionPerPixel);
  const pixelAccuracy = formatPixelAccuracy(explicitPixelAccuracy, isLineScan)
    || calculatePixelAccuracy(
      fieldOfViewRaw ?? fieldOfView,
      selectedCamera?.resolution,
      isLineScan,
      distanceUnit,
    )
    || '-';

  const cameraInstall = firstPresent(
    imaging?.cameraInstallNote,
    config?.cameraInstallNote,
    input.layout?.layout_description,
    input.layout?.camera_mounts_labels,
    formatCameraMounts(input.layout?.camera_mounts, language),
  ) || '-';

  const shotCountValue = firstPresent(
    config?.shotCount,
    config?.shot_count,
    input.workstation?.shot_count,
    cameraCount,
  );
  const taktValue = firstPresent(
    config?.cameraTaktTime,
    config?.taktTime,
    config?.cycleTime,
    input.workstation?.acceptance_criteria?.cycle_time,
    input.workstation?.cycle_time,
    input.module.processing_time_limit ? input.module.processing_time_limit / 1000 : undefined,
  );

  return {
    cameraType,
    detectionMethod,
    fieldOfView,
    pixelAccuracy,
    cameraInstall: String(cameraInstall),
    shotCount: formatShotCount(shotCountValue, language),
    taktTime: formatTaktTime(taktValue, language),
    scanSpeed: isLineScan ? formatScanSpeed(lineScan?.scanSpeed) : '',
  };
}

export function buildModuleVisionChecklistLines(
  checklist: ModuleVisionChecklist,
  language: Language = 'zh'
): string[] {
  const isZh = language === 'zh';
  const commonRows = [
    `1. ${isZh ? '检测方式' : 'Detection Method'}: ${checklist.detectionMethod}`,
    `2. ${isZh ? '视野范围' : 'FOV'}: ${checklist.fieldOfView}`,
    `3. ${isZh ? '像素精度' : 'Pixel Accuracy'}: ${checklist.pixelAccuracy}`,
    `4. ${isZh ? '相机安装' : 'Camera Mount'}: ${checklist.cameraInstall}`,
  ];

  if (checklist.cameraType === 'line_scan') {
    return [
      ...commonRows,
      `5. ${isZh ? '扫描速度' : 'Scan Speed'}: ${checklist.scanSpeed}`,
    ];
  }

  return [
    ...commonRows,
    `5. ${isZh ? '拍照次数' : 'Shot Count'}: ${checklist.shotCount}`,
    `6. ${isZh ? '节拍' : 'Takt'}: ${checklist.taktTime}`,
  ];
}

export function buildModuleVisionChecklistTemplateFields(
  input: ModuleVisionChecklistInput
): ModuleVisionChecklistTemplateFields {
  const checklist = buildModuleVisionChecklist(input);
  const isLineScan = checklist.cameraType === 'line_scan';
  return {
    mod_detection_method: checklist.detectionMethod,
    mod_field_of_view: checklist.fieldOfView,
    mod_pixel_accuracy: checklist.pixelAccuracy,
    mod_camera_install: checklist.cameraInstall,
    mod_shot_count: isLineScan ? '' : checklist.shotCount,
    mod_takt_time: isLineScan ? '' : checklist.taktTime,
    mod_scan_speed: isLineScan ? checklist.scanSpeed : '',
    mod_vision_checklist: buildModuleVisionChecklistLines(checklist, input.language ?? 'zh').join('\n'),
  };
}

function getModuleConfig(module: VisionChecklistModule): Record<string, unknown> | null {
  return getActiveModuleConfig(module);
}

function getObject(value: unknown): Record<string, unknown> | null {
  return getObjectRecord(value);
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

function formatFieldOfView(value: unknown, unit: DistanceUnit = 'mm'): string {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  const text = String(value)
    .trim()
    .replace(/[×xX]/g, '*')
    .replace(/\s*(?:mm|cm|m)\b/gi, '')
    .replace(/\s+/g, '');
  if (!text) return '-';
  return `${text}${unit}`;
}

function formatPixelAccuracy(value: unknown, preserveLineScanPrecision = false): string {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const text = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/px/gi, 'pixel');
  if (/mm\/pixel$/i.test(text)) return text.replace(/mm\/pixel$/i, 'mm/pixel');
  const parsed = parsePositiveNumber(text);
  return parsed
    ? `${formatNumber(parsed, preserveLineScanPrecision || parsed < 0.01 ? 4 : 2)}mm/pixel`
    : text;
}

function calculatePixelAccuracy(
  fieldOfView: unknown,
  cameraResolution: unknown,
  useLongResolutionAxis = false,
  fieldOfViewUnit: DistanceUnit = 'mm',
): string {
  const fovWidth = useLongResolutionAxis
    ? toMillimeters(fieldOfView, fieldOfViewUnit)
    : parseFirstNumber(fieldOfView);
  const resolutionWidth = useLongResolutionAxis
    ? parseLargestNumber(cameraResolution)
    : parseFirstNumber(cameraResolution);
  if (!fovWidth || !resolutionWidth) return '';
  const value = fovWidth / resolutionWidth;
  if (!Number.isFinite(value) || value <= 0) return '';
  return `${formatNumber(value, useLongResolutionAxis || value < 0.01 ? 4 : 2)}mm/pixel`;
}

function formatScanSpeed(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  const text = String(value).trim();
  const parsed = parsePositiveNumber(text);
  if (!parsed) return text;
  return `${formatNumber(parsed, 3)}mm/s`;
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
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (text && (TAKT_RANGE_RE.test(text) || TAKT_UNIT_RE.test(text))) {
    return formatCameraTaktTime(text, language === 'zh' ? '待定' : 'TBD');
  }

  const seconds = parsePositiveNumber(value);
  if (seconds) {
    return formatCameraTaktTime(formatNumber(seconds, 3), language === 'zh' ? '待定' : 'TBD');
  }
  return formatCameraTaktTime(text, language === 'zh' ? '待定' : 'TBD');
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

function parseLargestNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const values = [...String(value).matchAll(/\d+(?:\.\d+)?/g)]
    .map(match => Number(match[0]))
    .filter(Number.isFinite);
  return values.length > 0 ? Math.max(...values) : null;
}

function formatNumber(value: number, decimals: number): string {
  return Number(value.toFixed(decimals)).toString();
}
