import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useData } from '@/contexts/useData';
import { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, XCircle, Eye, ImageIcon, Layers, Camera, Box, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PPTImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AnnotationInfo {
  id: string;
  snapshot_url: string;
  remark: string | null;
  workstation_id: string | null;
}

export function PPTImagePreviewDialog({ open, onOpenChange }: PPTImagePreviewDialogProps) {
  const {
    selectedProjectId,
    workstations: allWorkstations,
    modules: allModules,
    layouts: allLayouts,
    getProjectWorkstations,
    getWorkstationModules,
  } = useData();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');
  const [annotations, setAnnotations] = useState<Map<string, AnnotationInfo[]>>(new Map());
  const [productImages, setProductImages] = useState<Map<string, string[]>>(new Map());

  const projectWorkstations = selectedProjectId ? getProjectWorkstations(selectedProjectId) : [];

  // Fetch product annotations grouped by workstation
  useEffect(() => {
    if (!open || !selectedProjectId || projectWorkstations.length === 0) return;

    const wsIds = projectWorkstations.map(ws => ws.id);

    async function fetchData() {
      // Fetch annotations
      const { data: annoData } = await supabase
        .from('product_annotations')
        .select('id, snapshot_url, remark, workstation_id')
        .in('workstation_id', wsIds)
        .order('created_at', { ascending: false });

      if (annoData) {
        const grouped = new Map<string, AnnotationInfo[]>();
        for (const row of annoData) {
          const wsId = row.workstation_id;
          if (!wsId) continue;
          const arr = grouped.get(wsId) || [];
          arr.push(row);
          grouped.set(wsId, arr);
        }
        setAnnotations(grouped);
      }

      // Fetch product assets preview images
      const { data: assetData } = await supabase
        .from('product_assets')
        .select('workstation_id, preview_images')
        .in('workstation_id', wsIds);

      if (assetData) {
        const grouped = new Map<string, string[]>();
        for (const row of assetData) {
          const wsId = row.workstation_id;
          if (!wsId) continue;
          const imgs = Array.isArray(row.preview_images) ? (row.preview_images as string[]) : [];
          if (imgs.length === 0) continue;
          const existing = grouped.get(wsId) || [];
          existing.push(...imgs);
          grouped.set(wsId, existing);
        }
        setProductImages(grouped);
      }
    }

    fetchData();
  }, [open, selectedProjectId, projectWorkstations.length]);

  const imageData = useMemo(() => {
    let totalSaved = 0;
    let totalMissing = 0;

    const groups = projectWorkstations.map(ws => {
      const layout = allLayouts.find(l => l.workstation_id === ws.id);
      const modules = getWorkstationModules(ws.id);
      const wsAnnotations = annotations.get(ws.id) || [];
      const wsProductImages = productImages.get(ws.id) || [];

      const VIEW_LABELS: Record<string, string> = { front: '正视图', side: '侧视图', top: '俯视图', isometric: '等轴图' };
      const pv: string = (layout as any)?.primary_view || 'front';
      const av: string = (layout as any)?.auxiliary_view || 'side';
      const isoUrl = (layout as any)?.isometric_view_image_url || null;
      const layoutImages = [
        { label: `主视图 - ${VIEW_LABELS[pv] || pv}`, url: layout?.[`${pv}_view_image_url` as keyof typeof layout] as string || null },
        { label: `辅视图 - ${VIEW_LABELS[av] || av}`, url: layout?.[`${av}_view_image_url` as keyof typeof layout] as string || null },
        ...(isoUrl ? [{ label: '等轴图 3D 视图', url: isoUrl as string }] : []),
      ];

      const moduleImages = modules.map(mod => ({
        moduleName: mod.name,
        label: '光学方案图',
        url: (mod as any).schematic_image_url || null,
      }));

      // Lighting photos per module
      const lightingPhotos: Array<{ moduleName: string; url: string; remark: string }> = [];
      modules.forEach(mod => {
        const photos = Array.isArray((mod as any).lighting_photos) ? (mod as any).lighting_photos : [];
        photos.forEach((p: any) => {
          if (p?.url) {
            lightingPhotos.push({ moduleName: mod.name, url: p.url, remark: p.remark || '打光照片' });
          }
        });
      });

      layoutImages.forEach(img => img.url ? totalSaved++ : totalMissing++);
      moduleImages.forEach(img => img.url ? totalSaved++ : totalMissing++);
      totalSaved += wsAnnotations.length;
      totalSaved += wsProductImages.length;
      totalSaved += lightingPhotos.length;

      return { workstation: ws, layoutImages, moduleImages, annotations: wsAnnotations, productImages: wsProductImages, lightingPhotos };
    });

    return { groups, totalSaved, totalMissing };
  }, [projectWorkstations, allLayouts, getWorkstationModules, annotations, productImages]);

  const handlePreview = (url: string, label: string) => {
    setPreviewUrl(url);
    setPreviewLabel(label);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              PPT 图片预览
            </DialogTitle>
            <DialogDescription>
              检查各工位布局视图、模块光学方案图和产品标注截图是否已保存完整
            </DialogDescription>
          </DialogHeader>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              已保存: {imageData.totalSaved}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              缺失: {imageData.totalMissing}
            </Badge>
          </div>

          <Separator />

          <ScrollArea className="h-[60vh] pr-2">
            <div className="space-y-6">
              {imageData.groups.map(({ workstation, layoutImages, moduleImages, annotations: wsAnnotations, productImages: wsProductImages, lightingPhotos: wsLightingPhotos }) => (
                <div key={workstation.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">{workstation.name}</h4>
                    <span className="text-xs text-muted-foreground">{workstation.code || ''}</span>
                  </div>

                  {/* Layout views */}
                  <div className="ml-6">
                    <p className="text-xs text-muted-foreground mb-2">工位布局视图</p>
                    <div className="grid grid-cols-2 gap-3">
                      {layoutImages.map((img, i) => (
                        <ImageThumbnail
                          key={i}
                          label={img.label}
                          url={img.url}
                          onPreview={() => img.url && handlePreview(img.url, `${workstation.name} - ${img.label}`)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Module schematics */}
                  {moduleImages.length > 0 && (
                    <div className="ml-6">
                      <p className="text-xs text-muted-foreground mb-2">模块光学方案图</p>
                      <div className="grid grid-cols-3 gap-3">
                        {moduleImages.map((img, i) => (
                          <ImageThumbnail
                            key={i}
                            label={img.moduleName}
                            url={img.url}
                            onPreview={() => img.url && handlePreview(img.url, `${img.moduleName} - ${img.label}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product preview images */}
                  {wsProductImages.length > 0 && (
                    <div className="ml-6">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Box className="h-3 w-3" />
                        产品预览图
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {wsProductImages.map((url, i) => (
                          <ImageThumbnail
                            key={`prod-${i}`}
                            label={`预览图 ${i + 1}`}
                            url={url}
                            onPreview={() => handlePreview(url, `${workstation.name} - 产品预览图 ${i + 1}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product annotation snapshots */}
                  {wsAnnotations.length > 0 && (
                    <div className="ml-6">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        产品标注截图
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {wsAnnotations.map((anno) => (
                          <ImageThumbnail
                            key={anno.id}
                            label={anno.remark || '标注截图'}
                            url={anno.snapshot_url}
                            onPreview={() => handlePreview(anno.snapshot_url, `${workstation.name} - ${anno.remark || '标注截图'}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lighting photos */}
                  {wsLightingPhotos.length > 0 && (
                    <div className="ml-6">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Sun className="h-3 w-3" />
                        打光照片
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {wsLightingPhotos.map((lp, i) => (
                          <ImageThumbnail
                            key={`lp-${i}`}
                            label={`${lp.moduleName} - ${lp.remark}`}
                            url={lp.url}
                            onPreview={() => handlePreview(lp.url, `${lp.moduleName} - ${lp.remark}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator className="opacity-50" />
                </div>
              ))}

              {imageData.groups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  当前项目没有工位数据
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Fullsize preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewLabel}</DialogTitle>
            <DialogDescription>图片预览</DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center overflow-auto">
              <img
                src={previewUrl}
                alt={previewLabel}
                className="max-w-full max-h-[70vh] object-contain rounded-lg border border-border"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImageThumbnail({
  label,
  url,
  onPreview,
}: {
  label: string;
  url: string | null;
  onPreview: () => void;
}) {
  const saved = !!url;

  return (
    <div
      className={cn(
        'relative rounded-lg border-2 overflow-hidden aspect-video cursor-pointer group transition-colors',
        saved
          ? 'border-border hover:border-primary/50'
          : 'border-dashed border-muted-foreground/30 bg-muted/30'
      )}
      onClick={saved ? onPreview : undefined}
    >
      {saved ? (
        <>
          <img src={url} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <XCircle className="h-5 w-5 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/50">未保存</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white truncate">{label}</span>
          {saved ? (
            <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
          ) : (
            <XCircle className="h-3 w-3 text-red-400 shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

