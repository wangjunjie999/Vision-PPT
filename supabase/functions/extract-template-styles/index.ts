import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import PizZip from "https://esm.sh/pizzip@3.1.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== TYPE DEFINITIONS ====================

interface LogoInfo {
  data: string; // Base64 data URI
  width?: number; // in EMU
  height?: number;
  position?: { x: number; y: number }; // in inches
}

interface FooterInfo {
  hasPageNumber: boolean;
  hasDate: boolean;
  hasFooterText: boolean;
  footerText?: string;
}

interface PlaceholderInfo {
  type: string; // title, body, subtitle, footer, etc.
  x: number; // in inches
  y: number;
  w: number;
  h: number;
}

interface LayoutInfo {
  name: string;
  type: string; // title, blank, content, etc.
  placeholders: PlaceholderInfo[];
}

interface ExtractedStyles {
  // Background information
  backgroundType: 'solid' | 'gradient' | 'image' | 'none';
  backgroundColor?: string;
  gradientColors?: string[];
  gradientAngle?: number;
  backgroundImage?: string; // Base64 data URI
  
  // Logo information
  logo?: LogoInfo;
  
  // Footer information
  footer?: FooterInfo;
  
  // Color scheme extracted from theme (resolved to hex)
  themeColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    accent2?: string;
    accent3?: string;
    accent4?: string;
    accent5?: string;
    accent6?: string;
    background?: string;
    background2?: string;
    text?: string;
    text2?: string;
    hyperlink?: string;
  };
  
  // All scheme colors for reference
  schemeColorMap?: Record<string, string>;
  
  // Layout information
  slideWidth?: number;
  slideHeight?: number;
  
  // Available layouts
  layouts?: LayoutInfo[];
  
  // Font information
  titleFont?: string;
  bodyFont?: string;
  
  // East Asian fonts (for Chinese/Japanese content)
  titleFontEA?: string;
  bodyFontEA?: string;
  
  // Font sizes (in points)
  titleFontSize?: number;
  bodyFontSize?: number;
  
  // Master slide count
  masterCount: number;
  layoutCount: number;
}

interface RequestBody {
  templateId?: string;
  templateUrl?: string;
}

// ==================== COLOR PARSING HELPERS ====================

/**
 * Parse color from PPTX XML format
 * Supports: srgbClr, schemeClr, sysClr, prstClr
 */
function parseColorNode(xmlNode: string, schemeMap: Record<string, string> = {}): string | undefined {
  // Match srgbClr (hex color)
  const srgbMatch = xmlNode.match(/<a:srgbClr val="([A-Fa-f0-9]{6})"/);
  if (srgbMatch) {
    return srgbMatch[1].toUpperCase();
  }
  
  // Match schemeClr (theme color) and resolve it
  const schemeMatch = xmlNode.match(/<a:schemeClr val="([^"]+)"/);
  if (schemeMatch) {
    const schemeName = schemeMatch[1];
    // Check for luminance modifiers
    const lumModMatch = xmlNode.match(/<a:lumMod val="(\d+)"/);
    const lumOffMatch = xmlNode.match(/<a:lumOff val="(\d+)"/);
    
    const baseColor = schemeMap[schemeName];
    if (baseColor && (lumModMatch || lumOffMatch)) {
      // Apply luminance modification if present
      return applyLuminanceModifier(
        baseColor,
        lumModMatch ? parseInt(lumModMatch[1]) / 1000 : 100,
        lumOffMatch ? parseInt(lumOffMatch[1]) / 1000 : 0
      );
    }
    return baseColor || schemeName;
  }
  
  // Match sysClr (system color like windowText, window)
  const sysClrMatch = xmlNode.match(/<a:sysClr val="([^"]+)"[^>]*lastClr="([A-Fa-f0-9]{6})"/);
  if (sysClrMatch) {
    return sysClrMatch[2].toUpperCase();
  }
  
  // Match prstClr (preset color name)
  const prstMatch = xmlNode.match(/<a:prstClr val="([^"]+)"/);
  if (prstMatch) {
    return presetColorToHex(prstMatch[1]);
  }
  
  return undefined;
}

/**
 * Apply luminance modifier to color
 */
function applyLuminanceModifier(hexColor: string, lumMod: number, lumOff: number): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);
  
  // Convert to HSL
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Apply modification
  const newL = Math.min(100, Math.max(0, l * (lumMod / 100) + lumOff));
  
  // Convert back to RGB
  const [newR, newG, newB] = hslToRgb(h, s, newL);
  
  return [newR, newG, newB].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Convert preset color name to hex
 */
function presetColorToHex(name: string): string {
  const presetColors: Record<string, string> = {
    black: '000000',
    white: 'FFFFFF',
    red: 'FF0000',
    green: '00FF00',
    blue: '0000FF',
    yellow: 'FFFF00',
    cyan: '00FFFF',
    magenta: 'FF00FF',
    gray: '808080',
    darkRed: '8B0000',
    darkGreen: '006400',
    darkBlue: '00008B',
    orange: 'FFA500',
    pink: 'FFC0CB',
    purple: '800080',
    navy: '000080',
    teal: '008080',
    maroon: '800000',
    olive: '808000',
    silver: 'C0C0C0',
    lime: '00FF00',
    aqua: '00FFFF',
    fuchsia: 'FF00FF',
  };
  return presetColors[name] || '000000';
}

// ==================== EXTRACTION HELPERS ====================

/**
 * Build scheme color map from theme XML
 */
function buildSchemeColorMap(themeXml: string): Record<string, string> {
  const colorMap: Record<string, string> = {};
  
  // Standard scheme color mappings
  const schemeElements = [
    { tag: 'dk1', names: ['dk1', 'tx1'] },
    { tag: 'lt1', names: ['lt1', 'bg1'] },
    { tag: 'dk2', names: ['dk2', 'tx2'] },
    { tag: 'lt2', names: ['lt2', 'bg2'] },
    { tag: 'accent1', names: ['accent1'] },
    { tag: 'accent2', names: ['accent2'] },
    { tag: 'accent3', names: ['accent3'] },
    { tag: 'accent4', names: ['accent4'] },
    { tag: 'accent5', names: ['accent5'] },
    { tag: 'accent6', names: ['accent6'] },
    { tag: 'hlink', names: ['hlink'] },
    { tag: 'folHlink', names: ['folHlink'] },
  ];
  
  schemeElements.forEach(({ tag, names }) => {
    const match = themeXml.match(new RegExp(`<a:${tag}>([\\s\\S]*?)<\\/a:${tag}>`));
    if (match) {
      // Don't pass schemeMap to avoid recursion
      const color = parseColorNode(match[1], {});
      if (color && !color.match(/^[a-z]/i)) {
        names.forEach(name => {
          colorMap[name] = color;
        });
      }
    }
  });
  
  return colorMap;
}

/**
 * Extract background information from slide master
 */
function extractBackground(
  masterXml: string, 
  zip: PizZip,
  masterPath: string,
  schemeMap: Record<string, string>
): { 
  type: ExtractedStyles['backgroundType']; 
  color?: string; 
  imageData?: string;
  gradientColors?: string[];
  gradientAngle?: number;
} {
  // Check for solid fill
  const solidFillMatch = masterXml.match(/<p:bg>[\s\S]*?<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
  if (solidFillMatch) {
    const color = parseColorNode(solidFillMatch[1], schemeMap);
    if (color && !color.match(/^[a-z]/i)) {
      return { type: 'solid', color };
    }
  }
  
  // Check for gradient fill
  const gradientMatch = masterXml.match(/<p:bg>[\s\S]*?<a:gradFill[^>]*>([\s\S]*?)<\/a:gradFill>/);
  if (gradientMatch) {
    // Extract gradient angle
    const linMatch = gradientMatch[1].match(/<a:lin ang="(\d+)"/);
    const angle = linMatch ? parseInt(linMatch[1]) / 60000 : 0; // Convert from 60000ths of a degree
    
    // Extract gradient colors
    const gsMatches = gradientMatch[1].match(/<a:gs[^>]*>([\s\S]*?)<\/a:gs>/g);
    if (gsMatches) {
      const colors: string[] = [];
      gsMatches.forEach(gs => {
        const color = parseColorNode(gs, schemeMap);
        if (color && !color.match(/^[a-z]/i)) {
          colors.push(color);
        }
      });
      if (colors.length > 0) {
        return { 
          type: 'gradient', 
          color: colors[0],
          gradientColors: colors,
          gradientAngle: angle,
        };
      }
    }
  }
  
  // Check for image fill (blipFill)
  const blipMatch = masterXml.match(/<p:bg>[\s\S]*?<a:blipFill>[\s\S]*?<a:blip r:embed="([^"]+)"/);
  if (blipMatch) {
    const rId = blipMatch[1];
    // Get rels path based on master path
    const masterFileName = masterPath.split('/').pop();
    const relsPath = masterPath.replace(masterFileName!, `_rels/${masterFileName}.rels`);
    const relsContent = zip.file(relsPath)?.asText();
    
    if (relsContent) {
      const targetMatch = relsContent.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
      if (targetMatch) {
        let imagePath = targetMatch[1];
        // Resolve relative path
        if (imagePath.startsWith('..')) {
          imagePath = 'ppt' + imagePath.slice(2);
        } else if (!imagePath.startsWith('ppt/')) {
          imagePath = masterPath.replace(/\/[^/]+$/, '/') + imagePath;
        }
        
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
 * Extract logo from slide master
 */
function extractLogo(
  masterXml: string,
  zip: PizZip,
  masterPath: string
): LogoInfo | undefined {
  // Look for picture shapes (p:pic) that could be logos
  // Usually logos are small images in corners
  const picMatches = masterXml.match(/<p:pic>[\s\S]*?<\/p:pic>/g);
  if (!picMatches) return undefined;
  
  const masterFileName = masterPath.split('/').pop();
  const relsPath = masterPath.replace(masterFileName!, `_rels/${masterFileName}.rels`);
  const relsContent = zip.file(relsPath)?.asText();
  if (!relsContent) return undefined;
  
  for (const pic of picMatches) {
    // Get position and size
    const xfrmMatch = pic.match(/<a:xfrm[^>]*>[\s\S]*?<a:off x="(\d+)" y="(\d+)"[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!xfrmMatch) continue;
    
    const x = parseInt(xfrmMatch[1]);
    const y = parseInt(xfrmMatch[2]);
    const cx = parseInt(xfrmMatch[3]);
    const cy = parseInt(xfrmMatch[4]);
    
    // Convert EMU to inches (914400 EMU = 1 inch)
    const xInches = x / 914400;
    const yInches = y / 914400;
    const widthInches = cx / 914400;
    const heightInches = cy / 914400;
    
    // Logo detection heuristics:
    // 1. Small size (typically < 2 inches)
    // 2. Positioned in corners or edges
    if (widthInches > 3 || heightInches > 3) continue;
    if (xInches > 3 && yInches > 1) continue; // Not in header area
    
    // Get image reference
    const blipMatch = pic.match(/<a:blip r:embed="([^"]+)"/);
    if (!blipMatch) continue;
    
    const rId = blipMatch[1];
    const targetMatch = relsContent.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
    if (!targetMatch) continue;
    
    let imagePath = targetMatch[1];
    if (imagePath.startsWith('..')) {
      imagePath = 'ppt' + imagePath.slice(2);
    } else if (!imagePath.startsWith('ppt/')) {
      imagePath = masterPath.replace(/\/[^/]+$/, '/') + imagePath;
    }
    
    const imageFile = zip.file(imagePath);
    if (!imageFile) continue;
    
    const imageData = imageFile.asArrayBuffer();
    const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    
    const bytes = new Uint8Array(imageData);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    return {
      data: `data:${mimeType};base64,${base64}`,
      width: cx,
      height: cy,
      position: { x: xInches, y: yInches },
    };
  }
  
  return undefined;
}

/**
 * Extract footer information from slide master
 */
function extractFooter(masterXml: string): FooterInfo {
  const footer: FooterInfo = {
    hasPageNumber: false,
    hasDate: false,
    hasFooterText: false,
  };
  
  // Check for slide number placeholder
  if (masterXml.includes('type="sldNum"') || masterXml.includes('<p:ph type="sldNum"/>')) {
    footer.hasPageNumber = true;
  }
  
  // Check for date placeholder
  if (masterXml.includes('type="dt"') || masterXml.includes('<p:ph type="dt"/>')) {
    footer.hasDate = true;
  }
  
  // Check for footer text placeholder
  if (masterXml.includes('type="ftr"') || masterXml.includes('<p:ph type="ftr"/>')) {
    footer.hasFooterText = true;
    
    // Try to extract footer text content
    const ftrMatch = masterXml.match(/<p:sp>[\s\S]*?<p:ph type="ftr"[^>]*\/>[\s\S]*?<a:t>([^<]+)<\/a:t>/);
    if (ftrMatch) {
      footer.footerText = ftrMatch[1];
    }
  }
  
  return footer;
}

/**
 * Extract theme colors from theme XML
 */
function extractThemeColors(
  themeXml: string,
  schemeMap: Record<string, string>
): ExtractedStyles['themeColors'] {
  const colors: ExtractedStyles['themeColors'] = {};
  
  // Map scheme colors to our semantic names
  if (schemeMap['accent1']) colors.primary = schemeMap['accent1'];
  if (schemeMap['accent2']) colors.secondary = schemeMap['accent2'];
  if (schemeMap['accent3']) colors.accent = schemeMap['accent3'];
  if (schemeMap['accent4']) colors.accent2 = schemeMap['accent4'];
  if (schemeMap['accent5']) colors.accent3 = schemeMap['accent5'];
  if (schemeMap['accent6']) colors.accent4 = schemeMap['accent6'];
  if (schemeMap['lt1']) colors.background = schemeMap['lt1'];
  if (schemeMap['lt2']) colors.background2 = schemeMap['lt2'];
  if (schemeMap['dk1']) colors.text = schemeMap['dk1'];
  if (schemeMap['dk2']) colors.text2 = schemeMap['dk2'];
  if (schemeMap['hlink']) colors.hyperlink = schemeMap['hlink'];
  
  return Object.keys(colors).length > 0 ? colors : undefined;
}

/**
 * Extract fonts from theme XML
 */
function extractFonts(themeXml: string): { 
  titleFont?: string; 
  bodyFont?: string;
  titleFontEA?: string;
  bodyFontEA?: string;
} {
  const fonts: { 
    titleFont?: string; 
    bodyFont?: string;
    titleFontEA?: string;
    bodyFontEA?: string;
  } = {};
  
  // Major font (headings) - Latin
  const majorLatinMatch = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
  if (majorLatinMatch && majorLatinMatch[1] !== '+mj-lt') {
    fonts.titleFont = majorLatinMatch[1];
  }
  
  // Major font (headings) - East Asian
  const majorEaMatch = themeXml.match(/<a:majorFont>[\s\S]*?<a:ea typeface="([^"]+)"/);
  if (majorEaMatch && majorEaMatch[1] !== '+mj-ea') {
    fonts.titleFontEA = majorEaMatch[1];
  }
  
  // Minor font (body) - Latin
  const minorLatinMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
  if (minorLatinMatch && minorLatinMatch[1] !== '+mn-lt') {
    fonts.bodyFont = minorLatinMatch[1];
  }
  
  // Minor font (body) - East Asian
  const minorEaMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:ea typeface="([^"]+)"/);
  if (minorEaMatch && minorEaMatch[1] !== '+mn-ea') {
    fonts.bodyFontEA = minorEaMatch[1];
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

/**
 * Extract layout information
 */
function extractLayouts(zip: PizZip): LayoutInfo[] {
  const layouts: LayoutInfo[] = [];
  const allFiles = Object.keys(zip.files);
  const layoutFiles = allFiles.filter(f => 
    f.match(/ppt\/slideLayouts\/slideLayout\d+\.xml$/)
  ).sort();
  
  const layoutTypeMap: Record<string, string> = {
    'title': 'Title Slide',
    'obj': 'Title and Content',
    'secHead': 'Section Header',
    'twoObj': 'Two Content',
    'twoTxTwoObj': 'Comparison',
    'titleOnly': 'Title Only',
    'blank': 'Blank',
    'objTx': 'Content with Caption',
    'picTx': 'Picture with Caption',
    'vertTx': 'Vertical Text',
    'vertTitleAndTx': 'Vertical Title and Text',
  };
  
  layoutFiles.forEach(layoutPath => {
    const content = zip.file(layoutPath)?.asText();
    if (!content) return;
    
    // Extract layout name
    const nameMatch = content.match(/<p:cSld name="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : layoutPath.split('/').pop()?.replace('.xml', '') || '';
    
    // Extract layout type
    const typeMatch = content.match(/<p:cSld[^>]*>[\s\S]*?type="([^"]+)"/);
    const typeCode = typeMatch ? typeMatch[1] : 'blank';
    const type = layoutTypeMap[typeCode] || typeCode;
    
    // Extract placeholders
    const placeholders: PlaceholderInfo[] = [];
    const spMatches = content.match(/<p:sp>[\s\S]*?<\/p:sp>/g);
    
    if (spMatches) {
      spMatches.forEach(sp => {
        const phMatch = sp.match(/<p:ph[^>]*type="([^"]*)"[^>]*\/?>/);
        if (phMatch) {
          const phType = phMatch[1] || 'body';
          
          // Extract position
          const xfrmMatch = sp.match(/<a:off x="(\d+)" y="(\d+)"[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/);
          if (xfrmMatch) {
            placeholders.push({
              type: phType,
              x: parseInt(xfrmMatch[1]) / 914400,
              y: parseInt(xfrmMatch[2]) / 914400,
              w: parseInt(xfrmMatch[3]) / 914400,
              h: parseInt(xfrmMatch[4]) / 914400,
            });
          }
        }
      });
    }
    
    layouts.push({ name, type, placeholders });
  });
  
  return layouts;
}

/**
 * Extract font sizes from master
 */
function extractFontSizes(masterXml: string): { titleFontSize?: number; bodyFontSize?: number } {
  const sizes: { titleFontSize?: number; bodyFontSize?: number } = {};
  
  // Find title placeholder and its font size
  const titleMatch = masterXml.match(/<p:sp>[\s\S]*?<p:ph type="title"[^>]*\/>[\s\S]*?<a:defRPr sz="(\d+)"/);
  if (titleMatch) {
    sizes.titleFontSize = parseInt(titleMatch[1]) / 100; // Hundredths of a point to points
  }
  
  // Find body placeholder and its font size
  const bodyMatch = masterXml.match(/<p:sp>[\s\S]*?<p:ph type="body"[^>]*\/>[\s\S]*?<a:defRPr sz="(\d+)"/);
  if (bodyMatch) {
    sizes.bodyFontSize = parseInt(bodyMatch[1]) / 100;
  }
  
  return sizes;
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
    
    // 获取所有文件
    const allFiles = Object.keys(zip.files);
    
    // 计算母版和布局数量
    const masterFiles = allFiles.filter(f => 
      f.match(/ppt\/slideMasters\/slideMaster\d+\.xml$/)
    ).sort();
    const layoutFiles = allFiles.filter(f => 
      f.match(/ppt\/slideLayouts\/slideLayout\d+\.xml$/)
    );
    
    // 初始化结果
    const styles: ExtractedStyles = {
      backgroundType: 'none',
      masterCount: masterFiles.length,
      layoutCount: layoutFiles.length,
    };
    
    console.log(`Found ${styles.masterCount} masters, ${styles.layoutCount} layouts`);
    
    // 首先提取主题颜色映射
    let schemeMap: Record<string, string> = {};
    const themeFile = allFiles.find(f => f.match(/ppt\/theme\/theme\d+\.xml$/));
    if (themeFile) {
      const themeContent = zip.file(themeFile)?.asText();
      if (themeContent) {
        schemeMap = buildSchemeColorMap(themeContent);
        styles.schemeColorMap = schemeMap;
        styles.themeColors = extractThemeColors(themeContent, schemeMap);
        
        const fonts = extractFonts(themeContent);
        styles.titleFont = fonts.titleFont;
        styles.bodyFont = fonts.bodyFont;
        styles.titleFontEA = fonts.titleFontEA;
        styles.bodyFontEA = fonts.bodyFontEA;
        
        console.log(`Theme colors extracted: ${JSON.stringify(styles.themeColors)}`);
        console.log(`Fonts: title=${styles.titleFont}, body=${styles.bodyFont}`);
      }
    }
    
    // 提取第一个母版的样式
    if (masterFiles.length > 0) {
      const masterPath = masterFiles[0];
      const masterContent = zip.file(masterPath)?.asText();
      if (masterContent) {
        // 背景
        const bgResult = extractBackground(masterContent, zip, masterPath, schemeMap);
        styles.backgroundType = bgResult.type;
        if (bgResult.color) {
          styles.backgroundColor = bgResult.color;
        }
        if (bgResult.imageData) {
          styles.backgroundImage = bgResult.imageData;
        }
        if (bgResult.gradientColors) {
          styles.gradientColors = bgResult.gradientColors;
          styles.gradientAngle = bgResult.gradientAngle;
        }
        
        // Logo
        const logo = extractLogo(masterContent, zip, masterPath);
        if (logo) {
          styles.logo = logo;
          console.log(`Logo found at position (${logo.position?.x}, ${logo.position?.y})`);
        }
        
        // Footer
        styles.footer = extractFooter(masterContent);
        console.log(`Footer info: pageNum=${styles.footer.hasPageNumber}, date=${styles.footer.hasDate}`);
        
        // Font sizes
        const fontSizes = extractFontSizes(masterContent);
        styles.titleFontSize = fontSizes.titleFontSize;
        styles.bodyFontSize = fontSizes.bodyFontSize;
      }
    }
    
    // 提取幻灯片尺寸
    const presentationContent = zip.file('ppt/presentation.xml')?.asText();
    if (presentationContent) {
      const dimensions = extractDimensions(presentationContent);
      styles.slideWidth = dimensions.width;
      styles.slideHeight = dimensions.height;
    }
    
    // 提取布局信息
    styles.layouts = extractLayouts(zip);
    console.log(`Extracted ${styles.layouts?.length || 0} layouts`);
    
    console.log(`Extraction complete: bgType=${styles.backgroundType}, hasLogo=${!!styles.logo}`);

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
