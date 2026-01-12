import { memo } from 'react';

type ViewType = 'front' | 'side' | 'top';

interface CoordinateSystemProps {
  centerX: number;
  centerY: number;
  canvasWidth: number;
  canvasHeight: number;
  scale: number; // pixels per mm
  currentView: ViewType;
  gridSize: number;
}

// Get axis labels based on view type
const getAxisLabels = (view: ViewType) => {
  switch (view) {
    case 'front': // XZ plane
      return { horizontal: 'X', vertical: 'Z', unit: 'mm' };
    case 'side': // YZ plane  
      return { horizontal: 'Y', vertical: 'Z', unit: 'mm' };
    case 'top': // XY plane
      return { horizontal: 'X', vertical: 'Y', unit: 'mm' };
    default:
      return { horizontal: 'X', vertical: 'Z', unit: 'mm' };
  }
};

export const CoordinateSystem = memo(function CoordinateSystem({
  centerX,
  centerY,
  canvasWidth,
  canvasHeight,
  scale,
  currentView,
  gridSize,
}: CoordinateSystemProps) {
  const axisLabels = getAxisLabels(currentView);
  
  // Scale ruler settings
  const rulerTickInterval = 100; // mm
  const tickPixels = rulerTickInterval * scale;
  const majorTickLength = 12;
  const minorTickLength = 6;
  
  // Generate ruler ticks
  const horizontalTicks: { pos: number; value: number; isMajor: boolean }[] = [];
  const verticalTicks: { pos: number; value: number; isMajor: boolean }[] = [];
  
  // Horizontal axis ticks (from center going both directions)
  for (let mm = 0; mm <= canvasWidth / scale / 2 + rulerTickInterval; mm += rulerTickInterval / 2) {
    if (mm > 0) {
      const posRight = centerX + mm * scale;
      const posLeft = centerX - mm * scale;
      const isMajor = mm % rulerTickInterval === 0;
      
      if (posRight < canvasWidth) {
        horizontalTicks.push({ pos: posRight, value: mm, isMajor });
      }
      if (posLeft > 0) {
        horizontalTicks.push({ pos: posLeft, value: -mm, isMajor });
      }
    }
  }
  
  // Vertical axis ticks (from center going both directions)
  for (let mm = 0; mm <= canvasHeight / scale / 2 + rulerTickInterval; mm += rulerTickInterval / 2) {
    if (mm > 0) {
      const posDown = centerY + mm * scale;
      const posUp = centerY - mm * scale;
      const isMajor = mm % rulerTickInterval === 0;
      
      // For Z axis (front/side view), up is positive
      // For Y axis (top view), could be either direction
      if (posUp > 0) {
        verticalTicks.push({ 
          pos: posUp, 
          value: currentView === 'top' ? -mm : mm, 
          isMajor 
        });
      }
      if (posDown < canvasHeight) {
        verticalTicks.push({ 
          pos: posDown, 
          value: currentView === 'top' ? mm : -mm, 
          isMajor 
        });
      }
    }
  }

  return (
    <g className="coordinate-system">
      {/* Axis lines with enhanced styling */}
      <line 
        x1={40} 
        y1={centerY} 
        x2={canvasWidth - 20} 
        y2={centerY} 
        stroke="hsl(var(--primary))" 
        strokeWidth="1.5" 
        opacity="0.6"
        markerEnd="url(#arrowhead-h)"
      />
      <line 
        x1={centerX} 
        y1={canvasHeight - 40} 
        x2={centerX} 
        y2={20} 
        stroke="hsl(var(--primary))" 
        strokeWidth="1.5" 
        opacity="0.6"
        markerEnd="url(#arrowhead-v)"
      />
      
      {/* Arrow markers */}
      <defs>
        <marker 
          id="arrowhead-h" 
          markerWidth="8" 
          markerHeight="6" 
          refX="8" 
          refY="3" 
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" opacity="0.6" />
        </marker>
        <marker 
          id="arrowhead-v" 
          markerWidth="8" 
          markerHeight="6" 
          refX="8" 
          refY="3" 
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" opacity="0.6" />
        </marker>
      </defs>
      
      {/* Horizontal axis label */}
      <g transform={`translate(${canvasWidth - 35}, ${centerY + 25})`}>
        <rect x="-14" y="-11" width="28" height="22" rx="4" fill="hsl(220 60% 50%)" opacity="0.9" />
        <text 
          textAnchor="middle" 
          fill="white" 
          fontSize="13" 
          fontWeight="700"
          y="5"
        >
          {axisLabels.horizontal}
        </text>
      </g>
      
      {/* Vertical axis label */}
      <g transform={`translate(${centerX - 30}, 35)`}>
        <rect x="-14" y="-11" width="28" height="22" rx="4" fill="hsl(142 60% 45%)" opacity="0.9" />
        <text 
          textAnchor="middle" 
          fill="white" 
          fontSize="13" 
          fontWeight="700"
          y="5"
        >
          {axisLabels.vertical}
        </text>
      </g>
      
      {/* Origin label */}
      <g transform={`translate(${centerX + 20}, ${centerY + 20})`}>
        <rect x="-12" y="-10" width="24" height="20" rx="4" fill="hsl(var(--muted))" opacity="0.9" />
        <text 
          textAnchor="middle" 
          fill="hsl(var(--muted-foreground))" 
          fontSize="11" 
          fontWeight="600"
          y="4"
        >
          O
        </text>
      </g>
      
      {/* Horizontal ruler ticks */}
      {horizontalTicks.map((tick, i) => (
        <g key={`h-${i}`}>
          <line
            x1={tick.pos}
            y1={centerY - (tick.isMajor ? majorTickLength : minorTickLength)}
            x2={tick.pos}
            y2={centerY + (tick.isMajor ? majorTickLength : minorTickLength)}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={tick.isMajor ? 1 : 0.5}
            opacity={tick.isMajor ? 0.5 : 0.3}
          />
          {tick.isMajor && tick.value !== 0 && (
            <text
              x={tick.pos}
              y={centerY + majorTickLength + 14}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontSize="9"
              fontWeight="500"
            >
              {tick.value}
            </text>
          )}
        </g>
      ))}
      
      {/* Vertical ruler ticks */}
      {verticalTicks.map((tick, i) => (
        <g key={`v-${i}`}>
          <line
            x1={centerX - (tick.isMajor ? majorTickLength : minorTickLength)}
            y1={tick.pos}
            x2={centerX + (tick.isMajor ? majorTickLength : minorTickLength)}
            y2={tick.pos}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={tick.isMajor ? 1 : 0.5}
            opacity={tick.isMajor ? 0.5 : 0.3}
          />
          {tick.isMajor && tick.value !== 0 && (
            <text
              x={centerX - majorTickLength - 8}
              y={tick.pos + 3}
              textAnchor="end"
              fill="hsl(var(--muted-foreground))"
              fontSize="9"
              fontWeight="500"
            >
              {tick.value}
            </text>
          )}
        </g>
      ))}
      
      {/* Scale bar at bottom left */}
      <g transform={`translate(60, ${canvasHeight - 50})`}>
        <rect x="-10" y="-18" width={tickPixels + 80} height="36" rx="6" fill="rgba(30, 41, 59, 0.95)" />
        
        <line x1="0" y1="0" x2={tickPixels} y2="0" stroke="white" strokeWidth="2" />
        <line x1="0" y1="-6" x2="0" y2="6" stroke="white" strokeWidth="2" />
        <line x1={tickPixels} y1="-6" x2={tickPixels} y2="6" stroke="white" strokeWidth="2" />
        
        <text x={tickPixels / 2} y="-6" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">
          {rulerTickInterval}mm
        </text>
        
        <text x={tickPixels + 15} y="4" fill="hsl(var(--muted-foreground))" fontSize="9">
          比例 1:{Math.round(1 / scale)}
        </text>
      </g>
      
      {/* View plane indicator */}
      <g transform={`translate(${canvasWidth - 90}, ${canvasHeight - 50})`}>
        <rect x="-45" y="-18" width="90" height="36" rx="6" fill="rgba(30, 41, 59, 0.95)" />
        <text textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" y="-4">
          当前平面
        </text>
        <text textAnchor="middle" fill="white" fontSize="12" fontWeight="600" y="12">
          {currentView === 'front' ? 'X-Z' : currentView === 'side' ? 'Y-Z' : 'X-Y'}
        </text>
      </g>
    </g>
  );
});
