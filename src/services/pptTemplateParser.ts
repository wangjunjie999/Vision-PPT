/**
 * PPT template parser.
 *
 * The uploaded-template route supports two styles:
 * 1. Explicit placeholders such as {{project_name}}.
 * 2. Existing business PPTs that use text like "XXXX", "报告人", "日期" and
 *    reusable picture boxes. These are parsed into candidate bindings that the
 *    user can confirm in the template manager.
 */

import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

const EMU_PER_INCH = 914400;

// ==================== TYPE DEFINITIONS ====================

export interface TemplatePlaceholder {
  type: 'title' | 'body' | 'picture' | 'chart' | 'table' | 'custom';
  name: string;
  position: { x: number; y: number; w: number; h: number };
  fieldMapping?: string;
}

export interface TemplateMaster {
  id: string;
  name: string;
  index: number;
  background: {
    type: 'color' | 'image' | 'gradient';
    value: string;
  };
  placeholders: TemplatePlaceholder[];
}

export interface TemplateLayout {
  id: string;
  name: string;
  masterRef: string;
  type: string;
  placeholders: TemplatePlaceholder[];
}

export type TemplateSlideRole =
  | 'cover'
  | 'toc'
  | 'section'
  | 'company_intro'
  | 'content'
  | 'general';

export interface TemplateShapeInfo {
  id: string;
  name: string;
  kind: 'text' | 'picture' | 'other';
  text: string;
  position: { x: number; y: number; w: number; h: number };
}

export interface RuleDetectedBinding {
  id: string;
  slideIndex: number;
  shapeId: string;
  shapeName?: string;
  sourceText: string;
  token?: string;
  label: string;
  matchType: 'placeholder' | 'xxxx' | 'label' | 'image';
  replacementMode: 'replace-token' | 'replace-shape-text' | 'replace-picture';
  suggestedSystemField: string;
  confidence: number;
  optional?: boolean;
}

export interface ManualBinding {
  bindingId: string;
  systemField: string;
  enabled: boolean;
  clearWhenMissing?: boolean;
}

export interface TemplateSlide {
  index: number;
  layoutRef: string;
  customFields: string[];
  text?: string;
  title?: string;
  detectedRole?: TemplateSlideRole;
  shapes?: TemplateShapeInfo[];
  detectedBindings?: RuleDetectedBinding[];
}

export interface ParsedTemplate {
  fileName: string;
  fileSize: number;
  slideCount: number;
  dimensions: { width: number; height: number };
  masters: TemplateMaster[];
  layouts: TemplateLayout[];
  slides: TemplateSlide[];
  customFields: string[];
  detectedBindings: RuleDetectedBinding[];
  roleSummary: Record<string, number>;
  availableSystemFields: string[];
  parsedAt: string;
}

// ==================== SYSTEM FIELDS DEFINITION ====================

export const SYSTEM_FIELDS = {
  project: [
    { field: 'project_name', label: '项目名称', example: '新能源电池模组视觉检测系统' },
    { field: 'project_code', label: '项目编号', example: 'DB260101' },
    { field: 'customer', label: '客户名称', example: '某某客户' },
    { field: 'date', label: '项目日期', example: '2026-05-12' },
    { field: 'date_formatted', label: '格式化日期', example: '2026年5月12日' },
    { field: 'date_year', label: '年份', example: '2026' },
    { field: 'date_month', label: '月份', example: '5' },
    { field: 'date_day', label: '日期', example: '12' },
    { field: 'responsible', label: '项目负责人', example: '张三' },
    { field: 'vision_responsible', label: '视觉负责人', example: '李四' },
    { field: 'sales_responsible', label: '销售负责人', example: '王五' },
    { field: 'description', label: '项目描述', example: '...' },
    { field: 'spec_version', label: '规格版本', example: 'V1.0' },
    { field: 'product_process', label: '产品工序', example: '总装检测' },
    { field: 'quality_strategy', label: '质量策略', example: '零缺陷' },
    { field: 'security_level', label: '密级', example: '公开' },
  ],
  statistics: [
    { field: 'workstation_count', label: '工位数量', example: '3' },
    { field: 'total_module_count', label: '模块总数', example: '8' },
    { field: 'camera_count', label: '相机数量', example: '5' },
    { field: 'lens_count', label: '镜头数量', example: '5' },
    { field: 'light_count', label: '光源数量', example: '5' },
    { field: 'controller_count', label: '控制器数量', example: '1' },
    { field: 'total_hardware_count', label: '硬件总数', example: '16' },
  ],
  workstation: [
    { field: 'name', label: '工位名称', example: '上料检测工位' },
    { field: 'code', label: '工位编号', example: 'DB260101.01' },
    { field: 'type', label: '工位类型', example: 'line' },
    { field: 'type_label', label: '工位类型中文', example: '线体' },
    { field: 'index', label: '序号', example: '1' },
    { field: 'cycle_time', label: '工位节拍', example: '3.5' },
    { field: 'shot_count', label: '拍照次数', example: '2' },
    { field: 'observation_target', label: '观测目标', example: '产品正面' },
    { field: 'motion_description', label: '运动描述', example: '输送带匀速运动' },
    { field: 'risk_notes', label: '风险备注', example: '高反光表面' },
    { field: 'module_count', label: '模块数量', example: '3' },
    { field: 'front_view_image', label: '正视图图片', example: 'https://...' },
    { field: 'side_view_image', label: '侧视图图片', example: 'https://...' },
    { field: 'top_view_image', label: '俯视图图片', example: 'https://...' },
    { field: 'product_snapshot', label: '产品标注图', example: 'https://...' },
    { field: 'ws_name', label: '工位名称', example: '上料检测工位' },
    { field: 'ws_code', label: '工位编号', example: 'DB260101.01' },
    { field: 'ws_index', label: '工位序号', example: '1' },
    { field: 'ws_type', label: '工位类型代码', example: 'line' },
    { field: 'ws_type_label', label: '工位类型', example: '线体' },
    { field: 'ws_cycle_time', label: '工位节拍', example: '3.5' },
    { field: 'ws_shot_count', label: '工位拍照次数', example: '2' },
    { field: 'ws_observation_target', label: '工位观测目标', example: '产品正面' },
    { field: 'ws_motion_description', label: '工位运动描述', example: '输送带匀速运动' },
    { field: 'ws_risk_notes', label: '工位风险备注', example: '高反光表面' },
    { field: 'ws_module_count', label: '工位模块数量', example: '3' },
    { field: 'ws_product_size', label: '产品尺寸', example: '120×80×20 mm' },
    { field: 'ws_layout_size', label: '布局尺寸', example: '1200×900×1800 mm' },
    { field: 'ws_camera_count', label: '工位相机数量', example: '2' },
  ],
  module: [
    { field: 'module_name', label: '模块名称', example: '定位模块' },
    { field: 'mod_name', label: '模块名称', example: '定位模块' },
    { field: 'mod_index', label: '模块序号', example: '1' },
    { field: 'mod_type_label', label: '模块分类中文', example: '定位' },
    { field: 'mod_trigger_label', label: '触发方式', example: 'IO触发' },
    { field: 'mod_roi_strategy', label: '模块 ROI 策略', example: '固定 ROI' },
    { field: 'mod_processing_time', label: '处理时限(ms)', example: '100' },
    { field: 'mod_description', label: '模块描述', example: '定位孔检测' },
    { field: 'mod_detection_method', label: '检测方式', example: '2D*1' },
    { field: 'mod_field_of_view', label: '视野范围', example: '380*253mm' },
    { field: 'mod_pixel_accuracy', label: '像素精度', example: '0.07mm/pixel' },
    { field: 'mod_camera_install', label: '相机安装', example: '相机中心和铁芯中心对齐' },
    { field: 'mod_shot_count', label: '拍照次数', example: '1次' },
    { field: 'mod_takt_time', label: '节拍', example: '1.5S/次' },
    { field: 'mod_schematic_url', label: '模块示意图 URL', example: 'https://...' },
    { field: 'schematic_image', label: '模块示意图', example: 'https://...' },
  ],
  hardware: [
    { field: 'cameras', label: '相机列表', loop: true },
    { field: 'lenses', label: '镜头列表', loop: true },
    { field: 'lights', label: '光源列表', loop: true },
    { field: 'controllers', label: '控制器列表', loop: true },
    { field: 'brand', label: '硬件品牌', example: 'Hikvision' },
    { field: 'model', label: '硬件型号', example: 'MV-CA050' },
    { field: 'resolution', label: '相机分辨率', example: '2448×2048' },
    { field: 'sensor_size', label: '传感器尺寸', example: '2/3' },
    { field: 'interface', label: '通讯接口', example: 'GigE' },
    { field: 'focal_length', label: '镜头焦距', example: '25mm' },
    { field: 'mount', label: '镜头接口', example: 'C' },
    { field: 'color', label: '光源颜色', example: '白色' },
    { field: 'cpu', label: '控制器 CPU', example: 'i7' },
    { field: 'memory', label: '控制器内存', example: '16GB' },
  ],
  timestamps: [
    { field: 'generated_at', label: '生成时间(ISO)', example: '2026-05-12T10:30:00Z' },
    { field: 'generated_date', label: '生成日期', example: '2026年5月12日' },
    { field: 'generated_time', label: '生成时间', example: '10:30:00' },
  ],
};

export function getAvailableSystemFields(): string[] {
  const fields: string[] = [];
  Object.values(SYSTEM_FIELDS).forEach((category) => {
    category.forEach((item) => fields.push(item.field));
  });
  return fields;
}

// ==================== TEMPLATE PARSING ====================

export interface ParseTemplateOptions {
  templateId?: string;
  templateUrl?: string;
  file?: File;
}

export interface ParseTemplateResult {
  success: boolean;
  template?: ParsedTemplate;
  error?: string;
}

export async function parseTemplate(options: ParseTemplateOptions): Promise<ParseTemplateResult> {
  const localFallback = options.file ? createLocalFallback(options.file) : null;
  const { data: { session } } = await supabase.auth.getSession();

  if (options.file && !session?.access_token) {
    return localFallback ? localFallback() : { success: false, error: '用户未登录' };
  }

  if (!session?.access_token) {
    return { success: false, error: '用户未登录' };
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const functionUrl = `https://${projectId}.supabase.co/functions/v1/parse-ppt-template`;

  try {
    let body: Record<string, unknown>;

    if (options.file) {
      const tempPath = `temp/${session.user.id}/${Date.now()}_${options.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('ppt-templates')
        .upload(tempPath, options.file, { upsert: true });

      if (uploadError) {
        console.warn('[PPT template parser] temp upload failed, using local parser:', uploadError);
        return localFallback ? localFallback() : { success: false, error: `上传失败: ${uploadError.message}` };
      }

      const { data: urlData } = supabase.storage
        .from('ppt-templates')
        .getPublicUrl(tempPath);

      body = { templateUrl: urlData.publicUrl, fileName: options.file.name, fileSize: options.file.size };
    } else if (options.templateId) {
      body = { templateId: options.templateId };
    } else if (options.templateUrl) {
      body = { templateUrl: options.templateUrl };
    } else {
      return { success: false, error: '请提供模板 ID、URL 或文件' };
    }

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('[PPT template parser] edge parser failed, using local parser:', errorData);
      return localFallback ? localFallback() : { success: false, error: errorData.error || `解析失败: ${response.statusText}` };
    }

    const result = await response.json();
    const edgeTemplate = result.template as ParsedTemplate | undefined;

    if (!edgeTemplate?.slides?.length && localFallback) {
      return localFallback();
    }

    if (localFallback && edgeTemplate && (!edgeTemplate.detectedBindings || !edgeTemplate.roleSummary)) {
      const local = await localFallback();
      if (local.success && local.template) {
        return { success: true, template: mergeParsedTemplates(edgeTemplate, local.template) };
      }
    }

    return { success: true, template: edgeTemplate };
  } catch (error) {
    console.warn('[PPT template parser] edge parser threw, using local parser:', error);
    return localFallback ? localFallback() : { success: false, error: `解析错误: ${error}` };
  }
}

function createLocalFallback(file: File) {
  let cached: Promise<ParseTemplateResult> | null = null;
  return () => {
    cached ||= parseTemplateLocally(file);
    return cached;
  };
}

export async function parseTemplateLocally(file: File): Promise<ParseTemplateResult> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const template = await parsePptx(zip, file.name, file.size);
    return { success: true, template };
  } catch (error) {
    return { success: false, error: `本地解析失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function parsePptx(zip: JSZip, fileName: string, fileSize: number): Promise<ParsedTemplate> {
  const presXml = await readZipFile(zip, 'ppt/presentation.xml');
  const dimensions = parseDimensions(presXml);
  const masterFiles = sortedPptFiles(zip, /^ppt\/slideMasters\/slideMaster(\d+)\.xml$/);
  const layoutFiles = sortedPptFiles(zip, /^ppt\/slideLayouts\/slideLayout(\d+)\.xml$/);
  const slideFiles = sortedPptFiles(zip, /^ppt\/slides\/slide(\d+)\.xml$/);

  const masters = await Promise.all(masterFiles.map(async (path, index) => {
    const xml = await readZipFile(zip, path);
    return {
      id: path.split('/').pop()?.replace('.xml', '') || `slideMaster${index + 1}`,
      name: `母版 ${index + 1}`,
      index,
      background: parseBackground(xml || ''),
      placeholders: parsePlaceholders(xml || ''),
    };
  }));

  const layouts = await Promise.all(layoutFiles.map(async (path) => {
    const xml = await readZipFile(zip, path);
    const id = path.split('/').pop()?.replace('.xml', '') || path;
    const name = decodeXml(xml?.match(/<p:cSld\s+name="([^"]*)"/)?.[1] || id);
    return {
      id,
      name,
      masterRef: '',
      type: detectLayoutType(name),
      placeholders: parsePlaceholders(xml || ''),
    };
  }));

  const allFields = new Set<string>();
  const detectedBindings: RuleDetectedBinding[] = [];
  const roleSummary: Record<string, number> = {};
  const slides: TemplateSlide[] = [];

  for (const path of slideFiles) {
    const index = Number(path.match(/slide(\d+)\.xml$/)?.[1] || '1') - 1;
    const xml = await readZipFile(zip, path) || '';
    const shapes = parseShapes(xml);
    const text = shapes.map((shape) => shape.text).filter(Boolean).join('\n');
    const textFields = collectTextFields(xml);
    const imageFields = collectImageFields(xml);
    const role = detectSlideRole(index, text, await getSlideLayoutRef(zip, path));
    const slideBindings = detectRuleBindings(index, role, shapes, textFields);

    textFields.forEach((field) => allFields.add(field));
    detectedBindings.push(...slideBindings);
    roleSummary[role] = (roleSummary[role] || 0) + 1;

    slides.push({
      index,
      layoutRef: await getSlideLayoutRef(zip, path),
      customFields: [...new Set([...textFields, ...imageFields.map((field) => `img:${field}`)])],
      text,
      title: guessSlideTitle(shapes),
      detectedRole: role,
      shapes,
      detectedBindings: slideBindings,
    });
  }

  return {
    fileName,
    fileSize,
    slideCount: slideFiles.length,
    dimensions,
    masters,
    layouts,
    slides,
    customFields: [...allFields],
    detectedBindings,
    roleSummary,
    availableSystemFields: getAvailableSystemFields(),
    parsedAt: new Date().toISOString(),
  };
}

function mergeParsedTemplates(edgeTemplate: ParsedTemplate, localTemplate: ParsedTemplate): ParsedTemplate {
  return {
    ...localTemplate,
    ...edgeTemplate,
    slides: edgeTemplate.slides?.length
      ? edgeTemplate.slides.map((slide, idx) => ({
          ...localTemplate.slides[idx],
          ...slide,
          detectedRole: slide.detectedRole || localTemplate.slides[idx]?.detectedRole,
          detectedBindings: slide.detectedBindings?.length ? slide.detectedBindings : localTemplate.slides[idx]?.detectedBindings || [],
        }))
      : localTemplate.slides,
    detectedBindings: edgeTemplate.detectedBindings?.length ? edgeTemplate.detectedBindings : localTemplate.detectedBindings,
    roleSummary: edgeTemplate.roleSummary || localTemplate.roleSummary,
  };
}

function sortedPptFiles(zip: JSZip, pattern: RegExp): string[] {
  return Object.keys(zip.files)
    .filter((path) => pattern.test(path))
    .sort((a, b) => Number(a.match(pattern)?.[1] || 0) - Number(b.match(pattern)?.[1] || 0));
}

async function readZipFile(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async('string');
}

function parseDimensions(xml: string | null) {
  const match = xml?.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  if (!match) return { width: 13.333, height: 7.5 };
  return {
    width: Number((Number(match[1]) / EMU_PER_INCH).toFixed(3)),
    height: Number((Number(match[2]) / EMU_PER_INCH).toFixed(3)),
  };
}

function parseBackground(xml: string) {
  const solid = xml.match(/<a:solidFill>\s*<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
  if (solid) return { type: 'color' as const, value: `#${solid[1].toUpperCase()}` };
  if (xml.includes('<a:gradFill')) return { type: 'gradient' as const, value: '' };
  if (xml.includes('<a:blipFill')) return { type: 'image' as const, value: '' };
  return { type: 'color' as const, value: '#FFFFFF' };
}

function parsePlaceholders(xml: string): TemplatePlaceholder[] {
  const placeholders: TemplatePlaceholder[] = [];
  const matches = xml.matchAll(/<p:sp>[\s\S]*?<p:ph([^/]*)\/>[\s\S]*?<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"[\s\S]*?<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/g);
  let idx = 0;
  for (const match of matches) {
    const type = match[1].match(/type="([^"]+)"/)?.[1] || 'body';
    placeholders.push({
      type: normalizePlaceholderType(type),
      name: `${type}_${idx++}`,
      position: emuPosition(match[2], match[3], match[4], match[5]),
    });
  }
  return placeholders;
}

function normalizePlaceholderType(type: string): TemplatePlaceholder['type'] {
  if (['title', 'body', 'picture', 'chart', 'table'].includes(type)) {
    return type as TemplatePlaceholder['type'];
  }
  return 'custom';
}

function parseShapes(xml: string): TemplateShapeInfo[] {
  const shapes: TemplateShapeInfo[] = [];
  const shapeRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  const picRegex = /<p:pic\b[\s\S]*?<\/p:pic>/g;

  for (const match of xml.matchAll(shapeRegex)) {
    const raw = match[0];
    const text = collectShapeText(raw);
    shapes.push({
      id: getShapeId(raw, `sp_${shapes.length}`),
      name: getShapeName(raw),
      kind: text ? 'text' : 'other',
      text,
      position: parseShapePosition(raw),
    });
  }

  for (const match of xml.matchAll(picRegex)) {
    const raw = match[0];
    shapes.push({
      id: getShapeId(raw, `pic_${shapes.length}`),
      name: getShapeName(raw),
      kind: 'picture',
      text: '',
      position: parseShapePosition(raw),
    });
  }

  return shapes.sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
}

function collectShapeText(shapeXml: string): string {
  return [...shapeXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function getShapeId(xml: string, fallback: string): string {
  return xml.match(/<p:cNvPr[^>]*\bid="([^"]+)"/)?.[1] || fallback;
}

function getShapeName(xml: string): string {
  return decodeXml(xml.match(/<p:cNvPr[^>]*\bname="([^"]*)"/)?.[1] || '');
}

function parseShapePosition(xml: string) {
  const match = xml.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"[\s\S]*?<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
  return emuPosition(match?.[1], match?.[2], match?.[3], match?.[4]);
}

function emuPosition(x = '0', y = '0', w = '0', h = '0') {
  return {
    x: Number((Number(x) / EMU_PER_INCH).toFixed(3)),
    y: Number((Number(y) / EMU_PER_INCH).toFixed(3)),
    w: Number((Number(w) / EMU_PER_INCH).toFixed(3)),
    h: Number((Number(h) / EMU_PER_INCH).toFixed(3)),
  };
}

function collectTextFields(xml: string): string[] {
  const fields = new Set<string>();
  for (const match of xml.matchAll(/{{\s*([^{}]+?)\s*}}/g)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('img:')) continue;
    fields.add(raw);
  }
  return [...fields];
}

function collectImageFields(xml: string): string[] {
  const fields = new Set<string>();
  for (const match of xml.matchAll(/{{\s*img:([^{}]+?)\s*}}/g)) {
    const key = match[1].trim();
    if (key) fields.add(key);
  }
  return [...fields];
}

async function getSlideLayoutRef(zip: JSZip, slidePath: string): Promise<string> {
  const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
  const relsXml = await readZipFile(zip, relsPath);
  const target = relsXml?.match(/Type="[^"]+\/slideLayout"[^>]*Target="([^"]+)"/)?.[1];
  if (!target) return 'unknown';
  return target.split('/').pop()?.replace('.xml', '') || 'unknown';
}

function detectLayoutType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('title') || name.includes('标题')) return 'title';
  if (lower.includes('blank') || name.includes('空白')) return 'blank';
  if (lower.includes('section') || name.includes('章节')) return 'section';
  if (lower.includes('two') || name.includes('双') || name.includes('两栏')) return 'two-content';
  return 'content';
}

function detectSlideRole(index: number, text: string, layoutRef: string): TemplateSlideRole {
  const compact = text.replace(/\s+/g, '');
  if (index === 0) return 'cover';
  if (/走进|资质荣誉|数字泛微|公司简介|关于我们/.test(compact)) return 'company_intro';
  if (/目录|CONTENT|Contents/i.test(compact)) return 'toc';
  if (/章节|Section/i.test(layoutRef) || (/^0?\d/.test(compact) && compact.length < 80)) return 'section';
  if (/方案|解决方案|检测|技术|要求|系统|工位|模块/.test(compact)) return 'content';
  return 'general';
}

function guessSlideTitle(shapes: TemplateShapeInfo[]): string {
  return shapes
    .filter((shape) => shape.kind === 'text' && shape.text)
    .sort((a, b) => (b.position.h - a.position.h) || (a.position.y - b.position.y))[0]
    ?.text
    ?.slice(0, 80) || '';
}

function detectRuleBindings(
  slideIndex: number,
  role: TemplateSlideRole,
  shapes: TemplateShapeInfo[],
  textFields: string[],
): RuleDetectedBinding[] {
  const bindings: RuleDetectedBinding[] = [];

  textFields.forEach((field, idx) => {
    const systemField = getAvailableSystemFields().includes(field) ? field : guessSystemField(field, role, shapes[idx]);
    bindings.push({
      id: `s${slideIndex}-placeholder-${field}`,
      slideIndex,
      shapeId: '',
      sourceText: `{{${field}}}`,
      token: field,
      label: `{{${field}}}`,
      matchType: 'placeholder',
      replacementMode: 'replace-token',
      suggestedSystemField: systemField,
      confidence: systemField === field ? 1 : 0.65,
    });
  });

  shapes.forEach((shape) => {
    if (shape.kind === 'picture') {
      const suggested = guessImageField(shape, role);
      if (suggested) {
        bindings.push({
          id: `s${slideIndex}-pic-${shape.id}`,
          slideIndex,
          shapeId: shape.id,
          shapeName: shape.name,
          sourceText: shape.name || '图片',
          label: imageFieldLabel(suggested),
          matchType: 'image',
          replacementMode: 'replace-picture',
          suggestedSystemField: suggested,
          confidence: 0.45,
          optional: true,
        });
      }
      return;
    }

    if (!shape.text) return;
    const xTokens = [...shape.text.matchAll(/[XxＸｘ]{2,}|_{3,}/g)];
    xTokens.forEach((tokenMatch, idx) => {
      const token = tokenMatch[0];
      const suggested = guessSystemField(shape.text, role, shape, idx);
      bindings.push({
        id: `s${slideIndex}-sp-${shape.id}-x-${idx}`,
        slideIndex,
        shapeId: shape.id,
        shapeName: shape.name,
        sourceText: shape.text,
        token,
        label: getFieldLabel(suggested),
        matchType: 'xxxx',
        replacementMode: 'replace-token',
        suggestedSystemField: suggested,
        confidence: confidenceForSuggestion(shape.text, role, suggested),
      });
    });
  });

  return bindings;
}

function guessSystemField(text: string, role: TemplateSlideRole, shape?: TemplateShapeInfo, occurrenceIndex = 0): string {
  const compact = text.replace(/\s+/g, '');
  if (/报告人|汇报人|负责人|Author|Presenter/i.test(compact)) return 'responsible';
  if (/日期|时间|Date/i.test(compact)) return 'date_formatted';
  if (/客户|Client|Customer/i.test(compact)) return 'customer';
  if (/密级|公开|涉密|绝密|Confidential/i.test(compact)) return 'security_level';
  if (/项目编号|项目号|编号|Code/i.test(compact)) return 'project_code';
  if (/项目|方案|标题|主题|Project|Title/i.test(compact)) return 'project_name';
  if (role === 'cover') {
    if ((shape?.position.y ?? 9) < 2.4) return 'project_name';
    if (occurrenceIndex === 0) return 'project_name';
    if (occurrenceIndex === 1) return 'responsible';
    if (occurrenceIndex === 2) return 'date_formatted';
  }
  if (role === 'toc') return 'project_name';
  return 'project_name';
}

function confidenceForSuggestion(text: string, role: TemplateSlideRole, field: string): number {
  if (/报告人|汇报人|负责人|日期|时间|客户|密级|项目编号|编号|项目|方案/.test(text)) return 0.9;
  if (role === 'cover' && ['project_name', 'responsible', 'date_formatted'].includes(field)) return 0.72;
  return 0.55;
}

function guessImageField(shape: TemplateShapeInfo, role: TemplateSlideRole): string | null {
  const name = `${shape.name}`.toLowerCase();
  if (/front|正视|正面/.test(name)) return 'front_view_image';
  if (/side|侧视|侧面/.test(name)) return 'side_view_image';
  if (/top|俯视|俯视图/.test(name)) return 'top_view_image';
  if (/product|产品|标注/.test(name)) return 'product_snapshot';
  if (/schematic|diagram|示意/.test(name)) return 'schematic_image';
  if (role === 'content') return 'product_snapshot';
  return null;
}

function imageFieldLabel(field: string): string {
  return getFieldLabel(field);
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// ==================== FIELD MAPPING ====================

export interface FieldMapping {
  templateField: string;
  systemField: string;
}

export function autoMapFields(customFields: string[]): FieldMapping[] {
  const allFields = getAvailableSystemFields();
  const mappings: FieldMapping[] = [];

  customFields.forEach((templateField) => {
    if (allFields.includes(templateField)) {
      mappings.push({ templateField, systemField: templateField });
      return;
    }

    const normalized = templateField.toLowerCase().replace(/[-_]/g, '');
    const match = allFields.find((field) => field.toLowerCase().replace(/[-_]/g, '') === normalized);
    if (match) {
      mappings.push({ templateField, systemField: match });
    }
  });

  return mappings;
}

export const LOOP_SYNTAX_EXAMPLES = `
工位循环:
{{#workstations}}
  工位 {{index}}: {{name}}
  编号: {{code}}
  类型: {{type_label}}

  {{#modules}}
    模块 {{index}}: {{name}} ({{type_label}})
  {{/modules}}
{{/workstations}}

图片占位:
{{img:front_view}} - 正视图
{{img:side_view}} - 侧视图
{{img:top_view}} - 俯视图
{{img:product_snapshot}} - 产品标注图
`;

export function getFieldCategory(field: string): string {
  for (const [category, fields] of Object.entries(SYSTEM_FIELDS)) {
    if (fields.some((item) => item.field === field)) return category;
  }
  return 'custom';
}

export function getFieldLabel(field: string): string {
  for (const fields of Object.values(SYSTEM_FIELDS)) {
    const found = fields.find((item) => item.field === field);
    if (found) return found.label;
  }
  return field;
}
