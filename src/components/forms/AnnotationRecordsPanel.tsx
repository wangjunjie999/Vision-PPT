import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Star,
  Trash2,
  Eye,
  Loader2,
  FileImage,
  Clock,
  ArrowLeft,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Annotation } from '@/components/product/AnnotationCanvas';
import { toLocalProxyUrl } from '@/utils/storageUrl';
import { reorderProductAnnotations, setPptDefaultAnnotation } from '@/services/productAnnotationService';

interface AnnotationRecord {
  id: string;
  asset_id: string;
  snapshot_url: string;
  annotations_json: Annotation[];
  view_meta: Record<string, unknown> | null;
  version: number;
  remark: string | null;
  created_at: string;
  media_id: string | null;
  sort_order?: number | null;
}

export function AnnotationRecordsPanel() {
  const { user } = useAuth();
  const { annotationAssetId, exitAnnotationMode } = useAppStore();
  const [records, setRecords] = useState<AnnotationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultRecordId, setDefaultRecordId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const isInitialLoad = useRef(true);

  const loadRecords = useCallback(async () => {
    if (!annotationAssetId || !user) return;
    if (isInitialLoad.current) {
      setLoading(true);
    }
    try {
      // Scope by asset_id only. Product asset already belongs to one workstation,
      // so extra workstation_id filter would hide legacy records saved without it.
      const { data, error } = await supabase
        .from('product_annotations')
        .select('*')
        .eq('asset_id', annotationAssetId)
        .order('sort_order', { ascending: true })
        .order('version', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(a => ({
        ...a,
        annotations_json: a.annotations_json as unknown as Annotation[],
        view_meta: a.view_meta as Record<string, unknown> | null,
      }));
      setRecords(mapped);
      const dbDefault = mapped.find(r => (r as any).is_ppt_default);
      if (dbDefault) {
        setDefaultRecordId(dbDefault.id);
      } else if (mapped.length > 0 && !defaultRecordId) {
        setDefaultRecordId(mapped[0].id);
      }
    } catch (error) {
      console.error('Failed to load annotation records:', error);
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [annotationAssetId, user]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Auto-refresh when annotation is saved (poll every 3s while in annotation mode).
  // Pause while user is dragging to avoid clobbering local order.
  useEffect(() => {
    if (dragId || reordering) return;
    const interval = setInterval(loadRecords, 3000);
    return () => clearInterval(interval);
  }, [loadRecords, dragId, reordering]);

  const handleDelete = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('product_annotations')
        .delete()
        .eq('id', recordId);
      if (error) throw error;
      await loadRecords();
      toast.success('记录已删除');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('删除失败');
    }
  };

  const handleSetDefault = async (recordId: string) => {
    if (!annotationAssetId) return;
    try {
      await setPptDefaultAnnotation(annotationAssetId, recordId);
      setDefaultRecordId(recordId);
      await loadRecords();
      toast.success('已设为PPT默认使用');
    } catch (error) {
      console.error('Set default failed:', error);
      toast.error('设置默认标注失败');
    }
  };

  const handleReorderByDrag = async (sourceId: string, targetId: string) => {
    if (!annotationAssetId || sourceId === targetId) return;
    const fromIdx = records.findIndex(r => r.id === sourceId);
    const toIdx = records.findIndex(r => r.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...records];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const prev = records;
    setRecords(next);
    setReordering(true);
    try {
      await reorderProductAnnotations(annotationAssetId, next.map(r => r.id));
    } catch (error) {
      console.error('Reorder failed:', error);
      toast.error('排序失败');
      setRecords(prev);
    } finally {
      setReordering(false);
    }
  };

  return (
    <Card className="glass-panel h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileImage className="h-4 w-4 text-primary" />
            标注记录 {records.length > 0 && <span className="text-xs text-muted-foreground">({records.length})</span>}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={exitAnnotationMode} className="gap-1 h-7 text-xs">
            <ArrowLeft className="h-3 w-3" />
            返回
          </Button>
        </div>
        {records.length > 1 && (
          <p className="mt-1 text-[10px] text-muted-foreground">拖动左侧手柄可上下调整顺序</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0 px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileImage className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-xs">暂无标注记录</p>
            <p className="text-xs">在左侧画布完成标注并保存</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  draggable
                  onDragStart={(e) => {
                    setDragId(record.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', record.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverId !== record.id) setDragOverId(record.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === record.id) setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceId = dragId || e.dataTransfer.getData('text/plain');
                    setDragId(null);
                    setDragOverId(null);
                    if (sourceId && sourceId !== record.id) {
                      void handleReorderByDrag(sourceId, record.id);
                    }
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  className={cn(
                    "border rounded-lg p-3 space-y-2 transition-colors",
                    defaultRecordId === record.id && "border-primary/50 bg-primary/5",
                    dragId === record.id && "opacity-50",
                    dragOverId === record.id && "border-primary ring-2 ring-primary/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                      title="拖拽排序"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5">
                      产品标注图片
                    </Badge>
                  </div>
                  {/* Thumbnail */}
                  <div
                    className="aspect-video rounded overflow-hidden bg-muted cursor-pointer group"
                    onClick={() => setPreviewUrl(record.snapshot_url)}
                    title="点击放大查看"
                  >
                    <img
                      src={toLocalProxyUrl(record.snapshot_url)}
                      alt={`标注版本${record.version}`}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        V{record.version}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Array.isArray(record.annotations_json) ? record.annotations_json.length : 0} 个标注
                      </span>
                    </div>
                    {defaultRecordId === record.id && (
                      <Badge variant="default" className="text-xs">
                        PPT默认
                      </Badge>
                    )}
                  </div>

                  {record.remark && (
                    <p className="text-xs text-muted-foreground truncate">{record.remark}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(record.created_at).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleSetDefault(record.id)}
                        title="设为PPT默认"
                      >
                        <Star className={cn("h-3 w-3", defaultRecordId === record.id && "fill-primary text-primary")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(record.id)}
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Lightbox Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          {previewUrl && (
            <img
              src={toLocalProxyUrl(previewUrl)}
              alt="标注大图"
              className="w-full h-full object-contain max-h-[85vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
