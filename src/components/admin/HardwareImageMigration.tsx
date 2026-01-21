import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useHardware } from '@/contexts/HardwareContext';
import { toast } from 'sonner';
import { Upload, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface MigrationResult {
  type: 'camera' | 'lens' | 'light' | 'controller';
  id: string;
  name: string;
  oldUrl: string;
  newUrl: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

// Local hardware images that need to be migrated
const LOCAL_HARDWARE_IMAGES: Record<string, string> = {
  '/hardware/camera-basler.png': 'cameras/camera-basler.png',
  '/hardware/camera-cognex.png': 'cameras/camera-cognex.png',
  '/hardware/camera-daheng.png': 'cameras/camera-daheng.png',
  '/hardware/camera-flir.png': 'cameras/camera-flir.png',
  '/hardware/camera-hikvision.png': 'cameras/camera-hikvision.png',
  '/hardware/camera-industrial.png': 'cameras/camera-industrial.png',
  '/hardware/camera-keyence.png': 'cameras/camera-keyence.png',
  '/hardware/lens-computar.png': 'lenses/lens-computar.png',
  '/hardware/lens-fujinon.png': 'lenses/lens-fujinon.png',
  '/hardware/lens-industrial.png': 'lenses/lens-industrial.png',
  '/hardware/lens-kowa.png': 'lenses/lens-kowa.png',
  '/hardware/lens-tamron.png': 'lenses/lens-tamron.png',
  '/hardware/light-backlight.png': 'lights/light-backlight.png',
  '/hardware/light-ccs.png': 'lights/light-ccs.png',
  '/hardware/light-moritex.png': 'lights/light-moritex.png',
  '/hardware/light-opt.png': 'lights/light-opt.png',
  '/hardware/light-ring.png': 'lights/light-ring.png',
  '/hardware/controller-advantech.png': 'controllers/controller-advantech.png',
  '/hardware/controller-ipc.png': 'controllers/controller-ipc.png',
  '/hardware/controller-neousys.png': 'controllers/controller-neousys.png',
  '/hardware/controller-nvidia.png': 'controllers/controller-nvidia.png',
  '/hardware/controller-siemens.png': 'controllers/controller-siemens.png',
};

export function HardwareImageMigration() {
  const { cameras, lenses, lights, controllers, refetch } = useHardware();
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [currentStep, setCurrentStep] = useState('');

  const getSupabaseStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/hardware-images/${path}`;
  };

  const isRelativeUrl = (url: string | null) => {
    if (!url) return false;
    return url.startsWith('/') && !url.startsWith('//') && !url.includes('supabase');
  };

  const uploadImageToStorage = async (localPath: string): Promise<string | null> => {
    try {
      // Fetch the image from local path
      const absoluteUrl = `${window.location.origin}${localPath}`;
      const response = await fetch(absoluteUrl);
      
      if (!response.ok) {
        console.error(`Failed to fetch ${absoluteUrl}: ${response.status}`);
        return null;
      }
      
      const blob = await response.blob();
      const storagePath = LOCAL_HARDWARE_IMAGES[localPath];
      
      if (!storagePath) {
        // Generate a storage path based on the local path
        const fileName = localPath.split('/').pop() || 'image.png';
        const type = localPath.includes('camera') ? 'cameras' : 
                     localPath.includes('lens') ? 'lenses' :
                     localPath.includes('light') ? 'lights' : 'controllers';
        const generatedPath = `${type}/${fileName}`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('hardware-images')
          .upload(generatedPath, blob, {
            cacheControl: '3600',
            upsert: true,
          });
        
        if (error) {
          console.error('Upload error:', error);
          return null;
        }
        
        return getSupabaseStorageUrl(generatedPath);
      }
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('hardware-images')
        .upload(storagePath, blob, {
          cacheControl: '3600',
          upsert: true,
        });
      
      if (error) {
        console.error('Upload error:', error);
        return null;
      }
      
      return getSupabaseStorageUrl(storagePath);
    } catch (error) {
      console.error('Failed to upload image:', error);
      return null;
    }
  };

  const migrateAllImages = async () => {
    setMigrating(true);
    setResults([]);
    setProgress(0);
    
    const allItems = [
      ...cameras.map(c => ({ ...c, type: 'camera' as const, name: `${c.brand} ${c.model}` })),
      ...lenses.map(l => ({ ...l, type: 'lens' as const, name: `${l.brand} ${l.model}` })),
      ...lights.map(l => ({ ...l, type: 'light' as const, name: `${l.brand} ${l.model}` })),
      ...controllers.map(c => ({ ...c, type: 'controller' as const, name: `${c.brand} ${c.model}` })),
    ];
    
    const itemsToMigrate = allItems.filter(item => isRelativeUrl(item.image_url));
    const totalItems = itemsToMigrate.length;
    
    if (totalItems === 0) {
      toast.info('所有图片已经使用云存储URL，无需迁移');
      setMigrating(false);
      return;
    }
    
    const newResults: MigrationResult[] = [];
    
    for (let i = 0; i < itemsToMigrate.length; i++) {
      const item = itemsToMigrate[i];
      setCurrentStep(`正在迁移: ${item.name}`);
      setProgress(Math.round(((i + 1) / totalItems) * 100));
      
      const result: MigrationResult = {
        type: item.type,
        id: item.id,
        name: item.name,
        oldUrl: item.image_url || '',
        newUrl: '',
        status: 'failed',
      };
      
      try {
        // Upload image to storage
        const newUrl = await uploadImageToStorage(item.image_url!);
        
        if (!newUrl) {
          result.status = 'failed';
          result.error = '图片上传失败';
          newResults.push(result);
          continue;
        }
        
        result.newUrl = newUrl;
        
        // Update database record
        const tableName = item.type === 'camera' ? 'cameras' : 
                         item.type === 'lens' ? 'lenses' :
                         item.type === 'light' ? 'lights' : 'controllers';
        
        const { error } = await supabase
          .from(tableName)
          .update({ image_url: newUrl })
          .eq('id', item.id);
        
        if (error) {
          result.status = 'failed';
          result.error = error.message;
        } else {
          result.status = 'success';
        }
      } catch (error) {
        result.status = 'failed';
        result.error = error instanceof Error ? error.message : '未知错误';
      }
      
      newResults.push(result);
      setResults([...newResults]);
    }
    
    // Refresh hardware data
    await refetch();
    
    const successCount = newResults.filter(r => r.status === 'success').length;
    const failedCount = newResults.filter(r => r.status === 'failed').length;
    
    if (failedCount === 0) {
      toast.success(`成功迁移 ${successCount} 张图片到云存储`);
    } else {
      toast.warning(`迁移完成: ${successCount} 成功, ${failedCount} 失败`);
    }
    
    setCurrentStep('');
    setMigrating(false);
  };

  const getItemsNeedingMigration = () => {
    return [
      ...cameras.filter(c => isRelativeUrl(c.image_url)),
      ...lenses.filter(l => isRelativeUrl(l.image_url)),
      ...lights.filter(l => isRelativeUrl(l.image_url)),
      ...controllers.filter(c => isRelativeUrl(c.image_url)),
    ];
  };

  const itemsNeedingMigration = getItemsNeedingMigration();
  const successResults = results.filter(r => r.status === 'success');
  const failedResults = results.filter(r => r.status === 'failed');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          硬件图片云存储迁移
        </CardTitle>
        <CardDescription>
          将本地硬件图片迁移到Lovable Cloud存储，确保PPT生成时图片正确加载
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            相机: {cameras.length} 个
          </Badge>
          <Badge variant="outline">
            镜头: {lenses.length} 个
          </Badge>
          <Badge variant="outline">
            光源: {lights.length} 个
          </Badge>
          <Badge variant="outline">
            控制器: {controllers.length} 个
          </Badge>
          {itemsNeedingMigration.length > 0 && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {itemsNeedingMigration.length} 个需要迁移
            </Badge>
          )}
          {itemsNeedingMigration.length === 0 && (
            <Badge variant="default" className="bg-primary">
              <CheckCircle className="h-3 w-3 mr-1" />
              全部已迁移
            </Badge>
          )}
        </div>

        {/* Migration Button */}
        <Button 
          onClick={migrateAllImages} 
          disabled={migrating || itemsNeedingMigration.length === 0}
          className="w-full"
        >
          {migrating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              迁移中...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              开始迁移 ({itemsNeedingMigration.length} 张图片)
            </>
          )}
        </Button>

        {/* Progress */}
        {migrating && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {currentStep}
            </p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {successResults.length > 0 && (
                <Badge variant="default" className="bg-primary">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {successResults.length} 成功
                </Badge>
              )}
              {failedResults.length > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {failedResults.length} 失败
                </Badge>
              )}
            </div>
            
            <ScrollArea className="h-48 border rounded-md p-2">
              <div className="space-y-1">
                {results.map((result, index) => (
                  <div 
                    key={index} 
                    className={`text-xs p-2 rounded ${
                      result.status === 'success' 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      <span className="font-medium">{result.name}</span>
                    </div>
                    {result.status === 'failed' && result.error && (
                      <p className="ml-5 text-red-500">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
