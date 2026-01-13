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

// Enhanced working distance visualization with view-aware projection
const WorkingDistanceLine = memo(function WorkingDistanceLine({
  camera, centerX, centerY, scale, color = '#fbbf24', currentView,
}: {
  camera: LayoutObject;
  centerX: number;
  centerY: number;
  scale: number;
  color?: string;
  currentView: ViewType;
}) {
  // Get the real 3D coordinates
  const posX = camera.posX ?? 0;
  const posY = camera.posY ?? 0;
  const posZ = camera.posZ ?? 300;
  
  // Calculate the actual 3D working distance (from camera to product center at 0,0,0)
  const distance3D = Math.round(Math.sqrt(posX * posX + posY * posY + posZ * posZ));
  
  // Get visible components based on view
  const getViewDistances = () => {
    switch (currentView) {
      case 'front': // X-Z plane visible
        return {
          horizontal: posX,
          vertical: posZ,
          horizontalLabel: 'X',
          verticalLabel: 'Z',
          depthLabel: 'Y',
          depth: posY,
        };
      case 'side': // Y-Z plane visible  
        return {
          horizontal: posY,
          vertical: posZ,
          horizontalLabel: 'Y',
          verticalLabel: 'Z',
          depthLabel: 'X',
          depth: posX,
        };
      case 'top': // X-Y plane visible
        return {
          horizontal: posX,
          vertical: -posY, // Invert for top view display
          horizontalLabel: 'X',
          verticalLabel: 'Y',
          depthLabel: 'Z',
          depth: posZ,
        };
    }
  };
  
  const viewDist = getViewDistances();
  const hasHorizontalOffset = Math.abs(viewDist.horizontal) > 20;
  const hasVerticalOffset = Math.abs(viewDist.vertical) > 20;
  
  const midX = (camera.x + centerX) / 2;
  const midY = (camera.y + centerY) / 2;
  
  return (
    <g className="working-distance">
      {/* Gradient definition for the beam */}
      <defs>
        <linearGradient id={`wd-gradient-${camera.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      
      {/* Vision cone / beam from camera to product */}
      <polygon
        points={`
          ${camera.x},${camera.y}
          ${centerX - 25},${centerY - 15}
          ${centerX + 25},${centerY - 15}
          ${centerX + 25},${centerY + 15}
          ${centerX - 25},${centerY + 15}
        `}
        fill={`url(#wd-gradient-${camera.id})`}
        opacity="0.15"
      />
      
      {/* Main working distance line */}
      <line
        x1={camera.x}
        y1={camera.y}
        x2={centerX}
        y2={centerY}
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray="8 4"
        opacity="0.9"
      />
      
      {/* Camera end marker */}
      <circle cx={camera.x} cy={camera.y} r="6" fill={color} opacity="0.9" />
      <circle cx={camera.x} cy={camera.y} r="3" fill="#fff" opacity="0.8" />
      
      {/* Product center target */}
      <g transform={`translate(${centerX}, ${centerY})`}>
        <circle r="12" fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
        <circle r="8" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
        <line x1="-15" y1="0" x2="15" y2="0" stroke={color} strokeWidth="1" opacity="0.6" />
        <line x1="0" y1="-15" x2="0" y2="15" stroke={color} strokeWidth="1" opacity="0.6" />
        <circle r="3" fill={color} opacity="0.9" />
      </g>
      
      {/* Horizontal/Vertical component visualization */}
      {hasHorizontalOffset && hasVerticalOffset && (
        <>
          {/* Right-angle marker */}
          <path
            d={`M ${camera.x} ${centerY} L ${camera.x} ${centerY - Math.sign(camera.y - centerY) * 12} L ${camera.x + Math.sign(centerX - camera.x) * 12} ${centerY - Math.sign(camera.y - centerY) * 12}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.5"
          />
          
          {/* Horizontal component */}
          <line
            x1={camera.x}
            y1={centerY}
            x2={centerX}
            y2={centerY}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.7"
          />
          <g transform={`translate(${midX}, ${centerY + 22})`}>
            <rect x="-30" y="-10" width="60" height="20" rx="4" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1" />
            <text x="0" y="4" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="600">
              {viewDist.horizontalLabel}: {Math.round(viewDist.horizontal)}
            </text>
          </g>
          
          {/* Vertical component */}
          <line
            x1={camera.x}
            y1={camera.y}
            x2={camera.x}
            y2={centerY}
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.7"
          />
          <g transform={`translate(${camera.x - 35}, ${(camera.y + centerY) / 2})`}>
            <rect x="-30" y="-10" width="60" height="20" rx="4" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="1" />
            <text x="0" y="4" textAnchor="middle" fill="#3b82f6" fontSize="10" fontWeight="600">
              {viewDist.verticalLabel}: {Math.round(viewDist.vertical)}
            </text>
          </g>
        </>
      )}
      
      {/* Depth indicator (the axis not visible in this view) */}
      {Math.abs(viewDist.depth) > 10 && (
        <g transform={`translate(${camera.x + 40}, ${camera.y - 20})`}>
          <rect x="-28" y="-10" width="56" height="20" rx="4" fill="rgba(168, 85, 247, 0.2)" stroke="#a855f7" strokeWidth="1" />
          <text x="0" y="4" textAnchor="middle" fill="#a855f7" fontSize="9" fontWeight="600">
            {viewDist.depthLabel}: {Math.round(viewDist.depth)}
          </text>
        </g>
      )}
      
      {/* Main distance label */}
      <g transform={`translate(${midX}, ${midY})`}>
        <rect
          x="-55"
          y="-22"
          width="110"
          height="44"
          fill="rgba(15, 23, 42, 0.95)"
          stroke={color}
          strokeWidth="2"
          rx="8"
        />
        <text x={0} y={-6} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">
          工作距离 (3D)
        </text>
        <text x={0} y={12} textAnchor="middle" fill={color} fontSize="16" fontWeight="700">
          {distance3D}mm
        </text>
      </g>
    </g>
  );
});

// Camera representation that changes based on view
export const CameraViewRepresentation = memo(function CameraViewRepresentation({
  camera,
  currentView,
  isSelected,
}: {
  camera: LayoutObject;
  currentView: ViewType;
  isSelected: boolean;
}) {
  const width = camera.width;
  const height = camera.height;
  
  // Calculate the visual angle of the camera based on its 3D position and current view
  const posX = camera.posX ?? 0;
  const posY = camera.posY ?? 0;
  const posZ = camera.posZ ?? 300;
  
  // Determine camera's visual orientation based on view
  const getCameraAngle = () => {
    switch (currentView) {
      case 'front': // X-Z plane - camera looks down if posZ > 0, tilted if posX != 0
        if (posZ > 0) {
          const tilt = Math.atan2(posX, posZ) * (180 / Math.PI);
          return Math.max(-45, Math.min(45, tilt));
        }
        return 0;
      case 'side': // Y-Z plane - shows camera from side
        if (posZ > 0) {
          const tilt = Math.atan2(posY, posZ) * (180 / Math.PI);
          return Math.max(-45, Math.min(45, tilt));
        }
        return 0;
      case 'top': // X-Y plane - camera looks like a circle from above
        return 0;
    }
  };
  
  const viewAngle = getCameraAngle();
  const cameraColor = isSelected ? '#60a5fa' : '#3b82f6';
  const lensColor = isSelected ? '#93c5fd' : '#60a5fa';
  
  if (currentView === 'top') {
    // Top view: camera appears as circle with lens facing down
    return (
      <g className="camera-top-view">
        {/* Camera housing (circular from top) */}
        <circle
          cx={0}
          cy={0}
          r={Math.min(width, height) / 2}
          fill={cameraColor}
          stroke={lensColor}
          strokeWidth={isSelected ? 3 : 2}
        />
        {/* Lens (inner circle) */}
        <circle
          cx={0}
          cy={0}
          r={Math.min(width, height) / 4}
          fill="#1e3a8a"
          stroke="#60a5fa"
          strokeWidth="2"
        />
        {/* Lens center */}
        <circle cx={0} cy={0} r={Math.min(width, height) / 8} fill="#1e40af" />
        {/* Direction indicator (shows which way camera is pointing in depth) */}
        <line
          x1={0}
          y1={-Math.min(width, height) / 2 - 5}
          x2={0}
          y2={-Math.min(width, height) / 2 - 15}
          stroke={lensColor}
          strokeWidth="2"
          markerEnd="url(#camera-arrow)"
        />
      </g>
    );
  }
  
  // Front and Side views: camera shows lens pointing toward product
  return (
    <g className="camera-side-view" transform={`rotate(${viewAngle})`}>
      {/* Camera body */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={cameraColor}
        stroke={lensColor}
        strokeWidth={isSelected ? 3 : 2}
        rx={6}
      />
      {/* Lens barrel (pointing down toward product) */}
      <rect
        x={-12}
        y={height / 2 - 5}
        width={24}
        height={18}
        fill="#1e3a8a"
        stroke="#60a5fa"
        strokeWidth="1.5"
        rx={3}
      />
      {/* Lens glass */}
      <ellipse
        cx={0}
        cy={height / 2 + 12}
        rx={10}
        ry={5}
        fill="#1e40af"
        stroke="#60a5fa"
        strokeWidth="1"
      />
      {/* FOV indicator lines */}
      <line
        x1={-8}
        y1={height / 2 + 15}
        x2={-25}
        y2={height / 2 + 40}
        stroke={lensColor}
        strokeWidth="1"
        strokeDasharray="3 2"
        opacity="0.6"
      />
      <line
        x1={8}
        y1={height / 2 + 15}
        x2={25}
        y2={height / 2 + 40}
        stroke={lensColor}
        strokeWidth="1"
        strokeDasharray="3 2"
        opacity="0.6"
      />
      {/* Tilt angle indicator */}
      {Math.abs(viewAngle) > 5 && (
        <g transform={`translate(${width / 2 + 15}, 0) rotate(${-viewAngle})`}>
          <rect x="-16" y="-8" width="32" height="16" rx="4" fill="rgba(30, 41, 59, 0.9)" />
          <text x="0" y="4" textAnchor="middle" fill="#a855f7" fontSize="9" fontWeight="600">
            {Math.round(viewAngle)}°
          </text>
        </g>
      )}
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
      {/* Arrow marker for camera direction */}
      <defs>
        <marker
          id="camera-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#60a5fa" />
        </marker>
      </defs>
      
      {/* Camera spacing lines */}
      {cameraSpacingPairs.map(([cam1, cam2], i) => (
        <CameraSpacingLine key={`spacing-${i}`} cam1={cam1} cam2={cam2} scale={scale} />
      ))}
      
      {/* Working distance for all cameras */}
      {showWorkingDistance && cameras.map((camera) => (
        <WorkingDistanceLine
          key={`wd-${camera.id}`}
          camera={camera}
          centerX={centerX}
          centerY={centerY}
          scale={scale}
          color={selectedObject?.id === camera.id ? '#f59e0b' : '#fbbf24'}
          currentView={currentView}
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
