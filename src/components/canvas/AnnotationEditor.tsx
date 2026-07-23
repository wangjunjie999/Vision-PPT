import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { renderAnnotationsToCanvas } from '@/utils/annotationRenderer';
import { isUsableAnnotationSnapshot } from '@/utils/productViewer';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AnnotationCanvas, Annotation, ImageTransform } from '@/components/product/AnnotationCanvas';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'mark', label: 'Mark点' },
  { value: 'qrcode', label: '二维码' },
  { value: 'hole', label: '定位孔' },
  { value: 'pole', label: '极柱' },
  { value: 'edge', label: '边缘' },
  { value: 'surface', label: '表面' },
  { value: 'defect', label: '缺陷检测区' },
  { value: 'other', label: '其他' },
];

export function AnnotationEditor() {
  const { user } = useAuth();
  const { annotationSnapshot, annotationAssetId, annotationWorkstationId, annotationExistingData, exitAnnotationMode } = useAppStore();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveRemark, setSaveRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  // Sequential edit mode
  const [sequentialMode, setSequentialMode] = useState(false);
  const [currentEditIndex, setCurrentEditIndex] = useState(0);
  const [editingAnnotations, setEditingAnnotations] = useState<Annotation[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [imageTransform, setImageTransform] = useState<ImageTransform>({ rotation: 0, flipH: false, flipV: false });

  // Sync editor state whenever a new annotation session starts.
  useEffect(() => {
    if (annotationExistingData) {
      setAnnotations((annotationExistingData.annotations || []) as Annotation[]);
      setSaveRemark(annotationExistingData.remark || '');
      setReadOnly(Boolean(annotationExistingData.recordId));
    } else {
      setAnnotations([]);
      setSaveRemark('');
      setReadOnly(false);
    }

    setSequentialMode(false);
    setCurrentEditIndex(0);
    setEditingAnnotations([]);
    setHighlightId(null);
    setImageTransform({ rotation: 0, flipH: false, flipV: false });
  }, [annotationSnapshot, annotationExistingData]);

  const handleStartSave = useCallback(() => {
    if (annotations.length === 0) return;

    // Check for unnamed annotations
    const unnamed = annotations.filter(a => !a.name);
    if (unnamed.length > 0) {
      // Enter sequential edit mode
      setEditingAnnotations([...annotations]);
      setCurrentEditIndex(0);
      setHighlightId(annotations[0].id);
      setSequentialMode(true);
    } else {
      // All named, go directly to save dialog
      setSaveDialogOpen(true);
    }
  }, [annotations]);

  const handleSequentialUpdate = (field: string, value: string) => {
    setEditingAnnotations(prev => prev.map((a, i) => {
      // Find by current annotation id
      if (a.id === editingAnnotations[currentEditIndex]?.id) {
        return { ...a, [field]: value };
      }
      return a;
    }));
  };

  const handleSequentialNext = () => {
    if (currentEditIndex < editingAnnotations.length - 1) {
      const nextIdx = currentEditIndex + 1;
      setCurrentEditIndex(nextIdx);
      setHighlightId(editingAnnotations[nextIdx].id);
    }
  };

  const handleSequentialPrev = () => {
    if (currentEditIndex > 0) {
      const prevIdx = currentEditIndex - 1;
      setCurrentEditIndex(prevIdx);
      setHighlightId(editingAnnotations[prevIdx].id);
    }
  };

  const handleSequentialFinish = () => {
    // Apply edits back to annotations
    setAnnotations(editingAnnotations);
    setSequentialMode(false);
    setHighlightId(null);
    setSaveDialogOpen(true);
  };

  const handleSave = useCallback(async () => {
    if (!annotationSnapshot || !annotationAssetId || !user) return;

    setSaving(true);
    try {
      // Render annotations onto image using Canvas compositing
      const blob = await renderAnnotationsToCanvas(annotationSnapshot, annotations, imageTransform);
      const path = `annotations/${annotationAssetId}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('product-snapshots')
        .upload(path, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('product-snapshots').getPublicUrl(path);
      const snapshotUrl = urlData.publicUrl;

      // A product_media image owns at most one editable annotation record.
      if (annotationExistingData?.recordId) {
        const { error } = await supabase
          .from('product_annotations')
          .update({
            snapshot_url: snapshotUrl,
            annotations_json: annotations as unknown as any,
            remark: saveRemark || null,
            media_id: annotationExistingData.mediaId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', annotationExistingData.recordId);
        if (error) throw error;
      } else if (annotationExistingData?.mediaId) {
        const { data: existing, error: existingError } = await supabase
          .from('product_annotations')
          .select('id')
          .eq('media_id', annotationExistingData.mediaId)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing) {
          const { error } = await supabase
            .from('product_annotations')
            .update({
              snapshot_url: snapshotUrl,
              annotations_json: annotations as unknown as any,
              remark: saveRemark || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('product_annotations').insert({
            asset_id: annotationAssetId,
            media_id: annotationExistingData.mediaId,
            snapshot_url: snapshotUrl,
            annotations_json: annotations as unknown as any,
            view_meta: { viewName: '产品图片标注' },
            version: 1,
            remark: saveRemark || null,
            user_id: user.id,
            workstation_id: annotationWorkstationId,
          });
          if (error) throw error;
        }
      } else {
        // Create new record
        const { data: existing } = await supabase
          .from('product_annotations')
          .select('version')
          .eq('asset_id', annotationAssetId)
          .order('version', { ascending: false })
          .limit(1);

        const nextVersion = existing && existing.length > 0
          ? existing[0].version + 1
          : 1;

        const insertData: Record<string, unknown> = {
          asset_id: annotationAssetId,
          snapshot_url: snapshotUrl,
          annotations_json: annotations as unknown as any,
          view_meta: { viewName: `版本${nextVersion}` },
          version: nextVersion,
          remark: saveRemark || null,
          user_id: user.id,
        };

        if (annotationWorkstationId) {
          insertData.workstation_id = annotationWorkstationId;
        }

        const { error } = await supabase.from('product_annotations').insert(insertData as any);
        if (error) throw error;
      }

      setSaveDialogOpen(false);
      setSaveRemark('');
      setAnnotations([]);
      setSequentialMode(false);
      setCurrentEditIndex(0);
      setEditingAnnotations([]);
      setHighlightId(null);
      setImageTransform({ rotation: 0, flipH: false, flipV: false });
      exitAnnotationMode();
      toast.success('标注已保存');
    } catch (error) {
      console.error('Save annotation failed:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [annotationSnapshot, annotationAssetId, annotationWorkstationId, annotationExistingData, annotations, imageTransform, saveRemark, user, exitAnnotationMode]);

  if (!annotationSnapshot) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>没有截图数据</p>
      </div>
    );
  }

  if (!isUsableAnnotationSnapshot(annotationSnapshot)) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2 px-4">
          <p>截图数据无效，无法加载 2D 标注底图</p>
          <p className="text-xs break-all max-w-full">{String(annotationSnapshot)}</p>
        </div>
      </div>
    );
  }

  const currentEditAnnotation = sequentialMode ? editingAnnotations[currentEditIndex] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top toolbar */}
      <div className="flex shrink-0 items-center justify-between px-4 py-2 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={exitAnnotationMode} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <span className="text-sm text-muted-foreground">|</span>
          <div className="flex items-center gap-1 text-sm font-medium">
            <Edit3 className="h-4 w-4 text-primary" />
            截图标注
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            已标注 {annotations.length} 个特征
          </span>
          {readOnly ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReadOnly(false)}
              className="gap-1"
            >
              <Edit3 className="h-4 w-4" />
              编辑标注
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={handleStartSave}
            disabled={annotations.length === 0 || readOnly}
            className="gap-1"
          >
            <Save className="h-4 w-4" />
            保存标注
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="relative min-h-0 flex-1 overflow-hidden p-4">
        <div className="h-full min-h-0">
          <AnnotationCanvas
            imageUrl={annotationSnapshot}
            annotations={sequentialMode ? editingAnnotations : annotations}
            onChange={sequentialMode ? setEditingAnnotations : setAnnotations}
            readOnly={sequentialMode || readOnly}
            fillContainer
            highlightId={highlightId}
            onTransformChange={setImageTransform}
          />
        </div>

        {/* Sequential edit floating panel */}
        {sequentialMode && currentEditAnnotation && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] max-w-[90%] bg-card border rounded-xl shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                {currentEditIndex + 1} / {editingAnnotations.length}
              </Badge>
              <span className="text-xs text-muted-foreground">
                逐个标注特征点
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">名称 *</Label>
                <Input
                  value={currentEditAnnotation.name}
                  onChange={(e) => handleSequentialUpdate('name', e.target.value)}
                  placeholder="例如：Mark点1"
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">类型</Label>
                <Select
                  value={currentEditAnnotation.category}
                  onValueChange={(v) => handleSequentialUpdate('category', v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">说明</Label>
              <Input
                value={currentEditAnnotation.description}
                onChange={(e) => handleSequentialUpdate('description', e.target.value)}
                placeholder="简要说明..."
                className="h-8 text-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSequentialPrev}
                disabled={currentEditIndex === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                上一个
              </Button>

              {currentEditIndex < editingAnnotations.length - 1 ? (
                <Button
                  size="sm"
                  onClick={handleSequentialNext}
                  className="gap-1"
                >
                  下一个
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSequentialFinish}
                  className="gap-1"
                >
                  <Check className="h-4 w-4" />
                  完成
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存标注记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Textarea
                value={saveRemark}
                onChange={(e) => setSaveRemark(e.target.value)}
                placeholder="描述本次标注内容..."
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              共 {annotations.length} 个标注项将被保存
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              确认保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
