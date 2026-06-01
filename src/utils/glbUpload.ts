/**
 * GLB file upload utility
 * Handles validation, upload to storage, and URL retrieval
 */
import { supabase } from '@/integrations/supabase/client';
import { validate3DModelFile } from './fileValidation';
import { uploadStorageFile } from './storageUpload';
import { toast } from 'sonner';

const BUCKET = '3d-models';
const MAX_SIZE_MB = 50;

/**
 * Upload a GLB file to storage and return the public URL
 */
export async function uploadGLBFile(
  file: File,
  folder: string = 'mechanisms'
): Promise<string | null> {
  // Validate
  const isValid = await validate3DModelFile(file, MAX_SIZE_MB);
  if (!isValid) return null;

  // Only accept .glb
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'glb') {
    toast.error('仅支持 .glb 格式的3D模型文件');
    return null;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('请先登录');
      return null;
    }

    // Sanitize filename: Supabase storage object keys must be ASCII-safe.
    // Strip/replace non-ASCII (CJK, accents, etc.) and any chars outside [A-Za-z0-9._-].
    const rawName = file.name;
    const dotIdx = rawName.lastIndexOf('.');
    const baseRaw = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName;
    const extRaw = dotIdx > 0 ? rawName.slice(dotIdx + 1) : 'glb';
    const safeBase = baseRaw
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '') // drop non-ASCII
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'model';
    const safeExt = extRaw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'glb';
    const safeName = `${safeBase}.${safeExt}`;
    const fileName = `${user.id}/${folder}/${Date.now()}-${safeName}`;
    const { publicUrl } = await uploadStorageFile(BUCKET, fileName, file, {
      contentType: 'model/gltf-binary',
      upsert: true,
      requireRemote: true,
    });

    return publicUrl;
  } catch (error) {
    console.error('GLB upload error:', error);
    toast.error('远端存储上传失败，请检查 bucket/policy/登录状态');
    return null;
  }
}

/**
 * Delete a GLB file from storage by its public URL
 */
export async function deleteGLBFile(publicUrl: string): Promise<boolean> {
  try {
    // Extract path from public URL
    const urlParts = publicUrl.split(`/storage/v1/object/public/${BUCKET}/`);
    if (urlParts.length < 2) return false;

    const filePath = urlParts[1];
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('GLB delete error:', error);
    return false;
  }
}
