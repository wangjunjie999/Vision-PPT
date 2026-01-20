import { AlertCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LoadState } from '@/services/fetchWithRetry';

interface LoadStateCardProps {
  state: LoadState;
  title: string;
  description?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  variant?: 'inline' | 'card' | 'full';
  className?: string;
}

export function LoadStateCard({
  state,
  title,
  description,
  onRetry,
  onCancel,
  variant = 'card',
  className
}: LoadStateCardProps) {
  if (state.status === 'idle' || state.status === 'success') {
    return null;
  }

  const isLoading = state.status === 'loading';
  const isError = state.status === 'error';

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        {isLoading && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-muted-foreground">{title}...</span>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-6 px-2 text-xs"
              >
                取消
              </Button>
            )}
          </>
        )}
        {isError && (
          <>
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-destructive">{title}失败</span>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-6 px-2 text-xs gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                重试
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center h-full gap-4 p-8',
        className
      )}>
        {isLoading && (
          <>
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Loader2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{title}</p>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
                <XCircle className="h-4 w-4" />
                取消加载
              </Button>
            )}
          </>
        )}
        {isError && (
          <>
            <div className="relative">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-destructive">{title}失败</p>
              {state.error && (
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">{state.error}</p>
              )}
              {state.retryCount > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  已重试 {state.retryCount} 次
                </p>
              )}
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="gap-1">
                <RefreshCw className="h-4 w-4" />
                重新加载
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // Default: card variant
  return (
    <div className={cn(
      'rounded-lg border p-4',
      isLoading && 'border-primary/20 bg-primary/5',
      isError && 'border-destructive/20 bg-destructive/5',
      className
    )}>
      <div className="flex items-start gap-3">
        {isLoading && (
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0 mt-0.5" />
        )}
        {isError && (
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        )}
        
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium',
            isLoading && 'text-primary',
            isError && 'text-destructive'
          )}>
            {isLoading ? `${title}...` : `${title}失败`}
          </p>
          
          {isError && state.error && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {state.error}
            </p>
          )}
          
          {description && !isError && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          
          {state.retryCount > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              已重试 {state.retryCount} 次
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isLoading && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 px-2 text-xs"
            >
              取消
            </Button>
          )}
          {isError && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-7 px-2 text-xs gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              重试
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
