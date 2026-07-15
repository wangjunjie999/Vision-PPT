/**
 * LightingPhotosPanel - Upload and manage lighting effect photos for a module
 * Max 4 photos with remark support
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DragDropUpload } from '@/components/upload/DragDropUpload';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Eye, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getSafeFileExtension } from '@/utils/storageFileNames';

interface LightingPhoto {
  url: string;
  remark: string;
  created_at: string;
}

interface LightingPhotosPanelProps {
  moduleId: string;
  moduleName: string;
  initialPhotos: LightingPhoto[];
  onSave: (photos: LightingPhoto[]) => Promise<void>;
}

export function LightingPhotosPanel({ moduleId, moduleName, initialPhotos, onSave }: LightingPhotosPanelProps) {
  const [photos, setPhotos] = useState<LightingPhoto[]>(initialPhotos || []);

  useEffect(() => {
    setPhotos(initialPhotos || []);
  }, [moduleId]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleUpload = useCallback(async (files: File[]) => {
    if (photos.length >= 4) {
      toast.error('最多上传 4 张打光照片');
      return;
    }

    setUploading(true);
    try {
      const remaining = 4 - photos.length;
      const filesToUpload = files.slice(0, remaining);
      const newPhotos: LightingPhoto[] = [];

      for (const file of filesToUpload) {
        const fileName = `lighting-${moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${getSafeFileExtension(file.name, 'png')}`;
        
        const { error: uploadError } = await supabase.storage
          .from('module-schematics')
          .upload(fileName, file, { contentType: file.type, upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('module-schematics')
          .getPublicUrl(fileName);

        newPhotos.push({
          url: publicUrl,
          remark: '',
          created_at: new Date().toISOString(),
        });
      }

      setPhotos(prev => [...prev, ...newPhotos]);
      toast.success(`已上传 ${newPhotos.length} 张照片`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('上传失败');
    } finally {
      setUploading(false);
    }
  }, [moduleId, photos.length]);

  const handleRemarkChange = useCallback((index: number, remark: string) => {
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, remark } : p));
  }, []);

  const handleRemove = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(photos);
      toast.success('打光照片已保存');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [photos, onSave]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">{moduleName} - 打光照片</h4>
          <p className="text-xs text-muted-foreground">上传实拍打光效果照片，最多 4 张</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存
        </Button>
      </div>

      {/* Upload area */}
      {photos.length < 4 && (
        <DragDropUpload
          onUpload={handleUpload}
          accept="image/*"
          multiple
          maxFiles={4 - photos.length}
          maxSize={10}
          disabled={uploading}
          showPreview={false}
        />
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {photos.map((photo, index) => (
            <div key={`${photo.url}-${index}`} className="relative rounded-lg border bg-card overflow-hidden group">
              <div className="aspect-video relative cursor-pointer" onClick={() => setPreviewUrl(photo.url)}>
                <img
                  src={photo.url}
                  alt={photo.remark || `打光照片 ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="p-2 space-y-1">
                <Input
                  value={photo.remark}
                  onChange={(e) => handleRemarkChange(index, e.target.value)}
                  placeholder="备注（如：正面环形光）"
                  className="h-7 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          暂无打光照片，请上传实拍效果图
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>打光照片预览</DialogTitle>
            <DialogDescription>查看打光效果照片</DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="preview" className="max-w-full max-h-[70vh] object-contain rounded-lg mx-auto" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
