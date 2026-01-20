import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { ImageOff, Loader2 } from 'lucide-react';

// Global concurrent loading controller
class ImageLoadController {
  private queue: Array<() => void> = [];
  private activeCount = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent = 6) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(loadFn: () => Promise<void>): () => void {
    let cancelled = false;
    
    const execute = async () => {
      if (cancelled) return;
      this.activeCount++;
      try {
        await loadFn();
      } finally {
        this.activeCount--;
        this.processQueue();
      }
    };

    if (this.activeCount < this.maxConcurrent) {
      execute();
    } else {
      this.queue.push(() => {
        if (!cancelled) execute();
      });
    }

    // Return cancel function
    return () => {
      cancelled = true;
    };
  }

  private processQueue() {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const next = this.queue.shift();
      next?.();
    }
  }

  getStatus() {
    return { active: this.activeCount, queued: this.queue.length };
  }
}

// Singleton controller
const imageController = new ImageLoadController(6);

export interface LazyImageProps {
  src?: string | null;
  thumbnailSrc?: string | null;
  alt?: string;
  className?: string;
  containerClassName?: string;
  placeholderClassName?: string;
  width?: number | string;
  height?: number | string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  fallbackIcon?: React.ReactNode;
  showLoadingSpinner?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  // Disable lazy loading for above-the-fold images
  eager?: boolean;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Unified lazy-loading image component with:
 * - IntersectionObserver for viewport detection
 * - Thumbnail fallback support
 * - Error handling with placeholder
 * - Concurrent loading limit (max 6)
 */
export const LazyImage = memo(function LazyImage({
  src,
  thumbnailSrc,
  alt = '',
  className,
  containerClassName,
  placeholderClassName,
  width,
  height,
  objectFit = 'cover',
  fallbackIcon,
  showLoadingSpinner = true,
  onLoad,
  onError,
  eager = false,
}: LazyImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(eager);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  // Determine which source to use
  const effectiveSrc = src || thumbnailSrc;
  const hasThumbnail = !!thumbnailSrc && thumbnailSrc !== src;

  // IntersectionObserver for lazy loading
  useEffect(() => {
    if (eager || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading slightly before entering viewport
        threshold: 0,
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [eager]);

  // Load image when in view
  useEffect(() => {
    if (!isInView || !effectiveSrc) {
      if (!effectiveSrc) setLoadState('error');
      return;
    }

    // Cancel previous load
    cancelRef.current?.();

    setLoadState('loading');

    // Use thumbnail first if available
    const sources = hasThumbnail 
      ? [thumbnailSrc!, src!].filter(Boolean)
      : [effectiveSrc];

    let currentIndex = 0;

    const loadNext = (): Promise<void> => {
      return new Promise((resolve) => {
        if (currentIndex >= sources.length) {
          setLoadState('error');
          onError?.();
          resolve();
          return;
        }

        const imgSrc = sources[currentIndex];
        const img = new Image();

        const handleLoad = () => {
          setCurrentSrc(imgSrc);
          
          // If we loaded thumbnail and have full image, try loading full
          if (currentIndex === 0 && sources.length > 1) {
            currentIndex++;
            // Queue full image load with lower priority
            setTimeout(() => {
              const fullImg = new Image();
              fullImg.onload = () => setCurrentSrc(sources[1]);
              fullImg.src = sources[1];
            }, 100);
          }
          
          setLoadState('loaded');
          onLoad?.();
          resolve();
        };

        const handleError = () => {
          currentIndex++;
          if (currentIndex < sources.length) {
            // Try next source
            loadNext().then(resolve);
          } else {
            setLoadState('error');
            onError?.();
            resolve();
          }
        };

        img.onload = handleLoad;
        img.onerror = handleError;
        img.src = imgSrc;
      });
    };

    cancelRef.current = imageController.enqueue(loadNext);

    return () => {
      cancelRef.current?.();
    };
  }, [isInView, effectiveSrc, hasThumbnail, thumbnailSrc, src, onLoad, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  const containerStyle: React.CSSProperties = {
    width: width ?? '100%',
    height: height ?? '100%',
  };

  const imageStyle: React.CSSProperties = {
    objectFit,
    width: '100%',
    height: '100%',
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted',
        containerClassName
      )}
      style={containerStyle}
    >
      {/* Placeholder / Loading / Error state */}
      {loadState !== 'loaded' && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-muted',
            placeholderClassName
          )}
        >
          {loadState === 'loading' && showLoadingSpinner && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {loadState === 'error' && (
            fallbackIcon || (
              <ImageOff className="h-6 w-6 text-muted-foreground" />
            )
          )}
          {loadState === 'idle' && (
            <div className="h-full w-full bg-muted animate-pulse" />
          )}
        </div>
      )}

      {/* Actual image */}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            loadState === 'loaded' ? 'opacity-100' : 'opacity-0',
            className
          )}
          style={imageStyle}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
    </div>
  );
});

/**
 * Hook to preload images with concurrency control
 */
export function useImagePreloader() {
  const preload = useCallback((urls: string[]): Promise<Map<string, boolean>> => {
    const results = new Map<string, boolean>();
    
    return Promise.all(
      urls.map(url => 
        new Promise<void>(resolve => {
          imageController.enqueue(() => 
            new Promise<void>(innerResolve => {
              const img = new Image();
              img.onload = () => {
                results.set(url, true);
                innerResolve();
                resolve();
              };
              img.onerror = () => {
                results.set(url, false);
                innerResolve();
                resolve();
              };
              img.src = url;
            })
          );
        })
      )
    ).then(() => results);
  }, []);

  return { preload };
}

/**
 * Simple image component for backgrounds/decorations that don't need full lazy loading
 */
export const SimpleImage = memo(function SimpleImage({
  src,
  alt = '',
  className,
  fallbackSrc = '/placeholder.svg',
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
}) {
  const [error, setError] = useState(false);

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  return (
    <img
      src={error || !src ? fallbackSrc : src}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
      decoding="async"
    />
  );
});

export default LazyImage;
