import { supabase } from "@/integrations/supabase/client";

export interface PPTTemplateData {
  // 项目基本信息
  project_name?: string;
  project_code?: string;
  customer?: string;
  date?: string;
  responsible?: string;
  vision_responsible?: string;
  sales_responsible?: string;
  description?: string;
  spec_version?: string;
  
  // 工位信息
  workstations?: Array<{
    name: string;
    code?: string;
    type?: string;
    description?: string;
    cycle_time?: number;
    shot_count?: number;
    observation_target?: string;
    motion_description?: string;
    risk_notes?: string;
    modules?: Array<{
      name: string;
      type?: string;
      description?: string;
      trigger_type?: string;
      roi_strategy?: string;
      processing_time_limit?: number;
    }>;
  }>;
  
  // 硬件信息
  hardware?: {
    cameras?: Array<{
      brand: string;
      model: string;
      resolution: string;
      sensor_size: string;
      interface: string;
    }>;
    lenses?: Array<{
      brand: string;
      model: string;
      focal_length: string;
      mount: string;
    }>;
    lights?: Array<{
      brand: string;
      model: string;
      type: string;
      color: string;
    }>;
    controllers?: Array<{
      brand: string;
      model: string;
      cpu: string;
      memory: string;
    }>;
  };
  
  // 自定义字段
  [key: string]: unknown;
}

export interface GenerateFromTemplateOptions {
  templateId?: string;
  templateUrl?: string;
  data: PPTTemplateData;
  outputFileName?: string;
}

export interface GenerateFromTemplateResult {
  success: boolean;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

/**
 * 使用模板生成PPT
 * 模板中使用 {{field_name}} 语法作为占位符
 * 
 * 支持的占位符示例:
 * - {{project_name}} - 项目名称
 * - {{customer}} - 客户名称
 * - {{date_formatted}} - 格式化日期
 * - {{workstation_count}} - 工位数量
 * - {{#workstations}}...{{/workstations}} - 工位循环
 * - {{#hardware.cameras}}...{{/hardware.cameras}} - 相机循环
 */
export async function generatePPTFromTemplate(
  options: GenerateFromTemplateOptions
): Promise<GenerateFromTemplateResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('用户未登录');
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const functionUrl = `https://${projectId}.supabase.co/functions/v1/generate-ppt-from-template`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `生成失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 模板占位符参考文档
 */
export const TEMPLATE_PLACEHOLDERS = {
  // 基础字段
  project_name: '项目名称',
  project_code: '项目编号',
  customer: '客户名称',
  date: '日期(原始)',
  date_formatted: '日期(格式化)',
  date_year: '年份',
  date_month: '月份',
  date_day: '日',
  responsible: '项目负责人',
  vision_responsible: '视觉负责人',
  sales_responsible: '销售负责人',
  description: '项目描述',
  spec_version: '规格版本',
  
  // 统计字段
  workstation_count: '工位数量',
  total_module_count: '模块总数',
  camera_count: '相机数量',
  lens_count: '镜头数量',
  light_count: '光源数量',
  controller_count: '控制器数量',
  total_hardware_count: '硬件总数',
  
  // 时间戳
  generated_at: '生成时间(ISO)',
  generated_date: '生成日期',
  generated_time: '生成时间',
};

/**
 * 循环模板语法示例
 */
export const LOOP_SYNTAX_EXAMPLES = `
工位循环:
{{#workstations}}
  工位 {{index}}: {{name}}
  编号: {{code}}
  类型: {{type}}
  模块数: {{module_count}}
  
  {{#modules}}
    模块 {{index}}: {{name}} ({{type}})
  {{/modules}}
{{/workstations}}

相机循环:
{{#hardware.cameras}}
  {{brand}} {{model}} - {{resolution}}
{{/hardware.cameras}}

镜头循环:
{{#hardware.lenses}}
  {{brand}} {{model}} - {{focal_length}}
{{/hardware.lenses}}
`;
