/**
 * In dev mode, rewrite Supabase Storage public URLs to a local Vite reverse-proxy
 * + disk cache (see vite-plugins/storageProxy.ts). First request from any LAN
 * user downloads from Supabase via the dev machine; subsequent requests from
 * anyone on the LAN are served from `.cache/storage/` on disk (10ms).
 *
 * In production builds this is a no-op.
 */
const SUPABASE_PUBLIC_RE = /\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/;

export function toLocalProxyUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (typeof window === 'undefined') return url;
  // Only rewrite in dev; production keeps original CDN URL.
  // @ts-ignore - import.meta.env may be untyped in some files
  if (!import.meta?.env?.DEV) return url;

  // Already proxied
  if (url.startsWith('/storage-proxy/')) return url;
  // Skip data:, blob:, relative, bundled assets
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const m = url.match(SUPABASE_PUBLIC_RE);
  if (!m) return url;
  const bucket = m[1];
  const path = m[2];
  return `/storage-proxy/${bucket}/${path}`;
}

/**
 * Same as toLocalProxyUrl but never returns empty string for null/undefined
 * (returns the original value).
 */
export function maybeProxy<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  return toLocalProxyUrl(url) as T;
}