import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  storageFrom: vi.fn(),
  remove: vi.fn(),
  validate3DModelFile: vi.fn(),
  uploadStorageFile: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    storage: {
      from: mocks.storageFrom,
    },
  },
}));

vi.mock('./fileValidation', () => ({
  validate3DModelFile: mocks.validate3DModelFile,
}));

vi.mock('./storageUpload', () => ({
  uploadStorageFile: mocks.uploadStorageFile,
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
  },
}));

import { deleteGLBFile, uploadGLBFile } from './glbUpload';

describe('uploadGLBFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1779966855894);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mocks.validate3DModelFile.mockResolvedValue(true);
    mocks.remove.mockResolvedValue({ error: null });
    mocks.storageFrom.mockReturnValue({
      remove: mocks.remove,
    });
    mocks.uploadStorageFile.mockImplementation(async (bucket: string, path: string) => ({
      publicUrl: `https://demo.supabase.co/storage/v1/object/public/${bucket}/${path}`,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires a real remote upload with the GLB content type', async () => {
    const file = new File(['glb-bytes'], 'glbxz com.glb', { type: 'model/gltf-binary' });

    const url = await uploadGLBFile(file, 'workstation-product');

    expect(url).toContain('/3d-models/user-1/workstation-product/1779966855894-4fzzzx-glbxz-com.glb');
    expect(mocks.uploadStorageFile).toHaveBeenCalledWith(
      '3d-models',
      'user-1/workstation-product/1779966855894-4fzzzx-glbxz-com.glb',
      file,
      {
        contentType: 'model/gltf-binary',
        upsert: true,
        requireRemote: true,
      },
    );
  });

  it('uploads Chinese GLB names with an ASCII-safe storage path', async () => {
    const file = new File(['glb-bytes'], '模型 中文.glb', { type: 'model/gltf-binary' });

    await uploadGLBFile(file, 'workstation-product');

    const path = mocks.uploadStorageFile.mock.calls[0][1];
    expect(path).toBe('user-1/workstation-product/1779966855894-4fzzzx-model.glb');
    expect([...path].every((char) => char.charCodeAt(0) <= 0x7f)).toBe(true);
    expect(path).not.toContain(' ');
  });

  it('returns null and warns when remote storage upload fails', async () => {
    mocks.uploadStorageFile.mockRejectedValueOnce(new Error('Object not inserted'));
    const file = new File(['glb-bytes'], 'model.glb', { type: 'model/gltf-binary' });

    await expect(uploadGLBFile(file, 'workstation-product')).resolves.toBeNull();

    expect(mocks.toastError).toHaveBeenCalledWith('远端存储上传失败，请检查 bucket/policy/登录状态');
  });

  it('decodes encoded storage paths before deleting GLB files', async () => {
    await expect(deleteGLBFile(
      'https://demo.supabase.co/storage/v1/object/public/3d-models/user-1/%E6%A8%A1%E5%9E%8B.glb?x=1'
    )).resolves.toBe(true);

    expect(mocks.storageFrom).toHaveBeenCalledWith('3d-models');
    expect(mocks.remove).toHaveBeenCalledWith(['user-1/模型.glb']);
  });
});
