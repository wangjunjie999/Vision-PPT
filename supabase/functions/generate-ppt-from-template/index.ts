import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Docxtemplater from "https://esm.sh/docxtemplater@3.47.1";
import PizZip from "https://esm.sh/pizzip@3.1.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateData {
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

interface RequestBody {
  templateId?: string;
  templateUrl?: string;
  data: TemplateData;
  outputFileName?: string;
}

interface DocxtemplaterError {
  properties?: {
    errors?: Array<{ message: string; properties?: { id?: string } }>;
  };
  message?: string;
}

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

    // 验证用户 - 使用 getUser 而不是 getClaims
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    console.log(`Processing template request for user: ${userId}`);

    // 解析请求
    const body: RequestBody = await req.json();
    const { templateId, templateUrl, data, outputFileName = 'generated.pptx' } = body;

    if (!templateId && !templateUrl) {
      return new Response(
        JSON.stringify({ error: 'Either templateId or templateUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取模板文件
    let templateBuffer: ArrayBuffer;

    if (templateId) {
      // 从数据库获取模板信息
      const { data: template, error: templateError } = await supabase
        .from('ppt_templates')
        .select('file_url')
        .eq('id', templateId)
        .single();

      if (templateError || !template?.file_url) {
        return new Response(
          JSON.stringify({ error: 'Template not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 下载模板文件
      const templateResponse = await fetch(template.file_url);
      if (!templateResponse.ok) {
        throw new Error(`Failed to download template: ${templateResponse.statusText}`);
      }
      templateBuffer = await templateResponse.arrayBuffer();
    } else {
      // 从URL下载模板
      const templateResponse = await fetch(templateUrl!);
      if (!templateResponse.ok) {
        throw new Error(`Failed to download template: ${templateResponse.statusText}`);
      }
      templateBuffer = await templateResponse.arrayBuffer();
    }

    console.log(`Template loaded, size: ${templateBuffer.byteLength} bytes`);

    // 使用 PizZip 和 Docxtemplater 处理模板
    const zip = new PizZip(templateBuffer);
    
    // 创建 docxtemplater 实例
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '{{',
        end: '}}'
      }
    });

    // 准备模板数据
    const templateData = prepareTemplateData(data);
    console.log('Template data prepared:', JSON.stringify(templateData, null, 2).substring(0, 500));

    // 填充数据
    doc.render(templateData);

    // 生成输出文件
    const outputBuffer = doc.getZip().generate({
      type: 'uint8array',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      compression: 'DEFLATE'
    });

    console.log(`Generated PPTX, size: ${outputBuffer.length} bytes`);

    // 上传到存储
    const outputPath = `generated/${userId}/${Date.now()}_${outputFileName}`;
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
        fileSize: outputBuffer.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (err: unknown) {
    console.error('Error processing template:', err);
    
    const error = err as DocxtemplaterError;
    
    // 检查是否是 docxtemplater 的模板错误
    if (error.properties && error.properties.errors) {
      const templateErrors = error.properties.errors.map((e) => ({
        message: e.message,
        id: e.properties?.id
      }));
      return new Response(
        JSON.stringify({ 
          error: 'Template processing error',
          details: templateErrors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * 准备模板数据，添加便捷的派生字段
 */
function prepareTemplateData(data: TemplateData): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };
  
  // 添加日期格式化
  if (data.date) {
    const d = new Date(data.date);
    result.date_formatted = d.toLocaleDateString('zh-CN');
    result.date_year = d.getFullYear();
    result.date_month = d.getMonth() + 1;
    result.date_day = d.getDate();
  }
  
  // 添加统计信息
  result.workstation_count = data.workstations?.length || 0;
  result.total_module_count = data.workstations?.reduce(
    (sum, ws) => sum + (ws.modules?.length || 0), 0
  ) || 0;
  
  // 硬件统计
  if (data.hardware) {
    result.camera_count = data.hardware.cameras?.length || 0;
    result.lens_count = data.hardware.lenses?.length || 0;
    result.light_count = data.hardware.lights?.length || 0;
    result.controller_count = data.hardware.controllers?.length || 0;
    result.total_hardware_count = 
      (result.camera_count as number) + 
      (result.lens_count as number) + 
      (result.light_count as number) + 
      (result.controller_count as number);
  }
  
  // 为工位添加索引
  if (data.workstations) {
    result.workstations = data.workstations.map((ws, index) => ({
      ...ws,
      index: index + 1,
      module_count: ws.modules?.length || 0,
      modules: ws.modules?.map((m, mIndex) => ({
        ...m,
        index: mIndex + 1
      }))
    }));
  }
  
  // 添加时间戳
  const now = new Date();
  result.generated_at = now.toISOString();
  result.generated_date = now.toLocaleDateString('zh-CN');
  result.generated_time = now.toLocaleTimeString('zh-CN');
  
  return result;
}
