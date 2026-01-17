/**
 * 模板样式提取服务
 * 从用户上传的PPTX模板中提取母版样式信息
 */

import { supabase } from "@/integrations/supabase/client";

// ==================== TYPE DEFINITIONS ====================

export interface ExtractedStyles {
  // Background information
  backgroundType: 'solid' | 'gradient' | 'image' | 'none';
  backgroundColor?: string;
  gradientColors?: string[];
  backgroundImage?: string; // Base64 data URI
  
  // Color scheme extracted from theme
  themeColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  
  // Layout information
  slideWidth?: number;
  slideHeight?: number;
  
  // Font information
  titleFont?: string;
  bodyFont?: string;
  
  // Master slide count
  masterCount: number;
  layoutCount: number;
}

export interface StyleExtractionResult {
  success: boolean;
  templateName?: string;
  styles?: ExtractedStyles;
  error?: string;
}

export interface StyleExtractionOptions {
  templateId?: string;
  templateUrl?: string;
  onProgress?: (message: string) => void;
}

// ==================== MAIN EXTRACTION FUNCTION ====================

/**
 * 从用户上传的PPTX模板中提取样式信息
 * 返回背景、颜色方案、字体等样式数据
 */
export async function extractTemplateStyles(
  options: StyleExtractionOptions
): Promise<StyleExtractionResult> {
  const { templateId, templateUrl, onProgress } = options;
  
  // 获取认证信息
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    return { success: false, error: '用户未登录' };
  }

  onProgress?.('正在提取模板样式...');

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const functionUrl = `https://${projectId}.supabase.co/functions/v1/extract-template-styles`;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        templateId,
        templateUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error || `提取失败: ${response.statusText}` 
      };
    }

    const result = await response.json();
    
    onProgress?.(`成功提取样式: ${result.styles?.masterCount || 0} 个母版`);
    
    return {
      success: true,
      templateName: result.templateName,
      styles: result.styles,
    };
  } catch (error) {
    console.error('Style extraction error:', error);
    return { 
      success: false, 
      error: `提取错误: ${error}` 
    };
  }
}

/**
 * 将提取的样式转换为pptxgenjs可用的格式
 */
export function convertStylesToGeneratorFormat(styles: ExtractedStyles): {
  background: { color?: string; data?: string };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    title: string;
    body: string;
  };
} {
  // 默认颜色
  const defaultColors = {
    primary: '2563EB',
    secondary: '64748B',
    accent: '10B981',
    background: 'F8FAFC',
    text: '1E293B',
  };
  
  // 从提取的主题颜色构建
  const colors = {
    primary: styles.themeColors?.primary || defaultColors.primary,
    secondary: styles.themeColors?.secondary || defaultColors.secondary,
    accent: styles.themeColors?.accent || defaultColors.accent,
    background: styles.themeColors?.background || defaultColors.background,
    text: styles.themeColors?.text || defaultColors.text,
  };
  
  // 背景
  const background: { color?: string; data?: string } = {};
  if (styles.backgroundType === 'image' && styles.backgroundImage) {
    background.data = styles.backgroundImage;
  } else if (styles.backgroundType === 'solid' && styles.backgroundColor) {
    background.color = styles.backgroundColor;
  } else {
    background.color = colors.background;
  }
  
  // 字体
  const fonts = {
    title: styles.titleFont || 'Arial',
    body: styles.bodyFont || 'Arial',
  };
  
  return { background, colors, fonts };
}
