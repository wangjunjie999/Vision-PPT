import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  validate3DModelFile: vi.fn(),
  uploadStorageFile: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
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

import { uploadGLBFile } from './glbUpload';

describe('uploadGLBFile', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1779966855894);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mocks.validate3DModelFile.mockResolvedValue(true);
    mocks.uploadStorageFile.mockResolvedValue({
      publicUrl: 'https://demo.supabase.co/storage/v1/object/public/3d-models/user-1/workstation-product/1779966855894-glbxz_com.glb',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires a real remote upload with the GLB content type', async () => {
    const file = new File(['glb-bytes'], 'glbxz com.glb', { type: 'model/gltf-binary' });

    const url = await uploadGLBFile(file, 'workstation-product');

    expect(url).toContain('/3d-models/user-1/workstation-product/1779966855894-glbxz_com.glb');
    expect(mocks.uploadStorageFile).toHaveBeenCalledWith(
      '3d-models',
      'user-1/workstation-product/1779966855894-glbxz_com.glb',
      file,
      {
        contentType: 'model/gltf-binary',
        upsert: true,
        requireRemote: true,
      },
    );
  });

  it('returns null and warns when remote storage upload fails', async () => {
    mocks.uploadStorageFile.mockRejectedValueOnce(new Error('Object not inserted'));
    const file = new File(['glb-bytes'], 'model.glb', { type: 'model/gltf-binary' });

    await expect(uploadGLBFile(file, 'workstation-product')).resolves.toBeNull();

    expect(mocks.toastError).toHaveBeenCalledWith('远端存储上传失败，请检查 bucket/policy/登录状态');
  });
});
