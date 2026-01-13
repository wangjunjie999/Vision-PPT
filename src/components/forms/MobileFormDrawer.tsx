import { memo, ReactNode } from 'react';
import { useData } from '@/contexts/DataContext';
import { useBreakpoint } from '@/hooks/use-mobile';
import { EmptyFormState } from './EmptyFormState';
import { ProjectForm } from './ProjectForm';
import { WorkstationForm } from './WorkstationForm';
import { ModuleForm } from './ModuleForm';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerClose 
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { X, FileText, Cpu, Box, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Memoized form components
const MemoizedModuleForm = memo(ModuleForm);
const MemoizedWorkstationForm = memo(WorkstationForm);
const MemoizedProjectForm = memo(ProjectForm);

interface MobileFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileFormDrawer({ open, onOpenChange }: MobileFormDrawerProps) {
  const { selectedProjectId, selectedWorkstationId, selectedModuleId, projects, workstations, modules } = useData();
  
  // Determine form type and title
  const getFormInfo = () => {
    if (selectedModuleId) {
      const module = modules.find(m => m.id === selectedModuleId);
      return {
        type: 'module',
        title: module?.name || '模块配置',
        icon: <Box className="h-5 w-5 text-success" />,
        form: <MemoizedModuleForm key={selectedModuleId} />
      };
    }
    if (selectedWorkstationId) {
      const workstation = workstations.find(w => w.id === selectedWorkstationId);
      return {
        type: 'workstation',
        title: workstation?.name || '工位配置',
        icon: <Cpu className="h-5 w-5 text-accent" />,
        form: <MemoizedWorkstationForm key={selectedWorkstationId} />
      };
    }
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      return {
        type: 'project',
        title: project?.name || '项目配置',
        icon: <FileText className="h-5 w-5 text-primary" />,
        form: <MemoizedProjectForm key={selectedProjectId} />
      };
    }
    return {
      type: 'empty',
      title: '配置面板',
      icon: <FileText className="h-5 w-5 text-muted-foreground" />,
      form: <EmptyFormState />
    };
  };

  const formInfo = getFormInfo();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                {formInfo.icon}
              </div>
              <div>
                <DrawerTitle className="text-left">{formInfo.title}</DrawerTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formInfo.type === 'project' && '项目基本信息配置'}
                  {formInfo.type === 'workstation' && '工位参数与布局配置'}
                  {formInfo.type === 'module' && '功能模块检测配置'}
                  {formInfo.type === 'empty' && '选择项目开始配置'}
                </p>
              </div>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        
        {/* Form content with mobile optimizations */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mobile-form-container">
            {formInfo.form}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Mobile form trigger button that shows current selection status
interface MobileFormTriggerProps {
  onClick: () => void;
}

export function MobileFormTrigger({ onClick }: MobileFormTriggerProps) {
  const { selectedProjectId, selectedWorkstationId, selectedModuleId, projects, workstations, modules } = useData();
  
  const getSelectionInfo = () => {
    if (selectedModuleId) {
      const module = modules.find(m => m.id === selectedModuleId);
      return {
        label: module?.name || '模块',
        type: '模块配置',
        icon: <Box className="h-4 w-4" />,
        color: 'text-success'
      };
    }
    if (selectedWorkstationId) {
      const workstation = workstations.find(w => w.id === selectedWorkstationId);
      return {
        label: workstation?.name || '工位',
        type: '工位配置',
        icon: <Cpu className="h-4 w-4" />,
        color: 'text-accent'
      };
    }
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      return {
        label: project?.name || '项目',
        type: '项目配置',
        icon: <FileText className="h-4 w-4" />,
        color: 'text-primary'
      };
    }
    return null;
  };

  const info = getSelectionInfo();

  if (!info) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="flex-col gap-1 h-12 opacity-50"
        onClick={onClick}
        disabled
      >
        <ChevronUp className="h-5 w-5" />
        <span className="text-[10px]">配置</span>
      </Button>
    );
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="flex-col gap-0.5 h-12 relative"
      onClick={onClick}
    >
      <div className={cn("flex items-center gap-1", info.color)}>
        {info.icon}
        <ChevronUp className="h-3 w-3" />
      </div>
      <span className="text-[10px] truncate max-w-[60px]">{info.label}</span>
      {/* Indicator dot */}
      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
    </Button>
  );
}