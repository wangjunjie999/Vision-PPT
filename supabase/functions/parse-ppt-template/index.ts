import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMU_PER_INCH = 914400;

const SYSTEM_FIELDS = [
  "project_name",
  "project_code",
  "customer",
  "date",
  "date_formatted",
  "responsible",
  "vision_responsible",
  "sales_responsible",
  "description",
  "spec_version",
  "product_process",
  "quality_strategy",
  "security_level",
  "workstation_count",
  "total_module_count",
  "camera_count",
  "lens_count",
  "light_count",
  "controller_count",
  "total_hardware_count",
  "name",
  "code",
  "type",
  "type_label",
  "index",
  "cycle_time",
  "shot_count",
  "observation_target",
  "motion_description",
  "risk_notes",
  "module_count",
  "ws_name",
  "ws_code",
  "ws_index",
  "ws_type_label",
  "mod_name",
  "mod_index",
  "mod_type_label",
  "mod_trigger_label",
  "mod_processing_time",
  "front_view_image",
  "side_view_image",
  "top_view_image",
  "product_snapshot",
  "schematic_image",
  "generated_date",
  "generated_time",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "未授权" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "用户未登录" }, 401);

    const body = await req.json();
    let fileUrl = body.templateUrl as string | undefined;
    let fileName = (body.fileName as string | undefined) || "template.pptx";
    let fileSize = Number(body.fileSize || 0);

    if (body.templateId && !fileUrl) {
      const { data: template, error } = await supabase
        .from("ppt_templates")
        .select("file_url, name")
        .eq("id", body.templateId)
        .single();

      if (error || !template?.file_url) {
        return json({ error: "模板不存在或未上传文件" }, 404);
      }
      fileUrl = template.file_url;
      fileName = template.name || fileName;
    }

    if (!fileUrl) return json({ error: "未提供模板文件" }, 400);

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return json({ error: `无法下载模板文件: ${fileResponse.status}` }, 500);
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    if (!fileSize) fileSize = arrayBuffer.byteLength;

    const JSZip = (await import("npm:jszip@3.10.1")).default;
    const zip = await JSZip.loadAsync(arrayBuffer);

    const template = await parsePptx(zip, fileName, fileSize);
    return json({ template });
  } catch (error) {
    console.error("Parse PPT template error:", error);
    return json({ error: `解析错误: ${(error as Error).message}` }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function parsePptx(zip: any, fileName: string, fileSize: number) {
  const presXml = await readZipFile(zip, "ppt/presentation.xml");
  const dimensions = parseDimensions(presXml);

  const masterFiles = sortedPptFiles(zip, /^ppt\/slideMasters\/slideMaster(\d+)\.xml$/);
  const layoutFiles = sortedPptFiles(zip, /^ppt\/slideLayouts\/slideLayout(\d+)\.xml$/);
  const slideFiles = sortedPptFiles(zip, /^ppt\/slides\/slide(\d+)\.xml$/);

  const masters = await Promise.all(masterFiles.map(async (path: string, index: number) => {
    const xml = await readZipFile(zip, path);
    return {
      id: path.split("/").pop()?.replace(".xml", "") || `slideMaster${index + 1}`,
      name: `母版 ${index + 1}`,
      index,
      background: parseBackground(xml || ""),
      placeholders: parsePlaceholders(xml || ""),
    };
  }));

  const layouts = await Promise.all(layoutFiles.map(async (path: string) => {
    const xml = await readZipFile(zip, path);
    const id = path.split("/").pop()?.replace(".xml", "") || path;
    const name = decodeXml(xml?.match(/<p:cSld\s+name="([^"]*)"/)?.[1] || id);
    return {
      id,
      name,
      masterRef: "",
      type: detectLayoutType(name),
      placeholders: parsePlaceholders(xml || ""),
    };
  }));

  const slides = [];
  const allFields = new Set<string>();
  const detectedBindings: any[] = [];
  const roleSummary: Record<string, number> = {};
  for (const path of slideFiles) {
    const index = Number(path.match(/slide(\d+)\.xml$/)?.[1] || "1") - 1;
    const xml = await readZipFile(zip, path) || "";
    const shapes = parseShapes(xml);
    const text = shapes.map((shape: any) => shape.text).filter(Boolean).join("\n");
    const layoutRef = await getSlideLayoutRef(zip, path);
    const textFields = collectTextFields(xml);
    const imageFields = collectImageFields(xml);
    const detectedRole = detectSlideRole(index, text, layoutRef);
    const slideBindings = detectRuleBindings(index, detectedRole, shapes, textFields);

    textFields.forEach((field) => allFields.add(field));
    detectedBindings.push(...slideBindings);
    roleSummary[detectedRole] = (roleSummary[detectedRole] || 0) + 1;

    slides.push({
      index,
      layoutRef,
      customFields: [...new Set([...textFields, ...imageFields.map((f) => `img:${f}`)])],
      text,
      title: guessSlideTitle(shapes),
      detectedRole,
      shapes,
      detectedBindings: slideBindings,
    });
  }

  return {
    fileName,
    fileSize,
    slideCount: slideFiles.length,
    dimensions,
    masters,
    layouts,
    slides,
    customFields: [...allFields],
    detectedBindings,
    roleSummary,
    availableSystemFields: SYSTEM_FIELDS,
    parsedAt: new Date().toISOString(),
  };
}

function sortedPptFiles(zip: any, pattern: RegExp): string[] {
  return Object.keys(zip.files)
    .filter((path) => pattern.test(path))
    .sort((a, b) => Number(a.match(pattern)?.[1] || 0) - Number(b.match(pattern)?.[1] || 0));
}

async function readZipFile(zip: any, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return await file.async("string");
}

function parseDimensions(xml: string | null) {
  const match = xml?.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  if (!match) return { width: 13.333, height: 7.5 };
  return {
    width: Number((Number(match[1]) / EMU_PER_INCH).toFixed(3)),
    height: Number((Number(match[2]) / EMU_PER_INCH).toFixed(3)),
  };
}

function parseBackground(xml: string) {
  const solid = xml.match(/<a:solidFill>\s*<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
  if (solid) return { type: "color", value: solid[1].toUpperCase() };
  if (xml.includes("<a:gradFill")) return { type: "gradient", value: "" };
  if (xml.includes("<a:blipFill")) return { type: "image", value: "" };
  return { type: "color", value: "FFFFFF" };
}

function parsePlaceholders(xml: string) {
  const placeholders = [];
  const matches = xml.matchAll(/<p:sp>[\s\S]*?<p:ph([^/]*)\/>[\s\S]*?<a:off\s+x="(\d+)"\s+y="(\d+)"[\s\S]*?<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/g);
  let idx = 0;
  for (const match of matches) {
    const type = match[1].match(/type="([^"]+)"/)?.[1] || "body";
    placeholders.push({
      type,
      name: `${type}_${idx++}`,
      position: {
        x: Number((Number(match[2]) / EMU_PER_INCH).toFixed(3)),
        y: Number((Number(match[3]) / EMU_PER_INCH).toFixed(3)),
        w: Number((Number(match[4]) / EMU_PER_INCH).toFixed(3)),
        h: Number((Number(match[5]) / EMU_PER_INCH).toFixed(3)),
      },
    });
  }
  return placeholders;
}

function parseShapes(xml: string) {
  const shapes: any[] = [];
  const shapeRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  const picRegex = /<p:pic\b[\s\S]*?<\/p:pic>/g;

  for (const match of xml.matchAll(shapeRegex)) {
    const raw = match[0];
    const text = collectShapeText(raw);
    shapes.push({
      id: getShapeId(raw, `sp_${shapes.length}`),
      name: getShapeName(raw),
      kind: text ? "text" : "other",
      text,
      position: parseShapePosition(raw),
    });
  }

  for (const match of xml.matchAll(picRegex)) {
    const raw = match[0];
    shapes.push({
      id: getShapeId(raw, `pic_${shapes.length}`),
      name: getShapeName(raw),
      kind: "picture",
      text: "",
      position: parseShapePosition(raw),
    });
  }

  return shapes.sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
}

function collectShapeText(shapeXml: string): string {
  return [...shapeXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function getShapeId(xml: string, fallback: string): string {
  return xml.match(/<p:cNvPr[^>]*\bid="([^"]+)"/)?.[1] || fallback;
}

function getShapeName(xml: string): string {
  return decodeXml(xml.match(/<p:cNvPr[^>]*\bname="([^"]*)"/)?.[1] || "");
}

function parseShapePosition(xml: string) {
  const match = xml.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"[\s\S]*?<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
  return {
    x: Number((Number(match?.[1] || 0) / EMU_PER_INCH).toFixed(3)),
    y: Number((Number(match?.[2] || 0) / EMU_PER_INCH).toFixed(3)),
    w: Number((Number(match?.[3] || 0) / EMU_PER_INCH).toFixed(3)),
    h: Number((Number(match?.[4] || 0) / EMU_PER_INCH).toFixed(3)),
  };
}

function collectTextFields(xml: string): string[] {
  const fields = new Set<string>();
  for (const match of xml.matchAll(/{{\s*([^{}]+?)\s*}}/g)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("/") || raw.startsWith("img:")) continue;
    fields.add(raw);
  }
  return [...fields];
}

function collectImageFields(xml: string): string[] {
  const fields = new Set<string>();
  for (const match of xml.matchAll(/{{\s*img:([^{}]+?)\s*}}/g)) {
    const key = match[1].trim();
    if (key) fields.add(key);
  }
  return [...fields];
}

function detectSlideRole(index: number, text: string, layoutRef: string): string {
  const compact = text.replace(/\s+/g, "");
  if (index === 0) return "cover";
  if (/走进|资质荣誉|数字泛微|公司简介|关于我们/.test(compact)) return "company_intro";
  if (/目录|CONTENT|Contents/i.test(compact)) return "toc";
  if (/章节|Section/i.test(layoutRef) || (/^0?\d/.test(compact) && compact.length < 80)) return "section";
  if (/方案|解决方案|检测|技术|要求|系统|工位|模块/.test(compact)) return "content";
  return "general";
}

function guessSlideTitle(shapes: any[]): string {
  return shapes
    .filter((shape) => shape.kind === "text" && shape.text)
    .sort((a, b) => (b.position.h - a.position.h) || (a.position.y - b.position.y))[0]
    ?.text
    ?.slice(0, 80) || "";
}

function detectRuleBindings(slideIndex: number, role: string, shapes: any[], textFields: string[]) {
  const bindings: any[] = [];
  for (const field of textFields) {
    bindings.push({
      id: `s${slideIndex}-placeholder-${field}`,
      slideIndex,
      shapeId: "",
      sourceText: `{{${field}}}`,
      token: field,
      label: field,
      matchType: "placeholder",
      replacementMode: "replace-token",
      suggestedSystemField: SYSTEM_FIELDS.includes(field) ? field : guessSystemField(field, role),
      confidence: SYSTEM_FIELDS.includes(field) ? 1 : 0.65,
    });
  }

  for (const shape of shapes) {
    if (shape.kind === "picture") {
      const suggested = guessImageField(shape, role);
      if (suggested) {
        bindings.push({
          id: `s${slideIndex}-pic-${shape.id}`,
          slideIndex,
          shapeId: shape.id,
          shapeName: shape.name,
          sourceText: shape.name || "图片",
          label: suggested,
          matchType: "image",
          replacementMode: "replace-picture",
          suggestedSystemField: suggested,
          confidence: 0.45,
          optional: true,
        });
      }
      continue;
    }

    if (!shape.text) continue;
    const tokens = [...shape.text.matchAll(/[XxＸｘ]{2,}|_{3,}/g)];
    tokens.forEach((tokenMatch, idx) => {
      const suggested = guessSystemField(shape.text, role, shape, idx);
      bindings.push({
        id: `s${slideIndex}-sp-${shape.id}-x-${idx}`,
        slideIndex,
        shapeId: shape.id,
        shapeName: shape.name,
        sourceText: shape.text,
        token: tokenMatch[0],
        label: suggested,
        matchType: "xxxx",
        replacementMode: "replace-token",
        suggestedSystemField: suggested,
        confidence: confidenceForSuggestion(shape.text, role, suggested),
      });
    });
  }
  return bindings;
}

function guessSystemField(text: string, role: string, shape?: any, occurrenceIndex = 0): string {
  const compact = text.replace(/\s+/g, "");
  if (/报告人|汇报人|负责人|Author|Presenter/i.test(compact)) return "responsible";
  if (/日期|时间|Date/i.test(compact)) return "date_formatted";
  if (/客户|Client|Customer/i.test(compact)) return "customer";
  if (/密级|公开|涉密|绝密|Confidential/i.test(compact)) return "security_level";
  if (/项目编号|项目号|编号|Code/i.test(compact)) return "project_code";
  if (/项目|方案|标题|主题|Project|Title/i.test(compact)) return "project_name";
  if (role === "cover") {
    if ((shape?.position?.y ?? 9) < 2.4) return "project_name";
    if (occurrenceIndex === 0) return "project_name";
    if (occurrenceIndex === 1) return "responsible";
    if (occurrenceIndex === 2) return "date_formatted";
  }
  if (role === "toc") return "project_name";
  return "project_name";
}

function confidenceForSuggestion(text: string, role: string, field: string): number {
  if (/报告人|汇报人|负责人|日期|时间|客户|密级|项目编号|编号|项目|方案/.test(text)) return 0.9;
  if (role === "cover" && ["project_name", "responsible", "date_formatted"].includes(field)) return 0.72;
  return 0.55;
}

function guessImageField(shape: any, role: string): string | null {
  const name = `${shape.name}`.toLowerCase();
  if (/front|正视|正面/.test(name)) return "front_view_image";
  if (/side|侧视|侧面/.test(name)) return "side_view_image";
  if (/top|俯视|俯视图/.test(name)) return "top_view_image";
  if (/product|产品|标注/.test(name)) return "product_snapshot";
  if (/schematic|diagram|示意/.test(name)) return "schematic_image";
  if (role === "content") return "product_snapshot";
  return null;
}

async function getSlideLayoutRef(zip: any, slidePath: string): Promise<string> {
  const relsPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
  const relsXml = await readZipFile(zip, relsPath);
  const target = relsXml?.match(/Type="[^"]+\/slideLayout"[^>]*Target="([^"]+)"/)?.[1];
  if (!target) return "unknown";
  return target.split("/").pop()?.replace(".xml", "") || "unknown";
}

function detectLayoutType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("title") || name.includes("标题")) return "title";
  if (lower.includes("blank") || name.includes("空白")) return "blank";
  if (lower.includes("section") || name.includes("章节")) return "section";
  if (lower.includes("two") || name.includes("双")) return "two-content";
  return "content";
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
