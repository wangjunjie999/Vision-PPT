import type { Plugin, ViteDevServer } from 'vite';
import { promises as fs, createReadStream, createWriteStream } from 'node:fs';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MIME: Record<string, string> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
  hdr: 'image/vnd.radiance',
  ktx2: 'image/ktx2',
  bin: 'application/octet-stream',
};

function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return MIME[ext] || 'application/octet-stream';
}

export interface StorageProxyOptions {
  /** e.g. https://xxx.supabase.co */
  supabaseUrl: string;
  /** Cache dir relative to project root, default .cache/storage */
  cacheDir?: string;
  /** URL prefix to mount, default /storage-proxy */
  prefix?: string;
}

export function storageProxyPlugin(opts: StorageProxyOptions): Plugin {
  const prefix = opts.prefix ?? '/storage-proxy';
  const upstreamBase = opts.supabaseUrl.replace(/\/+$/, '') + '/storage/v1/object/public';

  // de-dup concurrent in-flight downloads for the same path
  const inFlight = new Map<string, Promise<void>>();

  return {
    name: 'lovable-storage-proxy',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const projectRoot = server.config.root;
      const cacheRoot = pathResolve(projectRoot, opts.cacheDir ?? '.cache/storage');

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        try {
          const rawUrl = req.url || '';
          if (!rawUrl.startsWith(prefix + '/')) return next();

          // Strip prefix and any query string
          const rel = decodeURIComponent(rawUrl.slice(prefix.length + 1).split('?')[0]);
          if (!rel || rel.includes('..')) {
            res.statusCode = 400;
            res.end('bad request');
            return;
          }

          const cachePath = join(cacheRoot, rel);

          const sendFromDisk = async () => {
            const stat = await fs.stat(cachePath);
            res.statusCode = 200;
            res.setHeader('Content-Type', mimeFor(rel));
            res.setHeader('Content-Length', String(stat.size));
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('X-Storage-Proxy-Cache', 'HIT');
            await pipeline(createReadStream(cachePath), res);
          };

          // 1. cache hit
          try {
            await fs.access(cachePath);
            await sendFromDisk();
            return;
          } catch { /* miss */ }

          // 2. cache miss: fetch from supabase, write to disk, then serve
          let download = inFlight.get(cachePath);
          if (!download) {
            download = (async () => {
              const upstream = `${upstreamBase}/${rel}`;
              const resp = await fetch(upstream);
              if (!resp.ok || !resp.body) {
                const err = new Error(`upstream ${resp.status}`);
                (err as any).status = resp.status;
                throw err;
              }
              await fs.mkdir(dirname(cachePath), { recursive: true });
              const tmp = cachePath + '.part-' + Date.now();
              const ws = createWriteStream(tmp);
              // resp.body is a web ReadableStream -> convert
              await pipeline(Readable.fromWeb(resp.body as any), ws);
              await fs.rename(tmp, cachePath);
            })();
            inFlight.set(cachePath, download);
            download.finally(() => inFlight.delete(cachePath));
          }

          try {
            await download;
          } catch (e: any) {
            const status = e?.status ?? 502;
            res.statusCode = status;
            res.setHeader('X-Storage-Proxy-Cache', 'MISS-ERROR');
            res.end(`storage proxy upstream error: ${e?.message || 'unknown'}`);
            return;
          }

          res.setHeader('X-Storage-Proxy-Cache', 'MISS');
          await sendFromDisk();
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.error('[storage-proxy] error:', e);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('storage proxy error');
          }
        }
      });
    },
  };
}