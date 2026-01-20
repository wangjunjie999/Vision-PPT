import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryContext {
  projectId?: string;
  workstationId?: string;
  moduleId?: string;
  [key: string]: string | undefined;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  context?: ErrorBoundaryContext;
  /** 是否显示简洁模式（用于小型区域） */
  compact?: boolean;
  /** 自定义 fallback 渲染 */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

/**
 * 通用错误边界组件
 * - 捕获子组件的 render error
 * - 显示友好错误提示 + 重试按钮 + 复制错误信息
 * - 支持 context 传入（projectId/workstationId等）便于调试
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // 可在此添加错误上报逻辑
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
    this.props.onReset?.();
  };

  getErrorReport = (): string => {
    const { error, errorInfo } = this.state;
    const { context } = this.props;
    
    const currentRoute = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    const timestamp = new Date().toISOString();
    
    const contextStr = context 
      ? Object.entries(context)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
      : 'N/A';

    return `
===== Error Report =====
Time: ${timestamp}
Route: ${currentRoute}

--- Context ---
${contextStr}

--- Error ---
Message: ${error?.message || 'Unknown error'}
Name: ${error?.name || 'Error'}

--- Stack Trace ---
${error?.stack || 'No stack trace available'}

--- Component Stack ---
${errorInfo?.componentStack || 'No component stack available'}
========================
`.trim();
  };

  handleCopyError = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(this.getErrorReport());
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error:', err);
    }
  };

  render(): ReactNode {
    const { hasError, error, copied } = this.state;
    const { children, fallbackTitle, compact, fallback } = this.props;

    if (hasError && error) {
      // 自定义 fallback
      if (fallback) {
        return fallback({ error, reset: this.handleReset });
      }

      // 简洁模式
      if (compact) {
        return (
          <div className="flex items-center justify-center gap-2 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">加载失败</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleReset}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              重试
            </Button>
          </div>
        );
      }

      // 标准模式
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-destructive/20 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {fallbackTitle || '模块加载失败'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  该区域遇到意外错误
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 mb-4 max-h-32 overflow-auto">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {error.message || 'Unknown error'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={this.handleReset}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleCopyError}
                className="flex-1"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    复制错误信息
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              如问题持续，请刷新页面或联系技术支持
            </p>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * 函数组件包装器，便于在函数组件中使用
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  
  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  
  return ComponentWithErrorBoundary;
}

export default ErrorBoundary;
