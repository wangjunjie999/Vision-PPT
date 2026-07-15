/**
 * GLB file upload utility
 * Handles validation, upload to storage, and URL retrieval
 */
import { supabase } from '@/integrations/supabase/client';
import { validate3DModelFile } from './fileValidation';
import { uploadStorageFile } from './storageUpload';
import { createSafeStorageObjectName, getSafeFileExtension } from './storageFileNames';
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
  const ext = getSafeFileExtension(file.name, 'glb');
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

    const fileName = `${user.id}/${folder}/${createSafeStorageObjectName(file.name, {
      fallbackBase: 'model',
      fallbackExtension: 'glb',
    })}`;
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

    const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('GLB delete error:', error);
    return false;
  }
}
