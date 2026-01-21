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
import { Loader2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export type DeleteTargetType = 'project' | 'workstation' | 'module';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: DeleteTargetType;
  targetName: string;
  onConfirm: () => Promise<void>;
  /** Additional warning message for cascading deletes */
  cascadeWarning?: string;
}

const typeLabels: Record<DeleteTargetType, string> = {
  project: '项目',
  workstation: '工位',
  module: '功能模块',
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  targetType,
  targetName,
  onConfirm,
  cascadeWarning,
}: DeleteConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            确认删除{typeLabels[targetType]}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              您确定要删除{typeLabels[targetType]} <strong className="text-foreground">"{targetName}"</strong> 吗？
            </p>
            {cascadeWarning && (
              <p className="text-destructive font-medium">
                ⚠️ {cascadeWarning}
              </p>
            )}
            <p className="text-muted-foreground text-sm">
              此操作不可撤销。
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
