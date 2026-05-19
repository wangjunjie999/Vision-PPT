import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import pptxgen from 'pptxgenjs';

const OUT_DIR = path.resolve('artifacts/ppt-template');
const MEDIA_DIR = path.join(OUT_DIR, 'extracted-media');
const PPTX_PATH = path.join(OUT_DIR, 'dxy-upload-compatible-template.pptx');
const META_PATH = path.join(OUT_DIR, 'dxy-upload-compatible-template.structure_meta.json');

const W = 13.328;
const H = 7.501;
const C = {
  navy: '132E57',
  blue: '1B5FAA',
  cyan: '1DB7C9',
  orange: 'F05A28',
  ink: '202A3A',
  muted: '667085',
  pale: 'EEF5FA',
  line: 'CED9E6',
  white: 'FFFFFF',
  dark: '0C1B33',
};

const logo = path.join(MEDIA_DIR, 'image1.jpeg');
const campus = path.join(MEDIA_DIR, 'image2.png');
const machine = path.join(MEDIA_DIR, 'image13.png');
const techTexture = path.join(MEDIA_DIR, 'image9.png');

fs.mkdirSync(OUT_DIR, { recursive: true });

const pptx = new pptxgen();
pptx.defineLayout({ name: 'DXY_WIDE', width: W, height: H });
pptx.layout = 'DXY_WIDE';
pptx.author = 'Codex';
pptx.company = '苏州德星云智能装备有限公司';
pptx.subject = '上传模板占位符与页面映射示例';
pptx.title = '德星云上传模板 - 可解析版';
pptx.lang = 'zh-CN';
pptx.theme = {
  headFontFace: 'Microsoft YaHei',
  bodyFontFace: 'Microsoft YaHei',
  lang: 'zh-CN',
};
pptx.margin = 0;

const layoutMapping = {
  duplicateForEachWorkstation: true,
  preserveUnmappedSlides: true,
  mappings: [
    { templateSlideIndex: 2, slideType: 'basic_info', enabled: true },
    { templateSlideIndex: 3, slideType: 'product_schematic', enabled: true },
    { templateSlideIndex: 4, slideType: 'three_view', enabled: true },
    { templateSlideIndex: 5, slideType: 'technical_requirements', enabled: true },
    { templateSlideIndex: 6, slideType: 'optical_solution', enabled: true },
  ],
};

const knownSlideTitles = [
  '封面',
  '项目概览',
  '工位概览 / Basic Info',
  '产品与模块示意 / Product & Modules',
  '机械布局三视图 / Three Views',
  '技术要求 / Technical Requirements',
  '光学方案 / Optical Solution',
  'BOM 清单 / Global Hardware',
  '结束页',
];

function tx(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    margin: opts.margin ?? 0.03,
    fontFace: opts.fontFace || 'Microsoft YaHei',
    fontSize: opts.fontSize ?? 16,
    bold: opts.bold ?? false,
    color: opts.color || C.ink,
    breakLine: opts.breakLine,
    fit: opts.fit || 'shrink',
    valign: opts.valign || 'mid',
    align: opts.align || 'left',
    rotate: opts.rotate,
    paraSpaceAfterPt: 0,
    ...opts.extra,
  });
}

function rect(slide, x, y, w, h, fill, line = fill, opts = {}) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: fill, transparency: opts.transparency ?? 0 },
    line: { color: line, transparency: opts.lineTransparency ?? 0, width: opts.lineWidth ?? 0.7 },
    radius: opts.radius ?? 0,
    rotate: opts.rotate,
    shadow: opts.shadow,
  });
}

function line(slide, x1, y1, x2, y2, color = C.line, width = 1) {
  slide.addShape('line', {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width },
  });
}

function addLogo(slide) {
  if (fs.existsSync(logo)) {
    slide.addImage({ path: logo, x: 10.55, y: 0.22, w: 2.25, h: 0.25 });
  } else {
    tx(slide, 'TECH-SHINE', 10.45, 0.16, 2.4, 0.36, { fontSize: 20, bold: true, color: C.navy, align: 'right' });
  }
}

function addHeader(slide, no, title, subtitle = '') {
  rect(slide, 0, 0, W, 0.88, C.white, C.white);
  tx(slide, no, 0.62, 0.22, 0.78, 0.32, { fontSize: 14, bold: true, color: C.orange, align: 'center' });
  line(slide, 1.45, 0.42, 2.05, 0.42, C.orange, 2);
  tx(slide, title, 2.18, 0.16, 6.4, 0.42, { fontSize: 22, bold: true, color: C.navy });
  if (subtitle) tx(slide, subtitle, 2.2, 0.56, 5.4, 0.22, { fontSize: 9, color: C.muted });
  addLogo(slide);
}

function addFooter(slide, pageNo) {
  line(slide, 0.7, 7.08, 12.62, 7.08, 'D6DEE8', 0.6);
  tx(slide, 'TECH-SHINE  |  新能源智能制造解决方案服务商', 0.72, 7.16, 4.9, 0.18, { fontSize: 7.5, color: '6B7280' });
  tx(slide, `${pageNo}`.padStart(2, '0'), 12.08, 7.12, 0.48, 0.22, { fontSize: 8, bold: true, color: C.navy, align: 'right' });
}

function accentRail(slide, sectionNo) {
  rect(slide, 0.42, 1.06, 0.08, 5.72, C.orange, C.orange);
  tx(slide, sectionNo, 0.25, 1.08, 0.4, 0.4, { fontSize: 16, bold: true, color: C.orange, align: 'center' });
}

function metric(slide, label, value, x, y, w, color = C.blue) {
  rect(slide, x, y, w, 1.06, C.white, 'DCE6F2', {
    shadow: { type: 'outer', color: 'D2DAE6', opacity: 0.25, blur: 1, angle: 45, distance: 1 },
  });
  tx(slide, value, x + 0.18, y + 0.15, w - 0.36, 0.42, { fontSize: 26, bold: true, color, align: 'center' });
  tx(slide, label, x + 0.18, y + 0.62, w - 0.36, 0.22, { fontSize: 9.5, color: C.muted, align: 'center' });
}

function infoRow(slide, label, value, x, y, w, idx) {
  const fill = idx % 2 === 0 ? 'F7FAFD' : 'FFFFFF';
  rect(slide, x, y, w, 0.38, fill, 'E2E8F0');
  tx(slide, label, x + 0.14, y + 0.08, 1.25, 0.16, { fontSize: 8.5, color: C.muted, bold: true });
  tx(slide, value, x + 1.48, y + 0.05, w - 1.65, 0.2, { fontSize: 9.5, color: C.ink });
}

function imageSlot(slide, key, label, x, y, w, h) {
  rect(slide, x, y, w, h, 'F3F7FB', 'AFC8E4', { lineWidth: 1.1 });
  rect(slide, x + 0.08, y + 0.08, w - 0.16, h - 0.16, 'FFFFFF', 'D9E5F2', { lineWidth: 0.6 });
  tx(slide, `{{img:${key}}}`, x + 0.22, y + h / 2 - 0.16, w - 0.44, 0.26, {
    fontSize: 12,
    bold: true,
    color: C.blue,
    align: 'center',
  });
  tx(slide, label, x + 0.14, y + h - 0.32, w - 0.28, 0.16, {
    fontSize: 8,
    color: C.muted,
    align: 'center',
  });
}

function addSectionTitle(slide, title, subtitle, x = 0.86, y = 1.12, w = 5.2) {
  tx(slide, title, x, y, w, 0.48, { fontSize: 24, bold: true, color: C.navy });
  if (subtitle) tx(slide, subtitle, x, y + 0.52, w, 0.28, { fontSize: 10, color: C.muted });
}

function slideCover() {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  rect(slide, 0, 0, W, 1.32, C.white, C.white);
  addLogo(slide);
  tx(slide, '苏州德星云智能装备有限公司', 3.68, 0.32, 5.95, 0.42, { fontSize: 21, bold: true, color: '000000', align: 'center' });
  tx(slide, '新能源智能制造解决方案服务商', 4.55, 0.82, 4.2, 0.2, { fontSize: 9, bold: true, color: '8A8F99', align: 'center' });
  if (fs.existsSync(campus)) {
    slide.addImage({ path: campus, x: 0, y: 1.32, w: W, h: 5.22 });
  } else {
    rect(slide, 0, 1.32, W, 5.22, 'D7ECF6', 'D7ECF6');
  }
  rect(slide, 0, 5.2, W, 1.34, '000000', '000000', { transparency: 68 });
  rect(slide, 3.42, 2.02, 6.5, 0.74, 'FFFFFF', 'FFFFFF', { transparency: 14, lineWidth: 1.4 });
  tx(slide, '{{project_name}}', 3.7, 2.22, 5.95, 0.28, { fontSize: 19, bold: true, color: '4B5563', align: 'center' });
  tx(slide, '项目编号：{{project_code}}', 0.86, 6.07, 2.75, 0.2, { fontSize: 9.5, color: C.white });
  tx(slide, '客户：{{customer}}', 3.64, 6.07, 2.75, 0.2, { fontSize: 9.5, color: C.white });
  tx(slide, '报告人：{{responsible}}', 6.45, 6.07, 2.25, 0.2, { fontSize: 9.5, color: C.white });
  tx(slide, '日期：{{date_formatted}}', 8.98, 6.07, 2.15, 0.2, { fontSize: 9.5, color: C.white });
  tx(slide, '密级：{{security_level}}', 11.2, 6.07, 1.55, 0.2, { fontSize: 9.5, color: C.white, align: 'right' });
}

function slideOverview() {
  const slide = pptx.addSlide();
  slide.background = { color: C.pale };
  addHeader(slide, '01', '项目概览', '自动替换项目级字段，作为上传模板的全局首页');
  accentRail(slide, '01');
  addSectionTitle(slide, '{{project_name}}', '客户 {{customer}}  |  项目编号 {{project_code}}');
  metric(slide, '工位数量', '{{workstation_count}}', 0.88, 2.12, 2.15, C.blue);
  metric(slide, '检测模块', '{{total_module_count}}', 3.28, 2.12, 2.15, C.orange);
  metric(slide, '相机数量', '{{camera_count}}', 5.68, 2.12, 2.15, C.cyan);
  metric(slide, '硬件总数', '{{total_hardware_count}}', 8.08, 2.12, 2.15, C.navy);
  rect(slide, 10.62, 1.12, 1.95, 5.46, C.white, 'DCE6F2');
  tx(slide, '方案标签', 10.9, 1.38, 1.38, 0.22, { fontSize: 12, bold: true, color: C.navy, align: 'center' });
  tx(slide, '工序\n{{product_process}}', 10.92, 1.95, 1.35, 0.54, { fontSize: 11, color: C.ink, align: 'center' });
  tx(slide, '质量策略\n{{quality_strategy}}', 10.84, 2.82, 1.5, 0.62, { fontSize: 11, color: C.ink, align: 'center' });
  tx(slide, '规格版本\n{{spec_version}}', 10.9, 3.82, 1.38, 0.54, { fontSize: 11, color: C.ink, align: 'center' });
  tx(slide, '生成日期\n{{generated_date}}', 10.86, 4.74, 1.46, 0.54, { fontSize: 11, color: C.ink, align: 'center' });
  rect(slide, 0.88, 3.62, 9.35, 2.58, C.white, 'DCE6F2');
  infoRow(slide, '客户名称', '{{customer}}', 1.12, 3.92, 8.86, 0);
  infoRow(slide, '项目描述', '{{description}}', 1.12, 4.36, 8.86, 1);
  infoRow(slide, '视觉负责', '{{vision_responsible}}', 1.12, 4.8, 4.28, 2);
  infoRow(slide, '销售负责', '{{sales_responsible}}', 5.62, 4.8, 4.36, 3);
  infoRow(slide, '时间版本', '{{date_formatted}} / {{generated_time}}', 1.12, 5.24, 8.86, 4);
  addFooter(slide, 2);
}

function slideWorkstationBasic() {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, '02', '工位概览 / Basic Info', '映射为 basic_info，生成时会按每个工位复制');
  accentRail(slide, '02');
  tx(slide, '工位 {{index}}', 0.88, 1.14, 1.2, 0.28, { fontSize: 10, bold: true, color: C.orange });
  tx(slide, '{{name}}', 0.88, 1.52, 5.7, 0.5, { fontSize: 27, bold: true, color: C.navy });
  tx(slide, '编号 {{code}}  |  类型 {{type_label}}', 0.9, 2.05, 5.6, 0.22, { fontSize: 10, color: C.muted });
  if (fs.existsSync(machine)) slide.addImage({ path: machine, x: 7.58, y: 1.36, w: 4.5, h: 2.75 });
  rect(slide, 7.34, 1.2, 4.95, 3.12, 'F7FAFC', 'DCE6F2', { transparency: 4 });
  tx(slide, 'Image2 / 系统生成图承载区', 7.68, 4.02, 4.28, 0.22, { fontSize: 8.5, color: C.muted, align: 'center' });
  rect(slide, 0.88, 2.74, 5.82, 3.32, 'F7FAFC', 'DCE6F2');
  infoRow(slide, '节拍时间', '{{cycle_time}} s', 1.12, 3.02, 5.34, 0);
  infoRow(slide, '拍照次数', '{{shot_count}} 次', 1.12, 3.46, 5.34, 1);
  infoRow(slide, '模块数量', '{{module_count}} 个', 1.12, 3.9, 5.34, 2);
  infoRow(slide, '观测目标', '{{observation_target}}', 1.12, 4.34, 5.34, 3);
  infoRow(slide, '运动描述', '{{motion_description}}', 1.12, 4.78, 5.34, 4);
  infoRow(slide, '风险备注', '{{risk_notes}}', 1.12, 5.22, 5.34, 5);
  rect(slide, 7.34, 4.66, 4.95, 1.4, C.navy, C.navy);
  tx(slide, '关键判断', 7.68, 4.9, 1.08, 0.22, { fontSize: 12, bold: true, color: C.white });
  tx(slide, '本页使用工位级占位符：{{name}}、{{code}}、{{cycle_time}} 等。上传后会自动映射为工位基础信息页。', 7.68, 5.25, 4.05, 0.38, { fontSize: 8.5, color: 'D9EAF7' });
  addFooter(slide, 3);
}

function slideProduct() {
  const slide = pptx.addSlide();
  slide.background = { color: 'F7FAFC' };
  addHeader(slide, '03', '产品与模块示意 / Product & Modules', '映射为 product_schematic，承接产品标注图与模块示意图');
  accentRail(slide, '03');
  imageSlot(slide, 'product_snapshot', '产品标注图 {{img:product_snapshot}}', 0.88, 1.42, 5.52, 3.4);
  imageSlot(slide, 'schematic_image', '模块示意图 {{img:schematic_image}}', 6.78, 1.42, 5.52, 3.4);
  rect(slide, 0.88, 5.22, 11.42, 1.04, C.white, 'DCE6F2');
  tx(slide, '模块列表', 1.12, 5.42, 0.92, 0.18, { fontSize: 10, bold: true, color: C.navy });
  tx(
    slide,
    '{{#modules}}模块 {{mod_index}}：{{mod_name}}｜{{mod_type_label}}｜触发：{{mod_trigger_label}}｜处理：{{mod_processing_time}}ms\n{{/modules}}',
    2.18,
    5.34,
    9.58,
    0.58,
    { fontSize: 8.5, color: C.ink, valign: 'top' },
  );
  addFooter(slide, 4);
}

function slideThreeView() {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, '04', '机械布局三视图 / Three Views', '映射为 three_view，图片占位符会替换成系统保存的布局图');
  accentRail(slide, '04');
  imageSlot(slide, 'front_view', '正视图', 0.86, 1.45, 3.72, 3.15);
  imageSlot(slide, 'side_view', '侧视图', 4.88, 1.45, 3.72, 3.15);
  imageSlot(slide, 'top_view', '俯视图', 8.9, 1.45, 3.72, 3.15);
  rect(slide, 0.86, 4.94, 11.76, 1.18, 'F7FAFC', 'DCE6F2');
  metric(slide, '布局尺寸', '{{ws_layout_size}}', 1.16, 5.12, 2.5, C.navy);
  metric(slide, '工位相机', '{{ws_camera_count}}', 4.05, 5.12, 2.25, C.blue);
  metric(slide, '项目镜头', '{{lens_count}}', 6.68, 5.12, 2.25, C.cyan);
  metric(slide, '项目光源', '{{light_count}}', 9.31, 5.12, 2.25, C.orange);
  addFooter(slide, 5);
}

function slideTechnical() {
  const slide = pptx.addSlide();
  slide.background = { color: 'F7FAFC' };
  addHeader(slide, '05', '技术要求 / Technical Requirements', '映射为 technical_requirements，沉淀检测目标、运动方式与风险点');
  accentRail(slide, '05');
  rect(slide, 0.86, 1.32, 5.34, 4.74, C.white, 'DCE6F2');
  tx(slide, '检测目标', 1.12, 1.62, 1.0, 0.22, { fontSize: 12, bold: true, color: C.navy });
  tx(slide, '{{observation_target}}', 1.12, 2.0, 4.58, 0.66, { fontSize: 14, bold: true, color: C.ink, valign: 'top' });
  line(slide, 1.12, 2.86, 5.74, 2.86, 'DCE6F2', 0.7);
  tx(slide, '运动/检测方式', 1.12, 3.14, 1.5, 0.22, { fontSize: 12, bold: true, color: C.navy });
  tx(slide, '{{motion_description}}', 1.12, 3.52, 4.58, 0.74, { fontSize: 11, color: C.ink, valign: 'top' });
  tx(slide, '风险备注', 1.12, 4.66, 0.9, 0.22, { fontSize: 12, bold: true, color: C.navy });
  tx(slide, '{{risk_notes}}', 1.12, 5.02, 4.58, 0.56, { fontSize: 10, color: C.muted, valign: 'top' });
  rect(slide, 6.56, 1.32, 5.86, 4.74, C.navy, C.navy);
  tx(slide, '模块检测清单', 6.9, 1.62, 2.0, 0.24, { fontSize: 13, bold: true, color: C.white });
  tx(
    slide,
    '{{#modules}}• {{mod_index}}  {{mod_name}}\n  类型：{{mod_type_label}} / ROI：{{mod_roi_strategy}} / 处理上限：{{mod_processing_time}}ms\n{{/modules}}',
    6.9,
    2.1,
    4.95,
    3.45,
    { fontSize: 9.2, color: 'EAF2FA', valign: 'top' },
  );
  addFooter(slide, 6);
}

function slideOptical() {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addHeader(slide, '06', '光学方案 / Optical Solution', '映射为 optical_solution，展示相机、镜头、光源与控制器清单');
  accentRail(slide, '06');
  metric(slide, '相机', '{{camera_count}}', 0.88, 1.32, 2.04, C.blue);
  metric(slide, '镜头', '{{lens_count}}', 3.16, 1.32, 2.04, C.cyan);
  metric(slide, '光源', '{{light_count}}', 5.44, 1.32, 2.04, C.orange);
  metric(slide, '控制器', '{{controller_count}}', 7.72, 1.32, 2.04, C.navy);
  rect(slide, 10.3, 1.2, 1.92, 1.44, C.navy, C.navy);
  tx(slide, '工位相机\n{{ws_camera_count}}', 10.58, 1.54, 1.36, 0.42, { fontSize: 14, bold: true, color: C.white, align: 'center' });
  rect(slide, 0.88, 3.02, 5.52, 2.92, 'F7FAFC', 'DCE6F2');
  tx(slide, '相机 / 镜头', 1.12, 3.28, 1.28, 0.22, { fontSize: 12, bold: true, color: C.navy });
  tx(
    slide,
    '{{#hardware.cameras}}相机 {{index}}｜{{brand}} {{model}}｜{{resolution}}｜{{interface}}\n{{/hardware.cameras}}\n{{#hardware.lenses}}镜头 {{index}}｜{{brand}} {{model}}｜{{focal_length}}｜{{mount}}\n{{/hardware.lenses}}',
    1.12,
    3.72,
    4.82,
    1.72,
    { fontSize: 8.2, color: C.ink, valign: 'top' },
  );
  rect(slide, 6.78, 3.02, 5.52, 2.92, 'F7FAFC', 'DCE6F2');
  tx(slide, '光源 / 控制器', 7.02, 3.28, 1.48, 0.22, { fontSize: 12, bold: true, color: C.navy });
  tx(
    slide,
    '{{#hardware.lights}}光源 {{index}}｜{{brand}} {{model}}｜{{type}}｜{{color}}\n{{/hardware.lights}}\n{{#hardware.controllers}}控制器 {{index}}｜{{brand}} {{model}}｜{{cpu}}｜{{memory}}\n{{/hardware.controllers}}',
    7.02,
    3.72,
    4.82,
    1.72,
    { fontSize: 8.2, color: C.ink, valign: 'top' },
  );
  addFooter(slide, 7);
}

function slideBom() {
  const slide = pptx.addSlide();
  slide.background = { color: 'F7FAFC' };
  addHeader(slide, '07', 'BOM 清单 / Global Hardware', '全局页不参与工位复制，直接替换项目硬件循环字段');
  accentRail(slide, '07');
  rect(slide, 0.86, 1.22, 11.72, 4.98, C.white, 'DCE6F2');
  tx(slide, '硬件总览', 1.12, 1.48, 1.3, 0.24, { fontSize: 13, bold: true, color: C.navy });
  tx(
    slide,
    '{{#hardware.cameras}}相机 {{index}}｜{{brand}} {{model}}｜{{resolution}}｜{{sensor_size}}｜{{interface}}\n{{/hardware.cameras}}\n{{#hardware.lenses}}镜头 {{index}}｜{{brand}} {{model}}｜{{focal_length}}｜{{mount}}\n{{/hardware.lenses}}\n{{#hardware.lights}}光源 {{index}}｜{{brand}} {{model}}｜{{type}}｜{{color}}\n{{/hardware.lights}}\n{{#hardware.controllers}}控制器 {{index}}｜{{brand}} {{model}}｜{{cpu}}｜{{memory}}\n{{/hardware.controllers}}',
    1.18,
    2.02,
    10.82,
    3.42,
    { fontSize: 9, color: C.ink, valign: 'top' },
  );
  rect(slide, 1.12, 5.6, 10.9, 0.34, C.pale, 'DCE6F2');
  tx(slide, '本页保留未映射，生成时只输出一次；工位页由第 3-7 页映射复制。', 1.3, 5.7, 10.45, 0.14, { fontSize: 8.2, color: C.muted, align: 'center' });
  addFooter(slide, 8);
}

function slideClose() {
  const slide = pptx.addSlide();
  slide.background = { color: C.dark };
  if (fs.existsSync(techTexture)) slide.addImage({ path: techTexture, x: 8.1, y: 0, w: 5.23, h: 4.2, transparency: 8 });
  rect(slide, 0.0, 0.0, W, H, C.dark, C.dark, { transparency: 2 });
  addLogo(slide);
  tx(slide, '真诚  实干  共进  互赢', 0.86, 1.42, 5.2, 0.38, { fontSize: 21, bold: true, color: C.white });
  tx(slide, 'Core technical competence', 0.9, 1.92, 3.8, 0.22, { fontSize: 10, color: '7EA6D6' });
  tx(slide, '谢谢观看', 0.88, 3.35, 2.5, 0.44, { fontSize: 30, bold: true, color: C.white });
  tx(slide, '{{project_name}}', 0.9, 4.0, 5.7, 0.34, { fontSize: 17, color: 'D9EAF7' });
  tx(slide, '生成日期：{{generated_date}}', 0.92, 4.48, 2.9, 0.2, { fontSize: 9.5, color: 'AFC8E4' });
  line(slide, 0.92, 5.08, 5.38, 5.08, C.orange, 2);
  tx(slide, '苏州德星云智能装备有限公司', 0.92, 5.38, 3.8, 0.22, { fontSize: 10, color: C.white });
}

slideCover();
slideOverview();
slideWorkstationBasic();
slideProduct();
slideThreeView();
slideTechnical();
slideOptical();
slideBom();
slideClose();

await pptx.writeFile({ fileName: PPTX_PATH });

const zip = await JSZip.loadAsync(fs.readFileSync(PPTX_PATH));
const slideFiles = Object.keys(zip.files)
  .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
  .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1] || 0) - Number(b.match(/slide(\d+)/)?.[1] || 0));

const textFields = new Set();
const parsedSlides = [];
for (const [idx, slidePath] of slideFiles.entries()) {
  const xml = await zip.file(slidePath).async('string');
  const fields = new Set();
  const imgFields = new Set();
  for (const match of xml.matchAll(/{{\s*([^{}]+?)\s*}}/g)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('/')) continue;
    if (raw.startsWith('img:')) imgFields.add(raw);
    else {
      fields.add(raw);
      textFields.add(raw);
    }
  }
  const title = knownSlideTitles[idx] || [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((m) => decodeXml(m[1]))
    .find((t) => t && !t.includes('{{')) || '';
  parsedSlides.push({
    index: idx,
    detectedType: idx === 0 ? 'cover' : idx === 1 ? 'overview' : idx === 7 ? 'bom' : idx === 8 ? 'closing' : 'content',
    detectedRole: idx === 0 ? 'cover' : idx === 1 ? 'content' : idx === 7 ? 'content' : 'content',
    title,
    customFields: [...fields, ...imgFields],
  });
}

const structureMeta = {
  sections: ['cover', 'overview', 'workstation_info', 'workstation_annotation', 'layout_views', 'module_target', 'bom'],
  layoutMapping,
  parsedSlides,
  customFields: [...textFields],
  fieldMappings: [...textFields].map((field) => ({ templateField: field, systemField: field })),
  roleSummary: { cover: 1, content: slideFiles.length - 1 },
  generatedBy: 'scripts/create-upload-template.mjs',
  parsedAt: new Date().toISOString(),
};

fs.writeFileSync(META_PATH, `${JSON.stringify(structureMeta, null, 2)}\n`, 'utf8');
console.log(`Wrote ${PPTX_PATH}`);
console.log(`Wrote ${META_PATH}`);

function decodeXml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
