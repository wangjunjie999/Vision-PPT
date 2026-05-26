import type { Annotation } from '@/components/product/AnnotationCanvas';
import type { ImageTransform } from '@/components/product/AnnotationCanvas';

/**
 * Render annotations onto an image and return the composited PNG blob.
 * Coordinates in annotations are percentage-based (0-100).
 * If a transform is supplied the output will bake rotation/flip into the image.
 */
export async function renderAnnotationsToCanvas(
  imageUrl: string,
  annotations: Annotation[],
  transform?: ImageTransform
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const rotation = transform?.rotation ?? 0;
  const flipH = transform?.flipH ?? false;
  const flipV = transform?.flipV ?? false;
  const isSwapped = rotation === 90 || rotation === 270;

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const outW = isSwapped ? srcH : srcW;
  const outH = isSwapped ? srcW : srcH;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;

  // Apply transform to the canvas context
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (flipH) ctx.scale(-1, 1);
  if (flipV) ctx.scale(1, -1);
  ctx.drawImage(img, -srcW / 2, -srcH / 2);
  ctx.restore();

  // Draw annotations in the output coordinate space
  // Annotation coords are percentages of the ORIGINAL image, so we need
  // to map them through the same transform to the output space.
  const scale = Math.max(1, Math.min(outW, outH) / 800);

  for (const ann of annotations) {
    // Convert percentage to original-image pixels
    let px = (ann.x / 100) * srcW;
    let py = (ann.y / 100) * srcH;

    // Apply transform: flip → rotate
    if (flipH) px = srcW - px;
    if (flipV) py = srcH - py;

    // Rotate around center of original image
    const cx = srcW / 2;
    const cy = srcH / 2;
    const rad = (rotation * Math.PI) / 180;
    const rx = (px - cx) * Math.cos(rad) - (py - cy) * Math.sin(rad);
    const ry = (px - cx) * Math.sin(rad) + (py - cy) * Math.cos(rad);
    px = rx + outW / 2;
    py = ry + outH / 2;

    switch (ann.type) {
      case 'point': {
        const r = 6 * scale;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = 'hsl(221, 83%, 53%)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
        break;
      }

      case 'number': {
        const r = 10 * scale;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = 'hsl(221, 83%, 53%)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${10 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ann.number || ''), px, py);
        break;
      }

      case 'rect': {
        const rw = ((ann.width || 0) / 100) * srcW;
        const rh = ((ann.height || 0) / 100) * srcH;

        // Transform the four corners and draw the rect
        // For simplicity with axis-aligned rects after 90° rotations:
        let ex = ((ann.x + (ann.width || 0)) / 100) * srcW;
        let ey = ((ann.y + (ann.height || 0)) / 100) * srcH;
        let sx = (ann.x / 100) * srcW;
        let sy = (ann.y / 100) * srcH;

        if (flipH) { sx = srcW - sx; ex = srcW - ex; }
        if (flipV) { sy = srcH - sy; ey = srcH - ey; }

        // Rotate both corners
        const transformPt = (x: number, y: number) => {
          const dx = x - cx;
          const dy = y - cy;
          return {
            x: dx * Math.cos(rad) - dy * Math.sin(rad) + outW / 2,
            y: dx * Math.sin(rad) + dy * Math.cos(rad) + outH / 2,
          };
        };
        const p1 = transformPt(sx, sy);
        const p2 = transformPt(ex, ey);

        const rx2 = Math.min(p1.x, p2.x);
        const ry2 = Math.min(p1.y, p2.y);
        const rwt = Math.abs(p2.x - p1.x);
        const rht = Math.abs(p2.y - p1.y);

        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(rx2, ry2, rwt, rht);
        ctx.strokeStyle = 'hsl(221, 83%, 53%)';
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(rx2, ry2, rwt, rht);
        break;
      }

      case 'arrow': {
        let epx = ((ann.endX || ann.x) / 100) * srcW;
        let epy = ((ann.endY || ann.y) / 100) * srcH;
        if (flipH) epx = srcW - epx;
        if (flipV) epy = srcH - epy;
        const erx = (epx - cx) * Math.cos(rad) - (epy - cy) * Math.sin(rad) + outW / 2;
        const ery = (epx - cx) * Math.sin(rad) + (epy - cy) * Math.cos(rad) + outH / 2;

        ctx.strokeStyle = 'hsl(221, 83%, 53%)';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(erx, ery);
        ctx.stroke();
        const angle = Math.atan2(ery - py, erx - px);
        const headLen = 12 * scale;
        ctx.beginPath();
        ctx.moveTo(erx, ery);
        ctx.lineTo(erx - headLen * Math.cos(angle - Math.PI / 6), ery - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(erx - headLen * Math.cos(angle + Math.PI / 6), ery - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = 'hsl(221, 83%, 53%)';
        ctx.fill();
        break;
      }

      case 'text': {
        const text = ann.name || '文本';
        const fontSize = 12 * scale;
        ctx.font = `${fontSize}px sans-serif`;
        const tm = ctx.measureText(text);
        const pad = 4 * scale;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(px, py - fontSize - pad, tm.width + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, px + pad, py - fontSize);
        break;
      }
    }

    // Draw name label next to annotation (if has name and not text type)
    if (ann.name && ann.type !== 'text') {
      const fontSize = 11 * scale;
      ctx.font = `${fontSize}px sans-serif`;
      const tm = ctx.measureText(ann.name);
      const pad = 3 * scale;
      const labelX = px + 10 * scale;
      const labelY = py - 10 * scale;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(labelX, labelY - fontSize, tm.width + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(ann.name, labelX + pad, labelY - fontSize + pad);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png'
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
