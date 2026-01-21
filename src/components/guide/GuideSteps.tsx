import { motion } from 'framer-motion';
import { Check, FolderPlus, Layers, Box, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GuideStep, useGuide } from '@/contexts/GuideContext';

interface StepConfig {
  key: GuideStep;
  label: string;
  icon: typeof FolderPlus;
}

const steps: StepConfig[] = [
  { key: 'project', label: '创建项目', icon: FolderPlus },
  { key: 'workstation', label: '添加工位', icon: Layers },
  { key: 'module', label: '配置模块', icon: Box },
  { key: 'complete', label: '生成报告', icon: FileText },
];

export function GuideSteps({ className }: { className?: string }) {
  const { currentStep, isGuideActive } = useGuide();

  if (!isGuideActive) return null;

  const currentIndex = steps.findIndex(s => s.key === currentStep);
  const isWelcome = currentStep === 'welcome';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {steps.map((step, index) => {
        const isCompleted = !isWelcome && index < currentIndex;
        const isCurrent = !isWelcome && index === currentIndex;
        const isPending = isWelcome || index > currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            {/* Step indicator */}
            <motion.div
              className={cn(
                'relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300',
                isCompleted && 'bg-guide-success text-white',
                isCurrent && 'bg-guide-primary text-white',
                isPending && 'bg-muted text-muted-foreground'
              )}
              animate={isCurrent ? {
                boxShadow: [
                  '0 0 0 0 rgba(255, 107, 53, 0.4)',
                  '0 0 0 8px rgba(255, 107, 53, 0)',
                ],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: isCurrent ? Infinity : 0,
                ease: 'easeOut',
              }}
            >
              {isCompleted ? (
                <Check className="w-4 h-4" />
              ) : (
                <step.icon className="w-4 h-4" />
              )}
            </motion.div>

            {/* Step label - only show on larger screens */}
            <span
              className={cn(
                'hidden lg:block ml-2 text-xs font-medium transition-colors',
                isCompleted && 'text-guide-success',
                isCurrent && 'text-guide-primary',
                isPending && 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-6 lg:w-8 h-0.5 mx-2 transition-colors',
                  index < currentIndex && !isWelcome ? 'bg-guide-success' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
