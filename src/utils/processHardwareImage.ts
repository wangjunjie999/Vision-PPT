/**
 * Client-side hardware product image processing: trim near-uniform borders
 * and make near-background pixels transparent, then export PNG for upload.
 * Falls back to the original file on error or unreasonable output size.
 */

const MAX_PROCESS_EDGE = 2048;
/** Original file must stay within validateImageFile limit (5MB); output PNG cap */
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
/** Pixel considered "content" vs estimated background (Euclidean RGB distance) */
const COLOR_DIST_CONTENT = 38;
/** Pixels at or below this distance from background become fully transparent */
const COLOR_DIST_ALPHA = 48;
const PADDING_PX = 8;
/** If foreground bbox covers less than this fraction of area, skip crop (likely noise) */
const MIN_CONTENT_RATIO = 0.025;
/** If bbox covers more than this of the image, skip crop (already tight) */
const MAX_CROP_COVERAGE = 0.97;

function colorDistance(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number
): number {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function estimateBackground(data: ImageData, w: number, h: number): { r: number; g: number; b: number } {
  const d = data.data;
  const sample = (sx: number, sy: number) => {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const x = Math.min(sx + dx, w - 1);
        const y = Math.min(sy + dy, h - 1);
        const i = (y * w + x) * 4;
        sr += d[i];
        sg += d[i + 1];
        sb += d[i + 2];
        n++;
      }
    }
    return { r: sr / n, g: sg / n, b: sb / n };
  }
  const c1 = sample(0, 0);
  const c2 = sample(Math.max(0, w - 3), 0);
  const c3 = sample(0, Math.max(0, h - 3));
  const c4 = sample(Math.max(0, w - 3), Math.max(0, h - 3));
  return {
    r: (c1.r + c2.r + c3.r + c4.r) / 4,
    g: (c1.g + c2.g + c3.g + c4.g) / 4,
    b: (c1.b + c2.b + c3.b + c4.b) / 4,
  };
}

function computeForegroundBounds(
  data: ImageData,
  w: number,
  h: number,
  br: number,
  bg: number,
  bb: number
): { minX: number; minY: number; maxX: number; maxY: number; count: number } | null {
  const d = data.data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dist = colorDistance(d[i], d[i + 1], d[i + 2], br, bg, bb);
      if (dist > COLOR_DIST_CONTENT) {
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count === 0 || maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, count };
}

function applyAlphaAndCopyRegion(
  src: ImageData,
  sw: number,
  sh: number,
  br: number,
  bg: number,
  bb: number,
  bx0: number,
  by0: number,
  bw: number,
  bh: number
): ImageData {
  const out = new ImageData(bw, bh);
  const s = src.data;
  const o = out.data;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const sx = bx0 + x;
      const sy = by0 + y;
      const si = (sy * sw + sx) * 4;
      const oi = (y * bw + x) * 4;
      const dist = colorDistance(s[si], s[si + 1], s[si + 2], br, bg, bb);
      if (dist <= COLOR_DIST_ALPHA) {
        o[oi] = 0;
        o[oi + 1] = 0;
        o[oi + 2] = 0;
        o[oi + 3] = 0;
      } else {
        o[oi] = s[si];
        o[oi + 1] = s[si + 1];
        o[oi + 2] = s[si + 2];
        o[oi + 3] = 255;
      }
    }
  }
  return out;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob failed'));
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Trim near-background border, remove near-background to transparent, export PNG.
 * On any failure or oversized output, returns the original `file` unchanged.
 */
export async function processHardwareImageForUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const ow = bitmap.width;
    const oh = bitmap.height;
    if (ow < 2 || oh < 2) {
      bitmap.close?.();
      return file;
    }

    const scale = Math.min(1, MAX_PROCESS_EDGE / Math.max(ow, oh));
    const sw = Math.max(1, Math.round(ow * scale));
    const sh = Math.max(1, Math.round(oh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, sw, sh);
    bitmap.close?.();

    let imageData = ctx.getImageData(0, 0, sw, sh);
    const bg = estimateBackground(imageData, sw, sh);
    const br = bg.r;
    const bgc = bg.g;
    const bb = bg.b;

    const bounds = computeForegroundBounds(imageData, sw, sh, br, bgc, bb);
    const totalPixels = sw * sh;
    const contentRatio = bounds ? bounds.count / totalPixels : 0;

    let bx0 = 0;
    let by0 = 0;
    let bw = sw;
    let bh = sh;

    if (
      bounds &&
      contentRatio >= MIN_CONTENT_RATIO &&
      bounds.count / totalPixels < MAX_CROP_COVERAGE
    ) {
      bx0 = Math.max(0, bounds.minX - PADDING_PX);
      by0 = Math.max(0, bounds.minY - PADDING_PX);
      bx0 = Math.min(bx0, sw - 1);
      by0 = Math.min(by0, sh - 1);
      let bx1 = Math.min(sw - 1, bounds.maxX + PADDING_PX);
      let by1 = Math.min(sh - 1, bounds.maxY + PADDING_PX);
      bw = bx1 - bx0 + 1;
      bh = by1 - by0 + 1;
      if (bw < 2 || bh < 2) {
        bx0 = 0;
        by0 = 0;
        bw = sw;
        bh = sh;
      }
    }

    const processed = applyAlphaAndCopyRegion(imageData, sw, sh, br, bgc, bb, bx0, by0, bw, bh);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = bw;
    outCanvas.height = bh;
    const octx = outCanvas.getContext('2d');
    if (!octx) return file;
    octx.putImageData(processed, 0, 0);

    const blob = await canvasToPngBlob(outCanvas);
    if (blob.size > MAX_OUTPUT_BYTES) {
      console.warn(
        '[processHardwareImage] Output exceeds size cap, using original file:',
        blob.size
      );
      return file;
    }

    const base = file.name.replace(/\.[^/.]+$/, '') || 'hardware';
    return new File([blob], `${base}-processed.png`, { type: 'image/png' });
  } catch (e) {
    console.warn('[processHardwareImage] Processing failed, using original file:', e);
    return file;
  }
}
