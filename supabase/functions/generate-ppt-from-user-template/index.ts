import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const SLIDE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const SLIDE_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

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

    const { templateId, data, outputFileName, options = {} } = await req.json();
    if (!templateId) return json({ error: "缺少模板ID" }, 400);
    if (!data?.project) return json({ error: "缺少生成数据" }, 400);

    const { data: template, error: templateError } = await supabase
      .from("ppt_templates")
      .select("id, name, file_url, structure_meta")
      .eq("id", templateId)
      .single();

    if (templateError || !template?.file_url) {
      return json({ error: "模板不存在或未上传PPTX文件" }, 404);
    }

    const fileResponse = await fetch(template.file_url);
    if (!fileResponse.ok) {
      return json({ error: `无法下载模板文件: ${fileResponse.status}` }, 500);
    }

    const JSZip = (await import("npm:jszip@3.10.1")).default;
    const zip = await JSZip.loadAsync(await fileResponse.arrayBuffer());

    const generation = await generatePptxFromTemplate(zip, {
      data,
      templateName: template.name || "template",
      structureMeta: template.structure_meta || {},
      options,
    });

    const fileName = sanitizeFileName(outputFileName || `${data.project.code || "project"}_${data.project.name || "方案"}_方案.pptx`);
    const filePath = `${user.id}/${data.project.id || "project"}/${Date.now()}_${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("generated-documents")
      .upload(filePath, new Blob([generation.bytes], { type: PPTX_MIME }), {
        contentType: PPTX_MIME,
        upsert: true,
      });

    if (uploadError) {
      return json({ error: `上传生成文件失败: ${uploadError.message}` }, 500);
    }

    const { data: publicUrl } = supabase.storage
      .from("generated-documents")
      .getPublicUrl(filePath);

    return json({
      fileUrl: publicUrl.publicUrl,
      filePath,
      fileName,
      fileSize: generation.bytes.byteLength,
      slideCount: generation.slideCount,
      templateName: template.name,
      replacedFields: generation.replacedFields,
      slideTypes: generation.slideTypes,
    });
  } catch (error) {
    console.error("Generate PPT from template error:", error);
    return json({ error: `生成错误: ${(error as Error).message}` }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generatePptxFromTemplate(zip: any, input: {
  data: any;
  templateName: string;
  structureMeta: any;
  options: any;
}) {
  const sourceSlides = sortedPptFiles(zip, /^ppt\/slides\/slide(\d+)\.xml$/);
  if (sourceSlides.length === 0) throw new Error("模板中没有幻灯片");

  const sourceXml = new Map<string, string>();
  const sourceRels = new Map<string, string>();
  for (const slidePath of sourceSlides) {
    sourceXml.set(slidePath, await readZipFile(zip, slidePath) || "");
    sourceRels.set(slidePath, await readZipFile(zip, relsPathForSlide(slidePath)) || relationshipsXml(""));
  }

  const plan = buildSlidePlan(sourceSlides, input.data, input.structureMeta, input.options);
  const replacedFields = new Set<string>();
  const slideTypes: Array<{ index: number; type: string }> = [];

  for (const slidePath of sourceSlides) {
    zip.remove(slidePath);
    zip.remove(relsPathForSlide(slidePath));
  }

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    const sourcePath = sourceSlides[item.sourceIndex];
    let xml = sourceXml.get(sourcePath) || "";
    let relsXml = sourceRels.get(sourcePath) || relationshipsXml("");

    xml = replaceLoops(xml, item.context, input.options?.fieldMappings || input.structureMeta?.fieldMappings || [], replacedFields);
    xml = replaceTextPlaceholders(xml, item.context, input.options?.fieldMappings || input.structureMeta?.fieldMappings || [], replacedFields);

    const imageResult = await replaceImagePlaceholders(zip, xml, relsXml, i + 1, item.context);
    xml = imageResult.xml;
    relsXml = imageResult.relsXml;

    zip.file(`ppt/slides/slide${i + 1}.xml`, xml);
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, relsXml);
    slideTypes.push({ index: i, type: item.slideType || "template" });
  }

  await updatePresentationRelationships(zip, plan.length);
  await updateContentTypes(zip, plan.length);

  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    bytes,
    slideCount: plan.length,
    replacedFields: [...replacedFields],
    slideTypes,
  };
}

function buildSlidePlan(sourceSlides: string[], data: any, structureMeta: any, options: any) {
  const layoutMapping = structureMeta?.layoutMapping || {};
  const mappings = Array.isArray(layoutMapping.mappings)
    ? layoutMapping.mappings.filter((m: any) => m.enabled !== false)
    : [];
  const duplicate = options?.duplicateWorkstationSlides ?? layoutMapping.duplicateForEachWorkstation ?? true;
  const preserveUnmapped = layoutMapping.preserveUnmappedSlides !== false;
  const mappedByIndex = new Map<number, any>();
  mappings.forEach((mapping: any) => mappedByIndex.set(Number(mapping.templateSlideIndex), mapping));

  const workstations = Array.isArray(data.workstations) ? data.workstations : [];
  const plan = [];

  for (let sourceIndex = 0; sourceIndex < sourceSlides.length; sourceIndex++) {
    const mapping = mappedByIndex.get(sourceIndex);

    if (mapping && duplicate && workstations.length > 0) {
      for (let wsIndex = 0; wsIndex < workstations.length; wsIndex++) {
        plan.push({
          sourceIndex,
          slideType: mapping.slideType,
          context: buildContext(data, workstations[wsIndex], wsIndex),
        });
      }
      continue;
    }

    if (mapping && !duplicate) {
      plan.push({
        sourceIndex,
        slideType: mapping.slideType,
        context: buildContext(data, workstations[0], 0),
      });
      continue;
    }

    if (preserveUnmapped || mappings.length === 0) {
      plan.push({
        sourceIndex,
        slideType: "unmapped",
        context: buildContext(data),
      });
    }
  }

  return plan.length > 0 ? plan : sourceSlides.map((_, sourceIndex) => ({
    sourceIndex,
    slideType: "template",
    context: buildContext(data),
  }));
}

function buildContext(data: any, workstation?: any, workstationIndex = 0) {
  const modules = workstation?.modules || data.modules?.filter((m: any) => m.workstation_id === workstation?.id) || [];
  return {
    project: data.project || {},
    workstations: data.workstations || [],
    workstation,
    workstationIndex,
    modules,
    layout: workstation?.layout || null,
    hardware: data.hardware || {},
    productAsset: workstation?.product_asset || null,
    productAnnotation: workstation?.product_annotation || null,
    language: data.language || "zh",
    generatedAt: new Date(),
  };
}

function replaceLoops(xml: string, context: any, fieldMappings: any[], replacedFields: Set<string>) {
  const loopSources: Record<string, any[]> = {
    workstations: context.workstations || [],
    modules: context.modules || [],
    "hardware.cameras": context.hardware?.cameras || [],
    "hardware.lenses": context.hardware?.lenses || [],
    "hardware.lights": context.hardware?.lights || [],
    "hardware.controllers": context.hardware?.controllers || [],
  };

  let output = xml;
  for (const [loopName, items] of Object.entries(loopSources)) {
    const pattern = new RegExp(`{{\\s*#${escapeRegExp(loopName)}\\s*}}([\\s\\S]*?){{\\s*/${escapeRegExp(loopName)}\\s*}}`, "g");
    output = output.replace(pattern, (_match, inner) => {
      return items.map((item, index) => {
        const loopContext = {
          ...context,
          loopItem: item,
          loopName,
          loopIndex: index,
          workstation: loopName === "workstations" ? item : context.workstation,
          modules: loopName === "workstations" ? (item.modules || []) : context.modules,
        };
        return replaceTextPlaceholders(inner, loopContext, fieldMappings, replacedFields);
      }).join("");
    });
  }
  return output;
}

function replaceTextPlaceholders(xml: string, context: any, fieldMappings: any[], replacedFields: Set<string>) {
  const fields = buildFieldMap(context, fieldMappings);
  return xml.replace(/{{\s*([^{}]+?)\s*}}/g, (full, key) => {
    const field = String(key).trim();
    if (!field || field.startsWith("#") || field.startsWith("/") || field.startsWith("img:")) return full;
    const value = fields[field];
    replacedFields.add(field);
    return escapeXml(value ?? "");
  });
}

function buildFieldMap(context: any, fieldMappings: any[]) {
  const project = context.project || {};
  const workstation = context.workstation || {};
  const layout = context.layout || {};
  const loopItem = context.loopItem || null;
  const generatedAt = context.generatedAt || new Date();

  const fields: Record<string, string> = {
    project_name: project.name,
    project_code: project.code,
    customer: project.customer,
    date: project.date,
    date_formatted: formatDate(project.date),
    date_year: datePart(project.date, "year"),
    date_month: datePart(project.date, "month"),
    date_day: datePart(project.date, "day"),
    responsible: project.responsible,
    vision_responsible: project.vision_responsible,
    sales_responsible: project.sales_responsible,
    description: project.description || project.notes,
    spec_version: project.spec_version,
    product_process: project.product_process,
    quality_strategy: project.quality_strategy,
    workstation_count: String(context.workstations?.length || 0),
    total_module_count: String((context.workstations || []).reduce((sum: number, ws: any) => sum + (ws.modules?.length || 0), 0) || context.modules?.length || 0),
    camera_count: String(context.hardware?.cameras?.length || 0),
    lens_count: String(context.hardware?.lenses?.length || 0),
    light_count: String(context.hardware?.lights?.length || 0),
    controller_count: String(context.hardware?.controllers?.length || 0),
    total_hardware_count: String((context.hardware?.cameras?.length || 0) + (context.hardware?.lenses?.length || 0) + (context.hardware?.lights?.length || 0) + (context.hardware?.controllers?.length || 0)),
    generated_date: formatDate(generatedAt),
    generated_time: generatedAt.toLocaleTimeString("zh-CN", { hour12: false }),
    ws_name: workstation.name,
    ws_code: workstation.code,
    ws_index: String((context.workstationIndex ?? 0) + 1),
    ws_type: workstation.type,
    ws_type_label: workstation.type_label,
    ws_cycle_time: stringify(workstation.cycle_time),
    ws_shot_count: stringify(workstation.shot_count),
    ws_observation_target: workstation.observation_target,
    ws_motion_description: workstation.motion_description,
    ws_risk_notes: workstation.risk_notes,
    ws_module_count: String(context.modules?.length || 0),
    ws_product_size: workstation.product_dimensions_label,
    ws_layout_size: layout.dimensions_label,
    ws_camera_count: stringify(layout.camera_count),
    front_view_image_url: layout.front_view_image_url,
    side_view_image_url: layout.side_view_image_url,
    top_view_image_url: layout.top_view_image_url,
  };

  if (workstation?.id) {
    Object.assign(fields, {
      name: workstation.name,
      code: workstation.code,
      type: workstation.type,
      type_label: workstation.type_label,
      index: String((context.workstationIndex ?? 0) + 1),
      cycle_time: stringify(workstation.cycle_time),
      shot_count: stringify(workstation.shot_count),
      observation_target: workstation.observation_target,
      motion_description: workstation.motion_description,
      risk_notes: workstation.risk_notes,
      module_count: String(context.modules?.length || 0),
    });
  }

  if (loopItem) {
    const loopIndex = Number(context.loopIndex || 0) + 1;
    Object.entries(flattenObject(loopItem)).forEach(([key, value]) => {
      fields[key] = stringify(value);
    });
    fields.index = String(loopIndex);

    if (context.loopName === "modules") {
      Object.assign(fields, {
        mod_name: loopItem.name,
        mod_index: String(loopIndex),
        mod_type: loopItem.type,
        mod_type_label: loopItem.type_label,
        mod_description: loopItem.description,
        mod_trigger_label: loopItem.trigger_type_label,
        mod_roi_strategy: loopItem.roi_strategy_label,
        mod_processing_time: stringify(loopItem.processing_time_limit),
        mod_schematic_url: loopItem.schematic_image_url,
      });
    }

    if (context.loopName === "workstations") {
      Object.assign(fields, {
        ws_name: loopItem.name,
        ws_code: loopItem.code,
        ws_index: String(loopIndex),
        ws_type_label: loopItem.type_label,
        ws_module_count: String(loopItem.modules?.length || 0),
      });
    }
  }

  for (const mapping of fieldMappings || []) {
    const templateField = mapping?.templateField;
    const systemField = mapping?.systemField;
    if (!templateField || !systemField) continue;
    fields[templateField] = fields[systemField] ?? stringify(getByPath({ ...context, project, workstation, layout }, systemField));
  }

  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, stringify(value)]));
}

async function replaceImagePlaceholders(zip: any, xml: string, relsXml: string, slideNumber: number, context: any) {
  let outputXml = xml;
  let outputRels = relsXml || relationshipsXml("");
  const shapeRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  const shapes = [...xml.matchAll(shapeRegex)].map((match) => match[0]);
  let imageIndex = 0;

  for (const shape of shapes) {
    const placeholders = [...shape.matchAll(/{{\s*img:([^{}]+?)\s*}}/g)];
    if (placeholders.length === 0) continue;

    for (const placeholder of placeholders) {
      const imageKey = placeholder[1].trim();
      const imageUrl = resolveImageUrl(imageKey, context);
      if (!imageUrl) {
        outputXml = outputXml.replace(placeholder[0], "[图片缺失]");
        continue;
      }

      try {
        const image = await fetchImage(imageUrl);
        const mediaName = `template_img_${slideNumber}_${imageIndex++}.${image.ext}`;
        zip.file(`ppt/media/${mediaName}`, image.bytes);
        const rId = nextRelationshipId(outputRels);
        outputRels = addRelationship(outputRels, rId, IMAGE_REL, `../media/${mediaName}`);

        const position = parseShapePosition(shape);
        const picXml = createPictureXml(rId, `TemplateImage${slideNumber}_${imageIndex}`, position);
        outputXml = outputXml.replace(placeholder[0], "");
        outputXml = outputXml.replace("</p:spTree>", `${picXml}</p:spTree>`);
      } catch (error) {
        console.warn("Image insertion failed:", imageUrl, error);
        outputXml = outputXml.replace(placeholder[0], "[图片加载失败]");
      }
    }
  }

  return { xml: outputXml, relsXml: outputRels };
}

function resolveImageUrl(key: string, context: any): string | null {
  const layout = context.layout || {};
  const productAsset = context.productAsset || {};
  const productAnnotation = context.productAnnotation || {};
  const firstModule = context.modules?.[0] || {};
  const aliases: Record<string, string | null> = {
    front_view: layout.front_view_image_url,
    side_view: layout.side_view_image_url,
    top_view: layout.top_view_image_url,
    isometric_view: layout.isometric_view_image_url,
    product_snapshot: productAnnotation.snapshot_url,
    product_preview: productAsset.preview_images?.[0]?.url,
    schematic_image: firstModule.schematic_image_url,
    module_schematic: firstModule.schematic_image_url,
  };
  return aliases[key] || getByPath(context, key) || null;
}

async function fetchImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  const lower = url.toLowerCase();
  let ext = "png";
  if (contentType.includes("jpeg") || lower.includes(".jpg") || lower.includes(".jpeg")) ext = "jpg";
  else if (contentType.includes("gif") || lower.includes(".gif")) ext = "gif";
  else if (contentType.includes("webp") || lower.includes(".webp")) ext = "webp";
  return { bytes, ext };
}

function parseShapePosition(shape: string) {
  const match = shape.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"[\s\S]*?<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
  return {
    x: Number(match?.[1] || 914400),
    y: Number(match?.[2] || 914400),
    cx: Number(match?.[3] || 3657600),
    cy: Number(match?.[4] || 2057400),
  };
}

function createPictureXml(rId: string, name: string, pos: { x: number; y: number; cx: number; cy: number }) {
  const picId = Math.floor(Math.random() * 1000000) + 1000;
  return `
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="${picId}" name="${escapeXml(name)}"/>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${rId}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm>
      <a:off x="${pos.x}" y="${pos.y}"/>
      <a:ext cx="${pos.cx}" cy="${pos.cy}"/>
    </a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>`;
}

async function updatePresentationRelationships(zip: any, slideCount: number) {
  const presentationPath = "ppt/presentation.xml";
  const relsPath = "ppt/_rels/presentation.xml.rels";
  const presentationXml = await readZipFile(zip, presentationPath);
  const relsXml = await readZipFile(zip, relsPath);
  if (!presentationXml || !relsXml) throw new Error("模板缺少 presentation.xml");

  const nonSlideRels = relsXml.replace(/\s*<Relationship\b[^>]*Type="[^"]+\/slide"[^>]*\/>/g, "");
  const existingIds = [...nonSlideRels.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  const baseRelId = Math.max(0, ...existingIds) + 1;

  const slideIds = Array.from({ length: slideCount }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${baseRelId + i}"/>`).join("");
  const nextPresentationXml = presentationXml.includes("<p:sldIdLst>")
    ? presentationXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${slideIds}</p:sldIdLst>`)
    : presentationXml.replace("</p:presentation>", `<p:sldIdLst>${slideIds}</p:sldIdLst></p:presentation>`);

  const slideRels = Array.from({ length: slideCount }, (_, i) =>
    `<Relationship Id="rId${baseRelId + i}" Type="${SLIDE_REL}" Target="slides/slide${i + 1}.xml"/>`
  ).join("");
  const nextRelsXml = nonSlideRels.replace("</Relationships>", `${slideRels}</Relationships>`);

  zip.file(presentationPath, nextPresentationXml);
  zip.file(relsPath, nextRelsXml);
}

async function updateContentTypes(zip: any, slideCount: number) {
  const path = "[Content_Types].xml";
  const xml = await readZipFile(zip, path);
  if (!xml) throw new Error("模板缺少 [Content_Types].xml");
  const withoutSlides = xml.replace(/\s*<Override\b[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, "");
  const slideOverrides = Array.from({ length: slideCount }, (_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${SLIDE_CONTENT_TYPE}"/>`
  ).join("");
  zip.file(path, withoutSlides.replace("</Types>", `${slideOverrides}</Types>`));
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

function relsPathForSlide(slidePath: string) {
  return slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
}

function relationshipsXml(inner: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}">${inner}</Relationships>`;
}

function nextRelationshipId(relsXml: string) {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return `rId${Math.max(0, ...ids) + 1}`;
}

function addRelationship(relsXml: string, id: string, type: string, target: string) {
  const relationship = `<Relationship Id="${id}" Type="${type}" Target="${escapeXml(target)}"/>`;
  if (relsXml.includes("</Relationships>")) {
    return relsXml.replace("</Relationships>", `${relationship}</Relationships>`);
  }
  return relationshipsXml(relationship);
}

function flattenObject(value: any, prefix = ""): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.assign(result, flattenObject(item, nextKey));
    } else {
      result[nextKey] = item;
    }
  }
  return result;
}

function getByPath(source: any, path: string): any {
  return String(path).split(".").reduce((value, key) => value?.[key], source);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(stringify).filter(Boolean).join("、");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("display_name" in record) return stringify(record.display_name);
    if ("name" in record) return stringify(record.name);
    if ("model" in record && "brand" in record) return `${stringify(record.brand)} ${stringify(record.model)}`.trim();
    return JSON.stringify(value);
  }
  return String(value);
}

function formatDate(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("zh-CN");
}

function datePart(value: unknown, part: "year" | "month" | "day") {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  if (part === "year") return String(date.getFullYear());
  if (part === "month") return String(date.getMonth() + 1);
  return String(date.getDate());
}

function escapeXml(value: unknown): string {
  return stringify(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeFileName(fileName: string) {
  const safe = fileName.replace(/[\\/:*?"<>|]/g, "_");
  return safe.toLowerCase().endsWith(".pptx") ? safe : `${safe}.pptx`;
}
