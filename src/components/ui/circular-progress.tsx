import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  valueFormat?: 'percent' | 'fraction' | 'value';
  label?: string;
  icon?: ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'accent';
  animated?: boolean;
  children?: ReactNode;
}

const sizeMap = {
  sm: { size: 48, stroke: 4, fontSize: 'text-xs', iconSize: 'h-3 w-3' },
  md: { size: 64, stroke: 5, fontSize: 'text-sm', iconSize: 'h-4 w-4' },
  lg: { size: 80, stroke: 6, fontSize: 'text-base', iconSize: 'h-5 w-5' },
  xl: { size: 100, stroke: 8, fontSize: 'text-lg', iconSize: 'h-6 w-6' },
};

const colorMap = {
  primary: {
    stroke: 'stroke-primary',
    bg: 'stroke-primary/20',
    text: 'text-primary',
    glow: 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]',
  },
  success: {
    stroke: 'stroke-success',
    bg: 'stroke-success/20',
    text: 'text-success',
    glow: 'drop-shadow-[0_0_6px_hsl(var(--success)/0.5)]',
  },
  warning: {
    stroke: 'stroke-warning',
    bg: 'stroke-warning/20',
    text: 'text-warning',
    glow: 'drop-shadow-[0_0_6px_hsl(var(--warning)/0.5)]',
  },
  destructive: {
    stroke: 'stroke-destructive',
    bg: 'stroke-destructive/20',
    text: 'text-destructive',
    glow: 'drop-shadow-[0_0_6px_hsl(var(--destructive)/0.5)]',
  },
  accent: {
    stroke: 'stroke-accent',
    bg: 'stroke-accent/20',
    text: 'text-accent',
    glow: 'drop-shadow-[0_0_6px_hsl(var(--accent)/0.5)]',
  },
};

export function CircularProgress({
  value,
  max = 100,
  size = 'md',
  strokeWidth,
  className,
  showValue = true,
  valueFormat = 'percent',
  label,
  icon,
  color = 'primary',
  animated = true,
  children,
}: CircularProgressProps) {
  const config = sizeMap[size];
  const colors = colorMap[color];
  const actualStrokeWidth = strokeWidth || config.stroke;
  
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (config.size - actualStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const displayValue = () => {
    switch (valueFormat) {
      case 'percent':
        return `${Math.round(percentage)}%`;
      case 'fraction':
        return `${value}/${max}`;
      case 'value':
        return value.toString();
      default:
        return `${Math.round(percentage)}%`;
    }
  };

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <div className="relative">
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            strokeWidth={actualStrokeWidth}
            className={colors.bg}
          />
          {/* Progress circle */}
          <motion.circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            strokeWidth={actualStrokeWidth}
            strokeLinecap="round"
            className={cn(colors.stroke, percentage === 100 && colors.glow)}
            initial={animated ? { strokeDashoffset: circumference } : false}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children ? (
            children
          ) : icon ? (
            <div className={cn(colors.text, config.iconSize)}>
              {icon}
            </div>
          ) : showValue ? (
            <motion.span
              className={cn("font-bold", config.fontSize, colors.text)}
              initial={animated ? { opacity: 0, scale: 0.5 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              {displayValue()}
            </motion.span>
          ) : null}
        </div>
      </div>
      
      {label && (
        <motion.span
          className="mt-2 text-xs text-muted-foreground text-center"
          initial={animated ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {label}
        </motion.span>
      )}
    </div>
  );
}

// Mini inline circular progress
interface MiniCircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  className?: string;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'accent';
}

export function MiniCircularProgress({
  value,
  max = 100,
  size = 20,
  className,
  color = 'primary',
}: MiniCircularProgressProps) {
  const colors = colorMap[color];
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min((value / max) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className={cn("transform -rotate-90", className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className={colors.bg}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={colors.stroke}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ strokeDasharray: circumference }}
      />
    </svg>
  );
}

// Stats card with circular progress
interface StatsCircularCardProps {
  title: string;
  value: number;
  max: number;
  icon: ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'accent';
  suffix?: string;
  description?: string;
}

export function StatsCircularCard({
  title,
  value,
  max,
  icon,
  color = 'primary',
  suffix,
  description,
}: StatsCircularCardProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const colors = colorMap[color];

  return (
    <motion.div
      className="relative p-4 rounded-xl bg-card border border-border hover:shadow-lg hover:border-primary/30 transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center gap-4">
        <CircularProgress
          value={value}
          max={max}
          size="lg"
          color={color}
          valueFormat="fraction"
          animated
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("p-1.5 rounded-md", `bg-${color}/10`)}>
              <span className={colors.text}>{icon}</span>
            </div>
            <span className="text-sm font-medium text-foreground truncate">{title}</span>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {suffix && (
            <p className="text-xs text-muted-foreground mt-1">{suffix}</p>
          )}
        </div>
      </div>
      
      {/* Completion indicator */}
      {percentage === 100 && (
        <motion.div
          className="absolute top-2 right-2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
            <svg className="w-3 h-3 text-success-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Multi-segment circular progress (for showing multiple values)
interface MultiSegmentProgressProps {
  segments: Array<{
    value: number;
    color: 'primary' | 'success' | 'warning' | 'destructive' | 'accent';
    label?: string;
  }>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showLegend?: boolean;
}

export function MultiSegmentProgress({
  segments,
  size = 'lg',
  className,
  showLegend = true,
}: MultiSegmentProgressProps) {
  const config = sizeMap[size];
  const strokeWidth = config.stroke;
  const radius = (config.size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  let currentOffset = 0;

  return (
    <div className={cn("inline-flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90"
        >
          {/* Background */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted/30"
          />
          
          {/* Segments */}
          {segments.map((segment, index) => {
            const percentage = total > 0 ? (segment.value / total) * 100 : 0;
            const segmentLength = (percentage / 100) * circumference;
            const offset = currentOffset;
            currentOffset += segmentLength;
            
            return (
              <motion.circle
                key={index}
                cx={config.size / 2}
                cy={config.size / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className={colorMap[segment.color].stroke}
                initial={{ strokeDashoffset: circumference }}
                animate={{ 
                  strokeDashoffset: circumference - segmentLength,
                }}
                transition={{ duration: 1, delay: index * 0.2, ease: "easeOut" }}
                style={{
                  strokeDasharray: `${segmentLength} ${circumference}`,
                  transform: `rotate(${(offset / circumference) * 360}deg)`,
                  transformOrigin: '50% 50%',
                }}
              />
            );
          })}
        </svg>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold", config.fontSize)}>{total}</span>
        </div>
      </div>
      
      {showLegend && (
        <div className="flex flex-wrap gap-2 justify-center">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div className={cn("w-2 h-2 rounded-full", `bg-${segment.color}`)} />
              <span className="text-muted-foreground">
                {segment.label || `${segment.value}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
