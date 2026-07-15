import { useMemo } from 'react';
import { useData } from '@/contexts/useData';
import { Button } from '@/components/ui/button';
import { ImageOff, Camera, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutViewsPreviewProps {
  workstationId: string;
  className?: string;
  onOpenCanvas?: () => void;
}

type ViewType = 'front' | 'side' | 'top' | 'isometric';

const VIEW_LABELS: Record<ViewType, string> = {
  front: '正视图',
  side: '侧视图',
  top: '俯视图',
  isometric: '等轴图',
};

export function LayoutViewsPreview({ workstationId, className, onOpenCanvas }: LayoutViewsPreviewProps) {
  const { getLayoutByWorkstation, workstations } = useData();
  
  const workstation = workstations.find(ws => ws.id === workstationId);
  const layout = getLayoutByWorkstation(workstationId) as any;
  
  const primaryView: ViewType = layout?.primary_view || 'front';
  const auxiliaryView: ViewType = layout?.auxiliary_view || 'side';
  const layoutDescription: string = layout?.layout_description || '';

  const viewUrl = (view: ViewType): string | null => {
    return layout?.[`${view}_view_image_url`] || null;
  };

  const isometricUrl: string | null = layout?.isometric_view_image_url || null;
  const primaryUrl = viewUrl(primaryView);
  const auxiliaryUrl = viewUrl(auxiliaryView);
  const allSaved = !!primaryUrl && !!auxiliaryUrl && !!isometricUrl;
  const noneSaved = !primaryUrl && !auxiliaryUrl && !isometricUrl;
  
  const wsCode = (workstation as any)?.code || '';
  const wsName = workstation?.name || '';
  
  const renderImage = (url: string | null, label: string) => (
    <div className="space-y-1.5">
      <div className="text-xs text-center text-muted-foreground font-medium">
        {label}
      </div>
      <div 
        className={cn(
          "rounded-lg border-2 border-dashed overflow-hidden flex items-center justify-center aspect-[4/3]",
          url 
            ? "border-primary/30 bg-background" 
            : "border-muted-foreground/20 bg-muted/30"
        )}
      >
        {url ? (
          <img 
            src={`${url}${url.includes('?') ? '&' : '?'}t=${layout?.updated_at || ''}`} 
            alt={label}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div class="flex flex-col items-center gap-1 text-muted-foreground">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                    </svg>
                    <span class="text-xs">加载失败</span>
                  </div>
                `;
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground p-2">
            <ImageOff className="h-5 w-5" />
            <span className="text-xs">未保存</span>
          </div>
        )}
      </div>
    </div>
  );
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          {wsCode && `${wsCode} `}{wsName} - 机械布局视图
        </h4>
        {onOpenCanvas && (
          <Button variant="ghost" size="sm" onClick={onOpenCanvas} className="gap-1 text-xs">
            打开画布
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {/* Views: Primary + Auxiliary */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          {renderImage(primaryUrl, `主视图 - ${VIEW_LABELS[primaryView]}`)}
        </div>
        <div>
          {renderImage(auxiliaryUrl, `辅视图 - ${VIEW_LABELS[auxiliaryView]}`)}
        </div>
      </div>

      {/* Isometric 3D view */}
      {isometricUrl && (
        <div>
          {renderImage(isometricUrl, '等轴图 3D 视图')}
        </div>
      )}

      {/* Layout Description */}
      {layoutDescription && (
        <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">【布局说明】</div>
          <div className="text-sm text-foreground whitespace-pre-wrap">
            {layoutDescription}
          </div>
        </div>
      )}
      
      {/* Motion Description */}
      {(workstation as any)?.motion_description && (
        <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">【运动方式】</div>
          <div className="text-sm text-foreground">
            {(workstation as any).motion_description}
          </div>
        </div>
      )}
      
      {/* Status & Hint */}
      {noneSaved && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Camera className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            布局视图未保存。请在右侧布局画布中点击“保存视图”按钮来生成截图。
          </p>
        </div>
      )}
      
      {!noneSaved && !allSaved && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Camera className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            部分视图已保存。建议在布局画布中保存所有选定视角。
          </p>
        </div>
      )}
    </div>
  );
}

