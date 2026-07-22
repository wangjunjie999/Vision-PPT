import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DragDropUpload } from './DragDropUpload';

function makeFiles(count: number): File[] {
  return Array.from(
    { length: count },
    (_, index) => new File([`image-${index}`], `image-${index}.png`, { type: 'image/png' }),
  );
}

describe('DragDropUpload file limits', () => {
  it('keeps the default five-file selection limit', async () => {
    const onUpload = vi.fn();
    const { container } = render(
      <DragDropUpload onUpload={onUpload} multiple showPreview={false} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: makeFiles(7) } });

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    expect(onUpload.mock.calls[0][0]).toHaveLength(5);
  });

  it('does not truncate a selection when maxFiles is null', async () => {
    const onUpload = vi.fn();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const { container } = render(
      <DragDropUpload onUpload={onUpload} multiple maxFiles={null} showPreview={false} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: makeFiles(8) } });

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    expect(onUpload.mock.calls[0][0]).toHaveLength(8);
    expect(createObjectURL).not.toHaveBeenCalled();
    createObjectURL.mockRestore();
  });
});
