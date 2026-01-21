import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, Circle, Box, Camera, Cpu, FileText, Layers, Settings } from 'lucide-react';

export type ProgressStepStatus = 'pending' | 'active' | 'complete';

export interface ProgressStep {
  id: string;
  label: string;
  status: ProgressStepStatus;
  subLabel?: string;
  icon?: 'project' | 'workstation' | 'module' | 'hardware' | 'finalize';
}

interface GenerationProgressStepsProps {
  steps: ProgressStep[];
  currentWorkstation?: string;
  currentModule?: string;
}

const iconMap = {
  project: FileText,
  workstation: Box,
  module: Cpu,
  hardware: Camera,
  finalize: Layers,
};

export function GenerationProgressSteps({ 
  steps, 
  currentWorkstation, 
  currentModule 
}: GenerationProgressStepsProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const Icon = step.icon ? iconMap[step.icon] : Settings;
        
        return (
          <div 
            key={step.id}
            className={cn(
              "flex items-start gap-3 p-2 rounded-lg transition-all duration-200",
              step.status === 'active' && "bg-primary/5 border border-primary/20",
              step.status === 'complete' && "opacity-60"
            )}
          >
            {/* Status Icon */}
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              step.status === 'pending' && "bg-muted",
              step.status === 'active' && "bg-primary/10",
              step.status === 'complete' && "bg-chart-2/10"
            )}>
              {step.status === 'pending' && (
                <Circle className="h-3 w-3 text-muted-foreground" />
              )}
              {step.status === 'active' && (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              )}
              {step.status === 'complete' && (
                <CheckCircle2 className="h-3.5 w-3.5 text-chart-2" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className={cn(
                  "h-4 w-4 shrink-0",
                  step.status === 'active' ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium truncate",
                  step.status === 'active' && "text-primary"
                )}>
                  {step.label}
                </span>
              </div>
              
              {/* Sub-label for current item */}
              {step.status === 'active' && step.subLabel && (
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {step.subLabel}
                </div>
              )}
            </div>

            {/* Step number */}
            <span className="text-xs text-muted-foreground shrink-0">
              {index + 1}/{steps.length}
            </span>
          </div>
        );
      })}

      {/* Current Processing Info */}
      {(currentWorkstation || currentModule) && (
        <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground mb-2">当前处理</p>
          {currentWorkstation && (
            <div className="flex items-center gap-2 text-sm">
              <Box className="h-4 w-4 text-chart-1" />
              <span className="font-medium">{currentWorkstation}</span>
            </div>
          )}
          {currentModule && (
            <div className="flex items-center gap-2 text-sm mt-1">
              <Cpu className="h-4 w-4 text-chart-4" />
              <span className="font-medium">{currentModule}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
