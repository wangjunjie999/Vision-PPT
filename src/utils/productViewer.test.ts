import { describe, it, expect } from 'vitest';
import {
    getProductModelExtension,
    isSupportedProductModelSource,
    isUsableAnnotationSnapshot,
    resolveAnnotationSnapshot,
    resolveProductViewerDisplayMode,
    resolveViewerAnnotationSnapshot,
} from './productViewer';

describe('productViewer utils', () => {
    it('识别带查询参数的 GLB/GLTF 模型地址', () => {
        expect(getProductModelExtension('https://example.com/model/demo.glb?version=1')).toBe('glb');
        expect(isSupportedProductModelSource('https://example.com/model/demo.gltf#preview')).toBe(true);
        expect(isSupportedProductModelSource('https://example.com/model/demo.obj')).toBe(false);
    });

    it('校验快照有效性并过滤空白 data url', () => {
        expect(isUsableAnnotationSnapshot(null)).toBe(false);
        expect(isUsableAnnotationSnapshot('data:image/png;base64,short')).toBe(false);
        expect(isUsableAnnotationSnapshot(`data:image/png;base64,${'a'.repeat(3000)}`)).toBe(true);
        expect(isUsableAnnotationSnapshot('https://example.com/snapshot.png')).toBe(true);
    });

    it('在截图失败时回退到第一张可用图片', () => {
        expect(resolveAnnotationSnapshot(null, ['https://example.com/fallback.png'])).toBe(
            'https://example.com/fallback.png'
        );
        expect(
            resolveAnnotationSnapshot('data:image/png;base64,short', ['https://example.com/fallback.png'])
        ).toBe('https://example.com/fallback.png');
    });

    it('当素材指定为图片模式时优先显示 2D 画面', () => {
        expect(
            resolveProductViewerDisplayMode(
                'image',
                'https://example.com/demo.glb',
                ['https://example.com/fallback.png']
            )
        ).toBe('image');
        expect(
            resolveProductViewerDisplayMode(
                'model',
                'https://example.com/demo.glb',
                ['https://example.com/fallback.png']
            )
        ).toBe('model');
    });

    it('resolveViewerAnnotationSnapshot 在 3D 模式下禁止预览图回退', () => {
        const fallback = ['https://example.com/fallback.png'];
        const opts = {
            preferredDisplayMode: 'auto' as const,
            modelUrl: 'https://example.com/demo.glb',
            imageUrls: fallback,
        };
        expect(resolveViewerAnnotationSnapshot(null, fallback, opts)).toBe(null);
        expect(
            resolveViewerAnnotationSnapshot('data:image/png;base64,short', fallback, opts)
        ).toBe(null);
    });

    it('resolveViewerAnnotationSnapshot 在图片模式下允许回退', () => {
        const fallback = ['https://example.com/fallback.png'];
        const opts = {
            preferredDisplayMode: 'image' as const,
            modelUrl: 'https://example.com/demo.glb',
            imageUrls: fallback,
        };
        expect(resolveViewerAnnotationSnapshot(null, fallback, opts)).toBe(fallback[0]);
    });
});
