import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LightingPhotosPanel } from './LightingPhotosPanel';

const storageMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn((path: string) => ({
    data: { publicUrl: `https://example.test/${path}` },
  })),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => storageMocks),
    },
  },
}));

vi.mock('sonner', () => ({ toast: toastMocks }));

function makeFiles(count: number): File[] {
  return Array.from(
    { length: count },
    (_, index) => new File([`image-${index}`], `lighting-${index}.png`, { type: 'image/png' }),
  );
}

describe('LightingPhotosPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.upload.mockResolvedValue({ error: null });
  });

  it('uploads and saves more than four photos while keeping the upload area available', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <LightingPhotosPanel
        moduleId="module-1"
        moduleName="外观检测"
        initialPhotos={[]}
        onSave={onSave}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: makeFiles(6) } });

    await waitFor(() => expect(storageMocks.upload).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(6));
    expect(screen.getAllByText(/不限制总张数/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toHaveLength(6);
  });

  it('keeps successful uploads when another file in the batch fails', async () => {
    storageMocks.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('upload failed') })
      .mockResolvedValueOnce({ error: null });
    const { container } = render(
      <LightingPhotosPanel
        moduleId="module-1"
        moduleName="外观检测"
        initialPhotos={[]}
        onSave={vi.fn()}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: makeFiles(3) } });

    await waitFor(() => expect(storageMocks.upload).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));
    expect(toastMocks.warning).toHaveBeenCalledWith('成功上传 2 张，失败 1 张');
  });
});
