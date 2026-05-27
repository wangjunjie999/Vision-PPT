import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type RequestListener, type Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import {
  getSafeStorageRel,
  isAllowedUploadRel,
  normalizeStorageProxyUploadMode,
  storageProxyPlugin,
} from './storageProxy';

type TestResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

async function withStorageProxyServer(
  root: string,
  options: Parameters<typeof storageProxyPlugin>[0],
  fn: (baseUrl: string) => Promise<void>,
) {
  let middleware: RequestListener | null = null;
  const plugin = storageProxyPlugin(options);
  plugin.configureServer?.({
    config: { root },
    middlewares: {
      use(handler: RequestListener) {
        middleware = handler;
      },
    },
  } as any);

  if (!middleware) throw new Error('middleware not registered');

  const server = createServer((req, res) => {
    middleware!(req, res, () => {
      res.statusCode = 404;
      res.end('next');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind to a port');
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function proxyRequest(baseUrl: string, path: string, body?: Buffer, headers: Record<string, string> = {}) {
  return new Promise<TestResponse>((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: body ? 'POST' : 'GET',
        headers: body
          ? {
              'Content-Length': String(body.length),
              ...headers,
            }
          : headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        }));
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storageProxy helpers', () => {
  it('extracts and decodes safe storage paths', () => {
    expect(getSafeStorageRel('/storage-proxy/3d-models/a%20b/model.glb?x=1', '/storage-proxy'))
      .toBe('3d-models/a b/model.glb');
  });

  it('rejects unsafe storage paths', () => {
    expect(getSafeStorageRel('/storage-proxy/../secret.txt', '/storage-proxy')).toBeNull();
    expect(getSafeStorageRel('/storage-proxy/3d-models/a\\b.glb', '/storage-proxy')).toBeNull();
    expect(getSafeStorageRel('/other/3d-models/a.glb', '/storage-proxy')).toBeNull();
  });

  it('allows only configured upload buckets and object paths', () => {
    expect(isAllowedUploadRel('3d-models/user/model.glb')).toBe(true);
    expect(isAllowedUploadRel('product-models/ws/image.png')).toBe(true);
    expect(isAllowedUploadRel('hardware-images/x.png')).toBe(false);
    expect(isAllowedUploadRel('3d-models')).toBe(false);
    expect(isAllowedUploadRel('3d-models/../secret.glb')).toBe(false);
  });

  it('normalizes upload mode with local-first as the default', () => {
    expect(normalizeStorageProxyUploadMode('local-first')).toBe('local-first');
    expect(normalizeStorageProxyUploadMode('remote-required')).toBe('remote-required');
    expect(normalizeStorageProxyUploadMode('local-only')).toBe('local-only');
    expect(normalizeStorageProxyUploadMode('bad-value')).toBe('local-first');
  });

  it('stores uploads locally in local-first mode when Supabase is unavailable', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'storage-proxy-local-first-'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('read ECONNRESET')) as unknown as typeof fetch;

    try {
      await withStorageProxyServer(root, {
        supabaseUrl: 'https://demo.supabase.co',
        publishableKey: 'anon-key',
        uploadMode: 'local-first',
      }, async (baseUrl) => {
        const body = Buffer.from('glb-bytes');
        const response = await proxyRequest(
          baseUrl,
          '/storage-proxy-upload/3d-models/user/model.glb',
          body,
          {
            Authorization: 'Bearer user-token',
            'Content-Type': 'model/gltf-binary',
          },
        );

        expect(response.status).toBe(200);
        expect(response.headers['x-storage-proxy-upload']).toBe('LOCAL');
        await expect(fs.readFile(join(root, '.cache/storage/3d-models/user/model.glb'))).resolves.toEqual(body);
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('background Supabase upload unavailable'));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('fails uploads in remote-required mode when Supabase is unavailable', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'storage-proxy-remote-required-'));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('read ECONNRESET')) as unknown as typeof fetch;

    try {
      await withStorageProxyServer(root, {
        supabaseUrl: 'https://demo.supabase.co',
        publishableKey: 'anon-key',
        uploadMode: 'remote-required',
      }, async (baseUrl) => {
        const response = await proxyRequest(
          baseUrl,
          '/storage-proxy-upload/3d-models/user/model.glb',
          Buffer.from('glb-bytes'),
          {
            Authorization: 'Bearer user-token',
            'Content-Type': 'model/gltf-binary',
          },
        );

        expect(response.status).toBe(502);
        expect(response.body.toString()).toContain('storage upload upstream unavailable');
        await expect(fs.access(join(root, '.cache/storage/3d-models/user/model.glb'))).rejects.toThrow();
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('serves cached files from disk with a HIT header', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'storage-proxy-cache-hit-'));
    try {
      const cachedPath = join(root, '.cache/storage/product-models/ws/a.png');
      await fs.mkdir(join(root, '.cache/storage/product-models/ws'), { recursive: true });
      await fs.writeFile(cachedPath, 'image-bytes');

      await withStorageProxyServer(root, {
        supabaseUrl: 'https://demo.supabase.co',
      }, async (baseUrl) => {
        const response = await proxyRequest(baseUrl, '/storage-proxy/product-models/ws/a.png');

        expect(response.status).toBe(200);
        expect(response.headers['x-storage-proxy-cache']).toBe('HIT');
        expect(response.body.toString()).toBe('image-bytes');
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
