import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
    store: {
        viewerAssetData: {
            modelUrl: 'https://example.com/demo.glb',
            imageUrls: [] as string[],
            assetId: 'asset-1',
            scope: 'workstation' as const,
            preferredDisplayMode: 'auto' as const,
        },
        exitViewerMode: vi.fn(),
        enterAnnotationMode: vi.fn(),
        transitionViewerToAnnotation: vi.fn(),
    },
    data: {
        selectedWorkstationId: 'ws-data',
    },
    viewerHandle: {
        takeScreenshot: vi.fn<() => Promise<string | null>>(),
        canTakeScreenshot: vi.fn<() => boolean>(),
        getStatus: vi.fn<() => 'ready' | 'loading' | 'unsupported'>(),
    },
    validateSnapshot: vi.fn<(url: string) => Promise<boolean>>(),
}));

vi.mock('@/utils/productViewer', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/utils/productViewer')>();
    return {
        ...actual,
        validateAnnotationSnapshot: (url: string) => mocks.validateSnapshot(url),
    };
});

import { ProductViewerCanvas } from './ProductViewerCanvas';

vi.mock('@/store/useAppStore', () => ({
    useAppStore: () => mocks.store,
}));

vi.mock('@/contexts/DataContext', () => ({
    useData: () => mocks.data,
}));

vi.mock('sonner', () => ({
    toast: mocks.toast,
}));

vi.mock('@/components/product/Product3DViewer', async () => {
    const ReactModule = await import('react');

    return {
        Product3DViewer: ({ onReady }: { onReady?: (handle: typeof mocks.viewerHandle) => void }) => {
            ReactModule.useEffect(() => {
                onReady?.(mocks.viewerHandle);
            }, [onReady]);

            return <div data-testid="mock-product-viewer">viewer</div>;
        },
    };
});

describe('ProductViewerCanvas', () => {
    beforeEach(() => {
        mocks.toast.success.mockReset();
        mocks.toast.error.mockReset();
        mocks.store.exitViewerMode.mockReset();
        mocks.store.enterAnnotationMode.mockReset();
        mocks.store.transitionViewerToAnnotation.mockReset();
        mocks.viewerHandle.takeScreenshot.mockReset();
        mocks.viewerHandle.canTakeScreenshot.mockReset();
        mocks.viewerHandle.getStatus.mockReset();
        mocks.validateSnapshot.mockReset();
        mocks.validateSnapshot.mockResolvedValue(true);

        mocks.store.viewerAssetData = {
            modelUrl: 'https://example.com/demo.glb',
            imageUrls: [],
            assetId: 'asset-1',
            scope: 'workstation',
            preferredDisplayMode: 'auto',
        };
        mocks.data.selectedWorkstationId = 'ws-data';
    });

    it('在 3D 模型未完成渲染时阻止截图', () => {
        mocks.viewerHandle.getStatus.mockReturnValue('loading');
        mocks.viewerHandle.canTakeScreenshot.mockReturnValue(false);

        render(<ProductViewerCanvas />);
        fireEvent.click(screen.getByRole('button', { name: '截图并标注' }));

        expect(mocks.toast.error).toHaveBeenCalledWith('3D 模型仍在加载，请稍后再试');
        expect(mocks.store.enterAnnotationMode).not.toHaveBeenCalled();
    });

    it('截图成功后使用当前工位上下文进入标注模式', async () => {
        const snapshot = `data:image/png;base64,${'a'.repeat(3000)}`;
        mocks.viewerHandle.getStatus.mockReturnValue('ready');
        mocks.viewerHandle.canTakeScreenshot.mockReturnValue(true);
        mocks.viewerHandle.takeScreenshot.mockResolvedValue(snapshot);

        render(<ProductViewerCanvas />);
        fireEvent.click(screen.getByRole('button', { name: '截图并标注' }));

        await waitFor(() => {
            expect(mocks.store.transitionViewerToAnnotation).toHaveBeenCalledWith(
                snapshot,
                'asset-1',
                'workstation',
                'ws-data'
            );
        });
        expect(mocks.store.exitViewerMode).not.toHaveBeenCalled();
        expect(mocks.store.enterAnnotationMode).not.toHaveBeenCalled();
        expect(mocks.toast.success).toHaveBeenCalledWith('已进入标注模式');
        expect(mocks.validateSnapshot).toHaveBeenCalled();
    });

    it('图片校验失败时不进入标注模式', async () => {
        const snapshot = `data:image/png;base64,${'a'.repeat(3000)}`;
        mocks.validateSnapshot.mockResolvedValue(false);
        mocks.viewerHandle.getStatus.mockReturnValue('ready');
        mocks.viewerHandle.canTakeScreenshot.mockReturnValue(true);
        mocks.viewerHandle.takeScreenshot.mockResolvedValue(snapshot);

        render(<ProductViewerCanvas />);
        fireEvent.click(screen.getByRole('button', { name: '截图并标注' }));

        await waitFor(() => {
            expect(mocks.toast.error).toHaveBeenCalled();
        });
        expect(mocks.store.transitionViewerToAnnotation).not.toHaveBeenCalled();
    });

    it('3D 模式下截图无效时不使用预览图回退', async () => {
        mocks.store.viewerAssetData = {
            modelUrl: 'https://example.com/demo.glb',
            imageUrls: ['https://example.com/fallback.png'],
            assetId: 'asset-3',
            scope: 'workstation',
            preferredDisplayMode: 'auto',
        };
        mocks.viewerHandle.getStatus.mockReturnValue('ready');
        mocks.viewerHandle.canTakeScreenshot.mockReturnValue(true);
        mocks.viewerHandle.takeScreenshot.mockResolvedValue('data:image/png;base64,short');

        render(<ProductViewerCanvas />);
        fireEvent.click(screen.getByRole('button', { name: '截图并标注' }));

        await waitFor(() => {
            expect(mocks.toast.error).toHaveBeenCalledWith(
                '截图失败，请确认 GLB 模型已完整显示在当前视角'
            );
        });
        expect(mocks.store.transitionViewerToAnnotation).not.toHaveBeenCalled();
    });

    it('图片模式截图无效时回退到首张产品图片', async () => {
        mocks.store.viewerAssetData = {
            modelUrl: 'https://example.com/demo.glb',
            imageUrls: ['https://example.com/fallback.png'],
            assetId: 'asset-2',
            scope: 'workstation',
            preferredDisplayMode: 'image',
        };
        mocks.viewerHandle.getStatus.mockReturnValue('ready');
        mocks.viewerHandle.canTakeScreenshot.mockReturnValue(true);
        mocks.viewerHandle.takeScreenshot.mockResolvedValue('data:image/png;base64,short');

        render(<ProductViewerCanvas />);
        fireEvent.click(screen.getByRole('button', { name: '截图并标注' }));

        await waitFor(() => {
            expect(mocks.store.transitionViewerToAnnotation).toHaveBeenCalledWith(
                'https://example.com/fallback.png',
                'asset-2',
                'workstation',
                'ws-data'
            );
        });
    });
});
