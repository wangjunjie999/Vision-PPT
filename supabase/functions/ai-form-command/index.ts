import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userMessage, projectsData, workstationsData, modulesData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `你是一个工业视觉方案配置助手。用户会用自然语言描述他们想要填写的表单内容。你需要：

1. 从用户指令中识别目标：是哪个项目（通过项目编号如DB260101匹配）、哪个工位（通过编号如06、名称匹配）、或哪个模块
2. 确定要填写的字段和内容
3. 基于项目上下文生成专业、合理的填写内容

当前系统中的数据：
项目列表: ${JSON.stringify(projectsData || [])}
工位列表: ${JSON.stringify(workstationsData || [])}
模块列表: ${JSON.stringify(modulesData || [])}

用户指令: "${userMessage}"

请分析用户意图，找到目标实体，并生成要填写的字段值。

## 字段映射说明

### 项目字段
code, name, customer, production_line, product_process, responsible, sales_responsible, vision_responsible, cycle_time_target, quality_strategy, spec_version, notes, environment, description, main_camera_brand

### 工位字段
code, name, cycleTime, length, width, height, process_stage, observation_target, motion_description, shot_count, action_script, risk_notes, description, notes
- acceptance_accuracy, acceptance_cycle_time, acceptance_compatible_sizes（验收标准相关）

### 模块通用字段
name, description, type, workingDistance, fieldOfViewCommon, resolutionPerPixel, exposure, lightMode, lightAngle, communicationMethod, signalDefinition, dataRetentionDays
- description 表示检测步骤

### 模块类型专用字段

**测量模块 (measurement)**：
- measurementFieldOfView: 测量视野范围
- measurementResolution: 测量分辨率
- targetAccuracy: 目标精度(mm)
- systemAccuracy: 系统精度(mm)
- measurementCalibrationMethod: 标定方法（如"棋盘格标定"、"圆点阵列标定"）
- measurementDatum: 测量基准
- measurementObjectDescription: 测量对象描述
- calibrationPlateSpec: 标定板规格
- grr: GRR值
- edgeExtractionMethod: 边缘提取方法（如"Canny边缘检测"、"亚像素边缘提取"）
- measurementItems: 测量项目列表

**缺陷检测模块 (defect)**：
- defectClasses: 缺陷类型列表
- minDefectSize: 最小缺陷尺寸(mm)
- allowedMissRate: 允许漏检率
- allowedFalseRate: 允许误检率
- defectContrast: 缺陷对比度
- inspectionSurfaces: 检测面

**定位模块 (positioning)**：
- accuracyRequirement: 定位精度要求(mm)
- repeatabilityRequirement: 重复精度要求
- calibrationMethod: 标定方式
- coordinateDescription: 坐标说明
- targetType: 定位目标类型
- outputCoordinate: 输出坐标类型

**OCR模块 (ocr)**：
- charType: 字符类型（喷码/激光/丝印/标签/二维码/条码）
- charset: 字符集
- minCharHeight: 最小字符高度(mm)
- contentRule: 内容规则

**深度学习模块 (deeplearning)**：
- dlTaskType: 任务类型（分类/检测/分割/异常检测）
- targetClasses: 目标类别
- inferenceTimeTarget: 推理时间目标(ms)
- deployTarget: 部署目标(cpu/gpu/edge)
- updateStrategy: 更新策略
- sampleSize: 样本数量

## 自然语言到字段的映射提示
- "测量方法" → 填写 measurementCalibrationMethod, measurementObjectDescription, edgeExtractionMethod, measurementItems 等测量相关字段
- "环境说明"/"现场环境" → 填写 risk_notes
- "检测参数" → 根据模块类型填写对应配置字段
- "检测步骤"/"功能说明" → 填写 description
- "验收标准" → 填写 acceptance_accuracy, acceptance_cycle_time 等
- "标定方法" → 填写 measurementCalibrationMethod 或 calibrationMethod
- "缺陷类型" → 填写 defectClasses, minDefectSize 等

## 重要规则
- **你必须在 fields 中生成具体的字段值！** 不要返回空的 fields 对象。
- 例如用户说"测量方法"，你必须生成如下字段值：
  { "measurementCalibrationMethod": "棋盘格标定，使用10x7棋盘格标定板...", "edgeExtractionMethod": "亚像素边缘提取..." }
- 匹配项目时，用项目的 code 字段（如 DB260101）进行模糊匹配
- 匹配工位时，可以用工位编号（code字段）、工位名称（name字段）、或工位序号（如"06工位"表示第6个工位）
- 如果目标是模块级别的字段，需要先定位到工位，再找到对应的模块
- 生成的内容应该专业、详细、符合工业视觉行业惯例
- 所有字段值都必须是字符串类型

请严格以以下 JSON 格式回复，不要包含任何其他文字：
{
  "targetType": "project" | "workstation" | "module",
  "targetId": "目标实体的UUID",
  "targetLabel": "可读标签如'DB260101项目的06工位'",
  "fields": { "字段名": "字段值", ... },
  "explanation": "简短说明"
}`;

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
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "AI 未能理解指令" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    try {
      result = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "AI 返回格式异常" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!result.fields || Object.keys(result.fields).length === 0) {
      return new Response(JSON.stringify({ error: "AI 未能生成具体字段值" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-form-command error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
