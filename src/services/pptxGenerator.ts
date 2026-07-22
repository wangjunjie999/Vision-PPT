import type PptxGenJS from 'pptxgenjs';
import { 
  fetchImageAsDataUri, 
  collectAllImageUrls, 
  preloadImagesInBatches 
} from './pptx/imagePreloader';
import {
  generateBasicInfoAndRequirementsSlide,
  generateProductSchematicSlide,
  generateLayoutAndOpticalSlide,
  generateModuleOpticalSlide,
  generateLightingPhotosSlide,
  getLightingPhotoSlideCount,
  generateBOMSlide,
} from './pptx/workstationSlides';
import {
  COLORS,
  SLIDE_LAYOUT,
  MODULE_TYPE_LABELS,
  WS_TYPE_LABELS,
  TRIGGER_LABELS,
  PROCESS_STAGE_LABELS,
  COMPANY_NAME_ZH,
  COMPANY_NAME_EN,
  FONTS,
  MASTER_SLIDE_SUBTITLE,
  MASTER_SLIDE_TITLE,
  createHeadingShadow,
  getWorkstationCode,
  getModuleDisplayName,
} from './pptx/slideLabels';
import { safeController, safeHardwareArray } from '@/utils/safeDataAccess';
import { formatDefectItems, normalizeDefectItemsFromConfig } from '@/utils/defectItems';
import { isModule3DCamera as isModule3DCameraWithLegacy } from '@/utils/module3DCamera';
import { formatWorkstationCycleTimePlain } from '@/utils/cycleTimeDisplay';

// Type definitions for pptxgenjs
type TableCell = { text: string; options?: Record<string, unknown> };
type TableRow = TableCell[];

// ==================== DATA INTERFACES ====================

interface RevisionHistoryItem {
  version: string;
  date: string;
  author: string;
  content: string;
}

interface AcceptanceCriteria {
  accuracy?: string;
  detection_content?: string;
  cycle_time?: string;
  compatible_sizes?: string;
}

interface ProjectData {
  id: string;
  code: string;
  name: string;
  customer: string;
  date: string | null;
  responsible: string | null;
  product_process: string | null;
  production_line?: string | null;
  description?: string | null;
  quality_strategy: string | null;
  environment: string[] | null;
  notes: string | null;
  revision_history?: RevisionHistoryItem[];
}

interface WorkstationData {
  id: string;
  code: string;
  name: string;
  type: string;
  design_responsible?: string | null;
  cycle_time: number | null;
  product_dimensions: { length: number; width: number; height: number } | null;
  enclosed: boolean | null;
  process_stage?: string | null;
  observation_target?: string | null;
  acceptance_criteria?: AcceptanceCriteria | null;
  motion_description?: string | null;
  shot_count?: number | null;
  risk_notes?: string | null;
  action_script?: string | null;
  notes?: string | null;
}

interface LayoutData {
  workstation_id: string;
  conveyor_type: string | null;
  camera_count: number | null;
  lens_count: number | null;
  light_count: number | null;
  camera_mounts: string[] | null;
  mechanisms: string[] | null;
  selected_cameras: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_lenses: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_lights: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_controller: { id: string; brand: string; model: string; image_url?: string | null } | null;
  front_view_image_url?: string | null;
  side_view_image_url?: string | null;
  top_view_image_url?: string | null;
  front_view_saved?: boolean | null;
  side_view_saved?: boolean | null;
  top_view_saved?: boolean | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
}

interface ModuleData {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  workstation_id: string;
  trigger_type: string | null;
  roi_strategy: string | null;
  processing_time_limit: number | null;
  output_types: string[] | null;
  selected_camera: string | null;
  selected_lens: string | null;
  selected_light: string | null;
  selected_controller: string | null;
  schematic_image_url?: string | null;
  positioning_config?: Record<string, unknown> | null;
  defect_config?: Record<string, unknown> | null;
  ocr_config?: Record<string, unknown> | null;
  deep_learning_config?: Record<string, unknown> | null;
  measurement_config?: Record<string, unknown> | null;
}

function isModule3DCameraForOutput(module: ModuleData, projectUses3D: boolean): boolean {
  return isModule3DCameraWithLegacy(module, projectUses3D);
}

interface HardwareData {
  cameras: Array<{
    id: string;
    brand: string;
    model: string;
    resolution: string;
    frame_rate: number;
    interface: string;
    sensor_size: string;
    image_url: string | null;
  }>;
  lenses: Array<{
    id: string;
    brand: string;
    model: string;
    focal_length: string;
    aperture: string;
    max_sensor_size?: string | null;
    mount: string;
    image_url: string | null;
  }>;
  lights: Array<{
    id: string;
    brand: string;
    model: string;
    type: string;
    color: string;
    power: string;
    image_url: string | null;
  }>;
  controllers: Array<{
    id: string;
    brand: string;
    model: string;
    cpu: string;
    gpu: string | null;
    memory: string;
    storage: string;
    performance: string;
    image_url: string | null;
  }>;
}

interface AnnotationItem {
  id: string;
  type: 'rect' | 'circle' | 'arrow' | 'text' | 'point' | 'number';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  color?: string;
  labelNumber?: number;
  label?: string;
  // New fields from AnnotationCanvas
  number?: number;
  name?: string;
  category?: string;
  description?: string;
}

interface AnnotationData {
  id: string;
  asset_id?: string;
  snapshot_url: string;
  annotations_json: AnnotationItem[];
  remark?: string | null;
  scope_type: 'workstation' | 'module';
  workstation_id?: string;
  module_id?: string;
}

interface ProductAssetData {
  id: string;
  workstation_id?: string | null;
  module_id?: string | null;
  scope_type: 'workstation' | 'module';
  preview_images: Array<{ url: string; name?: string }> | null;
  model_file_url?: string | null;
  detection_method?: string | null;
  product_models?: Array<{ name: string; spec: string }> | null;
  detection_requirements?: Array<{ content: string; highlight?: string | null }> | null;
  product_name?: string | null;
  product_code?: string | null;
  product_spec?: string | null;
  is_primary?: boolean;
  sort_order?: number;
  parent_product_id?: string | null;
}

interface ProductModelItem {
  name: string;
  spec: string;
}

interface DetectionRequirementItem {
  content: string;
  highlight?: string | null;
}

interface LogoInfo {
  data: string;
  width?: number;
  height?: number;
  position?: { x: number; y: number };
}

interface FooterInfo {
  hasPageNumber: boolean;
  hasDate: boolean;
  hasFooterText: boolean;
  footerText?: string;
}

interface ExtractedTemplateStyles {
  background?: { color?: string; data?: string };
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  fonts?: {
    title?: string;
    body?: string;
    titleEA?: string;
    bodyEA?: string;
  };
  logo?: LogoInfo;
  footer?: FooterInfo;
}

interface GenerationOptions {
  language: 'zh' | 'en';
  quality: 'standard' | 'high' | 'ultra';
  mode?: 'draft' | 'final';
  scope?: 'full' | 'workstations' | 'modules';
}

type ProgressCallback = (progress: number, step: string, log: string) => void;

interface ModuleTocEntry {
  index: number;
  workstationName: string;
  wsCode: string;
  moduleName: string;
  moduleType: string;
  targetSlideNumber: number;
}

const TOC_ITEMS_PER_PAGE = 14;
const TOC_ROWS_PER_COLUMN = 7;

function getPptxSlideCount(pptx: PptxGenJS): number {
  return Array.isArray((pptx as any)._slides) ? (pptx as any)._slides.length : 0;
}

function getProductSlideCount(isDraft: boolean, annotations: AnnotationData[]): number {
  if (isDraft) return 1;
  return Math.max(annotations.length, 1);
}

function getModuleTocPageCount(moduleCount: number): number {
  return Math.max(1, Math.ceil(moduleCount / TOC_ITEMS_PER_PAGE));
}

export function buildModuleTocEntries(
  projectCode: string,
  workstations: WorkstationData[],
  modules: ModuleData[],
  annotations: AnnotationData[] | undefined,
  firstWorkstationSlideNumber: number,
  isDraft: boolean
): ModuleTocEntry[] {
  const entries: ModuleTocEntry[] = [];
  let nextSlideNumber = firstWorkstationSlideNumber;

  for (let i = 0; i < workstations.length; i++) {
    const ws = workstations[i];
    const wsModules = modules.filter(m => m.workstation_id === ws.id);
    const wsCode = getWorkstationCode(projectCode, i, ws.code);
    const wsModuleIds = new Set(wsModules.map(m => m.id));
    const wsAnnotations = annotations?.filter(a =>
      (a.scope_type === 'workstation' && a.workstation_id === ws.id) ||
      (a.scope_type === 'module' && a.module_id && wsModuleIds.has(a.module_id))
    ) || [];

    nextSlideNumber += 1; // Basic info + requirements.
    nextSlideNumber += getProductSlideCount(isDraft, wsAnnotations);
    nextSlideNumber += 1; // Mechanical layout.

    for (const mod of wsModules) {
      entries.push({
        index: entries.length + 1,
        workstationName: ws.name,
        wsCode,
        moduleName: mod.name,
        moduleType: mod.type,
        targetSlideNumber: nextSlideNumber,
      });

      nextSlideNumber += 1; // Module optical page.
      if (!isDraft && Array.isArray((mod as any).lighting_photos)) {
        nextSlideNumber += getLightingPhotoSlideCount((mod as any).lighting_photos.length);
      }
    }

    nextSlideNumber += 1; // BOM.
  }

  return entries;
}

function generateModuleTocSlides(
  pptx: PptxGenJS,
  entries: ModuleTocEntry[],
  isZh: boolean
): void {
  const pages = Math.max(1, Math.ceil(entries.length / TOC_ITEMS_PER_PAGE));
  const st = MASTER_SLIDE_SUBTITLE;

  for (let page = 0; page < pages; page++) {
    const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    const pageEntries = entries.slice(page * TOC_ITEMS_PER_PAGE, (page + 1) * TOC_ITEMS_PER_PAGE);

    slide.addText(isZh ? '目录' : 'Contents', {
      ...MASTER_SLIDE_TITLE,
    });
    slide.addText(isZh ? '模块快速定位' : 'Module Quick Links', {
      x: 0, y: st.y, w: '100%', h: st.h,
      fontSize: st.fontSize, fontFace: st.fontFace, color: st.color, align: st.align, valign: st.valign,
      bold: st.bold, italic: st.italic,
    });

    slide.addText(
      isZh ? '点击模块名称可跳转到对应光学方案页' : 'Click a module name to jump to its optical solution slide',
      {
        x: SLIDE_LAYOUT.contentLeft, y: 1.0, w: SLIDE_LAYOUT.contentWidth, h: 0.25,
        fontSize: 9, fontFace: FONTS.body, color: COLORS.textSecondary,
      }
    );

    if (pageEntries.length === 0) {
      slide.addText(isZh ? '当前项目暂无模块' : 'No modules configured', {
        x: 0.5, y: 2.4, w: 9, h: 0.5,
        fontSize: 18, fontFace: FONTS.body, color: COLORS.secondary, align: 'center',
      });
      continue;
    }

    pageEntries.forEach((entry, localIndex) => {
      const col = localIndex >= TOC_ROWS_PER_COLUMN ? 1 : 0;
      const rowIndex = localIndex % TOC_ROWS_PER_COLUMN;
      const x = col === 0 ? SLIDE_LAYOUT.contentLeft : 5.15;
      const y = 1.42 + rowIndex * 0.54;
      const w = 4.25;
      const typeLabel = MODULE_TYPE_LABELS[entry.moduleType]?.[isZh ? 'zh' : 'en'] || entry.moduleType;
      const title = `${entry.wsCode}  ${entry.moduleName}`;

      slide.addText(String(entry.index).padStart(2, '0'), {
        x, y, w: 0.38, h: 0.22,
        fontSize: 9, fontFace: FONTS.body, color: COLORS.white, bold: true, align: 'center',
        fill: { color: COLORS.primary },
        margin: 0.03,
      } as any);

      const moduleLink = {
        slide: entry.targetSlideNumber,
        tooltip: isZh ? `跳转到 ${entry.moduleName}` : `Jump to ${entry.moduleName}`,
      };

      slide.addText([{
        text: title,
        options: {
          color: COLORS.primary,
          bold: true,
          underline: { style: 'sng', color: COLORS.primary },
          hyperlink: moduleLink,
        },
      }], {
        x: x + 0.48, y: y - 0.02, w: w - 0.95, h: 0.22,
        fontSize: 9.5, fontFace: FONTS.body, color: COLORS.primary, bold: true,
        fit: 'shrink',
      } as any);

      slide.addText([{
        text: `p.${entry.targetSlideNumber}`,
        options: {
          color: COLORS.secondary,
          hyperlink: moduleLink,
        },
      }], {
        x: x + w - 0.38, y: y - 0.02, w: 0.45, h: 0.22,
        fontSize: 8, fontFace: FONTS.body, color: COLORS.secondary, align: 'right',
      } as any);

      slide.addText(`${entry.workstationName} · ${typeLabel}`, {
        x: x + 0.48, y: y + 0.22, w: w - 0.55, h: 0.2,
        fontSize: 7.5, fontFace: FONTS.body, color: COLORS.textSecondary,
        fit: 'shrink',
      } as any);

      slide.addShape('rect', {
        x, y: y + 0.45, w, h: 0.005,
        fill: { color: COLORS.border },
        line: { color: COLORS.border, transparency: 100 },
      });
    });

    if (pages > 1) {
      slide.addText(`${page + 1}/${pages}`, {
        x: 8.95, y: 5.0, w: 0.5, h: 0.2,
        fontSize: 8, fontFace: FONTS.body, color: COLORS.secondary, align: 'right',
      });
    }
  }
}

// Helper to create table cell
const cell = (text: string, opts?: Partial<TableCell>): TableCell => ({ text, options: opts });

// Helper to create table row from strings
const row = (cells: string[]): TableRow => cells.map(t => cell(t));

const PROJECT_INFO_ROW_H = 0.25;
const PROJECT_NOTES_TABLE_LINE_WEIGHT = 92;
const PROJECT_NOTES_ROW_MIN_H = 0.42;
const PROJECT_NOTES_ROW_LINE_H = 0.18;
const PROJECT_NOTES_ROW_PADDING_H = 0.14;
const PROJECT_NOTES_CONTINUATION_LINES_PER_PAGE = 22;
const PROJECT_WS_HEADER_ROW_H = 0.26;
const PROJECT_WS_DATA_ROW_H = 0.26;

function normalizePptBodyText(text?: string | null): string {
  return (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function getPptCharWeight(char: string): number {
  if (/\s/.test(char)) return 0.35;
  if (/[\u3400-\u9fff\uff00-\uffef]/.test(char)) return 1;
  return 0.56;
}

function wrapTextToLines(text: string, maxWeight: number): string[] {
  const lines: string[] = [];

  for (const rawParagraph of text.split('\n')) {
    const paragraph = rawParagraph.trim();
    if (!paragraph) {
      if (lines.length > 0) lines.push('');
      continue;
    }

    let currentLine = '';
    let currentWeight = 0;

    for (const char of Array.from(paragraph)) {
      const charWeight = getPptCharWeight(char);
      if (currentLine && currentWeight + charWeight > maxWeight) {
        lines.push(currentLine.trimEnd());
        currentLine = char.trimStart();
        currentWeight = currentLine ? charWeight : 0;
      } else {
        currentLine += char;
        currentWeight += charWeight;
      }
    }

    if (currentLine) lines.push(currentLine.trimEnd());
  }

  while (lines[0] === '') lines.shift();
  while (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function splitLinesIntoChunks(lines: string[], maxLines: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    chunks.push(lines.slice(index, index + maxLines));
  }
  return chunks;
}

function getProjectNotesRowHeight(lineCount: number): number {
  return Math.max(PROJECT_NOTES_ROW_MIN_H, lineCount * PROJECT_NOTES_ROW_LINE_H + PROJECT_NOTES_ROW_PADDING_H);
}

// Helper to create auto-page table options
/** @deprecated autoPage 与 colspan/显式 h 组合会触发 pptxgenjs 报错；新代码请手动分页。 */
function createAutoPageTableOptions(
  startY: number,
  masterName: string = 'MASTER_SLIDE'
): Record<string, unknown> {
  const safeBottomY = SLIDE_LAYOUT.contentBottom - 0.18;
  return {
    h: Math.max(0.35, safeBottomY - startY),
    autoPage: true,
    autoPageRepeatHeader: true,
    autoPageHeaderRows: 1,
    autoPageCharWeight: -0.1,
    autoPageLineWeight: 0.1,
    newSlideStartY: SLIDE_LAYOUT.contentTop + 0.3,
    masterName,
  };
}

// ==================== MODULE PARAMETER HELPERS ====================

// Get defect detection parameters
function getDefectParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  const defectItems = normalizeDefectItemsFromConfig(config);
  
  if (defectItems.length > 0) {
    rows.push(row([isZh ? '缺陷类别/最小尺寸' : 'Defect / Min Size', formatDefectItems(defectItems)]));
  }
  if (config.missTolerance) {
    const toleranceLabels: Record<string, Record<string, string>> = {
      zero: { zh: '零容忍', en: 'Zero Tolerance' },
      low: { zh: '低容忍', en: 'Low' },
      medium: { zh: '中容忍', en: 'Medium' },
      high: { zh: '高容忍', en: 'High' },
    };
    rows.push(row([isZh ? '漏检容忍度' : 'Miss Tolerance', toleranceLabels[config.missTolerance as string]?.[isZh ? 'zh' : 'en'] || String(config.missTolerance)]));
  }
  if (config.detectionAreaLength || config.detectionAreaWidth) {
    rows.push(row([isZh ? '检测区域' : 'Detection Area', `${config.detectionAreaLength || '-'} × ${config.detectionAreaWidth || '-'} mm`]));
  }
  if (config.conveyorType) {
    const conveyorLabels: Record<string, Record<string, string>> = {
      belt: { zh: '皮带线', en: 'Belt' },
      roller: { zh: '滚筒线', en: 'Roller' },
      chain: { zh: '链条线', en: 'Chain' },
      static: { zh: '静态', en: 'Static' },
    };
    rows.push(row([isZh ? '输送方式' : 'Conveyor Type', conveyorLabels[config.conveyorType as string]?.[isZh ? 'zh' : 'en'] || String(config.conveyorType)]));
  }
  if (config.lineSpeed) {
    rows.push(row([isZh ? '线速度' : 'Line Speed', `${config.lineSpeed} m/min`]));
  }
  if (config.cameraCount || config.defectCameraCount) {
    rows.push(row([isZh ? '相机数量' : 'Camera Count', `${config.cameraCount || config.defectCameraCount} ${isZh ? '台' : ''}`]));
  }
  if (config.defectContrast) {
    const contrastLabels: Record<string, Record<string, string>> = {
      high: { zh: '高对比', en: 'High' },
      medium: { zh: '中对比', en: 'Medium' },
      low: { zh: '低对比', en: 'Low' },
    };
    rows.push(row([isZh ? '缺陷对比度' : 'Defect Contrast', contrastLabels[config.defectContrast as string]?.[isZh ? 'zh' : 'en'] || String(config.defectContrast)]));
  }
  if (config.materialReflectionLevel) {
    const reflectionLabels: Record<string, Record<string, string>> = {
      matte: { zh: '哑光', en: 'Matte' },
      semi: { zh: '半光泽', en: 'Semi-gloss' },
      glossy: { zh: '高光', en: 'Glossy' },
      mirror: { zh: '镜面', en: 'Mirror' },
    };
    rows.push(row([isZh ? '材质反光等级' : 'Reflection Level', reflectionLabels[config.materialReflectionLevel as string]?.[isZh ? 'zh' : 'en'] || String(config.materialReflectionLevel)]));
  }
  if (config.allowedMissRate !== undefined) {
    rows.push(row([isZh ? '允许漏检率' : 'Allowed Miss Rate', `${config.allowedMissRate}%`]));
  }
  if (config.allowedFalseRate !== undefined) {
    rows.push(row([isZh ? '允许误检率' : 'Allowed False Rate', `${config.allowedFalseRate}%`]));
  }
  if (config.confidenceThreshold !== undefined) {
    rows.push(row([isZh ? '置信度阈值' : 'Confidence Threshold', `${config.confidenceThreshold}%`]));
  }
  
  return rows;
}

// Get measurement parameters
function getMeasurementParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  // Measurement items
  if (config.measurementItems && Array.isArray(config.measurementItems) && config.measurementItems.length > 0) {
    rows.push(row([isZh ? '【测量项目】' : '[Measurement Items]', '']));
    (config.measurementItems as Array<Record<string, unknown>>).forEach((item: any, idx: number) => {
      const dimTypeLabels: Record<string, string> = {
        length: isZh ? '长度' : 'Length',
        diameter: isZh ? '直径' : 'Diameter',
        radius: isZh ? '半径' : 'Radius',
        angle: isZh ? '角度' : 'Angle',
        distance: isZh ? '距离' : 'Distance',
        gap: isZh ? '间隙' : 'Gap',
      };
      const dimType = item.dimType ?? item.type ?? '';
      const upper = item.upperTol ?? item.upperTolerance ?? 0;
      const lower = item.lowerTol ?? item.lowerTolerance ?? 0;
      rows.push(row([
        `${idx + 1}. ${item.name || (isZh ? '测量项' : 'Item')}`,
        `${dimTypeLabels[dimType] || dimType}: ${item.nominal ?? item.nominalValue ?? 0} (+${upper}/-${lower}) ${item.unit || 'mm'}`
      ]));
    });
  }
  
  if (config.measurementFieldOfView) {
    rows.push(row([isZh ? '视野大小' : 'Field of View', `${config.measurementFieldOfView} mm`]));
  }
  if (config.measurementResolution) {
    rows.push(row([isZh ? '分辨率' : 'Resolution', `${config.measurementResolution} mm/pixel`]));
  }
  if (config.calibrationMethod) {
    const calibrationLabels: Record<string, Record<string, string>> = {
      plane: { zh: '平面标定', en: 'Plane' },
      multipoint: { zh: '多点标定', en: 'Multi-point' },
      ruler: { zh: '标尺标定', en: 'Ruler' },
    };
    rows.push(row([isZh ? '标定方式' : 'Calibration Method', calibrationLabels[config.calibrationMethod as string]?.[isZh ? 'zh' : 'en'] || String(config.calibrationMethod)]));
  }
  if (config.grr) {
    rows.push(row(['GR&R', `${config.grr}%`]));
  }
  
  return rows;
}

// Get OCR parameters
function getOCRParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.charTypes && Array.isArray(config.charTypes)) {
    const typeLabels: Record<string, string> = {
      printed: isZh ? '印刷字符' : 'Printed',
      engraved: isZh ? '雕刻字符' : 'Engraved',
      dotMatrix: isZh ? '点阵字符' : 'Dot Matrix',
      handwritten: isZh ? '手写字符' : 'Handwritten',
    };
    rows.push(row([isZh ? '字符类型' : 'Char Types', (config.charTypes as string[]).map(t => typeLabels[t] || t).join('、')]));
  }
  if (config.charType) {
    const typeLabels: Record<string, string> = {
      printed: isZh ? '印刷字符' : 'Printed',
      engraved: isZh ? '雕刻字符' : 'Engraved',
      dotMatrix: isZh ? '点阵字符' : 'Dot Matrix',
      handwritten: isZh ? '手写字符' : 'Handwritten',
    };
    rows.push(row([isZh ? '字符类型' : 'Char Type', typeLabels[config.charType as string] || String(config.charType)]));
  }
  if (config.minCharHeight) {
    rows.push(row([isZh ? '最小字符高度' : 'Min Char Height', `${config.minCharHeight} mm`]));
  }
  if (config.charWidth) {
    rows.push(row([isZh ? '字符宽度' : 'Char Width', `${config.charWidth} mm`]));
  }
  if (config.expectedCharCount || config.charCount) {
    rows.push(row([isZh ? '预期字符数' : 'Expected Char Count', String(config.expectedCharCount || config.charCount)]));
  }
  if (config.charSet) {
    const charSetLabels: Record<string, string> = {
      numeric: isZh ? '纯数字' : 'Numeric',
      alpha: isZh ? '纯字母' : 'Alpha',
      alphanumeric: isZh ? '字母数字混合' : 'Alphanumeric',
      custom: isZh ? '自定义' : 'Custom',
    };
    rows.push(row([isZh ? '字符集' : 'Char Set', charSetLabels[config.charSet as string] || String(config.charSet)]));
  }
  if (config.contentRule) {
    rows.push(row([isZh ? '内容规则' : 'Content Rule', String(config.contentRule)]));
  }
  if (config.charContrast) {
    rows.push(row([isZh ? '字符对比度' : 'Char Contrast', String(config.charContrast)]));
  }
  if (config.charFormat) {
    rows.push(row([isZh ? '字符格式' : 'Char Format', String(config.charFormat)]));
  }
  if (config.validationRules) {
    rows.push(row([isZh ? '校验规则' : 'Validation Rules', String(config.validationRules)]));
  }
  if (config.charAreaWidth || config.charAreaHeight) {
    rows.push(row([isZh ? '字符区域' : 'Char Area', `${config.charAreaWidth || '-'} × ${config.charAreaHeight || '-'} mm`]));
  }
  if (config.minStrokeWidth) {
    rows.push(row([isZh ? '最小笔画宽度' : 'Min Stroke Width', `${config.minStrokeWidth} mm`]));
  }
  if (config.allowedRotation) {
    rows.push(row([isZh ? '允许旋转角度' : 'Allowed Rotation', `±${config.allowedRotation}°`]));
  }
  if (config.allowedDamage) {
    const damageLabels: Record<string, string> = {
      none: isZh ? '无损坏' : 'None',
      slight: isZh ? '轻微' : 'Slight',
      moderate: isZh ? '中等' : 'Moderate',
      severe: isZh ? '严重' : 'Severe',
    };
    rows.push(row([isZh ? '允许损坏程度' : 'Allowed Damage', damageLabels[config.allowedDamage as string] || String(config.allowedDamage)]));
  }
  
  return rows;
}

// Get positioning parameters
function getPositioningParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.guidingMode) {
    const modeLabels: Record<string, string> = {
      '2d': isZh ? '2D定位' : '2D',
      '2.5d': isZh ? '2.5D定位' : '2.5D',
      '3d': isZh ? '3D定位' : '3D',
    };
    rows.push(row([isZh ? '引导模式' : 'Guiding Mode', modeLabels[config.guidingMode as string] || String(config.guidingMode)]));
  }
  if (config.guidingMechanism) {
    const mechLabels: Record<string, string> = {
      robot: isZh ? '机器人' : 'Robot',
      gantry: isZh ? '龙门架' : 'Gantry',
      scara: isZh ? 'SCARA' : 'SCARA',
      delta: isZh ? 'Delta' : 'Delta',
    };
    rows.push(row([isZh ? '引导机构' : 'Guiding Mechanism', mechLabels[config.guidingMechanism as string] || String(config.guidingMechanism)]));
  }
  if (config.targetType) {
    const typeLabels: Record<string, string> = {
      edge: isZh ? '边缘' : 'Edge',
      corner: isZh ? '角点' : 'Corner',
      center: isZh ? '中心' : 'Center',
      hole: isZh ? '孔' : 'Hole',
      pattern: isZh ? '图案' : 'Pattern',
    };
    rows.push(row([isZh ? '定位目标类型' : 'Target Type', typeLabels[config.targetType as string] || String(config.targetType)]));
  }
  if (config.accuracyRequirement) {
    rows.push(row([isZh ? '定位精度要求' : 'Accuracy Requirement', `±${config.accuracyRequirement} mm`]));
  }
  if (config.repeatability) {
    rows.push(row([isZh ? '重复精度' : 'Repeatability', `±${config.repeatability} mm`]));
  }
  if (config.errorToleranceX || config.errorToleranceY) {
    rows.push(row([isZh ? '误差容忍(X/Y)' : 'Error Tolerance (X/Y)', `±${config.errorToleranceX || '-'} / ±${config.errorToleranceY || '-'} mm`]));
  }
  if (config.calibrationMethod) {
    const calibLabels: Record<string, string> = {
      '9point': isZh ? '九点标定' : '9-Point',
      '4point': isZh ? '四点标定' : '4-Point',
      handeye: isZh ? '手眼标定' : 'Hand-Eye',
    };
    rows.push(row([isZh ? '标定方式' : 'Calibration Method', calibLabels[config.calibrationMethod as string] || String(config.calibrationMethod)]));
  }
  if (config.outputCoordinate) {
    rows.push(row([isZh ? '输出坐标系' : 'Output Coordinate', String(config.outputCoordinate)]));
  }
  if (config.calibrationCycle) {
    rows.push(row([isZh ? '标定周期' : 'Calibration Cycle', String(config.calibrationCycle)]));
  }
  if (config.accuracyAcceptance) {
    rows.push(row([isZh ? '精度验收标准' : 'Accuracy Acceptance', String(config.accuracyAcceptance)]));
  }
  if (config.targetFeatures) {
    rows.push(row([isZh ? '目标特征' : 'Target Features', String(config.targetFeatures)]));
  }
  if (config.targetCount) {
    rows.push(row([isZh ? '目标数量' : 'Target Count', String(config.targetCount)]));
  }
  if (config.occlusionTolerance) {
    rows.push(row([isZh ? '遮挡容忍' : 'Occlusion Tolerance', `${config.occlusionTolerance}%`]));
  }
  
  return rows;
}

// Get deep learning parameters
function getDeepLearningParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.taskType) {
    const taskLabels: Record<string, string> = {
      classification: isZh ? '分类' : 'Classification',
      detection: isZh ? '目标检测' : 'Detection',
      segmentation: isZh ? '语义分割' : 'Segmentation',
      instance: isZh ? '实例分割' : 'Instance Segmentation',
      anomaly: isZh ? '异常检测' : 'Anomaly Detection',
    };
    rows.push(row([isZh ? '任务类型' : 'Task Type', taskLabels[config.taskType as string] || String(config.taskType)]));
  }
  if (config.targetClasses && Array.isArray(config.targetClasses) && config.targetClasses.length > 0) {
    rows.push(row([isZh ? '目标类别' : 'Target Classes', (config.targetClasses as string[]).join('、')]));
  }
  if (config.detectionClasses && Array.isArray(config.detectionClasses)) {
    rows.push(row([isZh ? '检测类别' : 'Detection Classes', (config.detectionClasses as string[]).join('、')]));
  }
  if (config.modelType) {
    rows.push(row([isZh ? '模型类型' : 'Model Type', String(config.modelType)]));
  }
  if (config.roiWidth || config.roiHeight) {
    rows.push(row([isZh ? 'ROI尺寸' : 'ROI Size', `${config.roiWidth || '-'} × ${config.roiHeight || '-'} px`]));
  }
  if (config.deployTarget) {
    const targetLabels: Record<string, string> = {
      cpu: 'CPU',
      gpu: 'GPU',
      edge: isZh ? '边缘设备' : 'Edge Device',
    };
    rows.push(row([isZh ? '部署目标' : 'Deploy Target', targetLabels[config.deployTarget as string] || String(config.deployTarget)]));
  }
  if (config.inferenceTimeLimit) {
    rows.push(row([isZh ? '推理时限' : 'Inference Time Limit', `${config.inferenceTimeLimit} ms`]));
  }
  if (config.confidenceThreshold !== undefined) {
    rows.push(row([isZh ? '置信度阈值' : 'Confidence Threshold', `${config.confidenceThreshold}%`]));
  }
  if (config.trainingSampleCount || config.sampleEstimate) {
    rows.push(row([isZh ? '训练样本量' : 'Training Samples', String(config.trainingSampleCount || config.sampleEstimate)]));
  }
  
  return rows;
}

// Get imaging parameters (common to all module types)
function getImagingParams(config: Record<string, unknown>, isZh: boolean): TableRow[] {
  const rows: TableRow[] = [];
  
  if (config.workingDistance) {
    rows.push(row([isZh ? '工作距离' : 'Working Distance', `${config.workingDistance} mm`]));
  }
  if (config.fieldOfView) {
    rows.push(row([isZh ? '视场范围' : 'Field of View', `${config.fieldOfView} mm`]));
  }
  if (config.fieldOfViewWidth && config.fieldOfViewHeight) {
    rows.push(row([isZh ? '视场范围(宽×高)' : 'FOV (W×H)', `${config.fieldOfViewWidth} × ${config.fieldOfViewHeight} mm`]));
  }
  if (config.resolutionPerPixel) {
    rows.push(row([isZh ? '分辨率' : 'Resolution', `${config.resolutionPerPixel} mm/pixel`]));
  }
  if (config.depthOfField) {
    rows.push(row([isZh ? '靶面尺寸' : 'Sensor Size', String(config.depthOfField)]));
  }
  if (config.exposure) {
    rows.push(row([isZh ? '曝光时间' : 'Exposure', `${config.exposure} μs`]));
  }
  if (config.gain) {
    rows.push(row([isZh ? '增益' : 'Gain', `${config.gain} dB`]));
  }
  if (config.triggerDelay) {
    rows.push(row([isZh ? '触发延迟' : 'Trigger Delay', `${config.triggerDelay} ms`]));
  }
  const lightItems = Array.isArray(config.lightItems)
    ? config.lightItems.filter((item: any) => item && typeof item === 'object')
    : [];
  if (lightItems.length > 0) {
    lightItems.forEach((item: any, index: number) => {
      const parts = [
        item.lightMode ? `${isZh ? '模式' : 'Mode'} ${item.lightMode}` : '',
        item.lightAngle ? `${isZh ? '角度' : 'Angle'} ${item.lightAngle}°` : '',
        item.lightDistance ? `${isZh ? '距离' : 'Distance'} ${item.lightDistance} mm` : '',
      ].filter(Boolean);
      if (parts.length > 0 || item.selectedLight) {
        rows.push(row([`${isZh ? '光源' : 'Light'} ${index + 1}`, parts.join(' / ') || String(item.selectedLight || '-')]));
      }
    });
  } else if (config.lightAngle) {
    rows.push(row([isZh ? '光源角度' : 'Light Angle', `${config.lightAngle}°`]));
  }
  if (lightItems.length === 0 && config.lightDistance) {
    rows.push(row([isZh ? '光源距离' : 'Light Distance', `${config.lightDistance} mm`]));
  }
  if (lightItems.length === 0 && config.lightMode) {
    const modeLabels: Record<string, string> = {
      continuous: isZh ? '常亮' : 'Continuous',
      strobe: isZh ? '频闪' : 'Strobe',
    };
    rows.push(row([isZh ? '光源模式' : 'Light Mode', modeLabels[config.lightMode as string] || String(config.lightMode)]));
  }
  if (config.lensAperture) {
    rows.push(row([isZh ? '镜头光圈' : 'Lens Aperture', `F${config.lensAperture}`]));
  }
  
  return rows;
}

// ==================== MAIN GENERATOR ====================

export async function generatePPTX(
  project: ProjectData,
  workstations: WorkstationData[],
  layouts: LayoutData[],
  modules: ModuleData[],
  options: GenerationOptions,
  onProgress: ProgressCallback,
  hardware?: HardwareData,
  readinessResult?: { missing: Array<{ level: string; name: string; missing: string[] }>; warnings: Array<{ level: string; name: string; warning: string }> },
  annotations?: AnnotationData[],
  productAssets?: ProductAssetData[]
): Promise<Blob> {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  const isZh = options.language === 'zh';
  const isDraft = options.mode === 'draft';
  const generationScope = options.scope || 'full';
  const projectUses3D = Boolean((project as any).use_3d);

  // Use hardcoded corporate colors directly
  const activeColors = { ...COLORS };

  // Set presentation properties
  pptx.author = project.responsible || 'Vision System';
  pptx.title = `${project.name} - ${isZh ? '视觉系统方案' : 'Vision System Proposal'}${isDraft ? ' [DRAFT]' : ''}`;
  pptx.subject = isZh ? '机器视觉系统技术方案' : 'Machine Vision System Technical Proposal';
  pptx.company = isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN;

  // Explicitly set 16:9 layout
  pptx.layout = SLIDE_LAYOUT.name;

  // Define master slide with uploaded background image (all header/footer baked in)
  const footerY = SLIDE_LAYOUT.height - SLIDE_LAYOUT.margin.bottom;
  
  // Load background image for internal pages
  let bgImageData: string | null = null;
  const bgUrl = `${window.location.origin}/ppt-covers/tech-shine-bg.png`;
  try {
    bgImageData = await fetchImageAsDataUri(bgUrl);
  } catch (err) {
    console.warn('Failed to load bg image:', err);
  }

  pptx.defineSlideMaster({
    title: 'MASTER_SLIDE',
    background: bgImageData 
      ? { data: bgImageData } 
      : { color: activeColors.background },
    objects: [], // All header/footer elements are part of the background image
  });

  const st = MASTER_SLIDE_SUBTITLE;

  let progress = 5;
  onProgress(progress, isZh ? '初始化生成器...' : 'Initializing generator...', isZh ? '开始PPT生成' : 'Starting PPT generation');

  // Preload all images in batches before slide generation
  const allImageUrls = collectAllImageUrls(layouts, modules, annotations, productAssets, hardware);
  if (allImageUrls.length > 0) {
    const batchSize = options.quality === 'ultra' ? 10 : options.quality === 'high' ? 12 : 15;
    onProgress(6, isZh ? '预加载图片资源...' : 'Preloading images...', isZh ? `预加载 ${allImageUrls.length} 张图片` : `Preloading ${allImageUrls.length} images`);
    await preloadImagesInBatches(allImageUrls, batchSize, (loaded, total) => {
      const imgProgress = 6 + Math.round((loaded / total) * 2);
      onProgress(imgProgress, isZh ? `预加载图片 ${loaded}/${total}` : `Preloading images ${loaded}/${total}`, '');
    });
  }

  const buildWorkstationSlideData = (
    ws: WorkstationData,
    wsLayout: LayoutData | null,
    wsModules: ModuleData[],
  ) => {
    const wsModuleIds = new Set(wsModules.map(m => m.id));
    const wsAnnotations = annotations?.filter(a =>
      (a.scope_type === 'workstation' && a.workstation_id === ws.id) ||
      (a.scope_type === 'module' && a.module_id && wsModuleIds.has(a.module_id))
    ) || [];
    const wsProductAssets = (productAssets || [])
      .filter(a => a.scope_type === 'workstation' && a.workstation_id === ws.id)
      .sort((a, b) =>
        Number(b.is_primary ?? false) - Number(a.is_primary ?? false) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
    const wsProductAsset = wsProductAssets[0];

    return {
      ws: {
        id: ws.id,
        name: ws.name,
        type: ws.type,
        design_responsible: ws.design_responsible ?? null,
        cycle_time: ws.cycle_time,
        product_dimensions: ws.product_dimensions,
        enclosed: ws.enclosed,
        process_stage: ws.process_stage,
        observation_target: ws.observation_target,
        acceptance_criteria: ws.acceptance_criteria,
        motion_description: ws.motion_description,
        shot_count: ws.shot_count,
        risk_notes: ws.risk_notes,
        action_script: ws.action_script,
        notes: ws.notes,
        description: (ws as unknown as Record<string, unknown>).description as string | null,
      },
      layout: wsLayout ? {
        workstation_id: wsLayout.workstation_id,
        conveyor_type: wsLayout.conveyor_type,
        camera_count: wsLayout.camera_count,
        camera_mounts: wsLayout.camera_mounts,
        camera_mounts_labels: (wsLayout as any).camera_mounts_labels || null,
        mechanisms: wsLayout.mechanisms,
        front_view_image_url: wsLayout.front_view_image_url,
        side_view_image_url: wsLayout.side_view_image_url,
        top_view_image_url: wsLayout.top_view_image_url,
        isometric_view_image_url: (wsLayout as any).isometric_view_image_url || null,
        primary_view: (wsLayout as any).primary_view || 'front',
        auxiliary_view: (wsLayout as any).auxiliary_view || 'side',
        layout_description: (wsLayout as any).layout_description || '',
        width: wsLayout.width,
        height: wsLayout.height,
        depth: wsLayout.depth,
        selected_cameras: wsLayout.selected_cameras,
        selected_lenses: wsLayout.selected_lenses,
        selected_lights: wsLayout.selected_lights,
        selected_controller: wsLayout.selected_controller,
      } : null,
      modules: wsModules.map(m => {
        const moduleUses3D = isModule3DCameraForOutput(m, projectUses3D);
        return {
          id: m.id,
          name: m.name,
          type: m.type,
          description: m.description,
          trigger_type: m.trigger_type,
          processing_time_limit: m.processing_time_limit,
          selected_camera: m.selected_camera,
          selected_lens: moduleUses3D ? null : m.selected_lens,
          selected_light: moduleUses3D ? null : m.selected_light,
          selected_controller: m.selected_controller,
          is_3d_camera: moduleUses3D,
          schematic_image_url: m.schematic_image_url,
          positioning_config: m.positioning_config,
          defect_config: m.defect_config,
          measurement_config: m.measurement_config,
          ocr_config: m.ocr_config,
          deep_learning_config: m.deep_learning_config,
          output_types: m.output_types,
          roi_strategy: m.roi_strategy,
          lighting_photos: (m as any).lighting_photos || [],
        };
      }),
      annotations: wsAnnotations.map(a => ({
        asset_id: (a as { asset_id?: string }).asset_id,
        snapshot_url: a.snapshot_url,
        annotations_json: a.annotations_json,
        remark: a.remark,
      })),
      productAsset: wsProductAsset ? {
        id: wsProductAsset.id,
        product_name: wsProductAsset.product_name ?? null,
        product_code: wsProductAsset.product_code ?? null,
        is_primary: wsProductAsset.is_primary ?? false,
        preview_images: wsProductAsset.preview_images,
        detection_method: wsProductAsset.detection_method,
        product_models: wsProductAsset.product_models as Array<{ name: string; spec: string }> | null,
        detection_requirements: wsProductAsset.detection_requirements as Array<{ content: string; highlight?: string | null }> | null,
      } : undefined,
      productAssets: wsProductAssets.map(p => ({
        id: p.id,
        product_name: p.product_name ?? null,
        product_code: p.product_code ?? null,
        is_primary: p.is_primary ?? false,
        preview_images: p.preview_images,
        detection_method: p.detection_method ?? null,
        product_models: p.product_models ?? null,
        detection_requirements: p.detection_requirements ?? null,
      })),
      hardware: hardware ? {
        cameras: hardware.cameras,
        lenses: hardware.lenses,
        lights: hardware.lights,
        controllers: hardware.controllers,
      } : undefined,
    };
  };

  if (generationScope === 'modules') {
    const totalModules = Math.max(modules.length, 1);
    let generatedModules = 0;

    for (let wi = 0; wi < workstations.length; wi++) {
      const ws = workstations[wi];
      const wsModules = modules.filter(m => m.workstation_id === ws.id);
      if (wsModules.length === 0) continue;

      const wsLayout = layouts.find(l => l.workstation_id === ws.id) || null;
      const wsCode = getWorkstationCode(project.code, wi, ws.code);
      const ctx = {
        pptx,
        isZh,
        wsCode,
        wsName: ws.name,
        responsible: ws.design_responsible || project.responsible,
      };
      const slideData = buildWorkstationSlideData(ws, wsLayout, wsModules);

      for (let mi = 0; mi < wsModules.length; mi++) {
        const modName = wsModules[mi].name;
        generatedModules++;
        const moduleProgress = 8 + Math.round((generatedModules / totalModules) * 88);
        onProgress(
          moduleProgress,
          `${isZh ? '鐢熸垚妯″潡' : 'Generating module'} (${generatedModules}/${totalModules}): ${modName}`,
          `[WORKSTATION:${modName}:${generatedModules}/${totalModules}] Module slides`
        );

        if (isDraft) {
          const draftOpticalSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
          draftOpticalSlide.addText(`${isZh ? '[鑽夌] 鍏夊鏂规' : '[DRAFT] Optical'}: ${modName}`, {
            x: 1, y: 2, w: 8, h: 1, fontSize: 18, fontFace: FONTS.body, color: COLORS.secondary, align: 'center',
          });
        } else {
          await generateModuleOpticalSlide(ctx, slideData, mi);

          const photos = (wsModules[mi] as any).lighting_photos || [];
          if (photos.length > 0) {
            await generateLightingPhotosSlide(ctx, slideData, mi);
          }
        }
      }
    }

    progress = 100;
    onProgress(progress, isZh ? '瀹屾垚' : 'Complete', isZh ? 'PPT鐢熸垚瀹屾垚' : 'PPT generation complete');
    return await pptx.write({ outputType: 'blob' }) as Blob;
  }

  // ========== SLIDE 1: Cover - Full image, no modifications ==========
  progress = 8;
  onProgress(progress, isZh ? '生成封面页...' : 'Generating cover slide...', isZh ? '生成封面页' : 'Cover slide');
  
  const coverSlide = pptx.addSlide();
  
  // Use Tech-Shine cover background image - display as-is, no text overlay
  const coverBgUrl = `${window.location.origin}/ppt-covers/tech-shine-cover.png`;
  let coverBgData: string | null = null;
  try {
    coverBgData = await fetchImageAsDataUri(coverBgUrl, { timeoutMs: 60000 });
  } catch (err) {
    console.warn('[Cover] Failed to load cover background image:', (err as Error)?.message || err);
  }

  if (coverBgData) {
    // Full slide background with company cover image - no modifications, preserve full HD
    coverSlide.addImage({
      data: coverBgData,
      x: 0, y: 0, w: 10, h: 5.625,
    });
  } else {
    console.warn('[Cover] Falling back to text cover (image data is empty)');
    // Fallback: simple cover with company name if image fails to load
    coverSlide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: COLORS.background },
    });
    
    coverSlide.addText(isZh ? '德星云智能' : 'TECH-SHINE', {
      x: 0.5, y: 1.5, w: 9, h: 0.6,
      fontSize: 36, fontFace: FONTS.heading, color: COLORS.primary, bold: true, align: 'center',
      shadow: createHeadingShadow(),
    });
    
    coverSlide.addText(isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN, {
      x: 0.5, y: 2.2, w: 9, h: 0.4,
      fontSize: 14, fontFace: FONTS.body, color: COLORS.dark, align: 'center',
    });
  }

  // ========== SLIDE 2: Project Description (项目说明) ==========
  progress = 8;
  onProgress(progress, isZh ? '生成项目说明页...' : 'Generating project description...', isZh ? '项目说明页' : 'Project description');

  const addProjectSlideHeader = (
    slide: ReturnType<PptxGenJS['addSlide']>,
    title: string,
    subtitle: string,
  ) => {
    slide.addText(title, {
      ...MASTER_SLIDE_TITLE,
    });
    slide.addText(subtitle, {
      x: 0, y: st.y, w: '100%', h: st.h,
      fontSize: st.fontSize, fontFace: st.fontFace, color: st.color, align: st.align, valign: st.valign,
      bold: st.bold, italic: st.italic,
    });
  };

  const createProjectContinuationSlide = (title: string, subtitle: string) => {
    const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    addProjectSlideHeader(slide, title, subtitle);
    return slide;
  };

  const descSlide = createProjectContinuationSlide(
    isZh ? '项目说明' : 'Project Description',
    isZh ? '项目基本信息' : 'Project Information',
  );

  // Project basic info table
  const projectExt = project as ProjectData & { production_line?: string | null; description?: string | null };
  const projectDesc = normalizePptBodyText(projectExt.description);
  const projectNotes = normalizePptBodyText(project.notes);
  const projectNotesLines = projectNotes
    ? wrapTextToLines(projectNotes, PROJECT_NOTES_TABLE_LINE_WEIGHT)
    : [];
  const projectInfoTableY = SLIDE_LAYOUT.contentTop + 0.45;
  
  const projectInfoRows: TableRow[] = [
    row([isZh ? '项目编号' : 'Project Code', project.code]),
    row([isZh ? '项目名称' : 'Project Name', project.name]),
    row([isZh ? '客户名称' : 'Customer', project.customer]),
    row([isZh ? '负责人' : 'Responsible', project.responsible || '-']),
    row([isZh ? '项目日期' : 'Date', project.date || '-']),
  ];
  const baseProjectInfoHeight = projectInfoRows.length * PROJECT_INFO_ROW_H;
  const reservedProjectDescHeight = projectDesc ? 1.5 : 0;
  const firstPageNotesMaxHeight = Math.max(
    PROJECT_NOTES_ROW_MIN_H,
    SLIDE_LAYOUT.contentBottom - projectInfoTableY - baseProjectInfoHeight - reservedProjectDescHeight - 0.08,
  );
  const firstPageNotesMaxLines = Math.max(
    1,
    Math.floor((firstPageNotesMaxHeight - PROJECT_NOTES_ROW_PADDING_H) / PROJECT_NOTES_ROW_LINE_H),
  );
  const projectNotesInlineLines = projectNotesLines.slice(0, firstPageNotesMaxLines);
  const projectNotesOverflowLines = projectNotesLines.slice(firstPageNotesMaxLines);
  const projectNotesContinuationChunks = splitLinesIntoChunks(
    projectNotesOverflowLines,
    PROJECT_NOTES_CONTINUATION_LINES_PER_PAGE,
  );
  const projectNotesRowIndex = projectNotes ? projectInfoRows.length : -1;
  if (projectNotes) {
    const inlineNotes = projectNotesInlineLines.join('\n');
    projectInfoRows.push([
      cell(isZh ? '项目备注' : 'Project Notes'),
      cell(inlineNotes, {
        fontSize: 8.5,
        valign: 'top',
      } as any),
    ]);
  }
  const projectInfoRowHeights = projectInfoRows.map((_, index) => (
    index === projectNotesRowIndex ? getProjectNotesRowHeight(projectNotesInlineLines.length) : PROJECT_INFO_ROW_H
  ));

  descSlide.addTable(projectInfoRows, {
    x: SLIDE_LAYOUT.contentLeft, y: projectInfoTableY, w: SLIDE_LAYOUT.contentWidth,
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [1.5, 7.7],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle',
    rowH: projectInfoRowHeights,
  });

  // Project description
  let nextSectionY = projectInfoTableY + projectInfoRowHeights.reduce((sum, height) => sum + height, 0) + 0.05;
  if (projectDesc) {
    descSlide.addText(isZh ? '【项目简介】' : '[Project Overview]', {
      x: SLIDE_LAYOUT.contentLeft, y: nextSectionY, w: SLIDE_LAYOUT.contentWidth, h: 0.28,
      fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
    });
    descSlide.addShape('rect', {
      x: SLIDE_LAYOUT.contentLeft, y: nextSectionY + 0.33, w: SLIDE_LAYOUT.contentWidth, h: 0.9,
      fill: { color: 'F5F5F5' },
      line: { color: COLORS.border, width: 0.5 },
    });
    descSlide.addText(projectDesc, {
      x: SLIDE_LAYOUT.contentLeft + 0.1, y: nextSectionY + 0.4, w: SLIDE_LAYOUT.contentWidth - 0.2, h: 0.75,
      fontSize: 9, fontFace: FONTS.body, color: COLORS.dark,
    });
    nextSectionY += 1.45;
  }

  // Workstation overview table (merged from former Project Overview slide)
  const wsTableHeader: TableRow = row([
    isZh ? '编号' : 'No.',
    isZh ? '工站号' : 'Station No.',
    isZh ? '名称' : 'Name',
    isZh ? '设计负责人' : 'Design Resp.',
    isZh ? '类型' : 'Type',
    isZh ? '工位节拍(s)' : 'Station Cycle(s)',
    isZh ? '模块数' : 'Modules',
  ]);

  const wsTableRows: TableRow[] = workstations.map((ws, index) => row([
    String(index + 1),
    getWorkstationCode(project.code, index, ws.code),
    ws.name,
    ws.design_responsible || '-',
    WS_TYPE_LABELS[ws.type]?.[options.language] || ws.type,
    formatWorkstationCycleTimePlain(ws),
    modules.filter(m => m.workstation_id === ws.id).length.toString(),
  ]));

  const addWorkstationOverviewTable = (
    slide: ReturnType<PptxGenJS['addSlide']>,
    startY: number,
    rows: TableRow[],
    startIndex: number,
    titleSuffix = '',
  ): number => {
    const tableY = startY + 0.32;
    const availableHeight = SLIDE_LAYOUT.contentBottom - tableY - 0.04;
    if (availableHeight < PROJECT_WS_HEADER_ROW_H) return startIndex;

    const bodyCapacity = Math.max(0, Math.floor((availableHeight - PROJECT_WS_HEADER_ROW_H) / PROJECT_WS_DATA_ROW_H));
    if (rows.length > 0 && bodyCapacity < 1) return startIndex;

    const pageRows = rows.length > 0
      ? rows.slice(startIndex, startIndex + bodyCapacity)
      : [];
    if (rows.length > 0 && pageRows.length === 0) return startIndex;

    slide.addText(`${isZh ? '工位清单' : 'Workstation List'}${titleSuffix}`, {
      x: SLIDE_LAYOUT.contentLeft, y: startY, w: SLIDE_LAYOUT.contentWidth, h: 0.28,
      fontSize: 11, fontFace: FONTS.body, color: COLORS.dark, bold: true,
    });

    slide.addTable([wsTableHeader, ...pageRows], {
      x: SLIDE_LAYOUT.contentLeft, y: tableY, w: SLIDE_LAYOUT.contentWidth,
      fontFace: FONTS.body,
      fontSize: 8,
      colW: [0.5, 1.2, 2.55, 1.25, 1.3, 1.15, 0.95],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
      valign: 'middle',
      align: 'center',
      rowH: [PROJECT_WS_HEADER_ROW_H, ...pageRows.map(() => PROJECT_WS_DATA_ROW_H)],
    });

    return rows.length > 0 ? startIndex + pageRows.length : 0;
  };

  projectNotesContinuationChunks.forEach((chunk, pageIndex) => {
    const notesSlide = createProjectContinuationSlide(
      isZh ? '项目说明（续）' : 'Project Description (cont.)',
      isZh ? '项目基本信息' : 'Project Information',
    );
    const pageLabel = projectNotesContinuationChunks.length > 1
      ? ` (${pageIndex + 1}/${projectNotesContinuationChunks.length})`
      : '';
    notesSlide.addTable([
      [
        cell(`${isZh ? '项目备注（续）' : 'Project Notes (cont.)'}${pageLabel}`),
        cell(chunk.join('\n'), {
          fontSize: 8.5,
          valign: 'top',
        } as any),
      ],
    ], {
      x: SLIDE_LAYOUT.contentLeft,
      y: SLIDE_LAYOUT.contentTop + 0.45,
      w: SLIDE_LAYOUT.contentWidth,
      fontFace: FONTS.body,
      fontSize: 9,
      colW: [1.5, 7.7],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
      valign: 'top',
      rowH: [Math.min(getProjectNotesRowHeight(chunk.length), SLIDE_LAYOUT.contentHeight - 0.55)],
    });
  });

  let wsRowIndex = 0;
  const workstationListStartY = SLIDE_LAYOUT.contentTop + 0.35;
  if (wsTableRows.length === 0) {
    const wsSlide = createProjectContinuationSlide(
      isZh ? '项目说明（续）' : 'Project Description (cont.)',
      isZh ? '工位清单' : 'Workstation List',
    );
    addWorkstationOverviewTable(wsSlide, workstationListStartY, wsTableRows, 0);
  }

  while (wsRowIndex < wsTableRows.length) {
    const wsSlide = createProjectContinuationSlide(
      isZh ? '项目说明（续）' : 'Project Description (cont.)',
      isZh ? '工位清单' : 'Workstation List',
    );
    const nextWsRowIndex = addWorkstationOverviewTable(
      wsSlide,
      workstationListStartY,
      wsTableRows,
      wsRowIndex,
      wsRowIndex > 0 ? (isZh ? '（续）' : ' (cont.)') : '',
    );
    if (nextWsRowIndex <= wsRowIndex) break;
    wsRowIndex = nextWsRowIndex;
  }

  // ========== SLIDE 3: Revision History ==========
  progress = 10;
  onProgress(progress, isZh ? '生成变更履历页...' : 'Generating revision history...', isZh ? '变更履历页' : 'Revision History');
  
  const revisionSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  
  // Title text overlaid on the navy header bar (white text)
  revisionSlide.addText(isZh ? '变更履历' : 'Revision History', {
    ...MASTER_SLIDE_TITLE,
  });

  revisionSlide.addText(isZh ? '变更表' : 'Change Log', {
    x: 0, y: st.y, w: '100%', h: st.h,
    fontSize: st.fontSize, fontFace: st.fontFace, color: st.color, align: st.align, valign: st.valign,
    bold: st.bold, italic: st.italic,
  });

  const revisionHeader: TableRow = [
    cell(isZh ? '编号' : 'No.', { fill: { color: COLORS.primary }, color: COLORS.white, bold: true, align: 'center', fontSize: 10, fontFace: FONTS.body } as any),
    cell(isZh ? '版本' : 'Version', { fill: { color: COLORS.primary }, color: COLORS.white, bold: true, align: 'center', fontSize: 10, fontFace: FONTS.body } as any),
    cell(isZh ? '发行/变更描述' : 'Description', { fill: { color: COLORS.primary }, color: COLORS.white, bold: true, align: 'center', fontSize: 10, fontFace: FONTS.body } as any),
    cell(isZh ? '客户规格书版本' : 'Customer Spec', { fill: { color: COLORS.primary }, color: COLORS.white, bold: true, align: 'center', fontSize: 10, fontFace: FONTS.body } as any),
    cell(isZh ? '日期' : 'Date', { fill: { color: COLORS.primary }, color: COLORS.white, bold: true, align: 'center', fontSize: 10, fontFace: FONTS.body } as any),
    cell(isZh ? '发行/变更人' : 'Author', { fill: { color: COLORS.primary }, color: COLORS.white, bold: true, align: 'center', fontSize: 10, fontFace: FONTS.body } as any),
  ];

  const revisionAuthor = project.responsible?.trim() || '-';
  const revisionHistory = project.revision_history || [];
  const revisionRows: TableRow[] = revisionHistory.length > 0
    ? revisionHistory.map((item, idx) => row([
        String(idx + 1),
        item.version,
        item.content,
        '——',
        item.date,
        revisionAuthor,
      ]))
    : [
        row(['1', 'V1.0', isZh ? '原始版本发行' : 'Initial release', '——', project.date || '-', revisionAuthor]),
        row(['2', '', '', '', '', '']),
        row(['3', '', '', '', '', '']),
      ];

  const revisionHeaderRowH = 0.4;
  const revisionMaxDataRowH = 0.45;
  const revisionMinDataRowH = 0.28;
  const revisionContentTop = 0.9;
  const revisionContentBottom = SLIDE_LAYOUT.contentBottom - 0.1;
  const revisionAvailableHeight = revisionContentBottom - revisionContentTop;
  const revisionDataRowH = Math.min(
    revisionMaxDataRowH,
    Math.max(
      revisionMinDataRowH,
      (revisionAvailableHeight - revisionHeaderRowH) / Math.max(revisionRows.length, 1),
    ),
  );
  const revisionTableHeight = revisionHeaderRowH + revisionRows.length * revisionDataRowH;
  const revisionTableWidth = SLIDE_LAYOUT.contentWidth;
  const revisionTableX = (SLIDE_LAYOUT.width - revisionTableWidth) / 2;
  const revisionTableY = revisionContentTop + Math.max(0, (revisionAvailableHeight - revisionTableHeight) / 5);

  revisionSlide.addTable([revisionHeader, ...revisionRows], {
    x: revisionTableX,
    y: revisionTableY,
    w: revisionTableWidth,
    fontFace: FONTS.body,
    fontSize: 10,
    colW: [0.65, 0.85, 3.6, 1.75, 1.2, 1.15],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle',
    align: 'center',
    rowH: [
      revisionHeaderRowH,
      ...revisionRows.map(() => revisionDataRowH),
    ],
  });

  // (Camera installation guide slide removed)

  // ========== SLIDE 4: Full-page image ==========
  const fullImageSlide = pptx.addSlide({ masterName: undefined });
  const slide4ImageUrl = `${window.location.origin}/ppt-covers/4.jpg`;
  const slide4DataUri = await fetchImageAsDataUri(slide4ImageUrl);
  if (slide4DataUri) {
    fullImageSlide.addImage({
      data: slide4DataUri,
      x: 0, y: 0,
      w: SLIDE_LAYOUT.width,
      h: SLIDE_LAYOUT.height,
    });
  } else {
    fullImageSlide.addText('（图片未找到）', {
      x: 0, y: 0, w: '100%', h: '100%',
      align: 'center', valign: 'middle',
      fontSize: 24, color: COLORS.textSecondary,
    });
  }

  // ========== TABLE OF CONTENTS ==========
  progress = 14;
  onProgress(progress, isZh ? '生成模块目录...' : 'Generating module contents...', isZh ? '模块目录' : 'Module contents');
  const generatedModuleCount = workstations.reduce(
    (count, ws) => count + modules.filter(m => m.workstation_id === ws.id).length,
    0
  );
  const tocPageCount = getModuleTocPageCount(generatedModuleCount);
  const firstWorkstationSlideNumber = getPptxSlideCount(pptx) + tocPageCount + 1;
  const moduleTocEntries = buildModuleTocEntries(
    project.code,
    workstations,
    modules,
    annotations,
    firstWorkstationSlideNumber,
    isDraft
  );
  generateModuleTocSlides(pptx, moduleTocEntries, isZh);

  // ========== WORKSTATION SLIDES (Dynamic pages per workstation) ==========
  // Order: basic info + requirements -> product schematic -> mechanical layout -> module optical pages -> BOM.
  const totalWsProgress = 65;
  const progressPerWs = totalWsProgress / Math.max(workstations.length, 1);
  
  for (let i = 0; i < workstations.length; i++) {
    const ws = workstations[i];
    const wsLayout = layouts.find(l => l.workstation_id === ws.id) || null;
    const wsModules = modules.filter(m => m.workstation_id === ws.id);
    const wsCode = getWorkstationCode(project.code, i, ws.code);
    
    const wsModuleIds = new Set(wsModules.map(m => m.id));
    const wsAnnotations = annotations?.filter(a =>
      (a.scope_type === 'workstation' && a.workstation_id === ws.id) ||
      (a.scope_type === 'module' && a.module_id && wsModuleIds.has(a.module_id))
    ) || [];
    const wsProductAssets = (productAssets || [])
      .filter(a => a.scope_type === 'workstation' && a.workstation_id === ws.id)
      .sort((a, b) =>
        Number(b.is_primary ?? false) - Number(a.is_primary ?? false) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
    const wsProductAsset = wsProductAssets[0];

    const wsBaseProgress = 20 + i * progressPerWs;
    const moduleCount = Math.max(wsModules.length, 1);
    const totalSteps = 3 + moduleCount + 1; // basic + product + layout + N modules + BOM
    const stepIncrement = progressPerWs / totalSteps;
    
    onProgress(
      wsBaseProgress, 
      `${isZh ? '处理工位' : 'Processing workstation'} (${i + 1}/${workstations.length}): ${ws.name}`,
      `[WORKSTATION:${ws.name}:${i + 1}/${workstations.length}] ${isZh ? '开始生成工位页' : 'Starting workstation slides'}`
    );

    const ctx = {
      pptx,
      isZh,
      wsCode,
      wsName: ws.name,
      responsible: ws.design_responsible || project.responsible,
    };

    const slideData = {
      ws: {
        id: ws.id,
        name: ws.name,
        type: ws.type,
        design_responsible: ws.design_responsible ?? null,
        cycle_time: ws.cycle_time,
        product_dimensions: ws.product_dimensions,
        enclosed: ws.enclosed,
        process_stage: ws.process_stage,
        observation_target: ws.observation_target,
        acceptance_criteria: ws.acceptance_criteria,
        motion_description: ws.motion_description,
        shot_count: ws.shot_count,
        risk_notes: ws.risk_notes,
        action_script: ws.action_script,
        notes: ws.notes,
        description: (ws as unknown as Record<string, unknown>).description as string | null,
      },
      layout: wsLayout ? {
        workstation_id: wsLayout.workstation_id,
        conveyor_type: wsLayout.conveyor_type,
        camera_count: wsLayout.camera_count,
        camera_mounts: wsLayout.camera_mounts,
        camera_mounts_labels: (wsLayout as any).camera_mounts_labels || null,
        mechanisms: wsLayout.mechanisms,
        front_view_image_url: wsLayout.front_view_image_url,
        side_view_image_url: wsLayout.side_view_image_url,
        top_view_image_url: wsLayout.top_view_image_url,
        isometric_view_image_url: (wsLayout as any).isometric_view_image_url || null,
        primary_view: (wsLayout as any).primary_view || 'front',
        auxiliary_view: (wsLayout as any).auxiliary_view || 'side',
        layout_description: (wsLayout as any).layout_description || '',
        width: wsLayout.width,
        height: wsLayout.height,
        depth: wsLayout.depth,
        selected_cameras: wsLayout.selected_cameras,
        selected_lenses: wsLayout.selected_lenses,
        selected_lights: wsLayout.selected_lights,
        selected_controller: wsLayout.selected_controller,
      } : null,
      modules: wsModules.map(m => {
        const moduleUses3D = isModule3DCameraForOutput(m, projectUses3D);
        return {
          id: m.id,
          name: m.name,
          type: m.type,
          description: m.description,
          trigger_type: m.trigger_type,
          processing_time_limit: m.processing_time_limit,
          selected_camera: m.selected_camera,
          selected_lens: moduleUses3D ? null : m.selected_lens,
          selected_light: moduleUses3D ? null : m.selected_light,
          selected_controller: m.selected_controller,
          is_3d_camera: moduleUses3D,
          schematic_image_url: m.schematic_image_url,
          positioning_config: m.positioning_config,
          defect_config: m.defect_config,
          measurement_config: m.measurement_config,
          ocr_config: m.ocr_config,
          deep_learning_config: m.deep_learning_config,
          output_types: m.output_types,
          roi_strategy: m.roi_strategy,
          lighting_photos: (m as any).lighting_photos || [],
        };
      }),
      annotations: wsAnnotations.map(a => ({
        asset_id: (a as { asset_id?: string }).asset_id,
        snapshot_url: a.snapshot_url,
        annotations_json: a.annotations_json,
        remark: a.remark,
      })),
      productAsset: wsProductAsset ? {
        id: wsProductAsset.id,
        product_name: wsProductAsset.product_name ?? null,
        product_code: wsProductAsset.product_code ?? null,
        is_primary: wsProductAsset.is_primary ?? false,
        preview_images: wsProductAsset.preview_images,
        detection_method: wsProductAsset.detection_method,
        product_models: wsProductAsset.product_models as Array<{ name: string; spec: string }> | null,
        detection_requirements: wsProductAsset.detection_requirements as Array<{ content: string; highlight?: string | null }> | null,
      } : undefined,
      productAssets: wsProductAssets.map(p => ({
        id: p.id,
        product_name: p.product_name ?? null,
        product_code: p.product_code ?? null,
        is_primary: p.is_primary ?? false,
        preview_images: p.preview_images,
        detection_method: p.detection_method ?? null,
        product_models: p.product_models ?? null,
        detection_requirements: p.detection_requirements ?? null,
      })),
      hardware: hardware ? {
        cameras: hardware.cameras,
        lenses: hardware.lenses,
        lights: hardware.lights,
        controllers: hardware.controllers,
      } : undefined,
    };

    // a. 基本信息+检测要求 (Combined)
    let step = 0;
    onProgress(wsBaseProgress + stepIncrement * step, `${ws.name} - ${isZh ? '基本信息+检测要求' : 'Basic Info & Requirements'}`, `[SLIDE:${ws.name}:a] ${isZh ? '基本信息+检测要求' : 'Basic Info & Requirements'}`);
    generateBasicInfoAndRequirementsSlide(ctx, slideData);
    
    // b. 产品截图标注 (Product Schematic - variable pages)
    step++;
    onProgress(wsBaseProgress + stepIncrement * step, `${ws.name} - ${isZh ? '产品示意图' : 'Product'}`, `[SLIDE:${ws.name}:b] ${isZh ? '产品示意图' : 'Product schematic'}`);
    if (isDraft) {
      const draftProductSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
      draftProductSlide.addText(isZh ? '[草稿] 产品示意图 - 省略' : '[DRAFT] Product Schematic - Skipped', {
        x: 1, y: 2, w: 8, h: 1, fontSize: 18, fontFace: FONTS.body, color: COLORS.secondary, align: 'center',
      });
    } else {
      await generateProductSchematicSlide(ctx, slideData);
    }
    
    // c. 机械布局 (主辅视图 + 布局说明)
    step++;
    onProgress(wsBaseProgress + stepIncrement * step, `${ws.name} - ${isZh ? '机械布局' : 'Mechanical Layout'}`, `[SLIDE:${ws.name}:c] ${isZh ? '机械布局' : 'Mechanical Layout'}`);
    if (isDraft) {
      const draftLayoutSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
      draftLayoutSlide.addText(isZh ? '[草稿] 机械布局 - 省略' : '[DRAFT] Mechanical Layout - Skipped', {
        x: 1, y: 2, w: 8, h: 1, fontSize: 18, fontFace: FONTS.body, color: COLORS.secondary, align: 'center',
      });
    } else {
      await generateLayoutAndOpticalSlide(ctx, slideData);
    }

    // d. 光学方案 × N + 打光照片 (Each module's optical followed by its lighting photos)
    for (let mi = 0; mi < wsModules.length; mi++) {
      step++;
      const modName = wsModules[mi].name;
      onProgress(wsBaseProgress + stepIncrement * step, `${ws.name} - ${isZh ? '光学方案' : 'Optical'}: ${modName}`, `[SLIDE:${ws.name}:d${mi + 1}] ${isZh ? '光学方案' : 'Optical'}: ${modName}`);
      if (isDraft) {
        const draftOpticalSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
        draftOpticalSlide.addText(`${isZh ? '[草稿] 光学方案' : '[DRAFT] Optical'}: ${modName}`, {
          x: 1, y: 2, w: 8, h: 1, fontSize: 18, fontFace: FONTS.body, color: COLORS.secondary, align: 'center',
        });
      } else {
        await generateModuleOpticalSlide(ctx, slideData, mi);

        // 紧跟该模块的打光照片
        const photos = (wsModules[mi] as any).lighting_photos || [];
        if (photos.length > 0) {
          step++;
          onProgress(wsBaseProgress + stepIncrement * step, `${ws.name} - ${isZh ? '打光照片' : 'Lighting'}: ${modName}`, `[SLIDE:${ws.name}:e${mi + 1}] ${isZh ? '打光照片' : 'Lighting photos'}: ${modName}`);
          await generateLightingPhotosSlide(ctx, slideData, mi);
        }
      }
    }

    // f. BOM清单+审核
    step++;
    onProgress(wsBaseProgress + stepIncrement * step, `${ws.name} - ${isZh ? 'BOM清单' : 'BOM'}`, `[SLIDE:${ws.name}:f] ${isZh ? 'BOM清单' : 'BOM list'}`);
    generateBOMSlide(ctx, slideData);
  }

  // Hardware detail slides removed - only summary table is generated

  // ========== HARDWARE SUMMARY SLIDE (16:9) ==========
  progress = 92;
  onProgress(progress, isZh ? '生成硬件清单...' : 'Generating hardware list...', isZh ? '硬件清单汇总' : 'Hardware summary');

  const createHardwareSummarySlide = (pageLabel = '') => {
    const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    slide.addText(`${isZh ? '硬件清单汇总' : 'Hardware Summary'}${pageLabel}`, {
      ...MASTER_SLIDE_TITLE,
    });
    slide.addText(isZh ? '设备清单' : 'Equipment List', {
      x: 0, y: st.y, w: '100%', h: st.h,
      fontSize: st.fontSize, fontFace: st.fontFace, color: st.color, align: st.align, valign: st.valign,
      bold: st.bold, italic: st.italic,
    });
    return slide;
  };

  const hwSlide = createHardwareSummarySlide();

  // Aggregate hardware by physical workstation slots. Modules can reuse CAM1/CAM2 etc.,
  // so counting by module would duplicate shared hardware.
  const hwCountMap = new Map<string, { type: string; brand: string; model: string; count: number }>();

  const addToMap = (type: string, brand: string, model: string) => {
    const key = `${type}||${brand}||${model}`;
    const existing = hwCountMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      hwCountMap.set(key, { type, brand, model, count: 1 });
    }
  };

  let hasLayoutHardware = false;
  for (const layout of layouts) {
    const selectedCameras = safeHardwareArray(layout.selected_cameras);
    const selectedLenses = safeHardwareArray(layout.selected_lenses);
    const selectedLights = safeHardwareArray(layout.selected_lights);
    const selectedController = safeController(layout.selected_controller);

    selectedCameras.forEach(cam => {
      if (cam.brand && cam.model) {
        hasLayoutHardware = true;
        addToMap(isZh ? '工业相机' : 'Industrial Camera', cam.brand, cam.model);
      }
    });
    selectedLenses.forEach(lens => {
      if (lens.brand && lens.model) {
        hasLayoutHardware = true;
        addToMap(isZh ? '工业镜头' : 'Industrial Lens', lens.brand, lens.model);
      }
    });
    selectedLights.forEach(light => {
      if (light.brand && light.model) {
        hasLayoutHardware = true;
        addToMap(isZh ? '光源' : 'Light Source', light.brand, light.model);
      }
    });
    if (selectedController?.brand && selectedController.model) {
      hasLayoutHardware = true;
      addToMap(isZh ? '工控机' : 'Industrial PC', selectedController.brand, selectedController.model);
    }
  }

  // Fallback for old data without workstation hardware slots.
  if (!hasLayoutHardware && hardware) {
    const seenSelections = new Set<string>();
    const addUniqueModuleSelection = (kind: string, id: string | null | undefined, add: () => void) => {
      if (!id) return;
      const key = `${kind}:${id}`;
      if (seenSelections.has(key)) return;
      seenSelections.add(key);
      add();
    };

    for (const m of modules) {
      addUniqueModuleSelection('camera', m.selected_camera, () => {
        const cam = hardware.cameras.find(c => c.id === m.selected_camera);
        if (cam) addToMap(isZh ? '工业相机' : 'Industrial Camera', cam.brand, cam.model);
      });
      addUniqueModuleSelection('lens', m.selected_lens, () => {
        const lens = hardware.lenses.find(l => l.id === m.selected_lens);
        if (lens) addToMap(isZh ? '工业镜头' : 'Industrial Lens', lens.brand, lens.model);
      });
      addUniqueModuleSelection('light', m.selected_light, () => {
        const light = hardware.lights.find(l => l.id === m.selected_light);
        if (light) addToMap(isZh ? '光源' : 'Light Source', light.brand, light.model);
      });
      addUniqueModuleSelection('controller', m.selected_controller, () => {
        const ctrl = hardware.controllers.find(c => c.id === m.selected_controller);
        if (ctrl) addToMap(isZh ? '工控机' : 'Industrial PC', ctrl.brand, ctrl.model);
      });
    }
  }

  const hwItems = Array.from(hwCountMap.values());
  let totalDevices = hwItems.reduce((sum, item) => sum + item.count, 0);

  // Header row
  const hwHeader: TableRow[] = [
    row([
      isZh ? '序号' : 'No.',
      isZh ? '设备类型' : 'Device Type',
      isZh ? '品牌' : 'Brand',
      isZh ? '型号' : 'Model',
      isZh ? '数量' : 'Qty',
      isZh ? '备注' : 'Notes',
    ]),
  ];

  // Data rows
  const hwDataRows: TableRow[] = hwItems.map((item, idx) =>
    row([
      String(idx + 1),
      item.type,
      item.brand,
      item.model,
      String(item.count),
      '',
    ])
  );

  // Total row
  const hwTotalRow: TableRow[] = [
    row(['', '', '', isZh ? '总计' : 'Total', `${totalDevices}${isZh ? '台' : ''}`, '']),
  ];

  // Evenly distribute rows across pages so each page table has consistent size.
  // Rule: ≤15 items → 1 page; >15 → split evenly (e.g. 20 → 10/10, 31 → 11/11/9).
  const MAX_ROWS_PER_PAGE = 15;
  const totalItems = hwDataRows.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / MAX_ROWS_PER_PAGE));
  const rowsPerPage = pageCount > 0 ? Math.ceil(totalItems / pageCount) : MAX_ROWS_PER_PAGE;
  const hardwareChunks: TableRow[][] = [];
  for (let i = 0; i < totalItems; i += rowsPerPage) {
    hardwareChunks.push(hwDataRows.slice(i, i + rowsPerPage));
  }
  if (hardwareChunks.length === 0) {
    hardwareChunks.push([]);
  }

  // Fixed row heights so every page renders an identically-sized table,
  // regardless of how many rows that specific page holds.
  const HEADER_ROW_H = 0.32;
  const DATA_ROW_H = 0.34;

  const hardwareTableOptions = {
    x: SLIDE_LAYOUT.contentLeft,
    y: 0.85,
    w: SLIDE_LAYOUT.contentWidth,
    fontFace: FONTS.body,
    fontSize: 8,
    colW: [0.5, 1.4, 1.2, 2.0, 0.6, 1.8],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle' as const,
    align: 'center' as const,
  };

  hardwareChunks.forEach((chunk, pageIndex) => {
    const isLastPage = pageIndex === hardwareChunks.length - 1;
    const slide = pageIndex === 0
      ? hwSlide
      : createHardwareSummarySlide(` (${pageIndex + 1}/${hardwareChunks.length})`);
    const totalRowCount = 1 + chunk.length + (isLastPage ? 1 : 0);
    const rowH: number[] = [
      HEADER_ROW_H,
      ...Array(chunk.length + (isLastPage ? 1 : 0)).fill(DATA_ROW_H),
    ];
    void totalRowCount;
    slide.addTable(
      [...hwHeader, ...chunk, ...(isLastPage ? hwTotalRow : [])],
      { ...hardwareTableOptions, rowH },
    );
  });


  // ========== END SLIDE (16:9 optimized) ==========
  progress = 98;
  onProgress(progress, isZh ? '生成封底页...' : 'Generating end slide...', isZh ? '封底页' : 'End slide');
  const endSlide = pptx.addSlide();
  const endImageUrl = `${window.location.origin}/ppt-covers/end.jpg`;
  const endImageData = await fetchImageAsDataUri(endImageUrl, { timeoutMs: 60000 });
  if (endImageData) {
    endSlide.addImage({
      data: endImageData,
      x: 0,
      y: 0,
      w: SLIDE_LAYOUT.width,
      h: SLIDE_LAYOUT.height,
    });
  } else {
    endSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
      fill: { color: COLORS.background },
    });
    endSlide.addText(isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN, {
      x: 1,
      y: 2.3,
      w: 8,
      h: 0.5,
      fontSize: 20,
      fontFace: FONTS.heading,
      color: COLORS.primary,
      bold: true,
      align: 'center',
    });
  }

  // Generate blob
  progress = 100;
  onProgress(progress, isZh ? '完成' : 'Complete', isZh ? 'PPT生成完成' : 'PPT generation complete');

  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  return blob;
}
