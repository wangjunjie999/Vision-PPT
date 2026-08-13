import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/contexts/useData';
import type { WorkstationProductAsset } from '@/lib/productLayoutSync';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { Link2, Loader2, LocateFixed, Move3d, PackagePlus, Ruler, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProductLayoutFormPanelProps {
  workstationId: string;
  defaultDimensions: { length: number; width: number; height: number };
}

type NumericProductField = 'length_mm' | 'width_mm' | 'height_mm' | 'pos_x' | 'pos_y' | 'pos_z';

function parsePositiveDimension(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function parseCoordinate(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

export function ProductLayoutFormPanel({ workstationId, defaultDimensions }: ProductLayoutFormPanelProps) {
  const {
    loading,
    getWorkstationProductAssets,
    addProductAsset,
    updateProductAsset,
    deleteProductAsset,
    setPrimaryProductAsset,
  } = useData();
  const selectedProductId = useAppStore(state => state.selectedProductAssetId);
  const selectProductAsset = useAppStore(state => state.selectProductAsset);
  const requestLayoutObjectFocus = useAppStore(state => state.requestLayoutObjectFocus);
  const products = useMemo(
    () => getWorkstationProductAssets(workstationId),
    [getWorkstationProductAssets, workstationId],
  );
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkstationProductAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (selectedProductId && products.some(product => product.id === selectedProductId)) return;
    selectProductAsset(products[0]?.id || null);
  }, [products, selectProductAsset, selectedProductId]);

  const selectOnCanvas = (productAssetId: string) => {
    selectProductAsset(productAssetId);
    requestLayoutObjectFocus(workstationId, `product-${productAssetId}`);
  };

  const addProduct = async () => {
    setCreating(true);
    try {
      const nextOrder = products.length ? Math.max(...products.map(product => product.sort_order ?? 0)) + 1 : 0;
      const offsetIndex = products.length;
      const posY = offsetIndex === 0
        ? 0
        : (offsetIndex % 2 === 0 ? 1 : -1) * Math.ceil(offsetIndex / 2) * (defaultDimensions.width + 100);
      const data = await addProductAsset({
          workstation_id: workstationId,
          scope_type: 'workstation',
          source_type: 'image',
          product_name: `产品 ${products.length + 1}`,
          sort_order: nextOrder,
          is_primary: products.length === 0,
          length_mm: defaultDimensions.length,
          width_mm: defaultDimensions.width,
          height_mm: defaultDimensions.height,
          pos_x: 0,
          pos_y: posY,
          pos_z: 0,
        });
      selectOnCanvas(data.id);
      toast.success('产品已添加，并同步到机械布局');
    } catch (error) {
      console.error(error);
      toast.error('添加产品失败');
    } finally {
      setCreating(false);
    }
  };

  const savePatch = async (product: WorkstationProductAsset, patch: Partial<WorkstationProductAsset>) => {
    setSavingId(product.id);
    try {
      await updateProductAsset(product.id, patch, { silent: true });
    } catch (error) {
      console.error(error);
      toast.error('产品参数保存失败');
    }
    setSavingId(null);
  };

  const saveName = (product: WorkstationProductAsset, value: string) => {
    const name = value.trim();
    if (!name || name === product.product_name) return;
    savePatch(product, { product_name: name });
  };

  const saveNumericField = (product: WorkstationProductAsset, field: NumericProductField, value: string) => {
    const parsed = field.startsWith('pos_') ? parseCoordinate(value) : parsePositiveDimension(value);
    if (parsed === undefined) {
      toast.error(field.startsWith('pos_') ? '位置必须是有效数字' : '尺寸必须大于 0');
      return;
    }
    if (parsed === product[field]) return;
    savePatch(product, { [field]: parsed });
  };

  const deleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const remaining = products.filter(product => product.id !== deleteTarget.id);
      await deleteProductAsset(deleteTarget.id);
      selectProductAsset(remaining[0]?.id || null);
      setDeleteTarget(null);
      toast.success('产品已从表单和机械布局中删除');
    } catch (error) {
      console.error(error);
      toast.error('删除产品失败');
    } finally {
      setDeleting(false);
    }
  };

  const setPrimary = async (product: WorkstationProductAsset) => {
    if (product.is_primary) return;
    try {
      await setPrimaryProductAsset(workstationId, product.id);
      toast.success('主产品已更新');
    } catch (error) {
      console.error(error);
      toast.error('设置主产品失败');
    }
  };

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4 text-primary" />
              布局产品
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{products.length}</Badge>
            </CardTitle>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              此处与左侧机械布局双向同步；修改名称、尺寸或坐标后，画布立即更新。
            </p>
          </div>
          <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={addProduct} disabled={creating || loading}>
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackagePlus className="h-3.5 w-3.5" />}
            添加产品
          </Button>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          产品资产是唯一数据源，布局对象通过产品 ID 关联
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-7 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />加载产品…
          </div>
        ) : products.length === 0 ? (
          <button
            type="button"
            onClick={addProduct}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-background/60 px-4 py-7 text-center transition-colors hover:border-primary/60 hover:bg-primary/[0.04]"
          >
            <PackagePlus className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">添加第一个布局产品</span>
            <span className="text-[11px] text-muted-foreground">将继承工位默认尺寸，之后可单独调整</span>
          </button>
        ) : products.map((product, index) => {
          const isSelected = selectedProductId === product.id;
          return (
            <div
              key={product.id}
              className={cn(
                'rounded-lg border bg-background/70 p-3 transition-all',
                isSelected ? 'border-primary/60 shadow-sm ring-1 ring-primary/15' : 'border-border/70 hover:border-primary/30',
              )}
              onClick={() => selectOnCanvas(product.id)}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  {index + 1}
                </span>
                <Input
                  key={`${product.id}-${product.product_name}`}
                  defaultValue={product.product_name || `产品 ${index + 1}`}
                  onClick={event => event.stopPropagation()}
                  onBlur={event => saveName(product, event.target.value)}
                  className="h-8 flex-1 border-transparent bg-transparent px-2 font-medium hover:border-input focus:border-input focus:bg-background"
                  aria-label={`产品 ${index + 1} 名称`}
                />
                {product.is_primary ? (
                  <Badge className="h-5 gap-1 px-1.5 text-[10px]"><Star className="h-2.5 w-2.5" />主产品</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    title="设为主产品"
                    onClick={event => { event.stopPropagation(); void setPrimary(product); }}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                )}
                {savingId === product.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[10px]"
                  onClick={event => { event.stopPropagation(); selectOnCanvas(product.id); }}
                >
                  <LocateFixed className="h-3 w-3" />定位
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={event => { event.stopPropagation(); setDeleteTarget(product); }}
                  aria-label={`删除 ${product.product_name || `产品 ${index + 1}`}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Ruler className="h-3 w-3" />产品尺寸 (mm)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['length_mm', 'L', defaultDimensions.length],
                  ['width_mm', 'W', defaultDimensions.width],
                  ['height_mm', 'H', defaultDimensions.height],
                ] as const).map(([field, label, fallback]) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                    <Input
                      key={`${product.id}-${field}-${product[field]}`}
                      type="number"
                      min="1"
                      defaultValue={product[field] ?? ''}
                      placeholder={String(fallback)}
                      onClick={event => event.stopPropagation()}
                      onBlur={event => saveNumericField(product, field, event.target.value)}
                      className="h-8 font-mono text-xs"
                      aria-label={`${product.product_name || `产品 ${index + 1}`} ${label} 尺寸`}
                    />
                  </div>
                ))}
              </div>

              <div className="mb-2 mt-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Move3d className="h-3 w-3" />布局坐标 (mm)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['pos_x', 'X'],
                  ['pos_y', 'Y'],
                  ['pos_z', 'Z'],
                ] as const).map(([field, label]) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                    <Input
                      key={`${product.id}-${field}-${product[field]}`}
                      type="number"
                      defaultValue={product[field] ?? 0}
                      onClick={event => event.stopPropagation()}
                      onBlur={event => saveNumericField(product, field, event.target.value)}
                      className="h-8 font-mono text-xs"
                      aria-label={`${product.product_name || `产品 ${index + 1}`} ${label} 坐标`}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {products.some(product => product.length_mm == null || product.width_mm == null || product.height_mm == null) && (
          <p className="px-1 text-[10px] leading-4 text-muted-foreground">
            空白尺寸沿用工位默认值：{defaultDimensions.length} × {defaultDimensions.width} × {defaultDimensions.height} mm
          </p>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除“{deleteTarget?.product_name || '未命名产品'}”？</AlertDialogTitle>
              <AlertDialogDescription>
                该产品会同时从机械布局中移除，其 3D 模型、图片和标注记录也会被删除。此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteProduct}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
