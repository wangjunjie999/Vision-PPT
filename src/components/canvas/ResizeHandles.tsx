import { useState, useCallback } from 'react';
import type { LayoutObject } from './ObjectPropertyPanel';

interface ResizeHandlesProps {
  object: LayoutObject;
  isSelected: boolean;
  onResize: (id: string, width: number, height: number, x: number, y: number) => void;
  minSize?: number;
}

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const handleCursors: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

export function ResizeHandles({
  object,
  isSelected,
  onResize,
  minSize = 30,
}: ResizeHandlesProps) {
  const [resizing, setResizing] = useState<HandlePosition | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0, x: 0, y: 0 });

  if (!isSelected || object.locked) return null;

  const handleSize = 8;
  const halfW = object.width / 2;
  const halfH = object.height / 2;

  const handles: { position: HandlePosition; x: number; y: number }[] = [
    { position: 'nw', x: -halfW, y: -halfH },
    { position: 'n', x: 0, y: -halfH },
    { position: 'ne', x: halfW, y: -halfH },
    { position: 'e', x: halfW, y: 0 },
    { position: 'se', x: halfW, y: halfH },
    { position: 's', x: 0, y: halfH },
    { position: 'sw', x: -halfW, y: halfH },
    { position: 'w', x: -halfW, y: 0 },
  ];

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, position: HandlePosition) => {
      e.stopPropagation();
      setResizing(position);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSize({
        width: object.width,
        height: object.height,
        x: object.x,
        y: object.y,
      });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - e.clientX;
        const dy = moveEvent.clientY - e.clientY;

        let newWidth = startSize.width;
        let newHeight = startSize.height;
        let newX = startSize.x;
        let newY = startSize.y;

        // Scale factor for mouse movement
        const scaleFactor = 0.5;

        switch (position) {
          case 'e':
            newWidth = Math.max(minSize, startSize.width + dx * scaleFactor);
            break;
          case 'w':
            newWidth = Math.max(minSize, startSize.width - dx * scaleFactor);
            newX = startSize.x + dx * scaleFactor / 2;
            break;
          case 's':
            newHeight = Math.max(minSize, startSize.height + dy * scaleFactor);
            break;
          case 'n':
            newHeight = Math.max(minSize, startSize.height - dy * scaleFactor);
            newY = startSize.y + dy * scaleFactor / 2;
            break;
          case 'se':
            newWidth = Math.max(minSize, startSize.width + dx * scaleFactor);
            newHeight = Math.max(minSize, startSize.height + dy * scaleFactor);
            break;
          case 'sw':
            newWidth = Math.max(minSize, startSize.width - dx * scaleFactor);
            newHeight = Math.max(minSize, startSize.height + dy * scaleFactor);
            newX = startSize.x + dx * scaleFactor / 2;
            break;
          case 'ne':
            newWidth = Math.max(minSize, startSize.width + dx * scaleFactor);
            newHeight = Math.max(minSize, startSize.height - dy * scaleFactor);
            newY = startSize.y + dy * scaleFactor / 2;
            break;
          case 'nw':
            newWidth = Math.max(minSize, startSize.width - dx * scaleFactor);
            newHeight = Math.max(minSize, startSize.height - dy * scaleFactor);
            newX = startSize.x + dx * scaleFactor / 2;
            newY = startSize.y + dy * scaleFactor / 2;
            break;
        }

        onResize(object.id, newWidth, newHeight, newX, newY);
      };

      const handleMouseUp = () => {
        setResizing(null);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [object, onResize, startSize, minSize]
  );

  return (
    <g className="resize-handles">
      {handles.map(({ position, x, y }) => (
        <rect
          key={position}
          x={x - handleSize / 2}
          y={y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="#3b82f6"
          stroke="#fff"
          strokeWidth="1.5"
          rx={2}
          style={{ cursor: handleCursors[position] }}
          onMouseDown={(e) => handleMouseDown(e, position)}
          className="transition-transform hover:scale-125"
        />
      ))}
    </g>
  );
}
