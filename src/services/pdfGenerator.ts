/**
 * PDF Generator Service
 * 使用 jsPDF 生成项目报告PDF文档
 * 支持中文通过Canvas渲染，保证无乱码
 */

import jsPDF from 'jspdf';

// ==================== DATA INTERFACES ====================

interface RevisionHistoryItem {
  version: string;
  date: string;
  author: string;
  content: string;
}

interface AcceptanceCriteria {
  accuracy?: string;
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
  sales_responsible?: string | null;
  vision_responsible?: string | null;
  product_process: string | null;
  quality_strategy: string | null;
  environment: string[] | null;
  notes: string | null;
  revision_history?: RevisionHistoryItem[];
  spec_version?: string | null;
  production_line?: string | null;
  main_camera_brand?: string | null;
  use_ai?: boolean | null;
  use_3d?: boolean | null;
  cycle_time_target?: number | null;
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
  acceptance_criteria?: AcceptanceCriteria | null;
  motion_description?: string | null;
  shot_count?: number | null;
  risk_notes?: string | null;
  action_script?: string | null;
  description?: string | null;
  install_space?: { length: number; width: number; height: number } | null;
}

interface LayoutData {
  workstation_id: string;
  name?: string;
  conveyor_type: string | null;
  camera_count: number | null;
  lens_count?: number | null;
  light_count?: number | null;
  camera_mounts: string[] | null;
  mechanisms: string[] | null;
  selected_cameras: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_lenses: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_lights: Array<{ id: string; brand: string; model: string; image_url?: string | null }> | null;
  selected_controller: { id: string; brand: string; model: string; image_url?: string | null } | null;
  front_view_image_url?: string | null;
  side_view_image_url?: string | null;
  top_view_image_url?: string | null;
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

interface ProductAssetData {
  id: string;
  workstation_id: string | null;
  module_id: string | null;
  scope_type: 'workstation' | 'module';
  preview_images: Array<{ url: string; name?: string }> | null;
  model_file_url: string | null;
}

interface ProductAnnotationData {
  id: string;
  asset_id: string;
  snapshot_url: string;
  remark: string | null;
  annotations_json: unknown;
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

interface GenerationOptions {
  language: 'zh' | 'en';
  includeImages?: boolean;
}

type ProgressCallback = (progress: number, step: string, log: string) => void;

// ==================== LABELS ====================

const MODULE_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  positioning: { zh: '定位检测', en: 'Positioning' },
  defect: { zh: '缺陷检测', en: 'Defect Detection' },
  ocr: { zh: 'OCR识别', en: 'OCR Recognition' },
  deeplearning: { zh: '深度学习', en: 'Deep Learning' },
  measurement: { zh: '尺寸测量', en: 'Measurement' },
};

const WS_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  line: { zh: '线体', en: 'Line' },
  turntable: { zh: '转盘', en: 'Turntable' },
  robot: { zh: '机械手', en: 'Robot' },
  platform: { zh: '平台', en: 'Platform' },
};

const TRIGGER_LABELS: Record<string, { zh: string; en: string }> = {
  io: { zh: 'IO触发', en: 'IO Trigger' },
  encoder: { zh: '编码器', en: 'Encoder' },
  software: { zh: '软触发', en: 'Software' },
  continuous: { zh: '连续采集', en: 'Continuous' },
};

const ROI_LABELS: Record<string, { zh: string; en: string }> = {
  full: { zh: '全画面', en: 'Full Frame' },
  fixed: { zh: '固定区域', en: 'Fixed Region' },
  dynamic: { zh: '动态区域', en: 'Dynamic Region' },
  multiple: { zh: '多区域', en: 'Multiple Regions' },
};

const CONVEYOR_LABELS: Record<string, { zh: string; en: string }> = {
  belt: { zh: '皮带输送', en: 'Belt Conveyor' },
  roller: { zh: '滚筒输送', en: 'Roller Conveyor' },
  chain: { zh: '链条输送', en: 'Chain Conveyor' },
  none: { zh: '无', en: 'None' },
};

const COMPANY_NAME_ZH = '苏州德星云智能装备有限公司';
const COMPANY_NAME_EN = 'SuZhou DXY Intelligent Solution Co.,Ltd';

// ==================== HELPER FUNCTIONS ====================

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url}, status: ${response.status}`);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`Error fetching image: ${url}`, error);
    return null;
  }
}

function getImageFormat(url: string): 'PNG' | 'JPEG' | 'GIF' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.png')) return 'PNG';
  if (lowerUrl.includes('.gif')) return 'GIF';
  return 'JPEG';
}

// 使用Canvas渲染中文文本为图片，确保无乱码
function renderTextToCanvas(
  text: string, 
  fontSize: number = 12, 
  fontWeight: 'normal' | 'bold' = 'normal',
  maxWidth?: number,
  color: string = '#000000',
  lineHeightRatio: number = 1.5
): { dataUrl: string; width: number; height: number; lines: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // 使用系统中文字体，确保兼容性
  const fontFamily = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "SimHei", "STHeiti", "WenQuanYi Micro Hei", "Noto Sans SC", sans-serif';
  const scale = 2; // 高清渲染
  ctx.font = `${fontWeight} ${fontSize * scale}px ${fontFamily}`;
  
  // 文本换行处理
  const lines: string[] = [];
  if (maxWidth && maxWidth > 0) {
    const effectiveMaxWidth = maxWidth * scale;
    let currentLine = '';
    
    for (const char of text) {
      if (char === '\n') {
        lines.push(currentLine);
        currentLine = '';
        continue;
      }
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > effectiveMaxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  } else {
    // 处理多行文本
    lines.push(...text.split('\n'));
  }
  
  const lineHeight = fontSize * scale * lineHeightRatio;
  const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width), 10);
  
  canvas.width = Math.ceil(textWidth) + 8;
  canvas.height = Math.ceil(lines.length * lineHeight) + 8;
  
  // 重新设置字体（canvas resize后会重置）
  ctx.font = `${fontWeight} ${fontSize * scale}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  
  lines.forEach((line, index) => {
    ctx.fillText(line, 4, index * lineHeight + 4);
  });
  
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width / scale,
    height: canvas.height / scale,
    lines: lines.length
  };
}

// PDF文本添加辅助类
class PDFTextHelper {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private contentWidth: number;
  public y: number;
  private sectionNumber: number = 0;
  
  constructor(pdf: jsPDF, margin: number = 20) {
    this.pdf = pdf;
    this.pageWidth = pdf.internal.pageSize.getWidth();
    this.pageHeight = pdf.internal.pageSize.getHeight();
    this.margin = margin;
    this.contentWidth = this.pageWidth - margin * 2;
    this.y = margin;
  }
  
  addNewPageIfNeeded(requiredSpace: number = 25): boolean {
    if (this.y + requiredSpace > this.pageHeight - this.margin - 10) {
      this.pdf.addPage();
      this.y = this.margin;
      return true;
    }
    return false;
  }
  
  addTextImage(text: string, x: number, fontSize: number = 12, fontWeight: 'normal' | 'bold' = 'normal', color: string = '#000000', maxWidth?: number) {
    if (!text) return { width: 0, height: 0 };
    const { dataUrl, width, height } = renderTextToCanvas(text, fontSize, fontWeight, maxWidth, color);
    try {
      this.pdf.addImage(dataUrl, 'PNG', x, this.y, width, height);
      return { width, height };
    } catch (e) {
      console.warn('Failed to add text image:', e);
      return { width: 0, height: 0 };
    }
  }
  
  // 添加章节标题
  addSectionTitle(text: string) {
    this.sectionNumber++;
    this.addNewPageIfNeeded(20);
    const fullText = `${this.sectionNumber}. ${text}`;
    const { height } = this.addTextImage(fullText, this.margin, 16, 'bold', '#1a365d');
    this.y += Math.max(height, 12) + 8;
    
    // 添加下划线装饰
    this.pdf.setDrawColor(26, 54, 93);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(this.margin, this.y - 4, this.margin + 60, this.y - 4);
    this.y += 4;
  }
  
  // 添加子标题
  addSubsectionTitle(parentNum: number, subNum: number, text: string) {
    this.addNewPageIfNeeded(15);
    const fullText = `${parentNum}.${subNum} ${text}`;
    const { height } = this.addTextImage(fullText, this.margin, 13, 'bold', '#2c5282');
    this.y += Math.max(height, 10) + 5;
  }
  
  addSubtitle(text: string) {
    this.addNewPageIfNeeded(15);
    const { height } = this.addTextImage(text, this.margin, 12, 'bold', '#2d3748');
    this.y += Math.max(height, 10) + 4;
  }
  
  // 添加标签值对（两列布局）
  addLabelValue(label: string, value: string, indent: number = 0) {
    this.addNewPageIfNeeded(12);
    const labelX = this.margin + indent;
    const { width: labelWidth, height: labelHeight } = this.addTextImage(`${label}：`, labelX, 10, 'bold', '#4a5568');
    
    const valueX = labelX + Math.max(labelWidth, 70) + 5;
    const maxValueWidth = this.contentWidth - (valueX - this.margin) - 5;
    const { height: valueHeight } = this.addTextImage(value || '—', valueX, 10, 'normal', '#1a202c', maxValueWidth);
    
    this.y += Math.max(labelHeight, valueHeight, 8) + 3;
  }
  
  // 添加纯文本段落
  addParagraph(text: string, indent: number = 0) {
    if (!text) return;
    this.addNewPageIfNeeded(15);
    const maxWidth = this.contentWidth - indent;
    const { height, lines } = renderTextToCanvas(text, 10, 'normal', maxWidth, '#2d3748', 1.6);
    
    try {
      const { dataUrl } = renderTextToCanvas(text, 10, 'normal', maxWidth, '#2d3748', 1.6);
      this.pdf.addImage(dataUrl, 'PNG', this.margin + indent, this.y, undefined, height);
    } catch (e) {
      console.warn('Failed to add paragraph:', e);
    }
    
    this.y += height + 5;
  }
  
  addSpace(space: number = 8) {
    this.y += space;
  }
  
  // 居中文本
  addCenteredText(text: string, yPos: number, size: number = 12, color: string = '#000000', fontWeight: 'normal' | 'bold' = 'normal') {
    const { dataUrl, width, height } = renderTextToCanvas(text, size, fontWeight, undefined, color);
    const x = (this.pageWidth - width) / 2;
    try {
      this.pdf.addImage(dataUrl, 'PNG', x, yPos, width, height);
    } catch {
      // ignore
    }
    return height;
  }
  
  // 添加图片
  async addImage(imageUrl: string, caption?: string, maxWidth: number = 150, maxHeight: number = 90): Promise<boolean> {
    const base64 = await fetchImageAsBase64(imageUrl);
    if (!base64) return false;

    this.addNewPageIfNeeded(maxHeight + 20);
    
    try {
      const format = getImageFormat(imageUrl);
      const x = this.margin + (this.contentWidth - maxWidth) / 2;
      
      // 添加图片边框
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.setLineWidth(0.3);
      this.pdf.rect(x - 2, this.y - 2, maxWidth + 4, maxHeight + 4);
      
      this.pdf.addImage(base64, format, x, this.y, maxWidth, maxHeight);
      this.y += maxHeight + 5;

      if (caption) {
        this.addCenteredText(caption, this.y, 9, '#666666');
        this.y += 12;
      }
      return true;
    } catch (error) {
      console.warn('Failed to add image to PDF:', error);
      return false;
    }
  }
  
  // 添加表格
  addTable(headers: string[], rows: string[][], colWidths?: number[]) {
    const cols = headers.length;
    const totalWidth = this.contentWidth;
    const defaultWidth = totalWidth / cols;
    const widths = colWidths || headers.map(() => defaultWidth);
    const cellHeight = 10;
    const cellPadding = 3;

    this.addNewPageIfNeeded(cellHeight * Math.min(rows.length + 1, 6) + 10);

    // 表头背景
    this.pdf.setFillColor(241, 245, 249);
    let x = this.margin;
    headers.forEach((_, i) => {
      this.pdf.rect(x, this.y, widths[i], cellHeight, 'F');
      x += widths[i];
    });

    // 表头边框和文字
    this.pdf.setDrawColor(180, 180, 180);
    this.pdf.setLineWidth(0.3);
    x = this.margin;
    headers.forEach((header, i) => {
      this.pdf.rect(x, this.y, widths[i], cellHeight, 'S');
      const { dataUrl, width, height } = renderTextToCanvas(header, 9, 'bold', undefined, '#1a365d');
      try {
        const textX = x + (widths[i] - width) / 2;
        const textY = this.y + (cellHeight - height) / 2;
        this.pdf.addImage(dataUrl, 'PNG', textX, textY, width, height);
      } catch {
        // ignore
      }
      x += widths[i];
    });
    this.y += cellHeight;

    // 数据行
    rows.forEach((row, rowIndex) => {
      this.addNewPageIfNeeded(cellHeight + 2);
      
      // 交替行背景
      if (rowIndex % 2 === 1) {
        this.pdf.setFillColor(249, 250, 251);
        let bgX = this.margin;
        row.forEach((_, i) => {
          this.pdf.rect(bgX, this.y, widths[i], cellHeight, 'F');
          bgX += widths[i];
        });
      }
      
      x = this.margin;
      row.forEach((cell, i) => {
        this.pdf.rect(x, this.y, widths[i], cellHeight, 'S');
        const truncated = cell && cell.length > 20 ? cell.substring(0, 18) + '...' : (cell || '—');
        const { dataUrl, width, height } = renderTextToCanvas(truncated, 8, 'normal', undefined, '#374151');
        try {
          const textX = x + cellPadding;
          const textY = this.y + (cellHeight - height) / 2;
          this.pdf.addImage(dataUrl, 'PNG', textX, textY, Math.min(width, widths[i] - cellPadding * 2), height);
        } catch {
          // ignore
        }
        x += widths[i];
      });
      this.y += cellHeight;
    });

    this.y += 8;
  }
  
  // 添加分隔线
  addSeparator() {
    this.pdf.setDrawColor(220, 220, 220);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, this.y, this.pageWidth - this.margin, this.y);
    this.y += 5;
  }
  
  getPageWidth() { return this.pageWidth; }
  getPageHeight() { return this.pageHeight; }
  getMargin() { return this.margin; }
  getContentWidth() { return this.contentWidth; }
  getSectionNumber() { return this.sectionNumber; }
}

// ==================== MAIN GENERATOR ====================

export async function generatePDF(
  project: ProjectData,
  workstations: WorkstationData[],
  layouts: LayoutData[],
  modules: ModuleData[],
  hardware: HardwareData,
  options: GenerationOptions,
  onProgress?: ProgressCallback,
  productAssets?: ProductAssetData[],
  productAnnotations?: ProductAnnotationData[]
): Promise<Blob> {
  const isZh = options.language === 'zh';
  const includeImages = options.includeImages !== false;
  
  onProgress?.(5, isZh ? '初始化PDF文档' : 'Initializing PDF document', '');

  // Create PDF with A4 size
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const helper = new PDFTextHelper(pdf, 20);
  const pageWidth = helper.getPageWidth();
  const pageHeight = helper.getPageHeight();
  const margin = helper.getMargin();

  let totalImages = 0;

  // ==================== 封面页 ====================
  onProgress?.(8, isZh ? '生成封面' : 'Creating cover page', '');

  // 公司名称
  helper.addCenteredText(isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN, 45, 14, '#2563eb', 'bold');
  
  // 主标题
  helper.addCenteredText(isZh ? '视觉检测系统技术方案' : 'Vision Inspection System Technical Proposal', 70, 22, '#1a202c', 'bold');
  
  // 项目信息框
  const boxY = 95;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(margin + 20, boxY, pageWidth - margin * 2 - 40, 55, 3, 3);
  
  helper.addCenteredText(`项目编号：${project.code}`, boxY + 12, 12, '#374151');
  helper.addCenteredText(`项目名称：${project.name}`, boxY + 26, 14, '#1a202c', 'bold');
  helper.addCenteredText(`客户：${project.customer || '—'}`, boxY + 40, 12, '#374151');
  
  // 日期和负责人
  helper.addCenteredText(`日期：${project.date || new Date().toISOString().split('T')[0]}`, 165, 11, '#6b7280');
  if (project.responsible) {
    helper.addCenteredText(`负责人：${project.responsible}`, 178, 11, '#6b7280');
  }

  // ==================== 目录页 ====================
  pdf.addPage();
  helper.y = margin;
  onProgress?.(10, isZh ? '生成目录' : 'Creating table of contents', '');

  helper.addCenteredText(isZh ? '目  录' : 'Table of Contents', margin + 10, 18, '#1a365d', 'bold');
  helper.y = margin + 35;

  const tocItems = [
    { num: '1', title: isZh ? '项目概述' : 'Project Overview' },
    { num: '2', title: isZh ? '工作站配置' : 'Workstation Configuration' },
    { num: '3', title: isZh ? '功能模块详情' : 'Function Module Details' },
    { num: '4', title: isZh ? '硬件清单' : 'Hardware List' },
  ];

  tocItems.forEach((item, idx) => {
    const { height } = helper.addTextImage(`${item.num}. ${item.title}`, margin + 10, 12, 'normal', '#2d3748');
    helper.y += Math.max(height, 10) + 8;
  });

  // ==================== 1. 项目概述 ====================
  pdf.addPage();
  helper.y = margin;
  onProgress?.(15, isZh ? '生成项目概述' : 'Creating project overview', '');

  helper.addSectionTitle(isZh ? '项目概述' : 'Project Overview');
  helper.addSpace(5);

  // 基本信息
  helper.addSubtitle(isZh ? '基本信息' : 'Basic Information');
  helper.addLabelValue(isZh ? '项目编号' : 'Project Code', project.code);
  helper.addLabelValue(isZh ? '项目名称' : 'Project Name', project.name);
  helper.addLabelValue(isZh ? '客户名称' : 'Customer', project.customer || '');
  helper.addLabelValue(isZh ? '项目日期' : 'Date', project.date || '');
  helper.addLabelValue(isZh ? '负责人' : 'Responsible', project.responsible || '');
  if (project.sales_responsible) {
    helper.addLabelValue(isZh ? '销售负责人' : 'Sales Responsible', project.sales_responsible);
  }
  if (project.vision_responsible) {
    helper.addLabelValue(isZh ? '视觉负责人' : 'Vision Responsible', project.vision_responsible);
  }
  helper.addSpace(8);

  // 技术参数
  helper.addSubtitle(isZh ? '技术参数' : 'Technical Parameters');
  helper.addLabelValue(isZh ? '产品工艺' : 'Product Process', project.product_process || '');
  helper.addLabelValue(isZh ? '质量策略' : 'Quality Strategy', project.quality_strategy || '');
  if (project.production_line) {
    helper.addLabelValue(isZh ? '产线' : 'Production Line', project.production_line);
  }
  if (project.main_camera_brand) {
    helper.addLabelValue(isZh ? '主要相机品牌' : 'Main Camera Brand', project.main_camera_brand);
  }
  if (project.cycle_time_target) {
    helper.addLabelValue(isZh ? '目标节拍' : 'Target Cycle Time', `${project.cycle_time_target}s`);
  }
  helper.addLabelValue(isZh ? '使用AI' : 'Use AI', project.use_ai ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No'));
  helper.addLabelValue(isZh ? '使用3D' : 'Use 3D', project.use_3d ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No'));
  helper.addSpace(8);

  // 项目统计
  helper.addSubtitle(isZh ? '项目统计' : 'Project Statistics');
  helper.addLabelValue(isZh ? '工作站数量' : 'Workstation Count', String(workstations.length));
  helper.addLabelValue(isZh ? '功能模块数量' : 'Module Count', String(modules.length));
  helper.addLabelValue(isZh ? '相机数量' : 'Camera Count', String(hardware.cameras.length));
  helper.addLabelValue(isZh ? '镜头数量' : 'Lens Count', String(hardware.lenses.length));
  helper.addLabelValue(isZh ? '光源数量' : 'Light Count', String(hardware.lights.length));
  helper.addLabelValue(isZh ? '控制器数量' : 'Controller Count', String(hardware.controllers.length));

  // 备注
  if (project.notes) {
    helper.addSpace(8);
    helper.addSubtitle(isZh ? '项目备注' : 'Notes');
    helper.addParagraph(project.notes, 5);
  }

  // 修订历史
  if (project.revision_history && project.revision_history.length > 0) {
    helper.addSpace(8);
    helper.addSubtitle(isZh ? '修订历史' : 'Revision History');
    const revHeaders = isZh ? ['版本', '日期', '作者', '修改内容'] : ['Version', 'Date', 'Author', 'Changes'];
    const revRows = project.revision_history.map(r => [r.version, r.date, r.author, r.content]);
    helper.addTable(revHeaders, revRows, [25, 35, 40, 80]);
  }

  // ==================== 2. 工作站配置 ====================
  pdf.addPage();
  helper.y = margin;
  onProgress?.(25, isZh ? '生成工作站配置' : 'Creating workstation configuration', '');

  helper.addSectionTitle(isZh ? '工作站配置' : 'Workstation Configuration');
  helper.addSpace(5);

  // 工作站汇总表
  helper.addSubtitle(isZh ? '工作站汇总' : 'Workstation Summary');
  const wsHeaders = isZh 
    ? ['编号', '名称', '类型', '节拍(s)', '产品尺寸(mm)']
    : ['Code', 'Name', 'Type', 'Cycle(s)', 'Size(mm)'];
  
  const wsRows = workstations.map(ws => {
    const dims = ws.product_dimensions 
      ? `${ws.product_dimensions.length}×${ws.product_dimensions.width}×${ws.product_dimensions.height}`
      : '—';
    return [
      ws.code || '—',
      ws.name,
      WS_TYPE_LABELS[ws.type]?.[isZh ? 'zh' : 'en'] || ws.type || '—',
      ws.cycle_time?.toString() || '—',
      dims,
    ];
  });

  helper.addTable(wsHeaders, wsRows, [30, 50, 35, 25, 40]);

  // ==================== 各工作站详情 ====================
  const sectionNum = helper.getSectionNumber();
  
  for (let idx = 0; idx < workstations.length; idx++) {
    const ws = workstations[idx];
    const layout = layouts.find(l => l.workstation_id === ws.id);
    const wsMods = modules.filter(m => m.workstation_id === ws.id);
    
    const progressValue = 25 + (idx / workstations.length) * 35;
    onProgress?.(progressValue, isZh ? `生成工作站: ${ws.name}` : `Creating workstation: ${ws.name}`, '');

    pdf.addPage();
    helper.y = margin;

    helper.addSubsectionTitle(sectionNum, idx + 1, `${ws.code || ''} ${ws.name}`);
    helper.addSpace(3);

    // 工作站基本信息
    helper.addSubtitle(isZh ? '基本信息' : 'Basic Information');
    helper.addLabelValue(isZh ? '工作站编号' : 'Workstation Code', ws.code || '');
    helper.addLabelValue(isZh ? '工作站名称' : 'Workstation Name', ws.name);
    helper.addLabelValue(isZh ? '工作站类型' : 'Type', WS_TYPE_LABELS[ws.type]?.[isZh ? 'zh' : 'en'] || ws.type || '');
    helper.addLabelValue(isZh ? '节拍时间' : 'Cycle Time', ws.cycle_time ? `${ws.cycle_time}s` : '');
    helper.addLabelValue(isZh ? '工艺阶段' : 'Process Stage', ws.process_stage || '');
    helper.addLabelValue(isZh ? '封闭环境' : 'Enclosed', ws.enclosed ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No'));
    
    if (ws.product_dimensions) {
      helper.addLabelValue(
        isZh ? '产品尺寸' : 'Product Dimensions', 
        `${ws.product_dimensions.length} × ${ws.product_dimensions.width} × ${ws.product_dimensions.height} mm`
      );
    }
    if (ws.install_space) {
      helper.addLabelValue(
        isZh ? '安装空间' : 'Install Space', 
        `${ws.install_space.length} × ${ws.install_space.width} × ${ws.install_space.height} mm`
      );
    }
    helper.addSpace(5);

    // 检测信息
    if (ws.observation_target || ws.motion_description || ws.shot_count) {
      helper.addSubtitle(isZh ? '检测信息' : 'Detection Information');
      if (ws.observation_target) {
        helper.addLabelValue(isZh ? '观测目标' : 'Observation Target', ws.observation_target);
      }
      if (ws.motion_description) {
        helper.addLabelValue(isZh ? '运动描述' : 'Motion Description', ws.motion_description);
      }
      if (ws.shot_count) {
        helper.addLabelValue(isZh ? '拍摄数量' : 'Shot Count', String(ws.shot_count));
      }
      helper.addSpace(5);
    }

    // 验收标准
    if (ws.acceptance_criteria) {
      helper.addSubtitle(isZh ? '验收标准' : 'Acceptance Criteria');
      if (ws.acceptance_criteria.accuracy) {
        helper.addLabelValue(isZh ? '精度要求' : 'Accuracy', ws.acceptance_criteria.accuracy);
      }
      if (ws.acceptance_criteria.cycle_time) {
        helper.addLabelValue(isZh ? '节拍要求' : 'Cycle Time Requirement', ws.acceptance_criteria.cycle_time);
      }
      if (ws.acceptance_criteria.compatible_sizes) {
        helper.addLabelValue(isZh ? '兼容规格' : 'Compatible Sizes', ws.acceptance_criteria.compatible_sizes);
      }
      helper.addSpace(5);
    }

    // 风险备注
    if (ws.risk_notes) {
      helper.addSubtitle(isZh ? '风险备注' : 'Risk Notes');
      helper.addParagraph(ws.risk_notes, 5);
      helper.addSpace(5);
    }

    // 描述
    if (ws.description) {
      helper.addSubtitle(isZh ? '工作站描述' : 'Description');
      helper.addParagraph(ws.description, 5);
      helper.addSpace(5);
    }

    // 布局信息
    if (layout) {
      helper.addSubtitle(isZh ? '布局配置' : 'Layout Configuration');
      helper.addLabelValue(isZh ? '输送类型' : 'Conveyor Type', CONVEYOR_LABELS[layout.conveyor_type || '']?.[isZh ? 'zh' : 'en'] || layout.conveyor_type || '');
      helper.addLabelValue(isZh ? '相机数量' : 'Camera Count', String(layout.camera_count || 0));
      if (layout.camera_mounts && layout.camera_mounts.length > 0) {
        helper.addLabelValue(isZh ? '相机安装方式' : 'Camera Mounts', layout.camera_mounts.join(', '));
      }
      if (layout.mechanisms && layout.mechanisms.length > 0) {
        helper.addLabelValue(isZh ? '机构配置' : 'Mechanisms', layout.mechanisms.join(', '));
      }
      if (layout.width && layout.height && layout.depth) {
        helper.addLabelValue(isZh ? '布局尺寸' : 'Layout Size', `${layout.width} × ${layout.depth} × ${layout.height} mm`);
      }
      helper.addSpace(5);
    }

    // 布局三视图
    if (includeImages && layout) {
      let hasViewImages = false;
      
      if (layout.front_view_image_url || layout.side_view_image_url || layout.top_view_image_url) {
        helper.addSubtitle(isZh ? '布局视图' : 'Layout Views');
        hasViewImages = true;
      }
      
      if (layout.front_view_image_url) {
        const added = await helper.addImage(layout.front_view_image_url, isZh ? '正视图' : 'Front View', 140, 85);
        if (added) totalImages++;
      }
      if (layout.side_view_image_url) {
        const added = await helper.addImage(layout.side_view_image_url, isZh ? '侧视图' : 'Side View', 140, 85);
        if (added) totalImages++;
      }
      if (layout.top_view_image_url) {
        const added = await helper.addImage(layout.top_view_image_url, isZh ? '俯视图' : 'Top View', 140, 85);
        if (added) totalImages++;
      }
    }

    // 产品标注图
    if (includeImages && productAssets && productAnnotations) {
      const wsAssets = productAssets.filter(a => a.workstation_id === ws.id && a.scope_type === 'workstation');
      
      if (wsAssets.length > 0) {
        helper.addNewPageIfNeeded(30);
        helper.addSubtitle(isZh ? '产品标注' : 'Product Annotations');
      }
      
      for (const asset of wsAssets) {
        // 预览图
        if (asset.preview_images) {
          for (const img of asset.preview_images) {
            if (img.url) {
              const added = await helper.addImage(img.url, img.name || (isZh ? '产品预览' : 'Product Preview'), 120, 80);
              if (added) totalImages++;
            }
          }
        }
        // 标注快照
        const assetAnnotations = productAnnotations.filter(a => a.asset_id === asset.id);
        for (const ann of assetAnnotations) {
          if (ann.snapshot_url) {
            const added = await helper.addImage(ann.snapshot_url, ann.remark || (isZh ? '检测标注' : 'Detection Annotation'), 120, 80);
            if (added) totalImages++;
          }
        }
      }
    }

    // 本工作站的功能模块
    if (wsMods.length > 0) {
      helper.addNewPageIfNeeded(40);
      helper.addSubtitle(isZh ? '功能模块列表' : 'Function Modules');
      
      const modHeaders = isZh 
        ? ['模块名称', '类型', '触发方式', 'ROI策略', '处理时限'] 
        : ['Name', 'Type', 'Trigger', 'ROI', 'Time Limit'];
      const modRows = wsMods.map(m => [
        m.name,
        MODULE_TYPE_LABELS[m.type]?.[isZh ? 'zh' : 'en'] || m.type || '—',
        TRIGGER_LABELS[m.trigger_type || '']?.[isZh ? 'zh' : 'en'] || m.trigger_type || '—',
        ROI_LABELS[m.roi_strategy || '']?.[isZh ? 'zh' : 'en'] || m.roi_strategy || '—',
        m.processing_time_limit ? `${m.processing_time_limit}ms` : '—',
      ]);
      helper.addTable(modHeaders, modRows, [45, 30, 30, 30, 25]);
    }
  }

  // ==================== 3. 功能模块详情 ====================
  pdf.addPage();
  helper.y = margin;
  onProgress?.(65, isZh ? '生成模块详情' : 'Creating module details', '');

  helper.addSectionTitle(isZh ? '功能模块详情' : 'Function Module Details');
  helper.addSpace(5);

  for (let idx = 0; idx < modules.length; idx++) {
    const mod = modules[idx];
    const ws = workstations.find(w => w.id === mod.workstation_id);
    
    helper.addNewPageIfNeeded(60);
    
    helper.addSubtitle(`${idx + 1}. ${mod.name}`);
    helper.addLabelValue(isZh ? '所属工作站' : 'Workstation', ws?.name || '—');
    helper.addLabelValue(isZh ? '模块类型' : 'Type', MODULE_TYPE_LABELS[mod.type]?.[isZh ? 'zh' : 'en'] || mod.type || '');
    helper.addLabelValue(isZh ? '触发方式' : 'Trigger', TRIGGER_LABELS[mod.trigger_type || '']?.[isZh ? 'zh' : 'en'] || mod.trigger_type || '');
    helper.addLabelValue(isZh ? 'ROI策略' : 'ROI Strategy', ROI_LABELS[mod.roi_strategy || '']?.[isZh ? 'zh' : 'en'] || mod.roi_strategy || '');
    helper.addLabelValue(isZh ? '处理时限' : 'Time Limit', mod.processing_time_limit ? `${mod.processing_time_limit}ms` : '');
    
    if (mod.description) {
      helper.addLabelValue(isZh ? '描述' : 'Description', mod.description);
    }
    
    if (mod.output_types && mod.output_types.length > 0) {
      helper.addLabelValue(isZh ? '输出类型' : 'Output Types', mod.output_types.join(', '));
    }

    // 硬件配置
    if (mod.selected_camera || mod.selected_lens || mod.selected_light || mod.selected_controller) {
      helper.addSpace(3);
      helper.addTextImage(isZh ? '硬件配置：' : 'Hardware:', helper.getMargin(), 10, 'bold', '#4a5568');
      helper.y += 8;
      if (mod.selected_camera) {
        helper.addLabelValue(isZh ? '  相机' : '  Camera', mod.selected_camera, 10);
      }
      if (mod.selected_lens) {
        helper.addLabelValue(isZh ? '  镜头' : '  Lens', mod.selected_lens, 10);
      }
      if (mod.selected_light) {
        helper.addLabelValue(isZh ? '  光源' : '  Light', mod.selected_light, 10);
      }
      if (mod.selected_controller) {
        helper.addLabelValue(isZh ? '  控制器' : '  Controller', mod.selected_controller, 10);
      }
    }

    // 模块示意图
    if (includeImages && mod.schematic_image_url) {
      const added = await helper.addImage(mod.schematic_image_url, isZh ? '模块示意图' : 'Module Schematic', 110, 70);
      if (added) totalImages++;
    }

    helper.addSpace(8);
    helper.addSeparator();
    helper.addSpace(3);
  }

  // ==================== 4. 硬件清单 ====================
  pdf.addPage();
  helper.y = margin;
  onProgress?.(80, isZh ? '生成硬件清单' : 'Creating hardware list', '');

  helper.addSectionTitle(isZh ? '硬件清单' : 'Hardware List');
  helper.addSpace(5);

  // 相机
  if (hardware.cameras.length > 0) {
    helper.addSubtitle(isZh ? '相机列表' : 'Camera List');
    const camHeaders = isZh 
      ? ['品牌', '型号', '分辨率', '帧率', '接口', '传感器'] 
      : ['Brand', 'Model', 'Resolution', 'FPS', 'Interface', 'Sensor'];
    const camRows = hardware.cameras.map(c => [
      c.brand, 
      c.model, 
      c.resolution, 
      String(c.frame_rate), 
      c.interface,
      c.sensor_size
    ]);
    helper.addTable(camHeaders, camRows, [28, 40, 32, 20, 25, 25]);
    helper.addSpace(5);
  }

  // 镜头
  if (hardware.lenses.length > 0) {
    helper.addNewPageIfNeeded(40);
    helper.addSubtitle(isZh ? '镜头列表' : 'Lens List');
    const lensHeaders = isZh 
      ? ['品牌', '型号', '焦距', '光圈', '卡口'] 
      : ['Brand', 'Model', 'Focal Length', 'Aperture', 'Mount'];
    const lensRows = hardware.lenses.map(l => [l.brand, l.model, l.focal_length, l.aperture, l.mount]);
    helper.addTable(lensHeaders, lensRows, [30, 45, 35, 30, 30]);
    helper.addSpace(5);
  }

  // 光源
  if (hardware.lights.length > 0) {
    helper.addNewPageIfNeeded(40);
    helper.addSubtitle(isZh ? '光源列表' : 'Light List');
    const lightHeaders = isZh 
      ? ['品牌', '型号', '类型', '颜色', '功率'] 
      : ['Brand', 'Model', 'Type', 'Color', 'Power'];
    const lightRows = hardware.lights.map(l => [l.brand, l.model, l.type, l.color, l.power]);
    helper.addTable(lightHeaders, lightRows);
    helper.addSpace(5);
  }

  // 控制器
  if (hardware.controllers.length > 0) {
    helper.addNewPageIfNeeded(40);
    helper.addSubtitle(isZh ? '控制器列表' : 'Controller List');
    const ctrlHeaders = isZh 
      ? ['品牌', '型号', 'CPU', '内存', '存储', '性能'] 
      : ['Brand', 'Model', 'CPU', 'Memory', 'Storage', 'Performance'];
    const ctrlRows = hardware.controllers.map(c => [c.brand, c.model, c.cpu, c.memory, c.storage, c.performance]);
    helper.addTable(ctrlHeaders, ctrlRows, [25, 35, 35, 25, 25, 25]);
  }

  // ==================== 页脚 ====================
  onProgress?.(95, isZh ? '添加页脚' : 'Adding footer', '');
  
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    
    // 页脚分隔线
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // 左侧：项目信息
    const footerLeft = renderTextToCanvas(`${project.code} - ${project.name}`, 8, 'normal', undefined, '#9ca3af');
    try {
      pdf.addImage(footerLeft.dataUrl, 'PNG', margin, pageHeight - 12, footerLeft.width, footerLeft.height);
    } catch {
      // ignore
    }
    
    // 右侧：页码
    const footerRight = renderTextToCanvas(`${i} / ${totalPages}`, 8, 'normal', undefined, '#9ca3af');
    try {
      pdf.addImage(footerRight.dataUrl, 'PNG', pageWidth - margin - footerRight.width, pageHeight - 12, footerRight.width, footerRight.height);
    } catch {
      // ignore
    }
  }

  const summary = isZh 
    ? `共 ${totalPages} 页，${totalImages} 张图片，${workstations.length} 个工作站，${modules.length} 个功能模块`
    : `Total ${totalPages} pages, ${totalImages} images, ${workstations.length} workstations, ${modules.length} modules`;
  
  onProgress?.(100, isZh ? '完成' : 'Complete', summary);

  return pdf.output('blob');
}
