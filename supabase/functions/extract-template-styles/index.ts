import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import PizZip from "https://esm.sh/pizzip@3.1.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== TYPE DEFINITIONS ====================

interface ExtractedStyles {
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

interface RequestBody {
  templateId?: string;
  templateUrl?: string;
}

// ==================== STYLE EXTRACTION HELPERS ====================

/**
 * Parse color from PPTX XML format
 * Supports various formats: srgbClr, schemeClr, etc.
 */
function parseColor(xmlNode: string): string | undefined {
  // Match srgbClr (hex color)
  const srgbMatch = xmlNode.match(/<a:srgbClr val="([A-Fa-f0-9]{6})"/);
  if (srgbMatch) {
    return srgbMatch[1];
  }
  
  // Match schemeClr (theme color)
  const schemeMatch = xmlNode.match(/<a:schemeClr val="([^"]+)"/);
  if (schemeMatch) {
    return schemeMatch[1]; // Return scheme name, to be resolved with theme
  }
  
  return undefined;
}

/**
 * Extract background information from slide master
 */
function extractBackground(
  masterXml: string, 
  zip: PizZip
): { type: ExtractedStyles['backgroundType']; color?: string; imageData?: string } {
  // Check for solid fill
  const solidFillMatch = masterXml.match(/<p:bg>[\s\S]*?<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
  if (solidFillMatch) {
    const color = parseColor(solidFillMatch[1]);
    if (color) {
      return { type: 'solid', color };
    }
  }
  
  // Check for gradient fill
  const gradientMatch = masterXml.match(/<p:bg>[\s\S]*?<a:gradFill>([\s\S]*?)<\/a:gradFill>/);
  if (gradientMatch) {
    // Extract gradient colors
    const gsMatches = gradientMatch[1].match(/<a:gs[^>]*>([\s\S]*?)<\/a:gs>/g);
    if (gsMatches) {
      const colors: string[] = [];
      gsMatches.forEach(gs => {
        const color = parseColor(gs);
        if (color && !color.match(/^[a-z]/i)) { // Exclude scheme names
          colors.push(color);
        }
      });
      if (colors.length > 0) {
        return { type: 'gradient', color: colors[0] };
      }
    }
  }
  
  // Check for image fill (blipFill)
  const blipMatch = masterXml.match(/<p:bg>[\s\S]*?<a:blipFill>[\s\S]*?<a:blip r:embed="([^"]+)"/);
  if (blipMatch) {
    const rId = blipMatch[1];
    // Try to find the image in rels
    const relsPath = 'ppt/slideMasters/_rels/slideMaster1.xml.rels';
    const relsContent = zip.file(relsPath)?.asText();
    
    if (relsContent) {
      const targetMatch = relsContent.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
      if (targetMatch) {
        const imagePath = targetMatch[1].replace('..', 'ppt');
        const imageFile = zip.file(imagePath);
        
        if (imageFile) {
          const imageData = imageFile.asArrayBuffer();
          const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
          
          // Convert to base64
          const bytes = new Uint8Array(imageData);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          
          return { 
            type: 'image', 
            imageData: `data:${mimeType};base64,${base64}` 
          };
        }
      }
    }
  }
  
  return { type: 'none' };
}

/**
 * Extract theme colors from theme XML
 */
function extractThemeColors(themeXml: string): ExtractedStyles['themeColors'] {
  const colors: ExtractedStyles['themeColors'] = {};
  
  // Extract color scheme colors
  const colorMappings: { tag: string; key: keyof NonNullable<ExtractedStyles['themeColors']> }[] = [
    { tag: 'dk1', key: 'text' },
    { tag: 'lt1', key: 'background' },
    { tag: 'accent1', key: 'primary' },
    { tag: 'accent2', key: 'secondary' },
    { tag: 'accent3', key: 'accent' },
  ];
  
  colorMappings.forEach(({ tag, key }) => {
    const match = themeXml.match(new RegExp(`<a:${tag}>([\s\S]*?)<\/a:${tag}>`));
    if (match) {
      const color = parseColor(match[1]);
      if (color && !color.match(/^[a-z]/i)) {
        colors[key] = color;
      }
    }
  });
  
  return Object.keys(colors).length > 0 ? colors : undefined;
}

/**
 * Extract fonts from theme XML
 */
function extractFonts(themeXml: string): { titleFont?: string; bodyFont?: string } {
  const fonts: { titleFont?: string; bodyFont?: string } = {};
  
  // Major font (headings)
  const majorMatch = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
  if (majorMatch) {
    fonts.titleFont = majorMatch[1];
  }
  
  // Minor font (body)
  const minorMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
  if (minorMatch) {
    fonts.bodyFont = minorMatch[1];
  }
  
  return fonts;
}

/**
 * Extract slide dimensions from presentation XML
 */
function extractDimensions(presentationXml: string): { width?: number; height?: number } {
  const sldSzMatch = presentationXml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  if (sldSzMatch) {
    // EMU to inches: 914400 EMU = 1 inch
    return {
      width: parseInt(sldSzMatch[1]) / 914400,
      height: parseInt(sldSzMatch[2]) / 914400,
    };
  }
  return {};
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 验证认证
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

    // 验证用户
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting template styles for user: ${userData.user.id}`);

    // 解析请求
    const body: RequestBody = await req.json();
    const { templateId, templateUrl } = body;

    if (!templateId && !templateUrl) {
      return new Response(
        JSON.stringify({ error: 'templateId or templateUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取模板URL
    let fileUrl = templateUrl;
    let templateName = 'Custom Template';
    
    if (templateId) {
      const { data: template, error: templateError } = await supabase
        .from('ppt_templates')
        .select('id, name, file_url')
        .eq('id', templateId)
        .single();

      if (templateError || !template?.file_url) {
        return new Response(
          JSON.stringify({ error: 'Template not found or has no file' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      fileUrl = template.file_url;
      templateName = template.name;
    }

    console.log(`Loading template: ${templateName} from ${fileUrl}`);

    // 下载模板文件
    const templateResponse = await fetch(fileUrl!);
    if (!templateResponse.ok) {
      throw new Error(`Failed to download template: ${templateResponse.statusText}`);
    }
    const templateBuffer = await templateResponse.arrayBuffer();
    console.log(`Template loaded, size: ${templateBuffer.byteLength} bytes`);

    // 使用 PizZip 解压PPTX
    const zip = new PizZip(templateBuffer);
    
    // 初始化结果
    const styles: ExtractedStyles = {
      backgroundType: 'none',
      masterCount: 0,
      layoutCount: 0,
    };
    
    // 获取所有文件
    const allFiles = Object.keys(zip.files);
    
    // 计算母版和布局数量
    const masterFiles = allFiles.filter(f => 
      f.match(/ppt\/slideMasters\/slideMaster\d+\.xml$/)
    );
    const layoutFiles = allFiles.filter(f => 
      f.match(/ppt\/slideLayouts\/slideLayout\d+\.xml$/)
    );
    
    styles.masterCount = masterFiles.length;
    styles.layoutCount = layoutFiles.length;
    
    console.log(`Found ${styles.masterCount} masters, ${styles.layoutCount} layouts`);
    
    // 提取第一个母版的背景
    if (masterFiles.length > 0) {
      const masterContent = zip.file(masterFiles[0])?.asText();
      if (masterContent) {
        const bgResult = extractBackground(masterContent, zip);
        styles.backgroundType = bgResult.type;
        if (bgResult.color) {
          styles.backgroundColor = bgResult.color;
        }
        if (bgResult.imageData) {
          styles.backgroundImage = bgResult.imageData;
        }
      }
    }
    
    // 提取主题颜色和字体
    const themeFile = allFiles.find(f => f.match(/ppt\/theme\/theme\d+\.xml$/));
    if (themeFile) {
      const themeContent = zip.file(themeFile)?.asText();
      if (themeContent) {
        styles.themeColors = extractThemeColors(themeContent);
        const fonts = extractFonts(themeContent);
        styles.titleFont = fonts.titleFont;
        styles.bodyFont = fonts.bodyFont;
      }
    }
    
    // 提取幻灯片尺寸
    const presentationContent = zip.file('ppt/presentation.xml')?.asText();
    if (presentationContent) {
      const dimensions = extractDimensions(presentationContent);
      styles.slideWidth = dimensions.width;
      styles.slideHeight = dimensions.height;
    }
    
    console.log(`Extracted styles: bgType=${styles.backgroundType}, colors=${JSON.stringify(styles.themeColors)}`);

    return new Response(
      JSON.stringify({
        success: true,
        templateName,
        styles,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (err: unknown) {
    console.error('Error extracting template styles:', err);
    const error = err as Error;
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
