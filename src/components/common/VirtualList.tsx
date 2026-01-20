import { useRef, useEffect, useState, useCallback, CSSProperties, memo } from 'react';
import { cn } from '@/lib/utils';

// Threshold for enabling virtualization
const VIRTUALIZATION_THRESHOLD = 50;

interface VirtualListProps<T> {
  items: T[];
  height: number | string;
  itemHeight: number;
  renderItem: (item: T, index: number, style?: CSSProperties) => React.ReactNode;
  className?: string;
  overscanCount?: number;
  threshold?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

/**
 * Simple virtualized list component
 * Uses windowing technique to only render visible items
 * Falls back to regular rendering for small lists
 */
export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className,
  overscanCount = 5,
  threshold = VIRTUALIZATION_THRESHOLD,
  getItemKey,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  
  // Calculate container height
  useEffect(() => {
    if (typeof height === 'number') {
      setContainerHeight(height);
      return;
    }
    
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [height]);
  
  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  // For small lists, use regular rendering
  if (items.length < threshold) {
    return (
      <div 
        ref={containerRef}
        className={cn("overflow-y-auto", className)} 
        style={{ height }}
      >
        {items.map((item, index) => (
          <div key={getItemKey?.(item, index) ?? index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }
  
  const actualHeight = typeof height === 'number' ? height : containerHeight;
  
  if (actualHeight <= 0) {
    return <div ref={containerRef} className={className} style={{ height }} />;
  }
  
  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscanCount);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + actualHeight) / itemHeight) + overscanCount
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  
  return (
    <div 
      ref={containerRef}
      className={cn("overflow-y-auto", className)} 
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => {
            const actualIndex = startIndex + i;
            return (
              <div 
                key={getItemKey?.(item, actualIndex) ?? actualIndex}
                style={{ height: itemHeight }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Virtualized grid for items like hardware cards
 */
interface VirtualGridProps<T> {
  items: T[];
  height: number | string;
  columnCount: number;
  rowHeight: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  threshold?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualGrid<T>({
  items,
  height,
  columnCount,
  rowHeight,
  gap = 8,
  renderItem,
  className,
  threshold = VIRTUALIZATION_THRESHOLD,
  getItemKey,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  
  useEffect(() => {
    if (typeof height === 'number') {
      setContainerHeight(height);
      return;
    }
    
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [height]);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  // For small grids, use regular rendering
  if (items.length < threshold) {
    return (
      <div 
        ref={containerRef}
        className={cn("overflow-y-auto", className)} 
        style={{ height }}
      >
        <div
          style={{ 
            display: 'grid',
            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
            gap,
          }}
        >
          {items.map((item, index) => (
            <div key={getItemKey?.(item, index) ?? index}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  const actualHeight = typeof height === 'number' ? height : containerHeight;
  
  if (actualHeight <= 0) {
    return <div ref={containerRef} className={className} style={{ height }} />;
  }
  
  const rowCount = Math.ceil(items.length / columnCount);
  const effectiveRowHeight = rowHeight + gap;
  const totalHeight = rowCount * effectiveRowHeight;
  
  // Calculate visible range
  const startRowIndex = Math.max(0, Math.floor(scrollTop / effectiveRowHeight) - 2);
  const endRowIndex = Math.min(
    rowCount,
    Math.ceil((scrollTop + actualHeight) / effectiveRowHeight) + 2
  );
  
  const offsetY = startRowIndex * effectiveRowHeight;
  
  return (
    <div 
      ref={containerRef}
      className={cn("overflow-y-auto", className)} 
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          style={{ 
            transform: `translateY(${offsetY}px)`,
            display: 'grid',
            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
            gap,
          }}
        >
          {Array.from({ length: endRowIndex - startRowIndex }).flatMap((_, rowOffset) => {
            const rowIndex = startRowIndex + rowOffset;
            const startItemIndex = rowIndex * columnCount;
            
            return items.slice(startItemIndex, startItemIndex + columnCount).map((item, colIndex) => {
              const actualIndex = startItemIndex + colIndex;
              return (
                <div 
                  key={getItemKey?.(item, actualIndex) ?? actualIndex}
                  style={{ height: rowHeight }}
                >
                  {renderItem(item, actualIndex)}
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to determine if virtualization should be enabled
 */
export function useVirtualization(itemCount: number, threshold = VIRTUALIZATION_THRESHOLD): boolean {
  return itemCount >= threshold;
}

/**
 * Simple batch renderer for very long lists
 * Renders items in chunks to avoid blocking the main thread
 */
export function useBatchedRender<T>(
  items: T[],
  batchSize = 20,
  delay = 16
): { renderedItems: T[]; isComplete: boolean } {
  const [renderedCount, setRenderedCount] = useState(batchSize);
  
  useEffect(() => {
    if (renderedCount >= items.length) return;
    
    const timer = setTimeout(() => {
      setRenderedCount(prev => Math.min(prev + batchSize, items.length));
    }, delay);
    
    return () => clearTimeout(timer);
  }, [renderedCount, items.length, batchSize, delay]);
  
  // Reset when items change
  useEffect(() => {
    setRenderedCount(batchSize);
  }, [items, batchSize]);
  
  return {
    renderedItems: items.slice(0, renderedCount),
    isComplete: renderedCount >= items.length,
  };
}
