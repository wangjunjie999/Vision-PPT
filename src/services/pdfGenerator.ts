/**
 * PDF Generator Service
 * 使用 jsPDF 生成项目报告PDF文档
 * 支持中文通过Canvas渲染
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
  product_process: string | null;
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

// 使用Canvas渲染中文文本为图片，然后嵌入PDF
function renderTextToCanvas(
  text: string, 
  fontSize: number = 12, 
  fontWeight: 'normal' | 'bold' = 'normal',
  maxWidth?: number,
  color: string = '#000000'
): { dataUrl: string; width: number; height: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // 设置字体 - 使用系统中文字体
  const fontFamily = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif';
  ctx.font = `${fontWeight} ${fontSize * 2}px ${fontFamily}`;
  
  // 计算文本宽度
  const lines: string[] = [];
  if (maxWidth) {
    // 文本换行处理
    const words = text.split('');
    let currentLine = '';
    for (const char of words) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth * 2) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  } else {
    lines.push(text);
  }
  
  const lineHeight = fontSize * 2.4;
  const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
  
  canvas.width = Math.ceil(textWidth) + 4;
  canvas.height = Math.ceil(lines.length * lineHeight) + 4;
  
  // 重新设置字体（canvas resize后会重置）
  ctx.font = `${fontWeight} ${fontSize * 2}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  
  lines.forEach((line, index) => {
    ctx.fillText(line, 2, index * lineHeight + 2);
  });
  
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width / 2,
    height: canvas.height / 2
  };
}

// PDF文本添加辅助函数 - 使用Canvas渲染中文
class PDFTextHelper {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private contentWidth: number;
  public y: number;
  
  constructor(pdf: jsPDF, margin: number = 15) {
    this.pdf = pdf;
    this.pageWidth = pdf.internal.pageSize.getWidth();
    this.pageHeight = pdf.internal.pageSize.getHeight();
    this.margin = margin;
    this.contentWidth = this.pageWidth - margin * 2;
    this.y = margin;
  }
  
  addNewPageIfNeeded(requiredSpace: number = 20) {
    if (this.y + requiredSpace > this.pageHeight - this.margin) {
      this.pdf.addPage();
      this.y = this.margin;
    }
  }
  
  addTextImage(text: string, x: number, fontSize: number = 12, fontWeight: 'normal' | 'bold' = 'normal', color: string = '#000000', maxWidth?: number) {
    const { dataUrl, width, height } = renderTextToCanvas(text, fontSize, fontWeight, maxWidth, color);
    try {
      this.pdf.addImage(dataUrl, 'PNG', x, this.y, width, height);
      return { width, height };
    } catch {
      return { width: 0, height: 0 };
    }
  }
  
  addTitle(text: string, size: number = 18) {
    this.addNewPageIfNeeded(15);
    this.addTextImage(text, this.margin, size, 'bold');
    this.y += size * 0.8 + 3;
  }
  
  addSubtitle(text: string) {
    this.addNewPageIfNeeded(12);
    this.addTextImage(text, this.margin, 14, 'bold');
    this.y += 12;
  }
  
  addLabel(label: string, value: string) {
    this.addNewPageIfNeeded(10);
    const { width } = this.addTextImage(`${label}: `, this.margin, 10, 'bold');
    // 值放在标签后面
    const valueX = this.margin + width + 2;
    this.addTextImage(value || '-', valueX, 10, 'normal');
    this.y += 8;
  }
  
  addText(text: string) {
    this.addNewPageIfNeeded(10);
    this.addTextImage(text || '-', this.margin, 10, 'normal', '#000000', this.contentWidth);
    const lineCount = Math.ceil((text || '-').length / 60);
    this.y += lineCount * 6 + 2;
  }
  
  addSpace(space: number = 5) {
    this.y += space;
  }
  
  addCenteredText(text: string, yPos: number, size: number = 12, color: string = '#000000') {
    const { dataUrl, width, height } = renderTextToCanvas(text, size, 'normal', undefined, color);
    const x = (this.pageWidth - width) / 2;
    try {
      this.pdf.addImage(dataUrl, 'PNG', x, yPos, width, height);
    } catch {
      // ignore
    }
    return height;
  }
  
  addCenteredBoldText(text: string, yPos: number, size: number = 12) {
    const { dataUrl, width, height } = renderTextToCanvas(text, size, 'bold');
    const x = (this.pageWidth - width) / 2;
    try {
      this.pdf.addImage(dataUrl, 'PNG', x, yPos, width, height);
    } catch {
      // ignore
    }
    return height;
  }
  
  async addImage(imageUrl: string, caption?: string, maxWidth: number = 160, maxHeight: number = 100) {
    const base64 = await fetchImageAsBase64(imageUrl);
    if (!base64) return;

    this.addNewPageIfNeeded(maxHeight + 15);
    
    try {
      const format = getImageFormat(imageUrl);
      const x = this.margin + (this.contentWidth - maxWidth) / 2;
      this.pdf.addImage(base64, format, x, this.y, maxWidth, maxHeight);
      this.y += maxHeight + 3;

      if (caption) {
        this.addCenteredText(caption, this.y, 8, '#666666');
        this.y += 8;
      }
    } catch (error) {
      console.warn('Failed to add image to PDF:', error);
    }
  }
  
  addTable(headers: string[], rows: string[][], colWidths?: number[]) {
    const cols = headers.length;
    const defaultWidth = this.contentWidth / cols;
    const widths = colWidths || headers.map(() => defaultWidth);
    const cellHeight = 10;
    const cellPadding = 2;

    this.addNewPageIfNeeded(cellHeight * Math.min(rows.length + 1, 5) + 5);

    // Header row
    this.pdf.setFillColor(240, 240, 240);
    let x = this.margin;
    headers.forEach((header, i) => {
      this.pdf.rect(x, this.y, widths[i], cellHeight, 'F');
      this.pdf.rect(x, this.y, widths[i], cellHeight, 'S');
      // 使用Canvas渲染表头
      const { dataUrl, width, height } = renderTextToCanvas(header, 8, 'bold');
      try {
        this.pdf.addImage(dataUrl, 'PNG', x + cellPadding, this.y + (cellHeight - height) / 2, width, height);
      } catch {
        // ignore
      }
      x += widths[i];
    });
    this.y += cellHeight;

    // Data rows
    rows.forEach(row => {
      this.addNewPageIfNeeded(cellHeight);
      x = this.margin;
      row.forEach((cell, i) => {
        this.pdf.rect(x, this.y, widths[i], cellHeight, 'S');
        const truncated = cell && cell.length > 25 ? cell.substring(0, 22) + '...' : (cell || '-');
        const { dataUrl, width, height } = renderTextToCanvas(truncated, 8, 'normal');
        try {
          this.pdf.addImage(dataUrl, 'PNG', x + cellPadding, this.y + (cellHeight - height) / 2, Math.min(width, widths[i] - cellPadding * 2), height);
        } catch {
          // ignore
        }
        x += widths[i];
      });
      this.y += cellHeight;
    });

    this.y += 5;
  }
  
  getPageWidth() { return this.pageWidth; }
  getMargin() { return this.margin; }
  getContentWidth() { return this.contentWidth; }
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

  const helper = new PDFTextHelper(pdf, 15);
  const pageWidth = helper.getPageWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = helper.getMargin();

  // ==================== COVER PAGE ====================
  onProgress?.(10, isZh ? '生成封面' : 'Creating cover page', '');

  helper.addCenteredText(isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN, 50, 14, '#2563eb');
  helper.addCenteredBoldText(isZh ? '视觉检测系统方案' : 'Vision Inspection System Proposal', 80, 24);
  helper.addCenteredText(`${project.code} - ${project.name}`, 105, 18);
  helper.addCenteredText(`${isZh ? '客户' : 'Customer'}: ${project.customer || '-'}`, 130, 12);
  helper.addCenteredText(`${isZh ? '日期' : 'Date'}: ${project.date || new Date().toISOString().split('T')[0]}`, 142, 12);

  // ==================== PROJECT OVERVIEW ====================
  pdf.addPage();
  helper.y = margin;
  onProgress?.(20, isZh ? '生成项目概述' : 'Creating project overview', '');

  helper.addTitle(isZh ? '1. 项目概述' : '1. Project Overview');
  helper.addLabel(isZh ? '项目编号' : 'Project Code', project.code);
  helper.addLabel(isZh ? '项目名称' : 'Project Name', project.name);
  helper.addLabel(isZh ? '客户' : 'Customer', project.customer || '-');
  helper.addLabel(isZh ? '日期' : 'Date', project.date || '-');
  helper.addLabel(isZh ? '负责人' : 'Responsible', project.responsible || '-');
  helper.addLabel(isZh ? '产品工艺' : 'Product Process', project.product_process || '-');
  helper.addLabel(isZh ? '质量策略' : 'Quality Strategy', project.quality_strategy || '-');
  helper.addLabel(isZh ? '工作站数量' : 'Workstation Count', String(workstations.length));
  helper.addLabel(isZh ? '功能模块数量' : 'Module Count', String(modules.length));

  if (project.notes) {
    helper.addSpace(5);
    helper.addSubtitle(isZh ? '备注' : 'Notes');
    helper.addText(project.notes);
  }

  // ==================== WORKSTATION SUMMARY TABLE ====================
  onProgress?.(30, isZh ? '生成工作站汇总' : 'Creating workstation summary', '');
  helper.addSpace(10);
  helper.addTitle(isZh ? '2. 工作站配置' : '2. Workstation Configuration', 16);

  const wsHeaders = isZh 
    ? ['编号', '名称', '类型', '节拍(s)', '产品尺寸(mm)']
    : ['Code', 'Name', 'Type', 'Cycle(s)', 'Size(mm)'];
  
  const wsRows = workstations.map(ws => {
    const dims = ws.product_dimensions 
      ? `${ws.product_dimensions.length}×${ws.product_dimensions.width}×${ws.product_dimensions.height}`
      : '-';
    return [
      ws.code || '-',
      ws.name,
      WS_TYPE_LABELS[ws.type]?.[isZh ? 'zh' : 'en'] || ws.type,
      ws.cycle_time?.toString() || '-',
      dims,
    ];
  });

  helper.addTable(wsHeaders, wsRows);

  // ==================== DETAILED WORKSTATIONS ====================
  let imageCount = 0;
  
  for (let idx = 0; idx < workstations.length; idx++) {
    const ws = workstations[idx];
    const layout = layouts.find(l => l.workstation_id === ws.id);
    const wsMods = modules.filter(m => m.workstation_id === ws.id);
    
    const progressValue = 30 + (idx / workstations.length) * 40;
    onProgress?.(progressValue, isZh ? `生成工作站: ${ws.name}` : `Creating workstation: ${ws.name}`, '');

    pdf.addPage();
    helper.y = margin;

    helper.addTitle(`2.${idx + 1} ${ws.code || ''} - ${ws.name}`, 14);
    helper.addLabel(isZh ? '工作站类型' : 'Type', WS_TYPE_LABELS[ws.type]?.[isZh ? 'zh' : 'en'] || ws.type);
    helper.addLabel(isZh ? '节拍' : 'Cycle Time', ws.cycle_time ? `${ws.cycle_time}s` : '-');
    helper.addLabel(isZh ? '工艺阶段' : 'Process Stage', ws.process_stage || '-');
    helper.addLabel(isZh ? '观测目标' : 'Observation Target', ws.observation_target || '-');
    helper.addLabel(isZh ? '运动描述' : 'Motion Description', ws.motion_description || '-');
    helper.addLabel(isZh ? '封闭环境' : 'Enclosed', ws.enclosed ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No'));

    // Layout images
    if (includeImages && layout) {
      if (layout.front_view_image_url) {
        await helper.addImage(layout.front_view_image_url, isZh ? '正视图' : 'Front View', 140, 80);
        imageCount++;
      }
      if (layout.side_view_image_url) {
        await helper.addImage(layout.side_view_image_url, isZh ? '侧视图' : 'Side View', 140, 80);
        imageCount++;
      }
      if (layout.top_view_image_url) {
        await helper.addImage(layout.top_view_image_url, isZh ? '俯视图' : 'Top View', 140, 80);
        imageCount++;
      }
    }

    // Product annotations for this workstation
    if (includeImages && productAssets && productAnnotations) {
      const wsAssets = productAssets.filter(a => a.workstation_id === ws.id && a.scope_type === 'workstation');
      for (const asset of wsAssets) {
        // Preview images
        if (asset.preview_images) {
          for (const img of asset.preview_images) {
            if (img.url) {
              await helper.addImage(img.url, img.name || (isZh ? '产品预览' : 'Product Preview'), 120, 80);
              imageCount++;
            }
          }
        }
        // Annotations
        const assetAnnotations = productAnnotations.filter(a => a.asset_id === asset.id);
        for (const ann of assetAnnotations) {
          if (ann.snapshot_url) {
            await helper.addImage(ann.snapshot_url, ann.remark || (isZh ? '检测标注' : 'Detection Annotation'), 120, 80);
            imageCount++;
          }
        }
      }
    }

    // Modules for this workstation
    if (wsMods.length > 0) {
      helper.addSpace(5);
      helper.addSubtitle(isZh ? '功能模块' : 'Function Modules');
      
      const modHeaders = isZh ? ['模块名称', '类型', '触发方式', '处理时限'] : ['Name', 'Type', 'Trigger', 'Time Limit'];
      const modRows = wsMods.map(m => [
        m.name,
        MODULE_TYPE_LABELS[m.type]?.[isZh ? 'zh' : 'en'] || m.type,
        TRIGGER_LABELS[m.trigger_type || '']?.[isZh ? 'zh' : 'en'] || m.trigger_type || '-',
        m.processing_time_limit ? `${m.processing_time_limit}ms` : '-',
      ]);
      helper.addTable(modHeaders, modRows);
    }
  }

  // ==================== MODULE DETAILS ====================
  onProgress?.(75, isZh ? '生成模块详情' : 'Creating module details', '');
  
  pdf.addPage();
  helper.y = margin;
  helper.addTitle(isZh ? '3. 功能模块详情' : '3. Function Module Details', 16);

  for (let idx = 0; idx < modules.length; idx++) {
    const mod = modules[idx];
    const ws = workstations.find(w => w.id === mod.workstation_id);
    
    helper.addNewPageIfNeeded(50);
    helper.addSubtitle(`${mod.name} (${ws?.name || '-'})`);
    helper.addLabel(isZh ? '模块类型' : 'Type', MODULE_TYPE_LABELS[mod.type]?.[isZh ? 'zh' : 'en'] || mod.type);
    helper.addLabel(isZh ? '触发方式' : 'Trigger', TRIGGER_LABELS[mod.trigger_type || '']?.[isZh ? 'zh' : 'en'] || mod.trigger_type || '-');
    helper.addLabel(isZh ? 'ROI策略' : 'ROI Strategy', mod.roi_strategy || '-');
    helper.addLabel(isZh ? '处理时限' : 'Time Limit', mod.processing_time_limit ? `${mod.processing_time_limit}ms` : '-');
    
    if (mod.description) {
      helper.addLabel(isZh ? '描述' : 'Description', mod.description);
    }
    
    if (mod.output_types && mod.output_types.length > 0) {
      helper.addLabel(isZh ? '输出类型' : 'Output Types', mod.output_types.join(', '));
    }

    if (includeImages && mod.schematic_image_url) {
      await helper.addImage(mod.schematic_image_url, isZh ? '模块示意图' : 'Module Schematic', 100, 60);
      imageCount++;
    }

    helper.addSpace(5);
  }

  // ==================== HARDWARE LIST ====================
  onProgress?.(85, isZh ? '生成硬件清单' : 'Creating hardware list', '');
  
  pdf.addPage();
  helper.y = margin;
  helper.addTitle(isZh ? '4. 硬件清单' : '4. Hardware List', 16);

  // Cameras
  if (hardware.cameras.length > 0) {
    helper.addSubtitle(isZh ? '相机' : 'Cameras');
    const camHeaders = isZh ? ['品牌', '型号', '分辨率', '帧率', '接口'] : ['Brand', 'Model', 'Resolution', 'FPS', 'Interface'];
    const camRows = hardware.cameras.map(c => [c.brand, c.model, c.resolution, String(c.frame_rate), c.interface]);
    helper.addTable(camHeaders, camRows);
  }

  // Lenses
  if (hardware.lenses.length > 0) {
    helper.addSubtitle(isZh ? '镜头' : 'Lenses');
    const lensHeaders = isZh ? ['品牌', '型号', '焦距', '光圈', '卡口'] : ['Brand', 'Model', 'Focal', 'Aperture', 'Mount'];
    const lensRows = hardware.lenses.map(l => [l.brand, l.model, l.focal_length, l.aperture, l.mount]);
    helper.addTable(lensHeaders, lensRows);
  }

  // Lights
  if (hardware.lights.length > 0) {
    helper.addSubtitle(isZh ? '光源' : 'Lights');
    const lightHeaders = isZh ? ['品牌', '型号', '类型', '颜色', '功率'] : ['Brand', 'Model', 'Type', 'Color', 'Power'];
    const lightRows = hardware.lights.map(l => [l.brand, l.model, l.type, l.color, l.power]);
    helper.addTable(lightHeaders, lightRows);
  }

  // Controllers
  if (hardware.controllers.length > 0) {
    helper.addSubtitle(isZh ? '控制器' : 'Controllers');
    const ctrlHeaders = isZh ? ['品牌', '型号', 'CPU', '内存', '存储'] : ['Brand', 'Model', 'CPU', 'Memory', 'Storage'];
    const ctrlRows = hardware.controllers.map(c => [c.brand, c.model, c.cpu, c.memory, c.storage]);
    helper.addTable(ctrlHeaders, ctrlRows);
  }

  // ==================== FOOTER ====================
  onProgress?.(95, isZh ? '添加页脚' : 'Adding footer', '');
  
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    // 使用Canvas渲染页脚
    const footerLeft = renderTextToCanvas(`${project.code} - ${project.name}`, 8, 'normal', undefined, '#999999');
    const footerRight = renderTextToCanvas(`${i} / ${totalPages}`, 8, 'normal', undefined, '#999999');
    try {
      pdf.addImage(footerLeft.dataUrl, 'PNG', margin, pageHeight - 10, footerLeft.width, footerLeft.height);
      pdf.addImage(footerRight.dataUrl, 'PNG', pageWidth - margin - footerRight.width, pageHeight - 10, footerRight.width, footerRight.height);
    } catch {
      // ignore footer errors
    }
  }

  onProgress?.(100, isZh ? '完成' : 'Complete', `${isZh ? '共' : 'Total'} ${totalPages} ${isZh ? '页' : 'pages'}, ${imageCount} ${isZh ? '张图片' : 'images'}`);

  return pdf.output('blob');
}
