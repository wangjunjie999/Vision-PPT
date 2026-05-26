import React, { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { ImageOff, Camera, Settings2, Package } from 'lucide-react';
import { getMechanismImage } from '@/utils/mechanismImageUrls';
import { toLocalProxyUrl } from '@/utils/storageUrl';

export type ImageFallbackType = 'generic' | 'camera' | 'mechanism' | 'hardware' | 'product';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined;
  fallbackSrc?: string | null;
  fallbackType?: ImageFallbackType;
  fallbackIcon?: React.ReactNode;
  containerClassName?: string;
  showBorder?: boolean;
}

const FallbackIcons: Record<ImageFallbackType, React.ReactNode> = {
  generic: <ImageOff className="h-6 w-6 text-muted-foreground" />,
  camera: <Camera className="h-6 w-6 text-primary" />,
  mechanism: <Settings2 className="h-6 w-6 text-primary" />,
  hardware: <Package className="h-6 w-6 text-muted-foreground" />,
  product: <Package className="h-6 w-6 text-primary" />,
};

const FallbackEmoji: Record<ImageFallbackType, string> = {
  generic: '🖼️',
  camera: '📷',
  mechanism: '⚙️',
  hardware: '🔧',
  product: '📦',
};

/**
 * Image component with automatic fallback handling
 * - Tries primary src first
 * - Falls back to fallbackSrc if primary fails
 * - Shows icon/emoji if both fail
 */
export const ImageWithFallback = memo(function ImageWithFallback({
  src,
  fallbackSrc,
  fallbackType = 'generic',
  fallbackIcon,
  containerClassName,
  showBorder = true,
  className,
  alt = '',
  ...props
}: ImageWithFallbackProps) {
  const proxiedSrc = src ? toLocalProxyUrl(src) : null;
  const proxiedFallback = fallbackSrc ? toLocalProxyUrl(fallbackSrc) : null;
  const [currentSrc, setCurrentSrc] = useState<string | null>(proxiedSrc);
  const [hasError, setHasError] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  // Reset state when src changes
  React.useEffect(() => {
    if (proxiedSrc) {
      setCurrentSrc(proxiedSrc);
      setHasError(false);
      setUsedFallback(false);
    } else if (proxiedFallback) {
      setCurrentSrc(proxiedFallback);
      setUsedFallback(true);
      setHasError(false);
    } else {
      setCurrentSrc(null);
      setHasError(true);
    }
  }, [proxiedSrc, proxiedFallback]);

  const handleError = useCallback(() => {
    if (!usedFallback && proxiedFallback) {
      // Try fallback
      setCurrentSrc(proxiedFallback);
      setUsedFallback(true);
    } else {
      // Both failed
      setHasError(true);
    }
  }, [proxiedFallback, usedFallback]);

  // Show fallback UI
  if (hasError || !currentSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/50",
          showBorder && "border border-border rounded-lg",
          containerClassName || className
        )}
        style={{ width: props.width, height: props.height }}
      >
        {fallbackIcon || FallbackIcons[fallbackType] || (
          <span className="text-2xl">{FallbackEmoji[fallbackType]}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
});

/**
 * Get the best available image URL with fallback chain
 * Returns the first valid URL from the chain
 */
export function getImageWithFallback(...urls: (string | null | undefined)[]): string | null {
  for (const url of urls) {
    if (url && url.trim() !== '') {
      return url;
    }
  }
  return null;
}

interface MechanismThumbnailProps {
  type: string;
  view?: 'front' | 'side' | 'top';
  databaseUrl?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

/**
 * Mechanism thumbnail with automatic fallback to local assets
 * Priority: local bundled assets > database URL > emoji fallback
 */
export const MechanismThumbnail = memo(function MechanismThumbnail({
  type,
  view = 'front',
  databaseUrl,
  className,
  size = 'md',
}: MechanismThumbnailProps) {
  const localImageUrl = getMechanismImage(type, view);
  const proxiedDb = databaseUrl ? toLocalProxyUrl(databaseUrl) : null;
  const primarySrc = proxiedDb || localImageUrl;
  const fallbackSrc = proxiedDb ? localImageUrl : null;
  
  const [currentSrc, setCurrentSrc] = useState<string | null>(primarySrc);
  const [showFallbackEmoji, setShowFallbackEmoji] = useState(false);

  // Reset when databaseUrl, type or view changes
  React.useEffect(() => {
    const newPrimary = (databaseUrl ? toLocalProxyUrl(databaseUrl) : null) || getMechanismImage(type, view);
    setCurrentSrc(newPrimary);
    setShowFallbackEmoji(false);
  }, [databaseUrl, type, view]);

  const handleError = useCallback(() => {
    if (currentSrc === primarySrc && fallbackSrc && fallbackSrc !== currentSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setShowFallbackEmoji(true);
    }
  }, [currentSrc, primarySrc, fallbackSrc]);

  return (
    <div className={cn(
      sizeClasses[size],
      "rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center overflow-hidden border border-orange-500/20",
      className
    )}>
      {!showFallbackEmoji && currentSrc ? (
        <img 
          src={currentSrc} 
          alt="" 
          className="w-full h-full object-cover"
          onError={handleError}
        />
      ) : (
        <span className="text-lg">⚙️</span>
      )}
    </div>
  );
});

export default ImageWithFallback;
