import { describe, expect, it } from 'vitest';
import { toLocalProxyUrl } from './storageUrl';

describe('toLocalProxyUrl', () => {
  it('rewrites Supabase public storage URLs to the dev storage proxy', () => {
    expect(
      toLocalProxyUrl(
        'https://demo.supabase.co/storage/v1/object/public/3d-models/user/workstation/model.glb'
      )
    ).toBe('/storage-proxy/3d-models/user/workstation/model.glb');
  });

  it('keeps local and inline URLs unchanged', () => {
    expect(toLocalProxyUrl('/assets/model.glb')).toBe('/assets/model.glb');
    expect(toLocalProxyUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(toLocalProxyUrl('blob:http://localhost/item')).toBe('blob:http://localhost/item');
  });
});
