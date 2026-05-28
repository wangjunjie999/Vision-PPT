/**
 * Localization labels for PPT slides
 */

// Module type translations
export const MODULE_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  ocr: { zh: '识别', en: 'Recognition' },
  measurement: { zh: '测量', en: 'Measurement' },
  positioning: { zh: '定位', en: 'Positioning' },
  defect: { zh: '检测', en: 'Inspection' },
  deeplearning: { zh: '深度学习（算法手段）', en: 'Deep Learning (Algorithm)' },
};

// Workstation type translations
export const WS_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  line: { zh: '线体', en: 'Line' },
  turntable: { zh: '转盘', en: 'Turntable' },
  robot: { zh: '机械手', en: 'Robot' },
  platform: { zh: '平台', en: 'Platform' },
};

// Trigger type translations
export const TRIGGER_LABELS: Record<string, { zh: string; en: string }> = {
  io: { zh: 'IO触发', en: 'IO Trigger' },
  encoder: { zh: '编码器', en: 'Encoder' },
  software: { zh: '软触发', en: 'Software' },
  continuous: { zh: '连续采集', en: 'Continuous' },
};

// Process stage translations
export const PROCESS_STAGE_LABELS: Record<string, { zh: string; en: string }> = {
  '上料': { zh: '上料', en: 'Loading' },
  '装配': { zh: '装配', en: 'Assembly' },
  '检测': { zh: '检测', en: 'Inspection' },
  '下线': { zh: '下线', en: 'Unloading' },
  '焊接': { zh: '焊接', en: 'Welding' },
  '涂装': { zh: '涂装', en: 'Coating' },
  '其他': { zh: '其他', en: 'Other' },
};

// Company info
export const COMPANY_NAME_ZH = '苏州德星云智能装备有限公司';
export const COMPANY_NAME_EN = 'SuZhou DXY Intelligent Solution Co.,Ltd';

// Color scheme - Tech-Shine corporate style (德星云智能企业风格)
// 科技正蓝 + 纯白背景 + 纯黑主文字
export const COLORS = {
  primary: '003D7A',      // 深蓝色 - 主视觉标识色
  secondary: '003D7A',    // 深蓝色 - 章节数字/标题栏
  accent: '003D7A',       // 深蓝色 - 板块标头
  warning: 'F5A623',      // Warm orange (暖橙色)
  destructive: 'D93025',  // Red (红色)
  background: 'FFFFFF',   // 纯白色 - 通用背景色
  dark: '000000',         // 纯黑色 - 主文字色
  white: 'FFFFFF',        // White
  border: 'E6E6E6',       // 浅灰色 - 分隔/线条色
  lightGray: 'F5F5F5',    // Light gray for backgrounds (浅灰背景)
  textPrimary: '000000',  // 纯黑色 - 标题/技术参数/核心文字
  textSecondary: '333333', // 深灰色 - 次要文字/辅助说明
};

// Font constants - 微软雅黑
export const FONTS = {
  heading: 'Microsoft YaHei',
  body: 'Microsoft YaHei',
};

/**
 * MASTER_SLIDE 浅色横条上的白字副标题（叠在 public/ppt-covers/tech-shine-bg.png 上）。
 * 若与背景条带未对齐，仅调整 y / h。
 */
export const MASTER_SLIDE_SUBTITLE = {
  y: 0.55,
  h: 0.22,
  fontSize: 13,
  fontFace: FONTS.body,
  color: COLORS.white,
  align: 'center' as const,
  valign: 'middle' as const,
  bold: false,
  italic: false,
} as const;

export const MASTER_SLIDE_TITLE = {
  x: 0.4,
  y: 0.14,
  w: 7.5,
  h: 0.38,
  fontSize: 16,
  fontFace: FONTS.heading,
  color: COLORS.primary,
  bold: true,
  italic: false,
} as const;

// Heading shadow effect for primary titles
// IMPORTANT: Use factory function to avoid PptxGenJS mutating shared object
export const createHeadingShadow = () => ({
  type: 'outer' as const,
  blur: 3,
  offset: 2,
  angle: 45,
  color: '000000',
  opacity: 0.4,
});

// 16:9 Slide Layout Constants
export const SLIDE_LAYOUT = {
  name: 'LAYOUT_16x9' as const,
  width: 10,        // inches
  height: 5.625,    // inches (16:9 ratio)
  margin: {
    top: 0.55,
    bottom: 0.3,
    left: 0.4,
    right: 0.4,
  },
  get contentTop() { return this.margin.top; },
  get contentBottom() { return this.height - this.margin.bottom; },
  get contentHeight() { return this.contentBottom - this.contentTop; },
  get contentWidth() { return this.width - this.margin.left - this.margin.right; },
  get contentLeft() { return this.margin.left; },
  get contentRight() { return this.width - this.margin.right; },
};

// Helper functions
export const getWorkstationCode = (
  projectCode: string,
  wsIndex: number,
  wsCode?: string | null,
): string => {
  if (wsCode && wsCode.trim()) return wsCode.trim();
  return `${projectCode}.${String(wsIndex + 1).padStart(2, '0')}`;
};

export const getModuleDisplayName = (wsCode: string, moduleType: string, isZh: boolean): string => {
  const typeLabel = MODULE_TYPE_LABELS[moduleType]?.[isZh ? 'zh' : 'en'] || moduleType;
  return `${wsCode}-${typeLabel}`;
};
