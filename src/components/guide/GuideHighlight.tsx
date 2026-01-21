import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GuideHighlightProps {
  active?: boolean;
  className?: string;
  children: React.ReactNode;
  pulseColor?: 'primary' | 'success' | 'accent';
}

export function GuideHighlight({
  active = false,
  className,
  children,
  pulseColor = 'primary',
}: GuideHighlightProps) {
  const colorClasses = {
    primary: 'border-guide-primary shadow-guide',
    success: 'border-guide-success shadow-guide-success',
    accent: 'border-guide-accent shadow-guide-accent',
  };

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence>
        {active && (
          <>
            {/* Pulse ring */}
            <motion.div
              className={cn(
                'absolute -inset-1 rounded-xl border-2 pointer-events-none',
                colorClasses[pulseColor]
              )}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: [0.5, 1, 0.5],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* Glow effect */}
            <motion.div
              className="absolute -inset-2 rounded-xl pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0.1, 0.3, 0.1],
                scale: [1, 1.02, 1],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                background: pulseColor === 'primary' 
                  ? 'radial-gradient(ellipse at center, rgba(255, 107, 53, 0.2) 0%, transparent 70%)'
                  : pulseColor === 'success'
                  ? 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.2) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse at center, rgba(0, 217, 255, 0.2) 0%, transparent 70%)',
              }}
            />
          </>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
