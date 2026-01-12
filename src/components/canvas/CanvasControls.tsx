import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ZoomIn, ZoomOut, Maximize2, Move, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CanvasControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen: () => void;
  onResetView: () => void;
  panMode: boolean;
  onPanModeChange: (enabled: boolean) => void;
  className?: string;
}

export function CanvasControls({
  zoom,
  onZoomChange,
  onFitToScreen,
  onResetView,
  panMode,
  onPanModeChange,
  className,
}: CanvasControlsProps) {
  const zoomPercentage = Math.round(zoom * 100);

  const handleZoomIn = () => {
    onZoomChange(Math.min(zoom + 0.25, 3));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(zoom - 0.25, 0.25));
  };

  return (
    <div className={cn(
      "absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg",
      className
    )}>
      <TooltipProvider>
        {/* Pan Mode Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={panMode ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onPanModeChange(!panMode)}
            >
              <Hand className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>平移模式 {panMode ? '(已启用)' : '(按住空格键)'}</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border" />

        {/* Zoom Out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>缩小</p>
          </TooltipContent>
        </Tooltip>

        {/* Zoom Slider */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Slider
            value={[zoom]}
            onValueChange={([v]) => onZoomChange(v)}
            min={0.25}
            max={3}
            step={0.05}
            className="w-20"
          />
          <span className="text-xs font-medium w-10 text-center">{zoomPercentage}%</span>
        </div>

        {/* Zoom In */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>放大</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border" />

        {/* Fit to Screen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onFitToScreen}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>适应屏幕</p>
          </TooltipContent>
        </Tooltip>

        {/* Reset View */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onResetView}
            >
              <Move className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>重置视图</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
