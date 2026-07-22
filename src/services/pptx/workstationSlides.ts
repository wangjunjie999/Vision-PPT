/**
 * Per-Workstation Slide Generators
 * Generates slides in the correct order as specified:
 * 0. Workstation Title (DB号 + 工位名 + 负责人)
 * 1. Basic Information (基本信息)
 * 2. Product Schematic (产品示意图)
 * 3. Technical Requirements (技术要求)
 * 4. Mechanical Layout Three Views (机械布局三视图 - 等比例)
 * 5. Schematic Diagram (示意图/布置图)
 * 6. Motion / Module Category (运动方式/模块分类)
 * 7. Optical Solution (光学方案)
 * 8. Measurement & Vision List (测量方法及视觉清单)
 * 9. BOM List & Review (BOM清单及审核)
 */

import type PptxGenJS from 'pptxgenjs';
import { fetchImageAsDataUri } from './imagePreloader';
import { calculateContainFit, getImageDimensions, calculateThreeViewLayout, trimImageWhitespaceDataUri } from './imageLayoutUtils';
import { 
  COLORS, 
  SLIDE_LAYOUT, 
  MODULE_TYPE_LABELS, 
  WS_TYPE_LABELS, 
  TRIGGER_LABELS,
  PROCESS_STAGE_LABELS,
  FONTS,
  MASTER_SLIDE_SUBTITLE,
  MASTER_SLIDE_TITLE,
  createHeadingShadow,
} from './slideLabels';
import { 
  MECHANISM_LABELS, 
  CAMERA_MOUNT_LABELS, 
  getLabel 
} from '@/services/labelMaps';
import { formatDefectItems, normalizeDefectItemsFromConfig } from '@/utils/defectItems';
import {
  buildModuleVisionChecklist,
  buildModuleVisionChecklistLines,
  type ModuleVisionChecklist,
} from '@/utils/moduleVisionChecklist';
import { formatWorkstationCycleTime } from '@/utils/cycleTimeDisplay';
import { buildThreeDMeasurementChecklist, getThreeDDisplayInfo, type ThreeDDisplayInfo } from '@/components/forms/module/threeDCamera';

// Type definitions
type TableCell = { text: string; options?: Record<string, unknown> };
type TableRow = TableCell[];

const cell = (text: string, opts?: Partial<TableCell>): TableCell => ({ text, options: opts });
const row = (cells: string[]): TableRow => cells.map(t => cell(t));

// ===== Hardware Data Types for Complete Info =====
interface FullCameraData {
  id: string;
  brand: string;
  model: string;
  resolution?: string | null;
  sensor_size?: string | null;
  interface?: string | null;
  frame_rate?: number | null;
  image_url?: string | null;
}

interface FullLensData {
  id: string;
  brand: string;
  model: string;
  focal_length?: string | null;
  aperture?: string | null;
  max_sensor_size?: string | null;
  mount?: string | null;
  image_url?: string | null;
}

interface FullLightData {
  id: string;
  brand: string;
  model: string;
  type?: string | null;
  color?: string | null;
  power?: string | null;
  image_url?: string | null;
}

interface FullControllerData {
  id: string;
  brand: string;
  model: string;
  cpu?: string | null;
  gpu?: string | null;
  memory?: string | null;
  storage?: string | null;
  image_url?: string | null;
}

/**
 * Add image placeholder with emoji indicator
 * Used when image fails to load or is missing
 */
function addImagePlaceholder(
  slide: ReturnType<PptxGenJS['addSlide']>,
  container: { x: number; y: number; width: number; height: number },
  message: string,
  emoji: string
): void {
  slide.addShape('rect', {
    x: container.x, 
    y: container.y, 
    w: container.width, 
    h: container.height,
    fill: { color: COLORS.border },
  });
  slide.addText(`${emoji} ${message}`, {
    x: container.x, 
    y: container.y + container.height / 2 - 0.15,
    w: container.width, 
    h: 0.3,
    fontSize: 9, fontFace: FONTS.body,
    color: COLORS.secondary, 
    align: 'center',
  });
}

/**
 * Unified slide title with Tech-Shine corporate style
 * Main navy header bar + medium blue subtitle bar below
 * Supports single subtitle or split left/right subtitles (图93风格)
 */
function addSlideTitle(
  slide: ReturnType<PptxGenJS['addSlide']>,
  ctx: SlideContext,
  subtitle: string,
  splitSubtitles?: { left: string; right: string }
): void {
  // Main title text overlaid on the navy header bar (primary blue)
  slide.addText(`${ctx.wsCode} ${ctx.wsName}`, {
    ...MASTER_SLIDE_TITLE,
  });

  const st = MASTER_SLIDE_SUBTITLE;
  if (splitSubtitles) {
    // Split subtitle text (no rect, bg image has the blue bar)
    slide.addText(splitSubtitles.left, {
      x: 0, y: st.y, w: '50%', h: st.h,
      fontSize: st.fontSize, fontFace: st.fontFace, color: st.color, align: st.align, valign: st.valign,
      bold: st.bold, italic: st.italic,
    });
    slide.addText(splitSubtitles.right, {
      x: '50%', y: st.y, w: '50%', h: st.h,
      fontSize: st.fontSize, fontFace: st.fontFace, color: st.color, align: st.align, valign: st.valign,
      bold: st.bold, italic: st.italic,
    });
  } else {
    // Single subtitle text (no rect, bg image has the blue bar)
    slide.addText(subtitle, {
      x: 0, y: st.y, w: '100%', h: st.h,
      fontSize: st.fontSize, fontFace: st.fontFace, color: st.color, align: st.align, valign: st.valign,
      bold: st.bold, italic: st.italic,
    });
  }
}

const TABLE_SAFE_BOTTOM_Y = SLIDE_LAYOUT.contentBottom - 0.18;

function getBodyRowsPerPage(
  tableY: number,
  rowHeight: number,
  headerRowCount = 0,
  bottomY = TABLE_SAFE_BOTTOM_Y
): number {
  const availableHeight = Math.max(rowHeight, bottomY - tableY - 0.08);
  return Math.max(1, Math.floor(availableHeight / rowHeight) - headerRowCount);
}

function withSafeTableHeight(
  options: Record<string, unknown>,
  rowCount: number,
  rowHeight: number,
  bottomY = TABLE_SAFE_BOTTOM_Y
): Record<string, unknown> {
  const y = typeof options.y === 'number' ? options.y : 1;
  const requestedHeight = typeof options.h === 'number'
    ? options.h
    : rowCount * rowHeight + 0.08;
  const maxHeight = Math.max(rowHeight, bottomY - y);
  return {
    ...options,
    h: Math.min(requestedHeight, maxHeight),
  };
}

function addSafeTable(
  slide: ReturnType<PptxGenJS['addSlide']>,
  rows: TableRow[],
  options: Record<string, unknown>,
  rowHeight = 0.28,
  bottomY = TABLE_SAFE_BOTTOM_Y
): void {
  slide.addTable(rows, withSafeTableHeight(options, rows.length, rowHeight, bottomY) as any);
}

function addContinuationTableSlides(
  ctx: SlideContext,
  subtitle: string,
  sectionTitle: string,
  headerRows: TableRow[],
  bodyRows: TableRow[],
  tableOptions: Record<string, unknown>,
  rowHeight = 0.28
): void {
  if (bodyRows.length === 0) return;

  const tableY = typeof tableOptions.y === 'number' ? tableOptions.y : 1.15;
  const maxBodyRows = getBodyRowsPerPage(tableY, rowHeight, headerRows.length);
  const chunks: TableRow[][] = [];
  for (let i = 0; i < bodyRows.length; i += maxBodyRows) {
    chunks.push(bodyRows.slice(i, i + maxBodyRows));
  }

  chunks.forEach((chunk, index) => {
    const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    addSlideTitle(slide, ctx, `${subtitle} - ${sectionTitle} (${index + 1}/${chunks.length})`);
    slide.addText(sectionTitle, {
      x: tableOptions.x as number,
      y: Math.max(0.9, tableY - 0.28),
      w: tableOptions.w as number,
      h: 0.22,
      fontSize: 10,
      fontFace: FONTS.body,
      color: COLORS.primary,
      bold: true,
    });
    addSafeTable(slide, [...headerRows, ...chunk], tableOptions, rowHeight);
  });
}

function addPaginatedTable(
  ctx: SlideContext,
  slide: ReturnType<PptxGenJS['addSlide']>,
  subtitle: string,
  sectionTitle: string,
  headerRows: TableRow[],
  bodyRows: TableRow[],
  tableOptions: Record<string, unknown>,
  config: {
    rowHeight?: number;
    firstPageMaxBodyRows?: number;
    firstPageBottomY?: number;
    continuationOptions?: Record<string, unknown>;
    continuationRowHeight?: number;
  } = {}
): void {
  const rowHeight = config.rowHeight ?? 0.28;
  const tableY = typeof tableOptions.y === 'number' ? tableOptions.y : 1;
  const firstMaxRows = config.firstPageMaxBodyRows ?? getBodyRowsPerPage(
    tableY,
    rowHeight,
    headerRows.length,
    config.firstPageBottomY ?? TABLE_SAFE_BOTTOM_Y
  );
  const firstBodyRows = bodyRows.slice(0, firstMaxRows);
  addSafeTable(
    slide,
    [...headerRows, ...firstBodyRows],
    tableOptions,
    rowHeight,
    config.firstPageBottomY ?? TABLE_SAFE_BOTTOM_Y
  );

  const remainingRows = bodyRows.slice(firstMaxRows);
  addContinuationTableSlides(
    ctx,
    subtitle,
    sectionTitle,
    headerRows,
    remainingRows,
    config.continuationOptions ?? tableOptions,
    config.continuationRowHeight ?? rowHeight
  );
}

interface SlideContext {
  pptx: PptxGenJS;
  isZh: boolean;
  wsCode: string;
  wsName: string;
  responsible: string | null;
}

interface WorkstationAcceptanceCriteria {
  accuracy?: string | null;
  detection_content?: string | null;
  cycle_time?: string | null;
  compatible_sizes?: string | null;
}

interface WorkstationSlideData {
  ws: {
    id: string;
    name: string;
    type: string;
    design_responsible?: string | null;
    cycle_time: number | null;
    product_dimensions: { length: number; width: number; height: number } | null;
    enclosed: boolean | null;
    process_stage?: string | null;
    observation_target?: string | null;
    acceptance_criteria?: WorkstationAcceptanceCriteria | null;
    motion_description?: string | null;
    shot_count?: number | null;
    risk_notes?: string | null;
    action_script?: string | null;
    description?: string | null;
    notes?: string | null;
  };
  layout: {
    workstation_id: string;
    conveyor_type: string | null;
    camera_count: number | null;
    camera_mounts: string[] | null;
    camera_mounts_labels?: string | null;
    mechanisms: string[] | null;
    front_view_image_url?: string | null;
    side_view_image_url?: string | null;
    top_view_image_url?: string | null;
    primary_view?: string | null;
    auxiliary_view?: string | null;
    layout_description?: string | null;
    width?: number | null;
    height?: number | null;
    depth?: number | null;
    selected_cameras?: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
    selected_lenses?: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
    selected_lights?: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
    selected_controller?: { id: string; brand: string; model: string; image_url?: string | null } | null;
  } | null;
  modules: Array<{
    id: string;
    name: string;
    type: string;
    description?: string | null;
    trigger_type: string | null;
    processing_time_limit: number | null;
    selected_camera?: string | null;
    selected_camera_info?: { id?: string | null; brand?: string | null; model?: string | null; resolution?: string | null; specs?: Record<string, string> | null } | null;
    selected_lens?: string | null;
    selected_light?: string | null;
    selected_controller?: string | null;
    is_3d_camera?: boolean;
    schematic_image_url?: string | null;
    positioning_config?: Record<string, unknown> | null;
    defect_config?: Record<string, unknown> | null;
    measurement_config?: Record<string, unknown> | null;
    ocr_config?: Record<string, unknown> | null;
    deep_learning_config?: Record<string, unknown> | null;
    output_types?: string[] | null;
    roi_strategy?: string | null;
    lighting_photos?: Array<{ url: string; remark?: string; created_at?: string }> | null;
  }>;
  annotations?: Array<{
    asset_id?: string;
    snapshot_url: string;
    annotations_json: Array<{ labelNumber?: number; label?: string; number?: number; name?: string; category?: string; description?: string }>;
    remark?: string | null;
  }>;
  productAsset?: {
    id?: string;
    product_name?: string | null;
    product_code?: string | null;
    is_primary?: boolean;
    preview_images: Array<{ url: string; name?: string }> | null;
    detection_method?: string | null;
    product_models?: Array<{ name: string; spec: string }> | null;
    detection_requirements?: Array<{ content: string; highlight?: string | null }> | null;
  };
  productAssets?: Array<{
    id: string;
    product_name?: string | null;
    product_code?: string | null;
    is_primary?: boolean;
    preview_images: Array<{ url: string; name?: string }> | null;
    detection_method?: string | null;
    product_models?: Array<{ name: string; spec: string }> | null;
    detection_requirements?: Array<{ content: string; highlight?: string | null }> | null;
  }>;
  // NEW: Complete hardware data for detailed parameters
  hardware?: {
    cameras: FullCameraData[];
    lenses: FullLensData[];
    lights: FullLightData[];
    controllers: FullControllerData[];
  };
}

export type { WorkstationSlideData, FullCameraData, FullLensData, FullLightData, FullControllerData };

export interface ModuleOpticalSlideTextContent {
  checklist: ModuleVisionChecklist;
  checklistItems: string[];
  methodDescription: string;
}

export function buildModuleOpticalSlideTextContent({
  module,
  data,
  isZh,
}: {
  module: WorkstationSlideData['modules'][number];
  data: Pick<WorkstationSlideData, 'ws' | 'layout' | 'hardware'>;
  isZh: boolean;
}): ModuleOpticalSlideTextContent {
  const language = isZh ? 'zh' : 'en';
  const checklist = buildModuleVisionChecklist({
    module,
    workstation: data.ws,
    layout: data.layout,
    hardware: data.hardware,
    language,
  });

  const areaScanDefault = isZh
    ? '1. 产品到位，触发拍照\n2. 图像采集与处理\n3. 结果判定与输出'
    : '1. Product arrives, trigger capture\n2. Image acquisition & processing\n3. Result judgment & output';
  const lineScanDefault = isZh
    ? '1. 线扫相机固定安装，由运动机构带动产品或相机按设定扫描速度完成连续扫描\n2. 获取线扫图像后进行拼接与处理，完成相应视觉任务并输出结果'
    : '1. The line-scan camera is fixed while the product or camera moves continuously at the configured scan speed\n2. Stitch and process the line-scan image, then perform the configured vision task and output the result';

  const methodDescription = checklist.cameraType === 'line_scan'
    ? [module.description, data.ws.motion_description, data.ws.action_script]
      .find(value => typeof value === 'string' && value.trim())
      ?.trim() || lineScanDefault
    : module.description || data.ws.motion_description || data.ws.action_script || areaScanDefault;

  return {
    checklist,
    checklistItems: buildModuleVisionChecklistLines(checklist, language),
    methodDescription,
  };
}

export interface WorkstationTechnicalRequirementTables {
  basicInfoRows: string[][];
  moduleRows: string[][];
  detectionContentRows: string[][];
  noteText: string;
}

function filledOrDash(value: unknown): string {
  const text = value == null ? '' : String(value).trim();
  return text || '-';
}

function blankIfMissing(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function formatProductDimensions(dims: WorkstationSlideData['ws']['product_dimensions']): string {
  if (!dims) return '-';
  const { length, width, height } = dims;
  if (length == null || width == null || height == null) return '-';
  return `${length} × ${width} × ${height} mm`;
}

function buildModuleNameRows(modules: WorkstationSlideData['modules']): string[][] {
  const moduleNames = modules
    .map(mod => String(mod.name || '').trim())
    .filter(Boolean);
  return moduleNames.length > 0
    ? moduleNames.map(name => [name])
    : [['-']];
}

export function buildWorkstationTechnicalRequirementTables({
  isZh,
  wsCode,
  wsName,
  ws,
  modules,
}: {
  isZh: boolean;
  wsCode: string;
  wsName: string;
  ws: WorkstationSlideData['ws'];
  modules: WorkstationSlideData['modules'];
}): WorkstationTechnicalRequirementTables {
  const acceptance = ws.acceptance_criteria || {};
  const wsTypeLabel = WS_TYPE_LABELS[ws.type]?.[isZh ? 'zh' : 'en'] || ws.type;

  const basicInfoRows = [
    [isZh ? '工位编号' : 'Code', filledOrDash(wsCode)],
    [isZh ? '工位名称' : 'Name', filledOrDash(wsName)],
    [isZh ? '设计负责人' : 'Design Responsible', filledOrDash(ws.design_responsible)],
    [isZh ? '工位类型' : 'Type', filledOrDash(wsTypeLabel)],
    [isZh ? '工位节拍' : 'Station Cycle Time', formatWorkstationCycleTime(ws)],
    [isZh ? '精度要求' : 'Accuracy', filledOrDash(acceptance.accuracy)],
    [isZh ? '产品尺寸' : 'Product Size', formatProductDimensions(ws.product_dimensions)],
  ];

  return {
    basicInfoRows,
    moduleRows: buildModuleNameRows(modules),
    detectionContentRows: [[filledOrDash(acceptance.detection_content)]],
    noteText: blankIfMissing(ws.notes),
  };
}

/**
 * Slide 0: Workstation Title
 * DB号 + 工位名 + 负责人
 * Tech-Shine corporate style: Clean with orange accent
 */
export function generateWorkstationTitleSlide(
  ctx: SlideContext,
  _data: WorkstationSlideData
): void {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  
  // Large title with workstation code - using primary orange color
  slide.addText(ctx.wsCode, {
    x: 0.5, y: 1.6, w: 9, h: 0.6,
    fontSize: 36, fontFace: FONTS.heading, color: COLORS.primary, bold: true, align: 'center',
    shadow: createHeadingShadow(),
  });
  
  // Workstation name - dark text
  slide.addText(ctx.wsName, {
    x: 0.5, y: 2.3, w: 9, h: 0.5,
    fontSize: 24, fontFace: FONTS.heading, color: COLORS.dark, bold: true, align: 'center',
    shadow: createHeadingShadow(),
  });
  
  // Responsible person - secondary gray
  if (ctx.responsible) {
    slide.addText(`${ctx.isZh ? '负责人' : 'Responsible'}: ${ctx.responsible}`, {
      x: 0.5, y: 3.0, w: 9, h: 0.4,
      fontSize: 14, fontFace: FONTS.heading, color: COLORS.secondary, align: 'center',
      shadow: createHeadingShadow(),
    });
  }
  
  // Decorative elements - orange accent line
  slide.addShape('rect', {
    x: 4, y: 3.6, w: 2, h: 0.04,
    fill: { color: COLORS.primary },
  });
  
  // Subtle side decorations (optional - adds visual interest)
  slide.addShape('rect', {
    x: 0, y: 1.4, w: 0.08, h: 1.6,
    fill: { color: COLORS.primary },
  });
}

/**
 * Slide 1: Basic Information (基本信息)
 */
export function generateBasicInfoSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): void {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { ws, layout, modules } = data;
  
  addSlideTitle(slide, ctx, ctx.isZh ? '基本信息' : 'Basic Info');

  // Workstation description (NEW - shows workstation description if available)
  if (ws.description) {
    slide.addText(ctx.isZh ? '【工位描述】' : '[Workstation Description]', {
      x: 0.5, y: 1.1, w: 9, h: 0.25,
      fontSize: 10, fontFace: FONTS.body, color: COLORS.secondary, bold: true,
    });
    slide.addText(ws.description, {
      x: 0.5, y: 1.38, w: 9, h: 0.35,
      fontSize: 9, fontFace: FONTS.body, color: COLORS.dark,
    });
  }

  const startY = ws.description ? 1.8 : 1.2;

  // Detection method summary
  const detectionMethods = modules.map(m => {
    const typeLabel = MODULE_TYPE_LABELS[m.type]?.[ctx.isZh ? 'zh' : 'en'] || m.type;
    return typeLabel;
  });
  const cameraCount = layout?.camera_count || modules.length;
  const methodSummary = `${cameraCount}${ctx.isZh ? '相机' : ' cameras'} - ${detectionMethods.join('/')}`;
  
  slide.addText(ctx.isZh ? '【模块分类】' : '[Module Category]', {
    x: 0.5, y: startY, w: 9, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });
  slide.addText(methodSummary, {
    x: 0.5, y: startY + 0.28, w: 9, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.dark,
  });

  // Compatible sizes / Key dimensions
  const dims = ws.product_dimensions;
  slide.addText(ctx.isZh ? '【产品尺寸】' : '[Product Size]', {
    x: 0.5, y: startY + 0.65, w: 4.3, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });
  slide.addText(dims ? `${dims.length} × ${dims.width} × ${dims.height} mm` : '-', {
    x: 0.5, y: startY + 0.93, w: 4.3, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.dark,
  });

  // Detection requirements (show module names)
  slide.addText(ctx.isZh ? '【检测要求】' : '[Detection Requirements]', {
    x: 5, y: startY + 0.65, w: 4.5, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });
  const moduleNames = modules.map(m => m.name).join('、');
  const detectionReq = moduleNames || detectionMethods.join('、') || (ws.observation_target || '-');
  slide.addText(detectionReq, {
    x: 5, y: startY + 0.93, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.dark,
  });

  // Precision/Resolution/Pixels
  const accuracy = ws.acceptance_criteria?.accuracy || '-';
  slide.addText(ctx.isZh ? '【精度/分辨率/像素】' : '[Accuracy/Resolution/Pixels]', {
    x: 0.5, y: startY + 1.3, w: 4.3, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });
  slide.addText(accuracy, {
    x: 0.5, y: startY + 1.58, w: 4.3, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.dark,
  });

  // Cycle time
  slide.addText(ctx.isZh ? '【工位节拍】' : '[Station Cycle Time]', {
    x: 5, y: startY + 1.3, w: 4.5, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });
  slide.addText(formatWorkstationCycleTime(ws), {
    x: 5, y: startY + 1.58, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.dark,
  });

  // Key notes
  slide.addText(ctx.isZh ? '【关键备注】' : '[Key Notes]', {
    x: 0.5, y: startY + 2.0, w: 9, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.warning, bold: true,
  });
  
  const notes = ws.risk_notes || (ctx.isZh 
    ? '• 精度需以实际样品验证\n• 视野评估需现场确认' 
    : '• Accuracy to be verified with samples\n• FOV evaluation on-site');
  
  slide.addShape('rect', {
    x: 0.5, y: startY + 2.28, w: 9, h: 0.95,
    fill: { color: 'FFF8E1' },
    line: { color: COLORS.warning, width: 0.5 },
  });
  slide.addText(notes, {
    x: 0.7, y: startY + 2.35, w: 8.6, h: 0.8,
    fontSize: 9, fontFace: FONTS.body, color: COLORS.dark,
  });
}

/**
 * Slide 2: Product Schematic (产品示意图)
 */
export async function generateProductSchematicSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): Promise<void> {
  const { annotations: allAnnotations, productAsset } = data;
  const annotationsList = allAnnotations && allAnnotations.length > 0 ? allAnnotations : [];
  console.log(`[PPT] 产品示意图: annotations=${annotationsList.length}, hasProductAsset=${!!productAsset}, previewImages=${productAsset?.preview_images?.length || 0}`);
  
  if (annotationsList.length > 0) {
    // Generate one slide per annotation
    for (let ai = 0; ai < annotationsList.length; ai++) {
      const annotation = annotationsList[ai];
      const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
      const subtitle = annotationsList.length > 1
        ? `${ctx.isZh ? '产品示意图' : 'Product Schematic'} ${ai + 1}/${annotationsList.length}`
        : (ctx.isZh ? '产品示意图' : 'Product Schematic');
      addSlideTitle(slide, ctx, subtitle);

      try {
        const dataUri = await fetchImageAsDataUri(annotation.snapshot_url);
        if (dataUri) {
          const dims = await getImageDimensions(dataUri).catch(() => ({ width: 800, height: 600 }));
          const fit = calculateContainFit(dims.width, dims.height, { x: 0.5, y: 1.2, width: 5.5, height: 3.8 });
          slide.addImage({ data: dataUri, x: fit.x, y: fit.y, w: fit.width, h: fit.height });
        } else {
          console.warn('[PPT] 标注快照加载失败:', annotation.snapshot_url);
          addImagePlaceholder(slide, { x: 0.5, y: 1.2, width: 5.5, height: 3.8 }, ctx.isZh ? '图片加载失败' : 'Image load failed', '📷');
        }
      } catch (e) {
        addImagePlaceholder(slide, { x: 0.5, y: 1.2, width: 5.5, height: 3.8 }, ctx.isZh ? '待上传产品图片' : 'Upload product image', '📷');
      }

      // Annotation legend
      slide.addText(ctx.isZh ? '标注说明' : 'Annotation Legend', {
        x: 6.2, y: 1.2, w: 3.3, h: 0.3, fontSize: 11, fontFace: FONTS.body, color: COLORS.dark, bold: true,
      });
      const annotItems = Array.isArray(annotation.annotations_json) ? annotation.annotations_json : [];
      const legendRows: TableRow[] = annotItems
        .filter(item => (item.labelNumber || item.number) && (item.label || item.name))
        .map(item => {
          const num = item.labelNumber || item.number || 0;
          const label = item.label || item.name || '';
          const detail = item.category ? `[${item.category}] ${label}` : label;
          return row([`#${num}`, detail]);
        });
      if (legendRows.length > 0) {
        addPaginatedTable(ctx, slide, 'Product Schematic', 'Annotation Legend', [], legendRows, {
          x: 6.2, y: 1.55, w: 3.3, h: Math.min(legendRows.length * 0.32 + 0.1, 2.8),
          fontFace: FONTS.body, fontSize: 9, colW: [0.6, 2.7],
          border: { pt: 0.5, color: COLORS.border }, fill: { color: COLORS.white },
        }, {
          rowHeight: 0.32,
          firstPageBottomY: 4.35,
          continuationOptions: {
            x: 0.5, y: 1.2, w: 9,
            fontFace: FONTS.body, fontSize: 9, colW: [1.0, 8.0],
            border: { pt: 0.5, color: COLORS.border }, fill: { color: COLORS.white },
          },
          continuationRowHeight: 0.32,
        });
      }
      if (annotation.remark) {
        slide.addText(annotation.remark, { x: 6.2, y: 4.5, w: 3.3, h: 0.5, fontSize: 9, fontFace: FONTS.body, color: COLORS.secondary });
      }
    }
  } else {
    // Fallback: use product asset preview image
    const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    addSlideTitle(slide, ctx, ctx.isZh ? '产品示意图' : 'Product Schematic');
    const imageUrl = productAsset?.preview_images?.[0]?.url;
    if (imageUrl) {
      try {
        const dataUri = await fetchImageAsDataUri(imageUrl);
        if (dataUri) {
          const dims = await getImageDimensions(dataUri).catch(() => ({ width: 800, height: 600 }));
          const fit = calculateContainFit(dims.width, dims.height, { x: 0.5, y: 1.2, width: 5.5, height: 3.8 });
          slide.addImage({ data: dataUri, x: fit.x, y: fit.y, w: fit.width, h: fit.height });
        } else {
          console.warn('[PPT] 产品预览图加载失败:', imageUrl);
          addImagePlaceholder(slide, { x: 0.5, y: 1.2, width: 5.5, height: 3.8 }, ctx.isZh ? '图片加载失败' : 'Image load failed', '📷');
        }
      } catch (e) {
        addImagePlaceholder(slide, { x: 0.5, y: 1.2, width: 5.5, height: 3.8 }, ctx.isZh ? '待上传产品图片' : 'Upload product image', '📷');
      }
    } else {
      addImagePlaceholder(slide, { x: 0.5, y: 1.2, width: 5.5, height: 3.8 }, ctx.isZh ? '待上传产品图片' : 'Upload product image', '📷');
    }
  }
}

/**
 * Slide 3: Technical Requirements (技术要求)
 * Enhanced to show all module configuration parameters
 */
export function generateTechnicalRequirementsSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): void {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { ws, modules } = data;
  
  addSlideTitle(slide, ctx, ctx.isZh ? '技术要求' : 'Technical Requirements');
  const tables = buildWorkstationTechnicalRequirementTables({
    isZh: ctx.isZh,
    wsCode: ctx.wsCode,
    wsName: ctx.wsName,
    ws,
    modules,
  });

  // Detection items with module description
  slide.addText(ctx.isZh ? '【检测项】' : '[Detection Items]', {
    x: 0.5, y: 1.15, w: 4.3, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const detectionItems = tables.moduleRows.map(values => row(values));

  addPaginatedTable(ctx, slide, 'Technical Requirements', 'Detection Items', [], detectionItems, {
    x: 0.5, y: 1.45, w: 4.3, h: Math.min(detectionItems.length * 0.28 + 0.1, 2.2),
    fontFace: FONTS.body,
    fontSize: 8,
    colW: [4.3],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, {
    rowHeight: 0.28,
    firstPageMaxBodyRows: 8,
    firstPageBottomY: 3.75,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 8,
      colW: [9],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    },
  });

  slide.addText(ctx.isZh ? '【检测内容】' : '[Detection Content]', {
    x: 5, y: 1.15, w: 4.5, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const detectionContentRows = tables.detectionContentRows.map(values => row(values));

  addPaginatedTable(ctx, slide, 'Technical Requirements', 'Detection Content', [], detectionContentRows, {
    x: 5, y: 1.45, w: 4.5, h: Math.min(detectionContentRows.length * 0.4 + 0.1, 2.4),
    fontFace: FONTS.body,
    fontSize: 8,
    colW: [4.5],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, {
    rowHeight: 0.4,
    firstPageMaxBodyRows: 6,
    firstPageBottomY: 3.85,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 8,
      colW: [9],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    },
    continuationRowHeight: 0.4,
  });

  // Risk notes section
  slide.addText(ctx.isZh ? '【风险口径/备注】' : '[Risk Notes / Remarks]', {
    x: 0.5, y: 3.95, w: 9, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.warning, bold: true,
  });

  const riskText = ws.risk_notes || (ctx.isZh 
    ? '• 缺陷检测能力需以实际样品测试为准\n• 精度验收需现场调试后确认' 
    : '• Detection capability subject to actual sample testing\n• Accuracy acceptance to be confirmed after on-site commissioning');

  slide.addShape('rect', {
    x: 0.5, y: 4.25, w: 9, h: 0.9,
    fill: { color: 'FFF3CD' },
    line: { color: COLORS.warning, width: 1 },
  });
  slide.addText(riskText, {
    x: 0.7, y: 4.32, w: 8.6, h: 0.75,
    fontSize: 9, fontFace: FONTS.body, color: COLORS.dark,
  });
}

/**
 * Slide 4: Layout & Optical Solution (布局与光学方案)
 * Shows primary view (large left) + auxiliary view (small right top) + description (right bottom) + hardware specs.
 */
export async function generateLayoutAndOpticalSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): Promise<void> {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { layout, modules, hardware } = data;
  
  const titleText = ctx.isZh 
    ? `${ctx.wsCode} ${data.ws.name} - 机械布局` 
    : `${ctx.wsCode} ${data.ws.name} - Mechanical Layout`;
  addSlideTitle(slide, ctx, titleText);

  const primaryView = (layout as any)?.primary_view || 'front';
  const auxiliaryView = (layout as any)?.auxiliary_view || 'side';
  const layoutDescription: string = (layout as any)?.layout_description || '';

  const getViewUrl = (view: string): string | null => {
    if (!layout) return null;
    return (layout as any)?.[`${view}_view_image_url`] || null;
  };

  const VIEW_LABELS: Record<string, string> = { front: '正视图', side: '侧视图', top: '俯视图', isometric: '等轴测' };
  

  // Left side: Primary view (large) - 60% width
  const primaryUrl = getViewUrl(primaryView);
  if (primaryUrl) {
    try {
      const dataUri = await fetchImageAsDataUri(primaryUrl);
      if (dataUri) {
        const dims = await getImageDimensions(dataUri).catch(() => ({ width: 900, height: 500 }));
        const fit = calculateContainFit(dims.width, dims.height, {
          x: 0.3, y: 0.85, width: 5.4, height: 4.2
        });
        slide.addImage({ data: dataUri, x: fit.x, y: fit.y, w: fit.width, h: fit.height });
      } else {
        throw new Error('Failed to fetch');
      }
    } catch (e) {
      addImagePlaceholder(slide, { x: 0.3, y: 0.85, width: 5.4, height: 4.2 },
        ctx.isZh ? `主视图 (${VIEW_LABELS[primaryView]}) 未保存` : `Primary view not saved`, '📐');
    }
  } else {
    addImagePlaceholder(slide, { x: 0.3, y: 0.85, width: 5.4, height: 4.2 },
      ctx.isZh ? `主视图 (${VIEW_LABELS[primaryView]}) 未保存` : `Primary view not saved`, '📐');
  }

  // Primary view label
  slide.addText(ctx.isZh ? `主视图 - ${VIEW_LABELS[primaryView]}` : `Primary - ${primaryView}`, {
    x: 0.3, y: 5.1, w: 5.4, h: 0.2,
    fontSize: 8, fontFace: FONTS.body, color: COLORS.secondary, align: 'center',
  });

  // Right top: Auxiliary view (small)
  const auxiliaryUrl = getViewUrl(auxiliaryView);
  if (auxiliaryUrl) {
    try {
      const dataUri = await fetchImageAsDataUri(auxiliaryUrl);
      if (dataUri) {
        const dims = await getImageDimensions(dataUri).catch(() => ({ width: 900, height: 500 }));
        const fit = calculateContainFit(dims.width, dims.height, {
          x: 5.9, y: 0.85, width: 3.6, height: 2.8
        });
        slide.addImage({ data: dataUri, x: fit.x, y: fit.y, w: fit.width, h: fit.height });
      } else {
        throw new Error('Failed to fetch');
      }
    } catch (e) {
      addImagePlaceholder(slide, { x: 5.9, y: 0.85, width: 3.6, height: 2.8 },
        ctx.isZh ? `辅视图 (${VIEW_LABELS[auxiliaryView]})` : `Auxiliary view`, '📐');
    }
  } else {
    addImagePlaceholder(slide, { x: 5.9, y: 0.85, width: 3.6, height: 2.8 },
      ctx.isZh ? `辅视图 (${VIEW_LABELS[auxiliaryView]})` : `Auxiliary view`, '📐');
  }

  // Auxiliary view label
  slide.addText(ctx.isZh ? `辅视图 - ${VIEW_LABELS[auxiliaryView]}` : `Auxiliary - ${auxiliaryView}`, {
    x: 5.9, y: 3.67, w: 3.6, h: 0.2,
    fontSize: 8, fontFace: FONTS.body, color: COLORS.secondary, align: 'center',
  });

  // Right bottom: Layout description (always shown)
  slide.addShape('rect', {
    x: 5.9, y: 3.9, w: 3.6, h: 1.2,
    fill: { color: 'F8F9FA' },
    line: { color: COLORS.border, width: 0.5 },
  });
  slide.addText(ctx.isZh ? '布局说明' : 'Layout Description', {
    x: 6.0, y: 3.95, w: 3.4, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });
  slide.addText(layoutDescription || (ctx.isZh ? '（未填写布局说明）' : '(No description)'), {
    x: 6.0, y: 4.2, w: 3.4, h: 0.85,
    fontSize: 9, fontFace: FONTS.body, color: layoutDescription ? COLORS.dark : COLORS.secondary,
    valign: 'top',
  });

  // Layout dimensions at bottom
  if (layout?.width || layout?.height || layout?.depth) {
    slide.addText(
      `${ctx.isZh ? '布局尺寸' : 'Layout Size'}: ${layout.width || '-'} × ${layout.height || '-'} × ${layout.depth || '-'} mm`, 
      {
        x: 0.4, y: 5.0, w: 5.6, h: 0.22,
        fontSize: 8, fontFace: FONTS.body, color: COLORS.secondary,
      }
    );
  }
}

/**
 * Slide 6: Motion / Module Category (运动方式/模块分类)
 */
export function generateMotionMethodSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): void {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { ws, layout, modules } = data;
  
  addSlideTitle(slide, ctx, ctx.isZh ? '运动方式/模块分类' : 'Motion / Module Category');

  slide.addText(ctx.isZh ? '本页为"落地核心"，现场最看这一页' : 'Core execution page for on-site implementation', {
    x: 0.5, y: 1.0, w: 9, h: 0.25,
    fontSize: 9, fontFace: FONTS.body, color: COLORS.secondary, italic: true,
  });

  // Left column: FOV and Installation
  slide.addText(ctx.isZh ? '【视野范围/像素精度】' : '[FOV / Pixel Precision]', {
    x: 0.5, y: 1.35, w: 4.3, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const fovRows: TableRow[] = [];
  modules.forEach(mod => {
    const cfg = (mod.defect_config || mod.measurement_config || mod.positioning_config) as Record<string, unknown> | null;
    if (cfg) {
      if (cfg.fieldOfView) fovRows.push(row([mod.name, `FOV: ${cfg.fieldOfView} mm`]));
      if (cfg.resolutionPerPixel) fovRows.push(row([ctx.isZh ? '分辨率' : 'Resolution', `${cfg.resolutionPerPixel} mm/px`]));
    }
  });
  if (fovRows.length === 0) {
    fovRows.push(row([ctx.isZh ? '待定' : 'TBD', '-']));
  }

  addPaginatedTable(ctx, slide, 'Motion / Module Category', 'FOV / Pixel Precision', [], fovRows, {
    x: 0.5, y: 1.65, w: 4.3, h: Math.min(fovRows.length * 0.28 + 0.1, 1.2),
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [2, 2.3],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, {
    rowHeight: 0.28,
    firstPageMaxBodyRows: 4,
    firstPageBottomY: 2.9,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 9,
      colW: [3.2, 5.8],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    },
  });

  // Right column: Installation requirements
  slide.addText(ctx.isZh ? '【相机安装要求】' : '[Camera Installation]', {
    x: 5, y: 1.35, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const installMounts = Array.isArray(layout?.camera_mounts) ? layout.camera_mounts : [];
  const translatedInstallMounts = installMounts.map(m => 
    getLabel(m, CAMERA_MOUNT_LABELS, ctx.isZh ? 'zh' : 'en')
  ).join('/') || (ctx.isZh ? '顶部安装' : 'Top Mount');
  
  const installRows: TableRow[] = [
    row([ctx.isZh ? '安装方式' : 'Mount', translatedInstallMounts]),
    row([ctx.isZh ? '相机朝向' : 'Direction', ctx.isZh ? '垂直向下' : 'Vertical down']),
    row([ctx.isZh ? '长边方向' : 'Long Edge', ctx.isZh ? '沿运动方向' : 'Along motion']),
  ];

  addSafeTable(slide, installRows, {
    x: 5, y: 1.65, w: 4.5, h: 1.0,
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [1.8, 2.7],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, 0.3, 2.9);

  // Cycle and shot count
  slide.addText(ctx.isZh ? '【工位节拍/拍照次数】' : '[Station Cycle / Shot Count]', {
    x: 0.5, y: 3.0, w: 9, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const cycleRows: TableRow[] = [
    row([ctx.isZh ? '目标工位节拍' : 'Target Station Cycle', formatWorkstationCycleTime(ws)]),
    row([ctx.isZh ? '拍照次数' : 'Shot Count', `${ws.shot_count || modules.length || '-'} ${ctx.isZh ? '次' : ''}`]),
    row([ctx.isZh ? '触发方式' : 'Trigger', TRIGGER_LABELS[modules[0]?.trigger_type || 'io']?.[ctx.isZh ? 'zh' : 'en'] || 'IO']),
  ];

  addSafeTable(slide, cycleRows, {
    x: 0.5, y: 3.3, w: 4.3, h: 1.0,
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [1.8, 2.5],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, 0.3, 4.8);

  // Measurement method / Action flow
  slide.addText(ctx.isZh ? '【测量方法/动作流程】' : '[Measurement Method / Action Flow]', {
    x: 5, y: 3.0, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const actionScript = ws.action_script || (ctx.isZh 
    ? '1. 产品到位触发\n2. 相机采集图像\n3. 算法处理\n4. 结果输出PLC' 
    : '1. Trigger on position\n2. Camera capture\n3. Algorithm process\n4. Output to PLC');

  slide.addShape('rect', {
    x: 5, y: 3.3, w: 4.5, h: 1.5,
    fill: { color: COLORS.white },
    line: { color: COLORS.border, width: 0.5 },
  });
  slide.addText(actionScript, {
    x: 5.1, y: 3.4, w: 4.3, h: 1.3,
    fontSize: 9, fontFace: FONTS.body, color: COLORS.dark,
  });
}

/**
 * Slide 7: Optical Solution (光学方案)
 */
export function generateOpticalSolutionSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): void {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { layout, modules, hardware } = data;
  
  addSlideTitle(slide, ctx, ctx.isZh ? '光学方案' : 'Optical Solution');

  // Camera configuration
  slide.addText(ctx.isZh ? '【相机型号/像素/靶面】' : '[Camera Model/Resolution/Sensor]', {
    x: 0.5, y: 1.1, w: 9, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const cameraHeader: TableRow = row([
    ctx.isZh ? '型号' : 'Model', 
    ctx.isZh ? '分辨率' : 'Resolution', 
    ctx.isZh ? '靶面' : 'Sensor', 
    ctx.isZh ? '接口' : 'Interface'
  ]);
  
  const cameraRows: TableRow[] = layout?.selected_cameras?.filter(c => c).map(cam => {
    const fullCam = hardware?.cameras?.find(c => c.id === cam.id);
    return row([
      `${cam.brand} ${cam.model}`,
      fullCam?.resolution || '-',
      fullCam?.sensor_size || '-',
      fullCam?.interface || '-'
    ]);
  }) || [row(['-', '-', '-', '-'])];

  addPaginatedTable(ctx, slide, 'Optical Solution', 'Camera Configuration', [cameraHeader], cameraRows, {
    x: 0.5, y: 1.4, w: 9, h: Math.min((cameraRows.length + 1) * 0.3 + 0.1, 1.5),
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [3.5, 2, 1.5, 2],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle',
    align: 'center',
  }, {
    rowHeight: 0.3,
    firstPageMaxBodyRows: 3,
    firstPageBottomY: 2.95,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 9,
      colW: [3.5, 2, 1.5, 2],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
      valign: 'middle',
      align: 'center',
    },
    continuationRowHeight: 0.3,
  });

  // Lens configuration
  slide.addText(ctx.isZh ? '【镜头焦距/靶面】' : '[Lens Focal Length/Sensor]', {
    x: 0.5, y: 3.0, w: 4.3, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const lensHeader: TableRow = row([
    ctx.isZh ? '型号' : 'Model', 
    ctx.isZh ? '焦距' : 'Focal', 
    ctx.isZh ? '靶面' : 'Sensor'
  ]);

  const lensRows: TableRow[] = layout?.selected_lenses?.filter(l => l).map(lens => {
    const fullLens = hardware?.lenses?.find(l => l.id === lens.id);
    return row([
      `${lens.brand} ${lens.model}`,
      fullLens?.focal_length || '-',
      fullLens?.max_sensor_size || '-'
    ]);
  }) || [row(['-', '-', '-'])];

  addPaginatedTable(ctx, slide, 'Optical Solution', 'Lens Configuration', [lensHeader], lensRows, {
    x: 0.5, y: 3.3, w: 4.3, h: Math.min((lensRows.length + 1) * 0.28 + 0.1, 1.2),
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [2.3, 1, 1],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, {
    rowHeight: 0.28,
    firstPageMaxBodyRows: 4,
    firstPageBottomY: 4.8,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 9,
      colW: [5, 2, 2],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    },
  });

  // Working distance & extended optical params
  slide.addText(ctx.isZh ? '【工作距离/倍率/靶面】' : '[WD/Magnification/Sensor]', {
    x: 5, y: 3.0, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const wdRows: TableRow[] = [];
  modules.forEach(mod => {
    const extra = (mod as any).extra_fields as Record<string, unknown> | null;
    const cfg = (mod.defect_config || mod.measurement_config || mod.positioning_config) as Record<string, unknown> | null;
    const wd = extra?.workingDistance || cfg?.workingDistance || '-';
    const mag = extra?.magnification ? Number(extra.magnification).toFixed(4) + '×' : '-';
    const targetSensor = extra?.depthOfField ? String(extra.depthOfField) : '-';
    wdRows.push(row([mod.name, `${wd} mm`, mag, targetSensor]));
  });
  if (wdRows.length === 0) {
    wdRows.push(row([ctx.isZh ? '待定' : 'TBD', '-', '-', '-']));
  }

  const wdHeader: TableRow = row([
    ctx.isZh ? '模块' : 'Module',
    ctx.isZh ? '工作距离' : 'WD',
    ctx.isZh ? '倍率' : 'Mag.',
    ctx.isZh ? '靶面尺寸' : 'Sensor',
  ]);

  addPaginatedTable(ctx, slide, 'Optical Solution', 'Working Distance', [wdHeader], wdRows, {
    x: 5, y: 3.3, w: 4.5, h: Math.min((wdRows.length + 1) * 0.28 + 0.1, 1.5),
    fontFace: FONTS.body,
    fontSize: 8,
    colW: [1.5, 1, 1, 1],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle',
    align: 'center',
  }, {
    rowHeight: 0.28,
    firstPageMaxBodyRows: 4,
    firstPageBottomY: 4.95,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 8,
      colW: [3, 2, 2, 2],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
      valign: 'middle',
      align: 'center',
    },
  });
}

/**
 * Slide 8: Measurement Method & Vision List (测量方法及视觉清单)
 */
export function generateVisionListSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): void {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { layout, modules } = data;
  
  addSlideTitle(slide, ctx, ctx.isZh ? '测量方法及视觉清单' : 'Measurement & Vision List');

  // Light source configuration
  slide.addText(ctx.isZh ? '【光源型号/数量】' : '[Light Model/Quantity]', {
    x: 0.5, y: 1.1, w: 4.3, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const lightRows: TableRow[] = layout?.selected_lights?.filter(l => l).map(light => 
    row([`${light.brand} ${light.model}`, '1'])
  ) || [row(['-', '-'])];

  addPaginatedTable(ctx, slide, 'Measurement & Vision List', 'Light Model/Quantity', [], lightRows, {
    x: 0.5, y: 1.4, w: 4.3, h: Math.min(lightRows.length * 0.28 + 0.1, 1.2),
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [3.3, 1],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, {
    rowHeight: 0.28,
    firstPageMaxBodyRows: 4,
    firstPageBottomY: 2.65,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 9,
      colW: [7.2, 1.8],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    },
  });

  // Light distance and angle
  slide.addText(ctx.isZh ? '【光源距离/角度】' : '[Light Distance/Angle]', {
    x: 5, y: 1.1, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  slide.addText(ctx.isZh ? '需根据实际调试确定' : 'To be determined on-site', {
    x: 5, y: 1.4, w: 4.5, h: 0.3,
    fontSize: 9, fontFace: FONTS.body, color: COLORS.secondary,
  });

  // Vision equipment list
  slide.addText(ctx.isZh ? '【视觉清单】' : '[Vision Equipment List]', {
    x: 0.5, y: 2.7, w: 9, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const visionListRows: TableRow[] = [
    row([ctx.isZh ? '相机' : 'Camera', `${layout?.camera_count || 0} ${ctx.isZh ? '台' : ''}`]),
    row([ctx.isZh ? '镜头' : 'Lens', `${layout?.selected_lenses?.filter(l => l).length || 0} ${ctx.isZh ? '个' : ''}`]),
    row([ctx.isZh ? '光源' : 'Light', `${layout?.selected_lights?.filter(l => l).length || 0} ${ctx.isZh ? '个' : ''}`]),
    row([ctx.isZh ? '工控机' : 'IPC', layout?.selected_controller ? `${layout.selected_controller.brand} ${layout.selected_controller.model}` : '1 台']),
    row([ctx.isZh ? '触发器/编码器' : 'Trigger/Encoder', modules.some(m => m.trigger_type === 'encoder') ? (ctx.isZh ? '需要' : 'Required') : 'IO']),
    row([ctx.isZh ? '支架/线缆' : 'Bracket/Cable', ctx.isZh ? '按需配置' : 'As needed']),
  ];

  addSafeTable(slide, visionListRows, {
    x: 0.5, y: 3.0, w: 4.3, h: 2.0,
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [1.8, 2.5],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, 0.3, 5.05);

  // Module summary
  slide.addText(ctx.isZh ? '功能模块' : 'Function Modules', {
    x: 5, y: 2.7, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.dark, bold: true,
  });

  const modRows: TableRow[] = modules.map(mod => row([
    MODULE_TYPE_LABELS[mod.type]?.[ctx.isZh ? 'zh' : 'en'] || mod.type,
    mod.name
  ]));

  if (modRows.length > 0) {
    addPaginatedTable(ctx, slide, 'Measurement & Vision List', 'Function Modules', [], modRows, {
      x: 5, y: 3.0, w: 4.5, h: Math.min(modRows.length * 0.3 + 0.1, 2),
      fontFace: FONTS.body,
      fontSize: 9,
      colW: [1.5, 3],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    }, {
      rowHeight: 0.3,
      firstPageMaxBodyRows: 6,
      firstPageBottomY: 5.05,
      continuationOptions: {
        x: 0.5, y: 1.2, w: 9,
        fontFace: FONTS.body,
        fontSize: 9,
        colW: [3, 6],
        border: { pt: 0.5, color: COLORS.border },
        fill: { color: COLORS.white },
      },
      continuationRowHeight: 0.3,
    });
  }
}

/**
 * Slide 9: BOM List & Review (BOM清单及审核)
 */
export function generateBOMSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): void {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { layout } = data;
  const bomSubtitle = ctx.isZh ? 'BOM清单' : 'BOM List';
  const bomSectionTitle = ctx.isZh ? 'BOM明细' : 'BOM';
  
  addSlideTitle(slide, ctx, bomSubtitle);

  // BOM table
  const bomHeader: TableRow = row([
    ctx.isZh ? '序号' : 'No.',
    ctx.isZh ? '设备名称' : 'Device',
    ctx.isZh ? '型号' : 'Model',
    ctx.isZh ? '数量' : 'Qty',
    ctx.isZh ? '单价' : 'Price',
    ctx.isZh ? '备注' : 'Notes'
  ]);

  const bomRows: TableRow[] = [];
  let bomIdx = 1;

  // Cameras
  layout?.selected_cameras?.filter(c => c).forEach(cam => {
    bomRows.push(row([String(bomIdx++), ctx.isZh ? '工业相机' : 'Camera', `${cam.brand} ${cam.model}`, '1', 'TBD', '']));
  });

  // Lenses
  layout?.selected_lenses?.filter(l => l).forEach(lens => {
    bomRows.push(row([String(bomIdx++), ctx.isZh ? '工业镜头' : 'Lens', `${lens.brand} ${lens.model}`, '1', 'TBD', '']));
  });

  // Lights
  layout?.selected_lights?.filter(l => l).forEach(light => {
    bomRows.push(row([String(bomIdx++), ctx.isZh ? 'LED光源' : 'Light', `${light.brand} ${light.model}`, '1', 'TBD', '']));
  });

  // Controller
  if (layout?.selected_controller) {
    bomRows.push(row([String(bomIdx++), ctx.isZh ? '工控机' : 'IPC', `${layout.selected_controller.brand} ${layout.selected_controller.model}`, '1', 'TBD', ctx.isZh ? '含GPU' : 'w/ GPU']));
  }

  if (bomRows.length === 0) {
    bomRows.push(row(['1', '-', '-', '-', '-', '-']));
  }

  addPaginatedTable(ctx, slide, bomSubtitle, bomSectionTitle, [bomHeader], bomRows, {
    x: 0.5, y: 1.1, w: 9, h: Math.min((bomRows.length + 1) * 0.32 + 0.1, 3.0),
    fontFace: FONTS.body,
    fontSize: 9,
    colW: [0.6, 1.5, 2.8, 0.8, 1, 2.3],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle',
    align: 'center',
  }, {
    rowHeight: 0.32,
    firstPageMaxBodyRows: 10,
    firstPageBottomY: 4.45,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 9,
      colW: [0.6, 1.5, 2.8, 0.8, 1, 2.3],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
      valign: 'middle',
      align: 'center',
    },
    continuationRowHeight: 0.32,
  });
}

// ==================== NEW SLIDES: Plan Refactoring ====================

/**
 * Combined: Basic Info + Technical Requirements (基本信息+检测要求)
 * Merges generateBasicInfoSlide and generateTechnicalRequirementsSlide into one page
 */
export function generateBasicInfoAndRequirementsSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): void {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { ws, modules } = data;
  
  addSlideTitle(slide, ctx, ctx.isZh ? '技术要求' : 'Technical Requirements');

  const tables = buildWorkstationTechnicalRequirementTables({
    isZh: ctx.isZh,
    wsCode: ctx.wsCode,
    wsName: ctx.wsName,
    ws,
    modules,
  });

  // === TOP HALF: Basic Info + Notes ===
  const startY = 1.1;
  const basicInfoRows = tables.basicInfoRows.map(values => row(values));

  addSafeTable(slide, basicInfoRows, {
    x: 0.4, y: startY, w: 4.5, h: 2.0,
    fontFace: FONTS.body,
    fontSize: 8,
    colW: [1.2, 3.3],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
    valign: 'middle',
  }, 0.3, 3.15);

  slide.addShape('rect', {
    x: 5.1, y: startY, w: 4.5, h: 2.0,
    fill: { color: COLORS.white },
    line: { color: COLORS.border, width: 0.5 },
  });
  slide.addText(ctx.isZh ? '备注:' : 'Notes:', {
    x: 5.25, y: startY + 0.85, w: 0.8, h: 0.25,
    fontSize: 9,
    fontFace: FONTS.body,
    color: COLORS.dark,
  });
  if (tables.noteText) {
    slide.addText(tables.noteText, {
      x: 6.05, y: startY + 0.25, w: 3.3, h: 1.45,
      fontSize: 8,
      fontFace: FONTS.body,
      color: COLORS.dark,
      breakLine: false,
      fit: 'shrink',
    });
  }

  // === BOTTOM HALF: Detection Items + Detection Content ===
  const bottomY = 3.4;

  slide.addText(ctx.isZh ? '【检测项】' : '[Detection Items]', {
    x: 0.4, y: bottomY, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const moduleItems = tables.moduleRows.map(values => row(values));

  addPaginatedTable(ctx, slide, 'Technical Requirements', 'Detection Items', [], moduleItems, {
    x: 0.4, y: bottomY + 0.3, w: 4.5, h: Math.min(moduleItems.length * 0.26 + 0.05, 1.8),
    fontFace: FONTS.body,
    fontSize: 8,
    colW: [4.5],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, {
    rowHeight: 0.26,
    firstPageMaxBodyRows: 7,
    firstPageBottomY: 5.05,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 8,
      colW: [9],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    },
    continuationRowHeight: 0.26,
  });

  slide.addText(ctx.isZh ? '【检测内容】' : '[Detection Content]', {
    x: 5.1, y: bottomY, w: 4.5, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const detectionContentRows = tables.detectionContentRows.map(values => row(values));

  addPaginatedTable(ctx, slide, 'Technical Requirements', 'Detection Content', [], detectionContentRows, {
    x: 5.1, y: bottomY + 0.3, w: 4.5, h: Math.min(detectionContentRows.length * 0.4 + 0.05, 1.8),
    fontFace: FONTS.body,
    fontSize: 8,
    colW: [4.5],
    border: { pt: 0.5, color: COLORS.border },
    fill: { color: COLORS.white },
  }, {
    rowHeight: 0.4,
    firstPageMaxBodyRows: 4,
    firstPageBottomY: 5.05,
    continuationOptions: {
      x: 0.5, y: 1.2, w: 9,
      fontFace: FONTS.body,
      fontSize: 8,
      colW: [9],
      border: { pt: 0.5, color: COLORS.border },
      fill: { color: COLORS.white },
    },
    continuationRowHeight: 0.4,
  });

  // Risk notes removed per user request
}

/**
 * Mechanical Three-View Layout (机械布局三视图)
 * Pure image page: front, side, top views with dimension annotations
 */
export async function generateMechanicalThreeViewSlide(
  ctx: SlideContext,
  data: WorkstationSlideData
): Promise<void> {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { layout } = data;
  
  addSlideTitle(slide, ctx, ctx.isZh ? '机械布局三视图' : 'Mechanical Layout - Three Views');

  const viewUrls = [
    { url: layout?.front_view_image_url, label: ctx.isZh ? '正视图' : 'Front View' },
    { url: layout?.side_view_image_url, label: ctx.isZh ? '侧视图' : 'Side View' },
    { url: layout?.top_view_image_url, label: ctx.isZh ? '俯视图' : 'Top View' },
  ];

  // Calculate three-view layout slots
  const slots = calculateThreeViewLayout(1.15, 3.2, 0.4, 9.2, 0.15);

  for (let i = 0; i < 3; i++) {
    const { url, label } = viewUrls[i];
    const slot = slots[i];

    // View label above
    slide.addText(label, {
      x: slot.x, y: slot.y - 0.02, w: slot.width, h: 0.2,
      fontSize: 8, fontFace: FONTS.body, color: COLORS.secondary, align: 'center', bold: true,
    });

    const imageContainer = { x: slot.x, y: slot.y + 0.2, width: slot.width, height: slot.height - 0.2 };

    if (url) {
      try {
        const dataUri = await fetchImageAsDataUri(url);
        if (dataUri) {
          const dims = await getImageDimensions(dataUri).catch(() => ({ width: 600, height: 400 }));
          const fit = calculateContainFit(dims.width, dims.height, imageContainer);
          slide.addImage({
            data: dataUri,
            x: fit.x, y: fit.y, w: fit.width, h: fit.height,
          });
        } else {
          throw new Error('Failed');
        }
      } catch {
        addImagePlaceholder(slide, imageContainer, label, '📐');
      }
    } else {
      addImagePlaceholder(slide, imageContainer, ctx.isZh ? '待保存' : 'Not saved', '📐');
    }
  }

  // Dimension annotation at bottom
  if (layout?.width || layout?.height || layout?.depth) {
    slide.addText(
      `${ctx.isZh ? '总体尺寸' : 'Overall'}: ${layout.width || '-'} × ${layout.height || '-'} × ${layout.depth || '-'} mm (${ctx.isZh ? '宽×高×深' : 'W×H×D'})`,
      {
        x: 0.4, y: 4.55, w: 9.2, h: 0.25,
        fontSize: 9, fontFace: FONTS.body, color: COLORS.dark, align: 'center', bold: true,
      }
    );
  }
}

/**
 * Per-Module Optical Solution (光学方案 - 按模块)
 * Left: Optical diagram (camera/lens/light/working distance)
 * Right: Measurement method & vision checklist
 */
export async function generateModuleOpticalSlide(
  ctx: SlideContext,
  data: WorkstationSlideData,
  moduleIndex: number
): Promise<void> {
  const modCheck = data.modules[moduleIndex];
  if (modCheck) {
    const threeDRaw = extractThreeDConfig(modCheck);
    const imagingIs3D = isImaging3D(modCheck);
    if (threeDRaw || imagingIs3D) {
      const info = getThreeDDisplayInfo(threeDRaw || {});
      if (info.hasAny || imagingIs3D) {
        await generateModule3DOpticalSlide(ctx, data, moduleIndex, info);
        return;
      }
    }
  }
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const { modules } = data;
  const mod = modules[moduleIndex];
  if (!mod) return;

  const typeLabel = MODULE_TYPE_LABELS[mod.type]?.[ctx.isZh ? 'zh' : 'en'] || mod.type;
  const triggerLabel = TRIGGER_LABELS[mod.trigger_type || 'io']?.[ctx.isZh ? 'zh' : 'en'] || mod.trigger_type || 'IO';

  // Title: DB code + module name
  addSlideTitle(slide, ctx, `${typeLabel} - ${mod.name}`);

  // ===== LEFT HALF: Optical Diagram (use schematic screenshot) =====
  const leftX = 0.4;
  const leftW = 4.6;
  const imgContainerY = 1.1;
  const imgContainerH = 3.8;

  slide.addText(ctx.isZh ? '光学方案' : 'Optical Solution', {
    x: leftX, y: imgContainerY, w: leftW, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const imageArea = { x: leftX, y: imgContainerY + 0.35, width: leftW, height: imgContainerH - 0.35 };

  if (mod.schematic_image_url) {
    try {
      const dataUri = await fetchImageAsDataUri(mod.schematic_image_url);
      if (dataUri) {
        const trimmedDataUri = await trimImageWhitespaceDataUri(dataUri);
        const dims = await getImageDimensions(trimmedDataUri);
        const fit = calculateContainFit(dims.width, dims.height, imageArea);
        slide.addImage({ data: trimmedDataUri, x: fit.x, y: fit.y, w: fit.width, h: fit.height });
      } else {
        throw new Error('Failed to fetch image');
      }
    } catch (err) {
      console.warn('[PPT] 光学方案图片加载失败，使用占位符', err);
      slide.addShape('rect', {
        x: imageArea.x, y: imageArea.y, w: imageArea.width, h: imageArea.height,
        fill: { color: COLORS.lightGray }, line: { color: COLORS.border, width: 0.5 },
      });
      slide.addText(ctx.isZh ? '请先在系统中保存光路示意图' : 'Please save the optical diagram first', {
        x: imageArea.x, y: imageArea.y, w: imageArea.width, h: imageArea.height,
        fontSize: 10, fontFace: FONTS.body, color: COLORS.secondary, align: 'center', valign: 'middle',
      });
    }
  } else {
    // No schematic_image_url — show placeholder
    slide.addShape('rect', {
      x: imageArea.x, y: imageArea.y, w: imageArea.width, h: imageArea.height,
      fill: { color: COLORS.lightGray }, line: { color: COLORS.border, width: 0.5 },
    });
    slide.addText(ctx.isZh ? '请先在系统中保存光路示意图' : 'Please save the optical diagram first', {
      x: imageArea.x, y: imageArea.y, w: imageArea.width, h: imageArea.height,
      fontSize: 10, fontFace: FONTS.body, color: COLORS.secondary, align: 'center', valign: 'middle',
    });
  }

  // ===== RIGHT HALF: Measurement Method & Vision Checklist =====
  const rightX = 5.2;
  const rightW = 4.4;

  slide.addText(ctx.isZh ? '测量方法及视觉清单' : 'Method & Vision Checklist', {
    x: rightX, y: 1.1, w: rightW, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  // Numbered checklist
  const textContent = buildModuleOpticalSlideTextContent({ module: mod, data, isZh: ctx.isZh });
  const checklistItems = textContent.checklistItems;

  slide.addText(checklistItems.join('\n'), {
    x: rightX, y: 1.45, w: rightW, h: 1.8,
    fontSize: 9, fontFace: FONTS.body, color: COLORS.dark, lineSpacingMultiple: 1.5,
  });

  // Measurement method description
  slide.addText(ctx.isZh ? '测量方法:' : 'Measurement Method:', {
    x: rightX, y: 3.4, w: rightW, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const methodDesc = textContent.methodDescription;

  slide.addShape('rect', {
    x: rightX, y: 3.7, w: rightW, h: 1.4,
    fill: { color: COLORS.white },
    line: { color: COLORS.border, width: 0.5 },
  });
  slide.addText(methodDesc, {
    x: rightX + 0.1, y: 3.75, w: rightW - 0.2, h: 1.3,
    fontSize: 8, fontFace: FONTS.body, color: COLORS.dark,
  });
}

export const LIGHTING_PHOTOS_PER_SLIDE = 2;

export function getLightingPhotoSlideCount(photoCount: number): number {
  return Math.ceil(Math.max(0, Math.floor(photoCount)) / LIGHTING_PHOTOS_PER_SLIDE);
}

/**
 * Slides: Lighting Photos (打光照片)
 * At most two photos per slide; an odd final photo is centered.
 */
export async function generateLightingPhotosSlide(
  ctx: SlideContext,
  data: WorkstationSlideData,
  moduleIndex: number
): Promise<void> {
  const mod = data.modules[moduleIndex];
  const photos = mod.lighting_photos || [];
  if (photos.length === 0) return;

  const layouts: Record<number, Array<{ x: number; y: number; width: number; height: number }>> = {
    1: [{ x: 1.5, y: 1.2, width: 7, height: 3.8 }],
    2: [
      { x: 0.3, y: 1.2, width: 4.5, height: 3.5 },
      { x: 5.2, y: 1.2, width: 4.5, height: 3.5 },
    ],
  };
  const pageCount = getLightingPhotoSlideCount(photos.length);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pagePhotos = photos.slice(
      pageIndex * LIGHTING_PHOTOS_PER_SLIDE,
      (pageIndex + 1) * LIGHTING_PHOTOS_PER_SLIDE,
    );
    const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
    const baseSubtitle = `${mod.name} - ${ctx.isZh ? '打光照片' : 'Lighting Photos'}`;
    const pageSuffix = pageCount > 1
      ? ctx.isZh
        ? `（${pageIndex + 1}/${pageCount}）`
        : ` (${pageIndex + 1}/${pageCount})`
      : '';
    addSlideTitle(slide, ctx, `${baseSubtitle}${pageSuffix}`);

    const positions = layouts[pagePhotos.length];

    for (let photoIndex = 0; photoIndex < pagePhotos.length; photoIndex++) {
      const photo = pagePhotos[photoIndex];
      const pos = positions[photoIndex];

      try {
        const dataUri = await fetchImageAsDataUri(photo.url);
        if (dataUri) {
          const dims = await getImageDimensions(dataUri).catch(() => ({ width: 800, height: 600 }));
          const fit = calculateContainFit(dims.width, dims.height, pos);
          slide.addImage({ data: dataUri, x: fit.x, y: fit.y, w: fit.width, h: fit.height });
        } else {
          addImagePlaceholder(slide, pos, ctx.isZh ? '图片加载失败' : 'Image load failed', '📷');
        }
      } catch {
        addImagePlaceholder(slide, pos, ctx.isZh ? '图片加载失败' : 'Image load failed', '📷');
      }

      if (photo.remark) {
        slide.addText(photo.remark, {
          x: pos.x, y: pos.y + pos.height + 0.05, w: pos.width, h: 0.2,
          fontSize: 8, fontFace: FONTS.body, color: COLORS.secondary, align: 'center',
        });
      }
    }
  }
}

// ============ 3D Optical Slide ============

function extractThreeDConfig(mod: WorkstationSlideData['modules'][number]): Record<string, unknown> | null {
  const cfgs = [
    mod.measurement_config,
    mod.defect_config,
    mod.positioning_config,
    mod.ocr_config,
    mod.deep_learning_config,
  ] as Array<Record<string, unknown> | null | undefined>;
  for (const c of cfgs) {
    if (c && typeof c === 'object' && c.three_d && typeof c.three_d === 'object') {
      const imaging = c.imaging && typeof c.imaging === 'object'
        ? c.imaging as Record<string, unknown>
        : null;
      return {
        ...(c.three_d as Record<string, unknown>),
        workingDistance: imaging?.workingDistance ?? null,
        workingDistanceTolerance: imaging?.workingDistanceTolerance ?? null,
      };
    }
  }
  return null;
}

function isImaging3D(mod: WorkstationSlideData['modules'][number]): boolean {
  if ((mod as Record<string, unknown>).is_3d_camera === true) return true;
  const cfgs = [
    mod.measurement_config,
    mod.defect_config,
    mod.positioning_config,
    mod.ocr_config,
    mod.deep_learning_config,
  ] as Array<Record<string, unknown> | null | undefined>;
  for (const c of cfgs) {
    const imaging = c && typeof c === 'object' ? (c.imaging as Record<string, unknown> | undefined) : undefined;
    if (imaging && (imaging.is3DCamera === true || String(imaging.is3DCamera) === 'true')) return true;
  }
  return false;
}

/**
 * 3D 相机光学方案 Slide
 * 左：光学方案（3D 相机示意 + 关键参数标注）
 * 右：测量方法（编号参数 + 测量步骤）
 */
export async function generateModule3DOpticalSlide(
  ctx: SlideContext,
  data: WorkstationSlideData,
  moduleIndex: number,
  info: ThreeDDisplayInfo
): Promise<void> {
  const slide = ctx.pptx.addSlide({ masterName: 'MASTER_SLIDE' });
  const mod = data.modules[moduleIndex];
  if (!mod) return;

  const typeLabel = MODULE_TYPE_LABELS[mod.type]?.[ctx.isZh ? 'zh' : 'en'] || mod.type;
  addSlideTitle(slide, ctx, `${typeLabel} - ${mod.name}`);

  const leftX = 0.4;
  const leftW = 5.8;
  const rightX = 6.15;
  const rightW = 3.45;
  const headerY = 1.1;
  const titleBodyGap = 0.22;

  slide.addText(ctx.isZh ? '光学方案' : 'Optical Solution', {
    x: leftX, y: headerY, w: leftW, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const imageY = headerY + titleBodyGap;
  const imageArea = {
    x: leftX,
    y: imageY,
    width: leftW,
    height: Math.max(0.5, SLIDE_LAYOUT.contentBottom - 0.1 - imageY),
  };
  if (mod.schematic_image_url) {
    try {
      const dataUri = await fetchImageAsDataUri(mod.schematic_image_url);
      if (!dataUri) throw new Error('Failed to fetch image');
      const trimmedDataUri = await trimImageWhitespaceDataUri(dataUri, {
        paddingPx: 8,
        threshold: 18,
        minContentRatio: 0.01,
        maxCropCoverage: 0.995,
      });
      const dims = await getImageDimensions(trimmedDataUri);
      const fit = calculateContainFit(dims.width, dims.height, imageArea);
      slide.addImage({ data: trimmedDataUri, x: fit.x, y: fit.y, w: fit.width, h: fit.height });
    } catch (err) {
      console.warn('[PPT] 3D光学方案图片加载失败，使用占位符', err);
      slide.addShape('rect', {
        x: imageArea.x, y: imageArea.y, w: imageArea.width, h: imageArea.height,
        fill: { color: COLORS.lightGray }, line: { color: COLORS.border, width: 0.5 },
      });
      slide.addText(ctx.isZh ? '请先在系统中保存3D光学方案图' : 'Please save the 3D optical diagram first', {
        x: imageArea.x, y: imageArea.y, w: imageArea.width, h: imageArea.height,
        fontSize: 10, fontFace: FONTS.body, color: COLORS.secondary, align: 'center', valign: 'middle',
      });
    }
  } else {
    slide.addShape('rect', {
      x: imageArea.x, y: imageArea.y, w: imageArea.width, h: imageArea.height,
      fill: { color: COLORS.lightGray }, line: { color: COLORS.border, width: 0.5 },
    });
    slide.addText(ctx.isZh ? '请先在系统中保存3D光学方案图' : 'Please save the 3D optical diagram first', {
      x: imageArea.x, y: imageArea.y, w: imageArea.width, h: imageArea.height,
      fontSize: 10, fontFace: FONTS.body, color: COLORS.secondary, align: 'center', valign: 'middle',
    });
  }

  slide.addText(ctx.isZh ? '测量方法及视觉清单' : 'Measurement Method & Vision Checklist', {
    x: rightX, y: headerY, w: rightW, h: 0.25,
    fontSize: 11, fontFace: FONTS.body, color: COLORS.primary, bold: true,
    fit: 'shrink',
  });

  const checklistItems = buildThreeDMeasurementChecklist(info).map((line, index) => `${index + 1}. ${line}`);
  slide.addText(checklistItems.join('\n'), {
    x: rightX, y: headerY + titleBodyGap, w: rightW, h: 2.1,
    fontSize: 9, fontFace: FONTS.body, color: COLORS.dark, lineSpacingMultiple: 1.45,
    fit: 'shrink',
  });

  slide.addText(ctx.isZh ? '测量步骤:' : 'Measurement Steps:', {
    x: rightX, y: 3.35, w: rightW, h: 0.25,
    fontSize: 10, fontFace: FONTS.body, color: COLORS.primary, bold: true,
  });

  const steps = mod.description?.trim()
    ? mod.description.split(/\r?\n/).map(step => step.trim()).filter(Boolean)
    : info.detectionSteps.length > 0
      ? info.detectionSteps
    : [ctx.isZh ? '待维护测量步骤' : 'Measurement steps pending'];
  slide.addText(steps.map((step, index) => `${index + 1}. ${step}`).join('\n'), {
    x: rightX, y: 3.62, w: rightW, h: 2.0,
    fontSize: 8.5, fontFace: FONTS.body, color: COLORS.dark, lineSpacingMultiple: 1.35,
    fit: 'shrink',
  });
}
