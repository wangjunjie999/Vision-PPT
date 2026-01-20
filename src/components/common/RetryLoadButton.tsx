import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { LoadState } from '@/services/fetchWithRetry';
import { cn } from '@/lib/utils';

interface RetryLoadButtonProps {
  loadState: LoadState;
  onRetry: () => Promise<void>;
  label: string;
  className?: string;
  compact?: boolean;
}

export function RetryLoadButton({ 
  loadState, 
  onRetry, 
  label, 
  className,
  compact = false 
}: RetryLoadButtonProps) {
  if (loadState.status !== 'error') return null;

  const handleRetry = async () => {
    try {
      await onRetry();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRetry}
        className={cn("text-destructive hover:text-destructive", className)}
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        重试
      </Button>
    );
  }

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-4 rounded-lg border border-destructive/20 bg-destructive/5",
      className
    )}>
      <div className="flex items-center gap-2 text-destructive mb-2">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm font-medium">{label}加载失败</span>
      </div>
      {loadState.error && (
        <p className="text-xs text-muted-foreground mb-3 text-center max-w-xs">
          {loadState.error}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRetry}
        className="border-destructive/30 hover:bg-destructive/10"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        重新加载{label}
      </Button>
      {loadState.retryCount > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          已重试 {loadState.retryCount} 次
        </p>
      )}
    </div>
  );
}

// Inline variant for use in lists/headers
export function RetryLoadInline({ 
  loadState, 
  onRetry, 
  label 
}: Omit<RetryLoadButtonProps, 'compact' | 'className'>) {
  if (loadState.status !== 'error') return null;

  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span>{label}加载失败</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRetry}
        className="h-6 px-2 text-xs"
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        重试
      </Button>
    </div>
  );
}

// Loading indicator
export function LoadingIndicator({ 
  loadState, 
  label 
}: { 
  loadState: LoadState; 
  label: string;
}) {
  if (loadState.status !== 'loading') return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span>正在加载{label}...</span>
    </div>
  );
}
