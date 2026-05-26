export const MIN_CANVAS_ZOOM = 0.25;
export const MAX_CANVAS_ZOOM = 3;
export const CANVAS_WHEEL_ZOOM_STEP = 0.1;
export const CANVAS_BUTTON_ZOOM_STEP = 0.25;

export function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, value));
}

export function getNextZoom(current: number, delta: number) {
  const next = clampZoom(current + delta);
  return Object.is(next, current) ? current : next;
}
