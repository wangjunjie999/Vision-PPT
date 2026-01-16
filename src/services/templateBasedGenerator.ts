/**
 * 基于用户模板的PPT生成服务
 * 使用用户上传的PPTX模板作为基础，保留原有母版和样式
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
    cameras?: Array<{ brand: string; model: string; resolution: string; sensor_size: string; interface: string }>;
    lenses?: Array<{ brand: string; model: string; focal_length: string; mount: string }>;
    lights?: Array<{ brand: string; model: string; type: string; color: string }>;
    controllers?: Array<{ brand: string; model: string; cpu: string; memory: string }>;
  };
  language?: 'zh' | 'en';
}

export interface TemplateGenerationResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  slideCount?: number;
  templateName?: string;
  replacedFields?: string[];
  error?: string;
}

export interface TemplateGenerationOptions {
  templateId: string;
  data: TemplateGenerationData;
  outputFileName?: string;
  onProgress?: (message: string) => void;
}

// ==================== MAIN GENERATION FUNCTION ====================

/**
 * 基于用户上传的PPTX模板生成PPT
 * 保留原模板的母版、布局和样式，只替换占位符内容
 */
export async function generateFromUserTemplate(
  options: TemplateGenerationOptions
): Promise<TemplateGenerationResult> {
  const { templateId, data, outputFileName, onProgress } = options;
  
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
    };
  } catch (error) {
    console.error('Template generation error:', error);
    return { 
      success: false, 
      error: `生成错误: ${error}` 
    };
  }
}

/**
 * 下载生成的PPT文件
 */
export async function downloadGeneratedFile(fileUrl: string, fileName: string): Promise<void> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
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
