import { memo, useMemo } from 'react';
import type { LayoutObject } from './ObjectPropertyPanel';

type ViewType = 'front' | 'side' | 'top';

interface EngineeringAnnotationsProps {
  objects: LayoutObject[];
  selectedObject: LayoutObject | null;
  secondSelectedObject: LayoutObject | null;
  centerX: number;
  centerY: number;
  scale: number;
  currentView: ViewType;
  showCameraSpacing: boolean;
  showWorkingDistance: boolean;
}

// Engineering drawing style dimension line with arrows
const DimensionLine = memo(function DimensionLine({
  x1, y1, x2, y2,
  label,
  color,
  offset = 0,
  orientation = 'auto',
}: {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  color: string;
  offset?: number;
  orientation?: 'horizontal' | 'vertical' | 'auto';
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  const isHorizontal = orientation === 'horizontal' || 
    (orientation === 'auto' && Math.abs(dx) > Math.abs(dy));
  
  // Offset the dimension line perpendicular to the measured line
  const offsetX = isHorizontal ? 0 : offset;
  const offsetY = isHorizontal ? offset : 0;
  
  const startX = x1 + offsetX;
  const startY = y1 + offsetY;
  const endX = x2 + offsetX;
  const endY = y2 + offsetY;
  
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  
  const arrowSize = 8;
  
  return (
    <g className="dimension-line">
      {/* Extension lines */}
      <line
        x1={x1} y1={y1}
        x2={startX} y2={startY}
        stroke={color}
        strokeWidth="0.75"
        opacity="0.5"
      />
      <line
        x1={x2} y1={y2}
        x2={endX} y2={endY}
        stroke={color}
        strokeWidth="0.75"
        opacity="0.5"
      />
      
      {/* Main dimension line */}
      <line
        x1={startX} y1={startY}
        x2={endX} y2={endY}
        stroke={color}
        strokeWidth="1.5"
      />
      
      {/* Arrow heads */}
      {isHorizontal ? (
        <>
          <polygon
            points={`${startX},${startY} ${startX + arrowSize},${startY - arrowSize/2} ${startX + arrowSize},${startY + arrowSize/2}`}
            fill={color}
          />
          <polygon
            points={`${endX},${endY} ${endX - arrowSize},${endY - arrowSize/2} ${endX - arrowSize},${endY + arrowSize/2}`}
            fill={color}
          />
        </>
      ) : (
        <>
          <polygon
            points={`${startX},${startY} ${startX - arrowSize/2},${startY + arrowSize} ${startX + arrowSize/2},${startY + arrowSize}`}
            fill={color}
          />
          <polygon
            points={`${endX},${endY} ${endX - arrowSize/2},${endY - arrowSize} ${endX + arrowSize/2},${endY - arrowSize}`}
            fill={color}
          />
        </>
      )}
      
      {/* Label background and text */}
      <g transform={`translate(${midX}, ${midY})`}>
        <rect
          x={-28}
          y={-11}
          width={56}
          height={22}
          fill="rgba(15, 23, 42, 0.95)"
          stroke={color}
          strokeWidth="1.5"
          rx="4"
        />
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fill={color}
          fontSize="11"
          fontWeight="700"
        >
          {label}
        </text>
      </g>
    </g>
  );
});

// Camera spacing connection line
const CameraSpacingLine = memo(function CameraSpacingLine({
  cam1, cam2, scale,
}: {
  cam1: LayoutObject;
  cam2: LayoutObject;
  scale: number;
}) {
  const dx = (cam2.x - cam1.x) / scale;
  const dy = (cam1.y - cam2.y) / scale; // Invert for display
  const distance = Math.round(Math.sqrt(dx * dx + dy * dy));
  const horizontalDist = Math.abs(Math.round(dx));
  const verticalDist = Math.abs(Math.round(dy));
  
  const midX = (cam1.x + cam2.x) / 2;
  const midY = (cam1.y + cam2.y) / 2;
  
  return (
    <g className="camera-spacing">
      {/* Main connection line */}
      <line
        x1={cam1.x}
        y1={cam1.y}
        x2={cam2.x}
        y2={cam2.y}
        stroke="#22c55e"
        strokeWidth="2"
        strokeDasharray="8 4"
        opacity="0.8"
      />
      
      {/* Connection points */}
      <circle cx={cam1.x} cy={cam1.y} r="5" fill="#22c55e" opacity="0.8" />
      <circle cx={cam2.x} cy={cam2.y} r="5" fill="#22c55e" opacity="0.8" />
      
      {/* Horizontal component line (if significant) */}
      {horizontalDist > 20 && verticalDist > 20 && (
        <>
          <line
            x1={cam1.x}
            y1={cam2.y}
            x2={cam2.x}
            y2={cam2.y}
            stroke="#ef4444"
            strokeWidth="1"
            strokeDasharray="4 2"
            opacity="0.6"
          />
          {/* Horizontal distance label */}
          <g transform={`translate(${midX}, ${cam2.y + 18})`}>
            <rect x="-24" y="-9" width="48" height="18" rx="4" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1" />
            <text x="0" y="4" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="600">
              ΔX:{horizontalDist}
            </text>
          </g>
          
          {/* Vertical component line */}
          <line
            x1={cam1.x}
            y1={cam1.y}
            x2={cam1.x}
            y2={cam2.y}
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4 2"
            opacity="0.6"
          />
          {/* Vertical distance label */}
          <g transform={`translate(${cam1.x - 28}, ${midY})`}>
            <rect x="-24" y="-9" width="48" height="18" rx="4" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="1" />
            <text x="0" y="4" textAnchor="middle" fill="#3b82f6" fontSize="10" fontWeight="600">
              ΔZ:{verticalDist}
            </text>
          </g>
        </>
      )}
      
      {/* Total distance label */}
      <g transform={`translate(${midX}, ${midY})`}>
        <rect
          x="-38"
          y="-14"
          width="76"
          height="28"
          fill="rgba(34, 197, 94, 0.15)"
          stroke="#22c55e"
          strokeWidth="2"
          rx="6"
        />
        <text
          x={0}
          y={5}
          textAnchor="middle"
          fill="#22c55e"
          fontSize="13"
          fontWeight="700"
        >
          {distance}mm
        </text>
      </g>
    </g>
  );
});

// Working distance line (camera to product center)
const WorkingDistanceLine = memo(function WorkingDistanceLine({
  camera, centerX, centerY, scale, color = '#fbbf24',
}: {
  camera: LayoutObject;
  centerX: number;
  centerY: number;
  scale: number;
  color?: string;
}) {
  const dx = (camera.x - centerX) / scale;
  const dy = (centerY - camera.y) / scale;
  const distance = Math.round(Math.sqrt(dx * dx + dy * dy));
  const horizontalDist = Math.abs(Math.round(dx));
  const verticalDist = Math.abs(Math.round(dy));
  
  const midX = (camera.x + centerX) / 2;
  const midY = (camera.y + centerY) / 2;
  
  return (
    <g className="working-distance">
      {/* Main line */}
      <line
        x1={camera.x}
        y1={camera.y}
        x2={centerX}
        y2={centerY}
        stroke={color}
        strokeWidth="2"
        strokeDasharray="6 3"
        opacity="0.9"
      />
      
      {/* End markers */}
      <circle cx={camera.x} cy={camera.y} r="4" fill={color} />
      <circle cx={centerX} cy={centerY} r="6" fill="none" stroke={color} strokeWidth="2" />
      <circle cx={centerX} cy={centerY} r="2" fill={color} />
      
      {/* Horizontal/Vertical components */}
      {horizontalDist > 30 && verticalDist > 30 && (
        <>
          {/* Horizontal component */}
          <DimensionLine
            x1={centerX}
            y1={centerY}
            x2={camera.x}
            y2={centerY}
            label={`X:${Math.round(dx)}mm`}
            color="#ef4444"
            offset={35}
            orientation="horizontal"
          />
          
          {/* Vertical component */}
          <DimensionLine
            x1={camera.x}
            y1={centerY}
            x2={camera.x}
            y2={camera.y}
            label={`Z:${Math.round(dy)}mm`}
            color="#22c55e"
            offset={35}
            orientation="vertical"
          />
        </>
      )}
      
      {/* Total distance label */}
      <g transform={`translate(${midX}, ${midY})`}>
        <rect
          x="-45"
          y="-16"
          width="90"
          height="32"
          fill="rgba(251, 191, 36, 0.15)"
          stroke={color}
          strokeWidth="2"
          rx="6"
        />
        <text x={0} y={-2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">
          工作距离
        </text>
        <text x={0} y={12} textAnchor="middle" fill={color} fontSize="14" fontWeight="700">
          {distance}mm
        </text>
      </g>
    </g>
  );
});

export const EngineeringAnnotations = memo(function EngineeringAnnotations({
  objects,
  selectedObject,
  secondSelectedObject,
  centerX,
  centerY,
  scale,
  currentView,
  showCameraSpacing,
  showWorkingDistance,
}: EngineeringAnnotationsProps) {
  const cameras = useMemo(() => objects.filter(o => o.type === 'camera'), [objects]);
  
  // Generate camera spacing pairs
  const cameraSpacingPairs = useMemo(() => {
    if (!showCameraSpacing || cameras.length < 2) return [];
    const pairs: [LayoutObject, LayoutObject][] = [];
    for (let i = 0; i < cameras.length; i++) {
      for (let j = i + 1; j < cameras.length; j++) {
        pairs.push([cameras[i], cameras[j]]);
      }
    }
    return pairs;
  }, [cameras, showCameraSpacing]);

  return (
    <g className="engineering-annotations">
      {/* Camera spacing lines */}
      {cameraSpacingPairs.map(([cam1, cam2], i) => (
        <CameraSpacingLine key={`spacing-${i}`} cam1={cam1} cam2={cam2} scale={scale} />
      ))}
      
      {/* Working distance for all cameras */}
      {showWorkingDistance && cameras.map((camera, i) => (
        <WorkingDistanceLine
          key={`wd-${camera.id}`}
          camera={camera}
          centerX={centerX}
          centerY={centerY}
          scale={scale}
          color={selectedObject?.id === camera.id ? '#f59e0b' : '#fbbf24'}
        />
      ))}
      
      {/* Selected object dimension arrows */}
      {selectedObject && (
        <>
          {/* Width dimension */}
          <DimensionLine
            x1={selectedObject.x - selectedObject.width / 2}
            y1={selectedObject.y + selectedObject.height / 2}
            x2={selectedObject.x + selectedObject.width / 2}
            y2={selectedObject.y + selectedObject.height / 2}
            label={`${Math.round(selectedObject.width / scale)}mm`}
            color="#60a5fa"
            offset={25}
            orientation="horizontal"
          />
          
          {/* Height dimension */}
          <DimensionLine
            x1={selectedObject.x + selectedObject.width / 2}
            y1={selectedObject.y - selectedObject.height / 2}
            x2={selectedObject.x + selectedObject.width / 2}
            y2={selectedObject.y + selectedObject.height / 2}
            label={`${Math.round(selectedObject.height / scale)}mm`}
            color="#60a5fa"
            offset={25}
            orientation="vertical"
          />
        </>
      )}
      
      {/* Distance between two selected objects */}
      {selectedObject && secondSelectedObject && (
        <CameraSpacingLine
          cam1={selectedObject}
          cam2={secondSelectedObject}
          scale={scale}
        />
      )}
    </g>
  );
});
