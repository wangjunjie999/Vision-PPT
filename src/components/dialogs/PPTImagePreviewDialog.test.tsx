import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkstationProductAsset } from '@/lib/productLayoutSync';
import { PPTImagePreviewDialog } from './PPTImagePreviewDialog';

vi.mock('@/contexts/useData', () => ({
  useData: () => ({
    workstations: [{ id: 'ws-1', code: 'WS-1', name: 'Station A' }],
    modules: [],
    layouts: [],
  }),
}));

describe('PPTImagePreviewDialog product snapshot', () => {
  it('uses the supplied media snapshot and reports the same product pages and placeholders', () => {
    render(
      <PPTImagePreviewDialog
        open
        onOpenChange={vi.fn()}
        scope="workstations"
        workstationIds={['ws-1']}
        moduleIds={[]}
        productAssets={[
          {
            id: 'product-1',
            scope_type: 'workstation',
            workstation_id: 'ws-1',
            product_name: 'Annotated product',
            document_images_per_page: 1,
          },
          {
            id: 'product-2',
            scope_type: 'workstation',
            workstation_id: 'ws-1',
            product_name: 'Legacy product',
            preview_images: ['legacy.png'],
            document_images_per_page: 2,
          },
          {
            id: 'product-3',
            scope_type: 'workstation',
            workstation_id: 'ws-1',
            product_name: 'Empty product',
            document_images_per_page: 1,
          },
        ] as unknown as WorkstationProductAsset[]}
        productMedia={[{
          id: 'media-1',
          asset_id: 'product-1',
          original_url: 'original.png',
          file_name: 'original.png',
          sort_order: 0,
        }]}
        annotations={[{
          id: 'annotation-1',
          asset_id: 'product-1',
          media_id: 'media-1',
          snapshot_url: 'annotated.png',
          is_ppt_default: true,
        }]}
      />,
    );

    expect(screen.getByText('产品：3')).toBeInTheDocument();
    expect(screen.getByText('产品页：3')).toBeInTheDocument();
    expect(screen.getByText('占位页：1')).toBeInTheDocument();
    expect(screen.getAllByText('Empty product：未上传产品图片，将生成占位页')).toHaveLength(2);
    expect(document.querySelector('img[src="annotated.png"]')).toBeInTheDocument();
    expect(document.querySelector('img[src="legacy.png"]')).toBeInTheDocument();
  });

  it('keeps module-only scope free of workstation product pages', () => {
    render(
      <PPTImagePreviewDialog
        open
        onOpenChange={vi.fn()}
        scope="modules"
        workstationIds={['ws-1']}
        moduleIds={[]}
        productAssets={[]}
        productMedia={[]}
        annotations={[]}
      />,
    );

    expect(screen.getByText('产品：0')).toBeInTheDocument();
    expect(screen.getByText('产品页：0')).toBeInTheDocument();
    expect(screen.queryByText(/占位页：/)).not.toBeInTheDocument();
    expect(screen.queryByText('工位布局视图')).not.toBeInTheDocument();
  });
});
