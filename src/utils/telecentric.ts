export const TELECENTRIC_TAG = '远心';

export interface TelecentricTaggable {
  tags?: string[] | null;
}

/** 判断硬件（相机/镜头）是否为远心型号：复用 tags 中的「远心」标记 */
export function isTelecentricHardware(item: TelecentricTaggable | null | undefined): boolean {
  if (!item || !Array.isArray(item.tags)) return false;
  return item.tags.some(tag => typeof tag === 'string' && tag.trim() === TELECENTRIC_TAG);
}

export function withTelecentricTag(tags: string[] | null | undefined, telecentric: boolean): string[] {
  const base = (Array.isArray(tags) ? tags : []).filter(tag => tag.trim() !== TELECENTRIC_TAG);
  return telecentric ? [TELECENTRIC_TAG, ...base] : base;
}

/** 远心：焦距 -> 工作距离，光圈 -> 放大倍率 */
export function getOpticalFieldLabels(telecentric: boolean) {
  return telecentric
    ? {
        focalLabel: '工作距离',
        apertureLabel: '放大倍率',
        focalPlaceholder: '如: 110mm',
        aperturePlaceholder: '如: 0.5X',
      }
    : {
        focalLabel: '焦距',
        apertureLabel: '光圈',
        focalPlaceholder: '如: 25mm',
        aperturePlaceholder: '如: F1.4',
      };
}