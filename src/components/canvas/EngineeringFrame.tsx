import { memo } from 'react';
import { motion } from 'framer-motion';

type ViewType = 'front' | 'side' | 'top';

interface EngineeringFrameProps {
  canvasWidth: number;
  canvasHeight: number;
  currentView: ViewType;
  projectName?: string;
  workstationName?: string;
  scale: number;
  dateStr?: string;
  version?: string;
}

// ISO drawing frame with title block
export const EngineeringFrame = memo(function EngineeringFrame({
  canvasWidth,
  canvasHeight,
  currentView,
  projectName = '视觉工位布局',
  workstationName = '工位',
  scale,
  dateStr = new Date().toLocaleDateString('zh-CN'),
  version = 'V1.0',
}: EngineeringFrameProps) {
  const margin = 20;
  const titleBlockHeight = 60;
  const titleBlockWidth = 280;
  
  const viewNameMap = {
    front: '正视图',
    side: '左视图', 
    top: '俯视图',
  };
  
  const viewPlaneMap = {
    front: 'X-Z平面',
    side: 'Y-Z平面',
    top: 'X-Y平面',
  };

  return (
    <g className="engineering-frame">
      {/* Outer border - double line */}
      <rect
        x={margin}
        y={margin}
        width={canvasWidth - margin * 2}
        height={canvasHeight - margin * 2}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="2"
        opacity="0.6"
      />
      <rect
        x={margin + 4}
        y={margin + 4}
        width={canvasWidth - margin * 2 - 8}
        height={canvasHeight - margin * 2 - 8}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="0.5"
        opacity="0.4"
      />
      
      {/* Corner marks */}
      {[
        { x: margin, y: margin },
        { x: canvasWidth - margin, y: margin },
        { x: margin, y: canvasHeight - margin },
        { x: canvasWidth - margin, y: canvasHeight - margin },
      ].map((corner, i) => (
        <g key={i}>
          <circle
            cx={corner.x}
            cy={corner.y}
            r={6}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1"
            opacity="0.5"
          />
          <circle
            cx={corner.x}
            cy={corner.y}
            r={2}
            fill="hsl(var(--primary))"
            opacity="0.5"
          />
        </g>
      ))}
      
      {/* Title Block (bottom right) */}
      <g transform={`translate(${canvasWidth - margin - titleBlockWidth}, ${canvasHeight - margin - titleBlockHeight})`}>
        {/* Title block background */}
        <rect
          x={0}
          y={0}
          width={titleBlockWidth}
          height={titleBlockHeight}
          fill="hsl(var(--card))"
          stroke="hsl(var(--foreground))"
          strokeWidth="1"
          opacity="0.95"
        />
        
        {/* Dividing lines */}
        <line x1={0} y1={20} x2={titleBlockWidth} y2={20} stroke="hsl(var(--border))" strokeWidth="0.5" />
        <line x1={0} y1={40} x2={titleBlockWidth} y2={40} stroke="hsl(var(--border))" strokeWidth="0.5" />
        <line x1={140} y1={0} x2={140} y2={60} stroke="hsl(var(--border))" strokeWidth="0.5" />
        <line x1={210} y1={20} x2={210} y2={60} stroke="hsl(var(--border))" strokeWidth="0.5" />
        
        {/* Row 1: Title */}
        <text x={70} y={14} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="10" fontWeight="600">
          {projectName}
        </text>
        <text x={210} y={14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">
          {workstationName}
        </text>
        
        {/* Row 2: View info */}
        <text x={10} y={34} fill="hsl(var(--muted-foreground))" fontSize="8">视图</text>
        <text x={70} y={34} textAnchor="middle" fill="hsl(var(--primary))" fontSize="10" fontWeight="600">
          {viewNameMap[currentView]}
        </text>
        <text x={150} y={34} fill="hsl(var(--muted-foreground))" fontSize="8">平面</text>
        <text x={245} y={34} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="9">
          {viewPlaneMap[currentView]}
        </text>
        
        {/* Row 3: Scale & Date */}
        <text x={10} y={54} fill="hsl(var(--muted-foreground))" fontSize="8">比例</text>
        <text x={70} y={54} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="10" fontWeight="500">
          1:{Math.round(1 / scale)}
        </text>
        <text x={150} y={54} fill="hsl(var(--muted-foreground))" fontSize="8">日期</text>
        <text x={245} y={54} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="9">
          {dateStr}
        </text>
      </g>
      
      {/* Version badge (top right) */}
      <g transform={`translate(${canvasWidth - margin - 60}, ${margin + 20})`}>
        <rect x={0} y={-12} width={50} height={24} rx={4} fill="hsl(var(--primary))" opacity="0.9" />
        <text x={25} y={4} textAnchor="middle" fill="hsl(var(--primary-foreground))" fontSize="10" fontWeight="600">
          {version}
        </text>
      </g>
      
      {/* View indicator (top left) */}
      <g transform={`translate(${margin + 20}, ${margin + 20})`}>
        <ViewCubeIndicator currentView={currentView} size={50} />
      </g>
    </g>
  );
});

// 3D View cube indicator
interface ViewCubeIndicatorProps {
  currentView: ViewType;
  size?: number;
}

export const ViewCubeIndicator = memo(function ViewCubeIndicator({
  currentView,
  size = 50,
}: ViewCubeIndicatorProps) {
  const halfSize = size / 2;
  const depth = size * 0.3;
  
  // Isometric projection offsets
  const isoX = depth * 0.7;
  const isoY = depth * 0.4;
  
  const getFaceOpacity = (face: 'front' | 'side' | 'top') => {
    return currentView === face ? 1 : 0.3;
  };
  
  const getFaceColor = (face: 'front' | 'side' | 'top') => {
    switch (face) {
      case 'front': return 'hsl(220, 70%, 50%)'; // Blue
      case 'side': return 'hsl(142, 70%, 45%)'; // Green
      case 'top': return 'hsl(0, 70%, 50%)'; // Red
    }
  };

  return (
    <g className="view-cube-indicator">
      {/* Background */}
      <rect
        x={-8}
        y={-8}
        width={size + 16 + isoX}
        height={size + 16 + isoY}
        rx={8}
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
        opacity="0.95"
      />
      
      {/* 3D Cube representation */}
      <g transform={`translate(${8}, ${8 + isoY})`}>
        {/* Top face (X-Y plane) */}
        <polygon
          points={`
            0,0
            ${halfSize},${-isoY}
            ${halfSize + isoX},${-isoY + isoY/2}
            ${isoX},${isoY/2}
          `}
          fill={getFaceColor('top')}
          opacity={getFaceOpacity('top')}
          stroke="hsl(var(--foreground))"
          strokeWidth="1"
        />
        
        {/* Front face (X-Z plane) */}
        <polygon
          points={`
            0,0
            ${halfSize},0
            ${halfSize},${halfSize}
            0,${halfSize}
          `}
          fill={getFaceColor('front')}
          opacity={getFaceOpacity('front')}
          stroke="hsl(var(--foreground))"
          strokeWidth="1"
          transform={`translate(0, ${isoY/2})`}
        />
        
        {/* Side face (Y-Z plane) */}
        <polygon
          points={`
            ${halfSize},0
            ${halfSize + isoX},${-isoY/2}
            ${halfSize + isoX},${halfSize - isoY/2}
            ${halfSize},${halfSize}
          `}
          fill={getFaceColor('side')}
          opacity={getFaceOpacity('side')}
          stroke="hsl(var(--foreground))"
          strokeWidth="1"
          transform={`translate(0, ${isoY/2})`}
        />
        
        {/* Axis labels */}
        <text x={halfSize / 2} y={halfSize + isoY/2 + 14} textAnchor="middle" fontSize="8" fill="hsl(220, 70%, 50%)" fontWeight="600">正</text>
        <text x={halfSize + isoX + 6} y={halfSize/2} fontSize="8" fill="hsl(142, 70%, 45%)" fontWeight="600">侧</text>
        <text x={halfSize/2 + isoX/2} y={-isoY + 4} textAnchor="middle" fontSize="8" fill="hsl(0, 70%, 50%)" fontWeight="600">俯</text>
      </g>
    </g>
  );
});

// Scale bar component
interface ScaleBarProps {
  x: number;
  y: number;
  scale: number;
  unit?: string;
}

export const ScaleBar = memo(function ScaleBar({
  x,
  y,
  scale,
  unit = 'mm',
}: ScaleBarProps) {
  const scaleLength = 100; // 100mm
  const pixelLength = scaleLength * scale;
  const divisions = 5;
  const divisionWidth = pixelLength / divisions;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Background */}
      <rect
        x={-10}
        y={-25}
        width={pixelLength + 80}
        height={45}
        rx={6}
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
        opacity="0.95"
      />
      
      {/* Scale bar segments */}
      {Array.from({ length: divisions }).map((_, i) => (
        <rect
          key={i}
          x={i * divisionWidth}
          y={0}
          width={divisionWidth}
          height={8}
          fill={i % 2 === 0 ? 'hsl(var(--foreground))' : 'hsl(var(--background))'}
          stroke="hsl(var(--foreground))"
          strokeWidth="0.5"
        />
      ))}
      
      {/* Tick marks */}
      {Array.from({ length: divisions + 1 }).map((_, i) => (
        <g key={`tick-${i}`}>
          <line
            x1={i * divisionWidth}
            y1={8}
            x2={i * divisionWidth}
            y2={14}
            stroke="hsl(var(--foreground))"
            strokeWidth="1"
          />
          <text
            x={i * divisionWidth}
            y={24}
            textAnchor="middle"
            fontSize="8"
            fill="hsl(var(--muted-foreground))"
          >
            {i * (scaleLength / divisions)}
          </text>
        </g>
      ))}
      
      {/* Unit label */}
      <text
        x={pixelLength + 15}
        y={6}
        fontSize="10"
        fontWeight="600"
        fill="hsl(var(--foreground))"
      >
        {unit}
      </text>
      
      {/* Scale ratio */}
      <text
        x={pixelLength + 15}
        y={22}
        fontSize="9"
        fill="hsl(var(--muted-foreground))"
      >
        1:{Math.round(1 / scale)}
      </text>
    </g>
  );
});

// Dimension line component (ISO style)
interface DimensionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  unit?: string;
  offset?: number;
  color?: string;
}

export const DimensionLine = memo(function DimensionLine({
  x1,
  y1,
  x2,
  y2,
  value,
  unit = 'mm',
  offset = 20,
  color = 'hsl(var(--primary))',
}: DimensionLineProps) {
  const isHorizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  
  // Calculate dimension line position
  const dimX1 = isHorizontal ? x1 : x1 + offset;
  const dimY1 = isHorizontal ? y1 - offset : y1;
  const dimX2 = isHorizontal ? x2 : x2 + offset;
  const dimY2 = isHorizontal ? y2 - offset : y2;
  
  const dimMidX = (dimX1 + dimX2) / 2;
  const dimMidY = (dimY1 + dimY2) / 2;

  return (
    <g className="dimension-line">
      {/* Extension lines */}
      <line
        x1={x1}
        y1={y1}
        x2={dimX1}
        y2={dimY1}
        stroke={color}
        strokeWidth="0.5"
        strokeDasharray="2 2"
        opacity="0.6"
      />
      <line
        x1={x2}
        y1={y2}
        x2={dimX2}
        y2={dimY2}
        stroke={color}
        strokeWidth="0.5"
        strokeDasharray="2 2"
        opacity="0.6"
      />
      
      {/* Dimension line */}
      <line
        x1={dimX1}
        y1={dimY1}
        x2={dimX2}
        y2={dimY2}
        stroke={color}
        strokeWidth="1"
        markerStart="url(#dim-arrow-start)"
        markerEnd="url(#dim-arrow-end)"
      />
      
      {/* Arrows (defined in defs) */}
      <defs>
        <marker
          id="dim-arrow-start"
          markerWidth="8"
          markerHeight="6"
          refX="0"
          refY="3"
          orient="auto"
        >
          <polygon points="8 0, 0 3, 8 6" fill={color} />
        </marker>
        <marker
          id="dim-arrow-end"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={color} />
        </marker>
      </defs>
      
      {/* Value label */}
      <g transform={`translate(${dimMidX}, ${dimMidY})`}>
        <rect
          x={-25}
          y={-10}
          width={50}
          height={20}
          rx={3}
          fill="hsl(var(--background))"
          stroke={color}
          strokeWidth="0.5"
        />
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill={color}
        >
          {value}{unit}
        </text>
      </g>
    </g>
  );
});

// North arrow / orientation indicator
interface OrientationIndicatorProps {
  x: number;
  y: number;
  currentView: ViewType;
}

export const OrientationIndicator = memo(function OrientationIndicator({
  x,
  y,
  currentView,
}: OrientationIndicatorProps) {
  const getDirections = () => {
    switch (currentView) {
      case 'front':
        return { up: 'Z+', down: 'Z-', left: 'X-', right: 'X+' };
      case 'side':
        return { up: 'Z+', down: 'Z-', left: 'Y-', right: 'Y+' };
      case 'top':
        return { up: 'Y-', down: 'Y+', left: 'X-', right: 'X+' };
    }
  };
  
  const dirs = getDirections();

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={-35}
        y={-35}
        width={70}
        height={70}
        rx={8}
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
        opacity="0.95"
      />
      
      {/* Compass circle */}
      <circle
        cx={0}
        cy={0}
        r={25}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
      
      {/* Direction arrows */}
      <g>
        {/* Up arrow */}
        <line x1={0} y1={0} x2={0} y2={-20} stroke="hsl(var(--primary))" strokeWidth="2" />
        <polygon points="0,-25 -4,-18 4,-18" fill="hsl(var(--primary))" />
        <text x={0} y={-28} textAnchor="middle" fontSize="8" fill="hsl(var(--primary))" fontWeight="600">
          {dirs.up}
        </text>
        
        {/* Right arrow */}
        <line x1={0} y1={0} x2={18} y2={0} stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" />
        <text x={26} y={3} textAnchor="start" fontSize="7" fill="hsl(var(--muted-foreground))">
          {dirs.right}
        </text>
        
        {/* Down */}
        <text x={0} y={30} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))">
          {dirs.down}
        </text>
        
        {/* Left */}
        <text x={-26} y={3} textAnchor="end" fontSize="7" fill="hsl(var(--muted-foreground))">
          {dirs.left}
        </text>
      </g>
      
      {/* Center dot */}
      <circle cx={0} cy={0} r={3} fill="hsl(var(--foreground))" opacity="0.5" />
    </g>
  );
});

// Grid info display
interface GridInfoProps {
  x: number;
  y: number;
  gridSize: number;
  gridEnabled: boolean;
  snapEnabled: boolean;
}

export const GridInfo = memo(function GridInfo({
  x,
  y,
  gridSize,
  gridEnabled,
  snapEnabled,
}: GridInfoProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={0}
        y={0}
        width={100}
        height={40}
        rx={6}
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
        opacity="0.95"
      />
      
      <text x={10} y={16} fontSize="9" fill="hsl(var(--muted-foreground))">
        网格: {gridEnabled ? `${gridSize}mm` : '关闭'}
      </text>
      <text x={10} y={32} fontSize="9" fill="hsl(var(--muted-foreground))">
        吸附: {snapEnabled ? '开启' : '关闭'}
      </text>
      
      {/* Status indicators */}
      <circle cx={85} cy={12} r={4} fill={gridEnabled ? 'hsl(var(--success))' : 'hsl(var(--muted))'} />
      <circle cx={85} cy={28} r={4} fill={snapEnabled ? 'hsl(var(--success))' : 'hsl(var(--muted))'} />
    </g>
  );
});
