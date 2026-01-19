import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import PizZip from "https://esm.sh/pizzip@3.1.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== TYPE DEFINITIONS ====================

interface ProjectData {
  id: string;
  code: string;
  name: string;
  customer: string;
  date: string | null;
  responsible: string | null;
  vision_responsible?: string | null;
  sales_responsible?: string | null;
  product_process: string | null;
  quality_strategy: string | null;
  environment: string[] | null;
  notes: string | null;
  revision_history?: Array<{
    version: string;
    date: string;
    author: string;
    content: string;
  }>;
}

interface WorkstationData {
  id: string;
  code: string;
  name: string;
  type: string;
  cycle_time: number | null;
  product_dimensions: { length: number; width: number; height: number } | null;
  enclosed: boolean | null;
  process_stage?: string | null;
  observation_target?: string | null;
  motion_description?: string | null;
  risk_notes?: string | null;
  shot_count?: number | null;
  acceptance_criteria?: {
    accuracy?: string;
    cycle_time?: string;
    compatible_sizes?: string;
  } | null;
  modules?: ModuleData[];
  layout?: LayoutData | null;
  product_annotation?: AnnotationData | null;
  product_asset?: ProductAssetData | null;
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
  schematic_image_url?: string | null;
}

interface LayoutData {
  front_view_image_url?: string | null;
  side_view_image_url?: string | null;
  top_view_image_url?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  camera_count?: number | null;
  conveyor_type?: string | null;
  mechanisms?: string[] | null;
  selected_cameras?: Array<{ brand: string; model: string; image_url?: string | null }> | null;
  selected_lenses?: Array<{ brand: string; model: string; image_url?: string | null }> | null;
  selected_lights?: Array<{ brand: string; model: string; image_url?: string | null }> | null;
  selected_controller?: { brand: string; model: string; image_url?: string | null } | null;
}

interface AnnotationData {
  snapshot_url: string;
  annotations_json: Array<{ labelNumber?: number; label?: string }>;
  remark?: string | null;
}

interface ProductAssetData {
  preview_images?: Array<{ url: string; name?: string }> | null;
  detection_method?: string | null;
  product_models?: Array<{ name: string; spec: string }> | null;
  detection_requirements?: Array<{ content: string; highlight?: string | null }> | null;
}

interface HardwareData {
  cameras?: Array<{ brand: string; model: string; resolution: string; sensor_size: string; interface: string; image_url?: string | null }>;
  lenses?: Array<{ brand: string; model: string; focal_length: string; mount: string; image_url?: string | null }>;
  lights?: Array<{ brand: string; model: string; type: string; color: string; image_url?: string | null }>;
  controllers?: Array<{ brand: string; model: string; cpu: string; memory: string; image_url?: string | null }>;
}

interface GenerationData {
  project: ProjectData;
  workstations: WorkstationData[];
  modules: ModuleData[];
  hardware: HardwareData;
  language?: 'zh' | 'en';
}

interface RequestBody {
  templateId: string;
  data: GenerationData;
  outputFileName?: string;
  options?: {
    duplicateWorkstationSlides?: boolean;
    workstationSlideMapping?: Record<string, number[]>;
    enableSmartReplace?: boolean; // 启用智能替换
  };
}

// ==================== SLIDE TYPE DETECTION ====================

const SLIDE_TYPE_PATTERNS = {
  title: /封面|标题|title|项目方案|技术方案/i,
  basic_info: /基本信息|项目信息|概述|overview|basic/i,
  product_schematic: /产品示意|产品图|检测对象|product/i,
  technical_requirements: /技术要求|检测要求|requirements/i,
  three_view: /三视图|布局图|机械布局|layout|three.?view/i,
  schematic_diagram: /示意图|布置图|schematic|diagram/i,
  motion_method: /运动方式|检测方式|运动.*检测|motion|detection/i,
  optical_solution: /光学方案|optical|镜头|相机|光源/i,
  vision_list: /视觉清单|测量方法|vision.*list|measurement/i,
  bom: /bom|物料|清单|硬件列表|hardware/i,
  thank_you: /谢谢|thank|结束|end/i,
};

type SlideType = keyof typeof SLIDE_TYPE_PATTERNS | 'cover' | 'unknown';

interface SlideInfo {
  index: number;
  path: string;
  layoutRef: string;
  layoutType: string;
  detectedType: SlideType;
  customFields: string[];
  hasLoopSyntax: boolean;
  textBoxes: TextBoxInfo[];
}

interface TextBoxInfo {
  id: string;
  text: string;
  fontSize: number;
  isBold: boolean;
  position: { x: number; y: number; width: number; height: number };
  textType: 'title' | 'subtitle' | 'body' | 'date' | 'footer' | 'unknown';
}

interface ReplacementLog {
  slideIndex: number;
  slideType: string;
  replacements: Array<{ original: string; replaced: string; type: string }>;
}

// ==================== LABEL MAPPINGS ====================

const WS_TYPE_LABELS: Record<string, string> = {
  line: '线体',
  turntable: '转盘',
  platform: '平台',
  robot: '机器人',
  manual: '手动',
};

const MODULE_TYPE_LABELS: Record<string, string> = {
  positioning: '定位检测',
  defect: '缺陷检测',
  measurement: '尺寸测量',
  ocr: 'OCR识别',
  deep_learning: '深度学习',
  custom: '自定义',
};

const TRIGGER_LABELS: Record<string, string> = {
  io: 'IO触发',
  software: '软触发',
  continuous: '连续采集',
  external: '外部触发',
};

const PROCESS_STAGE_LABELS: Record<string, string> = {
  incoming: '来料检测',
  in_process: '过程检测',
  final: '终检',
  assembly: '装配检测',
  packaging: '包装检测',
};

// ==================== UTILITY FUNCTIONS ====================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 检测幻灯片类型
 */
function detectSlideType(content: string, layoutType: string, slideIndex: number): SlideType {
  const textContent = content.replace(/<[^>]*>/g, ' ').toLowerCase();
  
  // 第一页通常是封面
  if (slideIndex === 0) {
    return 'cover';
  }
  
  for (const [type, pattern] of Object.entries(SLIDE_TYPE_PATTERNS)) {
    if (pattern.test(textContent)) {
      return type as SlideType;
    }
  }
  
  // 根据布局类型推断
  if (layoutType.includes('title') || layoutType.includes('Title')) {
    return 'title';
  }
  
  return 'unknown';
}

/**
 * 提取自定义占位符
 */
function extractCustomFields(content: string): string[] {
  const fields: string[] = [];
  const pattern = /\{\{([^#/}][^}]*)\}\}/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const field = match[1].trim();
    if (!fields.includes(field)) {
      fields.push(field);
    }
  }
  return fields;
}

/**
 * 检查是否有循环语法
 */
function hasLoopSyntax(content: string): boolean {
  return /\{\{#(workstations|modules|hardware\.\w+)\}\}/.test(content);
}

/**
 * 提取文本框信息（用于智能替换）
 */
function extractTextBoxes(content: string): TextBoxInfo[] {
  const textBoxes: TextBoxInfo[] = [];
  
  // 匹配 <a:t> 标签中的文本
  const textPattern = /<a:t>([^<]*)<\/a:t>/g;
  let match;
  let index = 0;
  
  while ((match = textPattern.exec(content)) !== null) {
    const text = match[1].trim();
    if (!text) continue;
    
    // 分析文本类型
    let textType: TextBoxInfo['textType'] = 'unknown';
    const fontSize = extractFontSize(content, match.index);
    const isBold = checkIsBold(content, match.index);
    
    // 根据字体大小和位置判断文本类型
    if (fontSize >= 28 || isBold) {
      textType = 'title';
    } else if (fontSize >= 18) {
      textType = 'subtitle';
    } else if (text.match(/\d{4}[\-\/\.年]\d{1,2}[\-\/\.月]?\d{0,2}/)) {
      textType = 'date';
    } else {
      textType = 'body';
    }
    
    textBoxes.push({
      id: `tb_${index++}`,
      text,
      fontSize,
      isBold,
      position: { x: 0, y: 0, width: 0, height: 0 },
      textType,
    });
  }
  
  return textBoxes;
}

/**
 * 提取字体大小
 */
function extractFontSize(content: string, position: number): number {
  // 向前查找 <a:sz val="xxxx" /> 标签
  const searchStart = Math.max(0, position - 500);
  const searchArea = content.substring(searchStart, position);
  
  const szMatch = searchArea.match(/<a:sz\s+val="(\d+)"/);
  if (szMatch) {
    // OOXML 字体大小单位是百分之一磅
    return parseInt(szMatch[1]) / 100;
  }
  return 14; // 默认字号
}

/**
 * 检查是否粗体
 */
function checkIsBold(content: string, position: number): boolean {
  const searchStart = Math.max(0, position - 500);
  const searchArea = content.substring(searchStart, position);
  return /<a:b[^a-z]/.test(searchArea);
}

// ==================== DATA PREPARATION ====================

/**
 * 准备项目级别模板数据
 */
function prepareProjectData(data: GenerationData): Record<string, string> {
  const result: Record<string, string> = {};
  const p = data.project;
  
  // 项目级别字段
  result['project_name'] = p.name || '';
  result['project_code'] = p.code || '';
  result['customer'] = p.customer || '';
  result['date'] = p.date || '';
  result['responsible'] = p.responsible || '';
  result['vision_responsible'] = p.vision_responsible || '';
  result['sales_responsible'] = p.sales_responsible || '';
  result['product_process'] = p.product_process || '';
  result['quality_strategy'] = p.quality_strategy || '';
  result['notes'] = p.notes || '';
  
  // 日期格式化
  if (p.date) {
    const d = new Date(p.date);
    result['date_formatted'] = d.toLocaleDateString('zh-CN');
    result['date_year'] = String(d.getFullYear());
    result['date_month'] = String(d.getMonth() + 1);
    result['date_day'] = String(d.getDate());
  }
  
  // 统计信息
  result['workstation_count'] = String(data.workstations?.length || 0);
  result['total_module_count'] = String(data.modules?.length || 0);
  result['camera_count'] = String(data.hardware?.cameras?.length || 0);
  result['lens_count'] = String(data.hardware?.lenses?.length || 0);
  result['light_count'] = String(data.hardware?.lights?.length || 0);
  result['controller_count'] = String(data.hardware?.controllers?.length || 0);
  result['total_hardware_count'] = String(
    (data.hardware?.cameras?.length || 0) +
    (data.hardware?.lenses?.length || 0) +
    (data.hardware?.lights?.length || 0) +
    (data.hardware?.controllers?.length || 0)
  );
  
  // 时间戳
  const now = new Date();
  result['generated_at'] = now.toISOString();
  result['generated_date'] = now.toLocaleDateString('zh-CN');
  result['generated_time'] = now.toLocaleTimeString('zh-CN');
  
  // 公司名称
  result['company_name'] = data.language === 'en' 
    ? 'SuZhou DXY Intelligent Solution Co.,Ltd' 
    : '苏州德星云智能装备有限公司';
  
  return result;
}

/**
 * 准备工位级别模板数据
 */
function prepareWorkstationData(ws: WorkstationData, index: number): Record<string, string> {
  const result: Record<string, string> = {};
  
  result['ws_name'] = ws.name || '';
  result['ws_code'] = ws.code || '';
  result['ws_index'] = String(index + 1);
  result['ws_type'] = ws.type || '';
  result['ws_type_label'] = WS_TYPE_LABELS[ws.type] || ws.type || '';
  result['ws_cycle_time'] = ws.cycle_time ? String(ws.cycle_time) : '';
  result['ws_shot_count'] = ws.shot_count ? String(ws.shot_count) : '';
  result['ws_observation_target'] = ws.observation_target || '';
  result['ws_motion_description'] = ws.motion_description || '';
  result['ws_risk_notes'] = ws.risk_notes || '';
  result['ws_process_stage'] = ws.process_stage || '';
  result['ws_process_stage_label'] = PROCESS_STAGE_LABELS[ws.process_stage || ''] || ws.process_stage || '';
  result['ws_enclosed'] = ws.enclosed ? '是' : '否';
  result['ws_module_count'] = String(ws.modules?.length || 0);
  
  // 产品尺寸
  if (ws.product_dimensions) {
    result['ws_product_length'] = String(ws.product_dimensions.length || 0);
    result['ws_product_width'] = String(ws.product_dimensions.width || 0);
    result['ws_product_height'] = String(ws.product_dimensions.height || 0);
    result['ws_product_size'] = `${ws.product_dimensions.length}×${ws.product_dimensions.width}×${ws.product_dimensions.height}mm`;
  }
  
  // 验收标准
  if (ws.acceptance_criteria) {
    result['ws_accuracy'] = ws.acceptance_criteria.accuracy || '';
    result['ws_cycle_time_target'] = ws.acceptance_criteria.cycle_time || '';
    result['ws_compatible_sizes'] = ws.acceptance_criteria.compatible_sizes || '';
  }
  
  // 布局相关
  if (ws.layout) {
    result['ws_camera_count'] = String(ws.layout.camera_count || 0);
    result['ws_conveyor_type'] = ws.layout.conveyor_type || '';
    result['ws_layout_width'] = String(ws.layout.width || 0);
    result['ws_layout_height'] = String(ws.layout.height || 0);
    result['ws_layout_depth'] = String(ws.layout.depth || 0);
    result['ws_layout_size'] = `${ws.layout.width || 0}×${ws.layout.depth || 0}×${ws.layout.height || 0}mm`;
    
    // 图片URL
    result['ws_front_view_url'] = ws.layout.front_view_image_url || '';
    result['ws_side_view_url'] = ws.layout.side_view_image_url || '';
    result['ws_top_view_url'] = ws.layout.top_view_image_url || '';
  }
  
  // 产品标注
  if (ws.product_annotation) {
    result['ws_product_snapshot_url'] = ws.product_annotation.snapshot_url || '';
    result['ws_product_remark'] = ws.product_annotation.remark || '';
  }
  
  return result;
}

/**
 * 准备模块级别模板数据
 */
function prepareModuleData(mod: ModuleData, index: number): Record<string, string> {
  const result: Record<string, string> = {};
  
  result['mod_name'] = mod.name || '';
  result['mod_index'] = String(index + 1);
  result['mod_type'] = mod.type || '';
  result['mod_type_label'] = MODULE_TYPE_LABELS[mod.type] || mod.type || '';
  result['mod_description'] = mod.description || '';
  result['mod_trigger_type'] = mod.trigger_type || '';
  result['mod_trigger_label'] = TRIGGER_LABELS[mod.trigger_type || ''] || mod.trigger_type || '';
  result['mod_roi_strategy'] = mod.roi_strategy || '';
  result['mod_processing_time'] = mod.processing_time_limit ? String(mod.processing_time_limit) : '';
  result['mod_schematic_url'] = mod.schematic_image_url || '';
  
  return result;
}

// ==================== SMART TEXT REPLACEMENT ====================

/**
 * 智能替换封面页内容
 * 识别标题、副标题、日期等位置并替换
 */
function smartReplaceCoverSlide(
  content: string, 
  projectData: Record<string, string>,
  _textBoxes: TextBoxInfo[]
): { content: string; replacements: Array<{ original: string; replaced: string; type: string }> } {
  let result = content;
  const replacements: Array<{ original: string; replaced: string; type: string }> = [];
  
  // 策略1：查找并替换大标题（通常是最大字体的文本）
  // 查找 <a:t> 标签，根据上下文判断是否是标题
  const textElements = [...content.matchAll(/<a:t>([^<]+)<\/a:t>/g)];
  
  for (const match of textElements) {
    const originalText = match[1];
    const matchIndex = match.index || 0;
    
    // 检查是否是标题（根据字体大小、位置等判断）
    const fontSize = extractFontSize(content, matchIndex);
    const isBold = checkIsBold(content, matchIndex);
    
    // 标题通常字体较大且可能加粗
    if (fontSize >= 24 || isBold) {
      // 检查是否是日期格式
      if (originalText.match(/\d{4}[\-\/\.年]\d{1,2}[\-\/\.月]?\d{0,2}/)) {
        if (projectData['date_formatted']) {
          result = result.replace(`<a:t>${originalText}</a:t>`, `<a:t>${escapeXml(projectData['date_formatted'])}</a:t>`);
          replacements.push({ original: originalText, replaced: projectData['date_formatted'], type: 'date' });
        }
      }
      // 检查是否包含"方案"、"项目"等关键词（可能是标题）
      else if (originalText.match(/方案|项目|技术|视觉|检测|测试/)) {
        const newTitle = projectData['project_name'] || projectData['project_code'] || '';
        if (newTitle) {
          // 构建新标题，保留"技术方案"等后缀
          let suffix = '';
          const suffixMatch = originalText.match(/(技术方案|项目方案|检测方案|视觉方案|方案)$/);
          if (suffixMatch) {
            suffix = suffixMatch[1];
          }
          const fullTitle = suffix ? `${newTitle}${suffix}` : newTitle;
          result = result.replace(`<a:t>${originalText}</a:t>`, `<a:t>${escapeXml(fullTitle)}</a:t>`);
          replacements.push({ original: originalText, replaced: fullTitle, type: 'title' });
        }
      }
      // 检查是否包含公司名相关内容
      else if (originalText.match(/公司|Co\.|Ltd|有限/i)) {
        // 保持公司名不变，或替换为项目数据中的公司名
        if (projectData['company_name']) {
          result = result.replace(`<a:t>${originalText}</a:t>`, `<a:t>${escapeXml(projectData['company_name'])}</a:t>`);
          replacements.push({ original: originalText, replaced: projectData['company_name'], type: 'company' });
        }
      }
    }
    
    // 检查客户名称（通常在副标题位置）
    if (fontSize >= 14 && fontSize < 24 && !isBold) {
      if (originalText.match(/客户|customer|致/i)) {
        if (projectData['customer']) {
          const newText = `致：${projectData['customer']}`;
          result = result.replace(`<a:t>${originalText}</a:t>`, `<a:t>${escapeXml(newText)}</a:t>`);
          replacements.push({ original: originalText, replaced: newText, type: 'customer' });
        }
      }
    }
  }
  
  return { content: result, replacements };
}

/**
 * 智能替换幻灯片内容
 * 根据幻灯片类型采用不同的替换策略
 */
function smartReplaceSlideContent(
  content: string,
  slideType: SlideType,
  projectData: Record<string, string>,
  slideIndex: number
): { content: string; replacements: Array<{ original: string; replaced: string; type: string }> } {
  const textBoxes = extractTextBoxes(content);
  
  // 封面页特殊处理
  if (slideType === 'cover' || slideIndex === 0) {
    return smartReplaceCoverSlide(content, projectData, textBoxes);
  }
  
  // 其他页面：查找并替换可识别的文本模式
  let result = content;
  const replacements: Array<{ original: string; replaced: string; type: string }> = [];
  
  // 替换项目相关文本
  const projectPatterns = [
    { pattern: /项目名称[：:]\s*([^\n<]+)/g, field: 'project_name', label: '项目名称' },
    { pattern: /项目编号[：:]\s*([^\n<]+)/g, field: 'project_code', label: '项目编号' },
    { pattern: /客户[：:]\s*([^\n<]+)/g, field: 'customer', label: '客户' },
    { pattern: /日期[：:]\s*([^\n<]+)/g, field: 'date_formatted', label: '日期' },
    { pattern: /负责人[：:]\s*([^\n<]+)/g, field: 'responsible', label: '负责人' },
    { pattern: /工位数量[：:]\s*(\d+)/g, field: 'workstation_count', label: '工位数量' },
    { pattern: /相机数量[：:]\s*(\d+)/g, field: 'camera_count', label: '相机数量' },
  ];
  
  for (const { pattern, field, label } of projectPatterns) {
    const value = projectData[field];
    if (value) {
      result = result.replace(pattern, (_match, _oldValue) => {
        replacements.push({ original: _oldValue, replaced: value, type: label });
        return `${label}：${escapeXml(value)}`;
      });
    }
  }
  
  return { content: result, replacements };
}

// ==================== TEXT REPLACEMENT ====================

/**
 * 替换简单占位符
 */
function replaceSimplePlaceholders(content: string, data: Record<string, string>): string {
  let result = content;
  
  for (const [key, value] of Object.entries(data)) {
    // 处理可能被XML标签分割的占位符
    const patterns = [
      new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'),
      new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g'),
    ];
    
    for (const pattern of patterns) {
      result = result.replace(pattern, escapeXml(value));
    }
  }
  
  return result;
}

/**
 * 处理循环语法 {{#collection}}...{{/collection}}
 */
function processLoops(content: string, data: GenerationData): string {
  let result = content;
  
  // 处理工位循环
  const wsLoopPattern = /\{\{#workstations\}\}([\s\S]*?)\{\{\/workstations\}\}/g;
  result = result.replace(wsLoopPattern, (_, template) => {
    return data.workstations.map((ws, i) => {
      let wsContent = template;
      const wsData = prepareWorkstationData(ws, i);
      wsContent = replaceSimplePlaceholders(wsContent, wsData);
      
      // 处理嵌套的模块循环
      const modLoopPattern = /\{\{#modules\}\}([\s\S]*?)\{\{\/modules\}\}/g;
      wsContent = wsContent.replace(modLoopPattern, (_match: string, modTemplate: string) => {
        return (ws.modules || []).map((mod, j) => {
          const modContent = modTemplate;
          const modData = prepareModuleData(mod, j);
          return replaceSimplePlaceholders(modContent, modData);
        }).join('');
      });
      
      return wsContent;
    }).join('');
  });
  
  // 处理硬件循环
  const hwLoops = [
    { pattern: /\{\{#hardware\.cameras\}\}([\s\S]*?)\{\{\/hardware\.cameras\}\}/g, items: data.hardware?.cameras },
    { pattern: /\{\{#hardware\.lenses\}\}([\s\S]*?)\{\{\/hardware\.lenses\}\}/g, items: data.hardware?.lenses },
    { pattern: /\{\{#hardware\.lights\}\}([\s\S]*?)\{\{\/hardware\.lights\}\}/g, items: data.hardware?.lights },
    { pattern: /\{\{#hardware\.controllers\}\}([\s\S]*?)\{\{\/hardware\.controllers\}\}/g, items: data.hardware?.controllers },
  ];
  
  for (const { pattern, items } of hwLoops) {
    result = result.replace(pattern, (_, template) => {
      return (items || []).map((item, i) => {
        let itemContent = template;
        const itemData: Record<string, string> = { index: String(i + 1) };
        for (const [k, v] of Object.entries(item)) {
          if (typeof v === 'string') {
            itemData[k] = v;
          }
        }
        return replaceSimplePlaceholders(itemContent, itemData);
      }).join('');
    });
  }
  
  return result;
}

// ==================== IMAGE HANDLING ====================

interface ImageInsertRequest {
  placeholderName: string;
  imageUrl: string;
  position?: { x: number; y: number; w: number; h: number };
}

/**
 * 收集需要插入的图片
 */
function collectImageInserts(ws: WorkstationData): ImageInsertRequest[] {
  const images: ImageInsertRequest[] = [];
  
  if (ws.layout?.front_view_image_url) {
    images.push({ placeholderName: 'front_view', imageUrl: ws.layout.front_view_image_url });
  }
  if (ws.layout?.side_view_image_url) {
    images.push({ placeholderName: 'side_view', imageUrl: ws.layout.side_view_image_url });
  }
  if (ws.layout?.top_view_image_url) {
    images.push({ placeholderName: 'top_view', imageUrl: ws.layout.top_view_image_url });
  }
  if (ws.product_annotation?.snapshot_url) {
    images.push({ placeholderName: 'product_snapshot', imageUrl: ws.product_annotation.snapshot_url });
  }
  
  return images;
}

/**
 * 下载图片并转为Base64
 */
async function fetchImageAsBase64(url: string): Promise<{ data: string; contentType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const contentType = response.headers.get('content-type') || 'image/png';
    
    return { data: base64, contentType };
  } catch (error) {
    console.error(`Failed to fetch image: ${url}`, error);
    return null;
  }
}

/**
 * 在PPTX中插入图片
 * 查找图片占位符 {{img:placeholder_name}} 并替换
 */
async function insertImagesIntoSlide(
  zip: PizZip,
  slidePath: string,
  images: ImageInsertRequest[]
): Promise<number> {
  const content = zip.file(slidePath)?.asText();
  if (!content) return 0;
  
  let insertedCount = 0;
  
  // 查找图片占位符
  const imgPattern = /\{\{img:(\w+)\}\}/g;
  const matches = [...content.matchAll(imgPattern)];
  
  for (const match of matches) {
    const placeholderName = match[1];
    const imageReq = images.find(img => img.placeholderName === placeholderName);
    
    if (imageReq) {
      const imageData = await fetchImageAsBase64(imageReq.imageUrl);
      if (imageData) {
        // 生成图片关系ID
        const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/').replace('.xml', '.xml.rels');
        let relsContent = zip.file(relsPath)?.asText() || '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
        
        // 计算新的rId
        const rIdMatches = [...relsContent.matchAll(/rId(\d+)/g)];
        const maxRId = Math.max(0, ...rIdMatches.map(m => parseInt(m[1])));
        const newRId = `rId${maxRId + 1}`;
        
        // 确定图片扩展名
        const ext = imageData.contentType.includes('jpeg') ? 'jpeg' : 
                    imageData.contentType.includes('gif') ? 'gif' : 'png';
        
        // 添加图片文件到media目录
        const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
        const imageIndex = mediaFiles.length + 1;
        const imagePath = `ppt/media/image${imageIndex}.${ext}`;
        
        // 解码Base64并写入
        const binaryStr = atob(imageData.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        zip.file(imagePath, bytes);
        
        // 添加关系
        const newRel = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${imageIndex}.${ext}"/>`;
        relsContent = relsContent.replace('</Relationships>', `${newRel}</Relationships>`);
        zip.file(relsPath, relsContent);
        
        // 更新 [Content_Types].xml
        const contentTypesPath = '[Content_Types].xml';
        let contentTypes = zip.file(contentTypesPath)?.asText() || '';
        if (!contentTypes.includes(`Extension="${ext}"`)) {
          const mimeType = ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
          contentTypes = contentTypes.replace('</Types>', `<Default Extension="${ext}" ContentType="${mimeType}"/></Types>`);
          zip.file(contentTypesPath, contentTypes);
        }
        
        console.log(`Inserted image: ${placeholderName} -> ${imagePath}`);
        insertedCount++;
      }
    }
  }
  
  return insertedCount;
}

// ==================== SLIDE DUPLICATION ====================

/**
 * 解析presentation.xml获取幻灯片信息
 */
function parsePresentation(zip: PizZip, enableSmartReplace: boolean): { slideIds: string[]; maxId: number; slideInfos: SlideInfo[] } {
  const presContent = zip.file('ppt/presentation.xml')?.asText() || '';
  const slideIds: string[] = [];
  let maxId = 256;
  
  const sldIdPattern = /<p:sldId\s+([^>]*)\/?\s*>/g;
  const idAttrPattern = /\bid="(\d+)"/;
  const rIdAttrPattern = /r:id="([^"]+)"/;
  
  let match;
  while ((match = sldIdPattern.exec(presContent)) !== null) {
    const attrs = match[1];
    const idMatch = idAttrPattern.exec(attrs);
    const rIdMatch = rIdAttrPattern.exec(attrs);
    
    if (rIdMatch) {
      slideIds.push(rIdMatch[1]);
    }
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      if (id > maxId) maxId = id;
    }
  }
  
  // 解析每个幻灯片的详细信息
  const slideInfos: SlideInfo[] = [];
  const allFiles = Object.keys(zip.files);
  const slideFiles = allFiles.filter(f => 
    f.toLowerCase().includes('ppt/slides/slide') && 
    f.endsWith('.xml') && 
    !f.includes('_rels')
  ).sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/i)?.[1] || '0');
    const numB = parseInt(b.match(/slide(\d+)/i)?.[1] || '0');
    return numA - numB;
  });
  
  slideFiles.forEach((path, index) => {
    const content = zip.file(path)?.asText() || '';
    
    // 提取布局引用
    const layoutRefMatch = content.match(/r:id="([^"]+)"/);
    const layoutRef = layoutRefMatch?.[1] || '';
    
    // 确定布局类型
    let layoutType = 'unknown';
    if (content.includes('titleOnly')) layoutType = 'titleOnly';
    else if (content.includes('title')) layoutType = 'title';
    else if (content.includes('blank')) layoutType = 'blank';
    else if (content.includes('twoCol')) layoutType = 'twoCol';
    else if (content.includes('obj')) layoutType = 'obj';
    
    // 提取文本框信息（用于智能替换）
    const textBoxes = enableSmartReplace ? extractTextBoxes(content) : [];
    
    slideInfos.push({
      index,
      path,
      layoutRef,
      layoutType,
      detectedType: detectSlideType(content, layoutType, index),
      customFields: extractCustomFields(content),
      hasLoopSyntax: hasLoopSyntax(content),
      textBoxes,
    });
  });
  
  return { slideIds, maxId, slideInfos };
}

/**
 * 复制幻灯片
 */
function duplicateSlide(
  zip: PizZip,
  sourceSlideNum: number,
  newSlideNum: number,
  data: Record<string, string>,
  fullData?: GenerationData
): boolean {
  try {
    const sourcePath = `ppt/slides/slide${sourceSlideNum}.xml`;
    const sourceRelsPath = `ppt/slides/_rels/slide${sourceSlideNum}.xml.rels`;
    
    let sourceContent = zip.file(sourcePath)?.asText();
    const sourceRels = zip.file(sourceRelsPath)?.asText();
    
    if (!sourceContent) {
      console.warn(`Source slide ${sourceSlideNum} not found`);
      return false;
    }
    
    // 处理循环语法（如果有完整数据）
    if (fullData && hasLoopSyntax(sourceContent)) {
      sourceContent = processLoops(sourceContent, fullData);
    }
    
    // 替换简单占位符
    const newContent = replaceSimplePlaceholders(sourceContent, data);
    
    const newPath = `ppt/slides/slide${newSlideNum}.xml`;
    const newRelsPath = `ppt/slides/_rels/slide${newSlideNum}.xml.rels`;
    
    zip.file(newPath, newContent);
    if (sourceRels) {
      zip.file(newRelsPath, sourceRels);
    }
    
    return true;
  } catch (error) {
    console.error(`Error duplicating slide ${sourceSlideNum}:`, error);
    return false;
  }
}

/**
 * 添加幻灯片引用到 presentation.xml
 */
function addSlideToPresentation(zip: PizZip, slideNum: number, slideId: number): void {
  const presPath = 'ppt/presentation.xml';
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  
  let presContent = zip.file(presPath)?.asText() || '';
  let presRels = zip.file(presRelsPath)?.asText() || '';
  
  const rIdPattern = /rId(\d+)/g;
  let maxRId = 0;
  let match;
  while ((match = rIdPattern.exec(presRels)) !== null) {
    const rid = parseInt(match[1], 10);
    if (rid > maxRId) maxRId = rid;
  }
  const newRId = `rId${maxRId + 1}`;
  
  const newRelEntry = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>`;
  presRels = presRels.replace('</Relationships>', `${newRelEntry}</Relationships>`);
  
  const newSldId = `<p:sldId id="${slideId}" r:id="${newRId}"/>`;
  presContent = presContent.replace('</p:sldIdLst>', `${newSldId}</p:sldIdLst>`);
  
  const contentTypesPath = '[Content_Types].xml';
  let contentTypes = zip.file(contentTypesPath)?.asText() || '';
  const slideContentType = `<Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  contentTypes = contentTypes.replace('</Types>', `${slideContentType}</Types>`);
  
  zip.file(presPath, presContent);
  zip.file(presRelsPath, presRels);
  zip.file(contentTypesPath, contentTypes);
}

// ==================== WORKSTATION SLIDE GENERATION ====================

/**
 * 根据模板为每个工位生成幻灯片
 */
async function generateWorkstationSlides(
  zip: PizZip,
  data: GenerationData,
  slideInfos: SlideInfo[],
  startSlideNum: number,
  startSlideId: number
): Promise<{ slideCount: number; newSlideNum: number; newSlideId: number; imageCount: number }> {
  let currentSlideNum = startSlideNum;
  let currentSlideId = startSlideId;
  let totalSlides = 0;
  let totalImages = 0;
  
  // 找到可以作为工位模板的幻灯片
  const workstationTemplateSlides = slideInfos.filter(s => 
    s.detectedType !== 'title' && 
    s.detectedType !== 'cover' &&
    s.detectedType !== 'thank_you' &&
    !s.hasLoopSyntax // 有循环语法的在项目级处理
  );
  
  if (workstationTemplateSlides.length === 0) {
    console.log('No workstation template slides found');
    return { slideCount: 0, newSlideNum: currentSlideNum, newSlideId: currentSlideId, imageCount: 0 };
  }
  
  const projectData = prepareProjectData(data);
  
  for (let wsIndex = 0; wsIndex < data.workstations.length; wsIndex++) {
    const ws = data.workstations[wsIndex];
    const wsData = { ...projectData, ...prepareWorkstationData(ws, wsIndex) };
    
    // 为每个工位复制相关模板幻灯片
    for (const templateSlide of workstationTemplateSlides) {
      const sourceSlideNum = templateSlide.index + 1; // 1-indexed
      
      // 复制幻灯片
      if (duplicateSlide(zip, sourceSlideNum, currentSlideNum, wsData, data)) {
        // 处理图片插入
        const images = collectImageInserts(ws);
        if (images.length > 0) {
          const insertedCount = await insertImagesIntoSlide(zip, `ppt/slides/slide${currentSlideNum}.xml`, images);
          totalImages += insertedCount;
        }
        
        // 添加到presentation
        addSlideToPresentation(zip, currentSlideNum, currentSlideId);
        
        currentSlideNum++;
        currentSlideId++;
        totalSlides++;
      }
    }
  }
  
  return { slideCount: totalSlides, newSlideNum: currentSlideNum, newSlideId: currentSlideId, imageCount: totalImages };
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    console.log(`Processing template generation for user: ${userId}`);

    const body: RequestBody = await req.json();
    const { templateId, data, outputFileName = 'generated.pptx', options } = body;
    
    // 默认启用智能替换
    const enableSmartReplace = options?.enableSmartReplace !== false;

    if (!templateId) {
      return new Response(
        JSON.stringify({ error: 'templateId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取模板
    const { data: template, error: templateError } = await supabase
      .from('ppt_templates')
      .select('id, name, file_url, structure_meta')
      .eq('id', templateId)
      .single();

    if (templateError || !template?.file_url) {
      return new Response(
        JSON.stringify({ error: 'Template not found or has no file' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Loading template: ${template.name}`);

    // 下载模板
    const templateResponse = await fetch(template.file_url);
    if (!templateResponse.ok) {
      throw new Error(`Failed to download template: ${templateResponse.statusText}`);
    }
    const templateBuffer = await templateResponse.arrayBuffer();
    console.log(`Template loaded, size: ${templateBuffer.byteLength} bytes`);

    const zip = new PizZip(templateBuffer);
    const allFiles = Object.keys(zip.files);
    
    // 解析幻灯片信息
    const { slideIds, maxId, slideInfos } = parsePresentation(zip, enableSmartReplace);
    console.log(`Found ${slideInfos.length} slides, types: ${slideInfos.map(s => s.detectedType).join(', ')}`);
    
    // 准备项目级数据
    const projectData = prepareProjectData(data);
    
    // 收集所有替换日志
    const allReplacementLogs: ReplacementLog[] = [];
    let totalReplacements = 0;
    let totalImages = 0;
    
    // Step 1: 处理现有幻灯片中的占位符、循环和智能替换
    for (const slideInfo of slideInfos) {
      let content = zip.file(slideInfo.path)?.asText();
      if (!content) continue;
      
      const slideReplacements: Array<{ original: string; replaced: string; type: string }> = [];
      
      // 处理循环语法
      if (slideInfo.hasLoopSyntax) {
        content = processLoops(content, data);
        slideReplacements.push({ original: '[loop]', replaced: '[expanded]', type: 'loop' });
      }
      
      // 替换项目级占位符
      const originalContent = content;
      content = replaceSimplePlaceholders(content, projectData);
      
      // 检查是否有占位符被替换
      if (content !== originalContent) {
        slideReplacements.push({ original: '[placeholders]', replaced: '[replaced]', type: 'placeholder' });
      }
      
      // 智能替换（如果启用且没有找到占位符）
      if (enableSmartReplace && content === originalContent) {
        const smartResult = smartReplaceSlideContent(content, slideInfo.detectedType, projectData, slideInfo.index);
        content = smartResult.content;
        slideReplacements.push(...smartResult.replacements);
        totalReplacements += smartResult.replacements.length;
      }
      
      zip.file(slideInfo.path, content);
      
      if (slideReplacements.length > 0) {
        allReplacementLogs.push({
          slideIndex: slideInfo.index,
          slideType: slideInfo.detectedType,
          replacements: slideReplacements,
        });
      }
    }
    
    // Step 2: 处理母版和布局中的占位符
    const masterFiles = allFiles.filter(f => 
      f.toLowerCase().includes('slidemasters/slidemaster') && 
      f.endsWith('.xml') && 
      !f.includes('_rels')
    );
    for (const masterPath of masterFiles) {
      let content = zip.file(masterPath)?.asText();
      if (content) {
        content = replaceSimplePlaceholders(content, projectData);
        zip.file(masterPath, content);
      }
    }

    const layoutFiles = allFiles.filter(f => 
      f.toLowerCase().includes('slidelayouts/slidelayout') && 
      f.endsWith('.xml') && 
      !f.includes('_rels')
    );
    for (const layoutPath of layoutFiles) {
      let content = zip.file(layoutPath)?.asText();
      if (content) {
        content = replaceSimplePlaceholders(content, projectData);
        zip.file(layoutPath, content);
      }
    }
    
    // Step 3: 如果启用了工位幻灯片复制，为每个工位生成幻灯片
    let generatedSlideCount = slideInfos.length;
    if (options?.duplicateWorkstationSlides && data.workstations.length > 0) {
      console.log('Generating per-workstation slides...');
      
      const slideFiles = allFiles.filter(f => 
        f.toLowerCase().includes('ppt/slides/slide') && 
        f.endsWith('.xml') && 
        !f.includes('_rels')
      );
      const existingSlideCount = slideFiles.length;
      
      const result = await generateWorkstationSlides(
        zip,
        data,
        slideInfos,
        existingSlideCount + 1,
        maxId + 1
      );
      
      generatedSlideCount += result.slideCount;
      totalImages += result.imageCount;
      console.log(`Generated ${result.slideCount} workstation slides, ${result.imageCount} images`);
    }

    // 日志输出替换统计
    console.log(`Smart replace enabled: ${enableSmartReplace}`);
    console.log(`Total replacements: ${totalReplacements}`);
    console.log(`Replacement logs:`, JSON.stringify(allReplacementLogs.slice(0, 5))); // 只输出前5个

    // 生成输出
    const outputBuffer = zip.generate({
      type: 'uint8array',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      compression: 'DEFLATE'
    });

    console.log(`Generated PPTX, size: ${outputBuffer.length} bytes, slides: ${generatedSlideCount}`);

    // 上传结果
    const safeFileName = outputFileName
      .replace(/[^\w\s.-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'output.pptx';
    
    const outputPath = `generated/${userId}/${Date.now()}_${safeFileName}`;
    const { error: uploadError } = await supabase.storage
      .from('ppt-templates')
      .upload(outputPath, outputBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload generated file: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('ppt-templates')
      .getPublicUrl(outputPath);

    console.log(`File uploaded successfully: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileUrl: urlData.publicUrl,
        fileName: outputFileName,
        fileSize: outputBuffer.length,
        slideCount: generatedSlideCount,
        templateName: template.name,
        replacedFields: Object.keys(projectData),
        slideTypes: slideInfos.map(s => ({ index: s.index, type: s.detectedType })),
        smartReplaceEnabled: enableSmartReplace,
        totalReplacements,
        totalImages,
        replacementLogs: allReplacementLogs.slice(0, 10), // 返回前10个替换日志
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    console.error('Error generating from template:', err);
    const error = err as Error;
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
