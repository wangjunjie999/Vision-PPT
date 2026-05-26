import * as THREE from 'three';

export const DEFAULT_CAPTURE_MAX_EDGE = 2200;

/** Heuristic: tiny data URLs are almost certainly failed / empty captures */
export const MIN_MEANINGFUL_CAPTURE_DATA_URL_LENGTH = 2048;

/** Flip WebGL bottom-left origin rows to top-left (canvas / ImageData) order. */
export function flipWebGLRowsToTopLeft(
  pixels: Uint8Array,
  width: number,
  height: number
): Uint8ClampedArray {
  const rowStride = width * 4;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const srcRow = (height - 1 - y) * rowStride;
    out.set(pixels.subarray(srcRow, srcRow + rowStride), y * rowStride);
  }
  return out;
}

/** Flip WebGL bottom-left origin pixel buffer to top-left ImageData row order. */
export function flipWebGLPixelsToImageData(
  pixels: Uint8Array,
  width: number,
  height: number
): ImageData {
  const out = flipWebGLRowsToTopLeft(pixels, width, height);
  return new ImageData(new Uint8ClampedArray(out.buffer as ArrayBuffer), width, height);
}

/** True if readback likely succeeded: any pixel with non-zero alpha (incl. pure black RGB). */
export function isCapturePixelsNonEmpty(pixels: Uint8Array): boolean {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] !== 0) {
      return true;
    }
  }
  return false;
}

function downscaleImageDataToCanvas(
  imageData: ImageData,
  maxEdge: number
): HTMLCanvasElement {
  const { width: w, height: h } = imageData;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const sctx = srcCanvas.getContext('2d');
  if (!sctx) {
    throw new Error('2d context unavailable');
  }
  sctx.putImageData(imageData, 0, 0);

  if (scale >= 0.999) {
    return srcCanvas;
  }

  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  const octx = out.getContext('2d', { alpha: true });
  if (!octx) {
    throw new Error('2d context unavailable');
  }
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(srcCanvas, 0, 0, tw, th);
  return out;
}

/**
 * Snapshot the WebGL canvas after a frame was rendered to the default framebuffer.
 * Matches on-screen color management (sRGB output + tone mapping). May throw on tainted canvas.
 */
function snapshotDomElementToDataUrl(renderer: THREE.WebGLRenderer, maxEdge: number): string | null {
  const src = renderer.domElement;
  const width = src.width;
  const height = src.height;
  if (!width || !height) return null;

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.max(1, Math.round(width * scale));
  exportCanvas.height = Math.max(1, Math.round(height * scale));
  const ctx = exportCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(src, 0, 0, exportCanvas.width, exportCanvas.height);
  return exportCanvas.toDataURL('image/png');
}

function captureDomElementFallback(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  maxEdge: number,
  beforeRender?: () => void
): string | null {
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  beforeRender?.();
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  try {
    return snapshotDomElementToDataUrl(renderer, maxEdge);
  } catch (err) {
    console.warn('Screenshot domElement fallback toDataURL failed:', err);
    return null;
  }
}

/** PNG from the WebGL backing store as last composited (requires preserveDrawingBuffer on GL). */
function trySnapshotPresentedFrame(renderer: THREE.WebGLRenderer, maxEdge: number): string | null {
  try {
    const dom = snapshotDomElementToDataUrl(renderer, maxEdge);
    if (dom && dom.length > MIN_MEANINGFUL_CAPTURE_DATA_URL_LENGTH) return dom;
  } catch (err) {
    console.warn('Screenshot presented-frame snapshot failed:', err);
  }
  return null;
}

/**
 * Captures the current frame as PNG data URL.
 * 1) Tries the **already presented** framebuffer (no extra render / OrbitControls.update) so the PNG
 *    matches what the user sees — rerendering advances damping and shifts the camera.
 * 2) Otherwise renders to the default framebuffer + snapshot (sRGB, tone mapping like the canvas).
 * 3) Falls back to readRenderTargetPixels when needed.
 */
export function captureWebGLFrameToDataUrl(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options?: {
    maxEdge?: number;
    beforeRender?: () => void;
  }
): string | null {
  const maxEdge = options?.maxEdge ?? DEFAULT_CAPTURE_MAX_EDGE;
  const beforeRender = options?.beforeRender;

  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  if (!w || !h) {
    return null;
  }

  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  let result: string | null = null;

  try {
    result = trySnapshotPresentedFrame(renderer, maxEdge);

    if (!result) {
      renderer.autoClear = true;
      renderer.setRenderTarget(null);
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
        camera.updateProjectionMatrix();
      }
      beforeRender?.();
      renderer.render(scene, camera);

      try {
        const dom = snapshotDomElementToDataUrl(renderer, maxEdge);
        if (dom && dom.length > MIN_MEANINGFUL_CAPTURE_DATA_URL_LENGTH) {
          result = dom;
        }
      } catch (err) {
        console.warn('Screenshot domElement capture failed (will try render target):', err);
      }
    }

    if (!result) {
      const rt = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false,
        colorSpace: renderer.outputColorSpace,
      });

      try {
        beforeRender?.();
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);

        const pixels = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels);

        if (!isCapturePixelsNonEmpty(pixels)) {
          renderer.setRenderTarget(null);
          renderer.autoClear = prevAutoClear;
          result = captureDomElementFallback(renderer, scene, camera, maxEdge, beforeRender);
        } else {
          const imageData = flipWebGLPixelsToImageData(pixels, w, h);
          const exportCanvas = downscaleImageDataToCanvas(imageData, maxEdge);
          try {
            result = exportCanvas.toDataURL('image/png');
          } catch {
            renderer.setRenderTarget(null);
            renderer.autoClear = prevAutoClear;
            result = captureDomElementFallback(renderer, scene, camera, maxEdge, beforeRender);
          }
        }
      } catch (err) {
        console.warn('WebGL render-target capture failed, trying fallback:', err);
        renderer.setRenderTarget(null);
        renderer.autoClear = prevAutoClear;
        result = captureDomElementFallback(renderer, scene, camera, maxEdge, beforeRender);
      } finally {
        renderer.setRenderTarget(null);
        rt.dispose();
      }
    }
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
    renderer.render(scene, camera);
  }

  return result;
}
