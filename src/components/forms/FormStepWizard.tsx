import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronLeft, ChevronRight, Save, Loader2, Lightbulb } from 'lucide-react';

export interface FormStep {
  id: string;
  title: string;
  shortTitle?: string;
  description?: string;
  content: React.ReactNode;
  isComplete?: boolean;
  nextHint?: string;
}

interface FormStepWizardProps {
  steps: FormStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onSave: () => Promise<void>;
  saving?: boolean;
  title?: string;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function FormStepWizard({
  steps,
  currentStep,
  onStepChange,
  onSave,
  saving = false,
  title,
  badge,
  headerActions,
}: FormStepWizardProps) {
  const completedSteps = useMemo(() => 
    steps.filter(s => s.isComplete).length, 
    [steps]
  );
  
  const progressPercent = Math.round((completedSteps / steps.length) * 100);
  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (!isLastStep) {
      onStepChange(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  const handleStepClick = (index: number) => {
    onStepChange(index);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with title and save button */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title && <span className="font-medium">{title}</span>}
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            保存
          </Button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="px-4 py-3 border-b bg-muted/30">
        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>配置进度</span>
            <span className={cn(
              "font-medium",
              progressPercent >= 70 ? "text-success" : 
              progressPercent >= 30 ? "text-warning" : "text-destructive"
            )}>
              {progressPercent}%
            </span>
          </div>
          <Progress 
            value={progressPercent} 
            className={cn(
              "h-1.5",
              progressPercent >= 70 ? "[&>div]:bg-success" : 
              progressPercent >= 30 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive"
            )}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = step.isComplete;
            const isPast = index < currentStep;

            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => handleStepClick(index)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    "hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring",
                    isActive && "bg-primary text-primary-foreground shadow-sm",
                    !isActive && isCompleted && "bg-success/15 text-success border border-success/30",
                    !isActive && !isCompleted && isPast && "bg-secondary text-muted-foreground",
                    !isActive && !isCompleted && !isPast && "bg-muted/50 text-muted-foreground border border-dashed border-border"
                  )}
                >
                  <span className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                    isActive && "bg-primary-foreground/20",
                    !isActive && isCompleted && "bg-success/20",
                    !isActive && !isCompleted && "bg-muted"
                  )}>
                    {isCompleted ? <Check className="w-3 h-3" /> : index + 1}
                  </span>
                  <span className="hidden sm:inline">{step.shortTitle || step.title}</span>
                </button>
                
                {index < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-1 rounded",
                    (isPast || isCompleted) && index < currentStep ? "bg-primary/50" : "bg-border"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Current step content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Step title inside content area */}
        <div className="sticky top-0 z-10 px-4 py-2 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
              currentStepData?.isComplete 
                ? "bg-success/15 text-success" 
                : "bg-primary/15 text-primary"
            )}>
              {currentStepData?.isComplete ? <Check className="w-3.5 h-3.5" /> : currentStep + 1}
            </span>
            <div>
              <h3 className="text-sm font-semibold">{currentStepData?.title}</h3>
              {currentStepData?.description && (
                <p className="text-xs text-muted-foreground">{currentStepData.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Actual step content */}
        <div className="p-4">
          {currentStepData?.content}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="border-t bg-muted/30 px-4 py-3">
        {/* Next step hint */}
        {currentStepData?.nextHint && (
          <div className="flex items-start gap-2 mb-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
            <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {currentStepData.nextHint}
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={isFirstStep}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </Button>

          <div className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </div>

          {isLastStep ? (
            <Button size="sm" onClick={onSave} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存完成
            </Button>
          ) : (
            <Button size="sm" onClick={handleNext} className="gap-1">
              下一步
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
