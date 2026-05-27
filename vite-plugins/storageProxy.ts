import type { Plugin, ViteDevServer } from 'vite';
import { promises as fs, createReadStream, createWriteStream } from 'node:fs';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { once } from 'node:events';
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
  /** Supabase anon/publishable key. Used only for user-JWT upload forwarding. */
  publishableKey?: string;
  /** Cache dir relative to project root, default .cache/storage */
  cacheDir?: string;
  /** URL prefix to mount, default /storage-proxy */
  prefix?: string;
  /** Upload URL prefix to mount, default /storage-proxy-upload */
  uploadPrefix?: string;
  /** Buckets that can be written through the dev upload proxy. */
  uploadBuckets?: string[];
  /** Upload behavior for dev/LAN use. Default: local-first. */
  uploadMode?: StorageProxyUploadMode;
}

const DEFAULT_UPLOAD_BUCKETS = ['3d-models', 'product-models'];
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export type StorageProxyUploadMode = 'local-first' | 'remote-required' | 'local-only';

export function normalizeStorageProxyUploadMode(value: unknown): StorageProxyUploadMode {
  return value === 'remote-required' || value === 'local-only' || value === 'local-first'
    ? value
    : 'local-first';
}

function badRequest(res: ServerResponse, message = 'bad request') {
  res.statusCode = 400;
  res.end(message);
}

export function getSafeStorageRel(rawUrl: string, prefix: string): string | null {
  if (!rawUrl.startsWith(prefix + '/')) return null;

  const rel = decodeURIComponent(rawUrl.slice(prefix.length + 1).split('?')[0]);
  if (!rel || rel.includes('..') || rel.includes('\\') || rel.startsWith('/')) return null;
  return rel;
}

export function isAllowedUploadRel(rel: string, allowedBuckets = DEFAULT_UPLOAD_BUCKETS): boolean {
  const [bucket, ...pathParts] = rel.split('/');
  const path = pathParts.join('/');
  return (
    allowedBuckets.includes(bucket) &&
    /^[a-z0-9][a-z0-9._-]*$/i.test(bucket) &&
    Boolean(path) &&
    !path.includes('..') &&
    !path.includes('\\') &&
    !path.startsWith('/')
  );
}

async function writeRequestBodyToTemp(req: IncomingMessage, tmpPath: string, maxBytes: number) {
  const ws = createWriteStream(tmpPath, { flags: 'wx' });
  let received = 0;

  try {
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buffer.length;
      if (received > maxBytes) {
        const err = new Error('upload too large');
        (err as any).status = 413;
        throw err;
      }
      if (!ws.write(buffer)) {
        await once(ws, 'drain');
      }
    }
    ws.end();
    await once(ws, 'finish');
    return received;
  } catch (err) {
    ws.destroy();
    await fs.rm(tmpPath, { force: true }).catch(() => undefined);
    throw err;
  }
}

async function replaceFileFromTemp(tmpPath: string, finalPath: string) {
  await fs.rm(finalPath, { force: true }).catch(() => undefined);
  await fs.rename(tmpPath, finalPath);
}

async function uploadFileToSupabase(
  upstream: string,
  headers: Record<string, string>,
  filePath: string,
) {
  const stat = await fs.stat(filePath);
  const body = createReadStream(filePath);
  let response: Response;
  try {
    response = await fetch(upstream, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': String(stat.size),
      },
      body: body as any,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
  } catch (err) {
    body.destroy();
    throw err;
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') || 'application/json',
    text: await response.text(),
  };
}

function sendLocalUploadSuccess(res: ServerResponse, rel: string, mode: StorageProxyUploadMode) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Storage-Proxy-Upload', mode === 'local-only' ? 'LOCAL-ONLY' : 'LOCAL');
  res.end(JSON.stringify({ path: rel, cached: true, mode }));
}

export function storageProxyPlugin(opts: StorageProxyOptions): Plugin {
  const prefix = opts.prefix ?? '/storage-proxy';
  const uploadPrefix = opts.uploadPrefix ?? '/storage-proxy-upload';
  const supabaseBase = opts.supabaseUrl.replace(/\/+$/, '');
  const upstreamPublicBase = supabaseBase + '/storage/v1/object/public';
  const upstreamObjectBase = supabaseBase + '/storage/v1/object';
  const allowedUploadBuckets = opts.uploadBuckets ?? DEFAULT_UPLOAD_BUCKETS;
  const uploadMode = normalizeStorageProxyUploadMode(opts.uploadMode);

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
          if (!rawUrl.startsWith(prefix + '/') && !rawUrl.startsWith(uploadPrefix + '/')) return next();

          const isUpload = rawUrl.startsWith(uploadPrefix + '/');
          const rel = getSafeStorageRel(rawUrl, isUpload ? uploadPrefix : prefix);
          if (!rel) {
            badRequest(res);
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
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            await pipeline(createReadStream(cachePath), res);
          };

          if (isUpload) {
            if (req.method !== 'POST' && req.method !== 'PUT') {
              res.statusCode = 405;
              res.end('method not allowed');
              return;
            }

            if (!isAllowedUploadRel(rel, allowedUploadBuckets)) {
              badRequest(res, 'upload bucket or path is not allowed');
              return;
            }

            const auth = req.headers.authorization;
            if (!auth || !auth.startsWith('Bearer ')) {
              res.statusCode = 401;
              res.end('missing bearer token');
              return;
            }

            const contentLength = Number(req.headers['content-length'] || 0);
            if (contentLength > MAX_UPLOAD_BYTES) {
              res.statusCode = 413;
              res.end('upload too large');
              return;
            }

            const upstream = `${upstreamObjectBase}/${rel}`;
            const headers: Record<string, string> = {
              Authorization: auth,
              'Content-Type': String(req.headers['content-type'] || mimeFor(rel)),
            };

            if (opts.publishableKey) {
              headers.apikey = opts.publishableKey;
            }
            if (req.headers['x-upsert']) {
              headers['x-upsert'] = String(req.headers['x-upsert']);
            }
            if (req.headers['cache-control']) {
              headers['cache-control'] = String(req.headers['cache-control']);
            }

            await fs.mkdir(dirname(cachePath), { recursive: true });
            const tmp = cachePath + '.part-' + Date.now() + '-' + Math.random().toString(16).slice(2);
            try {
              await writeRequestBodyToTemp(req, tmp, MAX_UPLOAD_BYTES);
            } catch (e: any) {
              res.statusCode = e?.status ?? 500;
              res.end(e?.message || 'upload failed');
              return;
            }

            if (uploadMode === 'remote-required') {
              try {
                const upstreamResp = await uploadFileToSupabase(upstream, headers, tmp);
                if (!upstreamResp.ok) {
                  await fs.rm(tmp, { force: true }).catch(() => undefined);
                  res.statusCode = upstreamResp.status;
                  res.setHeader('Content-Type', upstreamResp.contentType || 'text/plain');
                  res.end(upstreamResp.text || `storage upload upstream ${upstreamResp.status}`);
                  return;
                }

                await replaceFileFromTemp(tmp, cachePath);
                res.statusCode = upstreamResp.status;
                res.setHeader('Content-Type', upstreamResp.contentType || 'application/json');
                res.setHeader('X-Storage-Proxy-Upload', 'REMOTE');
                res.end(upstreamResp.text || '{}');
                return;
              } catch (e: any) {
                await fs.rm(tmp, { force: true }).catch(() => undefined);
                res.statusCode = e?.status ?? 502;
                res.setHeader('Content-Type', 'text/plain');
                res.end(`storage upload upstream unavailable: ${e?.message || 'unknown'}`);
                return;
              }
            }

            await replaceFileFromTemp(tmp, cachePath);
            sendLocalUploadSuccess(res, rel, uploadMode);

            if (uploadMode === 'local-first') {
              void uploadFileToSupabase(upstream, headers, cachePath)
                .then((upstreamResp) => {
                  if (!upstreamResp.ok) {
                    console.warn(
                      `[storage-proxy] background Supabase upload failed for ${rel}: ${upstreamResp.status} ${upstreamResp.text || ''}`.trim(),
                    );
                  }
                })
                .catch((e: any) => {
                  console.warn(`[storage-proxy] background Supabase upload unavailable for ${rel}: ${e?.message || e}`);
                });
            }
            return;
          }

          // 1. cache hit
          try {
            await fs.access(cachePath);
            await sendFromDisk();
            return;
          } catch { /* miss */ }

          if (req.method === 'HEAD') {
            try {
              const upstream = `${upstreamPublicBase}/${rel}`;
              const resp = await fetch(upstream, { method: 'HEAD' });
              res.statusCode = resp.status;
              res.setHeader('X-Storage-Proxy-Cache', resp.ok ? 'MISS-HEAD' : 'MISS-ERROR');
              const contentType = resp.headers.get('content-type');
              const contentLength = resp.headers.get('content-length');
              if (contentType) res.setHeader('Content-Type', contentType);
              if (contentLength) res.setHeader('Content-Length', contentLength);
            } catch (e: any) {
              res.statusCode = 502;
              res.setHeader('X-Storage-Proxy-Cache', 'MISS-ERROR');
              res.setHeader('Content-Type', 'text/plain');
              res.setHeader('X-Storage-Proxy-Error', 'upstream-unavailable');
              res.write(`storage proxy upstream unavailable: ${e?.message || 'unknown'}`);
            }
            res.end();
            return;
          }

          // 2. cache miss: fetch from supabase, write to disk, then serve
          let download = inFlight.get(cachePath);
          if (!download) {
            download = (async () => {
              const upstream = `${upstreamPublicBase}/${rel}`;
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
            res.end(`storage proxy cache miss and upstream unavailable: ${e?.message || 'unknown'}`);
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
