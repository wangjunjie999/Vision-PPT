import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Link2, Plus, Box, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Product3DAnnotator } from './Product3DAnnotator';
import { useProductAssets } from '@/hooks/useProductAssets';
import type { ProductAsset } from '@/types/product';

interface ProductAssetPanelProps {
  scope: 'workstation' | 'module';
  workstationId?: string;
  moduleId?: string;
  parentWorkstationId?: string; // For module to reference parent workstation asset
}

export function ProductAssetPanel({
  scope,
  workstationId,
  moduleId,
  parentWorkstationId,
}: ProductAssetPanelProps) {
  const {
    assets,
    getAssetByWorkstation,
    getAssetByModule,
    getAnnotationsByAsset,
    createAsset,
  } = useProductAssets();

  const [showAnnotator, setShowAnnotator] = useState(false);

  // Get current asset based on scope
  const currentAsset = scope === 'workstation' && workstationId
    ? getAssetByWorkstation(workstationId)
    : scope === 'module' && moduleId
    ? getAssetByModule(moduleId)
    : undefined;

  // Get parent workstation asset for module reference
  const parentAsset = parentWorkstationId 
    ? getAssetByWorkstation(parentWorkstationId)
    : undefined;

  const annotationCount = currentAsset 
    ? getAnnotationsByAsset(currentAsset.id).length 
    : 0;

  const handleReferenceWorkstation = async () => {
    if (!parentAsset || !moduleId) return;

    try {
      // Create a module-scope asset that references the workstation asset
      const newAsset = await createAsset({
        scope_type: 'module',
        module_id: moduleId,
        source_type: parentAsset.source_type,
        model_file_url: parentAsset.model_file_url || undefined,
        preview_images: parentAsset.preview_images,
      });

      if (newAsset) {
        toast.success('已关联工位标注资产');
        setShowAnnotator(true);
      }
    } catch (error) {
      console.error('Failed to reference workstation asset:', error);
      toast.error('关联失败');
    }
  };

  if (scope === 'module' && !currentAsset && parentAsset) {
    // Show reference button for module without asset but with parent workstation asset
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Box className="h-4 w-4" />
            产品标注
            <Badge variant="secondary" className="text-xs">模块级</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            工位已有产品3D资产，可引用后进行模块级标注
          </p>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleReferenceWorkstation}
              className="flex-1"
            >
              <Link2 className="h-4 w-4 mr-2" />
              引用工位标注
            </Button>
            <Dialog open={showAnnotator} onOpenChange={setShowAnnotator}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  新建标注
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>模块级产品标注</DialogTitle>
                </DialogHeader>
                <Product3DAnnotator
                  scope="module"
                  moduleId={moduleId}
                  onAssetCreated={() => setShowAnnotator(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (currentAsset) {
    // Show existing asset summary with edit option
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Box className="h-4 w-4" />
            产品3D与特征标注
            {scope === 'workstation' ? (
              <Badge variant="outline" className="text-xs">工位级</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">模块级</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            {currentAsset.preview_images.length > 0 && (
              <img 
                src={currentAsset.preview_images[0]} 
                alt="Preview" 
                className="w-16 h-12 object-cover rounded border"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {currentAsset.source_type.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {annotationCount} 个标注记录
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(currentAsset.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <Dialog open={showAnnotator} onOpenChange={setShowAnnotator}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                查看与编辑
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {scope === 'workstation' ? '工位级' : '模块级'}产品标注
                </DialogTitle>
              </DialogHeader>
              <Product3DAnnotator
                scope={scope}
                workstationId={workstationId}
                moduleId={moduleId}
              />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  // Default: show full annotator for new asset
  return (
    <Product3DAnnotator
      scope={scope}
      workstationId={workstationId}
      moduleId={moduleId}
    />
  );
}
