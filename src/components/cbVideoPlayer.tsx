import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Maximize, Minimize, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreamDecryptorService } from '@/lib/videoStreamer';

interface cbVideoPlayerProps {
  file: { id: string; name: string; type: string; size: number };
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  shareId?: string;
}

const CBVideoPlayer: React.FC<cbVideoPlayerProps> = ({
  file, poster, autoPlay = false, className, shareId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout>();

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffering, setBuffering] = useState(true);

  // Initialize the Service Worker Decryptor
  useEffect(() => {
    StreamDecryptorService.initListener(shareId);
  }, [shareId]);

  // Handle Auto-Hiding Controls
  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, 2500);
  }, []);

  useEffect(() => {
    wakeControls();
    return () => clearTimeout(hideTimerRef.current);
  }, [playing, wakeControls]);

  // Handle Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      wakeControls();
      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
          break;
        case 'arrowright':
        case 'l':
          videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
          break;
        case 'arrowleft':
        case 'j':
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          break;
        case 'f':
          toggleFs();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, wakeControls]);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current?.paused) videoRef.current.play(); 
    else videoRef.current?.pause(); 
  };

  const toggleFs = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(()=>{});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(()=>{});
      setFullscreen(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Orientation fix: The videoSrc never changes on re-render, preventing native element resets
  const virtualUrl = `/virtual-stream/${file.id}`;

  return (
    <div 
      ref={containerRef} 
      className={cn("relative w-full h-full bg-black overflow-hidden rounded-xl cursor-default", className, !controlsVisible && playing && "cursor-none")}
      onMouseMove={wakeControls}
      onTouchStart={wakeControls}
      onClick={togglePlay}
    >
      
      <video
        ref={videoRef}
        src={virtualUrl}
        className="absolute inset-0 w-full h-full object-contain"
        poster={poster}
        playsInline
        autoPlay={autoPlay}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); setControlsVisible(true); }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onSeeking={() => setBuffering(true)}
        onSeeked={() => setBuffering(false)}
      />

      {/* Loading Spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <Loader className="w-10 h-10 text-white animate-spin drop-shadow-lg" />
        </div>
      )}

      {/* Control Bar Overlay */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute bottom-0 inset-x-0 px-4 pb-4 pt-12 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-2 z-20 transition-all duration-300",
          controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <div 
          className="w-full h-1.5 bg-white/30 rounded-full relative cursor-pointer group py-2" 
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (videoRef.current && duration) videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
          }}
        >
          {/* Buffer / Timeline Track */}
          <div className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-red-600 rounded-full transition-all duration-100" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
          {/* Timeline Thumb */}
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }} />
        </div>
        
        <div className="flex items-center justify-between text-white text-sm mt-1 select-none">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="hover:bg-white/20 p-2 rounded-full transition-colors">
              {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
            </button>
            <span className="font-medium tracking-wide font-mono text-xs opacity-90 text-shadow">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button onClick={toggleFs} className="hover:bg-white/20 p-2 rounded-full transition-colors">
            {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CBVideoPlayer;
