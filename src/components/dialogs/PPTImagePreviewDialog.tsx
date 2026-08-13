import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useData } from '@/contexts/useData';
import type { WorkstationProductAsset } from '@/lib/productLayoutSync';
import { cn } from '@/lib/utils';
import {
  buildProductMediaItems,
  formatProductMediaCaption,
  getProductMediaDisplayUrl,
  paginateProductMedia,
  resolveProductImagesPerPage,
  type ProductAnnotationMedia,
  type ProductMediaRecord,
} from '@/utils/productAssetMedia';
import type { GenerationScope } from './pptGenerationScope';
import { Box, Camera, CheckCircle2, Eye, ImageIcon, Layers, Star, Sun, XCircle } from 'lucide-react';

interface PPTImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: GenerationScope;
  workstationIds: string[];
  moduleIds: string[];
  productAssets: WorkstationProductAsset[];
  productMedia: ProductMediaRecord[];
  annotations: ProductAnnotationMedia[];
}

interface AnnotationInfo extends ProductAnnotationMedia {
  id: string;
  asset_id: string;
  media_id: string | null;
  snapshot_url: string | null;
  remark: string | null;
  version: number | null;
  is_ppt_default: boolean;
  created_at: string | null;
  annotations_json?: unknown;
  updated_at?: string | null;
}

interface ProductMediaInfo extends ProductMediaRecord {
  annotation: AnnotationInfo | null;
}

interface ProductInfo {
  id: string;
  workstation_id: string;
  product_name: string | null;
  product_code: string | null;
  is_primary: boolean;
  sort_order: number;
  document_images_per_page: 1 | 2;
  preview_images?: unknown;
  media: ProductMediaInfo[];
}

export function PPTImagePreviewDialog({
  open,
  onOpenChange,
  scope,
  workstationIds,
  moduleIds,
  productAssets,
  productMedia,
  annotations,
}: PPTImagePreviewDialogProps) {
  const { workstations, modules, layouts } = useData();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');

  const projectWorkstations = useMemo(
    () => {
      const selectedIds = new Set(workstationIds);
      return workstations.filter(workstation => selectedIds.has(workstation.id));
    },
    [workstationIds, workstations],
  );

  const productsByWorkstation = useMemo(() => {
    const grouped = new Map<string, ProductInfo[]>();
    for (const asset of productAssets) {
      if (asset.scope_type !== 'workstation' || !asset.workstation_id) continue;
      const media = buildProductMediaItems(
        asset.id,
        productMedia,
        annotations,
        asset.preview_images,
      ).map(item => ({
        ...item.media,
        annotation: item.annotation as AnnotationInfo | null,
      }));
      const product: ProductInfo = {
        id: asset.id,
        workstation_id: asset.workstation_id,
        product_name: asset.product_name,
        product_code: asset.product_code,
        is_primary: asset.is_primary ?? false,
        sort_order: asset.sort_order ?? 0,
        document_images_per_page: Number(asset.document_images_per_page) === 2 ? 2 : 1,
        preview_images: asset.preview_images,
        media,
      };
      const workstationProducts = grouped.get(asset.workstation_id) || [];
      workstationProducts.push(product);
      workstationProducts.sort((left, right) =>
        Number(right.is_primary) - Number(left.is_primary) || left.sort_order - right.sort_order
      );
      grouped.set(asset.workstation_id, workstationProducts);
    }
    return grouped;
  }, [annotations, productAssets, productMedia]);

  const selectedModuleIds = useMemo(() => new Set(moduleIds), [moduleIds]);

  const imageData = useMemo(() => {
    let totalSaved = 0;
    let totalMissing = 0;
    let productCount = 0;
    let productPageCount = 0;
    let placeholderProductPageCount = 0;
    const groups = projectWorkstations.map(workstation => {
      const layout = scope === 'modules'
        ? undefined
        : layouts.find(item => item.workstation_id === workstation.id);
      const workstationModules = modules.filter(module =>
        module.workstation_id === workstation.id && selectedModuleIds.has(module.id)
      );
      const products = productsByWorkstation.get(workstation.id) || [];
      const viewLabels: Record<string, string> = { front: '正视图', side: '侧视图', top: '俯视图', isometric: '等轴图' };
      const primaryView = String((layout as { primary_view?: string } | undefined)?.primary_view || 'front');
      const auxiliaryView = String((layout as { auxiliary_view?: string } | undefined)?.auxiliary_view || 'side');
      const isometricUrl = (layout as { isometric_view_image_url?: string | null } | undefined)?.isometric_view_image_url || null;
      const layoutImages = scope === 'modules'
        ? []
        : [
          {
            label: `主视图 - ${viewLabels[primaryView] || primaryView}`,
            url: (layout?.[`${primaryView}_view_image_url` as keyof typeof layout] as string | null) || null,
          },
          {
            label: `辅视图 - ${viewLabels[auxiliaryView] || auxiliaryView}`,
            url: (layout?.[`${auxiliaryView}_view_image_url` as keyof typeof layout] as string | null) || null,
          },
          ...(isometricUrl ? [{ label: '等轴图 / 3D 视图', url: isometricUrl }] : []),
        ];
      const moduleImages = workstationModules.map(module => ({
        moduleName: module.name,
        label: '光学方案图',
        url: module.schematic_image_url || null,
      }));
      const lightingPhotos = workstationModules.flatMap(module => {
        const photos = Array.isArray(module.lighting_photos)
          ? module.lighting_photos as Array<{ url?: string; remark?: string }>
          : [];
        return photos.flatMap(photo => photo?.url
          ? [{ moduleName: module.name, url: photo.url, remark: photo.remark || '打光照片' }]
          : []);
      });

      layoutImages.forEach(image => image.url ? totalSaved += 1 : totalMissing += 1);
      moduleImages.forEach(image => image.url ? totalSaved += 1 : totalMissing += 1);
      totalSaved += lightingPhotos.length;
      products.forEach(product => {
        const pages = paginateProductMedia([product], productMedia, annotations);
        productCount += 1;
        productPageCount += pages.length;
        placeholderProductPageCount += pages.filter(page => page.items.length === 0).length;
        const mediaCount = product.media.length;
        if (mediaCount > 0) totalSaved += mediaCount;
        else totalMissing += 1;
      });

      return { workstation, layoutImages, moduleImages, lightingPhotos, products };
    });
    return {
      groups,
      totalSaved,
      totalMissing,
      productCount,
      productPageCount,
      placeholderProductPageCount,
    };
  }, [
    annotations,
    layouts,
    modules,
    productMedia,
    productsByWorkstation,
    projectWorkstations,
    scope,
    selectedModuleIds,
  ]);

  const handlePreview = (url: string, label: string) => {
    setPreviewUrl(url);
    setPreviewLabel(label);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              PPT 图片预览
            </DialogTitle>
            <DialogDescription>
              产品图片按产品 ID 独立展示；每张图片只出现一次，标注后优先预览标注结果。
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" />已保存：{imageData.totalSaved}</Badge>
            <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3 text-destructive" />缺失：{imageData.totalMissing}</Badge>
            <Badge variant="outline">产品：{imageData.productCount}</Badge>
            <Badge variant="outline">产品页：{imageData.productPageCount}</Badge>
            {imageData.placeholderProductPageCount > 0 && (
              <Badge variant="secondary">占位页：{imageData.placeholderProductPageCount}</Badge>
            )}
          </div>
          <Separator />

          <ScrollArea className="h-[64vh] pr-3">
            <div className="space-y-7">
              {imageData.groups.map(group => (
                <section key={group.workstation.id} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">{group.workstation.name}</h4>
                    <span className="text-xs text-muted-foreground">{group.workstation.code || ''}</span>
                  </div>

                  {group.layoutImages.length > 0 && (
                    <MediaSection title="工位布局视图" className="grid-cols-2">
                      {group.layoutImages.map(image => (
                        <ImageThumbnail key={image.label} label={image.label} url={image.url} onPreview={() => image.url && handlePreview(image.url, `${group.workstation.name} - ${image.label}`)} />
                      ))}
                    </MediaSection>
                  )}

                  {group.moduleImages.length > 0 && (
                    <MediaSection title="模块光学方案图">
                      {group.moduleImages.map(image => (
                        <ImageThumbnail key={`${image.moduleName}-${image.label}`} label={image.moduleName} url={image.url} onPreview={() => image.url && handlePreview(image.url, `${image.moduleName} - ${image.label}`)} />
                      ))}
                    </MediaSection>
                  )}

                  <div className="ml-6 space-y-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Box className="h-3 w-3" />产品图片与标注（按产品分组）</p>
                    {group.products.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">当前工位未配置产品。</div>
                    ) : group.products.map((product, productIndex) => {
	                      const productLabel = product.product_name || product.product_code || `产品 ${productIndex + 1}`;
	                      const annotatedCount = product.media.filter(media => media.annotation).length;
	                      const hasMedia = product.media.length > 0;
	                      const imagesPerPage = resolveProductImagesPerPage(product);
	                      const mediaPages = paginateProductMedia(
	                        [product],
	                        productMedia,
	                        annotations,
	                      );
	                      return (
	                        <div key={product.id} className="rounded-xl border bg-muted/10 p-3 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{productIndex + 1}. {productLabel}</span>
	                            {product.is_primary && <Badge className="gap-1"><Star className="h-3 w-3 fill-current" />主产品</Badge>}
	                            <Badge variant="outline">图片 {product.media.length}</Badge>
	                            <Badge variant="outline">已标注 {annotatedCount}</Badge>
	                            <Badge variant="secondary">
	                              {imagesPerPage === 1 ? '单页单图（大图）' : '单页双图（紧凑）'}
	                            </Badge>
	                            <Badge variant="outline">预计 {mediaPages.length} 页</Badge>
	                            {!hasMedia && <Badge variant="secondary">生成占位页</Badge>}
	                          </div>
	                          <div className="space-y-3">
	                            {mediaPages.map(page => (
	                              <div key={`${product.id}-${page.pageIndex}`} className="rounded-lg border bg-background/70 p-2">
	                                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
	                                  <span>文档页 {page.pageIndex + 1}/{page.pageCount}</span>
	                                  <span>本页 {page.items.length} 张</span>
	                                </div>
	                                <div className={cn(
	                                  'grid gap-3',
	                                  page.imagesPerPage === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-2',
	                                )}>
	                                  {page.items.map(item => {
	                                    const displayUrl = getProductMediaDisplayUrl(item);
	                                    const label = formatProductMediaCaption(item);
	                                    return (
	                                      <ImageThumbnail
	                                        key={item.media.id}
	                                        label={label.replace(/\n/g, ' · ')}
	                                        url={displayUrl}
	                                        onPreview={() => handlePreview(displayUrl, `${group.workstation.name} / ${productLabel} / ${item.media.file_name}`)}
	                                      />
	                                    );
	                                  })}
	                                </div>
	                              </div>
	                            ))}
	                            {!hasMedia && <ImageThumbnail label={`${productLabel}：未上传产品图片，将生成占位页`} url={null} onPreview={() => undefined} />}
	                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {group.lightingPhotos.length > 0 && (
                    <MediaSection title="打光照片" icon={<Sun className="h-3 w-3" />}>
                      {group.lightingPhotos.map((photo, index) => (
                        <ImageThumbnail key={`${photo.moduleName}-${index}`} label={`${photo.moduleName} - ${photo.remark}`} url={photo.url} onPreview={() => handlePreview(photo.url, `${photo.moduleName} - ${photo.remark}`)} />
                      ))}
                    </MediaSection>
                  )}
                  <Separator className="opacity-50" />
                </section>
              ))}
              {imageData.groups.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">当前项目没有工位数据</div>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{previewLabel}</DialogTitle><DialogDescription>图片预览</DialogDescription></DialogHeader>
          {previewUrl && <div className="flex items-center justify-center overflow-auto"><img src={previewUrl} alt={previewLabel} className="max-w-full max-h-[70vh] object-contain rounded-lg border" /></div>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MediaSection({ title, children, className, icon }: { title: string; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <div className="ml-6">
      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">{icon || <Camera className="h-3 w-3" />}{title}</p>
      <div className={cn('grid grid-cols-3 gap-3', className)}>{children}</div>
    </div>
  );
}

function ImageThumbnail({ label, url, onPreview }: { label: string; url: string | null; onPreview: () => void }) {
  const saved = Boolean(url);
  return (
    <div className={cn('relative rounded-lg border-2 overflow-hidden aspect-video group transition-colors', saved ? 'cursor-pointer border-border hover:border-primary/50' : 'border-dashed border-muted-foreground/30 bg-muted/30')} onClick={saved ? onPreview : undefined}>
      {saved ? (
        <><img src={url!} alt={label} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"><Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" /></div></>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1 px-3 text-center"><XCircle className="h-5 w-5 text-muted-foreground/50" /><span className="text-[10px] text-muted-foreground">{label}</span></div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
        <div className="flex items-center justify-between gap-1"><span className="text-[10px] text-white truncate">{label}</span>{saved ? <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" /> : <XCircle className="h-3 w-3 text-red-400 shrink-0" />}</div>
      </div>
    </div>
  );
}
