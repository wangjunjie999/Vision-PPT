/**
 * Localization labels for PPT slides
 */

// Module type translations
export const MODULE_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  positioning: { zh: '定位检测', en: 'Positioning' },
  defect: { zh: '缺陷检测', en: 'Defect Detection' },
  ocr: { zh: 'OCR识别', en: 'OCR Recognition' },
  deeplearning: { zh: '深度学习', en: 'Deep Learning' },
  measurement: { zh: '尺寸测量', en: 'Measurement' },
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
// Orange accent + Dark gray text + Light gray background
export const COLORS = {
  primary: 'E85A1C',      // Tech-Shine orange (橙色主色)
  secondary: '5A6A7A',    // Medium gray (中灰色)
  accent: '0066B3',       // Blue accent (蓝色点缀)
  warning: 'F5A623',      // Warm orange (暖橙色)
  destructive: 'D93025',  // Red (红色)
  background: 'F5F5F5',   // Light gray background (浅灰背景)
  dark: '2D3A4A',         // Dark gray/blue (深灰蓝)
  white: 'FFFFFF',        // White
  border: 'D0D5DD',       // Border gray (边框灰)
  lightGray: 'E8EBEF',    // Light gray for cards (卡片背景)
  textPrimary: '1A1A1A',  // Primary text (主文字)
  textSecondary: '6B7280', // Secondary text (次要文字)
};

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
export const getWorkstationCode = (projectCode: string, wsIndex: number): string => {
  return `${projectCode}.${String(wsIndex + 1).padStart(2, '0')}`;
};

export const getModuleDisplayName = (wsCode: string, moduleType: string, isZh: boolean): string => {
  const typeLabel = MODULE_TYPE_LABELS[moduleType]?.[isZh ? 'zh' : 'en'] || moduleType;
  return `${wsCode}-${typeLabel}`;
};
