import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

function resetCanvasModes() {
  useAppStore.setState({
    annotationMode: false,
    annotationSnapshot: null,
    annotationAssetId: null,
    annotationScope: 'workstation',
    annotationWorkstationId: null,
    annotationExistingData: null,
    viewerMode: false,
    viewerAssetData: null,
  });
}

describe('useAppStore canvas modes', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCanvasModes();
  });

  it('clears annotation state when entering viewer mode', () => {
    const store = useAppStore.getState();

    store.enterAnnotationMode('https://example.com/shot.png', 'asset-old', 'workstation', 'ws-1');
    useAppStore.getState().enterViewerMode(
      'https://example.com/model.glb',
      ['https://example.com/a.png', 'https://example.com/b.png'],
      'asset-new',
      'workstation',
      'model'
    );

    const state = useAppStore.getState();
    expect(state.viewerMode).toBe(true);
    expect(state.viewerAssetData).toEqual({
      modelUrl: 'https://example.com/model.glb',
      imageUrls: ['https://example.com/a.png'],
      assetId: 'asset-new',
      scope: 'workstation',
      preferredDisplayMode: 'model',
    });
    expect(state.annotationMode).toBe(false);
    expect(state.annotationSnapshot).toBeNull();
    expect(state.annotationAssetId).toBeNull();
  });

  it('clears viewer state when entering annotation mode', () => {
    const store = useAppStore.getState();

    store.enterViewerMode(
      null,
      ['https://example.com/product.png'],
      'asset-image',
      'workstation',
      'image'
    );
    useAppStore.getState().enterAnnotationMode(
      'https://example.com/annotated.png',
      'asset-image',
      'workstation',
      'ws-1'
    );

    const state = useAppStore.getState();
    expect(state.annotationMode).toBe(true);
    expect(state.annotationSnapshot).toBe('https://example.com/annotated.png');
    expect(state.viewerMode).toBe(false);
    expect(state.viewerAssetData).toBeNull();
  });
});
