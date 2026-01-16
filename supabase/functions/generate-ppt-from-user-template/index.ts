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
}

interface HardwareData {
  cameras?: Array<{ brand: string; model: string; resolution: string; sensor_size: string; interface: string }>;
  lenses?: Array<{ brand: string; model: string; focal_length: string; mount: string }>;
  lights?: Array<{ brand: string; model: string; type: string; color: string }>;
  controllers?: Array<{ brand: string; model: string; cpu: string; memory: string }>;
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
}

// ==================== PLACEHOLDER REPLACEMENTS ====================

/**
 * 准备模板数据 - 扁平化所有可用字段
 */
function prepareTemplateData(data: GenerationData): Record<string, string> {
  const result: Record<string, string> = {};
  const p = data.project;
  
  // 项目级别字段
  result['project_name'] = p.name || '';
  result['project_code'] = p.code || '';
  result['customer'] = p.customer || '';
  result['date'] = p.date || '';
  result['responsible'] = p.responsible || '';
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
 * 在XML文本中替换所有 {{placeholder}} 占位符
 */
function replaceTextPlaceholders(xmlContent: string, data: Record<string, string>): string {
  let result = xmlContent;
  
  // 首先处理被XML标签分割的占位符 (如 {{pro</a:t><a:t>ject_name}})
  // 这是PPTX/DOCX常见问题 - 文本被分割到多个run中
  
  // 1. 先收集可能的占位符模式
  const placeholderPattern = /\{\{([^}]+)\}\}/g;
  const placeholders = Object.keys(data);
  
  // 2. 对每个占位符进行替换 (处理可能被分割的情况)
  for (const placeholder of placeholders) {
    const value = data[placeholder] || '';
    
    // 精确匹配
    const exactPattern = new RegExp(`\\{\\{${escapeRegex(placeholder)}\\}\\}`, 'g');
    result = result.replace(exactPattern, escapeXml(value));
    
    // 尝试匹配被分割的占位符 (简化处理 - 移除中间的XML标签)
    // 这个正则匹配 {{...placeholder...}} 中间可能有XML标签的情况
    const splitPattern = new RegExp(
      `\\{\\{(?:[^}]*<[^>]*>)*${escapeRegex(placeholder)}(?:<[^>]*>[^}]*)*\\}\\}`,
      'gi'
    );
    result = result.replace(splitPattern, escapeXml(value));
  }
  
  // 3. 处理剩余的未匹配占位符 - 用空字符串替换
  result = result.replace(placeholderPattern, '');
  
  return result;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 转义XML特殊字符
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ==================== SLIDE DUPLICATION ====================

interface SlideInfo {
  path: string;
  relsPath: string;
  content: string;
  rels: string;
}

/**
 * 解析presentation.xml获取幻灯片信息
 */
function parsePresentation(zip: PizZip): { slideIds: string[]; maxId: number } {
  const presContent = zip.file('ppt/presentation.xml')?.asText() || '';
  const slideIdPattern = /<p:sldId[^>]*id="(\d+)"[^>]*r:id="([^"]+)"/g;
  const slideIds: string[] = [];
  let maxId = 256;
  
  let match;
  while ((match = slideIdPattern.exec(presContent)) !== null) {
    slideIds.push(match[2]);
    const id = parseInt(match[1], 10);
    if (id > maxId) maxId = id;
  }
  
  return { slideIds, maxId };
}

/**
 * 复制幻灯片并填充数据
 */
function duplicateSlide(
  zip: PizZip,
  sourceSlideNum: number,
  newSlideNum: number,
  data: Record<string, string>
): boolean {
  try {
    // 读取源幻灯片
    const sourcePath = `ppt/slides/slide${sourceSlideNum}.xml`;
    const sourceRelsPath = `ppt/slides/_rels/slide${sourceSlideNum}.xml.rels`;
    
    const sourceContent = zip.file(sourcePath)?.asText();
    const sourceRels = zip.file(sourceRelsPath)?.asText();
    
    if (!sourceContent) {
      console.warn(`Source slide ${sourceSlideNum} not found`);
      return false;
    }
    
    // 替换占位符
    const newContent = replaceTextPlaceholders(sourceContent, data);
    
    // 创建新幻灯片
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
 * 更新 presentation.xml 添加新幻灯片引用
 */
function addSlideToPresentation(
  zip: PizZip,
  slideNum: number,
  slideId: number
): void {
  const presPath = 'ppt/presentation.xml';
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  
  let presContent = zip.file(presPath)?.asText() || '';
  let presRels = zip.file(presRelsPath)?.asText() || '';
  
  // 生成新的 relationship ID
  const rIdPattern = /rId(\d+)/g;
  let maxRId = 0;
  let match;
  while ((match = rIdPattern.exec(presRels)) !== null) {
    const rid = parseInt(match[1], 10);
    if (rid > maxRId) maxRId = rid;
  }
  const newRId = `rId${maxRId + 1}`;
  
  // 添加到 presentation.xml.rels
  const newRelEntry = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>`;
  presRels = presRels.replace('</Relationships>', `${newRelEntry}</Relationships>`);
  
  // 添加到 presentation.xml 的 sldIdLst
  const newSldId = `<p:sldId id="${slideId}" r:id="${newRId}"/>`;
  presContent = presContent.replace('</p:sldIdLst>', `${newSldId}</p:sldIdLst>`);
  
  // 更新 [Content_Types].xml
  const contentTypesPath = '[Content_Types].xml';
  let contentTypes = zip.file(contentTypesPath)?.asText() || '';
  const slideContentType = `<Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  contentTypes = contentTypes.replace('</Types>', `${slideContentType}</Types>`);
  
  zip.file(presPath, presContent);
  zip.file(presRelsPath, presRels);
  zip.file(contentTypesPath, contentTypes);
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

    const userId = userData.user.id;
    console.log(`Processing template generation for user: ${userId}`);

    // 解析请求
    const body: RequestBody = await req.json();
    const { templateId, data, outputFileName = 'generated.pptx' } = body;

    if (!templateId) {
      return new Response(
        JSON.stringify({ error: 'templateId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取模板文件URL
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

    console.log(`Loading template: ${template.name} from ${template.file_url}`);

    // 下载模板文件
    const templateResponse = await fetch(template.file_url);
    if (!templateResponse.ok) {
      throw new Error(`Failed to download template: ${templateResponse.statusText}`);
    }
    const templateBuffer = await templateResponse.arrayBuffer();
    console.log(`Template loaded, size: ${templateBuffer.byteLength} bytes`);

    // 使用 PizZip 解压PPTX
    const zip = new PizZip(templateBuffer);
    
    // 准备模板数据
    const templateData = prepareTemplateData(data);
    console.log('Template data prepared:', JSON.stringify(templateData).substring(0, 500));

    // 解析现有幻灯片
    const { slideIds, maxId } = parsePresentation(zip);
    console.log(`Found ${slideIds.length} slides in template, maxId: ${maxId}`);

    // 获取所有幻灯片文件
    const slideFiles = Object.keys(zip.files).filter(f => 
      f.match(/^ppt\/slides\/slide\d+\.xml$/)
    );
    console.log(`Slide files found: ${slideFiles.join(', ')}`);

    // 替换所有现有幻灯片中的占位符
    for (const slidePath of slideFiles) {
      const content = zip.file(slidePath)?.asText();
      if (content) {
        const newContent = replaceTextPlaceholders(content, templateData);
        zip.file(slidePath, newContent);
      }
    }

    // 同样处理幻灯片母版和布局中的占位符
    const masterFiles = Object.keys(zip.files).filter(f => 
      f.match(/^ppt\/slideMasters\/slideMaster\d+\.xml$/)
    );
    for (const masterPath of masterFiles) {
      const content = zip.file(masterPath)?.asText();
      if (content) {
        const newContent = replaceTextPlaceholders(content, templateData);
        zip.file(masterPath, newContent);
      }
    }

    const layoutFiles = Object.keys(zip.files).filter(f => 
      f.match(/^ppt\/slideLayouts\/slideLayout\d+\.xml$/)
    );
    for (const layoutPath of layoutFiles) {
      const content = zip.file(layoutPath)?.asText();
      if (content) {
        const newContent = replaceTextPlaceholders(content, templateData);
        zip.file(layoutPath, newContent);
      }
    }

    // 如果需要为每个工位生成幻灯片 (未来扩展)
    // 目前保持简单 - 只替换占位符
    
    // 生成输出文件
    const outputBuffer = zip.generate({
      type: 'uint8array',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      compression: 'DEFLATE'
    });

    console.log(`Generated PPTX, size: ${outputBuffer.length} bytes`);

    // 上传到存储
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

    // 获取公开URL
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
        slideCount: slideFiles.length,
        templateName: template.name,
        replacedFields: Object.keys(templateData),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
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
