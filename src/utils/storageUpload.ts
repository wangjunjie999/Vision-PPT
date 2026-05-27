import { supabase } from '@/integrations/supabase/client';

export interface StorageUploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
}

function isDevProxyEnabled(): boolean {
  return typeof window !== 'undefined' && Boolean(import.meta.env.DEV);
}

function uploadProxyUrl(bucket: string, path: string): string {
  return `/storage-proxy-upload/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

function publicUrlFor(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function uploadStorageFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options: StorageUploadOptions = {}
): Promise<StorageUploadResult> {
  const contentType = options.contentType || file.type || 'application/octet-stream';

  if (isDevProxyEnabled()) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const token = data.session?.access_token;
    if (!token) {
      throw new Error('请先登录后再上传文件');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'x-upsert': String(options.upsert ?? false),
    };
    if (options.cacheControl) {
      headers['cache-control'] = options.cacheControl;
    }

    const response = await fetch(uploadProxyUrl(bucket, path), {
      method: 'POST',
      headers,
      body: file,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `上传失败 (${response.status})`);
    }

    return { path, publicUrl: publicUrlFor(bucket, path) };
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    cacheControl: options.cacheControl,
    upsert: options.upsert,
  });
  if (error) throw error;

  return { path, publicUrl: publicUrlFor(bucket, path) };
}
