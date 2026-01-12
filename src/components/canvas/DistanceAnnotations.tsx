import type { LayoutObject } from './ObjectPropertyPanel';

interface DistanceAnnotationsProps {
  objects: LayoutObject[];
  selectedObject: LayoutObject | null;
  secondSelectedObject: LayoutObject | null;
  centerX: number;
  centerY: number;
  scale: number;
  showAll?: boolean;
}

export function DistanceAnnotations({
  objects,
  selectedObject,
  secondSelectedObject,
  centerX,
  centerY,
  scale,
  showAll = false,
}: DistanceAnnotationsProps) {
  if (!selectedObject && !showAll) return null;

  const renderDistanceLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    showHV: boolean = true
  ) => {
    const dx = Math.abs(x2 - x1) / scale;
    const dy = Math.abs(y2 - y1) / scale;
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy) * scale) / scale;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return (
      <g>
        {/* Main diagonal line */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth="2"
          strokeDasharray="6 3"
          opacity="0.9"
        />
        
        {/* Start point marker */}
        <circle cx={x1} cy={y1} r="4" fill={color} opacity="0.8" />
        
        {/* End point marker */}
        <circle cx={x2} cy={y2} r="4" fill={color} opacity="0.8" />
        
        {/* Distance label - main diagonal */}
        <g transform={`translate(${midX}, ${midY})`}>
          <rect
            x={-32}
            y={-12}
            width={64}
            height={24}
            fill="rgba(15, 23, 42, 0.95)"
            stroke={color}
            strokeWidth="1.5"
            rx={6}
          />
          <text
            x={0}
            y={5}
            textAnchor="middle"
            fill={color}
            fontSize="12"
            fontWeight="700"
          >
            {Math.round(distance)}mm
          </text>
        </g>

        {/* Horizontal and vertical component lines */}
        {showHV && dx > 5 && dy > 5 && (
          <>
            {/* Horizontal component */}
            <line
              x1={x1}
              y1={y2}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 2"
              opacity="0.5"
            />
            {/* Vertical component */}
            <line
              x1={x1}
              y1={y1}
              x2={x1}
              y2={y2}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 2"
              opacity="0.5"
            />
            
            {/* Horizontal distance label */}
            <g transform={`translate(${midX}, ${y2 + 18})`}>
              <rect
                x={-22}
                y={-9}
                width={44}
                height={18}
                fill="rgba(15, 23, 42, 0.9)"
                stroke={color}
                strokeWidth="1"
                rx={4}
                opacity="0.7"
              />
              <text
                x={0}
                y={4}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                opacity="0.9"
              >
                X:{Math.round(dx)}
              </text>
            </g>
            
            {/* Vertical distance label */}
            <g transform={`translate(${x1 - 28}, ${midY})`}>
              <rect
                x={-22}
                y={-9}
                width={44}
                height={18}
                fill="rgba(15, 23, 42, 0.9)"
                stroke={color}
                strokeWidth="1"
                rx={4}
                opacity="0.7"
              />
              <text
                x={0}
                y={4}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                opacity="0.9"
              >
                Y:{Math.round(dy)}
              </text>
            </g>
          </>
        )}
      </g>
    );
  };

  const renderDimensionArrow = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    distance: number,
    orientation: 'horizontal' | 'vertical',
    color: string,
    offset: number = 30
  ) => {
    const isHorizontal = orientation === 'horizontal';
    const arrowSize = 6;

    // Offset positions for the dimension line
    const offsetX1 = isHorizontal ? x1 : x1 + offset;
    const offsetY1 = isHorizontal ? y1 + offset : y1;
    const offsetX2 = isHorizontal ? x2 : x2 + offset;
    const offsetY2 = isHorizontal ? y2 + offset : y2;

    const midX = (offsetX1 + offsetX2) / 2;
    const midY = (offsetY1 + offsetY2) / 2;

    return (
      <g>
        {/* Extension lines */}
        <line
          x1={x1}
          y1={y1}
          x2={offsetX1}
          y2={offsetY1}
          stroke={color}
          strokeWidth="1"
          opacity="0.5"
        />
        <line
          x1={x2}
          y1={y2}
          x2={offsetX2}
          y2={offsetY2}
          stroke={color}
          strokeWidth="1"
          opacity="0.5"
        />

        {/* Main dimension line */}
        <line
          x1={offsetX1}
          y1={offsetY1}
          x2={offsetX2}
          y2={offsetY2}
          stroke={color}
          strokeWidth="1.5"
        />

        {/* Arrow heads */}
        {isHorizontal ? (
          <>
            <polygon
              points={`${offsetX1},${offsetY1} ${offsetX1 + arrowSize},${offsetY1 - arrowSize / 2} ${offsetX1 + arrowSize},${offsetY1 + arrowSize / 2}`}
              fill={color}
            />
            <polygon
              points={`${offsetX2},${offsetY2} ${offsetX2 - arrowSize},${offsetY2 - arrowSize / 2} ${offsetX2 - arrowSize},${offsetY2 + arrowSize / 2}`}
              fill={color}
            />
          </>
        ) : (
          <>
            <polygon
              points={`${offsetX1},${offsetY1} ${offsetX1 - arrowSize / 2},${offsetY1 + arrowSize} ${offsetX1 + arrowSize / 2},${offsetY1 + arrowSize}`}
              fill={color}
            />
            <polygon
              points={`${offsetX2},${offsetY2} ${offsetX2 - arrowSize / 2},${offsetY2 - arrowSize} ${offsetX2 + arrowSize / 2},${offsetY2 - arrowSize}`}
              fill={color}
            />
          </>
        )}

        {/* Distance label */}
        <g transform={`translate(${midX}, ${midY})`}>
          <rect
            x={-24}
            y={-10}
            width={48}
            height={20}
            fill="rgba(15, 23, 42, 0.95)"
            stroke={color}
            strokeWidth="1"
            rx={4}
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fill={color}
            fontSize="11"
            fontWeight="600"
          >
            {distance}mm
          </text>
        </g>
      </g>
    );
  };

  return (
    <g className="distance-annotations">
      {/* Distance from selected object to product center */}
      {selectedObject && (
        <>
          {renderDistanceLine(
            selectedObject.x,
            selectedObject.y,
            centerX,
            centerY,
            '#fbbf24',
            true
          )}

          {/* Dimension arrows for selected object */}
          {renderDimensionArrow(
            selectedObject.x - selectedObject.width / 2,
            selectedObject.y + selectedObject.height / 2,
            selectedObject.x + selectedObject.width / 2,
            selectedObject.y + selectedObject.height / 2,
            Math.round(selectedObject.width / scale),
            'horizontal',
            '#60a5fa',
            20
          )}
          {renderDimensionArrow(
            selectedObject.x + selectedObject.width / 2,
            selectedObject.y - selectedObject.height / 2,
            selectedObject.x + selectedObject.width / 2,
            selectedObject.y + selectedObject.height / 2,
            Math.round(selectedObject.height / scale),
            'vertical',
            '#60a5fa',
            20
          )}
        </>
      )}

      {/* Distance between two selected objects */}
      {selectedObject && secondSelectedObject && (
        renderDistanceLine(
          selectedObject.x,
          selectedObject.y,
          secondSelectedObject.x,
          secondSelectedObject.y,
          '#22c55e',
          true
        )
      )}

      {/* Show all distances when enabled */}
      {showAll && objects.length > 0 && (
        <>
          {objects.map((obj, i) => (
            <g key={obj.id}>
              {/* Distance to center for each object */}
              <line
                x1={obj.x}
                y1={obj.y}
                x2={centerX}
                y2={centerY}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.4"
              />
              <g transform={`translate(${(obj.x + centerX) / 2}, ${(obj.y + centerY) / 2})`}>
                <rect
                  x={-20}
                  y={-8}
                  width={40}
                  height={16}
                  fill="rgba(15, 23, 42, 0.8)"
                  rx={3}
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9"
                >
                  {Math.round(Math.sqrt(
                    Math.pow((obj.x - centerX) / scale, 2) +
                    Math.pow((obj.y - centerY) / scale, 2)
                  ))}mm
                </text>
              </g>
            </g>
          ))}
        </>
      )}
    </g>
  );
}
