import { useState, useEffect, useCallback, memo } from 'react';
import { 
  X, 
  Activity, 
  AlertTriangle, 
  Clock, 
  Database, 
  Image, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Trash2,
  Bug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { 
  getRecentErrors, 
  getErrorStats, 
  clearErrors, 
  exportErrorLog,
  type ErrorRecord 
} from '@/services/errorReporter';
import { useData } from '@/contexts/DataContext';

// Check if diagnostic mode is enabled
export function isDiagnosticEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check URL param
  const params = new URLSearchParams(window.location.search);
  if (params.get('diag') === '1' || params.get('debug') === '1') {
    return true;
  }
  
  // Check localStorage
  if (localStorage.getItem('lovable_diag') === '1') {
    return true;
  }
  
  // Check dev mode
  if (import.meta.env.DEV) {
    return localStorage.getItem('lovable_diag') !== '0'; // Default on in dev unless explicitly disabled
  }
  
  return false;
}

// Toggle diagnostic mode
export function toggleDiagnostic(enabled: boolean): void {
  localStorage.setItem('lovable_diag', enabled ? '1' : '0');
}

interface LoadMetrics {
  phase: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  elapsedMs?: number;
  error?: string;
  retryCount?: number;
}

interface DataMetrics {
  projects: number;
  workstations: number;
  layouts: number;
  modules: number;
  totalImages: number;
  estimatedMemoryMB: number;
}

const StatusBadge = memo(function StatusBadge({ status }: { status: LoadMetrics['status'] }) {
  const variants: Record<LoadMetrics['status'], { className: string; label: string }> = {
    idle: { className: 'bg-muted text-muted-foreground', label: '待机' },
    loading: { className: 'bg-blue-500/20 text-blue-600', label: '加载中' },
    success: { className: 'bg-green-500/20 text-green-600', label: '成功' },
    error: { className: 'bg-destructive/20 text-destructive', label: '失败' },
  };
  
  const { className, label } = variants[status];
  
  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      {label}
    </Badge>
  );
});

const ErrorItem = memo(function ErrorItem({ error }: { error: ErrorRecord }) {
  const [expanded, setExpanded] = useState(false);
  
  const typeColors: Record<ErrorRecord['type'], string> = {
    error: 'text-destructive',
    unhandledrejection: 'text-orange-500',
    react: 'text-purple-500',
    network: 'text-blue-500',
  };
  
  return (
    <div className="border-b border-border/50 py-2 text-xs">
      <div 
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={cn('font-mono uppercase', typeColors[error.type])}>
          [{error.type}]
        </span>
        <span className="flex-1 truncate text-foreground">
          {error.message}
        </span>
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(error.timestamp).toLocaleTimeString()}
        </span>
        {error.stack && (
          expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </div>
      {expanded && error.stack && (
        <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
          {error.stack}
        </pre>
      )}
    </div>
  );
});

/**
 * Development diagnostic panel
 * Shows loading metrics, data counts, errors, and performance hints
 * Only visible in dev mode or via URL param ?diag=1
 */
export const DiagnosticPanel = memo(function DiagnosticPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [errorStats, setErrorStats] = useState(getErrorStats());
  const [sectionsOpen, setSectionsOpen] = useState({
    loading: true,
    data: true,
    errors: false,
    performance: false,
  });
  
  const { 
    phaseLoadStates, 
    projects, 
    workstations, 
    layouts, 
    modules,
    refetch 
  } = useData();
  
  // Refresh errors periodically
  useEffect(() => {
    const updateErrors = () => {
      setErrors(getRecentErrors(20));
      setErrorStats(getErrorStats());
    };
    
    updateErrors();
    const interval = setInterval(updateErrors, 2000);
    return () => clearInterval(interval);
  }, []);
  
  // Calculate metrics
  const loadMetrics: LoadMetrics[] = [
    {
      phase: '阶段1: 项目',
      status: phaseLoadStates.project.status,
      elapsedMs: phaseLoadStates.project.elapsedMs,
      error: phaseLoadStates.project.error,
      retryCount: phaseLoadStates.project.retryCount,
    },
    {
      phase: '阶段2: 工位',
      status: phaseLoadStates.workstations.status,
      elapsedMs: phaseLoadStates.workstations.elapsedMs,
      error: phaseLoadStates.workstations.error,
      retryCount: phaseLoadStates.workstations.retryCount,
    },
    {
      phase: '阶段3: 详情',
      status: phaseLoadStates.details.status,
      elapsedMs: phaseLoadStates.details.elapsedMs,
      error: phaseLoadStates.details.error,
      retryCount: phaseLoadStates.details.retryCount,
    },
  ];
  
  // Count images in layouts
  const countImages = useCallback(() => {
    let count = 0;
    
    layouts.forEach(layout => {
      if (layout.front_view_image_url) count++;
      if (layout.side_view_image_url) count++;
      if (layout.top_view_image_url) count++;
    });
    
    modules.forEach(mod => {
      if (mod.schematic_image_url) count++;
    });
    
    return count;
  }, [layouts, modules]);
  
  const dataMetrics: DataMetrics = {
    projects: projects.length,
    workstations: workstations.length,
    layouts: layouts.length,
    modules: modules.length,
    totalImages: countImages(),
    estimatedMemoryMB: Math.round(
      (JSON.stringify(projects).length +
       JSON.stringify(workstations).length +
       JSON.stringify(layouts).length +
       JSON.stringify(modules).length) / 1024 / 1024 * 10
    ) / 10,
  };
  
  const handleClearErrors = useCallback(() => {
    clearErrors();
    setErrors([]);
    setErrorStats(getErrorStats());
  }, []);
  
  const handleExportErrors = useCallback(() => {
    const log = exportErrorLog();
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);
  
  const handleCopyMetrics = useCallback(() => {
    const metrics = {
      loadPhases: loadMetrics,
      data: dataMetrics,
      errors: errorStats,
      timestamp: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(metrics, null, 2));
  }, [loadMetrics, dataMetrics, errorStats]);
  
  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[9999] p-2 bg-background border border-border rounded-full shadow-lg hover:bg-accent transition-colors"
        title="打开诊断面板"
      >
        <Bug className="h-4 w-4 text-muted-foreground" />
        {errorStats.total > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 text-[10px] bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
            {errorStats.total > 9 ? '9+' : errorStats.total}
          </span>
        )}
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-80 max-h-[70vh] bg-background border border-border rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">诊断面板</span>
          <Badge variant="outline" className="text-[10px]">DEV</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={handleCopyMetrics}
            title="复制指标"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => refetch()}
            title="刷新数据"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="max-h-[calc(70vh-48px)]">
        <div className="p-3 space-y-3">
          {/* Loading Phases */}
          <Collapsible open={sectionsOpen.loading} onOpenChange={() => toggleSection('loading')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>加载阶段</span>
              </div>
              {sectionsOpen.loading ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5">
              {loadMetrics.map((metric, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                  <span className="text-muted-foreground">{metric.phase}</span>
                  <div className="flex items-center gap-2">
                    {metric.elapsedMs !== undefined && (
                      <span className="font-mono text-muted-foreground">
                        {metric.elapsedMs}ms
                      </span>
                    )}
                    <StatusBadge status={metric.status} />
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Data Counts */}
          <Collapsible open={sectionsOpen.data} onOpenChange={() => toggleSection('data')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                <span>数据统计</span>
              </div>
              {sectionsOpen.data ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="bg-muted/30 rounded px-2 py-1.5 flex justify-between">
                  <span className="text-muted-foreground">项目</span>
                  <span className="font-mono">{dataMetrics.projects}</span>
                </div>
                <div className="bg-muted/30 rounded px-2 py-1.5 flex justify-between">
                  <span className="text-muted-foreground">工位</span>
                  <span className="font-mono">{dataMetrics.workstations}</span>
                </div>
                <div className="bg-muted/30 rounded px-2 py-1.5 flex justify-between">
                  <span className="text-muted-foreground">布局</span>
                  <span className="font-mono">{dataMetrics.layouts}</span>
                </div>
                <div className="bg-muted/30 rounded px-2 py-1.5 flex justify-between">
                  <span className="text-muted-foreground">模块</span>
                  <span className="font-mono">{dataMetrics.modules}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Performance Hints */}
          <Collapsible open={sectionsOpen.performance} onOpenChange={() => toggleSection('performance')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <div className="flex items-center gap-2">
                <Image className="h-3.5 w-3.5" />
                <span>性能指标</span>
              </div>
              {sectionsOpen.performance ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5">
              <div className="bg-muted/30 rounded px-2 py-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground">图片数量</span>
                <span className="font-mono">{dataMetrics.totalImages}</span>
              </div>
              <div className="bg-muted/30 rounded px-2 py-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground">JSON 内存估算</span>
                <span className="font-mono">{dataMetrics.estimatedMemoryMB} MB</span>
              </div>
              {dataMetrics.totalImages > 50 && (
                <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 rounded px-2 py-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>图片数量较多，建议使用虚拟化列表</span>
                </div>
              )}
              {dataMetrics.estimatedMemoryMB > 5 && (
                <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 rounded px-2 py-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>数据量较大，考虑分页或按需加载</span>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Errors */}
          <Collapsible open={sectionsOpen.errors} onOpenChange={() => toggleSection('errors')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>错误日志</span>
                {errorStats.total > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1">
                    {errorStats.total}
                  </Badge>
                )}
              </div>
              {sectionsOpen.errors ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              {errors.length > 0 ? (
                <>
                  <div className="flex items-center justify-end gap-1 mb-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs"
                      onClick={handleExportErrors}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      导出
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs text-destructive hover:text-destructive"
                      onClick={handleClearErrors}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      清空
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {errors.map(error => (
                      <ErrorItem key={error.id} error={error} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  暂无错误记录
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
});

/**
 * Wrapper that only renders DiagnosticPanel when enabled
 */
export function DiagnosticPanelWrapper() {
  const [enabled, setEnabled] = useState(false);
  
  useEffect(() => {
    setEnabled(isDiagnosticEnabled());
    
    // Listen for URL changes
    const checkEnabled = () => setEnabled(isDiagnosticEnabled());
    window.addEventListener('popstate', checkEnabled);
    return () => window.removeEventListener('popstate', checkEnabled);
  }, []);
  
  if (!enabled) return null;
  
  return <DiagnosticPanel />;
}

export default DiagnosticPanelWrapper;
