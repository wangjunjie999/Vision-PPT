import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    storage: {
      from: mocks.from,
    },
  },
}));

import { uploadStorageFile } from './storageUpload';

describe('uploadStorageFile', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true);
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'user-token' } },
      error: null,
    });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((bucket: string) => ({
      upload: mocks.upload,
      getPublicUrl: (path: string) => ({
        data: {
          publicUrl: `https://demo.supabase.co/storage/v1/object/public/${bucket}/${path}`,
        },
      }),
    }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses the local upload proxy in dev mode', async () => {
    const file = new Blob(['image'], { type: 'image/png' });

    const result = await uploadStorageFile('product-models', 'ws-1/a b.png', file, {
      upsert: true,
    });

    expect(fetch).toHaveBeenCalledWith(
      '/storage-proxy-upload/product-models/ws-1/a%20b.png',
      expect.objectContaining({
        method: 'POST',
        body: file,
        headers: expect.objectContaining({
          Authorization: 'Bearer user-token',
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        }),
      })
    );
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(result.publicUrl).toBe(
      'https://demo.supabase.co/storage/v1/object/public/product-models/ws-1/a b.png'
    );
  });

  it('falls back to Supabase SDK upload outside dev mode', async () => {
    vi.stubEnv('DEV', false);
    const file = new Blob(['model'], { type: 'model/gltf-binary' });

    await uploadStorageFile('3d-models', 'user/model.glb', file, {
      contentType: 'model/gltf-binary',
      upsert: true,
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.upload).toHaveBeenCalledWith('user/model.glb', file, {
      contentType: 'model/gltf-binary',
      cacheControl: undefined,
      upsert: true,
    });
  });

  it('rejects dev uploads without a logged-in session', async () => {
    mocks.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(uploadStorageFile('product-models', 'x.png', new Blob(['x']))).rejects.toThrow(
      '请先登录后再上传文件'
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
