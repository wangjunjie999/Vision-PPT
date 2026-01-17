import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
  ImageRun,
} from 'docx';

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

// Product asset and annotation data
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

// Image fetching utilities
async function fetchImageAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url}, status: ${response.status}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(`Error fetching image: ${url}`, error);
    return null;
  }
}

function getImageType(url: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.png')) return 'png';
  if (lowerUrl.includes('.gif')) return 'gif';
  if (lowerUrl.includes('.bmp')) return 'bmp';
  return 'jpg'; // default to jpg for jpeg and unknown types
}

async function createImageParagraph(
  imageUrl: string, 
  caption?: string,
  maxWidth: number = 400,
  maxHeight: number = 300
): Promise<(Paragraph | null)[]> {
  const imageData = await fetchImageAsArrayBuffer(imageUrl);
  if (!imageData) return [null];

  const elements: Paragraph[] = [];
  
  elements.push(
    new Paragraph({
      children: [
        new ImageRun({
          type: getImageType(imageUrl),
          data: imageData,
          transformation: {
            width: maxWidth,
            height: maxHeight,
          },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 50 },
    })
  );

  if (caption) {
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: caption,
            italics: true,
            size: 18,
            color: '666666',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      })
    );
  }

  return elements;
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

// Company info
const COMPANY_NAME_ZH = '苏州德星云智能装备有限公司';
const COMPANY_NAME_EN = 'SuZhou DXY Intelligent Solution Co.,Ltd';

// ==================== HELPER FUNCTIONS ====================

function createStyledTableCell(text: string, isHeader: boolean = false, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '-',
            bold: isHeader,
            size: isHeader ? 22 : 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: isHeader ? { type: ShadingType.SOLID, color: 'E8E8E8' } : undefined,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  });
}

function createTableFromData(headers: string[], rows: string[][]): Table {
  const colWidth = 100 / headers.length;
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(h => createStyledTableCell(h, true, colWidth)),
        tableHeader: true,
      }),
      ...rows.map(row => 
        new TableRow({
          children: row.map(cell => createStyledTableCell(cell, false, colWidth)),
        })
      ),
    ],
  });
}

function createHeading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 200, after: 100 },
  });
}

function createBodyText(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text || '-',
        size: 22,
      }),
    ],
    spacing: { after: 80 },
  });
}

function createLabelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        size: 22,
      }),
      new TextRun({
        text: value || '-',
        size: 22,
      }),
    ],
    spacing: { after: 60 },
  });
}

// ==================== MAIN GENERATOR ====================

export async function generateDOCX(
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
  const includeImages = options.includeImages !== false; // default to true
  const sections: (Paragraph | Table)[] = [];
  
  onProgress?.(5, isZh ? '开始生成文档' : 'Starting document generation', '');

  // ==================== COVER PAGE ====================
  sections.push(
    new Paragraph({ text: '', spacing: { before: 1000 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN,
          bold: true,
          size: 32,
          color: '2563EB',
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '', spacing: { before: 400 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: isZh ? '视觉检测系统方案' : 'Vision Inspection System Proposal',
          bold: true,
          size: 48,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '', spacing: { before: 200 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${project.code} - ${project.name}`,
          size: 36,
          color: '1E293B',
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '', spacing: { before: 400 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${isZh ? '客户' : 'Customer'}: ${project.customer || '-'}`,
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${isZh ? '日期' : 'Date'}: ${project.date || new Date().toISOString().split('T')[0]}`,
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '', spacing: { before: 200 } }),
  );

  onProgress?.(15, isZh ? '生成项目概述' : 'Generating project overview', '');

  // ==================== PROJECT OVERVIEW ====================
  sections.push(
    createHeading(isZh ? '1. 项目概述' : '1. Project Overview'),
    createLabelValue(isZh ? '项目编号' : 'Project Code', project.code),
    createLabelValue(isZh ? '项目名称' : 'Project Name', project.name),
    createLabelValue(isZh ? '客户' : 'Customer', project.customer || '-'),
    createLabelValue(isZh ? '日期' : 'Date', project.date || '-'),
    createLabelValue(isZh ? '负责人' : 'Responsible', project.responsible || '-'),
    createLabelValue(isZh ? '产品工艺' : 'Product Process', project.product_process || '-'),
    createLabelValue(isZh ? '质量策略' : 'Quality Strategy', project.quality_strategy || '-'),
    createLabelValue(isZh ? '工作站数量' : 'Workstation Count', String(workstations.length)),
    createLabelValue(isZh ? '功能模块数量' : 'Module Count', String(modules.length)),
  );

  if (project.notes) {
    sections.push(
      new Paragraph({ text: '', spacing: { before: 100 } }),
      createHeading(isZh ? '备注' : 'Notes', HeadingLevel.HEADING_3),
      createBodyText(project.notes),
    );
  }

  onProgress?.(30, isZh ? '生成工作站详情' : 'Generating workstation details', '');

  // ==================== WORKSTATIONS ====================
  sections.push(
    new Paragraph({ text: '', spacing: { before: 200 } }),
    createHeading(isZh ? '2. 工作站配置' : '2. Workstation Configuration'),
  );

  // Workstation summary table
  const wsHeaders = isZh 
    ? ['编号', '名称', '类型', '节拍(s)', '产品尺寸(mm)']
    : ['Code', 'Name', 'Type', 'Cycle(s)', 'Product Size(mm)'];
  
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

  sections.push(createTableFromData(wsHeaders, wsRows));

  // Detailed workstation info
  for (let idx = 0; idx < workstations.length; idx++) {
    const ws = workstations[idx];
    const layout = layouts.find(l => l.workstation_id === ws.id);
    const wsMods = modules.filter(m => m.workstation_id === ws.id);

    sections.push(
      new Paragraph({ text: '', spacing: { before: 200 } }),
      createHeading(`2.${idx + 1} ${ws.code || ''} - ${ws.name}`, HeadingLevel.HEADING_2),
      createLabelValue(isZh ? '工作站类型' : 'Type', WS_TYPE_LABELS[ws.type]?.[isZh ? 'zh' : 'en'] || ws.type),
      createLabelValue(isZh ? '节拍' : 'Cycle Time', ws.cycle_time ? `${ws.cycle_time}s` : '-'),
      createLabelValue(isZh ? '工艺阶段' : 'Process Stage', ws.process_stage || '-'),
      createLabelValue(isZh ? '观测目标' : 'Observation Target', ws.observation_target || '-'),
      createLabelValue(isZh ? '运动描述' : 'Motion Description', ws.motion_description || '-'),
      createLabelValue(isZh ? '封闭环境' : 'Enclosed', ws.enclosed ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No')),
    );

    // Acceptance criteria
    if (ws.acceptance_criteria) {
      sections.push(
        createHeading(isZh ? '验收标准' : 'Acceptance Criteria', HeadingLevel.HEADING_3),
      );
      if (ws.acceptance_criteria.accuracy) {
        sections.push(createLabelValue(isZh ? '精度要求' : 'Accuracy', ws.acceptance_criteria.accuracy));
      }
      if (ws.acceptance_criteria.cycle_time) {
        sections.push(createLabelValue(isZh ? '节拍要求' : 'Cycle Time', ws.acceptance_criteria.cycle_time));
      }
      if (ws.acceptance_criteria.compatible_sizes) {
        sections.push(createLabelValue(isZh ? '兼容规格' : 'Compatible Sizes', ws.acceptance_criteria.compatible_sizes));
      }
    }

    // Risk notes
    if (ws.risk_notes) {
      sections.push(
        createHeading(isZh ? '风险提示' : 'Risk Notes', HeadingLevel.HEADING_3),
        createBodyText(ws.risk_notes),
      );
    }

    // Layout hardware info
    if (layout) {
      sections.push(
        createHeading(isZh ? '硬件配置' : 'Hardware Configuration', HeadingLevel.HEADING_3),
        createLabelValue(isZh ? '相机数量' : 'Camera Count', layout.camera_count?.toString() || '-'),
        createLabelValue(isZh ? '输送线类型' : 'Conveyor Type', layout.conveyor_type || '-'),
      );

      if (layout.selected_cameras && layout.selected_cameras.length > 0) {
        sections.push(createLabelValue(isZh ? '相机型号' : 'Cameras', 
          layout.selected_cameras.map(c => `${c.brand} ${c.model}`).join(', ')
        ));
      }
      if (layout.selected_lenses && layout.selected_lenses.length > 0) {
        sections.push(createLabelValue(isZh ? '镜头型号' : 'Lenses', 
          layout.selected_lenses.map(l => `${l.brand} ${l.model}`).join(', ')
        ));
      }
      if (layout.selected_lights && layout.selected_lights.length > 0) {
        sections.push(createLabelValue(isZh ? '光源型号' : 'Lights', 
          layout.selected_lights.map(l => `${l.brand} ${l.model}`).join(', ')
        ));
      }
      if (layout.selected_controller) {
        sections.push(createLabelValue(isZh ? '控制器' : 'Controller', 
          `${layout.selected_controller.brand} ${layout.selected_controller.model}`
        ));
      }
      
      // Layout view images
      if (includeImages) {
        const viewImages: { url: string | null | undefined; label: string }[] = [
          { url: layout.front_view_image_url, label: isZh ? '正视图' : 'Front View' },
          { url: layout.side_view_image_url, label: isZh ? '侧视图' : 'Side View' },
          { url: layout.top_view_image_url, label: isZh ? '俯视图' : 'Top View' },
        ];
        
        for (const viewImg of viewImages) {
          if (viewImg.url) {
            const imgParagraphs = await createImageParagraph(viewImg.url, viewImg.label, 450, 300);
            for (const p of imgParagraphs) {
              if (p) sections.push(p);
            }
          }
        }
      }
    }

    // Product images for this workstation
    if (includeImages && productAssets) {
      const wsAssets = productAssets.filter(a => a.workstation_id === ws.id && a.scope_type === 'workstation');
      if (wsAssets.length > 0) {
        sections.push(
          createHeading(isZh ? '产品图片' : 'Product Images', HeadingLevel.HEADING_3),
        );
        
        for (const asset of wsAssets) {
          if (asset.preview_images && asset.preview_images.length > 0) {
            for (const img of asset.preview_images) {
              const imgParagraphs = await createImageParagraph(img.url, img.name || (isZh ? '产品预览' : 'Product Preview'), 400, 300);
              for (const p of imgParagraphs) {
                if (p) sections.push(p);
              }
            }
          }
          
          // Add annotations for this asset
          if (productAnnotations) {
            const assetAnnotations = productAnnotations.filter(an => an.asset_id === asset.id);
            for (const anno of assetAnnotations) {
              if (anno.snapshot_url) {
                const caption = anno.remark || (isZh ? '标注截图' : 'Annotation Snapshot');
                const imgParagraphs = await createImageParagraph(anno.snapshot_url, caption, 450, 350);
                for (const p of imgParagraphs) {
                  if (p) sections.push(p);
                }
              }
            }
          }
        }
      }
    }

    // Modules for this workstation
    if (wsMods.length > 0) {
      sections.push(
        createHeading(isZh ? '功能模块' : 'Function Modules', HeadingLevel.HEADING_3),
      );

      const modHeaders = isZh 
        ? ['模块名称', '类型', '触发方式', 'ROI策略', '处理时限(ms)']
        : ['Module Name', 'Type', 'Trigger', 'ROI Strategy', 'Time Limit(ms)'];

      const modRows = wsMods.map(m => [
        m.name,
        MODULE_TYPE_LABELS[m.type]?.[isZh ? 'zh' : 'en'] || m.type,
        TRIGGER_LABELS[m.trigger_type || '']?.[isZh ? 'zh' : 'en'] || m.trigger_type || '-',
        m.roi_strategy || '-',
        m.processing_time_limit?.toString() || '-',
      ]);

      sections.push(createTableFromData(modHeaders, modRows));
    }
  }

  onProgress?.(60, isZh ? '生成模块参数' : 'Generating module parameters', '');

  // ==================== MODULE DETAILS ====================
  sections.push(
    new Paragraph({ text: '', spacing: { before: 200 } }),
    createHeading(isZh ? '3. 模块参数详情' : '3. Module Parameter Details'),
  );

  for (let idx = 0; idx < modules.length; idx++) {
    const mod = modules[idx];
    const ws = workstations.find(w => w.id === mod.workstation_id);
    const typeLabel = MODULE_TYPE_LABELS[mod.type]?.[isZh ? 'zh' : 'en'] || mod.type;

    sections.push(
      new Paragraph({ text: '', spacing: { before: 150 } }),
      createHeading(`3.${idx + 1} ${mod.name} (${typeLabel})`, HeadingLevel.HEADING_2),
      createLabelValue(isZh ? '所属工作站' : 'Workstation', ws ? `${ws.code} - ${ws.name}` : '-'),
      createLabelValue(isZh ? '触发方式' : 'Trigger Type', TRIGGER_LABELS[mod.trigger_type || '']?.[isZh ? 'zh' : 'en'] || mod.trigger_type || '-'),
      createLabelValue(isZh ? 'ROI策略' : 'ROI Strategy', mod.roi_strategy || '-'),
      createLabelValue(isZh ? '处理时限' : 'Processing Time Limit', mod.processing_time_limit ? `${mod.processing_time_limit}ms` : '-'),
    );

    if (mod.output_types && mod.output_types.length > 0) {
      sections.push(createLabelValue(isZh ? '输出类型' : 'Output Types', mod.output_types.join(', ')));
    }

    if (mod.description) {
      sections.push(createLabelValue(isZh ? '描述' : 'Description', mod.description));
    }

    // Module schematic image
    if (includeImages && mod.schematic_image_url) {
      sections.push(createHeading(isZh ? '模块原理图' : 'Module Schematic', HeadingLevel.HEADING_3));
      const imgParagraphs = await createImageParagraph(
        mod.schematic_image_url, 
        isZh ? '检测原理示意图' : 'Detection Schematic',
        450, 
        350
      );
      for (const p of imgParagraphs) {
        if (p) sections.push(p);
      }
    }

    // Module product annotations
    if (includeImages && productAssets && productAnnotations) {
      const modAssets = productAssets.filter(a => a.module_id === mod.id && a.scope_type === 'module');
      
      if (modAssets.length > 0) {
        sections.push(createHeading(isZh ? '检测标注' : 'Detection Annotations', HeadingLevel.HEADING_3));
        
        for (const asset of modAssets) {
          // Add preview images
          if (asset.preview_images && asset.preview_images.length > 0) {
            for (const img of asset.preview_images) {
              const imgParagraphs = await createImageParagraph(
                img.url, 
                img.name || (isZh ? '产品预览' : 'Product Preview'), 
                400, 
                300
              );
              for (const p of imgParagraphs) {
                if (p) sections.push(p);
              }
            }
          }
          
          // Add annotation snapshots
          const assetAnnotations = productAnnotations.filter(an => an.asset_id === asset.id);
          for (const anno of assetAnnotations) {
            if (anno.snapshot_url) {
              const caption = anno.remark || (isZh ? '检测区域标注' : 'Detection Area Annotation');
              const imgParagraphs = await createImageParagraph(anno.snapshot_url, caption, 450, 350);
              for (const p of imgParagraphs) {
                if (p) sections.push(p);
              }
            }
          }
        }
      }
    }

    // Type-specific configurations
    if (mod.type === 'defect' && mod.defect_config) {
      const config = mod.defect_config as Record<string, unknown>;
      sections.push(createHeading(isZh ? '缺陷检测配置' : 'Defect Detection Config', HeadingLevel.HEADING_3));
      
      if (config.defectClasses && Array.isArray(config.defectClasses)) {
        sections.push(createLabelValue(isZh ? '缺陷类别' : 'Defect Classes', (config.defectClasses as string[]).join(', ')));
      }
      if (config.minDefectSize) {
        sections.push(createLabelValue(isZh ? '最小缺陷尺寸' : 'Min Defect Size', `${config.minDefectSize}mm`));
      }
      if (config.allowedMissRate !== undefined) {
        sections.push(createLabelValue(isZh ? '允许漏检率' : 'Allowed Miss Rate', `${config.allowedMissRate}%`));
      }
      if (config.allowedFalseRate !== undefined) {
        sections.push(createLabelValue(isZh ? '允许误检率' : 'Allowed False Rate', `${config.allowedFalseRate}%`));
      }
    }

    if (mod.type === 'measurement' && mod.measurement_config) {
      const config = mod.measurement_config as Record<string, unknown>;
      sections.push(createHeading(isZh ? '测量配置' : 'Measurement Config', HeadingLevel.HEADING_3));
      
      if (config.targetAccuracy) {
        sections.push(createLabelValue(isZh ? '目标精度' : 'Target Accuracy', `±${config.targetAccuracy}mm`));
      }
      if (config.measurementFieldOfView) {
        sections.push(createLabelValue(isZh ? '视野大小' : 'Field of View', `${config.measurementFieldOfView}mm`));
      }
      if (config.measurementItems && Array.isArray(config.measurementItems)) {
        const items = config.measurementItems as Array<{ name: string; nominal: number; upperTol: number; lowerTol: number; unit: string }>;
        items.forEach((item, i) => {
          sections.push(createLabelValue(
            `${isZh ? '测量项' : 'Item'} ${i + 1}`,
            `${item.name}: ${item.nominal} (+${item.upperTol}/-${item.lowerTol}) ${item.unit || 'mm'}`
          ));
        });
      }
    }

    if (mod.type === 'ocr' && mod.ocr_config) {
      const config = mod.ocr_config as Record<string, unknown>;
      sections.push(createHeading(isZh ? 'OCR配置' : 'OCR Config', HeadingLevel.HEADING_3));
      
      if (config.characterSets && Array.isArray(config.characterSets)) {
        sections.push(createLabelValue(isZh ? '字符集' : 'Character Sets', (config.characterSets as string[]).join(', ')));
      }
      if (config.textFormat) {
        sections.push(createLabelValue(isZh ? '文本格式' : 'Text Format', String(config.textFormat)));
      }
      if (config.minCharHeight) {
        sections.push(createLabelValue(isZh ? '最小字符高度' : 'Min Char Height', `${config.minCharHeight}mm`));
      }
    }

    if (mod.type === 'positioning' && mod.positioning_config) {
      const config = mod.positioning_config as Record<string, unknown>;
      sections.push(createHeading(isZh ? '定位配置' : 'Positioning Config', HeadingLevel.HEADING_3));
      
      if (config.positioningType) {
        sections.push(createLabelValue(isZh ? '定位类型' : 'Positioning Type', String(config.positioningType)));
      }
      if (config.accuracy) {
        sections.push(createLabelValue(isZh ? '定位精度' : 'Accuracy', `±${config.accuracy}mm`));
      }
    }

    if (mod.type === 'deeplearning' && mod.deep_learning_config) {
      const config = mod.deep_learning_config as Record<string, unknown>;
      sections.push(createHeading(isZh ? '深度学习配置' : 'Deep Learning Config', HeadingLevel.HEADING_3));
      
      if (config.modelType) {
        sections.push(createLabelValue(isZh ? '模型类型' : 'Model Type', String(config.modelType)));
      }
      if (config.classificationClasses && Array.isArray(config.classificationClasses)) {
        sections.push(createLabelValue(isZh ? '分类类别' : 'Classification Classes', (config.classificationClasses as string[]).join(', ')));
      }
      if (config.minSampleCount) {
        sections.push(createLabelValue(isZh ? '最小样本数' : 'Min Sample Count', String(config.minSampleCount)));
      }
    }
  }

  onProgress?.(80, isZh ? '生成硬件清单' : 'Generating hardware list', '');

  // ==================== HARDWARE LIST ====================
  sections.push(
    new Paragraph({ text: '', spacing: { before: 200 } }),
    createHeading(isZh ? '4. 硬件设备清单' : '4. Hardware Equipment List'),
  );

  // Cameras
  if (hardware.cameras.length > 0) {
    sections.push(
      createHeading(isZh ? '4.1 相机' : '4.1 Cameras', HeadingLevel.HEADING_2),
    );
    const camHeaders = isZh 
      ? ['品牌', '型号', '分辨率', '帧率(fps)', '接口', '靶面尺寸']
      : ['Brand', 'Model', 'Resolution', 'FPS', 'Interface', 'Sensor Size'];
    const camRows = hardware.cameras.map(c => [
      c.brand, c.model, c.resolution, c.frame_rate.toString(), c.interface, c.sensor_size
    ]);
    sections.push(createTableFromData(camHeaders, camRows));
  }

  // Lenses
  if (hardware.lenses.length > 0) {
    sections.push(
      new Paragraph({ text: '', spacing: { before: 150 } }),
      createHeading(isZh ? '4.2 镜头' : '4.2 Lenses', HeadingLevel.HEADING_2),
    );
    const lensHeaders = isZh 
      ? ['品牌', '型号', '焦距', '光圈', '卡口']
      : ['Brand', 'Model', 'Focal Length', 'Aperture', 'Mount'];
    const lensRows = hardware.lenses.map(l => [
      l.brand, l.model, l.focal_length, l.aperture, l.mount
    ]);
    sections.push(createTableFromData(lensHeaders, lensRows));
  }

  // Lights
  if (hardware.lights.length > 0) {
    sections.push(
      new Paragraph({ text: '', spacing: { before: 150 } }),
      createHeading(isZh ? '4.3 光源' : '4.3 Lights', HeadingLevel.HEADING_2),
    );
    const lightHeaders = isZh 
      ? ['品牌', '型号', '类型', '颜色', '功率']
      : ['Brand', 'Model', 'Type', 'Color', 'Power'];
    const lightRows = hardware.lights.map(l => [
      l.brand, l.model, l.type, l.color, l.power
    ]);
    sections.push(createTableFromData(lightHeaders, lightRows));
  }

  // Controllers
  if (hardware.controllers.length > 0) {
    sections.push(
      new Paragraph({ text: '', spacing: { before: 150 } }),
      createHeading(isZh ? '4.4 工控机' : '4.4 Controllers', HeadingLevel.HEADING_2),
    );
    const ctrlHeaders = isZh 
      ? ['品牌', '型号', 'CPU', 'GPU', '内存', '存储']
      : ['Brand', 'Model', 'CPU', 'GPU', 'Memory', 'Storage'];
    const ctrlRows = hardware.controllers.map(c => [
      c.brand, c.model, c.cpu, c.gpu || '-', c.memory, c.storage
    ]);
    sections.push(createTableFromData(ctrlHeaders, ctrlRows));
  }

  onProgress?.(90, isZh ? '生成文档' : 'Generating document', '');

  // ==================== CREATE DOCUMENT ====================
  const doc = new Document({
    title: `${project.code} - ${project.name}`,
    creator: isZh ? COMPANY_NAME_ZH : COMPANY_NAME_EN,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
            },
          },
        },
        children: sections,
      },
    ],
  });

  onProgress?.(100, isZh ? '文档生成完成' : 'Document generation complete', '');

  return await Packer.toBlob(doc);
}
