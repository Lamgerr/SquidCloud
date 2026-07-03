import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn, formatFileSize } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Download, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Maximize2, Minimize2,
  ZoomIn, ZoomOut, RefreshCw, Palette, Sun, Moon, Contrast, Droplets, Sparkles,
  Image as ImageIcon, Move, Share2, Info, X, ChevronDown, MoreHorizontal, Layers, Copy, Wand2
} from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';

interface AdvancedImageViewerProps {
  src: string;
  alt: string;
  file?: {
    name: string;
    size: number;
    type: string;
  };
  onDownload?: () => void;
  onShare?: () => void;
}

interface ImageFilters {
  brightness: number; contrast: number; saturation: number; hue: number;
  blur: number; sepia: number; grayscale: number; invert: number;
}

const FILTER_PRESETS = [
  { name: 'Original', icon: ImageIcon, filters: { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0, invert: 0 } },
  { name: 'Vivid', icon: Sparkles, filters: { brightness: 105, contrast: 118, saturation: 135, hue: 0, blur: 0, sepia: 0, grayscale: 0, invert: 0 } },
  { name: 'Warm', icon: Sun, filters: { brightness: 104, contrast: 102, saturation: 112, hue: 12, blur: 0, sepia: 18, grayscale: 0, invert: 0 } },
  { name: 'Cool', icon: Moon, filters: { brightness: 100, contrast: 106, saturation: 92, hue: -14, blur: 0, sepia: 0, grayscale: 0, invert: 0 } },
  { name: 'Monochrome', icon: Contrast, filters: { brightness: 105, contrast: 115, saturation: 0, hue: 0, blur: 0, sepia: 0, grayscale: 100, invert: 0 } },
  { name: 'Vintage', icon: Droplets, filters: { brightness: 94, contrast: 92, saturation: 82, hue: 8, blur: 0, sepia: 38, grayscale: 0, invert: 0 } },
  { name: 'Cinema', icon: Wand2, filters: { brightness: 96, contrast: 132, saturation: 88, hue: 0, blur: 0, sepia: 0, grayscale: 18, invert: 0 } },
];

const DEFAULT_FILTERS: ImageFilters = {
  brightness: 100, contrast: 100, saturation: 100, hue: 0,
  blur: 0, sepia: 0, grayscale: 0, invert: 0
};

const AdvancedImageViewer: React.FC<AdvancedImageViewerProps> = ({
  src, alt, file, onDownload, onShare
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Touch gesture tracking
  const [isPinching, setIsPinching] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const lastTap = useRef<number>(0);
  
  const [filters, setFilters] = useState<ImageFilters>(DEFAULT_FILTERS);
  const [activePreset, setActivePreset] = useState('Original');
  
  const [showFilters, setShowFilters] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [isAdjustingCompare, setIsAdjustingCompare] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  
  const zoomIndicatorTimeout = useRef<ReturnType<typeof setTimeout>>();

  const flashZoomIndicator = useCallback(() => {
    setShowZoomIndicator(true);
    if (zoomIndicatorTimeout.current) clearTimeout(zoomIndicatorTimeout.current);
    zoomIndicatorTimeout.current = setTimeout(() => setShowZoomIndicator(false), 1400);
  }, []);

  const getFilterString = useCallback(() => {
    if (filters.brightness === 100 && filters.contrast === 100 && filters.saturation === 100 && 
        filters.hue === 0 && filters.blur === 0 && filters.sepia === 0 && 
        filters.grayscale === 0 && filters.invert === 0) {
      return 'none';
    }
    return [
      `brightness(${filters.brightness}%)`, `contrast(${filters.contrast}%)`,
      `saturate(${filters.saturation}%)`, `hue-rotate(${filters.hue}deg)`,
      `blur(${filters.blur}px)`, `sepia(${filters.sepia}%)`,
      `grayscale(${filters.grayscale}%)`, `invert(${filters.invert}%)`
    ].join(' ');
  }, [filters]);

  const clampPan = useCallback((nextPan: { x: number; y: number }, nextZoom = zoom) => {
    if (!containerRef.current || nextZoom <= 1) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const maxX = (rect.width * (nextZoom - 1)) / 2;
    const maxY = (rect.height * (nextZoom - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, nextPan.x)),
      y: Math.min(maxY, Math.max(-maxY, nextPan.y)),
    };
  }, [zoom]);

  const getTransformString = useCallback(() => {
    const scaleX = zoom * (flipH ? -1 : 1);
    const scaleY = zoom * (flipV ? -1 : 1);
    return `translate3d(${pan.x}px, ${pan.y}px, 0px) rotate(${rotation}deg) scale3d(${scaleX}, ${scaleY}, 1)`;
  }, [zoom, rotation, flipH, flipV, pan]);

  const isFiltersModified = useMemo(() => JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS), [filters]);
  const isTransformModified = useMemo(() => rotation !== 0 || flipH || flipV || zoom !== 1 || pan.x !== 0 || pan.y !== 0, [rotation, flipH, flipV, zoom, pan]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const nextZoom = Math.min(prev * 1.3, 8);
      setPan(p => clampPan(p, nextZoom));
      flashZoomIndicator();
      return nextZoom;
    });
  }, [flashZoomIndicator, clampPan]);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const nextZoom = Math.max(prev / 1.3, 1);
      if (nextZoom <= 1) setPan({ x: 0, y: 0 });
      else setPan(p => clampPan(p, nextZoom));
      flashZoomIndicator();
      return nextZoom;
    });
  }, [flashZoomIndicator, clampPan]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    flashZoomIndicator();
  }, [flashZoomIndicator]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan(clampPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) handleZoomIn();
    else handleZoomOut();
  }, [handleZoomIn, handleZoomOut]);

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  // 🚀 NATIVE 60FPS PINCH TO ZOOM & PAN
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    if (touches.length === 2) {
      setIsPinching(true);
      setIsDragging(false);
      setLastTouchDistance(getTouchDistance(touches));
      setLastTouchCenter(getTouchCenter(touches));
      flashZoomIndicator();
    } else if (touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: touches[0].clientX - pan.x, y: touches[0].clientY - pan.y });
    }
  }, [zoom, pan, flashZoomIndicator]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    if (isPinching && touches.length === 2) {
      const newDistance = getTouchDistance(touches);
      const delta = newDistance / (lastTouchDistance || 1);
      const newCenter = getTouchCenter(touches);
      setZoom(prev => {
        const nextZoom = Math.min(Math.max(prev * delta, 1), 8);
        setPan(prevPan => clampPan({
          x: prevPan.x + (newCenter.x - lastTouchCenter.x),
          y: prevPan.y + (newCenter.y - lastTouchCenter.y)
        }, nextZoom));
        return nextZoom;
      });
      setLastTouchDistance(newDistance);
      setLastTouchCenter(newCenter);
    } else if (isDragging && touches.length === 1 && zoom > 1) {
      setPan(clampPan({ x: touches[0].clientX - dragStart.x, y: touches[0].clientY - dragStart.y }));
    }
  }, [isPinching, isDragging, lastTouchDistance, lastTouchCenter, dragStart, zoom, clampPan]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinching) {
      setIsPinching(false);
      if (zoom < 1.05) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      return;
    }

    const now = Date.now();
    if (now - lastTap.current < 280 && e.changedTouches.length === 1) {
      if (zoom > 1) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const touch = e.changedTouches[0];
          const x = touch.clientX - rect.left - rect.width / 2;
          const y = touch.clientY - rect.top - rect.height / 2;
          setZoom(2.5);
          setPan(clampPan({ x: -x * 1.3, y: -y * 1.3 }, 2.5));
        }
      }
      flashZoomIndicator();
    }
    lastTap.current = now;
    setIsDragging(false);
  }, [isPinching, zoom, flashZoomIndicator, clampPan]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen && containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateViewport = () => {
      const rect = container.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [isFullscreen]);

  useEffect(() => {
    setPan(prev => clampPan(prev, zoom));
  }, [clampPan, zoom]);

  const updateComparePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setComparePosition(Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    if (!isAdjustingCompare) return;
    const handlePointerMove = (e: MouseEvent) => updateComparePosition(e.clientX);
    const handleTouchMove = (e: TouchEvent) => { if (e.touches[0]) updateComparePosition(e.touches[0].clientX); };
    const stopAdjusting = () => setIsAdjustingCompare(false);

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopAdjusting, { once: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', stopAdjusting, { once: true });

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopAdjusting);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopAdjusting);
    };
  }, [isAdjustingCompare, updateComparePosition]);

  const applyPreset = useCallback((preset: typeof FILTER_PRESETS[0]) => {
    setFilters(preset.filters as ImageFilters);
    setActivePreset(preset.name);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setActivePreset('Original');
  }, []);

  const resetTransforms = useCallback(() => {
    setRotation(0); setFlipH(false); setFlipV(false); resetZoom();
  }, [resetZoom]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    if (imageRef.current) {
      setImageDimensions({ width: imageRef.current.naturalWidth, height: imageRef.current.naturalHeight });
    }
  }, []);

  const copyDimensions = useCallback(() => {
    navigator.clipboard.writeText(`${imageDimensions.width} × ${imageDimensions.height}`);
    toast({ title: 'Copied Resolution' });
  }, [imageDimensions, toast]);

  // Mobile Bottom Toolbar
  const MobileToolbar = () => (
    <div className="absolute bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)] pointer-events-none">
      <div className="bg-gradient-to-t from-card/95 via-card/80 to-transparent pt-12 pb-3 px-4 pointer-events-auto">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex items-center gap-1 bg-card/90 backdrop-blur-md rounded-xl border border-border p-1">
            <Button size="sm" variant="ghost" onClick={handleZoomOut} className="h-8 w-8 p-0 text-foreground">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <div className="w-12 text-center text-foreground/90 text-xs font-mono">{Math.round(zoom * 100)}%</div>
            <Button size="sm" variant="ghost" onClick={handleZoomIn} className="h-8 w-8 p-0 text-foreground">
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1 bg-card/90 backdrop-blur-md rounded-xl border border-border p-1">
            <Button size="sm" variant="ghost" onClick={() => setRotation(r => (r - 90 + 360) % 360)} className="h-8 w-8 p-0 text-foreground">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRotation(r => (r + 90) % 360)} className="h-8 w-8 p-0 text-foreground">
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-around">
          <Button variant="ghost" onClick={() => setShowFilters(true)} className={cn("flex flex-col items-center gap-1 h-auto py-1.5 px-3 rounded-xl", isFiltersModified ? "text-primary" : "text-muted-foreground")}>
            <Palette className="w-4 h-4" />
            <span className="text-[10px]">Filters</span>
          </Button>
          <Button variant="ghost" onClick={() => setShowCompare(!showCompare)} className={cn("flex flex-col items-center gap-1 h-auto py-1.5 px-3 rounded-xl", showCompare ? "text-primary" : "text-muted-foreground")}>
            <Layers className="w-4 h-4" />
            <span className="text-[10px]">Compare</span>
          </Button>
          <Button variant="ghost" onClick={() => setShowInfo(!showInfo)} className={cn("flex flex-col items-center gap-1 h-auto py-1.5 px-3 rounded-xl", showInfo ? "text-primary" : "text-muted-foreground")}>
            <Info className="w-4 h-4" />
            <span className="text-[10px]">Info</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto py-1.5 px-3 rounded-xl text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
                <span className="text-[10px]">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border text-foreground">
              {onDownload && <DropdownMenuItem onClick={onDownload} className="gap-3 py-2.5"><Download className="w-4 h-4" /> Download</DropdownMenuItem>}
              {onShare && <DropdownMenuItem onClick={onShare} className="gap-3 py-2.5"><Share2 className="w-4 h-4" /> Share</DropdownMenuItem>}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={() => setFlipH(!flipH)} className="gap-3 py-2.5"><FlipHorizontal className="w-4 h-4" /> Flip Horizontal</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFlipV(!flipV)} className="gap-3 py-2.5"><FlipVertical className="w-4 h-4" /> Flip Vertical</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={resetTransforms} className="gap-3 py-2.5"><RefreshCw className="w-4 h-4" /> Reset Transforms</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );

  return (
      <div 
        ref={containerRef} 
        className={cn(
          "relative w-full h-full bg-background overflow-hidden select-none flex items-center justify-center",
          isFullscreen && "fixed inset-0 z-[70]"
        )}
      >
      {/* 🚀 STRICT CONTAINER BOUNDARIES: Ensures image NEVER overflows modal box */}
      <div
        className={cn(
          "absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden",
          zoom > 1 ? "cursor-grab" : "cursor-default",
          isDragging && "cursor-grabbing"
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className={cn(
            // Auto fits inside container when unzoomed
            zoom === 1 ? "max-w-full max-h-full object-contain" : "max-w-none max-h-none",
            !isPinching && !isDragging ? "transition-transform duration-200 ease-out" : "",
            !imageLoaded && "opacity-0"
          )}
          style={{
            filter: getFilterString(),
            transform: getTransformString(),
            willChange: 'transform, filter',
          }}
          onLoad={handleImageLoad}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          draggable={false}
        />
      </div>

      {(showZoomIndicator || isPinching) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-in fade-in zoom-in duration-150">
          <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-border px-5 py-2.5 text-foreground font-mono font-medium text-lg shadow-2xl">
            {Math.round(zoom * 100)}%
          </div>
        </div>
      )}

      {isMobile && <MobileToolbar />}
      
      {/* Info drawer on top */}
      {showInfo && (
        <div className={cn("absolute z-40 bg-card/95 backdrop-blur-2xl rounded-2xl border border-border text-foreground p-4 shadow-2xl", isMobile ? "bottom-24 left-4 right-4" : "top-16 right-4 w-72")}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Image Details</span>
            <Button size="sm" variant="ghost" onClick={() => setShowInfo(false)} className="h-6 w-6 p-0"><X className="w-4 h-4" /></Button>
          </div>
          <div className="space-y-2 text-xs">
            {file?.name && <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="truncate max-w-[150px] text-foreground">{file.name}</span></div>}
            {imageDimensions.width > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Resolution</span><span className="text-foreground">{imageDimensions.width} × {imageDimensions.height} px</span></div>}
            {file?.size && <div className="flex justify-between"><span className="text-muted-foreground">File Size</span><span className="text-foreground">{formatFileSize(file.size)}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedImageViewer;
