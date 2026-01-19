/**
 * 基于用户模板的PPT生成服务
 * 使用用户上传的PPTX模板作为基础，保留原有母版和样式
 * 支持循环语法、图片插入、工位幻灯片复制
 */

import { supabase } from "@/integrations/supabase/client";

// ==================== TYPE DEFINITIONS ====================

export interface TemplateGenerationData {
  project: {
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
    environment?: string[] | null;
    notes: string | null;
    revision_history?: Array<{
      version: string;
      date: string;
      author: string;
      content: string;
    }>;
  };
  workstations: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    cycle_time: number | null;
    product_dimensions?: { length: number; width: number; height: number } | null;
    enclosed?: boolean | null;
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
    modules?: Array<{
      id: string;
      name: string;
      type: string;
      description?: string | null;
      workstation_id: string;
      trigger_type: string | null;
      roi_strategy: string | null;
      processing_time_limit: number | null;
      schematic_image_url?: string | null;
    }>;
    layout?: {
      front_view_image_url?: string | null;
      side_view_image_url?: string | null;
      top_view_image_url?: string | null;
      width?: number | null;
      height?: number | null;
      depth?: number | null;
      camera_count?: number | null;
      selected_cameras?: Array<{ brand: string; model: string; image_url?: string | null }> | null;
      selected_lenses?: Array<{ brand: string; model: string; image_url?: string | null }> | null;
      selected_lights?: Array<{ brand: string; model: string; image_url?: string | null }> | null;
      selected_controller?: { brand: string; model: string; image_url?: string | null } | null;
    } | null;
    product_annotation?: {
      snapshot_url: string;
      annotations_json: Array<{ labelNumber?: number; label?: string }>;
      remark?: string | null;
    } | null;
    product_asset?: {
      preview_images?: Array<{ url: string; name?: string }> | null;
      detection_method?: string | null;
      product_models?: Array<{ name: string; spec: string }> | null;
      detection_requirements?: Array<{ content: string; highlight?: string | null }> | null;
    } | null;
  }>;
  modules: Array<{
    id: string;
    name: string;
    type: string;
    description?: string | null;
    workstation_id: string;
    trigger_type: string | null;
    roi_strategy: string | null;
    processing_time_limit: number | null;
  }>;
  hardware: {
    cameras?: Array<{ brand: string; model: string; resolution: string; sensor_size: string; interface: string; image_url?: string | null }>;
    lenses?: Array<{ brand: string; model: string; focal_length: string; mount: string; image_url?: string | null }>;
    lights?: Array<{ brand: string; model: string; type: string; color: string; image_url?: string | null }>;
    controllers?: Array<{ brand: string; model: string; cpu: string; memory: string; image_url?: string | null }>;
  };
  language?: 'zh' | 'en';
}

export interface SlideTypeInfo {
  index: number;
  type: string;
}

export interface TemplateGenerationResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  slideCount?: number;
  templateName?: string;
  replacedFields?: string[];
  slideTypes?: SlideTypeInfo[];
  error?: string;
}

export interface TemplateGenerationOptions {
  templateId: string;
  data: TemplateGenerationData;
  outputFileName?: string;
  onProgress?: (message: string) => void;
  /** 是否为每个工位复制模板幻灯片 */
  duplicateWorkstationSlides?: boolean;
  /** 工位页类型到模板幻灯片索引的映射 */
  workstationSlideMapping?: Record<string, number[]>;
}

// ==================== MAIN GENERATION FUNCTION ====================

/**
 * 基于用户上传的PPTX模板生成PPT
 * 保留原模板的母版、布局和样式，只替换占位符内容
 * 
 * 支持的功能：
 * 1. 简单占位符替换：{{project_name}}, {{customer}}, {{date}} 等
 * 2. 循环语法：{{#workstations}}...{{/workstations}}, {{#modules}}...{{/modules}}
 * 3. 图片占位符：{{img:front_view}}, {{img:product_snapshot}} 等
 * 4. 工位幻灯片复制：为每个工位生成一组幻灯片
 */
export async function generateFromUserTemplate(
  options: TemplateGenerationOptions
): Promise<TemplateGenerationResult> {
  const { 
    templateId, 
    data, 
    outputFileName, 
    onProgress,
    duplicateWorkstationSlides = false,
    workstationSlideMapping,
  } = options;
  
  // 获取认证信息
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    return { success: false, error: '用户未登录' };
  }

  onProgress?.('正在准备模板数据...');

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const functionUrl = `https://${projectId}.supabase.co/functions/v1/generate-ppt-from-user-template`;

  try {
    onProgress?.('正在调用模板生成服务...');
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        templateId,
        data,
        outputFileName: outputFileName || `${data.project.code}_${data.project.name}_方案.pptx`,
        options: {
          duplicateWorkstationSlides,
          workstationSlideMapping,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error || `生成失败: ${response.statusText}` 
      };
    }

    const result = await response.json();
    
    onProgress?.(`生成完成! 共 ${result.slideCount} 页`);
    
    return {
      success: true,
      fileUrl: result.fileUrl,
      fileName: result.fileName,
      fileSize: result.fileSize,
      slideCount: result.slideCount,
      templateName: result.templateName,
      replacedFields: result.replacedFields,
      slideTypes: result.slideTypes,
    };
  } catch (error) {
    console.error('Template generation error:', error);
    console.error('Function URL:', functionUrl);
    
    // 区分网络错误和其他错误
    if (error instanceof TypeError && (error.message === 'Failed to fetch' || error.message.includes('fetch'))) {
      console.error('网络请求失败 - Edge Function可能未部署或不可访问');
      return { 
        success: false, 
        error: '无法连接到服务器。可能原因：\n1. 网络连接问题\n2. 服务暂时不可用\n请检查网络连接后重试。' 
      };
    }
    
    return { 
      success: false, 
      error: `生成错误: ${error}` 
    };
  }
}

/**
 * 下载生成的PPT文件
 * 支持多种下载策略以处理不同环境和CORS问题
 */
export async function downloadGeneratedFile(fileUrl: string, fileName: string): Promise<void> {
  console.log('Starting download:', { fileUrl, fileName });
  
  // 策略1：对于Supabase存储URL，直接使用<a>标签下载（绕过CORS）
  if (fileUrl.includes('supabase.co/storage') || fileUrl.includes('.supabase.co')) {
    try {
      console.log('Using direct link download strategy');
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // 给一点时间让下载开始
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Direct link download initiated');
      return;
    } catch (directError) {
      console.warn('Direct link download failed, trying fetch strategy:', directError);
    }
  }

  // 策略2：fetch + blob 方式
  try {
    console.log('Using fetch + blob download strategy');
    const response = await fetch(fileUrl, { 
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('Blob created:', { size: blob.size, type: blob.type });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Fetch + blob download completed');
    return;
  } catch (fetchError) {
    console.warn('Fetch download failed:', fetchError);
  }

  // 策略3：回退到在新窗口打开链接
  console.log('Falling back to window.open');
  const opened = window.open(fileUrl, '_blank');
  if (!opened) {
    throw new Error('无法下载文件，请检查浏览器是否阻止了弹出窗口');
  }
}

/**
 * 检查模板是否有有效的PPTX文件
 */
export async function checkTemplateHasFile(templateId: string): Promise<boolean> {
  const { data } = await supabase
    .from('ppt_templates')
    .select('file_url')
    .eq('id', templateId)
    .single();
  
  return !!data?.file_url;
}

// ==================== PLACEHOLDER DOCUMENTATION ====================

/**
 * 可用的项目级占位符
 */
export const PROJECT_PLACEHOLDERS = {
  project_name: '项目名称',
  project_code: '项目编号',
  customer: '客户名称',
  date: '项目日期',
  date_formatted: '格式化日期 (2026年1月16日)',
  date_year: '年份',
  date_month: '月份',
  date_day: '日',
  responsible: '项目负责人',
  vision_responsible: '视觉负责人',
  sales_responsible: '销售负责人',
  product_process: '产品工序',
  quality_strategy: '质量策略',
  notes: '备注',
  workstation_count: '工位数量',
  total_module_count: '模块总数',
  camera_count: '相机数量',
  lens_count: '镜头数量',
  light_count: '光源数量',
  controller_count: '控制器数量',
  total_hardware_count: '硬件总数',
  generated_date: '生成日期',
  generated_time: '生成时间',
  company_name: '公司名称',
};

/**
 * 可用的工位级占位符 (用于循环内部)
 */
export const WORKSTATION_PLACEHOLDERS = {
  ws_name: '工位名称',
  ws_code: '工位编号',
  ws_index: '工位序号',
  ws_type: '工位类型代码',
  ws_type_label: '工位类型中文名',
  ws_cycle_time: '节拍时间',
  ws_shot_count: '拍照数量',
  ws_observation_target: '观测目标',
  ws_motion_description: '运动描述',
  ws_risk_notes: '风险备注',
  ws_process_stage_label: '工序阶段',
  ws_enclosed: '是否封闭',
  ws_module_count: '模块数量',
  ws_product_size: '产品尺寸 (L×W×H)',
  ws_layout_size: '布局尺寸 (W×D×H)',
  ws_camera_count: '相机数量',
  ws_front_view_url: '正视图URL',
  ws_side_view_url: '侧视图URL',
  ws_top_view_url: '俯视图URL',
  ws_product_snapshot_url: '产品标注图URL',
};

/**
 * 可用的模块级占位符 (用于嵌套循环内部)
 */
export const MODULE_PLACEHOLDERS = {
  mod_name: '模块名称',
  mod_index: '模块序号',
  mod_type: '模块类型代码',
  mod_type_label: '模块类型中文名',
  mod_description: '模块描述',
  mod_trigger_label: '触发方式',
  mod_roi_strategy: 'ROI策略',
  mod_processing_time: '处理时限(ms)',
  mod_schematic_url: '示意图URL',
};

/**
 * 循环语法示例
 */
export const LOOP_SYNTAX_EXAMPLES = `
=== 工位循环 ===
{{#workstations}}
工位 {{ws_index}}: {{ws_name}}
编号: {{ws_code}}
类型: {{ws_type_label}}
节拍: {{ws_cycle_time}}s

  === 嵌套模块循环 ===
  {{#modules}}
  模块 {{mod_index}}: {{mod_name}} ({{mod_type_label}})
  触发: {{mod_trigger_label}}
  {{/modules}}

{{/workstations}}

=== 硬件循环 ===
{{#hardware.cameras}}
  {{brand}} {{model}} - {{resolution}}
{{/hardware.cameras}}

{{#hardware.lenses}}
  {{brand}} {{model}} - {{focal_length}}
{{/hardware.lenses}}

{{#hardware.lights}}
  {{brand}} {{model}} - {{type}} {{color}}
{{/hardware.lights}}

{{#hardware.controllers}}
  {{brand}} {{model}} - {{cpu}} / {{memory}}
{{/hardware.controllers}}

=== 图片占位符 ===
{{img:front_view}} - 正视图
{{img:side_view}} - 侧视图
{{img:top_view}} - 俯视图
{{img:product_snapshot}} - 产品标注图
`;

/**
 * 获取所有可用占位符的列表
 */
export function getAllAvailablePlaceholders(): Array<{ field: string; label: string; scope: string }> {
  const placeholders: Array<{ field: string; label: string; scope: string }> = [];
  
  for (const [field, label] of Object.entries(PROJECT_PLACEHOLDERS)) {
    placeholders.push({ field: `{{${field}}}`, label, scope: '项目级' });
  }
  
  for (const [field, label] of Object.entries(WORKSTATION_PLACEHOLDERS)) {
    placeholders.push({ field: `{{${field}}}`, label, scope: '工位级' });
  }
  
  for (const [field, label] of Object.entries(MODULE_PLACEHOLDERS)) {
    placeholders.push({ field: `{{${field}}}`, label, scope: '模块级' });
  }
  
  return placeholders;
}
