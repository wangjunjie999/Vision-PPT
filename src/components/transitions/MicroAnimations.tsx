import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Animation variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

const scaleBounce: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15
    }
  },
};

const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

// Stagger container for lists
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  delayStart?: number;
}

export function StaggerContainer({ 
  children, 
  className = '',
  staggerDelay = 0.05,
  delayStart = 0
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delayStart,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger item for use inside StaggerContainer
interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  variant?: 'fadeUp' | 'fadeDown' | 'scale' | 'scaleBounce' | 'slideLeft' | 'slideRight';
}

const variantMap = {
  fadeUp: fadeInUp,
  fadeDown: fadeInDown,
  scale: scaleIn,
  scaleBounce: scaleBounce,
  slideLeft: slideInLeft,
  slideRight: slideInRight,
};

export function StaggerItem({ 
  children, 
  className = '', 
  variant = 'fadeUp',
  ...props 
}: StaggerItemProps) {
  return (
    <motion.div
      variants={variantMap[variant]}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Animated presence wrapper with configurable animation
interface AnimatedPresenceWrapperProps {
  children: ReactNode;
  className?: string;
  animation?: 'fadeUp' | 'fadeDown' | 'scale' | 'scaleBounce' | 'slideLeft' | 'slideRight';
  delay?: number;
  duration?: number;
}

export function AnimatedPresence({ 
  children, 
  className = '',
  animation = 'fadeUp',
  delay = 0,
  duration = 0.3
}: AnimatedPresenceWrapperProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={variantMap[animation]}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Interactive button wrapper with hover/tap effects
interface InteractiveWrapperProps {
  children: ReactNode;
  className?: string;
  hoverScale?: number;
  tapScale?: number;
  hoverY?: number;
  disabled?: boolean;
}

export function InteractiveWrapper({ 
  children, 
  className = '',
  hoverScale = 1.02,
  tapScale = 0.98,
  hoverY = -2,
  disabled = false
}: InteractiveWrapperProps) {
  return (
    <motion.div
      whileHover={disabled ? {} : { scale: hoverScale, y: hoverY }}
      whileTap={disabled ? {} : { scale: tapScale }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Pulsing glow effect
interface PulseGlowProps {
  children: ReactNode;
  className?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PulseGlow({ 
  children, 
  className = '',
  size = 'md'
}: PulseGlowProps) {
  const sizeMap = {
    sm: 'before:animate-[pulse-ring_1.5s_ease-out_infinite] before:w-full before:h-full',
    md: 'before:animate-[pulse-ring_1.5s_ease-out_infinite] before:w-[calc(100%+8px)] before:h-[calc(100%+8px)]',
    lg: 'before:animate-[pulse-ring_1.5s_ease-out_infinite] before:w-[calc(100%+16px)] before:h-[calc(100%+16px)]',
  };

  return (
    <div className={cn(
      "relative inline-flex",
      "before:absolute before:inset-0 before:rounded-full before:border-2 before:border-primary/30 before:m-auto",
      sizeMap[size],
      className
    )}>
      {children}
    </div>
  );
}

// Success checkmark animation
export function SuccessCheck({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 10,
        delay: 0.1
      }}
      className={cn(
        "w-6 h-6 rounded-full bg-success flex items-center justify-center",
        className
      )}
    >
      <motion.svg
        viewBox="0 0 24 24"
        className="w-4 h-4 text-success-foreground"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <motion.path
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 12l5 5L19 7"
        />
      </motion.svg>
    </motion.div>
  );
}

// Loading spinner with smooth animation
export function LoadingSpinner({ 
  className = '', 
  size = 'md' 
}: { 
  className?: string; 
  size?: 'sm' | 'md' | 'lg' 
}) {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <motion.div
      className={cn(
        "rounded-full border-primary/30 border-t-primary",
        sizeMap[size],
        className
      )}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Number counter animation
interface CounterProps {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}

export function AnimatedCounter({ 
  value, 
  duration = 1, 
  className = '',
  suffix = '',
  prefix = ''
}: CounterProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.span
        key={value}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {prefix}{value}{suffix}
      </motion.span>
    </motion.span>
  );
}

// Progress bar with animation
interface AnimatedProgressProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
}

export function AnimatedProgress({ 
  value, 
  max = 100, 
  className = '',
  barClassName = '',
  showLabel = false
}: AnimatedProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full bg-primary rounded-full",
            barClassName
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {showLabel && (
        <motion.span
          className="absolute -top-5 text-xs text-muted-foreground"
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {Math.round(percentage)}%
        </motion.span>
      )}
    </div>
  );
}

// Floating animation wrapper
export function FloatingElement({ 
  children, 
  className = '',
  amplitude = 5,
  duration = 3
}: { 
  children: ReactNode; 
  className?: string;
  amplitude?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [-amplitude, amplitude, -amplitude] }}
      transition={{ 
        duration, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }}
    >
      {children}
    </motion.div>
  );
}

// Shimmer effect for loading states
export function ShimmerEffect({ className = '' }: { className?: string }) {
  return (
    <div className={cn(
      "relative overflow-hidden bg-secondary/50 rounded",
      className
    )}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// Ripple effect on click
interface RippleButtonProps extends HTMLMotionProps<"button"> {
  children: ReactNode;
  className?: string;
}

export const RippleButton = forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ children, className = '', onClick, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        whileTap={{ scale: 0.98 }}
        onClick={(e) => {
          // Create ripple effect
          const button = e.currentTarget;
          const rect = button.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          const ripple = document.createElement('span');
          ripple.style.cssText = `
            position: absolute;
            background: currentColor;
            opacity: 0.2;
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            left: ${x}px;
            top: ${y}px;
            width: 100px;
            height: 100px;
            margin-left: -50px;
            margin-top: -50px;
          `;
          button.appendChild(ripple);
          setTimeout(() => ripple.remove(), 600);
          
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
RippleButton.displayName = 'RippleButton';

// Export all variants for external use
export const animationVariants = {
  fadeInUp,
  fadeInDown,
  scaleIn,
  scaleBounce,
  slideInLeft,
  slideInRight,
};
