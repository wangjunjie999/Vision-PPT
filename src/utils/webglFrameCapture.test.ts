import { describe, it, expect } from 'vitest';
import { flipWebGLRowsToTopLeft, isCapturePixelsNonEmpty } from './webglFrameCapture';

describe('webglFrameCapture', () => {
    it('flipWebGLRowsToTopLeft 垂直翻转各行', () => {
        const w = 2;
        const h = 2;
        const pixels = new Uint8Array(w * h * 4);
        pixels.set([255, 0, 0, 255], 0);
        pixels.set([255, 0, 0, 255], 4);
        pixels.set([0, 0, 255, 255], 8);
        pixels.set([0, 0, 255, 255], 12);

        const out = flipWebGLRowsToTopLeft(pixels, w, h);
        expect(Array.from(out.slice(0, 8))).toEqual([0, 0, 255, 255, 0, 0, 255, 255]);
        expect(Array.from(out.slice(8, 16))).toEqual([255, 0, 0, 255, 255, 0, 0, 255]);
    });

    it('isCapturePixelsNonEmpty 识别全零缓冲', () => {
        expect(isCapturePixelsNonEmpty(new Uint8Array(16))).toBe(false);
    });

    it('isCapturePixelsNonEmpty 识别非零 RGBA', () => {
        const p = new Uint8Array([10, 20, 30, 255]);
        expect(isCapturePixelsNonEmpty(p)).toBe(true);
    });

    it('isCapturePixelsNonEmpty 将纯黑不透明视为有效读回', () => {
        expect(isCapturePixelsNonEmpty(new Uint8Array([0, 0, 0, 255]))).toBe(true);
    });
});
