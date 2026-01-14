import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateImageFile } from '@/utils/fileValidation';

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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('hardware-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
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
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative w-20 h-20 bg-secondary rounded-lg overflow-hidden group">
      {currentUrl ? (
        <>
          <img
            src={currentUrl}
            alt="Hardware"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-full flex flex-col items-center justify-center text-muted-foreground hover:bg-secondary/80 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Upload className="h-6 w-6 mb-1" />
              <span className="text-[10px]">上传图片</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
