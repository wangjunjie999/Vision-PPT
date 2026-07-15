import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const formSchemas: Record<string, object> = {
  project: {
    type: "object",
    properties: {
      code: { type: "string", description: "项目编号，格式如 VIS-2024-001" },
      name: { type: "string", description: "项目名称" },
      customer: { type: "string", description: "客户名称" },
      production_line: { type: "string", description: "产线/工厂名称" },
      product_process: { type: "string", description: "产品/工艺段，可选值：注塑成型、冲压成型、总装检测、涂装检测、焊接检测、包装检测、其他" },
      responsible: { type: "string", description: "项目负责人" },
      sales_responsible: { type: "string", description: "销售负责人" },
      vision_responsible: { type: "string", description: "视觉负责人" },
      cycle_time_target: { type: "string", description: "整线节拍目标(s/pcs)" },
      quality_strategy: { type: "string", description: "质量策略: no_miss/balanced/allow_pass" },
      spec_version: { type: "string", description: "规格书版本，如 V1.0" },
      notes: { type: "string", description: "备注" },
    },
    required: ["code", "name", "customer", "responsible"],
    additionalProperties: false,
  },
  workstation: {
    type: "object",
    properties: {
      code: { type: "string", description: "工位编号" },
      name: { type: "string", description: "工位名称" },
      cycleTime: { type: "string", description: "节拍(s/pcs)" },
      length: { type: "string", description: "产品长度(mm)" },
      width: { type: "string", description: "产品宽度(mm)" },
      height: { type: "string", description: "产品高度(mm)" },
      process_stage: { type: "string", description: "工艺段: 上料/装配/检测/下线/焊接/涂装/其他" },
      observation_target: { type: "string", description: "被观察对象: 电芯/模组/托盘/箱体/PCB/壳体/其他" },
      motion_description: { type: "string", description: "运动描述" },
      shot_count: { type: "string", description: "拍照数" },
      action_script: { type: "string", description: "动作脚本" },
      risk_notes: { type: "string", description: "风险说明" },
    },
    required: ["code", "name", "cycleTime"],
    additionalProperties: false,
  },
  module: {
    type: "object",
    properties: {
      name: { type: "string", description: "模块名称" },
      description: { type: "string", description: "检测步骤" },
      workingDistance: { type: "string", description: "工作距离(mm)" },
      fieldOfViewCommon: { type: "string", description: "视场(mm)，格式如 100×80" },
      resolutionPerPixel: { type: "string", description: "每像素分辨率(mm)" },
      exposure: { type: "string", description: "曝光时间" },
      lightMode: { type: "string", description: "打光方式" },
      lightAngle: { type: "string", description: "光源角度" },
      communicationMethod: { type: "string", description: "通讯方式" },
      signalDefinition: { type: "string", description: "信号定义" },
    },
    required: ["name"],
    additionalProperties: false,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { formType, currentData, projectContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const schema = formSchemas[formType];
    if (!schema) throw new Error(`Unknown form type: ${formType}`);

    const systemPrompt = `你是一个工业视觉方案配置助手。根据用户提供的已有项目信息和上下文，为表单中的空白字段生成合理的建议值。
规则：
1. 只填写空白或空字符串的字段，已有值的字段不要覆盖
2. 生成的值应该专业、合理、符合工业视觉行业惯例
3. 如果有项目上下文，请参考上下文生成关联的建议
4. 数值字段请给出合理的工业标准值
5. 只返回需要填写的字段`;

    const userPrompt = `表单类型: ${formType}
当前已有数据: ${JSON.stringify(currentData, null, 2)}
${projectContext ? `项目上下文: ${JSON.stringify(projectContext, null, 2)}` : ''}

请为空白字段生成建议值。`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "fill_form",
              description: "填写表单的空白字段",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fill_form" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "请求频率过高，请稍后再试" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "额度不足，请充值" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI 服务异常" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI 未返回有效建议" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let suggestions: Record<string, string>;
    try {
      suggestions = JSON.parse(toolCall.function.arguments);
    } catch {
      suggestions = {};
    }

    // Filter out fields that already have values
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(suggestions)) {
      if (value && (!currentData[key] || currentData[key] === '')) {
        filtered[key] = String(value);
      }
    }

    return new Response(JSON.stringify({ suggestions: filtered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-form-assist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
