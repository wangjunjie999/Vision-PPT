import { motion, Variants } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedLayoutProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Smooth spring config
const springConfig = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

// Main content fade in with subtle scale
export function FadeIn({ children, className = '', delay = 0 }: AnimatedLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide from left (for sidebars)
export function SlideInLeft({ children, className = '', delay = 0 }: AnimatedLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        ...springConfig,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide from right (for panels)
export function SlideInRight({ children, className = '', delay = 0 }: AnimatedLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        ...springConfig,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Scale in with bounce (for cards/items)
export function ScaleIn({ children, className = '', delay = 0 }: AnimatedLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        type: "spring",
        stiffness: 400,
        damping: 20,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide up (for main content)
export function SlideUp({ children, className = '', delay = 0 }: AnimatedLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        ...springConfig,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Pop in effect (for important elements)
export function PopIn({ children, className = '', delay = 0 }: AnimatedLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        type: "spring",
        stiffness: 500,
        damping: 15,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// For animating lists of items with stagger
interface StaggerListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerList({ children, className = '', staggerDelay = 0.05 }: StaggerListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  index?: number;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    }
  },
};

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Hover animations for interactive elements
interface HoverScaleProps {
  children: ReactNode;
  className?: string;
  scale?: number;
  lift?: number;
}

export function HoverScale({ 
  children, 
  className = '', 
  scale = 1.02,
  lift = 2
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale, y: -lift }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Glow on hover
export function HoverGlow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={cn("relative", className)}
      whileHover="hover"
      initial="rest"
    >
      <motion.div
        className="absolute inset-0 rounded-lg bg-primary/20 blur-xl"
        variants={{
          rest: { opacity: 0, scale: 0.8 },
          hover: { opacity: 1, scale: 1 },
        }}
        transition={{ duration: 0.3 }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

// Page transition wrapper
export function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Expand animation for accordions/collapsibles
export function Expand({ 
  children, 
  className = '',
  isOpen = true 
}: { 
  children: ReactNode; 
  className?: string;
  isOpen?: boolean;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ 
        height: isOpen ? 'auto' : 0,
        opacity: isOpen ? 1 : 0 
      }}
      transition={{ 
        height: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }}
      className={cn("overflow-hidden", className)}
    >
      {children}
    </motion.div>
  );
}
