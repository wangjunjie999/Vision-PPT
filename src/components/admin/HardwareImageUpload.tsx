import { Button } from '@/components/ui/button';
import { Upload, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DragDropUpload } from '@/components/upload/DragDropUpload';
import { toast } from 'sonner';
import { validateImageFile } from '@/utils/fileValidation';
import { processHardwareImageForUpload } from '@/utils/processHardwareImage';
import { getSafeFileExtension } from '@/utils/storageFileNames';

interface ImageUploadProps {
  currentUrl: string | null;
  type: 'cameras' | 'lenses' | 'lights' | 'controllers';
  onUpload: (url: string) => void;
  onRemove: () => void;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
}

export function HardwareImageUpload({
  currentUrl,
  type,
  onUpload,
  onRemove,
  uploading,
  setUploading,
}: ImageUploadProps) {
  const handleUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    // Validate file using comprehensive validation
    const isValid = await validateImageFile(file, {
      maxSizeMB: 5,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      checkMagicBytes: true,
    });

    if (!isValid) {
      return;
    }

    setUploading(true);

    try {
      const uploadFile = await processHardwareImageForUpload(file);
      const fileExt = getSafeFileExtension(uploadFile.name, 'png');
      const fileName = `${type}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('hardware-images')
        .upload(fileName, uploadFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: uploadFile.type || 'image/png',
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('hardware-images')
        .getPublicUrl(data.path);

      onUpload(urlData.publicUrl);
      toast.success('图片上传成功');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-20 h-20">
      <DragDropUpload
        variant="thumbnail"
        accept="image/*"
        onUpload={handleUpload}
        currentUrl={currentUrl}
        onRemove={onRemove}
        uploading={uploading}
        showPreview={false}
      />
    </div>
  );
}
