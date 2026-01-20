import { memo } from 'react';
import { useData } from '@/contexts/DataContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { EmptyFormState } from '../forms/EmptyFormState';
import { ProjectForm } from '../forms/ProjectForm';
import { WorkstationForm } from '../forms/WorkstationForm';
import { ModuleForm } from '../forms/ModuleForm';

// Memoized form components to prevent unnecessary re-renders
const MemoizedModuleForm = memo(ModuleForm);
const MemoizedWorkstationForm = memo(WorkstationForm);
const MemoizedProjectForm = memo(ProjectForm);

export function FormPanel() {
  const { selectedProjectId, selectedWorkstationId, selectedModuleId } = useData();

  if (selectedModuleId) {
    return (
      <ErrorBoundary
        fallbackTitle="模块表单加载失败"
        context={{ moduleId: selectedModuleId }}
        compact
      >
        <MemoizedModuleForm key={selectedModuleId} />
      </ErrorBoundary>
    );
  }
  
  if (selectedWorkstationId) {
    return (
      <ErrorBoundary
        fallbackTitle="工位表单加载失败"
        context={{ workstationId: selectedWorkstationId }}
        compact
      >
        <MemoizedWorkstationForm key={selectedWorkstationId} />
      </ErrorBoundary>
    );
  }
  
  if (selectedProjectId) {
    return (
      <ErrorBoundary
        fallbackTitle="项目表单加载失败"
        context={{ projectId: selectedProjectId }}
        compact
      >
        <MemoizedProjectForm key={selectedProjectId} />
      </ErrorBoundary>
    );
  }
  
  return <EmptyFormState />;
}
