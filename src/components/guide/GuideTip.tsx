import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TipDirection = 'top' | 'bottom' | 'left' | 'right';

interface GuideTipProps {
  message: string;
  direction?: TipDirection;
  visible?: boolean;
  onDismiss?: () => void;
  className?: string;
  showDismiss?: boolean;
  stepNumber?: number;
  totalSteps?: number;
}

const ArrowIcon = ({ direction }: { direction: TipDirection }) => {
  const iconClass = "w-4 h-4 animate-bounce-arrow";
  switch (direction) {
    case 'top': return <ChevronUp className={iconClass} />;
    case 'bottom': return <ChevronDown className={iconClass} />;
    case 'left': return <ChevronLeft className={iconClass} />;
    case 'right': return <ChevronRight className={iconClass} />;
  }
};

const getArrowPosition = (direction: TipDirection) => {
  switch (direction) {
    case 'top': return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    case 'bottom': return 'top-full left-1/2 -translate-x-1/2 mt-2';
    case 'left': return 'right-full top-1/2 -translate-y-1/2 mr-2';
    case 'right': return 'left-full top-1/2 -translate-y-1/2 ml-2';
  }
};

const getArrowTailPosition = (direction: TipDirection) => {
  switch (direction) {
    case 'top': return 'top-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-guide-primary';
    case 'bottom': return 'bottom-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-guide-primary';
    case 'left': return 'left-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-guide-primary';
    case 'right': return 'right-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-guide-primary';
  }
};

export function GuideTip({
  message,
  direction = 'right',
  visible = true,
  onDismiss,
  className,
  showDismiss = true,
  stepNumber,
  totalSteps,
}: GuideTipProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={cn(
            'absolute z-50 pointer-events-auto',
            getArrowPosition(direction),
            className
          )}
        >
          {/* Pulse ring effect */}
          <motion.div
            className="absolute inset-0 rounded-xl bg-guide-primary/30"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          
          {/* Main tip container */}
          <div className="relative bg-guide-primary text-white rounded-xl px-4 py-3 shadow-guide min-w-[180px] max-w-[280px]">
            {/* Arrow tail */}
            <div className={cn('absolute w-0 h-0', getArrowTailPosition(direction))} />
            
            {/* Content */}
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <ArrowIcon direction={direction} />
              </div>
              <div className="flex-1">
                {stepNumber && totalSteps && (
                  <div className="text-xs text-white/70 mb-1">
                    步骤 {stepNumber}/{totalSteps}
                  </div>
                )}
                <p className="text-sm font-medium leading-relaxed">{message}</p>
              </div>
              {showDismiss && onDismiss && (
                <button
                  onClick={onDismiss}
                  className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
