import { useMemo } from 'react';
import type { LayoutObject } from './ObjectPropertyPanel';

interface AlignmentGuidesProps {
  objects: LayoutObject[];
  draggingObject: LayoutObject | null;
  centerX: number;
  centerY: number;
  snapThreshold?: number;
}

interface AlignmentLine {
  type: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
  label?: string;
}

export function AlignmentGuides({
  objects,
  draggingObject,
  centerX,
  centerY,
  snapThreshold = 10,
}: AlignmentGuidesProps) {
  const guides = useMemo(() => {
    if (!draggingObject) return [];

    const lines: AlignmentLine[] = [];
    const dragX = draggingObject.x;
    const dragY = draggingObject.y;
    const dragLeft = dragX - draggingObject.width / 2;
    const dragRight = dragX + draggingObject.width / 2;
    const dragTop = dragY - draggingObject.height / 2;
    const dragBottom = dragY + draggingObject.height / 2;

    // Check alignment with product center
    if (Math.abs(dragX - centerX) < snapThreshold) {
      lines.push({
        type: 'vertical',
        position: centerX,
        start: Math.min(dragY, centerY) - 50,
        end: Math.max(dragY, centerY) + 50,
        label: '中心对齐',
      });
    }
    if (Math.abs(dragY - centerY) < snapThreshold) {
      lines.push({
        type: 'horizontal',
        position: centerY,
        start: Math.min(dragX, centerX) - 50,
        end: Math.max(dragX, centerX) + 50,
        label: '中心对齐',
      });
    }

    // Check alignment with other objects
    objects.forEach(obj => {
      if (obj.id === draggingObject.id) return;

      const objLeft = obj.x - obj.width / 2;
      const objRight = obj.x + obj.width / 2;
      const objTop = obj.y - obj.height / 2;
      const objBottom = obj.y + obj.height / 2;

      // Vertical alignments (center, left edge, right edge)
      if (Math.abs(dragX - obj.x) < snapThreshold) {
        lines.push({
          type: 'vertical',
          position: obj.x,
          start: Math.min(dragTop, objTop) - 20,
          end: Math.max(dragBottom, objBottom) + 20,
        });
      }
      if (Math.abs(dragLeft - objLeft) < snapThreshold) {
        lines.push({
          type: 'vertical',
          position: objLeft,
          start: Math.min(dragTop, objTop) - 20,
          end: Math.max(dragBottom, objBottom) + 20,
        });
      }
      if (Math.abs(dragRight - objRight) < snapThreshold) {
        lines.push({
          type: 'vertical',
          position: objRight,
          start: Math.min(dragTop, objTop) - 20,
          end: Math.max(dragBottom, objBottom) + 20,
        });
      }
      if (Math.abs(dragLeft - objRight) < snapThreshold) {
        lines.push({
          type: 'vertical',
          position: objRight,
          start: Math.min(dragTop, objTop) - 20,
          end: Math.max(dragBottom, objBottom) + 20,
        });
      }
      if (Math.abs(dragRight - objLeft) < snapThreshold) {
        lines.push({
          type: 'vertical',
          position: objLeft,
          start: Math.min(dragTop, objTop) - 20,
          end: Math.max(dragBottom, objBottom) + 20,
        });
      }

      // Horizontal alignments (center, top edge, bottom edge)
      if (Math.abs(dragY - obj.y) < snapThreshold) {
        lines.push({
          type: 'horizontal',
          position: obj.y,
          start: Math.min(dragLeft, objLeft) - 20,
          end: Math.max(dragRight, objRight) + 20,
        });
      }
      if (Math.abs(dragTop - objTop) < snapThreshold) {
        lines.push({
          type: 'horizontal',
          position: objTop,
          start: Math.min(dragLeft, objLeft) - 20,
          end: Math.max(dragRight, objRight) + 20,
        });
      }
      if (Math.abs(dragBottom - objBottom) < snapThreshold) {
        lines.push({
          type: 'horizontal',
          position: objBottom,
          start: Math.min(dragLeft, objLeft) - 20,
          end: Math.max(dragRight, objRight) + 20,
        });
      }
      if (Math.abs(dragTop - objBottom) < snapThreshold) {
        lines.push({
          type: 'horizontal',
          position: objBottom,
          start: Math.min(dragLeft, objLeft) - 20,
          end: Math.max(dragRight, objRight) + 20,
        });
      }
      if (Math.abs(dragBottom - objTop) < snapThreshold) {
        lines.push({
          type: 'horizontal',
          position: objTop,
          start: Math.min(dragLeft, objLeft) - 20,
          end: Math.max(dragRight, objRight) + 20,
        });
      }
    });

    return lines;
  }, [objects, draggingObject, centerX, centerY, snapThreshold]);

  if (guides.length === 0) return null;

  return (
    <g className="alignment-guides">
      {guides.map((line, i) => (
        <g key={i}>
          {line.type === 'vertical' ? (
            <line
              x1={line.position}
              y1={line.start}
              x2={line.position}
              y2={line.end}
              stroke="#f97316"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              opacity="0.8"
            />
          ) : (
            <line
              x1={line.start}
              y1={line.position}
              x2={line.end}
              y2={line.position}
              stroke="#f97316"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              opacity="0.8"
            />
          )}
        </g>
      ))}
    </g>
  );
}

// Utility function to calculate snap position
export function calculateSnapPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  objects: LayoutObject[],
  centerX: number,
  centerY: number,
  snapThreshold: number = 10,
  excludeId?: string
): { x: number; y: number; snappedX: boolean; snappedY: boolean } {
  let snappedX = x;
  let snappedY = y;
  let didSnapX = false;
  let didSnapY = false;

  const left = x - width / 2;
  const right = x + width / 2;
  const top = y - height / 2;
  const bottom = y + height / 2;

  // Snap to center
  if (Math.abs(x - centerX) < snapThreshold) {
    snappedX = centerX;
    didSnapX = true;
  }
  if (Math.abs(y - centerY) < snapThreshold) {
    snappedY = centerY;
    didSnapY = true;
  }

  // Snap to other objects
  objects.forEach(obj => {
    if (obj.id === excludeId) return;

    const objLeft = obj.x - obj.width / 2;
    const objRight = obj.x + obj.width / 2;
    const objTop = obj.y - obj.height / 2;
    const objBottom = obj.y + obj.height / 2;

    // Vertical snaps
    if (!didSnapX) {
      if (Math.abs(x - obj.x) < snapThreshold) {
        snappedX = obj.x;
        didSnapX = true;
      } else if (Math.abs(left - objLeft) < snapThreshold) {
        snappedX = objLeft + width / 2;
        didSnapX = true;
      } else if (Math.abs(right - objRight) < snapThreshold) {
        snappedX = objRight - width / 2;
        didSnapX = true;
      } else if (Math.abs(left - objRight) < snapThreshold) {
        snappedX = objRight + width / 2;
        didSnapX = true;
      } else if (Math.abs(right - objLeft) < snapThreshold) {
        snappedX = objLeft - width / 2;
        didSnapX = true;
      }
    }

    // Horizontal snaps
    if (!didSnapY) {
      if (Math.abs(y - obj.y) < snapThreshold) {
        snappedY = obj.y;
        didSnapY = true;
      } else if (Math.abs(top - objTop) < snapThreshold) {
        snappedY = objTop + height / 2;
        didSnapY = true;
      } else if (Math.abs(bottom - objBottom) < snapThreshold) {
        snappedY = objBottom - height / 2;
        didSnapY = true;
      } else if (Math.abs(top - objBottom) < snapThreshold) {
        snappedY = objBottom + height / 2;
        didSnapY = true;
      } else if (Math.abs(bottom - objTop) < snapThreshold) {
        snappedY = objTop - height / 2;
        didSnapY = true;
      }
    }
  });

  return { x: snappedX, y: snappedY, snappedX: didSnapX, snappedY: didSnapY };
}
