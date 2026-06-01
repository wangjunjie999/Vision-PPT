import { useEffect, useRef, lazy, Suspense } from 'react';
import { useData } from '@/contexts/useData';
import { useAppStore } from '@/store/useAppStore';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { EmptyState } from '../canvas/EmptyState';
import { Loader2 } from 'lucide-react';

// Lazy load heavy canvas components
const ProjectDashboard = lazy(() => import('../canvas/ProjectDashboard').then(m => ({ default: m.ProjectDashboard })));
const WorkstationCanvas = lazy(() => import('../canvas/WorkstationCanvas').then(m => ({ default: m.WorkstationCanvas })));
const ModuleSchematic = lazy(() => import('../canvas/ModuleSchematic').then(m => ({ default: m.ModuleSchematic })));
const AnnotationEditor = lazy(() => import('../canvas/AnnotationEditor').then(m => ({ default: m.AnnotationEditor })));
const ProductViewerCanvas = lazy(() => import('../canvas/ProductViewerCanvas').then(m => ({ default: m.ProductViewerCanvas })));

function CanvasLoading() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-sm">加载中...</span>
      </div>
    </div>
  );
}

export function CanvasArea() {
  const { selectedProjectId, selectedWorkstationId, selectedModuleId } = useData();
  const { annotationMode, viewerMode, exitAnnotationMode, exitViewerMode } = useAppStore();

  const prevIds = useRef({ selectedProjectId, selectedWorkstationId, selectedModuleId });

  useEffect(() => {
    const prev = prevIds.current;
    const changed =
      prev.selectedProjectId !== selectedProjectId ||
      prev.selectedWorkstationId !== selectedWorkstationId ||
      prev.selectedModuleId !== selectedModuleId;

    if (changed) {
      if (annotationMode) exitAnnotationMode();
      if (viewerMode) exitViewerMode();
    }

    prevIds.current = { selectedProjectId, selectedWorkstationId, selectedModuleId };
  }, [selectedProjectId, selectedWorkstationId, selectedModuleId]);

  // Viewer mode takes priority over annotation
  if (viewerMode) {
    return (
      <ErrorBoundary fallbackTitle="产品查看器加载失败">
        <Suspense fallback={<CanvasLoading />}>
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ProductViewerCanvas />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Annotation mode
  if (annotationMode) {
    return (
      <ErrorBoundary fallbackTitle="标注编辑器加载失败">
        <Suspense fallback={<CanvasLoading />}>
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AnnotationEditor />
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Determine what to show - Module view shows 2D workstation schematic
  if (selectedModuleId) {
    return (
      <ErrorBoundary
        fallbackTitle="视觉系统示意图加载失败"
        context={{ moduleId: selectedModuleId, workstationId: selectedWorkstationId || undefined }}
      >
        <Suspense fallback={<CanvasLoading />}>
          <ModuleSchematic />
        </Suspense>
      </ErrorBoundary>
    );
  }
  
  if (selectedWorkstationId) {
    return (
      <ErrorBoundary
        fallbackTitle="工位布局画布加载失败"
        context={{ workstationId: selectedWorkstationId }}
      >
        <Suspense fallback={<CanvasLoading />}>
          <WorkstationCanvas />
        </Suspense>
      </ErrorBoundary>
    );
  }
  
  if (selectedProjectId) {
    return (
      <ErrorBoundary
        fallbackTitle="项目仪表盘加载失败"
        context={{ projectId: selectedProjectId }}
      >
        <Suspense fallback={<CanvasLoading />}>
          <ProjectDashboard />
        </Suspense>
      </ErrorBoundary>
    );
  }
  
  return <EmptyState />;
}

